/**
 * Example screen component demonstrating how to use Purchase components
 * This is a reference implementation showing the integration pattern
 */

import { useState } from 'react';
import { PurchaseList } from './PurchaseList';
import { PurchaseForm } from './PurchaseForm';
import { PurchaseHistory } from './PurchaseHistory';
import type { Purchase, Supplier } from '../models/types';

// Mock data for demonstration
const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'Proveedor A',
    notes: 'Proveedor principal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Proveedor B',
    notes: 'Proveedor secundario',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockPurchases: Purchase[] = [
  {
    id: '1',
    date: new Date('2024-01-15').toISOString(),
    supplierId: '1',
    items: [
      { productId: 'prod-1', qty: 10, unitCostCents: 1500 },
      { productId: 'prod-2', qty: 5, unitCostCents: 2000 },
    ],
    note: 'Compra de prueba',
    createdAt: new Date().toISOString(),
  },
];

type ViewMode = 'list' | 'form' | 'history';

export function PurchasesScreenExample() {
  const [purchases, setPurchases] = useState<Purchase[]>(mockPurchases);
  const [suppliers] = useState<Supplier[]>(mockSuppliers);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleSavePurchase = (purchase: Purchase) => {
    setPurchases((prev) => [purchase, ...prev]);
    console.log('Purchase saved:', purchase);
    // In real app: sync to Gist, update cache, etc.
    setViewMode('list');
  };

  const handleCancelForm = () => {
    setViewMode('list');
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Navigation tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '10px 20px',
            background: viewMode === 'list' ? '#4CAF50' : '#f0f0f0',
            color: viewMode === 'list' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Lista de Compras
        </button>
        <button
          onClick={() => setViewMode('form')}
          style={{
            padding: '10px 20px',
            background: viewMode === 'form' ? '#4CAF50' : '#f0f0f0',
            color: viewMode === 'form' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Nueva Compra
        </button>
        <button
          onClick={() => setViewMode('history')}
          style={{
            padding: '10px 20px',
            background: viewMode === 'history' ? '#4CAF50' : '#f0f0f0',
            color: viewMode === 'history' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Historial por Producto
        </button>
      </div>

      {/* View content */}
      {viewMode === 'list' && (
        <PurchaseList
          purchases={purchases}
          suppliers={suppliers}
          onAddPurchase={() => setViewMode('form')}
        />
      )}

      {viewMode === 'form' && (
        <PurchaseForm
          suppliers={suppliers}
          onSave={handleSavePurchase}
          onCancel={handleCancelForm}
        />
      )}

      {viewMode === 'history' && (
        <PurchaseHistory purchases={purchases} suppliers={suppliers} />
      )}
    </div>
  );
}
