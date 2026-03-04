/**
 * Performance tests for ProductService with large datasets
 * Tests search performance with 1-5k products
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ProductService } from './product-service';
import type { Product } from '../models/types';

// Mock the cache service
const mockGetProducts = vi.fn();
const mockSetProducts = vi.fn();

vi.mock('./cache', () => ({
  cacheService: {
    getProducts: () => mockGetProducts(),
    setProducts: (products: Product[]) => mockSetProducts(products),
  },
}));

describe('ProductService Performance Tests', () => {
  describe('Search performance with large datasets', () => {
    it('should handle 1000 products efficiently', async () => {
      mockGetProducts.mockResolvedValue([]);
      const service = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create 1000 products
      const categories = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Frozen'];
      const units = ['unit', 'kg', 'lt'] as const;

      for (let i = 0; i < 1000; i++) {
        await service.create({
          name: `Product ${i} ${categories[i % categories.length]}`,
          category: categories[i % categories.length],
          unit: units[i % units.length],
          sku: `SKU-${String(i).padStart(4, '0')}`,
          minStock: 10,
          active: true,
        });
      }

      // Measure search performance
      const startTime = performance.now();
      const results = await service.search('Product 500');
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should handle 5000 products efficiently', async () => {
      mockGetProducts.mockResolvedValue([]);
      const service = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create 5000 products
      const categories = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Frozen', 'Produce', 'Meat', 'Seafood'];
      const units = ['unit', 'kg', 'lt'] as const;

      for (let i = 0; i < 5000; i++) {
        await service.create({
          name: `Product ${i} ${categories[i % categories.length]}`,
          category: categories[i % categories.length],
          unit: units[i % units.length],
          sku: `SKU-${String(i).padStart(5, '0')}`,
          minStock: 10,
          active: true,
        });
      }

      // Measure search performance
      const startTime = performance.now();
      const results = await service.search('Product 2500');
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should complete in less than 100ms
    }, 10000); // 10 second timeout for large dataset test

    it('should handle category search with 5000 products', async () => {
      mockGetProducts.mockResolvedValue([]);
      const service = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create 5000 products
      const categories = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Frozen'];
      const units = ['unit', 'kg', 'lt'] as const;

      for (let i = 0; i < 5000; i++) {
        await service.create({
          name: `Product ${i}`,
          category: categories[i % categories.length],
          unit: units[i % units.length],
          sku: `SKU-${String(i).padStart(5, '0')}`,
          minStock: 10,
          active: true,
        });
      }

      // Measure category search performance
      const startTime = performance.now();
      const results = await service.search('Beverages');
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBe(1000); // 5000 / 5 categories
      expect(searchTime).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should handle SKU search with 5000 products', async () => {
      mockGetProducts.mockResolvedValue([]);
      const service = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create 5000 products
      const categories = ['Beverages', 'Snacks', 'Dairy'];
      const units = ['unit', 'kg', 'lt'] as const;

      for (let i = 0; i < 5000; i++) {
        await service.create({
          name: `Product ${i}`,
          category: categories[i % categories.length],
          unit: units[i % units.length],
          sku: `SKU-${String(i).padStart(5, '0')}`,
          minStock: 10,
          active: true,
        });
      }

      // Measure SKU search performance
      const startTime = performance.now();
      const results = await service.search('SKU-03000');
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBe(1);
      expect(results[0].sku).toBe('SKU-03000');
      expect(searchTime).toBeLessThan(50); // Should complete in less than 50ms
    }, 10000); // 10 second timeout for this test

    it('should handle getById with 5000 products efficiently', async () => {
      mockGetProducts.mockResolvedValue([]);
      const service = new ProductService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create 5000 products and store IDs
      const productIds: string[] = [];
      const categories = ['Beverages', 'Snacks'];
      const units = ['unit', 'kg'] as const;

      for (let i = 0; i < 5000; i++) {
        const product = await service.create({
          name: `Product ${i}`,
          category: categories[i % categories.length],
          unit: units[i % units.length],
          minStock: 10,
          active: true,
        });
        productIds.push(product.id);
      }

      // Measure getById performance (should use ID map)
      const middleId = productIds[2500];
      const startTime = performance.now();
      const result = await service.getById(middleId);
      const endTime = performance.now();
      const lookupTime = endTime - startTime;

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Product 2500');
      expect(lookupTime).toBeLessThan(5); // Should be nearly instant with ID map
    });
  });
});
