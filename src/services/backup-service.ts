/**
 * Backup and export service
 * Provides full data export functionality for backup purposes
 */

import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
} from "../models/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Complete backup data structure
 * Contains all entities from the application
 */
export interface BackupData {
  version: string;
  exportedAt: string;
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  purchases: Purchase[];
  settings: Settings;
  meta: MetaFile;
}

/**
 * Backup export options
 */
export interface BackupOptions {
  /** Include inactive products (default: true) */
  includeInactive?: boolean;
  /** Pretty print JSON (default: true) */
  prettyPrint?: boolean;
}

// ============================================================================
// Backup Service
// ============================================================================

/**
 * Service for creating and exporting backups
 */
export class BackupService {
  private static readonly BACKUP_VERSION = "1.0.0";

  /**
   * Create a complete backup of all data
   */
  static createBackup(
    products: Product[],
    suppliers: Supplier[],
    movements: StockMovement[],
    purchases: Purchase[],
    settings: Settings,
    meta: MetaFile,
    options: BackupOptions = {}
  ): BackupData {
    const { includeInactive = true } = options;

    // Filter products if needed
    const filteredProducts = includeInactive
      ? products
      : products.filter((p) => p.active);

    return {
      version: this.BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      products: filteredProducts,
      suppliers,
      movements,
      purchases,
      settings,
      meta,
    };
  }

  /**
   * Export backup as JSON string
   */
  static exportAsJSON(backup: BackupData, prettyPrint = true): string {
    return prettyPrint
      ? JSON.stringify(backup, null, 2)
      : JSON.stringify(backup);
  }

  /**
   * Trigger browser download of backup file
   */
  static downloadBackup(backup: BackupData, options: BackupOptions = {}): void {
    const { prettyPrint = true } = options;
    const json = this.exportAsJSON(backup, prettyPrint);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `dona-lina-backup-${timestamp}.json`;

    // Create temporary link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validate backup data structure
   */
  static validateBackup(data: unknown): data is BackupData {
    if (!data || typeof data !== "object") {
      return false;
    }

    const backup = data as Partial<BackupData>;

    return (
      typeof backup.version === "string" &&
      typeof backup.exportedAt === "string" &&
      Array.isArray(backup.products) &&
      Array.isArray(backup.suppliers) &&
      Array.isArray(backup.movements) &&
      Array.isArray(backup.purchases) &&
      typeof backup.settings === "object" &&
      typeof backup.meta === "object"
    );
  }

  /**
   * Parse and validate backup from JSON string
   */
  static parseBackup(json: string): BackupData {
    try {
      const data = JSON.parse(json);
      if (!this.validateBackup(data)) {
        throw new Error("Invalid backup data structure");
      }
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid JSON format");
      }
      throw error;
    }
  }

  /**
   * Get backup file size in bytes
   */
  static getBackupSize(backup: BackupData, prettyPrint = true): number {
    const json = this.exportAsJSON(backup, prettyPrint);
    return new Blob([json]).size;
  }

  /**
   * Get human-readable backup size
   */
  static getBackupSizeFormatted(backup: BackupData, prettyPrint = true): string {
    const bytes = this.getBackupSize(backup, prettyPrint);
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }
}
