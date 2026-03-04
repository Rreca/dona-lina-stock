import { useState } from 'react';
import { PurchaseList, PurchaseForm, PurchaseHistory } from '../components';
import type { Purchase, Supplier, Product } from '../models/types';

interface PurchasesScreenProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  onPurchaseCreate: (purchase: Omit<Purchase, 'id' | 'createdAt'>) => Promise<Purchase>;
  onPurchaseUpdate: (id: string, updates: Partial<Purchase>) => Promise<Purchase>;
  onPurchaseDelete: (id: string) => Promise<void>;
  onSupplierCreate: (supplier: Supplier) => Promise<void>;
}

type ViewMode = 'list' | 'form' | 'history';

export function PurchasesScreen({
  purchases,
  suppliers,
  products,
  onPurchaseCreate,
  onPurchaseUpdate,
  onPurchaseDelete,
  onSupplierCreate,
}: PurchasesScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  const handleSavePurchase = async (purchaseData: Omit<Purchase, 'id' | 'createdAt'>) => {
    if (editingPurchase) {
      await onPurchaseUpdate(editingPurchase.id, purchaseData);
      setEditingPurchase(null);
    } else {
      await onPurchaseCreate(purchaseData);
    }
    setViewMode('list');
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setViewMode('form');
  };

  const handleCancelForm = () => {
    setEditingPurchase(null);
    setViewMode('list');
  };

  return (
    <div className="screen-container">
      <div className="screen-tabs">
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
        >
          Lista de Compras
        </button>
        <button
          className={viewMode === 'form' ? 'active' : ''}
          onClick={() => setViewMode('form')}
        >
          Nueva Compra
        </button>
        <button
          className={viewMode === 'history' ? 'active' : ''}
          onClick={() => setViewMode('history')}
        >
          Historial por Producto
        </button>
      </div>

      <div className="screen-content">
        {viewMode === 'list' && (
          <PurchaseList
            purchases={purchases}
            suppliers={suppliers}
            products={products}
            onAddPurchase={() => setViewMode('form')}
            onEditPurchase={handleEditPurchase}
            onDeletePurchase={onPurchaseDelete}
          />
        )}

        {viewMode === 'form' && (
          <PurchaseForm
            suppliers={suppliers}
            purchase={editingPurchase || undefined}
            onSave={handleSavePurchase}
            onCancel={handleCancelForm}
            onSupplierCreate={onSupplierCreate}
          />
        )}

        {viewMode === 'history' && (
          <PurchaseHistory 
            purchases={purchases} 
            suppliers={suppliers}
            products={products}
          />
        )}
      </div>
    </div>
  );
}
