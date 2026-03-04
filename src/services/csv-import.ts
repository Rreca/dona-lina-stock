/**
 * CSV import service with validation and conflict resolution
 * Supports parsing, preview, and importing product data from CSV files
 */

import type { Product, Unit } from '../models/types';

/**
 * CSV import row (raw data from CSV)
 */
export interface CSVRow {
  [key: string]: string;
}

/**
 * Parsed product data from CSV
 */
export interface ParsedProduct {
  name: string;
  category: string;
  unit: Unit;
  sku?: string;
  minStock: number;
  salePriceCents?: number;
  active: boolean;
}

/**
 * Validation result for a parsed product
 */
export interface ProductValidationResult {
  valid: boolean;
  errors: string[];
  product?: ParsedProduct;
  rowIndex: number;
}

/**
 * Conflict type for existing products
 */
export type ConflictResolution = 'update' | 'skip';

/**
 * Conflict detected during import
 */
export interface ImportConflict {
  rowIndex: number;
  sku: string;
  existingProduct: Product;
  newProduct: ParsedProduct;
}

/**
 * CSV import result
 */
export interface CSVImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: ProductValidationResult[];
  conflicts: ImportConflict[];
}

/**
 * CSV import preview
 */
export interface CSVImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  conflicts: ImportConflict[];
  validationResults: ProductValidationResult[];
  parsedProducts: ParsedProduct[];
}

/**
 * Parse CSV content into rows
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue; // Skip empty lines
    
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase().trim()] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quotes and commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Parse decimal string to cents (e.g., "10.50" -> 1050)
 */
function decimalToCents(value: string): number | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return undefined;
  }

  return Math.round(parsed * 100);
}

/**
 * Parse boolean string
 */
function parseBoolean(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Validate unit type
 */
function isValidUnit(value: string): value is Unit {
  return value === 'lt' || value === 'kg' || value === 'unit';
}

/**
 * Parse CSV row into product data
 */
export function parseProductFromRow(row: CSVRow, rowIndex: number): ProductValidationResult {
  const errors: string[] = [];

  // Extract and validate required fields
  const name = row['name'] || row['nombre'];
  if (!name || name.trim() === '') {
    errors.push('Name is required');
  }

  const category = row['category'] || row['categoría'] || row['categoria'] || '';
  if (!category || category.trim() === '') {
    errors.push('Category is required');
  }

  const unitStr = (row['unit'] || row['unidad'] || '').toLowerCase();
  if (!isValidUnit(unitStr)) {
    errors.push(`Invalid unit: ${unitStr}. Must be 'lt', 'kg', or 'unit'`);
  }

  // Parse optional fields
  const sku = row['sku'] || row['código'] || row['codigo'] || undefined;
  
  const minStockStr = row['min stock'] || row['minstock'] || row['mínimo'] || row['minimo'] || '0';
  const minStock = parseInt(minStockStr, 10);
  if (isNaN(minStock) || minStock < 0) {
    errors.push(`Invalid min stock: ${minStockStr}`);
  }

  const salePriceStr = row['sale price'] || row['saleprice'] || row['precio'] || '';
  const salePriceCents = decimalToCents(salePriceStr);

  const activeStr = row['active'] || row['activo'] || 'true';
  const active = parseBoolean(activeStr);

  // Return validation result
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      rowIndex,
    };
  }

  const product: ParsedProduct = {
    name: name.trim(),
    category: category.trim(),
    unit: unitStr as Unit,
    sku: sku && sku.trim() !== '' ? sku.trim() : undefined,
    minStock,
    salePriceCents,
    active,
  };

  return {
    valid: true,
    errors: [],
    product,
    rowIndex,
  };
}

/**
 * Detect conflicts with existing products (by SKU)
 */
export function detectConflicts(
  parsedProducts: ParsedProduct[],
  existingProducts: Product[]
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const existingBySku = new Map<string, Product>();

  // Build SKU index
  existingProducts.forEach((product) => {
    if (product.sku) {
      existingBySku.set(product.sku.toLowerCase(), product);
    }
  });

  // Check for conflicts
  parsedProducts.forEach((newProduct, index) => {
    if (newProduct.sku) {
      const existing = existingBySku.get(newProduct.sku.toLowerCase());
      if (existing) {
        conflicts.push({
          rowIndex: index + 1, // +1 for header row
          sku: newProduct.sku,
          existingProduct: existing,
          newProduct,
        });
      }
    }
  });

  return conflicts;
}

/**
 * Preview CSV import without applying changes
 */
export function previewCSVImport(
  csvContent: string,
  existingProducts: Product[]
): CSVImportPreview {
  const rows = parseCSV(csvContent);
  const validationResults: ProductValidationResult[] = [];
  const parsedProducts: ParsedProduct[] = [];

  // Parse and validate each row
  rows.forEach((row, index) => {
    const result = parseProductFromRow(row, index + 1); // +1 for header row
    validationResults.push(result);

    if (result.valid && result.product) {
      parsedProducts.push(result.product);
    }
  });

  // Detect conflicts
  const conflicts = detectConflicts(parsedProducts, existingProducts);

  const validRows = validationResults.filter((r) => r.valid).length;
  const invalidRows = validationResults.filter((r) => !r.valid).length;

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    conflicts,
    validationResults,
    parsedProducts,
  };
}

/**
 * CSV import service
 */
export class CSVImportService {
  /**
   * Preview CSV import
   */
  async preview(csvContent: string, existingProducts: Product[]): Promise<CSVImportPreview> {
    return previewCSVImport(csvContent, existingProducts);
  }

  /**
   * Import products from CSV with conflict resolution
   */
  async import(
    csvContent: string,
    existingProducts: Product[],
    conflictResolution: ConflictResolution = 'skip',
    onProductCreate: (product: ParsedProduct) => Promise<Product>,
    onProductUpdate: (existingId: string, updates: Partial<Product>) => Promise<Product>
  ): Promise<CSVImportResult> {
    const preview = await this.preview(csvContent, existingProducts);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: ProductValidationResult[] = [];

    // Build conflict map for quick lookup
    const conflictMap = new Map<number, ImportConflict>();
    preview.conflicts.forEach((conflict) => {
      conflictMap.set(conflict.rowIndex, conflict);
    });

    // Process each valid product
    for (const result of preview.validationResults) {
      if (!result.valid || !result.product) {
        errors.push(result);
        continue;
      }

      const conflict = conflictMap.get(result.rowIndex);

      if (conflict) {
        // Handle conflict
        if (conflictResolution === 'update') {
          try {
            await onProductUpdate(conflict.existingProduct.id, result.product);
            updated++;
          } catch (error) {
            errors.push({
              ...result,
              valid: false,
              errors: [`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            });
          }
        } else {
          // Skip
          skipped++;
        }
      } else {
        // No conflict, create new product
        try {
          await onProductCreate(result.product);
          imported++;
        } catch (error) {
          errors.push({
            ...result,
            valid: false,
            errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      imported,
      updated,
      skipped,
      errors,
      conflicts: preview.conflicts,
    };
  }

  /**
   * Read CSV file from File object
   */
  async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        resolve(content);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const csvImportService = new CSVImportService();
