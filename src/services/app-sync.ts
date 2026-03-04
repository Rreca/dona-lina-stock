/**
 * Application-level sync functions
 * Simplified wrappers around GistSyncService for use in App component
 */

import { GistClient } from './gist-client';
import { GistSyncService, type AppData } from './gist-sync';
import type { Product, Supplier, StockMovement, Purchase, Settings, MetaFile } from '../models/types';

let gistSyncService: GistSyncService | null = null;

/**
 * Get Gist ID from localStorage or environment
 */
function getGistId(): string {
  const gistId = localStorage.getItem('gist_id');
  if (!gistId) {
    throw new Error('Gist ID not configured. Please set up your Gist ID in settings.');
  }
  return gistId;
}

/**
 * Initialize the sync service with a token
 */
function initSyncService(token: string): GistSyncService {
  const gistId = getGistId();
  const gistClient = new GistClient({ token, gistId });
  gistSyncService = new GistSyncService(gistClient);
  return gistSyncService;
}

/**
 * Get or create sync service instance
 */
function getSyncService(token: string): GistSyncService {
  if (!gistSyncService) {
    return initSyncService(token);
  }
  return gistSyncService;
}

/**
 * Sync data from Gist
 */
export async function syncFromGist(token: string): Promise<AppData> {
  const service = getSyncService(token);
  return await service.loadFromGist();
}

/**
 * Sync data to Gist
 */
export async function syncToGist(
  token: string,
  data: {
    products?: Product[];
    suppliers?: Supplier[];
    movements?: StockMovement[];
    purchases?: Purchase[];
    settings?: Settings;
    meta?: MetaFile;
  }
): Promise<void> {
  const service = getSyncService(token);
  await service.saveToGist(data);
}

/**
 * Load data on app startup (tries cache first, then Gist)
 */
export async function loadOnStartup(token: string): Promise<AppData> {
  const service = getSyncService(token);
  return await service.loadOnStartup();
}

/**
 * Clear all cached data
 */
export async function clearAllData(): Promise<void> {
  if (gistSyncService) {
    await gistSyncService.clearCache();
  }
  gistSyncService = null;
}

/**
 * Set Gist ID for the application
 */
export function setGistId(gistId: string): void {
  localStorage.setItem('gist_id', gistId);
  // Reset sync service to pick up new gist ID
  gistSyncService = null;
}

/**
 * Process the offline queue by retrying all queued operations
 * Returns the number of successfully processed operations
 */
export async function processOfflineQueue(token: string): Promise<number> {
  const service = getSyncService(token);
  return await service.processOfflineQueue();
}

/**
 * Get the current offline queue status
 */
export async function getOfflineQueueStatus(token: string): Promise<{ pendingCount: number }> {
  const service = getSyncService(token);
  return await service.getOfflineQueueStatus();
}

/**
 * Clear the offline queue
 */
export async function clearOfflineQueue(token: string): Promise<void> {
  const service = getSyncService(token);
  await service.clearOfflineQueue();
}
