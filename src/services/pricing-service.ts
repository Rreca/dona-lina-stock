/**
 * Pricing service for sale price, margin calculation, and price suggestions
 * Handles pricing logic with configurable rules
 */

import type {
  Product,
  UUID,
  Cents,
  Settings,
  Purchase,
} from "../models/types";
import { isLXLProduct } from "../models/types";
import { costService } from "./cost-service";

// ============================================================================
// Types
// ============================================================================

/**
 * Margin calculation result
 */
export interface MarginResult {
  marginCents: number;
  marginPct: number;
  salePriceCents: number;
  costCents: number;
}

/**
 * Dual margin result for LXL products
 */
export interface DualMarginResult {
  perLiter: MarginResult;
  perJug: MarginResult | null;
  perBottle: MarginResult | null;
}

/**
 * Price suggestion result
 */
export interface PriceSuggestion {
  suggestedPriceCents: Cents;
  costCents: Cents;
  markupPct: number;
  projectedMarginCents: number;
  projectedMarginPct: number;
  meetsMinMargin: boolean;
}

// ============================================================================
// Pricing Service
// ============================================================================

export class PricingService {
  /**
   * Calculate margin for a product
   * Returns null if sale price is not set or cost data is unavailable
   * 
   * For LXL products:
   * - Sale price is stored per liter but margin is calculated per jug
   * - Cost is already calculated as effective cost per jug
   * - Sale price is multiplied by pack size to get price per jug
   */
  calculateMargin(
    product: Product,
    purchases: Purchase[],
    allProducts: Product[],
    settings: Settings
  ): MarginResult | null {
    // Check if sale price is set
    if (
      product.salePriceCents === undefined ||
      product.salePriceCents === null
    ) {
      return null;
    }

    // Get current cost (use effective cost for LXL products)
    const isLXL = isLXLProduct(product);
    const costDetails = isLXL
      ? costService.calculateEffectiveCost(product, purchases, allProducts, settings)
      : costService.calculateCurrentCost(product.id, purchases, settings);

    if (!costDetails) {
      return null;
    }

    // For LXL products: convert price per liter to price per jug
    let salePriceCents = product.salePriceCents;
    if (isLXL) {
      const packSize = product.packSizeLiters ?? 5;
      salePriceCents = product.salePriceCents * packSize;
    }

    const costCents = costDetails.cost;

    // Calculate margin
    const marginCents = salePriceCents - costCents;

    // Calculate margin percentage
    // Handle edge case: zero sale price
    const marginPct = salePriceCents === 0 ? 0 : (marginCents / salePriceCents) * 100;

    return {
      marginCents,
      marginPct,
      salePriceCents,
      costCents,
    };
  }

