import { useState } from 'react';
import { ProductList, ProductForm, ProductDetail } from '../components';
import type { Product, Purchase, Settings, StockMovement } from '../models/types';

interface ProductsScreenProps {
  products: Product[]; // Used for initial data, ProductList loads from service
  purchases: Purchase[];
  movements: StockMovement[];
  settings: Settings;
  onProductCreate: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  onProductUpdate: (id: string, updates: Partial<Product>) => Promise<Product>;
}

export function ProductsScreen({
  purchases,
  movements,
  settings,
  onProductCreate,
  onProductUpdate,
}: ProductsScreenProps) {
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setView('form');
  };

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setView('detail');
  };

  const handleSave = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedProduct) {
      await onProductUpdate(selectedProduct.id, productData);
    } else {
      await onProductCreate(productData);
    }
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
    <div className="screen-container">
      {view === 'list' && (
        <>
          <div className="screen-header">
            <h1>Productos</h1>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedProduct(null);
                setView('form');
              }}
            >
              Nuevo Producto
            </button>
          </div>
          <ProductList
            purchases={purchases}
            settings={settings}
            movements={movements}
            onEdit={handleEdit}
            onView={handleView}
          />
        </>
      )}

      {view === 'form' && (
        <ProductForm 
          product={selectedProduct} 
          purchases={purchases}
          settings={settings}
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
