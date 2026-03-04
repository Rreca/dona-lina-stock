/**
 * Validation utilities for domain models
 */

import type { Product, StockMovement, MovementType } from "./types";

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// Product Validation
// ============================================================================

/**
 * Validates required fields for a product
 */
export function validateProductRequiredFields(
  product: Partial<Product>
): ValidationResult {
  const errors: string[] = [];

  if (!product.name || product.name.trim() === "") {
    errors.push("Product name is required");
  }

  if (!product.unit) {
    errors.push("Product unit is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates SKU uniqueness against existing products
 * @param sku - SKU to validate
 * @param existingProducts - Array of existing products
 * @param excludeProductId - Optional product ID to exclude from check (for updates)
 */
export function validateSkuUniqueness(
  sku: string | undefined,
  existingProducts: Product[],
  excludeProductId?: string
): ValidationResult {
  const errors: string[] = [];

  // SKU is optional, so empty/undefined is valid
  if (!sku || sku.trim() === "") {
    return { valid: true, errors: [] };
  }

  const normalizedSku = sku.trim().toLowerCase();

  const duplicate = existingProducts.find(
    (p) =>
      p.sku &&
      p.sku.trim().toLowerCase() === normalizedSku &&
      p.id !== excludeProductId
  );

  if (duplicate) {
    errors.push(`SKU "${sku}" is already used by product "${duplicate.name}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a complete product
 */
export function validateProduct(
  product: Partial<Product>,
  existingProducts: Product[] = []
): ValidationResult {
  const errors: string[] = [];

  // Required fields
  const requiredFieldsResult = validateProductRequiredFields(product);
  errors.push(...requiredFieldsResult.errors);

  // SKU uniqueness
  if (product.sku) {
    const skuResult = validateSkuUniqueness(
      product.sku,
      existingProducts,
      product.id
    );
    errors.push(...skuResult.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Quantity Validation
// ============================================================================

/**
 * Validates quantity based on movement type
 * - "in": must be positive
 * - "out": must be positive
 * - "adjust": can be positive or negative, but not zero
 */
export function validateMovementQuantity(
  qty: number,
  movementType: MovementType
): ValidationResult {
  const errors: string[] = [];

  if (typeof qty !== "number" || isNaN(qty)) {
    errors.push("Quantity must be a valid number");
    return { valid: false, errors };
  }

  switch (movementType) {
    case "in":
    case "out":
      if (qty <= 0) {
        errors.push(
          `Quantity for "${movementType}" movement must be positive`
        );
      }
      break;

    case "adjust":
      if (qty === 0) {
        errors.push("Quantity for adjustment cannot be zero");
      }
      break;

    default:
      errors.push(`Invalid movement type: ${movementType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates purchase item quantity
 * Must be positive and non-zero
 */
export function validatePurchaseQuantity(qty: number): ValidationResult {
  const errors: string[] = [];

  if (typeof qty !== "number" || isNaN(qty)) {
    errors.push("Quantity must be a valid number");
  } else if (qty <= 0) {
    errors.push("Purchase quantity must be positive");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates stock movement
 */
export function validateStockMovement(
  movement: Partial<StockMovement>
): ValidationResult {
  const errors: string[] = [];

  if (!movement.productId) {
    errors.push("Product ID is required");
  }

  if (!movement.type) {
    errors.push("Movement type is required");
  }

  if (movement.qty !== undefined && movement.type) {
    const qtyResult = validateMovementQuantity(movement.qty, movement.type);
    errors.push(...qtyResult.errors);
  }

  if (!movement.date) {
    errors.push("Movement date is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