  /**
   * Calculate dual margins for LXL products (per liter, per jug, and per bottle)
   * Returns null if sale price is not set or cost data is unavailable
   * 
   * For LXL products:
   * - Per liter margin: uses salePriceCents vs liquid cost per liter
   * - Per jug margin: uses jugSalePriceCents vs effective cost per jug
   * - Per bottle margin: uses bottleSalePriceCents vs effective cost per bottle (1L)
   */
  calculateDualMargin(
    product: Product,
    purchases: Purchase[],
    allProducts: Product[],
    settings: Settings
  ): DualMarginResult | null {
    // Check if sale price is set
    if (
      product.salePriceCents === undefined ||
      product.salePriceCents === null
    ) {
      return null;
    }

    const isLXL = isLXLProduct(product);
    
    if (!isLXL) {
      // For non-LXL products, return single margin as perLiter
      const margin = this.calculateMargin(product, purchases, allProducts, settings);
      if (!margin) return null;
      return {
        perLiter: margin,
        perJug: null,
        perBottle: null,
      };
    }

    // Get cost details for LXL product
    const costDetails = costService.calculateEffectiveCost(product, purchases, allProducts, settings);
    if (!costDetails || !costDetails.lxlDetails) {
      return null;
    }

    // Calculate margin per liter
    const liquidCostPerLiter = costDetails.lxlDetails.liquidCostPerLiter;
    const salePricePerLiter = product.salePriceCents;
    const marginPerLiter = salePricePerLiter - liquidCostPerLiter;
    const marginPctPerLiter = salePricePerLiter === 0 ? 0 : (marginPerLiter / salePricePerLiter) * 100;

    const perLiter: MarginResult = {
      marginCents: marginPerLiter,
      marginPct: marginPctPerLiter,
      salePriceCents: salePricePerLiter,
      costCents: liquidCostPerLiter,
    };

    // Calculate margin per jug (if jugSalePriceCents is defined)
    let perJug: MarginResult | null = null;
    if (product.jugSalePriceCents !== undefined && product.jugSalePriceCents !== null) {
      const effectiveCostPerJug = costDetails.cost;
      const salePricePerJug = product.jugSalePriceCents;
      const marginPerJug = salePricePerJug - effectiveCostPerJug;
      const marginPctPerJug = salePricePerJug === 0 ? 0 : (marginPerJug / salePricePerJug) * 100;

      perJug = {
        marginCents: marginPerJug,
        marginPct: marginPctPerJug,
        salePriceCents: salePricePerJug,
        costCents: effectiveCostPerJug,
      };
    }

    // Calculate margin per bottle (if bottleSalePriceCents is defined)
    let perBottle: MarginResult | null = null;
    if (product.bottleSalePriceCents !== undefined && product.bottleSalePriceCents !== null) {
      const effectiveCostPerBottle = costDetails.lxlDetails.effectiveCostPerBottle;
      const salePricePerBottle = product.bottleSalePriceCents;
      const marginPerBottle = salePricePerBottle - effectiveCostPerBottle;
      const marginPctPerBottle = salePricePerBottle === 0 ? 0 : (marginPerBottle / salePricePerBottle) * 100;

      perBottle = {
        marginCents: marginPerBottle,
        marginPct: marginPctPerBottle,
        salePriceCents: salePricePerBottle,
        costCents: effectiveCostPerBottle,
      };
    }

    return {
      perLiter,
      perJug,
      perBottle,
    };
  }

  /**
   * Calculate margins for multiple products
   * Returns map of productId -> MarginResult
   */
  calculateMargins(
    products: Product[],
    purchases: Purchase[],
    settings: Settings
  ): Map<UUID, MarginResult | null> {
    const results = new Map<UUID, MarginResult | null>();

    for (const product of products) {
      const margin = this.calculateMargin(product, purchases, products, settings);
      results.set(product.id, margin);
    }

    return results;
  }

  /**
   * Suggest a sale price based on cost and price rule
   * Returns null if cost data is unavailable
   * 
   * For LXL products:
   * - Cost is effective cost per jug
   * - Suggested price is calculated per jug then divided by pack size to get price per liter
   */
  suggestPrice(
    product: Product,
    purchases: Purchase[],
    allProducts: Product[],
    settings: Settings
  ): PriceSuggestion | null {
    // Get current cost (use effective cost for LXL products)
    const isLXL = isLXLProduct(product);
    const costDetails = isLXL
      ? costService.calculateEffectiveCost(product, purchases, allProducts, settings)
      : costService.calculateCurrentCost(product.id, purchases, settings);

    if (!costDetails) {
      return null;
    }

    const costCents = costDetails.cost;
    const priceRule = settings.priceRule;

    // Calculate suggested price with markup (per jug for LXL products)
    const rawSuggestedPrice = costCents * (1 + priceRule.markupPct / 100);

    // Apply rounding
    let suggestedPriceCents = this.roundToMultiple(
      rawSuggestedPrice,
      priceRule.roundToCents
    );

    // For LXL products: convert price per jug to price per liter
    if (isLXL) {
      const packSize = product.packSizeLiters ?? 5;
      suggestedPriceCents = Math.round(suggestedPriceCents / packSize);
    }

    // Calculate projected margin (using jug price for LXL)
    const salePricePerJug = isLXL 
      ? suggestedPriceCents * (product.packSizeLiters ?? 5)
      : suggestedPriceCents;
    
    const projectedMarginCents = salePricePerJug - costCents;
    const projectedMarginPct =
      salePricePerJug === 0
        ? 0
        : (projectedMarginCents / salePricePerJug) * 100;

    // Check if meets minimum margin requirement
    const meetsMinMargin =
      priceRule.minMarginPct === undefined ||
      projectedMarginPct >= priceRule.minMarginPct;

    return {
      suggestedPriceCents,
      costCents,
      markupPct: priceRule.markupPct,
      projectedMarginCents,
      projectedMarginPct,
      meetsMinMargin,
    };
  }

