/**
 * Unit tests for offline queue service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock IndexedDB using fake-indexeddb
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Set up IndexedDB before importing offline queue service
globalThis.indexedDB = new IDBFactory();

import { OfflineQueueService } from './offline-queue';
import type { AppData } from './gist-sync';

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;

  beforeEach(() => {
    // Reset IndexedDB before each test
    globalThis.indexedDB = new IDBFactory();
    service = new OfflineQueueService();
  });

  afterEach(async () => {
    // Clean up queue after each test
    await service.clearQueue();
  });

  describe('Queue Operations', () => {
    it('should enqueue an operation', async () => {
      const data: Partial<AppData> = {
        products: [{ id: '1', name: 'Test Product', category: '', unit: 'unit', minStock: 0, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      };

      const operationId = await service.enqueue(data);

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(1);
      expect(status.operations[0].id).toBe(operationId);
      expect(status.operations[0].data).toEqual(data);
      expect(status.operations[0].retryCount).toBe(0);
    });

    it('should enqueue multiple operations', async () => {
      const data1: Partial<AppData> = { products: [] };
      const data2: Partial<AppData> = { suppliers: [] };
      const data3: Partial<AppData> = { settings: { costMethod: 'last', weightedAvgWindow: { type: 'last_n_purchases', value: 10 }, priceRule: { markupPct: 30, roundToCents: 10 } } };

      await service.enqueue(data1);
      await service.enqueue(data2);
      await service.enqueue(data3);

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(3);
    });

    it('should enqueue operation with error message', async () => {
      const data: Partial<AppData> = { products: [] };
      const errorMessage = 'Network timeout';

      const operationId = await service.enqueue(data, errorMessage);

      const status = await service.getStatus();
      expect(status.operations[0].lastError).toBe(errorMessage);
    });

    it('should dequeue an operation', async () => {
      const data: Partial<AppData> = { products: [] };
      const operationId = await service.enqueue(data);

      await service.dequeue(operationId);

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(0);
    });

    it('should get all queued operations in order', async () => {
      const data1: Partial<AppData> = { products: [] };
      const data2: Partial<AppData> = { suppliers: [] };

      // Add small delay to ensure different timestamps
      const id1 = await service.enqueue(data1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await service.enqueue(data2);

      const operations = await service.getAll();
      expect(operations).toHaveLength(2);
      expect(operations[0].id).toBe(id1);
      expect(operations[1].id).toBe(id2);
    });

    it('should update operation retry count and error', async () => {
      const data: Partial<AppData> = { products: [] };
      const operationId = await service.enqueue(data);

      await service.updateOperation(operationId, 2, 'Retry failed');

      const status = await service.getStatus();
      expect(status.operations[0].retryCount).toBe(2);
      expect(status.operations[0].lastError).toBe('Retry failed');
    });

    it('should clear all queued operations', async () => {
      await service.enqueue({ products: [] });
      await service.enqueue({ suppliers: [] });
      await service.enqueue({ settings: { costMethod: 'last', weightedAvgWindow: { type: 'last_n_purchases', value: 10 }, priceRule: { markupPct: 30, roundToCents: 10 } } });

      await service.clearQueue();

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(0);
    });
  });

  describe('Retry Logic', () => {
    it('should process queue and retry successful operations', async () => {
      const data1: Partial<AppData> = { products: [] };
      const data2: Partial<AppData> = { suppliers: [] };

      await service.enqueue(data1);
      await service.enqueue(data2);

      const retryFn = vi.fn().mockResolvedValue(undefined);
      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(2);
      expect(retryFn).toHaveBeenCalledTimes(2);
      expect(retryFn).toHaveBeenCalledWith(data1);
      expect(retryFn).toHaveBeenCalledWith(data2);

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(0);
    });

    it('should update retry count on failed retry', async () => {
      const data: Partial<AppData> = { products: [] };
      await service.enqueue(data);

      const retryFn = vi.fn().mockRejectedValue(new Error('Network error'));
      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(0);
      expect(retryFn).toHaveBeenCalledTimes(1);

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(1);
      expect(status.operations[0].retryCount).toBe(1);
      expect(status.operations[0].lastError).toBe('Network error');
    });

    it('should remove operations that exceed max retry count', async () => {
      const data: Partial<AppData> = { products: [] };
      const operationId = await service.enqueue(data);

      // Set retry count to max (5)
      await service.updateOperation(operationId, 5, 'Max retries reached');

      const retryFn = vi.fn();
      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(0);
      expect(retryFn).not.toHaveBeenCalled();

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(0);
    });

    it('should handle mixed success and failure during processing', async () => {
      const data1: Partial<AppData> = { products: [] };
      const data2: Partial<AppData> = { suppliers: [] };
      const data3: Partial<AppData> = { settings: { costMethod: 'last', weightedAvgWindow: { type: 'last_n_purchases', value: 10 }, priceRule: { markupPct: 30, roundToCents: 10 } } };

      await service.enqueue(data1);
      await service.enqueue(data2);
      await service.enqueue(data3);

      // First and third succeed, second fails
      const retryFn = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(2);
      expect(retryFn).toHaveBeenCalledTimes(3);

      const status = await service.getStatus();
      expect(status.pendingCount).toBe(1);
      // The failed operation should have retry count incremented
      expect(status.operations[0].retryCount).toBe(1);
      expect(status.operations[0].lastError).toBe('Failed');
    });

    it('should prevent concurrent queue processing', async () => {
      await service.enqueue({ products: [] });

      const retryFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start first processing
      const promise1 = service.processQueue(retryFn);
      
      // Try to start second processing immediately
      const promise2 = service.processQueue(retryFn);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First should process, second should return 0
      expect(result1).toBe(1);
      expect(result2).toBe(0);
      expect(retryFn).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions in retry function', async () => {
      const data: Partial<AppData> = { products: [] };
      await service.enqueue(data);

      const retryFn = vi.fn().mockRejectedValue('String error');
      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(0);

      const status = await service.getStatus();
      expect(status.operations[0].lastError).toBe('Unknown error');
    });
  });

  describe('Queue Persistence', () => {
    it('should persist queue across service instances', async () => {
      const data: Partial<AppData> = { products: [] };
      const operationId = await service.enqueue(data);

      // Create new service instance
      const newService = new OfflineQueueService();
      const status = await newService.getStatus();

      expect(status.pendingCount).toBe(1);
      expect(status.operations[0].id).toBe(operationId);
      expect(status.operations[0].data).toEqual(data);

      // Clean up
      await newService.clearQueue();
    });

    it('should maintain operation order across instances', async () => {
      const data1: Partial<AppData> = { products: [] };
      const data2: Partial<AppData> = { suppliers: [] };

      const id1 = await service.enqueue(data1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await service.enqueue(data2);

      // Create new service instance
      const newService = new OfflineQueueService();
      const operations = await newService.getAll();

      expect(operations).toHaveLength(2);
      expect(operations[0].id).toBe(id1);
      expect(operations[1].id).toBe(id2);

      // Clean up
      await newService.clearQueue();
    });

    it('should persist retry count updates', async () => {
      const data: Partial<AppData> = { products: [] };
      const operationId = await service.enqueue(data);

      await service.updateOperation(operationId, 3, 'Persistent error');

      // Create new service instance
      const newService = new OfflineQueueService();
      const status = await newService.getStatus();

      expect(status.operations[0].retryCount).toBe(3);
      expect(status.operations[0].lastError).toBe('Persistent error');

      // Clean up
      await newService.clearQueue();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue processing', async () => {
      const retryFn = vi.fn();
      const successCount = await service.processQueue(retryFn);

      expect(successCount).toBe(0);
      expect(retryFn).not.toHaveBeenCalled();
    });

    it('should handle dequeue of non-existent operation', async () => {
      await expect(service.dequeue('non-existent-id')).resolves.not.toThrow();
    });

    it('should handle update of non-existent operation', async () => {
      await expect(
        service.updateOperation('non-existent-id', 1, 'error')
      ).resolves.not.toThrow();
    });

    it('should generate unique operation IDs', async () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const id = await service.enqueue({ products: [] });
        ids.add(id);
      }

      expect(ids.size).toBe(10);
    });
  });
});
