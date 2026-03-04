/**
 * Unit tests for validation utilities
 * Tests cover: required field validation, SKU uniqueness checks, and quantity validation edge cases
 * Requirements: R3.2, R4.5
 */

import { describe, it, expect } from "vitest";
import {
  validateProductRequiredFields,
  validateSkuUniqueness,
  validateProduct,
  validateMovementQuantity,
  validatePurchaseQuantity,
  validateStockMovement,
} from "./validation";
import type { Product, StockMovement } from "./types";

// ============================================================================
// Test: Required Field Validation
// ============================================================================

describe("validateProductRequiredFields", () => {
  it("should pass validation when all required fields are present", () => {
    const product = {
      name: "Test Product",
      unit: "kg" as const,
    };

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation when name is missing", () => {
    const product = {
      unit: "kg" as const,
    };

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Product name is required");
  });

  it("should fail validation when name is empty string", () => {
    const product = {
      name: "",
      unit: "kg" as const,
    };

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Product name is required");
  });

  it("should fail validation when name is only whitespace", () => {
    const product = {
      name: "   ",
      unit: "kg" as const,
    };

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Product name is required");
  });

  it("should fail validation when unit is missing", () => {
    const product = {
      name: "Test Product",
    };

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Product unit is required");
  });

  it("should fail validation when both name and unit are missing", () => {
    const product = {};

    const result = validateProductRequiredFields(product);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain("Product name is required");
    expect(result.errors).toContain("Product unit is required");
  });
});

// ============================================================================
// Test: SKU Uniqueness Checks
// ============================================================================