  /**
   * Round a value to the nearest multiple
   * Example: roundToMultiple(1547, 50) = 1550
   */
  private roundToMultiple(value: number, multiple: number): number {
    if (multiple <= 0) {
      return Math.round(value);
    }
    return Math.round(value / multiple) * multiple;
  }

  /**
   * Validate if a price meets minimum margin requirement
   */
  validateMinMargin(
    salePriceCents: Cents,
    costCents: Cents,
    minMarginPct?: number
  ): boolean {
    if (minMarginPct === undefined) {
      return true;
    }

    if (salePriceCents === 0) {
      return false;
    }

    const marginCents = salePriceCents - costCents;
    const marginPct = (marginCents / salePriceCents) * 100;

    return marginPct >= minMarginPct;
  }

  /**
   * Format margin for display
   */
  formatMargin(margin: MarginResult): string {
    const marginFormatted = (margin.marginCents / 100).toFixed(2);
    const marginPctFormatted = margin.marginPct.toFixed(1);
    return `$${marginFormatted} (${marginPctFormatted}%)`;
  }

  /**
   * Format price for display
   */
  formatPrice(priceCents: Cents): string {
    return `$${(priceCents / 100).toFixed(2)}`;
  }

  /**
   * Get margin summary for display
   * Returns formatted string with margin details
   */
  getMarginSummary(
    product: Product,
    purchases: Purchase[],
    allProducts: Product[],
    settings: Settings
  ): string {
    const margin = this.calculateMargin(product, purchases, allProducts, settings);

    if (!margin) {
      if (
        product.salePriceCents === undefined ||
        product.salePriceCents === null
      ) {
        return "Precio de venta no definido";
      }
      return "Sin datos de costo";
    }

    return this.formatMargin(margin);
  }

  /**
   * Check if a product has pricing data (both sale price and cost)
   */
  hasPricingData(
    product: Product,
    purchases: Purchase[],
    _settings: Settings
  ): boolean {
    if (
      product.salePriceCents === undefined ||
      product.salePriceCents === null
    ) {
      return false;
    }

    return costService.hasCostData(product.id, purchases);
  }

  /**
   * Get products with low margins (below threshold)
   */
  getProductsWithLowMargins(
    products: Product[],
    purchases: Purchase[],
    settings: Settings,
    thresholdPct: number
  ): Array<{ product: Product; margin: MarginResult }> {
    const lowMarginProducts: Array<{ product: Product; margin: MarginResult }> =
      [];

    for (const product of products) {
      const margin = this.calculateMargin(product, purchases, products, settings);
      if (margin && margin.marginPct < thresholdPct) {
        lowMarginProducts.push({ product, margin });
      }
    }

    return lowMarginProducts;
  }

  /**
   * Get products with negative margins (selling below cost)
   */
  getProductsWithNegativeMargins(
    products: Product[],
    purchases: Purchase[],
    settings: Settings
  ): Array<{ product: Product; margin: MarginResult }> {
    return this.getProductsWithLowMargins(products, purchases, settings, 0);
  }
}

// Export singleton instance
export const pricingService = new PricingService();
