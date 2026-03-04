/**
 * Product service with CRUD operations and search functionality
 * Handles product catalog management with validation and caching
 */

import type { Product, UUID } from '../models/types';
import { validateProduct, validateSkuUniqueness } from '../models/validation';
import { cacheService } from './cache';

/**
 * Generate a simple UUID v4
 */
function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Search index entry with term frequency for ranking
 */
interface SearchIndexEntry {
  productIds: Set<string>;
  termFrequency: Map<string, number>; // productId -> frequency
}

/**
 * Product service for managing product catalog
 * Optimized for 1-5k products with client-side indexing
 */
export class ProductService {
  private products: Product[] = [];
  private searchIndex: Map<string, SearchIndexEntry> = new Map();
  private productIdMap: Map<string, Product> = new Map();
  private maxAutoSkuNumber: number = 0; // Cache for auto-generated SKU counter

  constructor() {
    this.loadFromCache();
  }

  /**
   * Load products from cache on initialization
   */
  private async loadFromCache(): Promise<void> {
    try {
      this.products = await cacheService.getProducts();
      this.rebuildSearchIndex();
      this.rebuildProductIdMap();
      this.updateMaxAutoSkuNumber(); // Initialize SKU counter
    } catch (error) {
      console.error('Failed to load products from cache:', error);
      this.products = [];
    }
  }

  /**
   * Update the max auto-generated SKU number by scanning existing products
   */
  private updateMaxAutoSkuNumber(): void {
    const skuPattern = /^SKU-(\d+)$/;
    let maxNumber = 0;

    for (const product of this.products) {
      if (product.sku) {
        const match = product.sku.match(skuPattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }

    this.maxAutoSkuNumber = maxNumber;
  }

  /**
   * Get all products
   */
  async getAll(): Promise<Product[]> {
    return [...this.products];
  }

  /**
   * Get product by ID (optimized with ID map)
   */
  async getById(id: UUID): Promise<Product | null> {
    return this.productIdMap.get(id) || null;
  }

  /**
   * Generate next auto-incremented SKU (optimized with cached counter)
   */
  private generateNextSku(): string {
    this.maxAutoSkuNumber++;
    return `SKU-${this.maxAutoSkuNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new product
   */
  async create(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    // Auto-generate SKU if not provided
    const dataWithSku = {
      ...productData,
      sku: productData.sku || this.generateNextSku(),
    };

    // Validate product
    const validation = validateProduct(dataWithSku, this.products);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Create product with generated fields
    const now = new Date().toISOString();
    const product: Product = {
      ...dataWithSku,
      id: generateUUID(),
      createdAt: now,
      updatedAt: now,
    };

    // Add to products array
    this.products.push(product);

    // Update search index
    this.addToSearchIndex(product);

    // Update ID map
    this.productIdMap.set(product.id, product);

    // Save to cache
    await this.saveToCache();

    return product;
  }

  /**
   * Update an existing product
   */
  async update(id: UUID, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<Product> {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product with id ${id} not found`);
    }

    const existingProduct = this.products[index];
    const updatedProduct = {
      ...existingProduct,
      ...updates,
      id: existingProduct.id, // Ensure ID doesn't change
      createdAt: existingProduct.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };

    // Validate updated product
    const validation = validateProduct(updatedProduct, this.products);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check SKU uniqueness if SKU is being updated
    if (updates.sku !== undefined && updates.sku !== existingProduct.sku) {
      const skuValidation = validateSkuUniqueness(updates.sku, this.products, id);
      if (!skuValidation.valid) {
        throw new Error(`SKU validation failed: ${skuValidation.errors.join(', ')}`);
      }
    }

    // Remove old product from search index
    this.removeFromSearchIndex(existingProduct);

    // Update product
    this.products[index] = updatedProduct;

    // Add updated product to search index
    this.addToSearchIndex(updatedProduct);

    // Update ID map
    this.productIdMap.set(updatedProduct.id, updatedProduct);

    // Save to cache
    await this.saveToCache();

    return updatedProduct;
  }

  /**
   * Delete (deactivate) a product
   */
  async delete(id: UUID): Promise<void> {
    const product = await this.getById(id);
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }

