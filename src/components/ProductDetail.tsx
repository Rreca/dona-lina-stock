import { useState, useEffect } from 'react';
import type {
  Product,
  Purchase,
  Settings,
  StockMovement,
} from '../models/types';
import { isLXLProduct, getPackSize, convertToJugs } from '../models/types';
import { movementService } from '../services/movement-service';
import { costService } from '../services/cost-service';
import { pricingService } from '../services/pricing-service';
import {  } from '../utils/format';
import './ProductDetail.css';

interface ProductDetailProps {
  product: Product;
  purchases: Purchase[];
  movements: StockMovement[];
  settings: Settings;
  onEdit?: () => void;
  onAdjustStock?: () => void;
  onClose?: () => void;
}

export function ProductDetail({
  product,
  purchases,
  movements,
  settings,
  onEdit,
  onAdjustStock,
  onClose,
}: ProductDetailProps) {
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<
    Array<{ purchase: Purchase; item: { qty: number; unitCostCents: number } }>
  >([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadAllProducts();
  }, []);

  const loadAllProducts = async () => {
    try {
      const { productService } = await import('../services/product-service');
      const products = await productService.getAll();
      setAllProducts(products);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  useEffect(() => {
    loadRecentData();
  }, [product.id, movements, purchases]);

  const loadRecentData = () => {
    // Get recent movements for this product (last 10)
    const productMovements = movements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    setRecentMovements(productMovements);

    // Get recent purchases for this product (last 10)
    const productPurchases: Array<{
      purchase: Purchase;
      item: { qty: number; unitCostCents: number };
    }> = [];

    for (const purchase of purchases) {
      const item = purchase.items.find((i) => i.productId === product.id);
      if (item) {
        productPurchases.push({ purchase, item });
      }
    }

    productPurchases.sort(
      (a, b) =>
        new Date(b.purchase.date).getTime() - new Date(a.purchase.date).getTime()
    );

    setRecentPurchases(productPurchases.slice(0, 10));
  };

  // Calculate current stock
  const currentStock = movementService.calculateStock(product.id, movements);
  const isLowStock = movementService.isLowStock(currentStock, product.minStock);

  // Get cost details (use effective cost for LXL products)
  const isLXL = isLXLProduct(product);
  const costDetails = isLXL
    ? costService.calculateEffectiveCost(product, purchases, allProducts, settings)
    : costService.getCostDetails(product.id, purchases, settings);

  // Get dual margin (supports both LXL and standard products)
  const dualMargin = pricingService.calculateDualMargin(product, purchases, allProducts, settings);

  // Format stock display for LXL products
  const formatStock = (stock: number) => {
    if (isLXL) {
      const packSize = getPackSize(product);
      const jugs = convertToJugs(stock, packSize);
      return `${jugs.toFixed(2)} bidones`;
    }
    return `${stock} ${product.unit}`;
  };

  // Format currency
  const formatCurrency = (cents: number | undefined) => {
    if (cents === undefined || cents === null) return '-';
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format movement type
  const formatMovementType = (type: string) => {
    const types: Record<string, string> = {
      in: 'Entrada',
      out: 'Salida',
      adjust: 'Ajuste',
    };
    return types[type] || type;
  };

  return (
    <div className="product-detail">
      <div className="product-detail-header">
        <div>
          <h2>{product.name}</h2>
          <div className="product-meta">
            {product.sku && <span className="badge">SKU: {product.sku}</span>}
            <span className="badge">{product.category}</span>
            <span className="badge">{product.unit}</span>
            {!product.active && <span className="badge inactive">Inactivo</span>}
          </div>
        </div>
        <div className="header-actions">
          {onEdit && (
            <button onClick={onEdit} className="btn-primary">
              Editar
            </button>
          )}
          {onAdjustStock && (
            <button onClick={onAdjustStock} className="btn-secondary">
              Ajustar Stock
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn-close">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="product-detail-body">
        {/* Stock Section */}
        <section className="detail-section">
          <h3>Stock</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Stock Actual</label>
              <div className={`value ${isLowStock ? 'low-stock' : ''}`}>
                {formatStock(currentStock)}
                {isLowStock && <span className="warning-badge">⚠️ Bajo mínimo</span>}
              </div>
            </div>
            <div className="info-item">
              <label>Stock Mínimo</label>
              <div className="value">
                {formatStock(product.minStock)}
              </div>
            </div>
          </div>
        </section>

        {/* Cost Section */}
        <section className="detail-section">
          <h3>Costo</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Costo Actual</label>
              <div className="value">
                {costDetails ? formatCurrency(costDetails.cost) : 'Sin datos'}
              </div>
            </div>
            {costDetails?.lastCost && (
              <>
                <div className="info-item">
                  <label>Última Compra</label>
                  <div className="value">{formatDate(costDetails.lastCost.date)}</div>
                </div>
              </>
            )}
            {costDetails?.weightedAvg && (
              <>
                <div className="info-item">
                  <label>Compras Consideradas</label>
                  <div className="value">
                    {costDetails.weightedAvg.purchaseCount} compras
                  </div>
                </div>
                <div className="info-item">
                  <label>Cantidad Total</label>
                  <div className="value">
                    {costDetails.weightedAvg.totalQty} {product.unit}
                  </div>
                </div>
              </>
            )}
            <div className="info-item">
              <label>Método de Cálculo</label>
              <div className="value">
                {costDetails?.method === 'last' ? 'Último costo' : 'Promedio ponderado'}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="detail-section">
          <h3>Precio y Margen</h3>
          <div className="info-grid">
            {/* LXL Cost Breakdown */}
            {isLXL && costDetails?.lxlDetails && (
              <>
                <div className="info-item">
                  <label>Costo Líquido (por litro)</label>
                  <div className="value">
                    {formatCurrency(costDetails.lxlDetails.liquidCostPerLiter)}
                  </div>
                </div>
                <div className="info-item">
                  <label>Costo Líquido ({costDetails.lxlDetails.packSizeLiters}L)</label>
                  <div className="value">
                    {formatCurrency(costDetails.lxlDetails.liquidCostForPack)}
                  </div>
                </div>
                {isLXL && (
                  <div className="info-item">
                    <label>Costo Bidón (BP-1)</label>
                    <div className="value">
                      {formatCurrency(costDetails.lxlDetails.jugCost)}
                    </div>
                  </div>
                )}
                {isLXL && (
                  <div className="info-item">
                    <label>Costo Botella (BP-3)</label>
                    <div className="value">
                      {formatCurrency(costDetails.lxlDetails.bottleCost)}
                    </div>
                  </div>
                )}
                <div className="info-item">
                  <label>Costo Efectivo Total (Bidón)</label>
                  <div className="value cost-total">
                    {formatCurrency(costDetails.cost)}
                  </div>
                </div>
                <div className="info-item">
                  <label>Costo Efectivo Total (Botella 1L)</label>
                  <div className="value cost-total">
                    {formatCurrency(costDetails.lxlDetails.effectiveCostPerBottle)}
                  </div>
                </div>
              </>
            )}
            {/* Standard Cost Display */}
            {!isLXL && costDetails && (
              <div className="info-item">
                <label>Costo</label>
                <div className="value">{formatCurrency(costDetails.cost)}</div>
              </div>
            )}
            
            {/* Pricing and Margins */}
            {isLXL && (dualMargin?.perJug || dualMargin?.perBottle) ? (
              <>
                {/* Per Liter Pricing */}
                <div className="info-item">
                  <label>Precio de Venta (suelto)</label>
                  <div className="value">{formatCurrency(product.salePriceCents)}</div>
                </div>
                <div className="info-item">
                  <label>Margen Suelto</label>
                  <div className={`value ${dualMargin.perLiter.marginPct < 0 ? 'negative' : ''}`}>
                    {formatCurrency(dualMargin.perLiter.marginCents)}
                  </div>
                </div>
                <div className="info-item">
                  <label>Margen % Suelto</label>
                  <div className={`value ${dualMargin.perLiter.marginPct < 0 ? 'negative' : ''}`}>
                    {dualMargin.perLiter.marginPct.toFixed(1)}%
                  </div>
                </div>
                
                {/* Per Jug Pricing */}
                {dualMargin.perJug && (
                  <>
                    <div className="info-item">
                      <label>Precio de Venta (por bidón)</label>
                      <div className="value">{formatCurrency(product.jugSalePriceCents)}</div>
                    </div>
                    <div className="info-item">
                      <label>Margen por Bidón</label>
                      <div className={`value ${dualMargin.perJug.marginPct < 0 ? 'negative' : ''}`}>
                        {formatCurrency(dualMargin.perJug.marginCents)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Margen % por Bidón</label>
                      <div className={`value ${dualMargin.perJug.marginPct < 0 ? 'negative' : ''}`}>
                        {dualMargin.perJug.marginPct.toFixed(1)}%
                      </div>
                    </div>
                  </>
                )}

                {/* Per Bottle Pricing */}
                {dualMargin.perBottle && (
                  <>
                    <div className="info-item">
                      <label>Precio de Venta (por botella 1L)</label>
                      <div className="value">{formatCurrency(product.bottleSalePriceCents)}</div>
                    </div>
                    <div className="info-item">
                      <label>Margen por Botella</label>
                      <div className={`value ${dualMargin.perBottle.marginPct < 0 ? 'negative' : ''}`}>
                        {formatCurrency(dualMargin.perBottle.marginCents)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Margen % por Botella</label>
                      <div className={`value ${dualMargin.perBottle.marginPct < 0 ? 'negative' : ''}`}>
                        {dualMargin.perBottle.marginPct.toFixed(1)}%
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Standard Single Pricing */}
                <div className="info-item">
                  <label>Precio de Venta</label>
                  <div className="value">{formatCurrency(product.salePriceCents)}</div>
                </div>
                {dualMargin?.perLiter && (
                  <>
                    <div className="info-item">
                      <label>Margen</label>
                      <div className={`value ${dualMargin.perLiter.marginPct < 0 ? 'negative' : ''}`}>
                        {formatCurrency(dualMargin.perLiter.marginCents)}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Margen %</label>
                      <div className={`value ${dualMargin.perLiter.marginPct < 0 ? 'negative' : ''}`}>
                        {dualMargin.perLiter.marginPct.toFixed(1)}%
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {/* Recent Movements */}
        <section className="detail-section">
          <h3>Movimientos Recientes</h3>
          {recentMovements.length === 0 ? (
            <p className="empty-message">No hay movimientos registrados</p>
          ) : (
            <div className="table-container">
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDate(movement.date)}</td>
                      <td>
                        <span className={`movement-type ${movement.type}`}>
                          {formatMovementType(movement.type)}
                        </span>
                      </td>
                      <td
                        className={
                          movement.type === 'out' || movement.qty < 0
                            ? 'negative'
                            : 'positive'
                        }
                      >
                        {movement.type === 'out' ? '-' : movement.qty < 0 ? '' : '+'}
                        {formatStock(Math.abs(movement.qty))}
                      </td>
                      <td>{movement.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Purchases */}
        <section className="detail-section">
          <h3>Compras Recientes</h3>
          {recentPurchases.length === 0 ? (
            <p className="empty-message">No hay compras registradas</p>
          ) : (
            <div className="table-container">
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cantidad</th>
                    <th>Costo Unitario</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.map(({ purchase, item }, index) => (
                    <tr key={`${purchase.id}-${index}`}>
                      <td>{formatDate(purchase.date)}</td>
                      <td>
                        {formatStock(item.qty)}
                      </td>
                      <td>{formatCurrency(item.unitCostCents)}</td>
                      <td>{formatCurrency(item.qty * item.unitCostCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
