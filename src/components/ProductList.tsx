import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import type { Product, Purchase, Settings, StockMovement } from '../models/types';
import { isLXLProduct, getPackSize, convertToJugs } from '../models/types';
import { productService } from '../services/product-service';
import { costService } from '../services/cost-service';
import { pricingService } from '../services/pricing-service';
import { movementService } from '../services/movement-service';
import { debounce } from '../utils/debounce';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import './ProductList.css';
import './LoadingSkeleton.css';
import './EmptyState.css';

interface ProductListProps {
  purchases: Purchase[];
  settings: Settings;
  movements: StockMovement[];
  onEdit?: (product: Product) => void;
  onView?: (product: Product) => void;
}

interface ProductRowProps {
  product: Product;
  stock: number;
  isLowStock: boolean;
  costDetails: any;
  dualMargin: any;
  allProducts: Product[];
  onEdit?: (product: Product) => void;
  onView?: (product: Product) => void;
}

const ProductRow = memo(({
  product,
  stock,
  isLowStock,
  costDetails,
  dualMargin,
  onEdit,
  onView,
}: ProductRowProps) => {
  const formatCurrency = (cents: number | undefined) => {
    if (cents === undefined || cents === null) return '-';
    return `${(cents / 100).toFixed(2)}`;
  };

  const isLXL = isLXLProduct(product);

  // For LXL products, always render two sub-rows
  if (isLXL) {
    const packSize = getPackSize(product);
    const jugs = convertToJugs(stock, packSize);
    const minJugs = convertToJugs(product.minStock, packSize);
    const liquidCostPerLiter = costDetails?.lxlDetails?.liquidCostPerLiter;
    const effectiveCostPerJug = costDetails?.cost;
    const effectiveCostPerBottle = costDetails?.lxlDetails?.effectiveCostPerBottle;

    return (
      <>
        {/* Desktop/Tablet view - Table rows */}
        <tr className={`product-row product-row-header ${!product.active ? 'inactive' : ''}`} role="row">
          <td colSpan={9} role="cell" style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
            {product.name} ({product.sku || '-'})
            {isLowStock && <span className="low-stock-badge" role="status" aria-label="Stock bajo mínimo">⚠️ Bajo mínimo</span>}
            <span style={{ float: 'right' }}>
              {onView && (
                <button onClick={() => onView(product)} className="btn-view" aria-label={`Ver detalles de ${product.name}`} style={{ marginRight: '8px' }}>
                  Ver
                </button>
              )}
              {onEdit && (
                <button onClick={() => onEdit(product)} className="btn-edit" aria-label={`Editar ${product.name}`}>
                  Editar
                </button>
              )}
            </span>
          </td>
        </tr>

        {/* Suelto row */}
        <tr className={`product-row product-sub-row ${!product.active ? 'inactive' : ''}`} role="row">
          <td role="cell" style={{ paddingLeft: '24px' }}>Suelto</td>
          <td role="cell">{product.sku || '-'}</td>
          <td role="cell">{product.category}</td>
          <td role="cell">lt</td>
          <td role="cell">{stock.toFixed(2)} lt</td>
          <td role="cell">{liquidCostPerLiter ? formatCurrency(liquidCostPerLiter) : '-'}</td>
          <td role="cell">{formatCurrency(product.salePriceCents)}</td>
          <td className={dualMargin?.perLiter && dualMargin.perLiter.marginPct < 0 ? 'margin-negative' : ''} role="cell">
            {dualMargin?.perLiter 
              ? `${formatCurrency(dualMargin.perLiter.marginCents)} (${dualMargin.perLiter.marginPct.toFixed(1)}%)`
              : '-'}
          </td>
          <td role="cell"></td>
        </tr>

        {/* Por Bidón row */}
        <tr className={`product-row product-sub-row ${!product.active ? 'inactive' : ''} ${isLowStock ? 'low-stock' : ''}`} role="row">
          <td role="cell" style={{ paddingLeft: '24px' }}>Por Bidón</td>
          <td role="cell">BP-1</td>
          <td role="cell">{product.category}</td>
          <td role="cell">bidones</td>
          <td className={isLowStock ? 'stock-low' : ''} role="cell">
            {jugs.toFixed(2)} bidones {isLowStock && `(mín: ${minJugs.toFixed(2)})`}
          </td>
          <td role="cell">{effectiveCostPerJug ? formatCurrency(effectiveCostPerJug) : '-'}</td>
          <td role="cell">{formatCurrency(product.jugSalePriceCents)}</td>
          <td className={dualMargin?.perJug && dualMargin.perJug.marginPct < 0 ? 'margin-negative' : ''} role="cell">
            {dualMargin?.perJug
              ? `${formatCurrency(dualMargin.perJug.marginCents)} (${dualMargin.perJug.marginPct.toFixed(1)}%)`
              : '-'}
          </td>
          <td role="cell"></td>
        </tr>

        {/* Por Botella 1L row */}
        <tr className={`product-row product-sub-row ${!product.active ? 'inactive' : ''}`} role="row">
          <td role="cell" style={{ paddingLeft: '24px' }}>Por Botella 1L</td>
          <td role="cell">BP-3</td>
          <td role="cell">{product.category}</td>
          <td role="cell">botellas</td>
          <td role="cell">{stock.toFixed(2)} botellas</td>
          <td role="cell">{effectiveCostPerBottle ? formatCurrency(effectiveCostPerBottle) : '-'}</td>
          <td role="cell">{formatCurrency(product.bottleSalePriceCents)}</td>
          <td className={dualMargin?.perBottle && dualMargin.perBottle.marginPct < 0 ? 'margin-negative' : ''} role="cell">
            {dualMargin?.perBottle
              ? `${formatCurrency(dualMargin.perBottle.marginCents)} (${dualMargin.perBottle.marginPct.toFixed(1)}%)`
              : '-'}
          </td>
          <td role="cell"></td>
        </tr>

        {/* Mobile view - Card */}
        <div className={`product-card ${!product.active ? 'inactive' : ''} ${isLowStock ? 'low-stock' : ''}`}>
          <div className="product-card-header">
            <div className="product-card-title">
              <h3>{product.name}</h3>
              {isLowStock && <span className="low-stock-badge-mobile">⚠️ Stock bajo</span>}
            </div>
            <div className="product-card-actions">
              {onView && (
                <button onClick={() => onView(product)} className="btn-icon-mobile" aria-label={`Ver detalles de ${product.name}`} title="Ver">
                  👁️
                </button>
              )}
              {onEdit && (
                <button onClick={() => onEdit(product)} className="btn-icon-mobile" aria-label={`Editar ${product.name}`} title="Editar">
                  ✏️
                </button>
              )}
            </div>
          </div>

          <div className="product-card-body">
            <div className="product-card-row">
              <span className="label">SKU:</span>
              <span className="value">{product.sku || '-'}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Categoría:</span>
              <span className="value">{product.category}</span>
            </div>

            <div style={{ marginTop: '12px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '8px' }}>Suelto:</div>
            <div className="product-card-row">
              <span className="label">Stock:</span>
              <span className="value">{stock.toFixed(2)} lt</span>
            </div>
            <div className="product-card-row">
              <span className="label">Costo:</span>
              <span className="value">${liquidCostPerLiter ? formatCurrency(liquidCostPerLiter) : '-'}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Precio:</span>
              <span className="value">${formatCurrency(product.salePriceCents)}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Margen:</span>
              <span className={`value ${dualMargin?.perLiter && dualMargin.perLiter.marginPct < 0 ? 'margin-negative' : ''}`}>
                {dualMargin?.perLiter
                  ? `${formatCurrency(dualMargin.perLiter.marginCents)} (${dualMargin.perLiter.marginPct.toFixed(1)}%)`
                  : '-'}
              </span>
            </div>

            <div style={{ marginTop: '12px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '8px' }}>Por Bidón:</div>
            <div className="product-card-row">
              <span className="label">Stock:</span>
              <span className={`value ${isLowStock ? 'stock-low' : ''}`}>
                {jugs.toFixed(2)} bidones {isLowStock && `(mín: ${minJugs.toFixed(2)})`}
              </span>
            </div>
            <div className="product-card-row">
              <span className="label">Costo:</span>
              <span className="value">${effectiveCostPerJug ? formatCurrency(effectiveCostPerJug) : '-'}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Precio:</span>
              <span className="value">${formatCurrency(product.jugSalePriceCents)}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Margen:</span>
              <span className={`value ${dualMargin?.perJug && dualMargin.perJug.marginPct < 0 ? 'margin-negative' : ''}`}>
                {dualMargin?.perJug
                  ? `${formatCurrency(dualMargin.perJug.marginCents)} (${dualMargin.perJug.marginPct.toFixed(1)}%)`
                  : '-'}
              </span>
            </div>

            <div style={{ marginTop: '12px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '8px' }}>Por Botella 1L:</div>
            <div className="product-card-row">
              <span className="label">Stock:</span>
              <span className="value">{stock.toFixed(2)} botellas</span>
            </div>
            <div className="product-card-row">
              <span className="label">Costo:</span>
              <span className="value">${effectiveCostPerBottle ? formatCurrency(effectiveCostPerBottle) : '-'}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Precio:</span>
              <span className="value">${formatCurrency(product.bottleSalePriceCents)}</span>
            </div>
            <div className="product-card-row">
              <span className="label">Margen:</span>
              <span className={`value ${dualMargin?.perBottle && dualMargin.perBottle.marginPct < 0 ? 'margin-negative' : ''}`}>
                {dualMargin?.perBottle
                  ? `${formatCurrency(dualMargin.perBottle.marginCents)} (${dualMargin.perBottle.marginPct.toFixed(1)}%)`
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Standard product (non-LXL) or LXL without jugSalePriceCents - single row
  const singleMargin = dualMargin?.perLiter || null;

  return (
    <>
      {/* Desktop/Tablet view - Table row */}
      <tr
        className={`product-row ${!product.active ? 'inactive' : ''} ${isLowStock ? 'low-stock' : ''}`}
        role="row"
      >
        <td role="cell">
          {product.name}
          {isLowStock && <span className="low-stock-badge" role="status" aria-label="Stock bajo mínimo">⚠️ Bajo mínimo</span>}
        </td>
        <td role="cell">{product.sku || '-'}</td>
        <td role="cell">{product.category}</td>
        <td role="cell">{product.unit}</td>
        <td className={isLowStock ? 'stock-low' : ''} role="cell">
          {stock} {product.unit} {isLowStock && `(mín: ${product.minStock} ${product.unit})`}
        </td>
        <td role="cell">{costDetails ? formatCurrency(costDetails.cost) : '-'}</td>
        <td role="cell">{formatCurrency(product.salePriceCents)}</td>
        <td className={singleMargin && singleMargin.marginPct < 0 ? 'margin-negative' : ''} role="cell">
          {singleMargin
            ? `${formatCurrency(singleMargin.marginCents)} (${singleMargin.marginPct.toFixed(1)}%)`
            : '-'}
        </td>
        <td className="actions" role="cell">
          {onView && (
            <button onClick={() => onView(product)} className="btn-view" aria-label={`Ver detalles de ${product.name}`}>
              Ver
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(product)} className="btn-edit" aria-label={`Editar ${product.name}`}>
              Editar
            </button>
          )}
        </td>
      </tr>

      {/* Mobile view - Card */}
      <div className={`product-card ${!product.active ? 'inactive' : ''} ${isLowStock ? 'low-stock' : ''}`}>
        <div className="product-card-header">
          <div className="product-card-title">
            <h3>{product.name}</h3>
            {isLowStock && <span className="low-stock-badge-mobile">⚠️ Stock bajo</span>}
          </div>
          <div className="product-card-actions">
            {onView && (
              <button onClick={() => onView(product)} className="btn-icon-mobile" aria-label={`Ver detalles de ${product.name}`} title="Ver">
                👁️
              </button>
            )}
            {onEdit && (
              <button onClick={() => onEdit(product)} className="btn-icon-mobile" aria-label={`Editar ${product.name}`} title="Editar">
                ✏️
              </button>
            )}
          </div>
        </div>
        
        <div className="product-card-body">
          <div className="product-card-row">
            <span className="label">SKU:</span>
            <span className="value">{product.sku || '-'}</span>
          </div>
          <div className="product-card-row">
            <span className="label">Categoría:</span>
            <span className="value">{product.category}</span>
          </div>
          <div className="product-card-row">
            <span className="label">Stock:</span>
            <span className={`value ${isLowStock ? 'stock-low' : ''}`}>
              {stock} {product.unit} {isLowStock && `(mín: ${product.minStock} ${product.unit})`}
            </span>
          </div>
          <div className="product-card-row">
            <span className="label">Costo:</span>
            <span className="value">${costDetails ? formatCurrency(costDetails.cost) : '-'}</span>
          </div>
          <div className="product-card-row">
            <span className="label">Precio:</span>
            <span className="value">${formatCurrency(product.salePriceCents)}</span>
          </div>
          <div className="product-card-row">
            <span className="label">Margen:</span>
            <span className={`value ${singleMargin && singleMargin.marginPct < 0 ? 'margin-negative' : ''}`}>
              {singleMargin
                ? `${formatCurrency(singleMargin.marginCents)} (${singleMargin.marginPct.toFixed(1)}%)`
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
});

ProductRow.displayName = 'ProductRow';

export function ProductList({
  purchases,
  settings,
  movements,
  onEdit,
  onView,
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Keep full list for cost calculations
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const loadedProducts = await productService.getAll();
      setAllProducts(loadedProducts); // Store full list
      setProducts(loadedProducts); // Also set as current products
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        try {
          const results = await productService.search(query);
          setProducts(results);
        } catch (error) {
          console.error('Search failed:', error);
        }
      }, 300),
    []
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const stockLevels = useMemo(() => {
    return movementService.calculateAllStock(movements);
  }, [movements]);

  // Get unique categories from all products
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
    return uniqueCategories.sort();
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    // Filter by active status
    if (activeFilter !== 'all') {
      filtered = filtered.filter((p) => p.active === (activeFilter === 'active'));
    }
    
    // Filter by category (only if a category is selected)
    if (categoryFilter !== '') {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    
    return filtered;
  }, [products, activeFilter, categoryFilter]);

  const productData = useMemo(() => {
    return filteredProducts.map((product) => {
      const stock = stockLevels.get(product.id) ?? 0;
      const isLowStock = movementService.isLowStock(stock, product.minStock);
      const isLXL = isLXLProduct(product);
      
      const costDetails = isLXL
        ? costService.calculateEffectiveCost(product, purchases, allProducts, settings)
        : costService.calculateCurrentCost(product.id, purchases, settings);
      
      const dualMargin = pricingService.calculateDualMargin(product, purchases, allProducts, settings);

      return {
        product,
        stock,
        isLowStock,
        costDetails,
        dualMargin,
      };
    });
  }, [filteredProducts, stockLevels, purchases, settings, allProducts]);

  if (loading) {
    return (
      <div className="product-list">
        <div className="product-list-header">
          <h2>Productos</h2>
        </div>
        <LoadingSkeleton type="table" rows={10} />
      </div>
    );
  }

  return (
    <div className="product-list">
      <div className="product-list-header">
        <h2>Productos</h2>
        <div className="product-list-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, SKU o categoría..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Buscar productos"
            role="searchbox"
          />

          <select
            className="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="">Seleccione Categoría</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <div className="filter-buttons" role="group" aria-label="Filtrar productos por estado">
            <button
              className={activeFilter === 'all' ? 'active' : ''}
              onClick={() => setActiveFilter('all')}
              aria-pressed={activeFilter === 'all'}
              aria-label="Mostrar todos los productos"
            >
              Todos
            </button>
            <button
              className={activeFilter === 'active' ? 'active' : ''}
              onClick={() => setActiveFilter('active')}
              aria-pressed={activeFilter === 'active'}
              aria-label="Mostrar solo productos activos"
            >
              Activos
            </button>
            <button
              className={activeFilter === 'inactive' ? 'active' : ''}
              onClick={() => setActiveFilter('inactive')}
              aria-pressed={activeFilter === 'inactive'}
              aria-label="Mostrar solo productos inactivos"
            >
              Inactivos
            </button>
          </div>
        </div>
      </div>

      <div className="product-table-container">
        <table className="product-table" role="table" aria-label="Lista de productos">
          <thead>
            <tr role="row">
              <th role="columnheader">Nombre</th>
              <th role="columnheader">SKU</th>
              <th role="columnheader">Categoría</th>
              <th role="columnheader">Unidad</th>
              <th role="columnheader">Stock</th>
              <th role="columnheader">Costo</th>
              <th role="columnheader">Precio</th>
              <th role="columnheader">Margen</th>
              <th role="columnheader">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productData.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon="🔍"
                    title={searchQuery ? 'No se encontraron productos' : 'No hay productos'}
                    description={
                      searchQuery
                        ? 'Intenta con otros términos de búsqueda'
                        : 'Comienza agregando tu primer producto al catálogo'
                    }
                  />
                </td>
              </tr>
            ) : (
              productData.map(({ product, stock, isLowStock, costDetails, dualMargin }) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  stock={stock}
                  isLowStock={isLowStock}
                  costDetails={costDetails}
                  dualMargin={dualMargin}
                  allProducts={allProducts}
                  onEdit={onEdit}
                  onView={onView}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="product-cards-container">
        {productData.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={searchQuery ? 'No se encontraron productos' : 'No hay productos'}
            description={
              searchQuery
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza agregando tu primer producto al catálogo'
            }
          />
        ) : (
          productData.map(({ product, stock, isLowStock, costDetails, dualMargin }) => (
            <ProductRow
              key={product.id}
              product={product}
              stock={stock}
              isLowStock={isLowStock}
              costDetails={costDetails}
              dualMargin={dualMargin}
              allProducts={allProducts}
              onEdit={onEdit}
              onView={onView}
            />
          ))
        )}
      </div>

      <div className="product-list-footer" role="status" aria-live="polite">
        <p>
          Mostrando {productData.length} de {products.length} productos
        </p>
      </div>
    </div>
  );
}
