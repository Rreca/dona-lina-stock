/**
 * Gist synchronization service
 * Coordinates between Gist API and local IndexedDB cache
 * Handles loading from cache on startup and updating cache after successful writes
 */

import { GistClient, GistError, type GistReadResult } from './gist-client';
import { cacheService } from './cache';
import { offlineQueueService } from './offline-queue';
import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
  ProductsFile,
  SuppliersFile,
  MovementsFile,
  PurchasesFile,
} from '../models/types';

/**
 * Sync status types
 */
export type SyncStatus = 'idle' | 'loading' | 'syncing' | 'error';

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  fromCache: boolean;
  error?: GistError;
}

/**
 * Application data structure
 */
export interface AppData {
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  purchases: Purchase[];
  settings: Settings | null;
  meta: MetaFile | null;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: Settings = {
  costMethod: 'last',
  weightedAvgWindow: {
    type: 'last_n_purchases',
    value: 10,
  },
  priceRule: {
    markupPct: 30,
    roundToCents: 10,
    minMarginPct: 15,
  },
};

/**
 * Gist synchronization service
 * Manages data flow between Gist API and local cache
 */
export class GistSyncService {
  private gistClient: GistClient;
  private status: SyncStatus = 'idle';
  private lastSyncError: GistError | null = null;

