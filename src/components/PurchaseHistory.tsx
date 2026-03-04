import { useState, useMemo, useEffect } from 'react';
import type { Product, Purchase, Supplier } from '../models/types';
import { purchaseService } from '../services/purchase-service';
import { productService } from '../services/product-service';
import {  } from '../utils/format';
import { EmptyState } from './EmptyState';
import './PurchaseHistory.css';
import './EmptyState.css';

interface PurchaseHistoryProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  productId?: string;
}

export function PurchaseHistory({
  purchases,
  suppliers,
  products: productsFromProps,
  productId: initialProductId,
}: PurchaseHistoryProps) {
  const [products, setProducts] = useState<Product[]>(productsFromProps);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || ''
  );

  // Load products on mount if not provided
  useEffect(() => {
    if (productsFromProps.length === 0) {
      loadProducts();
    } else {
      setProducts(productsFromProps);
    }
  }, [productsFromProps]);

  const loadProducts = async () => {
    try {
      const allProducts = await productService.getAll();
      setProducts(allProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Get purchase history for selected product
  const purchaseHistory = useMemo(() => {
    if (!selectedProductId) return [];
    return purchaseService.getPurchaseHistoryByProduct(selectedProductId, purchases);
  }, [selectedProductId, purchases]);

  // Get selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Get supplier name by ID
  const getSupplierName = (supplierId: string): string => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier ? supplier.name : 'Proveedor desconocido';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Format currency (cents to display)
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Calculate cost statistics
  const costStats = useMemo(() => {
    if (purchaseHistory.length === 0) {
      return null;
    }

    const costs = purchaseHistory.map((entry) => entry.item.unitCostCents);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const lastCost = costs[0]; // First entry is most recent

    return {
      minCost,
      maxCost,
      avgCost: Math.round(avgCost),
      lastCost,
    };
  }, [purchaseHistory]);

  return (
    <div className="purchase-history">
      <div className="purchase-history-header">
        <h2>Historial de Compras por Producto</h2>
      </div>

      {/* Product selector */}
      <div className="product-selector">
        <label htmlFor="product-select">Seleccionar Producto:</label>
        <select
          id="product-select"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          <option value="">Seleccionar un producto...</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} {product.sku ? `(${product.sku})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* No product selected */}
      {!selectedProductId && (
        <EmptyState
          icon="📦"
          title="Selecciona un producto"
          description="Elige un producto del listado para ver su historial de compras y evolución de costos"
        />
      )}

      {/* Product selected but no history */}
      {selectedProductId && purchaseHistory.length === 0 && (
        <EmptyState
          icon="📋"
          title="Sin historial de compras"
          description={`${selectedProduct?.name || 'Este producto'} no tiene compras registradas. Las compras que registres aparecerán aquí.`}
        />
      )}

      {/* Product selected with history */}
      {selectedProductId && purchaseHistory.length > 0 && (
        <>
          {/* Cost statistics */}
          {costStats && (
            <div className="cost-stats">
              <h3>Estadísticas de Costo</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Último Costo</span>
                  <span className="stat-value">{formatCurrency(costStats.lastCost)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Costo Promedio</span>
                  <span className="stat-value">{formatCurrency(costStats.avgCost)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Costo Mínimo</span>
                  <span className="stat-value">{formatCurrency(costStats.minCost)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Costo Máximo</span>
                  <span className="stat-value">{formatCurrency(costStats.maxCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Cost evolution chart placeholder */}
          <div className="cost-chart-placeholder">
            <p>📊 Gráfico de evolución de costos (opcional - por implementar)</p>
          </div>

          {/* Purchase history table */}
          <div className="history-table-container">
            <h3>Historial de Compras ({purchaseHistory.length})</h3>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Cantidad</th>
                  <th>Costo Unitario</th>
                  <th>Subtotal</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {purchaseHistory.map((entry, index) => (
                  <tr key={`${entry.purchase.id}-${index}`}>
                    <td>{formatDate(entry.purchase.date)}</td>
                    <td>{getSupplierName(entry.purchase.supplierId)}</td>
                    <td>
                      {entry.item.qty} {selectedProduct?.unit}
                    </td>
                    <td className="cost-cell">
                      {formatCurrency(entry.item.unitCostCents)}
                    </td>
                    <td className="subtotal-cell">
                      {formatCurrency(entry.item.qty * entry.item.unitCostCents)}
                    </td>
                    <td>{entry.purchase.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="history-summary">
            <p>
              Total de compras registradas: <strong>{purchaseHistory.length}</strong>
            </p>
            <p>
              Cantidad total comprada:{' '}
              <strong>
                {purchaseHistory.reduce((sum, entry) => sum + entry.item.qty, 0)}{' '}
                {selectedProduct?.unit}
              </strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
