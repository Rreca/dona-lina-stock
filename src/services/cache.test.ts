/**
 * Unit tests for cache service (IndexedDB layer)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
} from '../models/types';

// Mock IndexedDB using fake-indexeddb
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Set up IndexedDB before importing cache service
globalThis.indexedDB = new IDBFactory();

import { CacheService } from './cache';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset IndexedDB before each test
    globalThis.indexedDB = new IDBFactory();
    cacheService = new CacheService();
  });

  afterEach(async () => {
    // Clean up after each test
    await cacheService.clearAll();
  });

  describe('Products cache operations', () => {
    it('should store and retrieve products', async () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          category: 'Category B',
          unit: 'kg',
          sku: 'SKU-002',
          minStock: 5,
          salePriceCents: 1500,
          active: true,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await cacheService.setProducts(products);
      const retrieved = await cacheService.getProducts();

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toEqual(products);
    });

    it('should return empty array when no products cached', async () => {
      const products = await cacheService.getProducts();
      expect(products).toEqual([]);
    });

    it('should overwrite existing products on set', async () => {
      const initialProducts: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const updatedProducts: Product[] = [
        {
          id: 'prod-2',
          name: 'Product 2',
          category: 'Category B',
          unit: 'kg',
          minStock: 5,
          active: true,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await cacheService.setProducts(initialProducts);
      await cacheService.setProducts(updatedProducts);
      const retrieved = await cacheService.getProducts();

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe('prod-2');
    });
  });

  describe('Suppliers cache operations', () => {
    it('should store and retrieve suppliers', async () => {
      const suppliers: Supplier[] = [
        {
          id: 'sup-1',
          name: 'Supplier 1',
          notes: 'Main supplier',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'sup-2',
          name: 'Supplier 2',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await cacheService.setSuppliers(suppliers);
      const retrieved = await cacheService.getSuppliers();

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toEqual(suppliers);
    });

    it('should return empty array when no suppliers cached', async () => {
      const suppliers = await cacheService.getSuppliers();
      expect(suppliers).toEqual([]);
    });
  });

  describe('Movements cache operations', () => {
    it('should store and retrieve movements', async () => {
      const movements: StockMovement[] = [
        {
          id: 'mov-1',
          date: '2024-01-01T00:00:00.000Z',
          productId: 'prod-1',
          type: 'in',
          qty: 100,
          note: 'Initial stock',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'mov-2',
          date: '2024-01-02T00:00:00.000Z',
          productId: 'prod-1',
          type: 'out',
          qty: 20,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await cacheService.setMovements(movements);
      const retrieved = await cacheService.getMovements();

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toEqual(movements);
    });

    it('should return empty array when no movements cached', async () => {
      const movements = await cacheService.getMovements();
      expect(movements).toEqual([]);
    });
  });

  describe('Purchases cache operations', () => {
    it('should store and retrieve purchases', async () => {
      const purchases: Purchase[] = [
        {
          id: 'pur-1',
          date: '2024-01-01T00:00:00.000Z',
          supplierId: 'sup-1',
          items: [
            {
              productId: 'prod-1',
              qty: 50,
              unitCostCents: 1000,
            },
          ],
          note: 'First purchase',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'pur-2',
          date: '2024-01-02T00:00:00.000Z',
          supplierId: 'sup-2',
          items: [
            {
              productId: 'prod-2',
              qty: 30,
              unitCostCents: 1500,
            },
            {
              productId: 'prod-3',
              qty: 20,
              unitCostCents: 2000,
            },
          ],
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await cacheService.setPurchases(purchases);
      const retrieved = await cacheService.getPurchases();

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toEqual(purchases);
    });

    it('should return empty array when no purchases cached', async () => {
      const purchases = await cacheService.getPurchases();
      expect(purchases).toEqual([]);
    });
  });

  describe('Settings cache operations', () => {
    it('should store and retrieve settings', async () => {
      const settings: Settings = {
        costMethod: 'last',
        weightedAvgWindow: {
          type: 'last_n_purchases',
          value: 5,
        },
        priceRule: {
          markupPct: 30,
          roundToCents: 10,
          minMarginPct: 20,
        },
      };

      await cacheService.setSettings(settings);
      const retrieved = await cacheService.getSettings();

      expect(retrieved).toEqual(settings);
    });

    it('should return null when no settings cached', async () => {
      const settings = await cacheService.getSettings();
      expect(settings).toBeNull();
    });

    it('should overwrite existing settings', async () => {
      const initialSettings: Settings = {
        costMethod: 'last',
        weightedAvgWindow: {
          type: 'last_n_purchases',
          value: 5,
        },
        priceRule: {
          markupPct: 30,
          roundToCents: 10,
        },
      };

      const updatedSettings: Settings = {
        costMethod: 'weighted_avg',
        weightedAvgWindow: {
          type: 'last_days',
          value: 30,
        },
        priceRule: {
          markupPct: 40,
          roundToCents: 50,
          minMarginPct: 25,
        },
      };

      await cacheService.setSettings(initialSettings);
      await cacheService.setSettings(updatedSettings);
      const retrieved = await cacheService.getSettings();

      expect(retrieved).toEqual(updatedSettings);
      expect(retrieved?.costMethod).toBe('weighted_avg');
    });
  });

  describe('Meta cache operations', () => {
    it('should store and retrieve meta information', async () => {
      const meta: MetaFile = {
        schemaVersion: '1.0.0',
        lastSyncAt: '2024-01-01T12:00:00.000Z',
        snapshots: {
          '2024-01': {
            stockByProduct: {
              'prod-1': 100,
              'prod-2': 50,
            },
            updatedAt: '2024-01-31T23:59:59.000Z',
          },
        },
      };

      await cacheService.setMeta(meta);
      const retrieved = await cacheService.getMeta();

      expect(retrieved).toEqual(meta);
    });

    it('should return null when no meta cached', async () => {
      const meta = await cacheService.getMeta();
      expect(meta).toBeNull();
    });

    it('should update meta information', async () => {
      const initialMeta: MetaFile = {
        schemaVersion: '1.0.0',
        lastSyncAt: '2024-01-01T12:00:00.000Z',
        snapshots: {},
      };

      const updatedMeta: MetaFile = {
        schemaVersion: '1.0.0',
        lastSyncAt: '2024-01-02T12:00:00.000Z',
        snapshots: {
          '2024-01': {
            stockByProduct: {
              'prod-1': 150,
            },
            updatedAt: '2024-01-31T23:59:59.000Z',
          },
        },
      };

      await cacheService.setMeta(initialMeta);
      await cacheService.setMeta(updatedMeta);
      const retrieved = await cacheService.getMeta();

      expect(retrieved).toEqual(updatedMeta);
      expect(retrieved?.lastSyncAt).toBe('2024-01-02T12:00:00.000Z');
    });
  });

  describe('Cache invalidation and clearing', () => {
    it('should clear all cached data', async () => {
      // Populate all stores
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const suppliers: Supplier[] = [
        {
          id: 'sup-1',
          name: 'Supplier 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const movements: StockMovement[] = [
        {
          id: 'mov-1',
          date: '2024-01-01T00:00:00.000Z',
          productId: 'prod-1',
          type: 'in',
          qty: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const purchases: Purchase[] = [
        {
          id: 'pur-1',
          date: '2024-01-01T00:00:00.000Z',
          supplierId: 'sup-1',
          items: [
            {
              productId: 'prod-1',
              qty: 50,
              unitCostCents: 1000,
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const settings: Settings = {
        costMethod: 'last',
        weightedAvgWindow: {
          type: 'last_n_purchases',
          value: 5,
        },
        priceRule: {
          markupPct: 30,
          roundToCents: 10,
        },
      };

      const meta: MetaFile = {
        schemaVersion: '1.0.0',
        lastSyncAt: '2024-01-01T12:00:00.000Z',
        snapshots: {},
      };

      await cacheService.setProducts(products);
      await cacheService.setSuppliers(suppliers);
      await cacheService.setMovements(movements);
      await cacheService.setPurchases(purchases);
      await cacheService.setSettings(settings);
      await cacheService.setMeta(meta);

      // Clear all
      await cacheService.clearAll();

      // Verify all stores are empty
      expect(await cacheService.getProducts()).toEqual([]);
      expect(await cacheService.getSuppliers()).toEqual([]);
      expect(await cacheService.getMovements()).toEqual([]);
      expect(await cacheService.getPurchases()).toEqual([]);
      expect(await cacheService.getSettings()).toBeNull();
      expect(await cacheService.getMeta()).toBeNull();
    });

    it('should handle clearing empty cache', async () => {
      await expect(cacheService.clearAll()).resolves.not.toThrow();
    });

    it('should allow re-populating cache after clearing', async () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      await cacheService.setProducts(products);
      await cacheService.clearAll();
      await cacheService.setProducts(products);

      const retrieved = await cacheService.getProducts();
      expect(retrieved).toEqual(products);
    });
  });

  describe('Cache synchronization scenarios', () => {
    it('should handle multiple rapid writes to same store', async () => {
      const products1: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const products2: Product[] = [
        {
          id: 'prod-2',
          name: 'Product 2',
          category: 'Category B',
          unit: 'kg',
          minStock: 5,
          active: true,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await Promise.all([
        cacheService.setProducts(products1),
        cacheService.setProducts(products2),
      ]);

      const retrieved = await cacheService.getProducts();
      // One of the writes should succeed
      expect(retrieved.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations on different stores', async () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          category: 'Category A',
          unit: 'unit',
          minStock: 10,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const suppliers: Supplier[] = [
        {
          id: 'sup-1',
          name: 'Supplier 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const settings: Settings = {
        costMethod: 'last',
        weightedAvgWindow: {
          type: 'last_n_purchases',
          value: 5,
        },
        priceRule: {
          markupPct: 30,
          roundToCents: 10,
        },
      };

      await Promise.all([
        cacheService.setProducts(products),
        cacheService.setSuppliers(suppliers),
        cacheService.setSettings(settings),
      ]);

      const [retrievedProducts, retrievedSuppliers, retrievedSettings] =
        await Promise.all([
          cacheService.getProducts(),
          cacheService.getSuppliers(),
          cacheService.getSettings(),
        ]);

      expect(retrievedProducts).toEqual(products);
      expect(retrievedSuppliers).toEqual(suppliers);
      expect(retrievedSettings).toEqual(settings);
    });
  });
});
