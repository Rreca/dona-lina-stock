/**
 * Unit tests for ProductService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProductService } from './product-service';
import type { Product } from '../models/types';

// Mock the cache service with proper isolation
const mockGetProducts = vi.fn();
const mockSetProducts = vi.fn();

vi.mock('./cache', () => ({
  cacheService: {
    getProducts: () => mockGetProducts(),
    setProducts: (products: Product[]) => mockSetProducts(products),
  },
}));

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    // Reset mocks to return empty array for each test
    mockGetProducts.mockResolvedValue([]);
    mockSetProducts.mockResolvedValue(undefined);
    
    service = new ProductService();
    // Wait for cache to load
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product with valid data', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      };

      const product = await service.create(productData);

      expect(product).toMatchObject(productData);
      expect(product.id).toBeDefined();
      expect(product.createdAt).toBeDefined();
      expect(product.updatedAt).toBeDefined();
    });

    it('should throw error when name is missing', async () => {
      const productData = {
        name: '',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      };

      await expect(service.create(productData)).rejects.toThrow('Product name is required');
    });

    it('should throw error when unit is missing', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test',
        unit: undefined as any,
        minStock: 10,
        active: true,
      };

      await expect(service.create(productData)).rejects.toThrow('Product unit is required');
    });

    it('should create product with optional SKU', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test',
        unit: 'kg' as const,
        sku: 'TEST-001',
        minStock: 5,
        active: true,
      };

      const product = await service.create(productData);

      expect(product.sku).toBe('TEST-001');
    });
  });

  describe('update', () => {
    it('should update product fields', async () => {
      // Create initial product
      const product = await service.create({
        name: 'Original Name',
        category: 'Original Category',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update product
      const updated = await service.update(product.id, {
        name: 'Updated Name',
        category: 'Updated Category',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.category).toBe('Updated Category');
      expect(updated.id).toBe(product.id);
      expect(updated.createdAt).toBe(product.createdAt);
      expect(updated.updatedAt).not.toBe(product.updatedAt);
    });

    it('should throw error when updating non-existent product', async () => {
      await expect(service.update('non-existent-id', { name: 'Test' })).rejects.toThrow(
        'Product with id non-existent-id not found'
      );
    });

    it('should validate SKU uniqueness on update', async () => {
      // Create two products
      const product1 = await service.create({
        name: 'Product 1',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'SKU-001',
        minStock: 10,
        active: true,
      });

      const product2 = await service.create({
        name: 'Product 2',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'SKU-002',
        minStock: 10,
        active: true,
      });

      // Try to update product2 with product1's SKU
      await expect(service.update(product2.id, { sku: 'SKU-001' })).rejects.toThrow(
        'SKU "SKU-001" is already used'
      );
    });
  });

  describe('delete', () => {
    it('should deactivate product', async () => {
      const product = await service.create({
        name: 'Test Product',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await service.delete(product.id);

      const retrieved = await service.getById(product.id);
      expect(retrieved?.active).toBe(false);
    });

    it('should throw error when deleting non-existent product', async () => {
      await expect(service.delete('non-existent-id')).rejects.toThrow(
        'Product with id non-existent-id not found'
      );
    });
  });

  describe('search', () => {
    let searchService: ProductService;

    beforeEach(async () => {
      mockGetProducts.mockResolvedValue([]);
      searchService = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create test products
      await searchService.create({
        name: 'Apple Juice',
        category: 'Beverages',
        unit: 'lt' as const,
        sku: 'BEV-001',
        minStock: 10,
        active: true,
      });

      await searchService.create({
        name: 'Orange Juice',
        category: 'Beverages',
        unit: 'lt' as const,
        sku: 'BEV-002',
        minStock: 10,
        active: true,
      });

      await searchService.create({
        name: 'Apple Pie',
        category: 'Desserts',
        unit: 'unit' as const,
        sku: 'DES-001',
        minStock: 5,
        active: true,
      });
    });

    it('should search by product name', async () => {
      const results = await searchService.search('Apple');
      expect(results).toHaveLength(2);
      expect(results.every((p) => p.name.includes('Apple'))).toBe(true);
    });

    it('should search by SKU', async () => {
      const results = await searchService.search('BEV-001');
      expect(results).toHaveLength(1);
      expect(results[0].sku).toBe('BEV-001');
    });

    it('should search by category', async () => {
      const results = await searchService.search('Beverages');
      expect(results).toHaveLength(2);
      expect(results.every((p) => p.category === 'Beverages')).toBe(true);
    });

    it('should return all products for empty query', async () => {
      const results = await searchService.search('');
      expect(results).toHaveLength(3);
    });

    it('should return empty array for non-matching query', async () => {
      const results = await searchService.search('NonExistent');
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', async () => {
      const results = await searchService.search('apple');
      expect(results).toHaveLength(2);
    });
  });

  describe('filterByActive', () => {
    let filterService: ProductService;

    beforeEach(async () => {
      mockGetProducts.mockResolvedValue([]);
      filterService = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await filterService.create({
        name: 'Active Product',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await filterService.create({
        name: 'Inactive Product',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: false,
      });
    });

    it('should filter active products', async () => {
      const results = await filterService.filterByActive(true);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Active Product');
    });

    it('should filter inactive products', async () => {
      const results = await filterService.filterByActive(false);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Inactive Product');
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', async () => {
      mockGetProducts.mockResolvedValue([]);
      const categoryService = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await categoryService.create({
        name: 'Product 1',
        category: 'Category A',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await categoryService.create({
        name: 'Product 2',
        category: 'Category B',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await categoryService.create({
        name: 'Product 3',
        category: 'Category A',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      const categories = await categoryService.getCategories();
      expect(categories).toEqual(['Category A', 'Category B']);
    });
  });

  describe('SKU uniqueness validation', () => {
    it('should enforce case-insensitive SKU uniqueness on create', async () => {
      await service.create({
        name: 'Product 1',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'TEST-SKU',
        minStock: 10,
        active: true,
      });

      await expect(
        service.create({
          name: 'Product 2',
          category: 'Test',
          unit: 'unit' as const,
          sku: 'test-sku',
          minStock: 10,
          active: true,
        })
      ).rejects.toThrow('SKU "test-sku" is already used');
    });

    it('should auto-generate SKU when empty', async () => {
      const product = await service.create({
        name: 'Product without SKU',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      expect(product.sku).toBe('SKU-0001');
    });

    it('should auto-increment SKU for multiple products', async () => {
      const product1 = await service.create({
        name: 'Product 1',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      const product2 = await service.create({
        name: 'Product 2',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      expect(product1.sku).toBe('SKU-0001');
      expect(product2.sku).toBe('SKU-0002');
    });

    it('should auto-increment SKU correctly with mixed custom SKUs', async () => {
      // Create product with custom SKU
      await service.create({
        name: 'Custom SKU Product',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'CUSTOM-123',
        minStock: 10,
        active: true,
      });

      // Create product with auto-generated SKU
      const product1 = await service.create({
        name: 'Auto SKU Product 1',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      // Create another with auto-generated SKU
      const product2 = await service.create({
        name: 'Auto SKU Product 2',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      // Auto-generated SKUs should continue incrementing
      expect(product1.sku).toBe('SKU-0001');
      expect(product2.sku).toBe('SKU-0002');
    });

    it('should allow updating product with same SKU', async () => {
      const product = await service.create({
        name: 'Product 1',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'SAME-SKU',
        minStock: 10,
        active: true,
      });

      const updated = await service.update(product.id, {
        name: 'Updated Product',
        sku: 'SAME-SKU',
      });

      expect(updated.sku).toBe('SAME-SKU');
      expect(updated.name).toBe('Updated Product');
    });
  });

  describe('hardDelete', () => {
    it('should permanently remove product', async () => {
      const product = await service.create({
        name: 'Product to delete',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await service.hardDelete(product.id);

      const retrieved = await service.getById(product.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error when hard deleting non-existent product', async () => {
      await expect(service.hardDelete('non-existent-id')).rejects.toThrow(
        'Product with id non-existent-id not found'
      );
    });
  });

  describe('filterByCategory', () => {
    let categoryFilterService: ProductService;

    beforeEach(async () => {
      mockGetProducts.mockResolvedValue([]);
      categoryFilterService = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await categoryFilterService.create({
        name: 'Product A1',
        category: 'Category A',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await categoryFilterService.create({
        name: 'Product A2',
        category: 'Category A',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      await categoryFilterService.create({
        name: 'Product B1',
        category: 'Category B',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });
    });

    it('should filter products by category', async () => {
      const results = await categoryFilterService.filterByCategory('Category A');
      expect(results).toHaveLength(2);
      expect(results.every((p) => p.category === 'Category A')).toBe(true);
    });

    it('should return empty array for non-existent category', async () => {
      const results = await categoryFilterService.filterByCategory('Non-existent');
      expect(results).toHaveLength(0);
    });
  });

  describe('search edge cases', () => {
    let edgeCaseService: ProductService;

    beforeEach(async () => {
      mockGetProducts.mockResolvedValue([]);
      edgeCaseService = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await edgeCaseService.create({
        name: 'Test Product',
        category: 'Test',
        unit: 'unit' as const,
        sku: 'TEST-001',
        minStock: 10,
        active: true,
      });
    });

    it('should handle search with extra whitespace', async () => {
      const results = await edgeCaseService.search('  Test  ');
      expect(results).toHaveLength(1);
    });

    it('should handle search with multiple spaces', async () => {
      const results = await edgeCaseService.search('Test   Product');
      expect(results).toHaveLength(1);
    });

    it('should return all products for whitespace-only query', async () => {
      const results = await edgeCaseService.search('   ');
      expect(results).toHaveLength(1);
    });
  });

  describe('CRUD operations validation', () => {
    it('should validate all required fields on create', async () => {
      await expect(
        service.create({
          name: '',
          category: '',
          unit: 'unit' as const,
          minStock: 10,
          active: true,
        })
      ).rejects.toThrow('Product name is required');
    });

    it('should preserve createdAt timestamp on update', async () => {
      const product = await service.create({
        name: 'Original',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      const originalCreatedAt = product.createdAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.update(product.id, { name: 'Updated' });

      expect(updated.createdAt).toBe(originalCreatedAt);
    });

    it('should update updatedAt timestamp on update', async () => {
      const product = await service.create({
        name: 'Original',
        category: 'Test',
        unit: 'unit' as const,
        minStock: 10,
        active: true,
      });

      const originalUpdatedAt = product.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.update(product.id, { name: 'Updated' });

      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
    });
  });
});