    // Deactivate instead of hard delete
    await this.update(id, { active: false });
  }

  /**
   * Permanently remove a product (use with caution)
   */
  async hardDelete(id: UUID): Promise<void> {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product with id ${id} not found`);
    }

    const product = this.products[index];

    // Remove from search index
    this.removeFromSearchIndex(product);

    // Remove from ID map
    this.productIdMap.delete(id);

    // Remove from array
    this.products.splice(index, 1);

    // Save to cache
    await this.saveToCache();
  }

  /**
   * Search products by name, SKU, or category with ranking
   * Optimized for 1-5k products using inverted index
   */
  async search(query: string): Promise<Product[]> {
    if (!query || query.trim() === '') {
      return this.getAll();
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryTerms = normalizedQuery.split(/\s+/);
    const matchScores = new Map<string, number>();

    // Search in index for each query term
    for (const term of queryTerms) {
      for (const [indexTerm, entry] of this.searchIndex.entries()) {
        if (indexTerm.includes(term)) {
          // Calculate relevance score
          const exactMatch = indexTerm === term ? 2 : 1;

          for (const productId of entry.productIds) {
            const frequency = entry.termFrequency.get(productId) || 1;
            const score = exactMatch * frequency;
            matchScores.set(productId, (matchScores.get(productId) || 0) + score);
          }
        }
      }
    }

    // Sort by score (descending) and return products
    const sortedIds = Array.from(matchScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return sortedIds
      .map((id) => this.productIdMap.get(id))
      .filter((p): p is Product => p !== undefined);
  }

  /**
   * Filter products by active status
   */
  async filterByActive(active: boolean): Promise<Product[]> {
    return this.products.filter((p) => p.active === active);
  }

  /**
   * Filter products by category
   */
  async filterByCategory(category: string): Promise<Product[]> {
    return this.products.filter((p) => p.category === category);
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const categories = new Set(this.products.map((p) => p.category));
    return Array.from(categories).sort();
  }

  /**
   * Save products to cache
   */
  private async saveToCache(): Promise<void> {
    try {
      await cacheService.setProducts(this.products);
    } catch (error) {
      console.error('Failed to save products to cache:', error);
      throw error;
    }
  }

  /**
   * Rebuild search index from scratch
   */
  private rebuildSearchIndex(): void {
    this.searchIndex.clear();
    this.products.forEach((product) => this.addToSearchIndex(product));
  }

  /**
   * Rebuild product ID map from scratch
   */
  private rebuildProductIdMap(): void {
    this.productIdMap.clear();
    this.products.forEach((product) => {
      this.productIdMap.set(product.id, product);
    });
  }

  /**
   * Add product to search index with term frequency
   */
  private addToSearchIndex(product: Product): void {
    const terms = this.extractSearchTerms(product);
    const termCounts = new Map<string, number>();

    // Count term frequencies
    terms.forEach((term) => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    });

    // Add to index
    termCounts.forEach((frequency, term) => {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, {
          productIds: new Set(),
          termFrequency: new Map(),
        });
      }
      const entry = this.searchIndex.get(term)!;
      entry.productIds.add(product.id);
      entry.termFrequency.set(product.id, frequency);
    });
  }

  /**
   * Remove product from search index
   */
  private removeFromSearchIndex(product: Product): void {
    const terms = this.extractSearchTerms(product);
    const uniqueTerms = new Set(terms);

    uniqueTerms.forEach((term) => {
      const entry = this.searchIndex.get(term);
      if (entry) {
        entry.productIds.delete(product.id);
        entry.termFrequency.delete(product.id);
        if (entry.productIds.size === 0) {
          this.searchIndex.delete(term);
        }
      }
    });
  }

  /**
   * Extract searchable terms from product
   */
  private extractSearchTerms(product: Product): string[] {
    const terms: string[] = [];

    // Add name terms (split by spaces)
    if (product.name) {
      const nameTerms = product.name.toLowerCase().split(/\s+/);
      terms.push(...nameTerms);
      terms.push(product.name.toLowerCase()); // Full name
    }

    // Add SKU
    if (product.sku) {
      terms.push(product.sku.toLowerCase());
    }

    // Add category
    if (product.category) {
      terms.push(product.category.toLowerCase());
    }

    return terms;
  }
}


// Export singleton instance
export const productService = new ProductService();
