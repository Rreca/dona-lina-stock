import { useState, useMemo, useEffect, Fragment } from 'react';
import type { Purchase, Supplier, Product } from '../models/types';
import { purchaseService } from '../services/purchase-service';
import { productService } from '../services/product-service';
import {  } from '../utils/format';
import { EmptyState } from './EmptyState';
import './PurchaseList.css';
import './EmptyState.css';

interface PurchaseListProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  onAddPurchase?: () => void;
  onEditPurchase?: (purchase: Purchase) => void;
  onDeletePurchase?: (id: string) => Promise<void>;
}

export function PurchaseList({
  purchases,
  suppliers,
  products: productsFromProps,
  onAddPurchase,
  onEditPurchase,
  onDeletePurchase,
}: PurchaseListProps) {
  const [products, setProducts] = useState<Product[]>(productsFromProps);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const itemsPerPage = 20;

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

  // Filter purchases by supplier and date range
  const filteredPurchases = useMemo(() => {
    let filtered = [...purchases];

    // Filter by supplier
    if (selectedSupplierId) {
      filtered = filtered.filter((p) => p.supplierId === selectedSupplierId);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((p) => new Date(p.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => new Date(p.date) <= end);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  }, [purchases, selectedSupplierId, startDate, endDate]);

  // Paginate purchases
  const paginatedPurchases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPurchases.slice(startIndex, endIndex);
  }, [filteredPurchases, currentPage]);

  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);

  // Get supplier name by ID
  const getSupplierName = (supplierId: string): string => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier ? supplier.name : 'Proveedor desconocido';
  };

  // Get product name by ID
  const getProductName = (productId: string): string => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : 'Producto desconocido';
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

  // Calculate purchase total
  const getPurchaseTotal = (purchase: Purchase): number => {
    return purchaseService.calculatePurchaseTotal(purchase);
  };

  // Toggle purchase expansion
  const toggleExpanded = (purchaseId: string) => {
    setExpandedPurchaseId(expandedPurchaseId === purchaseId ? null : purchaseId);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedSupplierId('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Handle delete purchase
  const handleDelete = async (purchase: Purchase) => {
    if (!onDeletePurchase) return;
    
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la compra del ${formatDate(purchase.date)} al proveedor ${getSupplierName(purchase.supplierId)}?`
    );
    
    if (confirmed) {
      try {
        await onDeletePurchase(purchase.id);
      } catch (error) {
        console.error('Error deleting purchase:', error);
        alert('Error al eliminar la compra');
      }
    }
  };

  return (
    <div className="purchase-list">
      <div className="purchase-list-header">
        <h2>Compras</h2>
        {onAddPurchase && (
          <button className="btn-primary" onClick={onAddPurchase}>
            + Nueva Compra
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="purchase-filters">
        <div className="filter-group">
          <label htmlFor="supplier-filter">Proveedor:</label>
          <select
            id="supplier-filter"
            value={selectedSupplierId}
            onChange={(e) => {
              setSelectedSupplierId(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
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

      {/* Purchases table */}
      <div className="purchase-table-container">
        <table className="purchase-table">
          <thead>
            <tr>
              <th></th>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Items</th>
              <th>Total</th>
              <th>Nota</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPurchases.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon="🛒"
                    title={
                      selectedSupplierId || startDate || endDate
                        ? 'No se encontraron compras'
                        : 'No hay compras registradas'
                    }
                    description={
                      selectedSupplierId || startDate || endDate
                        ? 'Intenta ajustar los filtros para ver más resultados'
                        : 'Comienza registrando tus compras a proveedores para llevar el historial de costos'
                    }
                    actionLabel={!selectedSupplierId && !startDate && !endDate && onAddPurchase ? 'Nueva Compra' : undefined}
                    onAction={!selectedSupplierId && !startDate && !endDate ? onAddPurchase : undefined}
                  />
                </td>
              </tr>
            ) : (
              paginatedPurchases.map((purchase) => (
                <Fragment key={purchase.id}>
                  <tr
                    className="purchase-row"
                  >
                    <td className="expand-cell" onClick={() => toggleExpanded(purchase.id)}>
                      <span className={`expand-icon ${expandedPurchaseId === purchase.id ? 'expanded' : ''}`}>
                        ▶
                      </span>
                    </td>
                    <td onClick={() => toggleExpanded(purchase.id)}>{formatDate(purchase.date)}</td>
                    <td onClick={() => toggleExpanded(purchase.id)}>{getSupplierName(purchase.supplierId)}</td>
                    <td onClick={() => toggleExpanded(purchase.id)}>{purchase.items.length}</td>
                    <td className="total-cell" onClick={() => toggleExpanded(purchase.id)}>{formatCurrency(getPurchaseTotal(purchase))}</td>
                    <td onClick={() => toggleExpanded(purchase.id)}>{purchase.note || '-'}</td>
                    <td className="actions-cell">
                      {onEditPurchase && (
                        <button
                          className="btn-icon"
                          onClick={() => onEditPurchase(purchase)}
                          title="Editar compra"
                          aria-label="Editar compra"
                        >
                          ✏️
                        </button>
                      )}
                      {onDeletePurchase && (
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDelete(purchase)}
                          title="Eliminar compra"
                          aria-label="Eliminar compra"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedPurchaseId === purchase.id && (
                    <tr className="purchase-items-row">
                      <td colSpan={7}>
                        <div className="purchase-items">
                          <h4>Items de la compra:</h4>
                          <table className="items-table">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Costo Unitario</th>
                                <th>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchase.items.map((item, index) => (
                                <tr key={index}>
                                  <td>{getProductName(item.productId)}</td>
                                  <td>{item.qty}</td>
                                  <td>{formatCurrency(item.unitCostCents)}</td>
                                  <td>{formatCurrency(item.qty * item.unitCostCents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="purchase-pagination">
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

      <div className="purchase-list-footer">
        <p>
          Mostrando {paginatedPurchases.length} de {filteredPurchases.length} compras
          {filteredPurchases.length !== purchases.length && ` (${purchases.length} total)`}
        </p>
      </div>
    </div>
  );
}
