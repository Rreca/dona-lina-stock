/**
 * Tests for pricing service
 */

import { describe, it, expect, beforeEach } from "vitest";
import { pricingService } from "./pricing-service";
import { costCache } from "./purchase-service";
import type { Product, Purchase, Settings } from "../models/types";

describe("PricingService", () => {
  let testProduct: Product;
  let testPurchases: Purchase[];
  let testSettings: Settings;

  beforeEach(() => {
    // Clear cost cache before each test
    costCache.clearAll();
    testProduct = {
      id: "product-1",
      name: "Test Product",
      category: "Test",
      unit: "unit",
      minStock: 10,
      salePriceCents: 2000, // $20.00
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    testPurchases = [
      {
        id: "purchase-1",
        date: "2024-01-15T00:00:00.000Z",
        supplierId: "supplier-1",
        items: [
          {
            productId: "product-1",
            qty: 10,
            unitCostCents: 1000, // $10.00
          },
        ],
        createdAt: "2024-01-15T00:00:00.000Z",
      },
    ];

    testSettings = {
      costMethod: "last",
      weightedAvgWindow: {
        type: "last_n_purchases",
        value: 3,
      },
      priceRule: {
        markupPct: 50,
        roundToCents: 10,
        minMarginPct: 20,
      },
    };
  });

  describe("calculateMargin", () => {
    it("should calculate margin correctly", () => {
      const margin = pricingService.calculateMargin(
        testProduct,
        testPurchases,
        [],
        testSettings
      );

      expect(margin).not.toBeNull();
      expect(margin!.salePriceCents).toBe(2000);
      expect(margin!.costCents).toBe(1000);
      expect(margin!.marginCents).toBe(1000); // $10.00
      expect(margin!.marginPct).toBe(50); // 50%
    });

    it("should return null if sale price is not set", () => {
      const productWithoutPrice = { ...testProduct, salePriceCents: undefined };

      const margin = pricingService.calculateMargin(
        productWithoutPrice,
        testPurchases,
        [],
        testSettings
      );

      expect(margin).toBeNull();
    });

    it("should return null if no cost data available", () => {
      const margin = pricingService.calculateMargin(
        testProduct,
        [], // No purchases
        [],
        testSettings
      );

      expect(margin).toBeNull();
    });

    it("should handle zero sale price", () => {
      const productWithZeroPrice = { ...testProduct, salePriceCents: 0 };

      const margin = pricingService.calculateMargin(
        productWithZeroPrice,
        testPurchases,
        [],
        testSettings
      );

      expect(margin).not.toBeNull();
      expect(margin!.marginCents).toBe(-1000); // Negative margin
      expect(margin!.marginPct).toBe(0); // 0% when sale price is 0
    });

    it("should calculate negative margin when selling below cost", () => {
      const productBelowCost = { ...testProduct, salePriceCents: 800 }; // $8.00

      const margin = pricingService.calculateMargin(
        productBelowCost,
        testPurchases,
        [],
        testSettings
      );

      expect(margin).not.toBeNull();
      expect(margin!.marginCents).toBe(-200); // -$2.00
      expect(margin!.marginPct).toBe(-25); // -25%
    });

    it("should use weighted average cost when configured", () => {
      const settingsWithWeightedAvg = {
        ...testSettings,
        costMethod: "weighted_avg" as const,
      };

      const purchasesWithMultiple: Purchase[] = [
        {
          id: "purchase-1",
          date: "2024-01-10T00:00:00.000Z",
          supplierId: "supplier-1",
          items: [
            {
              productId: "product-1",
              qty: 10,
              unitCostCents: 1000,
            },
          ],
          createdAt: "2024-01-10T00:00:00.000Z",
        },
        {
          id: "purchase-2",
          date: "2024-01-20T00:00:00.000Z",
          supplierId: "supplier-1",
          items: [
            {
              productId: "product-1",
              qty: 10,
              unitCostCents: 1200,
            },
          ],
          createdAt: "2024-01-20T00:00:00.000Z",
        },
      ];

      const margin = pricingService.calculateMargin(
        testProduct,
        purchasesWithMultiple,
        [],
        settingsWithWeightedAvg
      );

      expect(margin).not.toBeNull();
      // Weighted avg: (10*1000 + 10*1200) / 20 = 1100
      expect(margin!.costCents).toBe(1100);
      expect(margin!.marginCents).toBe(900); // 2000 - 1100
      expect(margin!.marginPct).toBe(45); // 900/2000 * 100
    });
  });

  describe("calculateMargins", () => {
    it("should calculate margins for multiple products", () => {
      const products: Product[] = [
        testProduct,
        {
          ...testProduct,
          id: "product-2",
          salePriceCents: 1500,
        },
      ];

      const purchases: Purchase[] = [
        {
          id: "purchase-1",
          date: "2024-01-15T00:00:00.000Z",
          supplierId: "supplier-1",
          items: [
            { productId: "product-1", qty: 10, unitCostCents: 1000 },
            { productId: "product-2", qty: 5, unitCostCents: 800 },
          ],
          createdAt: "2024-01-15T00:00:00.000Z",
        },
      ];

      const margins = pricingService.calculateMargins(
        products,
        purchases,
        testSettings
      );

      expect(margins.size).toBe(2);
      expect(margins.get("product-1")?.marginCents).toBe(1000);
      expect(margins.get("product-2")?.marginCents).toBe(700); // 1500 - 800
    });
  });

  describe("suggestPrice", () => {
    it("should suggest price with markup", () => {
      const suggestion = pricingService.suggestPrice(
        testProduct,
        testPurchases,
        [],
        testSettings
      );

      expect(suggestion).not.toBeNull();
      expect(suggestion!.costCents).toBe(1000);
      expect(suggestion!.markupPct).toBe(50);
      // 1000 * 1.5 = 1500, rounded to nearest 10 = 1500
      expect(suggestion!.suggestedPriceCents).toBe(1500);
      expect(suggestion!.projectedMarginCents).toBe(500);
      expect(suggestion!.projectedMarginPct).toBeCloseTo(33.33, 1);
      expect(suggestion!.meetsMinMargin).toBe(true); // 33.33% > 20%
    });

    it("should return null if no cost data available", () => {
      const suggestion = pricingService.suggestPrice(
        testProduct,
        [], // No purchases
        [],
        testSettings
      );

      expect(suggestion).toBeNull();
    });

    it("should apply rounding correctly", () => {
      const settingsWithRounding = {
        ...testSettings,
        priceRule: {
          markupPct: 50,
          roundToCents: 50, // Round to nearest 50 cents
        },
      };

      const suggestion = pricingService.suggestPrice(
        testProduct,
        testPurchases,
        [],
        settingsWithRounding
      );

      expect(suggestion).not.toBeNull();
      // 1000 * 1.5 = 1500, rounded to nearest 50 = 1500
      expect(suggestion!.suggestedPriceCents).toBe(1500);
    });

    it("should round up when needed", () => {
      const settingsWithRounding = {
        ...testSettings,
        priceRule: {
          markupPct: 55,
          roundToCents: 100, // Round to nearest dollar
        },
      };

      const suggestion = pricingService.suggestPrice(
        testProduct,
        testPurchases,
        [],
        settingsWithRounding
      );

      expect(suggestion).not.toBeNull();
      // 1000 * 1.55 = 1550, rounded to nearest 100 = 1600
      expect(suggestion!.suggestedPriceCents).toBe(1600);
    });

    it("should check minimum margin requirement", () => {
      const settingsWithHighMinMargin = {
        ...testSettings,
        priceRule: {
          markupPct: 20, // Low markup
          roundToCents: 10,
          minMarginPct: 40, // High minimum
        },
      };

      const suggestion = pricingService.suggestPrice(
        testProduct,
        testPurchases,
        [],
        settingsWithHighMinMargin
      );

      expect(suggestion).not.toBeNull();
      // 1000 * 1.2 = 1200
      expect(suggestion!.suggestedPriceCents).toBe(1200);
      // Margin: (1200-1000)/1200 = 16.67%
      expect(suggestion!.meetsMinMargin).toBe(false); // 16.67% < 40%
    });

    it("should handle no minimum margin requirement", () => {
      const settingsWithoutMinMargin = {
        ...testSettings,
        priceRule: {
          markupPct: 10,
          roundToCents: 10,
          // No minMarginPct
        },
      };

      const suggestion = pricingService.suggestPrice(
        testProduct,
        testPurchases,
        [],
        settingsWithoutMinMargin
      );

      expect(suggestion).not.toBeNull();
      expect(suggestion!.meetsMinMargin).toBe(true); // Always true when no min
    });
  });

  describe("validateMinMargin", () => {
    it("should validate margin meets minimum", () => {
      const isValid = pricingService.validateMinMargin(2000, 1000, 40);
      expect(isValid).toBe(true); // 50% > 40%
    });

    it("should validate margin does not meet minimum", () => {
      const isValid = pricingService.validateMinMargin(1200, 1000, 40);
      expect(isValid).toBe(false); // 16.67% < 40%
    });

    it("should return true when no minimum specified", () => {
      const isValid = pricingService.validateMinMargin(1200, 1000, undefined);
      expect(isValid).toBe(true);
    });

    it("should return false for zero sale price", () => {
      const isValid = pricingService.validateMinMargin(0, 1000, 20);
      expect(isValid).toBe(false);
    });
  });

  describe("formatMargin", () => {
    it("should format margin correctly", () => {
      const margin = {
        marginCents: 1000,
        marginPct: 50,
        salePriceCents: 2000,
        costCents: 1000,
      };

      const formatted = pricingService.formatMargin(margin);
      expect(formatted).toBe("$10.00 (50.0%)");
    });

    it("should format negative margin", () => {
      const margin = {
        marginCents: -200,
        marginPct: -25,
        salePriceCents: 800,
        costCents: 1000,
      };

      const formatted = pricingService.formatMargin(margin);
      expect(formatted).toBe("$-2.00 (-25.0%)");
    });
  });

  describe("formatPrice", () => {
    it("should format price correctly", () => {
      expect(pricingService.formatPrice(2000)).toBe("$20.00");
      expect(pricingService.formatPrice(1550)).toBe("$15.50");
      expect(pricingService.formatPrice(0)).toBe("$0.00");
    });
  });

  describe("getMarginSummary", () => {
    it("should return margin summary", () => {
      const summary = pricingService.getMarginSummary(
        testProduct,
        testPurchases,
        [],
        testSettings
      );

      expect(summary).toBe("$10.00 (50.0%)");
    });

    it("should return message when sale price not defined", () => {
      const productWithoutPrice = { ...testProduct, salePriceCents: undefined };

      const summary = pricingService.getMarginSummary(
        productWithoutPrice,
        testPurchases,
        [],
        testSettings
      );

      expect(summary).toBe("Precio de venta no definido");
    });

    it("should return message when no cost data", () => {
      const summary = pricingService.getMarginSummary(
        testProduct,
        [], // No purchases
        [],
        testSettings
      );

      expect(summary).toBe("Sin datos de costo");
    });
  });

  describe("hasPricingData", () => {
    it("should return true when both price and cost available", () => {
      const hasPricing = pricingService.hasPricingData(
        testProduct,
        testPurchases,
        testSettings
      );

      expect(hasPricing).toBe(true);
    });

    it("should return false when sale price not set", () => {
      const productWithoutPrice = { ...testProduct, salePriceCents: undefined };

      const hasPricing = pricingService.hasPricingData(
        productWithoutPrice,
        testPurchases,
        testSettings
      );

      expect(hasPricing).toBe(false);
    });

    it("should return false when no cost data", () => {
      const hasPricing = pricingService.hasPricingData(
        testProduct,
        [],
        testSettings
      );

      expect(hasPricing).toBe(false);
    });
  });

  describe("getProductsWithLowMargins", () => {
    it("should find products with margins below threshold", () => {
      const products: Product[] = [
        { ...testProduct, id: "product-1", salePriceCents: 2000 }, // 50% margin
        { ...testProduct, id: "product-2", salePriceCents: 1200 }, // 16.67% margin
        { ...testProduct, id: "product-3", salePriceCents: 1100 }, // 9.09% margin
      ];

      const purchases: Purchase[] = [
        {
          id: "purchase-1",
          date: "2024-01-15T00:00:00.000Z",
          supplierId: "supplier-1",
          items: [
            { productId: "product-1", qty: 10, unitCostCents: 1000 },
            { productId: "product-2", qty: 10, unitCostCents: 1000 },
            { productId: "product-3", qty: 10, unitCostCents: 1000 },
          ],
          createdAt: "2024-01-15T00:00:00.000Z",
        },
      ];

      const lowMarginProducts = pricingService.getProductsWithLowMargins(
        products,
        purchases,
        testSettings,
        20 // 20% threshold
      );

      expect(lowMarginProducts).toHaveLength(2);
      expect(lowMarginProducts[0].product.id).toBe("product-2");
      expect(lowMarginProducts[1].product.id).toBe("product-3");
    });
  });

  describe("getProductsWithNegativeMargins", () => {
    it("should find products selling below cost", () => {
      const products: Product[] = [
        { ...testProduct, id: "product-1", salePriceCents: 2000 }, // Positive
        { ...testProduct, id: "product-2", salePriceCents: 800 }, // Negative
        { ...testProduct, id: "product-3", salePriceCents: 900 }, // Negative
      ];

      const purchases: Purchase[] = [
        {
          id: "purchase-1",
          date: "2024-01-15T00:00:00.000Z",
          supplierId: "supplier-1",
          items: [
            { productId: "product-1", qty: 10, unitCostCents: 1000 },
            { productId: "product-2", qty: 10, unitCostCents: 1000 },
            { productId: "product-3", qty: 10, unitCostCents: 1000 },
          ],
          createdAt: "2024-01-15T00:00:00.000Z",
        },
      ];

      const negativeMarginProducts =
        pricingService.getProductsWithNegativeMargins(
          products,
          purchases,
          testSettings
        );

      expect(negativeMarginProducts).toHaveLength(2);
      expect(negativeMarginProducts[0].product.id).toBe("product-2");
      expect(negativeMarginProducts[1].product.id).toBe("product-3");
    });
  });
});
