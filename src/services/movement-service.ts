/**
 * Stock movement service with event sourcing
 * Handles creation of movements and stock calculation from movement history
 */

import type {
  StockMovement,
  MovementType,
  UUID,
  ISODateString,
  MovementsFile,
  StockSnapshot,
  MetaFile,
  Product,
} from "../models/types";
import { validateStockMovement } from "../models/validation";

// ============================================================================
// Types
// ============================================================================

export interface CreateMovementInput {
  date: ISODateString;
  productId: UUID;
  type: MovementType;
  qty: number;
  note?: string;
}

export interface StockLevel {
  productId: UUID;
  currentStock: number;
  lastUpdated: ISODateString;
}

export interface LowStockAlert {
  product: Product;
  currentStock: number;
  minStock: number;
  deficit: number;
}

// ============================================================================
// Movement Service
// ============================================================================

export class MovementService {
  /**
   * Create a new stock movement with validation
   */
  createMovement(input: CreateMovementInput): StockMovement {
    const movement: StockMovement = {
      id: crypto.randomUUID(),
      date: input.date,
      productId: input.productId,
      type: input.type,
      qty: input.qty,
      note: input.note,
      createdAt: new Date().toISOString(),
    };

    // Validate the movement
    const validation = validateStockMovement(movement);
    if (!validation.valid) {
      throw new Error(`Invalid movement: ${validation.errors.join(", ")}`);
    }

    return movement;
  }

  /**
   * Calculate current stock for a product from movement history
   * Stock = sum of all movements (in adds, out subtracts, adjust adds/subtracts)
   */
  calculateStock(productId: UUID, movements: StockMovement[]): number {
    let stock = 0;

    for (const movement of movements) {
      if (movement.productId !== productId) {
        continue;
      }

      switch (movement.type) {
        case "in":
          stock += movement.qty;
          break;
        case "out":
          stock -= movement.qty;
          break;
        case "adjust":
          stock += movement.qty; // adjust can be positive or negative
          break;
      }
    }

    return stock;
  }

  /**
   * Calculate stock levels for all products from movement history
   */
  calculateAllStock(movements: StockMovement[]): Map<UUID, number> {
    const stockByProduct = new Map<UUID, number>();

    for (const movement of movements) {
      const currentStock = stockByProduct.get(movement.productId) || 0;

      switch (movement.type) {
        case "in":
          stockByProduct.set(movement.productId, currentStock + movement.qty);
          break;
        case "out":
          stockByProduct.set(movement.productId, currentStock - movement.qty);
          break;
        case "adjust":
          stockByProduct.set(movement.productId, currentStock + movement.qty);
          break;
      }
    }

    return stockByProduct;
  }

  /**
   * Get monthly partition key for a date
   * Format: "YYYY-MM"
   */
  getMonthlyPartitionKey(date: Date | ISODateString): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Get filename for monthly movements partition
   * Format: "movements_YYYY_MM.json"
   */
  getMovementsFileName(date: Date | ISODateString): string {
    const partitionKey = this.getMonthlyPartitionKey(date);
    return `movements_${partitionKey}.json`;
  }

