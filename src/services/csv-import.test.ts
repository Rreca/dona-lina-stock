/**
 * Unit tests for CSV import service
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseCSV,
  parseProductFromRow,
  detectConflicts,
  previewCSVImport,
  csvImportService,
  type CSVRow,
  type ParsedProduct,
} from './csv-import';
import type { Product } from '../models/types';

// Mock products for testing
const mockExistingProducts: Product[] = [
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
];

describe('CSV Import Service', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV with headers', () => {
      const csv = 'Name,Category,Unit\nProduct 1,Cat 1,lt\nProduct 2,Cat 2,kg';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        name: 'Product 1',
        category: 'Cat 1',
        unit: 'lt',
      });
      expect(rows[1]).toEqual({
        name: 'Product 2',
        category: 'Cat 2',
        unit: 'kg',
      });
    });

    it('should handle quoted fields with commas', () => {
      const csv = 'Name,Category\n"Product, Special",Category 1';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Product, Special');
    });

    it('should handle escaped quotes', () => {
      const csv = 'Name,Category\n"Product ""Special""",Category 1';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Product "Special"');
    });

    it('should handle empty fields', () => {
      const csv = 'Name,Category,SKU\nProduct 1,Cat 1,\nProduct 2,,SKU-2';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0].sku).toBe('');
      expect(rows[1].category).toBe('');
    });

    it('should skip empty lines', () => {
      const csv = 'Name,Category\nProduct 1,Cat 1\n\nProduct 2,Cat 2';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(2);
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(0);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'Name,Category,Unit';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(0);
    });

    it('should handle CSV with whitespace in headers', () => {
      const csv = ' Name , Category , Unit \nProduct 1,Cat 1,lt';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('name');
      expect(rows[0]).toHaveProperty('category');
      expect(rows[0]).toHaveProperty('unit');
    });

    it('should handle CSV with trailing commas', () => {
      const csv = 'Name,Category,Unit,\nProduct 1,Cat 1,lt,';
      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Product 1');
    });
  });

  describe('parseProductFromRow', () => {
    it('should parse valid product row', () => {
      const row: CSVRow = {
        name: 'Test Product',
        category: 'Test Category',
        unit: 'lt',
        sku: 'TEST-001',
        'min stock': '5',
        'sale price': '10.50',
        active: 'true',
      };

      const result = parseProductFromRow(row, 1);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.product).toEqual({
        name: 'Test Product',
        category: 'Test Category',
        unit: 'lt',
        sku: 'TEST-001',
        minStock: 5,
        salePriceCents: 1050,
        active: true,
      });
    });

    it('should handle Spanish column names', () => {
      const row: CSVRow = {
        nombre: 'Producto Test',
        categoría: 'Categoría Test',
        unidad: 'kg',
        código: 'TEST-002',
        mínimo: '10',
        precio: '20.00',
        activo: 'true',
      };

      const result = parseProductFromRow(row, 1);

      expect(result.valid).toBe(true);
      expect(result.product?.name).toBe('Producto Test');
      expect(result.product?.unit).toBe('kg');
    });

    it('should validate required fields', () => {
      const row: CSVRow = {
        category: 'Test',
        unit: 'lt',
      };

      const result = parseProductFromRow(row, 1);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should validate unit type', () => {
      const row: CSVRow = {
        name: 'Test',
        category: 'Test',
        unit: 'invalid',
      };

      const result = parseProductFromRow(row, 1);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid unit'))).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const row: CSVRow = {
        name: 'Test Product',
        category: 'Test',
        unit: 'unit',
      };

      const result = parseProductFromRow(row, 1);

      expect(result.valid).toBe(true);
      expect(result.product?.sku).toBeUndefined();
      expect(result.product?.salePriceCents).toBeUndefined();
      expect(result.product?.minStock).toBe(0);
      expect(result.product?.active).toBe(true);
    });

    it('should parse boolean values correctly', () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'false', expected: false },
        { input: '1', expected: true },
        { input: '0', expected: false },
        { input: 'yes', expected: true },
        { input: 'no', expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const row: CSVRow = {
          name: 'Test',
          category: 'Test',
          unit: 'unit',
          active: input,
        };

        const result = parseProductFromRow(row, 1);
        expect(result.product?.active).toBe(expected);
      });
    });

    it('should convert decimal prices to cents', () => {
      const testCases = [
        { input: '10.50', expected: 1050 },
        { input: '0.99', expected: 99 },
        { input: '100', expected: 10000 },
        { input: '5.5', expected: 550 },
      ];

      testCases.forEach(({ input, expected }) => {
        const row: CSVRow = {
          name: 'Test',
          category: 'Test',
          unit: 'unit',
          'sale price': input,
        };

        const result = parseProductFromRow(row, 1);
        expect(result.product?.salePriceCents).toBe(expected);
      });
    });

    it('should handle invalid price formats', () => {
      const row: CSVRow = {
        name: 'Test',
        category: 'Test',
        unit: 'unit',
        'sale price': 'invalid',
      };

      const result = parseProductFromRow(row, 1);
      expect(result.valid).toBe(true);
      expect(result.product?.salePriceCents).toBeUndefined();
    });

    it('should handle negative min stock', () => {
      const row: CSVRow = {
        name: 'Test',
        category: 'Test',
        unit: 'unit',
        'min stock': '-5',
      };

      const result = parseProductFromRow(row, 1);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid min stock'))).toBe(true);
    });

    it('should trim whitespace from all fields', () => {
      const row: CSVRow = {
        name: '  Test Product  ',
        category: '  Test Category  ',
        unit: 'lt',
        sku: '  TEST-001  ',
      };

      const result = parseProductFromRow(row, 1);
      expect(result.valid).toBe(true);
      expect(result.product?.name).toBe('Test Product');
      expect(result.product?.category).toBe('Test Category');
      expect(result.product?.sku).toBe('TEST-001');
    });
  });

  describe('detectConflicts', () => {
    it('should detect SKU conflicts', () => {
      const parsedProducts: ParsedProduct[] = [
        {
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          sku: 'ACE-001', // Conflicts with existing
          minStock: 5,
          active: true,
        },
      ];

      const conflicts = detectConflicts(parsedProducts, mockExistingProducts);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].sku).toBe('ACE-001');
      expect(conflicts[0].existingProduct.id).toBe('1');
    });

    it('should handle case-insensitive SKU matching', () => {
      const parsedProducts: ParsedProduct[] = [
        {
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          sku: 'ace-001', // Lowercase version
          minStock: 5,
          active: true,
        },
      ];

      const conflicts = detectConflicts(parsedProducts, mockExistingProducts);

      expect(conflicts).toHaveLength(1);
    });

    it('should not detect conflicts for products without SKU', () => {
      const parsedProducts: ParsedProduct[] = [
        {
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          minStock: 5,
          active: true,
        },
      ];

      const conflicts = detectConflicts(parsedProducts, mockExistingProducts);

      expect(conflicts).toHaveLength(0);
    });

    it('should not detect conflicts for unique SKUs', () => {
      const parsedProducts: ParsedProduct[] = [
        {
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          sku: 'NEW-001',
          minStock: 5,
          active: true,
        },
      ];

      const conflicts = detectConflicts(parsedProducts, mockExistingProducts);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect multiple conflicts', () => {
      const parsedProducts: ParsedProduct[] = [
        {
          name: 'Product 1',
          category: 'Test',
          unit: 'lt',
          sku: 'ACE-001',
          minStock: 5,
          active: true,
        },
        {
          name: 'Product 2',
          category: 'Test',
          unit: 'kg',
          sku: 'ARR-002',
          minStock: 10,
          active: true,
        },
      ];

      const conflicts = detectConflicts(parsedProducts, mockExistingProducts);

      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].sku).toBe('ACE-001');
      expect(conflicts[1].sku).toBe('ARR-002');
    });

    it('should handle empty product lists', () => {
      const conflicts = detectConflicts([], mockExistingProducts);
      expect(conflicts).toHaveLength(0);

      const conflicts2 = detectConflicts(
        [
          {
            name: 'Test',
            category: 'Test',
            unit: 'lt',
            sku: 'TEST-001',
            minStock: 5,
            active: true,
          },
        ],
        []
      );
      expect(conflicts2).toHaveLength(0);
    });
  });

  describe('previewCSVImport', () => {
    it('should preview valid CSV import', () => {
      const csv = 'Name,Category,Unit,SKU,Min Stock,Sale Price,Active\nNew Product,Test,lt,NEW-001,5,10.50,true';
      
      const preview = previewCSVImport(csv, mockExistingProducts);

      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(1);
      expect(preview.invalidRows).toBe(0);
      expect(preview.conflicts).toHaveLength(0);
      expect(preview.parsedProducts).toHaveLength(1);
    });

    it('should detect validation errors', () => {
      const csv = 'Name,Category,Unit\n,Test,lt\nProduct 2,Test,invalid';
      
      const preview = previewCSVImport(csv, mockExistingProducts);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows).toBe(0);
      expect(preview.invalidRows).toBe(2);
    });

    it('should detect conflicts in preview', () => {
      const csv = 'Name,Category,Unit,SKU\nNew Product,Test,lt,ACE-001';
      
      const preview = previewCSVImport(csv, mockExistingProducts);

      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].sku).toBe('ACE-001');
    });

    it('should handle mixed valid and invalid rows in preview', () => {
      const csv = 'Name,Category,Unit\nValid Product,Test,lt\n,Invalid,lt\nAnother Valid,Test,kg';
      
      const preview = previewCSVImport(csv, mockExistingProducts);

      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(2);
      expect(preview.invalidRows).toBe(1);
      expect(preview.parsedProducts).toHaveLength(2);
    });

    it('should handle empty CSV in preview', () => {
      const csv = '';
      
      const preview = previewCSVImport(csv, mockExistingProducts);

      expect(preview.totalRows).toBe(0);
      expect(preview.validRows).toBe(0);
      expect(preview.invalidRows).toBe(0);
    });
  });

  describe('CSVImportService', () => {
    describe('preview', () => {
      it('should preview CSV import', async () => {
        const csv = 'Name,Category,Unit\nNew Product,Test,lt';
        
        const preview = await csvImportService.preview(csv, mockExistingProducts);

        expect(preview.totalRows).toBe(1);
        expect(preview.validRows).toBe(1);
      });
    });

    describe('import', () => {
      it('should import new products without conflicts', async () => {
        const csv = 'Name,Category,Unit,SKU\nNew Product,Test,lt,NEW-001';
        
        const onCreate = vi.fn().mockResolvedValue({
          id: '3',
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          sku: 'NEW-001',
          minStock: 0,
          active: true,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        });
        const onUpdate = vi.fn();

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'skip',
          onCreate,
          onUpdate
        );

        expect(result.success).toBe(true);
        expect(result.imported).toBe(1);
        expect(result.updated).toBe(0);
        expect(result.skipped).toBe(0);
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onUpdate).not.toHaveBeenCalled();
      });

      it('should skip conflicts when resolution is "skip"', async () => {
        const csv = 'Name,Category,Unit,SKU\nUpdated Product,Test,lt,ACE-001';
        
        const onCreate = vi.fn();
        const onUpdate = vi.fn();

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'skip',
          onCreate,
          onUpdate
        );

        expect(result.imported).toBe(0);
        expect(result.updated).toBe(0);
        expect(result.skipped).toBe(1);
        expect(onCreate).not.toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();
      });

      it('should update conflicts when resolution is "update"', async () => {
        const csv = 'Name,Category,Unit,SKU\nUpdated Product,Test,lt,ACE-001';
        
        const onCreate = vi.fn();
        const onUpdate = vi.fn().mockResolvedValue({
          ...mockExistingProducts[0],
          name: 'Updated Product',
        });

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'update',
          onCreate,
          onUpdate
        );

        expect(result.imported).toBe(0);
        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(0);
        expect(onCreate).not.toHaveBeenCalled();
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it('should handle import errors gracefully', async () => {
        const csv = 'Name,Category,Unit,SKU\nNew Product,Test,lt,NEW-001';
        
        const onCreate = vi.fn().mockRejectedValue(new Error('Database error'));
        const onUpdate = vi.fn();

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'skip',
          onCreate,
          onUpdate
        );

        expect(result.success).toBe(false);
        expect(result.imported).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].errors[0]).toContain('Import failed');
      });

      it('should handle mixed valid and invalid rows', async () => {
        const csv = 'Name,Category,Unit,SKU\nValid Product,Test,lt,NEW-001\n,Invalid,lt,NEW-002\nAnother Valid,Test,kg,NEW-003';
        
        const onCreate = vi.fn().mockResolvedValue({
          id: '3',
          name: 'New Product',
          category: 'Test',
          unit: 'lt',
          sku: 'NEW-001',
          minStock: 0,
          active: true,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        });
        const onUpdate = vi.fn();

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'skip',
          onCreate,
          onUpdate
        );

        expect(result.imported).toBe(2);
        expect(result.errors).toHaveLength(1);
        expect(result.success).toBe(false);
      });

      it('should handle multiple conflicts with different resolutions', async () => {
        const csv = 'Name,Category,Unit,SKU\nUpdated 1,Test,lt,ACE-001\nUpdated 2,Test,kg,ARR-002';
        
        const onCreate = vi.fn();
        const onUpdate = vi.fn().mockResolvedValue({
          id: '1',
          name: 'Updated',
          category: 'Test',
          unit: 'lt',
          sku: 'ACE-001',
          minStock: 0,
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        });

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'update',
          onCreate,
          onUpdate
        );

        expect(result.updated).toBe(2);
        expect(result.imported).toBe(0);
        expect(result.skipped).toBe(0);
        expect(onUpdate).toHaveBeenCalledTimes(2);
      });

      it('should handle update errors gracefully', async () => {
        const csv = 'Name,Category,Unit,SKU\nUpdated Product,Test,lt,ACE-001';
        
        const onCreate = vi.fn();
        const onUpdate = vi.fn().mockRejectedValue(new Error('Update failed'));

        const result = await csvImportService.import(
          csv,
          mockExistingProducts,
          'update',
          onCreate,
          onUpdate
        );

        expect(result.success).toBe(false);
        expect(result.updated).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].errors[0]).toContain('Update failed');
      });
    });

    describe('readFile', () => {
      it('should read file content', async () => {
        const csvContent = 'Name,Category\nProduct,Test';
        const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

        const content = await csvImportService.readFile(file);

        expect(content).toBe(csvContent);
      });
    });
  });
});
