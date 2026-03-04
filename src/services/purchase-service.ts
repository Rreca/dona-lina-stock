/**
 * Purchase service with immutable events
 * Handles purchase creation and history queries with monthly partitioning
 */

import type {
  Purchase,
  PurchaseItem,
  UUID,
  ISODateString,
  PurchasesFile,
} from "../models/types";

// ============================================================================
// Types
// ============================================================================

export interface CreatePurchaseInput {
  date: ISODateString;
  supplierId: UUID;
  items: PurchaseItem[];
  note?: string;
}

export interface PurchaseHistoryEntry {
  purchase: Purchase;
  item: PurchaseItem;
}

// ============================================================================
// Purchase Service
// ============================================================================

export class PurchaseService {
  /**
   * Create a new purchase with validation
   * Purchases are immutable events - once created, they cannot be modified
   */
  createPurchase(input: CreatePurchaseInput): Purchase {
    // Validate input
    if (!input.supplierId) {
      throw new Error("Supplier ID is required");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Purchase must have at least one item");
    }

    // Validate each item
    for (const item of input.items) {
      if (!item.productId) {
        throw new Error("Product ID is required for all items");
      }
      if (item.qty <= 0) {
        throw new Error("Quantity must be positive");
      }
      if (item.unitCostCents < 0) {
        throw new Error("Unit cost cannot be negative");
      }
    }

    const purchase: Purchase = {
      id: crypto.randomUUID(),
      date: input.date,
      supplierId: input.supplierId,
      items: input.items,
      note: input.note,
      createdAt: new Date().toISOString(),
    };

    return purchase;
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
   * Get filename for monthly purchases partition
   * Format: "purchases_YYYY_MM.json"
   */
  getPurchasesFileName(date: Date | ISODateString): string {
    const partitionKey = this.getMonthlyPartitionKey(date);
    return `purchases_${partitionKey}.json`;
  }

  /**
   * Parse purchases file content
   */
  parsePurchasesFile(content: string): PurchasesFile {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.purchases || !Array.isArray(parsed.purchases)) {
        return { purchases: [] };
      }
      return parsed as PurchasesFile;
    } catch {
      return { purchases: [] };
    }
  }

  /**
   * Serialize purchases to file content
   */
  serializePurchasesFile(purchases: Purchase[]): string {
    const file: PurchasesFile = { purchases };
    return JSON.stringify(file, null, 2);
  }

  /**
   * Group purchases by monthly partition
   */
  groupPurchasesByMonth(purchases: Purchase[]): Map<string, Purchase[]> {
    const grouped = new Map<string, Purchase[]>();

    for (const purchase of purchases) {
      const key = this.getMonthlyPartitionKey(purchase.date);
      const existing = grouped.get(key) || [];
      existing.push(purchase);
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
  // Purchase History Queries
  // ============================================================================

  /**
   * Get purchase history for a specific product
   * Returns all purchases containing the product, sorted by date (newest first)
   */
  getPurchaseHistoryByProduct(
    productId: UUID,
    purchases: Purchase[]
  ): PurchaseHistoryEntry[] {
    const history: PurchaseHistoryEntry[] = [];

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        if (item.productId === productId) {
          history.push({ purchase, item });
        }
      }
    }

    // Sort by date descending (newest first)
    history.sort(
      (a, b) =>
        new Date(b.purchase.date).getTime() -
        new Date(a.purchase.date).getTime()
    );

    return history;
  }

  /**
   * Get purchase history for a specific supplier
   * Returns all purchases from the supplier, sorted by date (newest first)
   */
  getPurchaseHistoryBySupplier(
    supplierId: UUID,
    purchases: Purchase[]
  ): Purchase[] {
    const history = purchases.filter((p) => p.supplierId === supplierId);

    // Sort by date descending (newest first)
    history.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return history;
  }

  /**
   * Get purchase history for a product from a specific supplier
   * Returns all purchases of the product from that supplier
   */
  getPurchaseHistoryByProductAndSupplier(
    productId: UUID,
    supplierId: UUID,
    purchases: Purchase[]
  ): PurchaseHistoryEntry[] {
    const history: PurchaseHistoryEntry[] = [];

    for (const purchase of purchases) {
      if (purchase.supplierId !== supplierId) {
        continue;
      }

      for (const item of purchase.items) {
        if (item.productId === productId) {
          history.push({ purchase, item });
        }
      }
    }

    // Sort by date descending (newest first)
    history.sort(
      (a, b) =>
        new Date(b.purchase.date).getTime() -
        new Date(a.purchase.date).getTime()
    );

    return history;
  }

  /**
   * Get all purchases within a date range
   * Returns purchases sorted by date (newest first)
   */
  getPurchasesByDateRange(
    startDate: Date,
    endDate: Date,
    purchases: Purchase[]
  ): Purchase[] {
    const filtered = purchases.filter((p) => {
      const purchaseDate = new Date(p.date);
      return purchaseDate >= startDate && purchaseDate <= endDate;
    });

    // Sort by date descending (newest first)
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return filtered;
  }

  /**
   * Calculate total cost for a purchase
   */
  calculatePurchaseTotal(purchase: Purchase): number {
    return purchase.items.reduce(
      (total, item) => total + item.qty * item.unitCostCents,
      0
    );
  }

  /**
   * Get the most recent purchase item for a product
   * Returns null if no purchase history exists
   */
  getMostRecentPurchaseItem(
    productId: UUID,
    purchases: Purchase[]
  ): PurchaseHistoryEntry | null {
    const history = this.getPurchaseHistoryByProduct(productId, purchases);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Check if a product has any purchase history
   */
  hasPurchaseHistory(productId: UUID, purchases: Purchase[]): boolean {
    return purchases.some((p) =>
      p.items.some((item) => item.productId === productId)
    );
  }

  // ============================================================================
  // Cost Calculation - Last Cost Method
  // ============================================================================

  /**
   * Calculate last cost for a product
   * Returns the unit cost from the most recent purchase
   * Returns null if no purchase history exists
   */
  calculateLastCost(
    productId: UUID,
    purchases: Purchase[]
  ): { cost: number; supplierId: UUID; date: ISODateString } | null {
    const mostRecent = this.getMostRecentPurchaseItem(productId, purchases);

    if (!mostRecent) {
      return null;
    }

    return {
      cost: mostRecent.item.unitCostCents,
      supplierId: mostRecent.purchase.supplierId,
      date: mostRecent.purchase.date,
    };
  }

  // ============================================================================
  // Cost Calculation - Weighted Average Method
  // ============================================================================

  /**
   * Calculate weighted average cost for a product
   * Uses configurable window: last N purchases or last X days
   * Returns null if no purchase history exists
   */
  calculateWeightedAverageCost(
    productId: UUID,
    purchases: Purchase[],
    window: { type: "last_n_purchases" | "last_days"; value: number }
  ): { cost: number; purchaseCount: number; totalQty: number } | null {
    const history = this.getPurchaseHistoryByProduct(productId, purchases);

    if (history.length === 0) {
      return null;
    }

    // Filter history based on window type
    let filteredHistory: typeof history;

    if (window.type === "last_n_purchases") {
      // Take last N purchases
      filteredHistory = history.slice(0, window.value);
    } else {
      // last_days: filter by date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - window.value);

      filteredHistory = history.filter(
        (entry) => new Date(entry.purchase.date) >= cutoffDate
      );
    }

    // Handle edge case: no purchases in window
    if (filteredHistory.length === 0) {
      return null;
    }

    // Calculate weighted average: Σ(qty * cost) / Σ(qty)
    let totalCost = 0;
    let totalQty = 0;

    for (const entry of filteredHistory) {
      totalCost += entry.item.qty * entry.item.unitCostCents;
      totalQty += entry.item.qty;
    }

    // Handle edge case: zero total quantity
    if (totalQty === 0) {
      return null;
    }

    const weightedAvg = Math.round(totalCost / totalQty);

    return {
      cost: weightedAvg,
      purchaseCount: filteredHistory.length,
      totalQty,
    };
  }
}

// ============================================================================
// Cost Cache
// ============================================================================

/**
 * Simple in-memory cache for calculated costs
 * Improves performance by avoiding recalculation
 */
export class CostCache {
  private cache: Map<string, { cost: number; timestamp: number }> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 60000) {
    // Default 1 minute TTL
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached cost for a product
   * Returns null if not cached or expired
   */
  get(productId: UUID, method: string): number | null {
    const key = `${productId}:${method}`;
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.cost;
  }

  /**
   * Set cached cost for a product
   */
  set(productId: UUID, method: string, cost: number): void {
    const key = `${productId}:${method}`;
    this.cache.set(key, {
      cost,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a specific product
   */
  clearProduct(productId: UUID): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${productId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Export singleton instances
export const purchaseService = new PurchaseService();
export const costCache = new CostCache();
