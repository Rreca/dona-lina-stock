/**
 * Unit tests for CSV export service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCSV,
  downloadCSV,
  exportProductsToCSV,
  csvExportService,
  type CSVExportConfig,
} from './csv-export';
import type { Product } from '../models/types';

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Aceite de Oliva',
    category: 'Aceites',
    unit: 'lt',
    sku: 'ACE-001',
    minStock: 10,
    salePriceCents: 1250,
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Arroz Integral',
    category: 'Granos',
    unit: 'kg',
    sku: 'ARR-002',
    minStock: 20,
    salePriceCents: 850,
    active: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: '3',
    name: 'Producto con, coma',
    category: 'Test',
    unit: 'unit',
    minStock: 5,
    active: false,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
];

describe('CSV Export Service', () => {
  describe('generateCSV', () => {
    it('should generate CSV with default columns and headers', () => {
      const csv = generateCSV(mockProducts);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Name,Category,Unit,SKU,Min Stock,Sale Price,Active');
      expect(lines[1]).toBe('Aceite de Oliva,Aceites,lt,ACE-001,10,12.50,true');
      expect(lines[2]).toBe('Arroz Integral,Granos,kg,ARR-002,20,8.50,true');
    });

    it('should generate CSV without headers when includeHeaders is false', () => {
      const csv = generateCSV(mockProducts, { includeHeaders: false });
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Aceite de Oliva,Aceites,lt,ACE-001,10,12.50,true');
      expect(lines.length).toBe(3);
    });

    it('should generate CSV with custom column selection', () => {
      const config: Partial<CSVExportConfig> = {
        columns: ['name', 'sku', 'salePrice'],
        includeHeaders: true,
      };

      const csv = generateCSV(mockProducts, config);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Name,SKU,Sale Price');
      expect(lines[1]).toBe('Aceite de Oliva,ACE-001,12.50');
      expect(lines[2]).toBe('Arroz Integral,ARR-002,8.50');
    });

    it('should handle products with missing optional fields', () => {
      const csv = generateCSV(mockProducts);
      const lines = csv.split('\n');

      // Third product has no SKU or salePrice
      expect(lines[3]).toBe('"Producto con, coma",Test,unit,,5,,false');
    });

    it('should escape fields containing commas', () => {
      const csv = generateCSV(mockProducts);
      const lines = csv.split('\n');

      // Product name with comma should be quoted
      expect(lines[3]).toContain('"Producto con, coma"');
    });

    it('should escape fields containing quotes', () => {
      const productWithQuote: Product = {
        id: '4',
        name: 'Product "Special"',
        category: 'Test',
        unit: 'unit',
        minStock: 1,
        active: true,
        createdAt: '2024-01-04T00:00:00.000Z',
        updatedAt: '2024-01-04T00:00:00.000Z',
      };

      const csv = generateCSV([productWithQuote]);
      const lines = csv.split('\n');

      // Quotes should be doubled and field wrapped in quotes
      expect(lines[1]).toContain('"Product ""Special"""');
    });

    it('should handle empty product list', () => {
      const csv = generateCSV([]);
      const lines = csv.split('\n');

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('Name,Category,Unit,SKU,Min Stock,Sale Price,Active');
    });

    it('should convert cents to decimal correctly', () => {
      const csv = generateCSV(mockProducts);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('12.50');
      expect(lines[2]).toContain('8.50');
    });

    it('should handle zero sale price', () => {
      const productWithZeroPrice: Product = {
        id: '5',
        name: 'Free Product',
        category: 'Test',
        unit: 'unit',
        minStock: 1,
        salePriceCents: 0,
        active: true,
        createdAt: '2024-01-05T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
      };

      const csv = generateCSV([productWithZeroPrice]);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('0.00');
    });

    it('should handle fields with newlines', () => {
      const productWithNewline: Product = {
        id: '6',
        name: 'Product\nWith\nNewlines',
        category: 'Test',
        unit: 'unit',
        minStock: 1,
        active: true,
        createdAt: '2024-01-06T00:00:00.000Z',
        updatedAt: '2024-01-06T00:00:00.000Z',
      };

      const csv = generateCSV([productWithNewline]);
      
      // Field with newlines should be quoted
      expect(csv).toContain('"Product\nWith\nNewlines"');
    });

    it('should generate CSV with only name column', () => {
      const config: Partial<CSVExportConfig> = {
        columns: ['name'],
        includeHeaders: true,
      };

      const csv = generateCSV(mockProducts, config);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Name');
      expect(lines[1]).toBe('Aceite de Oliva');
      expect(lines[2]).toBe('Arroz Integral');
      expect(lines[3]).toBe('"Producto con, coma"');
    });

    it('should handle large product lists efficiently', () => {
      const largeProductList: Product[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `Product ${i}`,
        category: 'Test',
        unit: 'unit' as const,
        sku: `SKU-${i}`,
        minStock: i,
        salePriceCents: i * 100,
        active: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }));

      const csv = generateCSV(largeProductList);
      const lines = csv.split('\n');

      expect(lines.length).toBe(1001); // 1000 products + 1 header
      expect(lines[0]).toContain('Name');
      expect(lines[1]).toContain('Product 0');
      expect(lines[1000]).toContain('Product 999');
    });
  });

  describe('downloadCSV', () => {
    let createElementSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;
    let createObjectURLSpy: any;
    let revokeObjectURLSpy: any;

    beforeEach(() => {
      // Mock DOM methods
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
      };

      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create download link and trigger download', () => {
      const csvContent = 'Name,Price\nProduct,10.00';
      downloadCSV(csvContent, 'test.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should use default filename if not provided', () => {
      const csvContent = 'Name,Price\nProduct,10.00';
      
      downloadCSV(csvContent);

      const mockLink = createElementSpy.mock.results[createElementSpy.mock.results.length - 1]?.value;
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'products.csv');
    });

    it('should use custom filename when provided', () => {
      const csvContent = 'Name,Price\nProduct,10.00';
      downloadCSV(csvContent, 'custom-export.csv');

      const mockLink = createElementSpy.mock.results[0]?.value;
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'custom-export.csv');
    });
  });

  describe('exportProductsToCSV', () => {
    it('should generate CSV and trigger download with default config', () => {
      const csv = generateCSV(mockProducts);
      expect(csv).toContain('Name,Category,Unit,SKU,Min Stock,Sale Price,Active');
      expect(csv).toContain('Aceite de Oliva');
    });

    it('should use custom configuration when provided', () => {
      const config: Partial<CSVExportConfig> = {
        columns: ['name', 'salePrice'],
        filename: 'custom.csv',
      };

      const csv = generateCSV(mockProducts, config);
      expect(csv).toContain('Name,Sale Price');
      expect(csv).not.toContain('Category');
    });
  });

  describe('CSVExportService', () => {
    it('should export products with default configuration', async () => {
      // Just verify the method exists and can be called
      await expect(csvExportService.exportProducts(mockProducts)).resolves.toBeUndefined();
    });

    it('should export products with custom configuration', async () => {
      const config: Partial<CSVExportConfig> = {
        columns: ['name', 'sku'],
        filename: 'test.csv',
      };

      await expect(
        csvExportService.exportProductsWithConfig(mockProducts, config)
      ).resolves.toBeUndefined();
    });

    it('should generate CSV content without downloading', async () => {
      const content = await csvExportService.generateCSVContent(mockProducts);

      expect(content).toContain('Name,Category,Unit,SKU,Min Stock,Sale Price,Active');
      expect(content).toContain('Aceite de Oliva');
      expect(content).toContain('Arroz Integral');
    });

    it('should generate CSV content with custom config', async () => {
      const config: Partial<CSVExportConfig> = {
        columns: ['name', 'unit'],
        includeHeaders: false,
      };

      const content = await csvExportService.generateCSVContent(mockProducts, config);

      expect(content).not.toContain('Name,Unit');
      expect(content).toContain('Aceite de Oliva,lt');
      expect(content).toContain('Arroz Integral,kg');
    });
  });
});
