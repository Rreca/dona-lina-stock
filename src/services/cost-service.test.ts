/**
 * Unit tests for cost service
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CostService } from "./cost-service";
import { costCache } from "./purchase-service";
import type { Purchase, Settings } from "../models/types";

describe("CostService", () => {
  const service = new CostService();

  const purchases: Purchase[] = [
    {
      id: "p1",
      date: "2024-01-15T10:00:00.000Z",
      supplierId: "s1",
      items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
      createdAt: "2024-01-15T10:00:00.000Z",
    },
    {
      id: "p2",
      date: "2024-02-10T10:00:00.000Z",
      supplierId: "s2",
      items: [{ productId: "prod-1", qty: 20, unitCostCents: 600 }],
      createdAt: "2024-02-10T10:00:00.000Z",
    },
    {
      id: "p3",
      date: "2024-03-05T10:00:00.000Z",
      supplierId: "s1",
      items: [{ productId: "prod-1", qty: 30, unitCostCents: 550 }],
      createdAt: "2024-03-05T10:00:00.000Z",
    },
  ];

  const settingsLastCost: Settings = {
    costMethod: "last",
    weightedAvgWindow: { type: "last_n_purchases", value: 5 },
    priceRule: { markupPct: 30, roundToCents: 10 },
  };

  const settingsWeightedAvg: Settings = {
    costMethod: "weighted_avg",
    weightedAvgWindow: { type: "last_n_purchases", value: 2 },
    priceRule: { markupPct: 30, roundToCents: 10 },
  };

  beforeEach(() => {
    // Clear cache before each test
    costCache.clearAll();
  });

  describe("calculateCurrentCost", () => {
    it("should calculate cost using last cost method", () => {
      const result = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsLastCost
      );

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(550); // Most recent purchase
      expect(result!.method).toBe("last");
      expect(result!.lastCost).toBeDefined();
      expect(result!.lastCost!.supplierId).toBe("s1");
    });

    it("should calculate cost using weighted average method", () => {
      const result = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsWeightedAvg
      );

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(570); // Weighted avg of last 2 purchases
      expect(result!.method).toBe("weighted_avg");
      expect(result!.weightedAvg).toBeDefined();
      expect(result!.weightedAvg!.purchaseCount).toBe(2);
    });

    it("should return null when no purchase history exists", () => {
      const result = service.calculateCurrentCost(
        "prod-999",
        purchases,
        settingsLastCost
      );

      expect(result).toBeNull();
    });

    it("should use cache when enabled", () => {
      // First call - calculates and caches
      const result1 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsLastCost,
        true
      );
      expect(result1!.cost).toBe(550);

      // Second call - should use cache (even with empty purchases)
      const result2 = service.calculateCurrentCost(
        "prod-1",
        [],
        settingsLastCost,
        true
      );
      expect(result2!.cost).toBe(550);
    });

    it("should bypass cache when disabled", () => {
      // First call with cache
      service.calculateCurrentCost("prod-1", purchases, settingsLastCost, true);

      // Second call without cache should recalculate
      const result = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsLastCost,
        false
      );
      expect(result!.cost).toBe(550);
      expect(result!.lastCost).toBeDefined(); // Full details
    });
  });

  describe("calculateCurrentCosts", () => {
    it("should calculate costs for multiple products", () => {
      const productIds = ["prod-1", "prod-999"];
      const results = service.calculateCurrentCosts(
        productIds,
        purchases,
        settingsLastCost
      );

      expect(results.size).toBe(2);
      expect(results.get("prod-1")).not.toBeNull();
      expect(results.get("prod-1")!.cost).toBe(550);
      expect(results.get("prod-999")).toBeNull();
    });
  });

  describe("getCostDetails", () => {
    it("should return full cost details", () => {
      const details = service.getCostDetails(
        "prod-1",
        purchases,
        settingsLastCost
      );

      expect(details).not.toBeNull();
      expect(details!.cost).toBe(550);
      expect(details!.method).toBe("last");
      expect(details!.lastCost).toBeDefined();
    });
  });

  describe("cache management", () => {
    it("should invalidate cache for specific product", () => {
      // Cache a cost
      service.calculateCurrentCost("prod-1", purchases, settingsLastCost, true);

      // Invalidate
      service.invalidateCache("prod-1");

      // Should recalculate (cache miss)
      const cached = costCache.get("prod-1", "last");
      expect(cached).toBeNull();
    });

    it("should invalidate all cache", () => {
      // Cache costs for multiple products
      service.calculateCurrentCost("prod-1", purchases, settingsLastCost, true);

      // Invalidate all
      service.invalidateAllCache();

      // Should be empty
      expect(costCache.size()).toBe(0);
    });
  });

  describe("getCurrentCostOrDefault", () => {
    it("should return cost when available", () => {
      const cost = service.getCurrentCostOrDefault(
        "prod-1",
        purchases,
        settingsLastCost
      );
      expect(cost).toBe(550);
    });

    it("should return default when no cost available", () => {
      const cost = service.getCurrentCostOrDefault(
        "prod-999",
        purchases,
        settingsLastCost,
        100
      );
      expect(cost).toBe(100);
    });

    it("should return 0 as default when not specified", () => {
      const cost = service.getCurrentCostOrDefault(
        "prod-999",
        purchases,
        settingsLastCost
      );
      expect(cost).toBe(0);
    });
  });

  describe("hasCostData", () => {
    it("should return true when product has purchase history", () => {
      expect(service.hasCostData("prod-1", purchases)).toBe(true);
    });

    it("should return false when product has no purchase history", () => {
      expect(service.hasCostData("prod-999", purchases)).toBe(false);
    });
  });

  describe("getCostSummary", () => {
    it("should format last cost summary", () => {
      const summary = service.getCostSummary(
        "prod-1",
        purchases,
        settingsLastCost
      );

      expect(summary).toContain("$5.50");
      expect(summary).toContain("Último costo");
    });

    it("should format weighted average summary", () => {
      const summary = service.getCostSummary(
        "prod-1",
        purchases,
        settingsWeightedAvg
      );

      expect(summary).toContain("$5.70");
      expect(summary).toContain("Promedio ponderado");
      expect(summary).toContain("2 compras");
    });

    it("should handle no purchase history", () => {
      const summary = service.getCostSummary(
        "prod-999",
        purchases,
        settingsLastCost
      );

      expect(summary).toBe("Sin historial de compras");
    });
  });

  describe("compareCostMethods", () => {
    it("should compare last cost and weighted average", () => {
      const comparison = service.compareCostMethods("prod-1", purchases, {
        type: "last_n_purchases",
        value: 2,
      });

      expect(comparison.lastCost).toBe(550);
      expect(comparison.weightedAvg).toBe(570);
      expect(comparison.difference).toBe(20);
      expect(comparison.percentDifference).toBeCloseTo(3.64, 1);
    });

    it("should handle no purchase history", () => {
      const comparison = service.compareCostMethods("prod-999", purchases, {
        type: "last_n_purchases",
        value: 2,
      });

      expect(comparison.lastCost).toBeNull();
      expect(comparison.weightedAvg).toBeNull();
      expect(comparison.difference).toBeNull();
      expect(comparison.percentDifference).toBeNull();
    });
  });

  describe("cost method switching", () => {
    it("should recalculate cost when switching from last to weighted_avg", () => {
      // Calculate with last cost method
      const result1 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsLastCost,
        true
      );
      expect(result1!.cost).toBe(550);
      expect(result1!.method).toBe("last");

      // Switch to weighted average method
      const result2 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsWeightedAvg,
        true
      );
      expect(result2!.cost).toBe(570);
      expect(result2!.method).toBe("weighted_avg");
    });

    it("should recalculate cost when switching from weighted_avg to last", () => {
      // Calculate with weighted average method
      const result1 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsWeightedAvg,
        true
      );
      expect(result1!.cost).toBe(570);
      expect(result1!.method).toBe("weighted_avg");

      // Switch to last cost method
      const result2 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsLastCost,
        true
      );
      expect(result2!.cost).toBe(550);
      expect(result2!.method).toBe("last");
    });

    it("should maintain separate cache entries for different methods", () => {
      // Cache both methods
      service.calculateCurrentCost("prod-1", purchases, settingsLastCost, true);
      service.calculateCurrentCost("prod-1", purchases, settingsWeightedAvg, true);

      // Both should be cached independently
      const lastCostCached = costCache.get("prod-1", "last");
      const weightedAvgCached = costCache.get("prod-1", "weighted_avg");

      expect(lastCostCached).toBe(550);
      expect(weightedAvgCached).toBe(570);
    });

    it("should invalidate all caches when settings change", () => {
      // Cache costs with different methods
      service.calculateCurrentCost("prod-1", purchases, settingsLastCost, true);
      service.calculateCurrentCost("prod-1", purchases, settingsWeightedAvg, true);

      // Invalidate all
      service.invalidateAllCache();

      // Both should be cleared
      expect(costCache.get("prod-1", "last")).toBeNull();
      expect(costCache.get("prod-1", "weighted_avg")).toBeNull();
    });

    it("should handle method switching with no purchase history", () => {
      const emptyPurchases: Purchase[] = [];

      // Try both methods with no data
      const result1 = service.calculateCurrentCost(
        "prod-999",
        emptyPurchases,
        settingsLastCost
      );
      const result2 = service.calculateCurrentCost(
        "prod-999",
        emptyPurchases,
        settingsWeightedAvg
      );

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it("should produce different costs when weighted avg window changes", () => {
      const settingsWindow2: Settings = {
        costMethod: "weighted_avg",
        weightedAvgWindow: { type: "last_n_purchases", value: 2 },
        priceRule: { markupPct: 30, roundToCents: 10 },
      };

      const settingsWindow3: Settings = {
        costMethod: "weighted_avg",
        weightedAvgWindow: { type: "last_n_purchases", value: 3 },
        priceRule: { markupPct: 30, roundToCents: 10 },
      };

      const result2 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsWindow2,
        false // Bypass cache
      );
      const result3 = service.calculateCurrentCost(
        "prod-1",
        purchases,
        settingsWindow3,
        false // Bypass cache
      );

      // Last 2: (30*550 + 20*600) / 50 = 570
      expect(result2!.cost).toBe(570);
      
      // Last 3: (30*550 + 20*600 + 10*500) / 60 = 558
      expect(result3!.cost).toBe(558);
      
      // Verify they are different
      expect(result2!.cost).not.toBe(result3!.cost);
    });
  });
});
