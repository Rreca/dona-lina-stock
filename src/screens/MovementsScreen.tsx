import { useState } from 'react';
import { MovementList, MovementForm, StockAdjustment } from '../components';
import type { StockMovement } from '../models/types';

interface MovementsScreenProps {
  movements: StockMovement[];
  onMovementCreate: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => Promise<StockMovement>;
}

type ViewMode = 'list' | 'add' | 'adjust';

export function MovementsScreen({ movements, onMovementCreate }: MovementsScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleSaveMovement = async (movementData: Omit<StockMovement, 'id' | 'createdAt'>) => {
    await onMovementCreate(movementData);
    setViewMode('list');
  };

  const handleCancel = () => {
    setViewMode('list');
  };

  return (
    <div className="screen-container">
      <div className="screen-tabs">
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
        >
          Lista de Movimientos
        </button>
        <button className={viewMode === 'add' ? 'active' : ''} onClick={() => setViewMode('add')}>
          Nuevo Movimiento
        </button>
        <button
          className={viewMode === 'adjust' ? 'active' : ''}
          onClick={() => setViewMode('adjust')}
        >
          Ajuste de Stock
        </button>
      </div>

      <div className="screen-content">
        {viewMode === 'list' && (
          <MovementList movements={movements} onAddMovement={() => setViewMode('add')} />
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
    </div>
  );
}
