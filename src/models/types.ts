/**
 * Core domain types for Doña Lina Stock
 * All monetary values are stored as integers (cents) to avoid floating-point errors
 */

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Monetary value in cents (integer)
 * Example: $10.50 = 1050 cents
 */
export type Cents = number;

/**
 * ISO 8601 date string
 * Example: "2024-01-15T10:30:00.000Z"
 */
export type ISODateString = string;

/**
 * UUID string identifier
 */
export type UUID = string;

// ============================================================================
// Enums and Union Types
// ============================================================================

/**
 * Product unit types
 */
export type Unit = "lt" | "kg" | "unit";

/**
 * Stock movement types
 */
export type MovementType = "in" | "out" | "adjust";

/**
 * Cost calculation methods
 */
export type CostMethod = "last" | "weighted_avg";

/**
 * Weighted average window types
 */
export type WeightedAvgWindowType = "last_n_purchases" | "last_days";

// ============================================================================
// Domain Models
// ============================================================================

/**
 * Product in the catalog
 */
export interface Product {
  id: UUID;
  name: string;
  category: string;
  unit: Unit;
  sku?: string;
  minStock: number;
  salePriceCents?: Cents;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // 5L jug support fields
  packSizeLiters?: number;      // Volume of one jug unit (default: 5)
  containerSku?: string;         // SKU of the container product (e.g., "BIDON-5L")
  jugSalePriceCents?: Cents;    // Sale price per jug (for LXL products)
  // 1L bottle support fields
  bottleSku?: string;            // SKU of the bottle product (e.g., "BP-3")
  bottleSalePriceCents?: Cents;  // Sale price per 1L bottle (for LXL products)
}

/**
 * Supplier information
 */
export interface Supplier {
  id: UUID;
  name: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Stock movement event (immutable)
 */
export interface StockMovement {
  id: UUID;
  date: ISODateString;
  productId: UUID;
  type: MovementType;
  qty: number;
  note?: string;
  createdAt: ISODateString;
}

/**
 * Purchase item within a purchase
 */
export interface PurchaseItem {
  productId: UUID;
  qty: number;
  unitCostCents: Cents;
}

/**
 * Purchase from supplier (immutable)
 */
export interface Purchase {
  id: UUID;
  date: ISODateString;
  supplierId: UUID;
  items: PurchaseItem[];
  note?: string;
  createdAt: ISODateString;
}

/**
 * Weighted average window configuration
 */
export interface WeightedAvgWindow {
  type: WeightedAvgWindowType;
  value: number;
}

/**
 * Price suggestion rule configuration
 */
export interface PriceRule {
  markupPct: number;
  roundToCents: number;
  minMarginPct?: number;
}

/**
 * Application settings
 */
export interface Settings {
  costMethod: CostMethod;
  weightedAvgWindow: WeightedAvgWindow;
  priceRule: PriceRule;
}

// ============================================================================
// Persistence Models (Gist file structures)
// ============================================================================

/**
 * products.json structure
 */
export interface ProductsFile {
  products: Product[];
}

/**
 * suppliers.json structure
 */
export interface SuppliersFile {
  suppliers: Supplier[];
}

/**
 * movements_YYYY_MM.json structure
 */
export interface MovementsFile {
  movements: StockMovement[];
}

/**
 * purchases_YYYY_MM.json structure
 */
export interface PurchasesFile {
  purchases: Purchase[];
}

/**
 * Stock snapshot for a specific month
 */
export interface StockSnapshot {
  stockByProduct: Record<UUID, number>;
  updatedAt: ISODateString;
}

/**
 * meta.json structure
 */
export interface MetaFile {
  schemaVersion: string;
  lastSyncAt: ISODateString;
  snapshots: Record<string, StockSnapshot>; // key: "YYYY-MM"
}

// ============================================================================
// 5L Jug Support Utilities
// ============================================================================

/**
 * Check if a product is an LXL product (5L jug product)
 * LXL products have SKUs starting with "LXL-" (case-sensitive)
 */
export function isLXLProduct(product: Product): boolean {
  return product.sku?.startsWith('LXL-') ?? false;
}

/**
 * Get pack size for a product
 * Returns packSizeLiters if defined, otherwise returns default of 5
 */
export function getPackSize(product: Product): number {
  return product.packSizeLiters ?? 5;
}

/**
 * Convert liters to jug quantity
 */
export function convertToJugs(liters: number, packSize: number): number {
  return liters / packSize;
}

/**
 * Format jug quantity for display with 2 decimal places
 */
export function formatJugQuantity(jugs: number): string {
  return `${jugs.toFixed(2)} bidones`;
}

/**
 * Generate container SKU for LXL products
 * Format: {productSku}-BIDON-5L
 */
export function generateContainerSku(productSku: string): string {
  return `${productSku}-BIDON-5L`;
}

/**
 * Generate bottle SKU for LXL products
 * Format: {productSku}-BOTELLA-1L
 */
export function generateBottleSku(productSku: string): string {
  return `${productSku}-BOTELLA-1L`;
}
