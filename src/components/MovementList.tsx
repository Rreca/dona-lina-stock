import { useState, useEffect, useMemo } from 'react';
import type { StockMovement, Product } from '../models/types';
import { productService } from '../services/product-service';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import './MovementList.css';
import './LoadingSkeleton.css';
import './EmptyState.css';

interface MovementListProps {
  movements: StockMovement[];
  onAddMovement?: () => void;
}

export function MovementList({ movements, onAddMovement }: MovementListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 50;

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await productService.getAll();
      setProducts(allProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter movements by product and date range
  const filteredMovements = useMemo(() => {
    let filtered = [...movements];

    // Filter by product
    if (selectedProductId) {
      filtered = filtered.filter((m) => m.productId === selectedProductId);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((m) => new Date(m.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter((m) => new Date(m.date) <= end);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  }, [movements, selectedProductId, startDate, endDate]);

  // Paginate movements
  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMovements.slice(startIndex, endIndex);
  }, [filteredMovements, currentPage]);

  // Calculate stock before each movement
  const movementsWithStock = useMemo(() => {
    // Sort all movements by date (oldest first) for calculation
    const sortedMovements = [...movements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate running stock for each product
    const stockByProduct = new Map<string, number>();
    const stockBeforeMovement = new Map<string, number>();

    for (const movement of sortedMovements) {
      const currentStock = stockByProduct.get(movement.productId) || 0;
      
      // Store stock BEFORE this movement
      stockBeforeMovement.set(movement.id, currentStock);

      // Calculate new stock after this movement
      let newStock = currentStock;
      switch (movement.type) {
        case 'in':
          newStock = currentStock + movement.qty;
          break;
        case 'out':
          newStock = currentStock - movement.qty;
          break;
        case 'adjust':
          newStock = currentStock + movement.qty;
          break;
      }
      
      stockByProduct.set(movement.productId, newStock);
    }

    return stockBeforeMovement;
  }, [movements]);

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

  // Get product name by ID
  const getProductName = (productId: string): string => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Producto desconocido';
  };

  // Get product unit by ID
  const getProductUnit = (productId: string): string => {
    const product = products.find((p) => p.id === productId);
    return product ? product.unit : '';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format movement type
  const formatMovementType = (type: string): string => {
    const types: Record<string, string> = {
      in: 'Entrada',
      out: 'Salida',
      adjust: 'Ajuste',
    };
    return types[type] || type;
  };

  // Get movement type class
  const getMovementTypeClass = (type: string): string => {
    return `movement-type-${type}`;
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedProductId('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="movement-list">
        <div className="movement-list-header">
          <h2>Movimientos de Stock</h2>
        </div>
        <LoadingSkeleton type="list" rows={8} />
      </div>
    );
  }

  return (
    <div className="movement-list">
      <div className="movement-list-header">
        <h2>Movimientos de Stock</h2>
        {onAddMovement && (
          <button className="btn-primary" onClick={onAddMovement}>
            + Nuevo Movimiento
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="movement-filters">
        <div className="filter-group">
          <label htmlFor="product-filter">Producto:</label>
          <select
            id="product-filter"
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos los productos</option>
            {products
              .filter((p) => p.active)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="start-date">Desde:</label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">Hasta:</label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <button className="btn-secondary" onClick={handleResetFilters}>
          Limpiar Filtros
        </button>
      </div>

      {/* Movements table */}
      <div className="movement-table-container">
        <table className="movement-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Stock Anterior</th>
              <th>Cantidad</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMovements.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon="📋"
                    title={
                      selectedProductId || startDate || endDate
                        ? 'No se encontraron movimientos'
                        : 'No hay movimientos registrados'
                    }
                    description={
                      selectedProductId || startDate || endDate
                        ? 'Intenta ajustar los filtros para ver más resultados'
                        : 'Comienza registrando entradas, salidas o ajustes de stock'
                    }
                    actionLabel={!selectedProductId && !startDate && !endDate && onAddMovement ? 'Nuevo Movimiento' : undefined}
                    onAction={!selectedProductId && !startDate && !endDate ? onAddMovement : undefined}
                  />
                </td>
              </tr>
            ) : (
              paginatedMovements.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.date)}</td>
                  <td>{getProductName(movement.productId)}</td>
                  <td>
                    <span className={`movement-type-badge ${getMovementTypeClass(movement.type)}`}>
                      {formatMovementType(movement.type)}
                    </span>
                  </td>
                  <td className="stock-before">
                    {movementsWithStock.get(movement.id) || 0} {getProductUnit(movement.productId)}
                  </td>
                  <td className={movement.type === 'out' ? 'qty-negative' : 'qty-positive'}>
                    {movement.type === 'out' ? '-' : '+'}
                    {movement.qty}
                  </td>
                  <td>{movement.note || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="movement-pagination">
          <button
            className="btn-pagination"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span className="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            className="btn-pagination"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}

      <div className="movement-list-footer">
        <p>
          Mostrando {paginatedMovements.length} de {filteredMovements.length} movimientos
          {filteredMovements.length !== movements.length && ` (${movements.length} total)`}
        </p>
      </div>
    </div>
  );
}
