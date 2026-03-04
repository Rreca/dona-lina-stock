/**
 * Data clearing service for privacy and data management
 * Provides utilities to clear all application data from various storage locations
 */

import { authService } from './auth';
import { cacheService } from './cache';

// ============================================================================
// Types
// ============================================================================

export interface DataClearingResult {
  success: boolean;
  clearedLocations: string[];
  errors: string[];
}

export interface DataStorageInfo {
  location: string;
  description: string;
  dataTypes: string[];
  estimatedSize?: string;
}

// ============================================================================
// Data Clearing Service
// ============================================================================

/**
 * Service for clearing application data and managing privacy
 */
export class DataClearingService {
  /**
   * Get information about all data storage locations
   */
  getStorageLocations(): DataStorageInfo[] {
    return [
      {
        location: 'Browser Local Storage',
        description: 'Authentication tokens and configuration',
        dataTypes: [
          'GitHub Personal Access Token',
          'Gist ID',
          'Encryption settings',
        ],
      },
      {
        location: 'Browser IndexedDB',
        description: 'Local cache for fast data access',
        dataTypes: [
          'Products catalog',
          'Suppliers',
          'Stock movements',
          'Purchases',
          'Application settings',
        ],
      },
      {
        location: 'GitHub Gist (Remote)',
        description: 'Persistent data storage in your GitHub account',
        dataTypes: [
          'products.json',
          'suppliers.json',
          'movements_YYYY_MM.json',
          'purchases_YYYY_MM.json',
          'settings.json',
          'meta.json',
        ],
      },
    ];
  }

  /**
   * Clear all local data (localStorage + IndexedDB)
   * This is the same as logout but more explicit for privacy purposes
   */
  async clearAllLocalData(): Promise<DataClearingResult> {
    const result: DataClearingResult = {
      success: true,
      clearedLocations: [],
      errors: [],
    };

    try {
      // Clear authentication data and cache
      await authService.logout();
      result.clearedLocations.push('Local Storage (tokens and config)');
      result.clearedLocations.push('IndexedDB (cached data)');
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Failed to clear local data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Clear only the cache (IndexedDB) but keep authentication
   */
  async clearCacheOnly(): Promise<DataClearingResult> {
    const result: DataClearingResult = {
      success: true,
      clearedLocations: [],
      errors: [],
    };

    try {
      await cacheService.clearAll();
      result.clearedLocations.push('IndexedDB (cached data)');
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Get estimated storage usage (if available)
   */
  async getStorageEstimate(): Promise<{
    usage?: number;
    quota?: number;
    usagePercentage?: number;
  }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

        return {
          usage,
          quota,
          usagePercentage,
        };
      }
    } catch (error) {
      // Storage API not available or failed
    }

    return {};
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if any data is currently stored
   */
  hasStoredData(): boolean {
    // Check if we have authentication data
    const hasAuth = authService.isAuthenticated();

    // Check if localStorage has any of our keys
    const hasLocalStorage =
      localStorage.getItem('dona_lina_token') !== null ||
      localStorage.getItem('dona_lina_encrypted_token') !== null ||
      localStorage.getItem('dona_lina_gist_id') !== null;

    return hasAuth || hasLocalStorage;
  }

  /**
   * Verify that no PII is stored in the data models
   * This is a compile-time check enforced by TypeScript types
   * and a runtime validation for extra safety
   */
  validateNoPII(data: unknown): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // List of field names that might indicate PII
    const piiFieldNames = [
      'email',
      'phone',
      'address',
      'ssn',
      'passport',
      'license',
      'birthdate',
      'age',
      'gender',
      'race',
      'religion',
      'customerName',
      'clientName',
      'personalId',
    ];

    // Recursively check object for PII field names
    const checkObject = (obj: any, path: string = ''): void => {
      if (obj === null || obj === undefined) return;

      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          const lowerKey = key.toLowerCase();
          
          // Check if key name suggests PII
          if (piiFieldNames.some((piiField) => lowerKey.includes(piiField))) {
            issues.push(`Potential PII field detected: ${path}${key}`);
          }

          // Recursively check nested objects
          if (typeof obj[key] === 'object') {
            checkObject(obj[key], `${path}${key}.`);
          }
        }
      }
    };

    try {
      checkObject(data);
    } catch (error) {
      issues.push('Error during PII validation');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const dataClearingService = new DataClearingService();