  /**
   * Parse movements file content
   */
  parseMovementsFile(content: string): MovementsFile {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.movements || !Array.isArray(parsed.movements)) {
        return { movements: [] };
      }
      return parsed as MovementsFile;
    } catch {
      return { movements: [] };
    }
  }

  /**
   * Serialize movements to file content
   */
  serializeMovementsFile(movements: StockMovement[]): string {
    const file: MovementsFile = { movements };
    return JSON.stringify(file, null, 2);
  }

  /**
   * Group movements by monthly partition
   */
  groupMovementsByMonth(
    movements: StockMovement[]
  ): Map<string, StockMovement[]> {
    const grouped = new Map<string, StockMovement[]>();

    for (const movement of movements) {
      const key = this.getMonthlyPartitionKey(movement.date);
      const existing = grouped.get(key) || [];
      existing.push(movement);
      grouped.set(key, existing);
    }

    return grouped;
  }

  /**
   * Get all partition keys between two dates (inclusive)
   */
  getPartitionKeysBetween(startDate: Date, endDate: Date): string[] {
    const keys: string[] = [];
    const current = new Date(startDate);
    current.setDate(1); // Start at beginning of month

    while (current <= endDate) {
      keys.push(this.getMonthlyPartitionKey(current));
      current.setMonth(current.getMonth() + 1);
    }

    return keys;
  }

  // ============================================================================
  // Stock Snapshot Optimization
  // ============================================================================

  /**
   * Create a stock snapshot for a specific month
   * Snapshots are stored in meta.json for fast stock calculation
   */
  createSnapshot(
    _monthKey: string,
    stockByProduct: Map<UUID, number>
  ): StockSnapshot {
    const snapshot: StockSnapshot = {
      stockByProduct: Object.fromEntries(stockByProduct),
      updatedAt: new Date().toISOString(),
    };
    return snapshot;
  }

  /**
   * Calculate stock incrementally from a snapshot
   * This is much faster than recalculating from all movements
   * 
   * @param snapshot - Base snapshot to start from
   * @param incrementalMovements - Movements that occurred after the snapshot
   */
  calculateStockFromSnapshot(
    snapshot: StockSnapshot,
    incrementalMovements: StockMovement[]
  ): Map<UUID, number> {
    // Start with snapshot values
    const stockByProduct = new Map<UUID, number>(
      Object.entries(snapshot.stockByProduct)
    );

    // Apply incremental movements
    for (const movement of incrementalMovements) {
      const currentStock = stockByProduct.get(movement.productId) || 0;

      switch (movement.type) {
        case "in":
          stockByProduct.set(movement.productId, currentStock + movement.qty);
          break;
        case "out":
          stockByProduct.set(movement.productId, currentStock - movement.qty);
          break;
        case "adjust":
          stockByProduct.set(movement.productId, currentStock + movement.qty);
          break;
      }
    }

    return stockByProduct;
  }

  /**
   * Get the most recent snapshot before or at a given date
   * Returns null if no snapshot exists
   */
  getMostRecentSnapshot(
    meta: MetaFile,
    beforeOrAtDate: Date
  ): { monthKey: string; snapshot: StockSnapshot } | null {
    const targetKey = this.getMonthlyPartitionKey(beforeOrAtDate);
    const availableKeys = Object.keys(meta.snapshots).sort().reverse();

    for (const key of availableKeys) {
      if (key <= targetKey) {
        return {
          monthKey: key,
          snapshot: meta.snapshots[key],
        };
      }
    }

    return null;
  }

  /**
   * Refresh snapshot for a specific month
   * Recalculates stock from all movements up to and including that month
   */
  refreshSnapshot(
    monthKey: string,
    allMovementsUpToMonth: StockMovement[]
  ): StockSnapshot {
    const stockByProduct = this.calculateAllStock(allMovementsUpToMonth);
    return this.createSnapshot(monthKey, stockByProduct);
  }

  /**
   * Update meta.json with a new snapshot
   */
  updateMetaWithSnapshot(
    meta: MetaFile,
    monthKey: string,
    snapshot: StockSnapshot
  ): MetaFile {
    return {
      ...meta,
      snapshots: {
        ...meta.snapshots,
        [monthKey]: snapshot,
      },
      lastSyncAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate current stock efficiently using snapshots
   * 
   * Strategy:
   * 1. Find most recent snapshot
   * 2. Load only movements after snapshot
   * 3. Apply incremental calculation
   */
  calculateStockWithSnapshots(
    productId: UUID,
    meta: MetaFile,
    getMovementsAfterMonth: (monthKey: string) => StockMovement[]
  ): number {
    const now = new Date();
    const recentSnapshot = this.getMostRecentSnapshot(meta, now);

    if (!recentSnapshot) {
      // No snapshot available, calculate from all movements
      const allMovements = getMovementsAfterMonth("0000-00");
      return this.calculateStock(productId, allMovements);
    }

    // Calculate incrementally from snapshot
    const incrementalMovements = getMovementsAfterMonth(
      recentSnapshot.monthKey
    );
    const currentStock = this.calculateStockFromSnapshot(
      recentSnapshot.snapshot,
      incrementalMovements
    );

    return currentStock.get(productId) || 0;
  }

  /**
   * Parse meta.json file
   */
  parseMetaFile(content: string): MetaFile {
    try {
      const parsed = JSON.parse(content);
      return {
        schemaVersion: parsed.schemaVersion || "1.0.0",
        lastSyncAt: parsed.lastSyncAt || new Date().toISOString(),
        snapshots: parsed.snapshots || {},
      };
    } catch {
      return {
        schemaVersion: "1.0.0",
        lastSyncAt: new Date().toISOString(),
        snapshots: {},
      };
    }
  }

  /**
   * Serialize meta.json file
   */
  serializeMetaFile(meta: MetaFile): string {
    return JSON.stringify(meta, null, 2);
  }

  // ============================================================================
  // Low Stock Alerts
  // ============================================================================

  /**
   * Check if a product is below minimum stock level
   */
  isLowStock(currentStock: number, minStock: number): boolean {
    return currentStock < minStock;
  }

  /**
   * Get low stock alert for a product
   * Returns null if stock is adequate
   */
  getLowStockAlert(
    product: Product,
    currentStock: number
  ): LowStockAlert | null {
    if (!this.isLowStock(currentStock, product.minStock)) {
      return null;
    }

    return {
      product,
      currentStock,
      minStock: product.minStock,
      deficit: product.minStock - currentStock,
    };
  }

  /**
   * Get all products with low stock
   * Returns array of low stock alerts
   */
  getLowStockProducts(
    products: Product[],
    stockByProduct: Map<UUID, number>
  ): LowStockAlert[] {
    const alerts: LowStockAlert[] = [];

    for (const product of products) {
      // Skip inactive products
      if (!product.active) {
        continue;
      }

      const currentStock = stockByProduct.get(product.id) || 0;
      const alert = this.getLowStockAlert(product, currentStock);

      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Filter products that are below minimum stock
   * Returns array of product IDs
   */
  filterBelowMinimum(
    products: Product[],
    stockByProduct: Map<UUID, number>
  ): UUID[] {
    return products
      .filter((p) => p.active)
      .filter((p) => {
        const currentStock = stockByProduct.get(p.id) || 0;
        return this.isLowStock(currentStock, p.minStock);
      })
      .map((p) => p.id);
  }

  /**
   * Get stock status summary for a product
   */
  getStockStatus(
    product: Product,
    currentStock: number
  ): "adequate" | "low" | "out" {
    if (currentStock <= 0) {
      return "out";
    }
    if (this.isLowStock(currentStock, product.minStock)) {
      return "low";
    }
    return "adequate";
  }
}

// Export singleton instance
export const movementService = new MovementService();
