/**
 * Offline queue service for handling failed write operations
 * Queues failed operations locally and retries when network returns
 */

import type { AppData } from './gist-sync';

/**
 * Queued operation types
 */
export type QueuedOperationType = 'write';

/**
 * Queued operation
 */
export interface QueuedOperation {
  id: string;
  type: QueuedOperationType;
  data: Partial<AppData>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Queue status
 */
export interface QueueStatus {
  pendingCount: number;
  operations: QueuedOperation[];
}

const DB_NAME = 'dona-lina-stock';
const DB_VERSION = 2; // Increment version to add new store
const QUEUE_STORE = 'offline_queue';
const MAX_RETRY_COUNT = 5;

/**
 * Initialize IndexedDB with offline queue store
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create offline queue store if it doesn't exist
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        // Index by timestamp for ordering
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Offline queue service
 * Manages queuing and retrying of failed write operations
 */
export class OfflineQueueService {
  private dbPromise: Promise<IDBDatabase>;
  private isProcessing = false;

  constructor() {
    this.dbPromise = initDB();
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(data: Partial<AppData>, error?: string): Promise<string> {
    const db = await this.dbPromise;
    const operation: QueuedOperation = {
      id: this.generateId(),
      type: 'write',
      data,
      timestamp: Date.now(),
      retryCount: 0,
      lastError: error,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.add(operation);

      request.onsuccess = () => resolve(operation.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all queued operations
   */
  async getAll(): Promise<QueuedOperation[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    const operations = await this.getAll();
    return {
      pendingCount: operations.length,
      operations,
    };
  }

  /**
   * Remove an operation from the queue
   */
  async dequeue(operationId: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.delete(operationId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an operation's retry count and error
   */
  async updateOperation(
    operationId: string,
    retryCount: number,
    error?: string
  ): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.retryCount = retryCount;
          operation.lastError = error;
          const putRequest = store.put(operation);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Process the queue by retrying all operations
   * Returns the number of successfully processed operations
   */
  async processQueue(
    retryFn: (data: Partial<AppData>) => Promise<void>
  ): Promise<number> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return 0;
    }

    this.isProcessing = true;
    let successCount = 0;

    try {
      const operations = await this.getAll();

      for (const operation of operations) {
        // Skip operations that have exceeded max retry count
        if (operation.retryCount >= MAX_RETRY_COUNT) {
          console.warn(
            `Operation ${operation.id} exceeded max retry count, removing from queue`
          );
          await this.dequeue(operation.id);
          continue;
        }

        try {
          // Attempt to retry the operation
          await retryFn(operation.data);

          // Success - remove from queue
          await this.dequeue(operation.id);
          successCount++;
        } catch (error) {
          // Failed - update retry count and error
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.updateOperation(
            operation.id,
            operation.retryCount + 1,
            errorMessage
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return successCount;
  }

  /**
   * Clear all queued operations
   */
  async clearQueue(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generate a unique ID for an operation
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();
