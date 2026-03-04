/**
 * Cost service with method selection
 * Provides unified interface for cost calculation with configurable methods
 */

import type {
  Purchase,
  UUID,
  ISODateString,
  Settings,
  CostMethod,
  WeightedAvgWindow,
  Product,
} from "../models/types";
import { isLXLProduct, getPackSize } from "../models/types";
import { purchaseService, costCache } from "./purchase-service";

// ============================================================================
// Types
// ============================================================================

/**
 * Cost details with metadata
 */
export interface CostDetails {
  cost: number;
  method: CostMethod;
  lastCost?: {
    supplierId: UUID;
    date: ISODateString;
  };
  weightedAvg?: {
    purchaseCount: number;
    totalQty: number;
    window: WeightedAvgWindow;
  };
  // 5L jug support - LXL product cost breakdown
  lxlDetails?: {
    liquidCostPerLiter: number;
    packSizeLiters: number;
    liquidCostForPack: number;
    jugCost: number;
    bottleCost: number;
    effectiveCostPerBottle: number;
  };
}

/**
 * Cost calculation result
 */
export interface CostResult {
  productId: UUID;
  currentCost: number | null;
  details: CostDetails | null;
}

// ============================================================================
// Cost Service
// ============================================================================

export class CostService {
  /**
   * Calculate current cost for a product using configured method
   * Returns null if no purchase history exists
   */
  calculateCurrentCost(
    productId: UUID,
    purchases: Purchase[],
    settings: Settings,
    useCache: boolean = true
  ): CostDetails | null {
    // Check cache first
    if (useCache) {
      const cached = costCache.get(productId, settings.costMethod);
      if (cached !== null) {
        // Return cached cost with minimal details
        return {
          cost: cached,
          method: settings.costMethod,
        };
      }
    }

    // Calculate based on method
    let result: CostDetails | null = null;

    if (settings.costMethod === "last") {
      const lastCost = purchaseService.calculateLastCost(productId, purchases);
      if (lastCost) {
        result = {
          cost: lastCost.cost,
          method: "last",
          lastCost: {
            supplierId: lastCost.supplierId,
            date: lastCost.date,
          },
        };
      }
    } else {
      // weighted_avg
      const weightedAvg = purchaseService.calculateWeightedAverageCost(
        productId,
        purchases,
        settings.weightedAvgWindow
      );
      if (weightedAvg) {
        result = {
          cost: weightedAvg.cost,
          method: "weighted_avg",
          weightedAvg: {
            purchaseCount: weightedAvg.purchaseCount,
            totalQty: weightedAvg.totalQty,
            window: settings.weightedAvgWindow,
          },
        };
      }
    }

    // Cache the result
    if (result && useCache) {
      costCache.set(productId, settings.costMethod, result.cost);
    }

    return result;
  }

  /**
   * Calculate current costs for multiple products
   * Returns map of productId -> CostDetails
   */
  calculateCurrentCosts(
    productIds: UUID[],
    purchases: Purchase[],
    settings: Settings,
    useCache: boolean = true
  ): Map<UUID, CostDetails | null> {
    const results = new Map<UUID, CostDetails | null>();

    for (const productId of productIds) {
      const cost = this.calculateCurrentCost(
        productId,
        purchases,
        settings,
        useCache
      );
      results.set(productId, cost);
    }

    return results;
  }

  /**
   * Get cost details with full metadata
   * Always recalculates (bypasses cache) to get complete details
   */
  getCostDetails(
    productId: UUID,
    purchases: Purchase[],
    settings: Settings
  ): CostDetails | null {
    return this.calculateCurrentCost(productId, purchases, settings, false);
  }

  /**
   * Invalidate cache for a product
   * Call this when purchases are added/modified
   */
  invalidateCache(productId: UUID): void {
    costCache.clearProduct(productId);
  }

  /**
   * Invalidate cache for a product and all LXL products that reference it as a container
   * Call this when purchases for a container product are added/modified
   */
  invalidateCacheWithCascade(
    productId: UUID,
    allProducts: Product[]
  ): void {
    // Invalidate the product itself
    this.invalidateCache(productId);

    // Find the container product's SKU
    const containerProduct = allProducts.find((p) => p.id === productId);
    if (!containerProduct || !containerProduct.sku) {
      return;
    }

    // Find all LXL products that reference this container
    const dependentProducts = allProducts.filter(
      (p) => isLXLProduct(p) && p.containerSku === containerProduct.sku
    );

    // Invalidate cache for all dependent products
    for (const product of dependentProducts) {
      this.invalidateCache(product.id);
    }
  }

  /**
   * Invalidate cache for all products
   * Call this when settings change
   */
  invalidateAllCache(): void {
    costCache.clearAll();
  }

  /**
   * Get cost or return default value
   */
  getCurrentCostOrDefault(
    productId: UUID,
    purchases: Purchase[],
    settings: Settings,
    defaultCost: number = 0
  ): number {
    const details = this.calculateCurrentCost(productId, purchases, settings);
    return details?.cost ?? defaultCost;
  }

