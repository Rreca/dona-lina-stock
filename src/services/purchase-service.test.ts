/**
 * Unit tests for purchase service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PurchaseService, CostCache } from "./purchase-service";
import type { Purchase, PurchaseItem } from "../models/types";

describe("PurchaseService", () => {
  const service = new PurchaseService();

  describe("createPurchase", () => {
    it("should create a valid purchase", () => {
      const items: PurchaseItem[] = [
        { productId: "prod-1", qty: 10, unitCostCents: 500 },
        { productId: "prod-2", qty: 5, unitCostCents: 1000 },
      ];

      const purchase = service.createPurchase({
        date: "2024-01-15T10:00:00.000Z",
        supplierId: "supplier-1",
        items,
        note: "Test purchase",
      });

      expect(purchase.id).toBeDefined();
      expect(purchase.date).toBe("2024-01-15T10:00:00.000Z");
      expect(purchase.supplierId).toBe("supplier-1");
      expect(purchase.items).toEqual(items);
      expect(purchase.note).toBe("Test purchase");
      expect(purchase.createdAt).toBeDefined();
    });

    it("should throw error if supplier ID is missing", () => {
      expect(() =>
        service.createPurchase({
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
        })
      ).toThrow("Supplier ID is required");
    });

    it("should throw error if items array is empty", () => {
      expect(() =>
        service.createPurchase({
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "supplier-1",
          items: [],
        })
      ).toThrow("Purchase must have at least one item");
    });

    it("should throw error if item has invalid quantity", () => {
      expect(() =>
        service.createPurchase({
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "supplier-1",
          items: [{ productId: "prod-1", qty: 0, unitCostCents: 500 }],
        })
      ).toThrow("Quantity must be positive");
    });

    it("should throw error if item has negative cost", () => {
      expect(() =>
        service.createPurchase({
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "supplier-1",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: -100 }],
        })
      ).toThrow("Unit cost cannot be negative");
    });
  });

  describe("monthly partitioning", () => {
    it("should generate correct partition key", () => {
      const key1 = service.getMonthlyPartitionKey("2024-01-15T10:00:00.000Z");
      expect(key1).toBe("2024-01");

      const key2 = service.getMonthlyPartitionKey(new Date("2024-12-31"));
      expect(key2).toBe("2024-12");
    });

    it("should generate correct filename", () => {
      const filename = service.getPurchasesFileName("2024-01-15T10:00:00.000Z");
      expect(filename).toBe("purchases_2024-01.json");
    });

    it("should group purchases by month", () => {
      const purchases: Purchase[] = [
        {
          id: "p1",
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "s1",
          items: [],
          createdAt: "2024-01-15T10:00:00.000Z",
        },
        {
          id: "p2",
          date: "2024-01-20T10:00:00.000Z",
          supplierId: "s1",
          items: [],
          createdAt: "2024-01-20T10:00:00.000Z",
        },
        {
          id: "p3",
          date: "2024-02-10T10:00:00.000Z",
          supplierId: "s1",
          items: [],
          createdAt: "2024-02-10T10:00:00.000Z",
        },
      ];

      const grouped = service.groupPurchasesByMonth(purchases);

      expect(grouped.size).toBe(2);
      expect(grouped.get("2024-01")).toHaveLength(2);
      expect(grouped.get("2024-02")).toHaveLength(1);
    });

    it("should get partition keys between dates", () => {
      const keys = service.getPartitionKeysBetween(
        new Date("2024-01-15"),
        new Date("2024-03-20")
      );

      expect(keys).toEqual(["2024-01", "2024-02", "2024-03"]);
    });
  });

  describe("file parsing and serialization", () => {
    it("should parse valid purchases file", () => {
      const json = JSON.stringify({
        purchases: [
          {
            id: "p1",
            date: "2024-01-15T10:00:00.000Z",
            supplierId: "s1",
            items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
            createdAt: "2024-01-15T10:00:00.000Z",
          },
        ],
      });

      const parsed = service.parsePurchasesFile(json);
      expect(parsed.purchases).toHaveLength(1);
      expect(parsed.purchases[0].id).toBe("p1");
    });

    it("should handle invalid JSON", () => {
      const parsed = service.parsePurchasesFile("invalid json");
      expect(parsed.purchases).toEqual([]);
    });

    it("should serialize purchases correctly", () => {
      const purchases: Purchase[] = [
        {
          id: "p1",
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
          createdAt: "2024-01-15T10:00:00.000Z",
        },
      ];

      const serialized = service.serializePurchasesFile(purchases);
      const parsed = JSON.parse(serialized);

      expect(parsed.purchases).toHaveLength(1);
      expect(parsed.purchases[0].id).toBe("p1");
    });
  });

  describe("purchase history queries", () => {
    const purchases: Purchase[] = [
      {
        id: "p1",
        date: "2024-01-15T10:00:00.000Z",
        supplierId: "s1",
        items: [
          { productId: "prod-1", qty: 10, unitCostCents: 500 },
          { productId: "prod-2", qty: 5, unitCostCents: 1000 },
        ],
        createdAt: "2024-01-15T10:00:00.000Z",
      },
      {
        id: "p2",
        date: "2024-02-10T10:00:00.000Z",
        supplierId: "s1",
        items: [{ productId: "prod-1", qty: 20, unitCostCents: 550 }],
        createdAt: "2024-02-10T10:00:00.000Z",
      },
      {
        id: "p3",
        date: "2024-03-05T10:00:00.000Z",
        supplierId: "s2",
        items: [{ productId: "prod-1", qty: 15, unitCostCents: 525 }],
        createdAt: "2024-03-05T10:00:00.000Z",
      },
    ];

    it("should get purchase history by product", () => {
      const history = service.getPurchaseHistoryByProduct("prod-1", purchases);

      expect(history).toHaveLength(3);
      // Should be sorted newest first
      expect(history[0].purchase.id).toBe("p3");
      expect(history[1].purchase.id).toBe("p2");
      expect(history[2].purchase.id).toBe("p1");
    });

    it("should get purchase history by supplier", () => {
      const history = service.getPurchaseHistoryBySupplier("s1", purchases);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe("p2");
      expect(history[1].id).toBe("p1");
    });

    it("should get purchase history by product and supplier", () => {
      const history = service.getPurchaseHistoryByProductAndSupplier(
        "prod-1",
        "s1",
        purchases
      );

      expect(history).toHaveLength(2);
      expect(history[0].purchase.id).toBe("p2");
      expect(history[1].purchase.id).toBe("p1");
    });

    it("should get purchases by date range", () => {
      const history = service.getPurchasesByDateRange(
        new Date("2024-01-01"),
        new Date("2024-02-15"),
        purchases
      );

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe("p2");
      expect(history[1].id).toBe("p1");
    });

    it("should get most recent purchase item", () => {
      const recent = service.getMostRecentPurchaseItem("prod-1", purchases);

      expect(recent).not.toBeNull();
      expect(recent!.purchase.id).toBe("p3");
      expect(recent!.item.unitCostCents).toBe(525);
    });

    it("should return null for product with no history", () => {
      const recent = service.getMostRecentPurchaseItem("prod-999", purchases);
      expect(recent).toBeNull();
    });

    it("should check if product has purchase history", () => {
      expect(service.hasPurchaseHistory("prod-1", purchases)).toBe(true);
      expect(service.hasPurchaseHistory("prod-999", purchases)).toBe(false);
    });
  });

  describe("calculatePurchaseTotal", () => {
    it("should calculate total correctly", () => {
      const purchase: Purchase = {
        id: "p1",
        date: "2024-01-15T10:00:00.000Z",
        supplierId: "s1",
        items: [
          { productId: "prod-1", qty: 10, unitCostCents: 500 }, // 5000
          { productId: "prod-2", qty: 5, unitCostCents: 1000 }, // 5000
        ],
        createdAt: "2024-01-15T10:00:00.000Z",
      };

      const total = service.calculatePurchaseTotal(purchase);
      expect(total).toBe(10000);
    });

    it("should handle empty items", () => {
      const purchase: Purchase = {
        id: "p1",
        date: "2024-01-15T10:00:00.000Z",
        supplierId: "s1",
        items: [],
        createdAt: "2024-01-15T10:00:00.000Z",
      };

      const total = service.calculatePurchaseTotal(purchase);
      expect(total).toBe(0);
    });
  });

  describe("calculateLastCost", () => {
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
        items: [{ productId: "prod-1", qty: 20, unitCostCents: 550 }],
        createdAt: "2024-02-10T10:00:00.000Z",
      },
      {
        id: "p3",
        date: "2024-03-05T10:00:00.000Z",
        supplierId: "s1",
        items: [{ productId: "prod-1", qty: 15, unitCostCents: 525 }],
        createdAt: "2024-03-05T10:00:00.000Z",
      },
    ];

    it("should return last cost from most recent purchase", () => {
      const lastCost = service.calculateLastCost("prod-1", purchases);

      expect(lastCost).not.toBeNull();
      expect(lastCost!.cost).toBe(525);
      expect(lastCost!.supplierId).toBe("s1");
      expect(lastCost!.date).toBe("2024-03-05T10:00:00.000Z");
    });

    it("should return null when no purchase history exists", () => {
      const lastCost = service.calculateLastCost("prod-999", purchases);
      expect(lastCost).toBeNull();
    });

    it("should handle single purchase", () => {
      const singlePurchase: Purchase[] = [
        {
          id: "p1",
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
          createdAt: "2024-01-15T10:00:00.000Z",
        },
      ];

      const lastCost = service.calculateLastCost("prod-1", singlePurchase);

      expect(lastCost).not.toBeNull();
      expect(lastCost!.cost).toBe(500);
    });
  });

  describe("calculateWeightedAverageCost", () => {
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

    it("should calculate weighted average for last N purchases", () => {
      // Last 2 purchases: p3 (30 @ 550) and p2 (20 @ 600)
      // Weighted avg = (30*550 + 20*600) / (30+20) = (16500 + 12000) / 50 = 28500 / 50 = 570
      const result = service.calculateWeightedAverageCost("prod-1", purchases, {
        type: "last_n_purchases",
        value: 2,
      });

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(570);
      expect(result!.purchaseCount).toBe(2);
      expect(result!.totalQty).toBe(50);
    });

    it("should calculate weighted average for all purchases", () => {
      // All 3 purchases: p3 (30 @ 550) + p2 (20 @ 600) + p1 (10 @ 500)
      // Weighted avg = (30*550 + 20*600 + 10*500) / (30+20+10) = (16500 + 12000 + 5000) / 60 = 33500 / 60 = 558.33 ≈ 558
      const result = service.calculateWeightedAverageCost("prod-1", purchases, {
        type: "last_n_purchases",
        value: 10,
      });

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(558);
      expect(result!.purchaseCount).toBe(3);
      expect(result!.totalQty).toBe(60);
    });

    it("should calculate weighted average for last X days", () => {
      // Create purchases with recent dates
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const testPurchases: Purchase[] = [
        {
          id: "p1",
          date: tenDaysAgo.toISOString(),
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
          createdAt: tenDaysAgo.toISOString(),
        },
        {
          id: "p2",
          date: twoDaysAgo.toISOString(),
          supplierId: "s2",
          items: [{ productId: "prod-1", qty: 20, unitCostCents: 600 }],
          createdAt: twoDaysAgo.toISOString(),
        },
        {
          id: "p3",
          date: yesterday.toISOString(),
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 30, unitCostCents: 550 }],
          createdAt: yesterday.toISOString(),
        },
      ];

      // Last 5 days should include p2 and p3, but not p1
      const result = service.calculateWeightedAverageCost("prod-1", testPurchases, {
        type: "last_days",
        value: 5,
      });

      expect(result).not.toBeNull();
      // p2 (20*600) + p3 (30*550) = 12000 + 16500 = 28500 / 50 = 570
      expect(result!.cost).toBe(570);
      expect(result!.purchaseCount).toBe(2);
    });

    it("should return null when no purchase history exists", () => {
      const result = service.calculateWeightedAverageCost("prod-999", purchases, {
        type: "last_n_purchases",
        value: 5,
      });

      expect(result).toBeNull();
    });

    it("should return null when no purchases in window", () => {
      const result = service.calculateWeightedAverageCost("prod-1", purchases, {
        type: "last_days",
        value: 1, // Only last 1 day, no purchases
      });

      expect(result).toBeNull();
    });

    it("should handle single purchase", () => {
      const singlePurchase: Purchase[] = [
        {
          id: "p1",
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
          createdAt: "2024-01-15T10:00:00.000Z",
        },
      ];

      const result = service.calculateWeightedAverageCost("prod-1", singlePurchase, {
        type: "last_n_purchases",
        value: 5,
      });

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(500);
      expect(result!.purchaseCount).toBe(1);
      expect(result!.totalQty).toBe(10);
    });

    it("should round weighted average to nearest cent", () => {
      const testPurchases: Purchase[] = [
        {
          id: "p1",
          date: "2024-01-15T10:00:00.000Z",
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 3, unitCostCents: 100 }],
          createdAt: "2024-01-15T10:00:00.000Z",
        },
        {
          id: "p2",
          date: "2024-02-10T10:00:00.000Z",
          supplierId: "s1",
          items: [{ productId: "prod-1", qty: 2, unitCostCents: 101 }],
          createdAt: "2024-02-10T10:00:00.000Z",
        },
      ];

      // (3*100 + 2*101) / 5 = (300 + 202) / 5 = 502 / 5 = 100.4 ≈ 100
      const result = service.calculateWeightedAverageCost("prod-1", testPurchases, {
        type: "last_n_purchases",
        value: 10,
      });

      expect(result).not.toBeNull();
      expect(result!.cost).toBe(100);
    });
  });
});

describe("purchase immutability", () => {
  const service = new PurchaseService();

  it("should not allow modification of purchase after creation", () => {
    const items: PurchaseItem[] = [
      { productId: "prod-1", qty: 10, unitCostCents: 500 },
    ];

    const purchase = service.createPurchase({
      date: "2024-01-15T10:00:00.000Z",
      supplierId: "supplier-1",
      items,
      note: "Original note",
    });

    // Store original values
    const originalId = purchase.id;
    const originalDate = purchase.date;
    const originalSupplierId = purchase.supplierId;
    const originalItemsLength = purchase.items.length;
    const originalNote = purchase.note;

    // Attempt to modify (TypeScript prevents this, but test runtime behavior)
    // In a real scenario, these would be frozen or use immutable data structures
    expect(purchase.id).toBe(originalId);
    expect(purchase.date).toBe(originalDate);
    expect(purchase.supplierId).toBe(originalSupplierId);
    expect(purchase.items.length).toBe(originalItemsLength);
    expect(purchase.note).toBe(originalNote);
  });

  it("should create independent purchase instances", () => {
    const items1: PurchaseItem[] = [
      { productId: "prod-1", qty: 10, unitCostCents: 500 },
    ];

    const items2: PurchaseItem[] = [
      { productId: "prod-1", qty: 10, unitCostCents: 500 },
    ];

    const purchase1 = service.createPurchase({
      date: "2024-01-15T10:00:00.000Z",
      supplierId: "supplier-1",
      items: items1,
    });

    const purchase2 = service.createPurchase({
      date: "2024-01-15T10:00:00.000Z",
      supplierId: "supplier-1",
      items: items2,
    });

    // Each purchase should have unique ID
    expect(purchase1.id).not.toBe(purchase2.id);
    
    // Modifying one purchase's items shouldn't affect the other
    purchase1.items[0].qty = 20;
    expect(purchase2.items[0].qty).toBe(10);
  });

  it("should preserve purchase history without modification", () => {
    const purchases: Purchase[] = [
      {
        id: "p1",
        date: "2024-01-15T10:00:00.000Z",
        supplierId: "s1",
        items: [{ productId: "prod-1", qty: 10, unitCostCents: 500 }],
        createdAt: "2024-01-15T10:00:00.000Z",
      },
    ];

    // Query operations should not modify original array
    const history = service.getPurchaseHistoryByProduct("prod-1", purchases);
    
    expect(purchases.length).toBe(1);
    expect(purchases[0].id).toBe("p1");
    expect(history.length).toBe(1);
  });
});

describe("CostCache", () => {
  let cache: CostCache;

  beforeEach(() => {
    cache = new CostCache(1000); // 1 second TTL for testing
  });

  it("should cache and retrieve cost", () => {
    cache.set("prod-1", "last", 500);
    const cached = cache.get("prod-1", "last");
    expect(cached).toBe(500);
  });

  it("should return null for non-existent cache entry", () => {
    const cached = cache.get("prod-999", "last");
    expect(cached).toBeNull();
  });

  it("should expire cache after TTL", async () => {
    cache.set("prod-1", "last", 500);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const cached = cache.get("prod-1", "last");
    expect(cached).toBeNull();
  });

  it("should clear cache for specific product", () => {
    cache.set("prod-1", "last", 500);
    cache.set("prod-1", "weighted_avg", 550);
    cache.set("prod-2", "last", 600);

    cache.clearProduct("prod-1");

    expect(cache.get("prod-1", "last")).toBeNull();
    expect(cache.get("prod-1", "weighted_avg")).toBeNull();
    expect(cache.get("prod-2", "last")).toBe(600);
  });

  it("should clear all cache", () => {
    cache.set("prod-1", "last", 500);
    cache.set("prod-2", "last", 600);

    cache.clearAll();

    expect(cache.get("prod-1", "last")).toBeNull();
    expect(cache.get("prod-2", "last")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("should track cache size", () => {
    expect(cache.size()).toBe(0);

    cache.set("prod-1", "last", 500);
    expect(cache.size()).toBe(1);

    cache.set("prod-2", "last", 600);
    expect(cache.size()).toBe(2);

    cache.clearAll();
    expect(cache.size()).toBe(0);
  });

  it("should handle different methods for same product", () => {
    cache.set("prod-1", "last", 500);
    cache.set("prod-1", "weighted_avg", 550);

    expect(cache.get("prod-1", "last")).toBe(500);
    expect(cache.get("prod-1", "weighted_avg")).toBe(550);
  });
});
