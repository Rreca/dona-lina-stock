/**
 * Example implementation of the Movements screen
 * This demonstrates how to integrate MovementList, MovementForm, and StockAdjustment components
 */

import { useState } from 'react';
import type { StockMovement } from '../models/types';
import { MovementList } from './MovementList';
import { MovementForm } from './MovementForm';
import { StockAdjustment } from './StockAdjustment';

// Mock movements data for demonstration
const mockMovements: StockMovement[] = [
  {
    id: '1',
    date: '2024-01-15T10:30:00.000Z',
    productId: 'prod-1',
    type: 'in',
    qty: 100,
    note: 'Compra inicial',
    createdAt: '2024-01-15T10:30:00.000Z',
  },
  {
    id: '2',
    date: '2024-01-16T14:20:00.000Z',
    productId: 'prod-1',
    type: 'out',
    qty: 25,
    note: 'Venta',
    createdAt: '2024-01-16T14:20:00.000Z',
  },
  {
    id: '3',
    date: '2024-01-17T09:15:00.000Z',
    productId: 'prod-2',
    type: 'in',
    qty: 50,
    createdAt: '2024-01-17T09:15:00.000Z',
  },
  {
    id: '4',
    date: '2024-01-18T16:45:00.000Z',
    productId: 'prod-1',
    type: 'adjust',
    qty: -5,
    note: 'Ajuste manual: Inventario físico - producto dañado',
    createdAt: '2024-01-18T16:45:00.000Z',
  },
];

type ViewMode = 'list' | 'add' | 'adjust';

export function MovementsScreenExample() {
  const [movements, setMovements] = useState<StockMovement[]>(mockMovements);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleSaveMovement = (movement: StockMovement) => {
    // Add new movement to the list
    setMovements((prev) => [movement, ...prev]);
    
    // Return to list view after saving
    setTimeout(() => {
      setViewMode('list');
    }, 1500);
  };

  const handleCancel = () => {
    setViewMode('list');
  };

  return (
    <div className="movements-screen">
      {/* Navigation tabs */}
      <div className="screen-tabs">
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
        >
          Lista de Movimientos
        </button>
        <button
          className={viewMode === 'add' ? 'active' : ''}
          onClick={() => setViewMode('add')}
        >
          Nuevo Movimiento
        </button>
        <button
          className={viewMode === 'adjust' ? 'active' : ''}
          onClick={() => setViewMode('adjust')}
        >
          Ajuste de Stock
        </button>
      </div>

      {/* Content area */}
      <div className="screen-content">
        {viewMode === 'list' && (
          <MovementList
            movements={movements}
            onAddMovement={() => setViewMode('add')}
          />
        )}

        {viewMode === 'add' && (
          <MovementForm
            movements={movements}
            onSave={handleSaveMovement}
            onCancel={handleCancel}
          />
        )}

        {viewMode === 'adjust' && (
          <StockAdjustment
            movements={movements}
            onSave={handleSaveMovement}
            onCancel={handleCancel}
          />
        )}
      </div>

      <style>{`
        .movements-screen {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .screen-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #dee2e6;
        }

        .screen-tabs button {
          padding: 12px 24px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          transition: all 0.2s;
        }

        .screen-tabs button:hover {
          color: #333;
          background: #f8f9fa;
        }

        .screen-tabs button.active {
          color: #4CAF50;
          border-bottom-color: #4CAF50;
        }

        .screen-content {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
