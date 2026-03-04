/**
 * Unit tests for MovementService
 */

import { describe, it, expect } from "vitest";
import { MovementService } from "./movement-service";
import type {
  StockMovement,
  MetaFile,
  StockSnapshot,
  Product,
} from "../models/types";

describe("MovementService", () => {
  const service = new MovementService();

  describe("createMovement", () => {
    it("should create a valid movement", () => {
      const input = {
        date: "2024-01-15T10:00:00.000Z",
        productId: "prod-1",
        type: "in" as const,
        qty: 10,
        note: "Initial stock",
      };

      const movement = service.createMovement(input);

      expect(movement.id).toBeDefined();
      expect(movement.date).toBe(input.date);
      expect(movement.productId).toBe(input.productId);
      expect(movement.type).toBe(input.type);
      expect(movement.qty).toBe(input.qty);
      expect(movement.note).toBe(input.note);
      expect(movement.createdAt).toBeDefined();
    });

    it("should reject movement with invalid quantity for 'in' type", () => {
      const input = {
        date: "2024-01-15T10:00:00.000Z",
        productId: "prod-1",
        type: "in" as const,
        qty: -5,
      };

      expect(() => service.createMovement(input)).toThrow(
        /Quantity for "in" movement must be positive/
      );
    });

    it("should reject movement with zero quantity for 'adjust' type", () => {
      const input = {
        date: "2024-01-15T10:00:00.000Z",
        productId: "prod-1",
        type: "adjust" as const,
        qty: 0,
      };

      expect(() => service.createMovement(input)).toThrow(
        /Quantity for adjustment cannot be zero/
      );
    });

    it("should accept negative quantity for 'adjust' type", () => {
      const input = {
        date: "2024-01-15T10:00:00.000Z",
        productId: "prod-1",
        type: "adjust" as const,
        qty: -5,
      };

      const movement = service.createMovement(input);
      expect(movement.qty).toBe(-5);
    });
  });

  describe("calculateStock", () => {
    it("should calculate stock from movement history", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-01T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-01T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-01-02T10:00:00.000Z",
          productId: "prod-1",
          type: "out",
          qty: 30,
          createdAt: "2024-01-02T10:00:00.000Z",
        },
        {
          id: "m3",
          date: "2024-01-03T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 50,
          createdAt: "2024-01-03T10:00:00.000Z",
        },
      ];

      const stock = service.calculateStock("prod-1", movements);
      expect(stock).toBe(120); // 100 - 30 + 50
    });

    it("should handle adjust movements", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-01T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-01T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-01-02T10:00:00.000Z",
          productId: "prod-1",
          type: "adjust",
          qty: -10,
          createdAt: "2024-01-02T10:00:00.000Z",
        },
        {
          id: "m3",
          date: "2024-01-03T10:00:00.000Z",
          productId: "prod-1",
          type: "adjust",
          qty: 5,
          createdAt: "2024-01-03T10:00:00.000Z",
        },
      ];

      const stock = service.calculateStock("prod-1", movements);
      expect(stock).toBe(95); // 100 - 10 + 5
    });

    it("should return 0 for product with no movements", () => {
      const movements: StockMovement[] = [];
      const stock = service.calculateStock("prod-1", movements);
      expect(stock).toBe(0);
    });

    it("should ignore movements for other products", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-01T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-01T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-01-02T10:00:00.000Z",
          productId: "prod-2",
          type: "in",
          qty: 200,
          createdAt: "2024-01-02T10:00:00.000Z",
        },
      ];

      const stock = service.calculateStock("prod-1", movements);
      expect(stock).toBe(100);
    });
  });

  describe("calculateAllStock", () => {
    it("should calculate stock for all products", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-01T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-01T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-01-02T10:00:00.000Z",
          productId: "prod-2",
          type: "in",
          qty: 200,
          createdAt: "2024-01-02T10:00:00.000Z",
        },
        {
          id: "m3",
          date: "2024-01-03T10:00:00.000Z",
          productId: "prod-1",
          type: "out",
          qty: 30,
          createdAt: "2024-01-03T10:00:00.000Z",
        },
      ];

      const stockMap = service.calculateAllStock(movements);

      expect(stockMap.get("prod-1")).toBe(70);
      expect(stockMap.get("prod-2")).toBe(200);
    });
  });

  describe("monthly partitioning", () => {
    it("should generate correct partition key", () => {
      const date = new Date("2024-01-15T10:00:00.000Z");
      const key = service.getMonthlyPartitionKey(date);
      expect(key).toBe("2024-01");
    });

    it("should generate correct filename", () => {
      const date = new Date("2024-01-15T10:00:00.000Z");
      const filename = service.getMovementsFileName(date);
      expect(filename).toBe("movements_2024-01.json");
    });

    it("should group movements by month", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-15T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-15T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-02-10T10:00:00.000Z",
          productId: "prod-1",
          type: "out",
          qty: 30,
          createdAt: "2024-02-10T10:00:00.000Z",
        },
        {
          id: "m3",
          date: "2024-01-20T10:00:00.000Z",
          productId: "prod-2",
          type: "in",
          qty: 50,
          createdAt: "2024-01-20T10:00:00.000Z",
        },
      ];

      const grouped = service.groupMovementsByMonth(movements);

      expect(grouped.size).toBe(2);
      expect(grouped.get("2024-01")?.length).toBe(2);
      expect(grouped.get("2024-02")?.length).toBe(1);
    });

    it("should get partition keys between dates", () => {
      const start = new Date("2024-01-15");
      const end = new Date("2024-03-20");

      const keys = service.getPartitionKeysBetween(start, end);

      expect(keys).toEqual(["2024-01", "2024-02", "2024-03"]);
    });
  });

  describe("file serialization", () => {
    it("should parse movements file", () => {
      const content = JSON.stringify({
        movements: [
          {
            id: "m1",
            date: "2024-01-15T10:00:00.000Z",
            productId: "prod-1",
            type: "in",
            qty: 100,
            createdAt: "2024-01-15T10:00:00.000Z",
          },
        ],
      });

      const parsed = service.parseMovementsFile(content);
      expect(parsed.movements).toHaveLength(1);
      expect(parsed.movements[0].id).toBe("m1");
    });

    it("should handle invalid JSON", () => {
      const parsed = service.parseMovementsFile("invalid json");
      expect(parsed.movements).toEqual([]);
    });

    it("should serialize movements to file", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-15T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-15T10:00:00.000Z",
        },
      ];

      const serialized = service.serializeMovementsFile(movements);
      const parsed = JSON.parse(serialized);

      expect(parsed.movements).toHaveLength(1);
      expect(parsed.movements[0].id).toBe("m1");
    });
  });

  describe("stock snapshots", () => {
    it("should create a snapshot", () => {
      const stockMap = new Map([
        ["prod-1", 100],
        ["prod-2", 200],
      ]);

      const snapshot = service.createSnapshot("2024-01", stockMap);

      expect(snapshot.stockByProduct["prod-1"]).toBe(100);
      expect(snapshot.stockByProduct["prod-2"]).toBe(200);
      expect(snapshot.updatedAt).toBeDefined();
    });

    it("should calculate stock from snapshot with incremental movements", () => {
      const snapshot: StockSnapshot = {
        stockByProduct: {
          "prod-1": 100,
          "prod-2": 200,
        },
        updatedAt: "2024-01-31T23:59:59.000Z",
      };

      const incrementalMovements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-02-01T10:00:00.000Z",
          productId: "prod-1",
          type: "out",
          qty: 20,
          createdAt: "2024-02-01T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-02-02T10:00:00.000Z",
          productId: "prod-2",
          type: "in",
          qty: 50,
          createdAt: "2024-02-02T10:00:00.000Z",
        },
      ];

      const currentStock = service.calculateStockFromSnapshot(
        snapshot,
        incrementalMovements
      );

      expect(currentStock.get("prod-1")).toBe(80); // 100 - 20
      expect(currentStock.get("prod-2")).toBe(250); // 200 + 50
    });

    it("should get most recent snapshot", () => {
      const meta: MetaFile = {
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-03-01T00:00:00.000Z",
        snapshots: {
          "2024-01": {
            stockByProduct: { "prod-1": 100 },
            updatedAt: "2024-01-31T23:59:59.000Z",
          },
          "2024-02": {
            stockByProduct: { "prod-1": 120 },
            updatedAt: "2024-02-29T23:59:59.000Z",
          },
        },
      };

      const result = service.getMostRecentSnapshot(
        meta,
        new Date("2024-02-15")
      );

      expect(result?.monthKey).toBe("2024-02");
      expect(result?.snapshot.stockByProduct["prod-1"]).toBe(120);
    });

    it("should return null when no snapshot exists", () => {
      const meta: MetaFile = {
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-03-01T00:00:00.000Z",
        snapshots: {},
      };

      const result = service.getMostRecentSnapshot(
        meta,
        new Date("2024-02-15")
      );

      expect(result).toBeNull();
    });

    it("should refresh snapshot", () => {
      const movements: StockMovement[] = [
        {
          id: "m1",
          date: "2024-01-15T10:00:00.000Z",
          productId: "prod-1",
          type: "in",
          qty: 100,
          createdAt: "2024-01-15T10:00:00.000Z",
        },
        {
          id: "m2",
          date: "2024-01-20T10:00:00.000Z",
          productId: "prod-1",
          type: "out",
          qty: 30,
          createdAt: "2024-01-20T10:00:00.000Z",
        },
      ];

      const snapshot = service.refreshSnapshot("2024-01", movements);

      expect(snapshot.stockByProduct["prod-1"]).toBe(70);
      expect(snapshot.updatedAt).toBeDefined();
    });

    it("should update meta with snapshot", () => {
      const meta: MetaFile = {
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-01-01T00:00:00.000Z",
        snapshots: {},
      };

      const snapshot: StockSnapshot = {
        stockByProduct: { "prod-1": 100 },
        updatedAt: "2024-01-31T23:59:59.000Z",
      };

      const updatedMeta = service.updateMetaWithSnapshot(
        meta,
        "2024-01",
        snapshot
      );

      expect(updatedMeta.snapshots["2024-01"]).toBeDefined();
      expect(updatedMeta.snapshots["2024-01"].stockByProduct["prod-1"]).toBe(
        100
      );
    });

    it("should parse and serialize meta file", () => {
      const meta: MetaFile = {
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-01-01T00:00:00.000Z",
        snapshots: {
          "2024-01": {
            stockByProduct: { "prod-1": 100 },
            updatedAt: "2024-01-31T23:59:59.000Z",
          },
        },
      };

      const serialized = service.serializeMetaFile(meta);
      const parsed = service.parseMetaFile(serialized);

      expect(parsed.schemaVersion).toBe("1.0.0");
      expect(parsed.snapshots["2024-01"].stockByProduct["prod-1"]).toBe(100);
    });

    it("should handle invalid meta JSON", () => {
      const parsed = service.parseMetaFile("invalid json");

      expect(parsed.schemaVersion).toBe("1.0.0");
      expect(parsed.snapshots).toEqual({});
    });
  });

  describe("low stock alerts", () => {
    const createProduct = (
      id: string,
      name: string,
      minStock: number,
      active = true
    ): Product => ({
      id,
      name,
      category: "test",
      unit: "unit",
      minStock,
      active,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    it("should detect low stock", () => {
      expect(service.isLowStock(5, 10)).toBe(true);
      expect(service.isLowStock(10, 10)).toBe(false);
      expect(service.isLowStock(15, 10)).toBe(false);
    });

    it("should create low stock alert", () => {
      const product = createProduct("prod-1", "Product 1", 10);
      const alert = service.getLowStockAlert(product, 5);

      expect(alert).not.toBeNull();
      expect(alert?.currentStock).toBe(5);
      expect(alert?.minStock).toBe(10);
      expect(alert?.deficit).toBe(5);
    });

    it("should return null for adequate stock", () => {
      const product = createProduct("prod-1", "Product 1", 10);
      const alert = service.getLowStockAlert(product, 15);

      expect(alert).toBeNull();
    });

    it("should get all low stock products", () => {
      const products: Product[] = [
        createProduct("prod-1", "Product 1", 10),
        createProduct("prod-2", "Product 2", 20),
        createProduct("prod-3", "Product 3", 5),
      ];

      const stockMap = new Map([
        ["prod-1", 5], // Low
        ["prod-2", 25], // Adequate
        ["prod-3", 2], // Low
      ]);

      const alerts = service.getLowStockProducts(products, stockMap);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].product.id).toBe("prod-1");
      expect(alerts[1].product.id).toBe("prod-3");
    });

    it("should exclude inactive products from low stock alerts", () => {
      const products: Product[] = [
        createProduct("prod-1", "Product 1", 10, true),
        createProduct("prod-2", "Product 2", 20, false), // Inactive
      ];

      const stockMap = new Map([
        ["prod-1", 5], // Low
        ["prod-2", 5], // Low but inactive
      ]);

      const alerts = service.getLowStockProducts(products, stockMap);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].product.id).toBe("prod-1");
    });

    it("should filter products below minimum", () => {
      const products: Product[] = [
        createProduct("prod-1", "Product 1", 10),
        createProduct("prod-2", "Product 2", 20),
        createProduct("prod-3", "Product 3", 5),
      ];

      const stockMap = new Map([
        ["prod-1", 5], // Low
        ["prod-2", 25], // Adequate
        ["prod-3", 2], // Low
      ]);

      const lowStockIds = service.filterBelowMinimum(products, stockMap);

      expect(lowStockIds).toEqual(["prod-1", "prod-3"]);
    });

    it("should get stock status", () => {
      const product = createProduct("prod-1", "Product 1", 10);

      expect(service.getStockStatus(product, 0)).toBe("out");
      expect(service.getStockStatus(product, 5)).toBe("low");
      expect(service.getStockStatus(product, 15)).toBe("adequate");
    });

    it("should handle products with no stock data", () => {
      const products: Product[] = [createProduct("prod-1", "Product 1", 10)];

      const stockMap = new Map(); // Empty

      const alerts = service.getLowStockProducts(products, stockMap);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].currentStock).toBe(0);
      expect(alerts[0].deficit).toBe(10);
    });
  });
});