  constructor(gistClient: GistClient) {
    this.gistClient = gistClient;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get last sync error
   */
  getLastError(): GistError | null {
    return this.lastSyncError;
  }

  /**
   * Load data on app startup
   * First tries to load from cache for fast initial load,
   * then syncs with Gist in the background
   */
  async loadOnStartup(): Promise<AppData> {
    this.status = 'loading';
    this.lastSyncError = null;

    try {
      // Try to load from cache first for fast initial load
      const cachedData = await this.loadFromCache();

      // If we have cached data, return it immediately
      if (this.hasCachedData(cachedData)) {
        // Sync with Gist in the background (don't await)
        this.syncInBackground();
        return cachedData;
      }

      // No cached data, must load from Gist
      return await this.loadFromGist();
    } catch (error) {
      this.status = 'error';
      this.lastSyncError = error instanceof GistError ? error : null;
      throw error;
    }
  }

  /**
   * Load data from cache
   */
  private async loadFromCache(): Promise<AppData> {
    const [products, suppliers, movements, purchases, settings, meta] = await Promise.all([
      cacheService.getProducts(),
      cacheService.getSuppliers(),
      cacheService.getMovements(),
      cacheService.getPurchases(),
      cacheService.getSettings(),
      cacheService.getMeta(),
    ]);

    return {
      products,
      suppliers,
      movements,
      purchases,
      settings,
      meta,
    };
  }

  /**
   * Check if cached data exists
   */
  private hasCachedData(data: AppData): boolean {
    return (
      data.products.length > 0 ||
      data.suppliers.length > 0 ||
      data.movements.length > 0 ||
      data.purchases.length > 0 ||
      data.settings !== null
    );
  }

  /**
   * Load data from Gist
   */
  async loadFromGist(): Promise<AppData> {
    this.status = 'syncing';
    this.lastSyncError = null;

    try {
      const result = await this.gistClient.read();
      const data = this.parseGistFiles(result);

      // Update cache with fresh data
      await this.updateCache(data);

      this.status = 'idle';
      return data;
    } catch (error) {
      this.status = 'error';
      this.lastSyncError = error instanceof GistError ? error : null;
      throw error;
    }
  }

  /**
   * Sync with Gist in the background
   * Used after loading from cache to get latest data
   */
  private async syncInBackground(): Promise<void> {
    try {
      await this.loadFromGist();
    } catch (error) {
      // Log error but don't throw - this is a background operation
      console.error('Background sync failed:', error);
    }
  }

  /**
   * Parse Gist files into application data
   */
  private parseGistFiles(result: GistReadResult): AppData {
    const files = result.files;

    // Parse products
    let products: Product[] = [];
    if (files['products.json']) {
      try {
        const productsFile: ProductsFile = JSON.parse(files['products.json']);
        products = productsFile.products || [];
      } catch (error) {
        console.error('Failed to parse products.json:', error);
      }
    }

    // Parse suppliers
    let suppliers: Supplier[] = [];
    if (files['suppliers.json']) {
      try {
        const suppliersFile: SuppliersFile = JSON.parse(files['suppliers.json']);
        suppliers = suppliersFile.suppliers || [];
      } catch (error) {
        console.error('Failed to parse suppliers.json:', error);
      }
    }

    // Parse movements (combine all monthly files)
    let movements: StockMovement[] = [];
    for (const [filename, content] of Object.entries(files)) {
      if (filename.startsWith('movements_') && filename.endsWith('.json')) {
        try {
          const movementsFile: MovementsFile = JSON.parse(content);
          movements.push(...(movementsFile.movements || []));
        } catch (error) {
          console.error(`Failed to parse ${filename}:`, error);
        }
      }
    }

    // Parse purchases (combine all monthly files)
    let purchases: Purchase[] = [];
    for (const [filename, content] of Object.entries(files)) {
      if (filename.startsWith('purchases_') && filename.endsWith('.json')) {
        try {
          const purchasesFile: PurchasesFile = JSON.parse(content);
          purchases.push(...(purchasesFile.purchases || []));
        } catch (error) {
          console.error(`Failed to parse ${filename}:`, error);
        }
      }
    }

    // Parse settings
    let settings: Settings | null = null;
    if (files['settings.json']) {
      try {
        settings = JSON.parse(files['settings.json']);
      } catch (error) {
        console.error('Failed to parse settings.json:', error);
      }
    }
    // Use default settings if none exist
    if (!settings) {
      settings = DEFAULT_SETTINGS;
    }

    // Parse meta
    let meta: MetaFile | null = null;
    if (files['meta.json']) {
      try {
        meta = JSON.parse(files['meta.json']);
      } catch (error) {
        console.error('Failed to parse meta.json:', error);
      }
    }

    return {
      products,
      suppliers,
      movements,
      purchases,
      settings,
      meta,
    };
  }

  /**
   * Update cache with new data
   */
  async updateCache(data: AppData): Promise<void> {
    await Promise.all([
      cacheService.setProducts(data.products),
      cacheService.setSuppliers(data.suppliers),
      cacheService.setMovements(data.movements),
      cacheService.setPurchases(data.purchases),
      data.settings ? cacheService.setSettings(data.settings) : Promise.resolve(),
      data.meta ? cacheService.setMeta(data.meta) : Promise.resolve(),
    ]);
  }

  /**
   * Save data to Gist and update cache on success
   * If save fails, queue the operation for retry when network returns
   */
  async saveToGist(data: Partial<AppData>): Promise<void> {
    this.status = 'syncing';
    this.lastSyncError = null;

    try {
      // Prepare files to write
      const files: Record<string, string | null> = {};

      if (data.products !== undefined) {
        const productsFile: ProductsFile = { products: data.products };
        files['products.json'] = JSON.stringify(productsFile, null, 2);
      }

      if (data.suppliers !== undefined) {
        const suppliersFile: SuppliersFile = { suppliers: data.suppliers };
        files['suppliers.json'] = JSON.stringify(suppliersFile, null, 2);
      }

      if (data.settings !== undefined && data.settings !== null) {
        files['settings.json'] = JSON.stringify(data.settings, null, 2);
      }

      if (data.meta !== undefined && data.meta !== null) {
        files['meta.json'] = JSON.stringify(data.meta, null, 2);
      }

      // Handle movements with monthly partitioning
      if (data.movements !== undefined) {
        const movementsByMonth = this.partitionByMonth(data.movements, (m) => m.date);
        for (const [monthKey, movements] of Object.entries(movementsByMonth)) {
          const movementsFile: MovementsFile = { movements };
          files[`movements_${monthKey}.json`] = JSON.stringify(movementsFile, null, 2);
        }
      }

      // Handle purchases with monthly partitioning
      if (data.purchases !== undefined) {
        const purchasesByMonth = this.partitionByMonth(data.purchases, (p) => p.date);
        for (const [monthKey, purchases] of Object.entries(purchasesByMonth)) {
          const purchasesFile: PurchasesFile = { purchases };
          files[`purchases_${monthKey}.json`] = JSON.stringify(purchasesFile, null, 2);
        }
      }

      // Write to Gist
      await this.gistClient.write(files);

      // Update cache after successful write
      await this.updateCache({
        products: data.products || [],
        suppliers: data.suppliers || [],
        movements: data.movements || [],
        purchases: data.purchases || [],
        settings: data.settings || null,
        meta: data.meta || null,
      });

      this.status = 'idle';
    } catch (error) {
      this.status = 'error';
      this.lastSyncError = error instanceof GistError ? error : null;

      // Queue the operation for retry if it's a network or server error
      if (error instanceof GistError) {
        const shouldQueue =
          error.type === 'network_error' ||
          error.type === 'server_error' ||
          error.type === 'rate_limit';

        if (shouldQueue) {
          await offlineQueueService.enqueue(data, error.message);
          console.log('Operation queued for retry when network returns');
        }
      }

      throw error;
    }
  }

  /**
   * Partition items by month (YYYY_MM format)
   */
  private partitionByMonth<T>(
    items: T[],
    getDate: (item: T) => string
  ): Record<string, T[]> {
    const byMonth: Record<string, T[]> = {};

    for (const item of items) {
      const date = new Date(getDate(item));
      const monthKey = `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = [];
      }
      byMonth[monthKey].push(item);
    }

    return byMonth;
  }

  /**
   * Handle cache invalidation when remote changes are detected
   * Reloads data from Gist and updates cache
   */
  async handleRemoteChanges(): Promise<AppData> {
    return await this.loadFromGist();
  }

  /**
   * Clear all cached data (used on logout)
   */
  async clearCache(): Promise<void> {
    await cacheService.clearAll();
  }

  /**
   * Process the offline queue by retrying all queued operations
   * Returns the number of successfully processed operations
   */
  async processOfflineQueue(): Promise<number> {
    return await offlineQueueService.processQueue(async (data) => {
      await this.saveToGist(data);
    });
  }

  /**
   * Get the current offline queue status
   */
  async getOfflineQueueStatus(): Promise<{ pendingCount: number }> {
    const status = await offlineQueueService.getStatus();
    return { pendingCount: status.pendingCount };
  }

  /**
   * Clear the offline queue
   */
  async clearOfflineQueue(): Promise<void> {
    await offlineQueueService.clearQueue();
  }
}
