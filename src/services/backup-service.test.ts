/**
 * Tests for backup service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BackupService, type BackupData } from "./backup-service";
import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
} from "../models/types";

describe("BackupService", () => {
  let mockProducts: Product[];
  let mockSuppliers: Supplier[];
  let mockMovements: StockMovement[];
  let mockPurchases: Purchase[];
  let mockSettings: Settings;
  let mockMeta: MetaFile;

  beforeEach(() => {
    mockProducts = [
      {
        id: "prod-1",
        name: "Product 1",
        category: "Category A",
        unit: "unit",
        sku: "SKU001",
        minStock: 10,
        salePriceCents: 1000,
        active: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "prod-2",
        name: "Product 2",
        category: "Category B",
        unit: "kg",
        minStock: 5,
        active: false,
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
    ];

    mockSuppliers = [
      {
        id: "sup-1",
        name: "Supplier 1",
        notes: "Main supplier",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    mockMovements = [
      {
        id: "mov-1",
        date: "2024-01-15T00:00:00.000Z",
        productId: "prod-1",
        type: "in",
        qty: 100,
        note: "Initial stock",
        createdAt: "2024-01-15T00:00:00.000Z",
      },
    ];

    mockPurchases = [
      {
        id: "pur-1",
        date: "2024-01-10T00:00:00.000Z",
        supplierId: "sup-1",
        items: [
          {
            productId: "prod-1",
            qty: 50,
            unitCostCents: 500,
          },
        ],
        createdAt: "2024-01-10T00:00:00.000Z",
      },
    ];

    mockSettings = {
      costMethod: "last",
      weightedAvgWindow: {
        type: "last_n_purchases",
        value: 5,
      },
      priceRule: {
        markupPct: 30,
        roundToCents: 10,
        minMarginPct: 20,
      },
    };

    mockMeta = {
      schemaVersion: "1.0.0",
      lastSyncAt: "2024-01-20T00:00:00.000Z",
      snapshots: {},
    };
  });

  describe("createBackup", () => {
    it("should create backup with all entities", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      expect(backup.version).toBe("1.0.0");
      expect(backup.exportedAt).toBeDefined();
      expect(backup.products).toEqual(mockProducts);
      expect(backup.suppliers).toEqual(mockSuppliers);
      expect(backup.movements).toEqual(mockMovements);
      expect(backup.purchases).toEqual(mockPurchases);
      expect(backup.settings).toEqual(mockSettings);
      expect(backup.meta).toEqual(mockMeta);
    });

    it("should include inactive products by default", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      expect(backup.products).toHaveLength(2);
      expect(backup.products.some((p) => !p.active)).toBe(true);
    });

    it("should exclude inactive products when option is set", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta,
        { includeInactive: false }
      );

      expect(backup.products).toHaveLength(1);
      expect(backup.products.every((p) => p.active)).toBe(true);
    });

    it("should set exportedAt timestamp", () => {
      const before = Date.now();
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );
      const after = Date.now();

      const exportedTime = new Date(backup.exportedAt).getTime();
      expect(exportedTime).toBeGreaterThanOrEqual(before);
      expect(exportedTime).toBeLessThanOrEqual(after);
    });
  });

  describe("exportAsJSON", () => {
    it("should export as pretty-printed JSON by default", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const json = BackupService.exportAsJSON(backup);

      expect(json).toContain("\n");
      expect(json).toContain("  ");
      expect(JSON.parse(json)).toEqual(backup);
    });

    it("should export as compact JSON when prettyPrint is false", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const json = BackupService.exportAsJSON(backup, false);

      expect(json).not.toContain("\n  ");
      expect(JSON.parse(json)).toEqual(backup);
    });
  });

  describe("validateBackup", () => {
    it("should validate correct backup structure", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      expect(BackupService.validateBackup(backup)).toBe(true);
    });

    it("should reject null or undefined", () => {
      expect(BackupService.validateBackup(null)).toBe(false);
      expect(BackupService.validateBackup(undefined)).toBe(false);
    });

    it("should reject non-object values", () => {
      expect(BackupService.validateBackup("string")).toBe(false);
      expect(BackupService.validateBackup(123)).toBe(false);
      expect(BackupService.validateBackup([])).toBe(false);
    });

    it("should reject backup missing required fields", () => {
      const incomplete = {
        version: "1.0.0",
        exportedAt: "2024-01-01T00:00:00.000Z",
        products: [],
        // missing other fields
      };

      expect(BackupService.validateBackup(incomplete)).toBe(false);
    });

    it("should reject backup with wrong field types", () => {
      const invalid = {
        version: "1.0.0",
        exportedAt: "2024-01-01T00:00:00.000Z",
        products: "not an array",
        suppliers: [],
        movements: [],
        purchases: [],
        settings: {},
        meta: {},
      };

      expect(BackupService.validateBackup(invalid)).toBe(false);
    });
  });

  describe("parseBackup", () => {
    it("should parse valid backup JSON", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );
      const json = BackupService.exportAsJSON(backup);

      const parsed = BackupService.parseBackup(json);

      expect(parsed).toEqual(backup);
    });

    it("should throw error for invalid JSON", () => {
      expect(() => BackupService.parseBackup("invalid json")).toThrow(
        "Invalid JSON format"
      );
    });

    it("should throw error for invalid backup structure", () => {
      const invalidBackup = JSON.stringify({ version: "1.0.0" });

      expect(() => BackupService.parseBackup(invalidBackup)).toThrow(
        "Invalid backup data structure"
      );
    });
  });

  describe("getBackupSize", () => {
    it("should calculate backup size in bytes", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const size = BackupService.getBackupSize(backup);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe("number");
    });

    it("should return smaller size for compact JSON", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const prettySize = BackupService.getBackupSize(backup, true);
      const compactSize = BackupService.getBackupSize(backup, false);

      expect(compactSize).toBeLessThan(prettySize);
    });
  });

  describe("getBackupSizeFormatted", () => {
    it("should format size in bytes for small backups", () => {
      const backup = BackupService.createBackup(
        [],
        [],
        [],
        [],
        mockSettings,
        mockMeta
      );

      const formatted = BackupService.getBackupSizeFormatted(backup);

      expect(formatted).toMatch(/\d+ B$/);
    });

    it("should format size in KB for medium backups", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const formatted = BackupService.getBackupSizeFormatted(backup);

      expect(formatted).toMatch(/\d+\.\d+ KB$/);
    });
  });

  describe("downloadBackup", () => {
    it("should trigger browser download", () => {
      // Mock DOM APIs
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL");
      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

      const mockLink = document.createElement("a");
      const clickSpy = vi.spyOn(mockLink, "click");
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockReturnValue(mockLink);

      createObjectURLSpy.mockReturnValue("blob:mock-url");

      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      BackupService.downloadBackup(backup);

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/^dona-lina-backup-.*\.json$/);
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");

      // Cleanup
      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
    });
  });

  describe("Complete data export", () => {
    it("should export all entity types with complete data", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      // Verify all entity types are present
      expect(backup.products).toHaveLength(2);
      expect(backup.suppliers).toHaveLength(1);
      expect(backup.movements).toHaveLength(1);
      expect(backup.purchases).toHaveLength(1);
      expect(backup.settings).toBeDefined();
      expect(backup.meta).toBeDefined();

      // Verify product data integrity
      expect(backup.products[0]).toMatchObject({
        id: "prod-1",
        name: "Product 1",
        category: "Category A",
        unit: "unit",
        sku: "SKU001",
        minStock: 10,
        salePriceCents: 1000,
        active: true,
      });

      // Verify supplier data integrity
      expect(backup.suppliers[0]).toMatchObject({
        id: "sup-1",
        name: "Supplier 1",
        notes: "Main supplier",
      });

      // Verify movement data integrity
      expect(backup.movements[0]).toMatchObject({
        id: "mov-1",
        productId: "prod-1",
        type: "in",
        qty: 100,
      });

      // Verify purchase data integrity
      expect(backup.purchases[0]).toMatchObject({
        id: "pur-1",
        supplierId: "sup-1",
      });
      expect(backup.purchases[0].items).toHaveLength(1);
      expect(backup.purchases[0].items[0]).toMatchObject({
        productId: "prod-1",
        qty: 50,
        unitCostCents: 500,
      });

      // Verify settings data integrity
      expect(backup.settings).toMatchObject({
        costMethod: "last",
        weightedAvgWindow: {
          type: "last_n_purchases",
          value: 5,
        },
        priceRule: {
          markupPct: 30,
          roundToCents: 10,
          minMarginPct: 20,
        },
      });

      // Verify meta data integrity
      expect(backup.meta).toMatchObject({
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-01-20T00:00:00.000Z",
      });
    });

    it("should handle empty collections in export", () => {
      const backup = BackupService.createBackup(
        [],
        [],
        [],
        [],
        mockSettings,
        mockMeta
      );

      expect(backup.products).toEqual([]);
      expect(backup.suppliers).toEqual([]);
      expect(backup.movements).toEqual([]);
      expect(backup.purchases).toEqual([]);
      expect(backup.settings).toEqual(mockSettings);
      expect(backup.meta).toEqual(mockMeta);
    });

    it("should preserve all product fields in export", () => {
      const productWithAllFields: Product = {
        id: "prod-full",
        name: "Full Product",
        category: "Test Category",
        unit: "lt",
        sku: "FULL-001",
        minStock: 15,
        salePriceCents: 2500,
        active: true,
        createdAt: "2024-01-01T10:00:00.000Z",
        updatedAt: "2024-01-02T15:30:00.000Z",
      };

      const backup = BackupService.createBackup(
        [productWithAllFields],
        [],
        [],
        [],
        mockSettings,
        mockMeta
      );

      expect(backup.products[0]).toEqual(productWithAllFields);
    });
  });

  describe("Backup file structure", () => {
    it("should have correct top-level structure", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const keys = Object.keys(backup);
      expect(keys).toContain("version");
      expect(keys).toContain("exportedAt");
      expect(keys).toContain("products");
      expect(keys).toContain("suppliers");
      expect(keys).toContain("movements");
      expect(keys).toContain("purchases");
      expect(keys).toContain("settings");
      expect(keys).toContain("meta");
      expect(keys).toHaveLength(8);
    });

    it("should maintain structure after JSON round-trip", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      const json = BackupService.exportAsJSON(backup);
      const parsed = BackupService.parseBackup(json);

      expect(parsed).toEqual(backup);
      expect(BackupService.validateBackup(parsed)).toBe(true);
    });

    it("should validate structure with nested purchase items", () => {
      const purchaseWithMultipleItems: Purchase = {
        id: "pur-multi",
        date: "2024-01-15T00:00:00.000Z",
        supplierId: "sup-1",
        items: [
          { productId: "prod-1", qty: 10, unitCostCents: 500 },
          { productId: "prod-2", qty: 20, unitCostCents: 750 },
          { productId: "prod-1", qty: 5, unitCostCents: 480 },
        ],
        createdAt: "2024-01-15T00:00:00.000Z",
      };

      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        [purchaseWithMultipleItems],
        mockSettings,
        mockMeta
      );

      expect(BackupService.validateBackup(backup)).toBe(true);
      expect(backup.purchases[0].items).toHaveLength(3);
    });

    it("should validate structure with snapshots in meta", () => {
      const metaWithSnapshots: MetaFile = {
        schemaVersion: "1.0.0",
        lastSyncAt: "2024-01-20T00:00:00.000Z",
        snapshots: {
          "2024-01": {
            stockByProduct: {
              "prod-1": 100,
              "prod-2": 50,
            },
            updatedAt: "2024-01-31T23:59:59.000Z",
          },
          "2024-02": {
            stockByProduct: {
              "prod-1": 120,
              "prod-2": 45,
            },
            updatedAt: "2024-02-29T23:59:59.000Z",
          },
        },
      };

      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        metaWithSnapshots
      );

      expect(BackupService.validateBackup(backup)).toBe(true);
      expect(backup.meta.snapshots).toHaveProperty("2024-01");
      expect(backup.meta.snapshots).toHaveProperty("2024-02");
    });

    it("should preserve ISO date strings in structure", () => {
      const backup = BackupService.createBackup(
        mockProducts,
        mockSuppliers,
        mockMovements,
        mockPurchases,
        mockSettings,
        mockMeta
      );

      // Verify ISO date format
      expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(backup.products[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(backup.movements[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
