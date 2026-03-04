/**
 * Example usage of Product screen components
 * This demonstrates how to integrate ProductList, ProductForm, and ProductDetail
 */

import { useState } from 'react';
import { ProductList } from './ProductList';
import { ProductForm } from './ProductForm';
import { ProductDetail } from './ProductDetail';
import type { Product, Purchase, Settings, StockMovement } from '../models/types';

// Example default settings
const defaultSettings: Settings = {
  costMethod: 'last',
  weightedAvgWindow: {
    type: 'last_n_purchases',
    value: 5,
  },
  priceRule: {
    markupPct: 30,
    roundToCents: 10,
    minMarginPct: 20,
  },
};

export function ProductsScreenExample() {
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // These would typically come from your app state/context
  const [purchases] = useState<Purchase[]>([]);
  const [movements] = useState<StockMovement[]>([]);
  const [settings] = useState<Settings>(defaultSettings);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setView('form');
  };

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setView('detail');
  };

  const handleSave = (product: Product) => {
    console.log('Product saved:', product);
    // Refresh the list and return to list view
    setView('list');
    setSelectedProduct(null);
  };

  const handleCancel = () => {
    setView('list');
    setSelectedProduct(null);
  };

  const handleClose = () => {
    setView('list');
    setSelectedProduct(null);
  };

  return (
    <div className="products-screen">
      {/* Navigation */}
      <div className="screen-nav">
        <button onClick={() => setView('list')}>Lista</button>
        <button onClick={() => { setSelectedProduct(null); setView('form'); }}>
          Nuevo Producto
        </button>
      </div>

      {/* Content */}
      {view === 'list' && (
        <ProductList
          purchases={purchases}
          settings={settings}
          movements={movements}
          onEdit={handleEdit}
          onView={handleView}
        />
      )}

      {view === 'form' && (
        <ProductForm
          product={selectedProduct}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {view === 'detail' && selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          purchases={purchases}
          movements={movements}
          settings={settings}
          onEdit={() => setView('form')}
          onAdjustStock={() => console.log('Adjust stock for', selectedProduct.name)}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