describe("validateSkuUniqueness", () => {
  const existingProducts: Product[] = [
    {
      id: "1",
      name: "Product A",
      category: "Category 1",
      unit: "kg",
      sku: "SKU-001",
      minStock: 10,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "2",
      name: "Product B",
      category: "Category 2",
      unit: "lt",
      sku: "SKU-002",
      minStock: 5,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "3",
      name: "Product C",
      category: "Category 1",
      unit: "unit",
      minStock: 20,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  it("should pass validation when SKU is unique", () => {
    const result = validateSkuUniqueness("SKU-003", existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass validation when SKU is undefined", () => {
    const result = validateSkuUniqueness(undefined, existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass validation when SKU is empty string", () => {
    const result = validateSkuUniqueness("", existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass validation when SKU is only whitespace", () => {
    const result = validateSkuUniqueness("   ", existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation when SKU already exists", () => {
    const result = validateSkuUniqueness("SKU-001", existingProducts);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('SKU "SKU-001" is already used');
    expect(result.errors[0]).toContain("Product A");
  });

  it("should be case-insensitive when checking SKU uniqueness", () => {
    const result = validateSkuUniqueness("sku-001", existingProducts);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Product A");
  });

  it("should ignore leading/trailing whitespace in SKU comparison", () => {
    const result = validateSkuUniqueness("  SKU-001  ", existingProducts);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Product A");
  });

  it("should pass validation when SKU matches the product being updated (excludeProductId)", () => {
    const result = validateSkuUniqueness("SKU-001", existingProducts, "1");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation when SKU matches a different product (excludeProductId)", () => {
    const result = validateSkuUniqueness("SKU-001", existingProducts, "2");

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Product A");
  });
});

// ============================================================================
// Test: Complete Product Validation
// ============================================================================

describe("validateProduct", () => {
  const existingProducts: Product[] = [
    {
      id: "1",
      name: "Existing Product",
      category: "Category 1",
      unit: "kg",
      sku: "EXISTING-SKU",
      minStock: 10,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  it("should pass validation for a valid product", () => {
    const product = {
      name: "New Product",
      unit: "lt" as const,
      sku: "NEW-SKU",
    };

    const result = validateProduct(product, existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation when required fields are missing", () => {
    const product = {
      sku: "NEW-SKU",
    };

    const result = validateProduct(product, existingProducts);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should fail validation when SKU is duplicate", () => {
    const product = {
      name: "New Product",
      unit: "lt" as const,
      sku: "EXISTING-SKU",
    };

    const result = validateProduct(product, existingProducts);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already used"))).toBe(true);
  });

  it("should pass validation when product has no SKU", () => {
    const product = {
      name: "New Product",
      unit: "lt" as const,
    };

    const result = validateProduct(product, existingProducts);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Test: Quantity Validation Edge Cases
// ============================================================================

describe("validateMovementQuantity", () => {
  describe('movement type "in"', () => {
    it("should pass validation for positive quantity", () => {
      const result = validateMovementQuantity(10, "in");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for zero quantity", () => {
      const result = validateMovementQuantity(0, "in");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Quantity for "in" movement must be positive'
      );
    });

    it("should fail validation for negative quantity", () => {
      const result = validateMovementQuantity(-5, "in");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Quantity for "in" movement must be positive'
      );
    });

    it("should fail validation for NaN", () => {
      const result = validateMovementQuantity(NaN, "in");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Quantity must be a valid number");
    });
  });

  describe('movement type "out"', () => {
    it("should pass validation for positive quantity", () => {
      const result = validateMovementQuantity(10, "out");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for zero quantity", () => {
      const result = validateMovementQuantity(0, "out");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Quantity for "out" movement must be positive'
      );
    });

    it("should fail validation for negative quantity", () => {
      const result = validateMovementQuantity(-5, "out");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Quantity for "out" movement must be positive'
      );
    });
  });

  describe('movement type "adjust"', () => {
    it("should pass validation for positive quantity", () => {
      const result = validateMovementQuantity(10, "adjust");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass validation for negative quantity", () => {
      const result = validateMovementQuantity(-5, "adjust");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for zero quantity", () => {
      const result = validateMovementQuantity(0, "adjust");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Quantity for adjustment cannot be zero");
    });

    it("should fail validation for NaN", () => {
      const result = validateMovementQuantity(NaN, "adjust");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Quantity must be a valid number");
    });
  });

  it("should handle decimal quantities", () => {
    const result = validateMovementQuantity(10.5, "in");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("validatePurchaseQuantity", () => {
  it("should pass validation for positive quantity", () => {
    const result = validatePurchaseQuantity(10);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation for zero quantity", () => {
    const result = validatePurchaseQuantity(0);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Purchase quantity must be positive");
  });

  it("should fail validation for negative quantity", () => {
    const result = validatePurchaseQuantity(-5);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Purchase quantity must be positive");
  });

  it("should fail validation for NaN", () => {
    const result = validatePurchaseQuantity(NaN);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Quantity must be a valid number");
  });

  it("should handle decimal quantities", () => {
    const result = validatePurchaseQuantity(10.5);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("validateStockMovement", () => {
  it("should pass validation for a valid movement", () => {
    const movement: Partial<StockMovement> = {
      productId: "product-1",
      type: "in",
      qty: 10,
      date: "2024-01-15T10:00:00.000Z",
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation when productId is missing", () => {
    const movement: Partial<StockMovement> = {
      type: "in",
      qty: 10,
      date: "2024-01-15T10:00:00.000Z",
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Product ID is required");
  });

  it("should fail validation when type is missing", () => {
    const movement: Partial<StockMovement> = {
      productId: "product-1",
      qty: 10,
      date: "2024-01-15T10:00:00.000Z",
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Movement type is required");
  });

  it("should fail validation when date is missing", () => {
    const movement: Partial<StockMovement> = {
      productId: "product-1",
      type: "in",
      qty: 10,
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Movement date is required");
  });

  it("should fail validation when quantity is invalid for movement type", () => {
    const movement: Partial<StockMovement> = {
      productId: "product-1",
      type: "in",
      qty: -5,
      date: "2024-01-15T10:00:00.000Z",
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("positive"))).toBe(true);
  });

  it("should accumulate multiple validation errors", () => {
    const movement: Partial<StockMovement> = {
      qty: 0,
      type: "adjust",
    };

    const result = validateStockMovement(movement);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