  /**
   * Check if a product has cost data available
   */
  hasCostData(productId: UUID, purchases: Purchase[]): boolean {
    return purchaseService.hasPurchaseHistory(productId, purchases);
  }

  /**
   * Get cost summary for display
   * Returns formatted string with cost and method
   */
  getCostSummary(
    productId: UUID,
    purchases: Purchase[],
    settings: Settings
  ): string {
    const details = this.calculateCurrentCost(productId, purchases, settings);

    if (!details) {
      return "Sin historial de compras";
    }

    const costFormatted = (details.cost / 100).toFixed(2);

    if (details.method === "last" && details.lastCost) {
      const date = new Date(details.lastCost.date).toLocaleDateString();
      return `$${costFormatted} (Último costo - ${date})`;
    } else if (details.method === "weighted_avg" && details.weightedAvg) {
      const { purchaseCount, window } = details.weightedAvg;
      const windowDesc =
        window.type === "last_n_purchases"
          ? `últimas ${window.value} compras`
          : `últimos ${window.value} días`;
      return `$${costFormatted} (Promedio ponderado - ${purchaseCount} compras, ${windowDesc})`;
    }

    return `$${costFormatted}`;
  }

  /**
   * Compare costs between different methods
   * Useful for analysis and decision making
   */
  compareCostMethods(
    productId: UUID,
    purchases: Purchase[],
    weightedAvgWindow: WeightedAvgWindow
  ): {
    lastCost: number | null;
    weightedAvg: number | null;
    difference: number | null;
    percentDifference: number | null;
  } {
    const lastCostResult = purchaseService.calculateLastCost(
      productId,
      purchases
    );
    const weightedAvgResult = purchaseService.calculateWeightedAverageCost(
      productId,
      purchases,
      weightedAvgWindow
    );

    const lastCost = lastCostResult?.cost ?? null;
    const weightedAvg = weightedAvgResult?.cost ?? null;

    let difference: number | null = null;
    let percentDifference: number | null = null;

    if (lastCost !== null && weightedAvg !== null) {
      difference = weightedAvg - lastCost;
      percentDifference = (difference / lastCost) * 100;
    }

    return {
      lastCost,
      weightedAvg,
      difference,
      percentDifference,
    };
  }

  /**
   * Calculate effective cost for LXL products (5L jug products)
   * Effective cost = (liquid cost per liter * pack size) + jug cost
   * Returns null if no purchase history exists for the liquid product
   */
  calculateEffectiveCost(
    product: Product,
    purchases: Purchase[],
    allProducts: Product[],
    settings: Settings
  ): CostDetails | null {
    // Get base liquid cost per liter
    const liquidCostDetails = this.calculateCurrentCost(
      product.id,
      purchases,
      settings
    );

    if (!liquidCostDetails) {
      return null;
    }

    const packSize = getPackSize(product);
    const liquidCostForPack = liquidCostDetails.cost * packSize;

    // Use fixed container SKU "BP-1" for all LXL products
    const containerSku = "BP-1";
    
    // Get jug cost from BP-1 product
    let jugCost = 0;
    const containerProduct = allProducts.find((p) => p.sku === containerSku);
    if (containerProduct) {
      const containerCostDetails = this.calculateCurrentCost(
        containerProduct.id,
        purchases,
        settings
      );
      jugCost = containerCostDetails?.cost ?? 0;
    } else {
      console.warn(
        `Container product with SKU "${containerSku}" not found. Please create a product with SKU "BP-1" for jug costs.`
      );
    }

    // Use fixed bottle SKU "BP-3" for all LXL products
    const bottleSku = "BP-3";

    // Get bottle cost from BP-3 product
    let bottleCost = 0;
    const bottleProduct = allProducts.find((p) => p.sku === bottleSku);
    if (bottleProduct) {
      const bottleCostDetails = this.calculateCurrentCost(
        bottleProduct.id,
        purchases,
        settings
      );
      bottleCost = bottleCostDetails?.cost ?? 0;
    } else {
      console.warn(
        `Bottle product with SKU "${bottleSku}" not found. Please create a product with SKU "BP-3" for bottle costs.`
      );
    }

    const effectiveCost = liquidCostForPack + jugCost;
    const effectiveCostPerBottle = liquidCostDetails.cost + bottleCost;

    return {
      cost: effectiveCost,
      method: liquidCostDetails.method,
      lastCost: liquidCostDetails.lastCost,
      weightedAvg: liquidCostDetails.weightedAvg,
      lxlDetails: {
        liquidCostPerLiter: liquidCostDetails.cost,
        packSizeLiters: packSize,
        liquidCostForPack,
        jugCost,
        bottleCost,
        effectiveCostPerBottle,
      },
    };
  }
}

// Export singleton instance
export const costService = new CostService();
