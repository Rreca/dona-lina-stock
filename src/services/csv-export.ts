/**
 * CSV export service for product data
 * Supports configurable column selection and browser download
 */

import type { Product, Cents } from '../models/types';

/**
 * Available columns for CSV export
 */
export type CSVColumn =
  | 'name'
  | 'category'
  | 'unit'
  | 'sku'
  | 'minStock'
  | 'salePrice'
  | 'active';

/**
 * CSV export configuration
 */
export interface CSVExportConfig {
  columns: CSVColumn[];
  includeHeaders?: boolean;
  filename?: string;
}

/**
 * Default export configuration
 */
const DEFAULT_CONFIG: CSVExportConfig = {
  columns: ['name', 'category', 'unit', 'sku', 'minStock', 'salePrice', 'active'],
  includeHeaders: true,
  filename: 'products.csv',
};

/**
 * Column headers mapping
 */
const COLUMN_HEADERS: Record<CSVColumn, string> = {
  name: 'Name',
  category: 'Category',
  unit: 'Unit',
  sku: 'SKU',
  minStock: 'Min Stock',
  salePrice: 'Sale Price',
  active: 'Active',
};

/**
 * Convert cents to decimal string (e.g., 1050 -> "10.50")
 */
function centsToDecimal(cents: Cents | undefined): string {
  if (cents === undefined || cents === null) {
    return '';
  }
  return (cents / 100).toFixed(2);
}

/**
 * Escape CSV field value
 * Wraps in quotes if contains comma, quote, or newline
 */
function escapeCSVField(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }

  const stringValue = String(value);
  
  // Check if field needs quoting
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Extract field value from product based on column
 */
function extractFieldValue(product: Product, column: CSVColumn): string {
  switch (column) {
    case 'name':
      return escapeCSVField(product.name);
    case 'category':
      return escapeCSVField(product.category);
    case 'unit':
      return escapeCSVField(product.unit);
    case 'sku':
      return escapeCSVField(product.sku);
    case 'minStock':
      return escapeCSVField(product.minStock);
    case 'salePrice':
      return escapeCSVField(centsToDecimal(product.salePriceCents));
    case 'active':
      return escapeCSVField(product.active);
    default:
      return '';
  }
}

/**
 * Generate CSV content from products
 */
export function generateCSV(products: Product[], config: Partial<CSVExportConfig> = {}): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const lines: string[] = [];

  // Add headers if requested
  if (finalConfig.includeHeaders) {
    const headers = finalConfig.columns.map((col) => COLUMN_HEADERS[col]);
    lines.push(headers.join(','));
  }

  // Add product rows
  for (const product of products) {
    const row = finalConfig.columns.map((col) => extractFieldValue(product, col));
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'products.csv'): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export products to CSV and trigger download
 */
export function exportProductsToCSV(
  products: Product[],
  config: Partial<CSVExportConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const csvContent = generateCSV(products, finalConfig);
  downloadCSV(csvContent, finalConfig.filename);
}

/**
 * CSV export service
 */
export class CSVExportService {
  /**
   * Export products with default configuration
   */
  async exportProducts(products: Product[]): Promise<void> {
    exportProductsToCSV(products);
  }

  /**
   * Export products with custom configuration
   */
  async exportProductsWithConfig(
    products: Product[],
    config: Partial<CSVExportConfig>
  ): Promise<void> {
    exportProductsToCSV(products, config);
  }

  /**
   * Generate CSV content without downloading
   */
  async generateCSVContent(
    products: Product[],
    config: Partial<CSVExportConfig> = {}
  ): Promise<string> {
    return generateCSV(products, config);
  }
}

// Export singleton instance
export const csvExportService = new CSVExportService();
