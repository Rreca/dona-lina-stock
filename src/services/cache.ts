/**
 * IndexedDB cache layer for offline support and fast initial load
 * Stores products, suppliers, movements, purchases, and settings locally
 */

import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
} from '../models/types';

const DB_NAME = 'dona-lina-stock';
const DB_VERSION = 1;

// Object store names
const STORES = {
  PRODUCTS: 'products',
  SUPPLIERS: 'suppliers',
  MOVEMENTS: 'movements',
  PURCHASES: 'purchases',
  SETTINGS: 'settings',
  META: 'meta',
} as const;

/**
 * Initialize IndexedDB with required object stores
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SUPPLIERS)) {
        db.createObjectStore(STORES.SUPPLIERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.MOVEMENTS)) {
        db.createObjectStore(STORES.MOVEMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.PURCHASES)) {
        db.createObjectStore(STORES.PURCHASES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        // Settings store uses a fixed key 'current'
        db.createObjectStore(STORES.SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        // Meta store uses a fixed key 'current'
        db.createObjectStore(STORES.META);
      }
    };
  });
}

/**
 * Cache service for IndexedDB operations
 */
export class CacheService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = initDB();
  }

  /**
   * Get all products from cache
   */
  async getProducts(): Promise<Product[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
      const store = transaction.objectStore(STORES.PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save products to cache
   */
  async setProducts(products: Product[]): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PRODUCTS, 'readwrite');
      const store = transaction.objectStore(STORES.PRODUCTS);

      // Clear existing products
      store.clear();

      // Add all products
      products.forEach((product) => store.put(product));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all suppliers from cache
   */
  async getSuppliers(): Promise<Supplier[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SUPPLIERS, 'readonly');
      const store = transaction.objectStore(STORES.SUPPLIERS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save suppliers to cache
   */
  async setSuppliers(suppliers: Supplier[]): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SUPPLIERS, 'readwrite');
      const store = transaction.objectStore(STORES.SUPPLIERS);

      // Clear existing suppliers
      store.clear();

      // Add all suppliers
      suppliers.forEach((supplier) => store.put(supplier));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all movements from cache
   */
  async getMovements(): Promise<StockMovement[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MOVEMENTS, 'readonly');
      const store = transaction.objectStore(STORES.MOVEMENTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save movements to cache
   */
  async setMovements(movements: StockMovement[]): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.MOVEMENTS, 'readwrite');
      const store = transaction.objectStore(STORES.MOVEMENTS);

      // Clear existing movements
      store.clear();

      // Add all movements
      movements.forEach((movement) => store.put(movement));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all purchases from cache
   */
  async getPurchases(): Promise<Purchase[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PURCHASES, 'readonly');
      const store = transaction.objectStore(STORES.PURCHASES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save purchases to cache
   */
  async setPurchases(purchases: Purchase[]): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PURCHASES, 'readwrite');
      const store = transaction.objectStore(STORES.PURCHASES);

      // Clear existing purchases
      store.clear();

      // Add all purchases
      purchases.forEach((purchase) => store.put(purchase));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get settings from cache
   */
  async getSettings(): Promise<Settings | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SETTINGS, 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save settings to cache
   */
  async setSettings(settings: Settings): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.put(settings, 'current');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get meta information from cache
   */
  async getMeta(): Promise<MetaFile | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.META, 'readonly');
      const store = transaction.objectStore(STORES.META);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save meta information to cache
   */
  async setMeta(meta: MetaFile): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.META, 'readwrite');
      const store = transaction.objectStore(STORES.META);
      const request = store.put(meta, 'current');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached data (used on logout)
   */
  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const storeNames = [
        STORES.PRODUCTS,
        STORES.SUPPLIERS,
        STORES.MOVEMENTS,
        STORES.PURCHASES,
        STORES.SETTINGS,
        STORES.META,
      ];

      const transaction = db.transaction(storeNames, 'readwrite');

      storeNames.forEach((storeName) => {
        transaction.objectStore(storeName).clear();
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const cacheService = new CacheService();
