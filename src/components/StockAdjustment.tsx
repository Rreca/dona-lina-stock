import { useState, useEffect, useMemo } from 'react';
import type { Product, StockMovement } from '../models/types';
import { productService } from '../services/product-service';
import { movementService } from '../services/movement-service';
import { debounce } from '../utils/debounce';
import './StockAdjustment.css';

interface StockAdjustmentProps {
  movements: StockMovement[];
  onSave?: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => Promise<void>;
  onCancel?: () => void;
}

interface FormData {
  date: string;
  productId: string;
  newStock: string;
  reason: string;
  // Liquid deduction fields
  deductLiquid: boolean;
  liquidProductId: string;
  liquidQty: string;
}

interface FormErrors {
  date?: string;
  productId?: string;
  newStock?: string;
  reason?: string;
  general?: string;
}

export function StockAdjustment({ movements, onSave, onCancel }: StockAdjustmentProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().slice(0, 16),
    productId: '',
    newStock: '',
    reason: '',
    // Liquid deduction defaults
    deductLiquid: true,
    liquidProductId: '',
    liquidQty: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showAdjustmentHistory, setShowAdjustmentHistory] = useState(false);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const allProducts = await productService.getAll();
      setProducts(allProducts.filter((p) => p.active));
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Calculate current stock for selected product
  const currentStock = useMemo(() => {
    if (!formData.productId) return 0;
    return movementService.calculateStock(formData.productId, movements);
  }, [formData.productId, movements]);

  // Calculate adjustment quantity
  const adjustmentQty = useMemo(() => {
    if (!formData.newStock) return 0;
    const newStock = parseFloat(formData.newStock);
    if (isNaN(newStock)) return 0;
    return newStock - currentStock;
  }, [formData.newStock, currentStock]);

  // Get selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === formData.productId);
  }, [products, formData.productId]);

  // Check if selected product is a plastic bottle
  const isPlasticBottle = useMemo(() => {
    return selectedProduct?.category === 'Botella Plastica';
  }, [selectedProduct]);

  // Get liquid products for selection
  const liquidProducts = useMemo(() => {
    return products.filter((p) => p.category === 'Liquidos');
  }, [products]);

  // Calculate liquid quantity based on bottle SKU
  const calculateLiquidQty = (bottleQty: number, bottleSku: string | undefined): number => {
    if (!bottleSku) return 0;
    
    switch (bottleSku) {
      case 'BP-4':
        return bottleQty * 20;
      case 'BP-1':
        return bottleQty * 5;
      case 'BP-3':
        return bottleQty * 1;
      case 'BP-2':
        return bottleQty * 20;
      default:
        return 0;
    }
  };

  // Auto-calculate liquid quantity when adjustment quantity changes
  useEffect(() => {
    if (isPlasticBottle && formData.deductLiquid && adjustmentQty < 0 && selectedProduct?.sku) {
      // Only auto-calculate for negative adjustments (stock reduction)
      const calculatedLiquidQty = calculateLiquidQty(Math.abs(adjustmentQty), selectedProduct.sku);
      setFormData(prev => ({
        ...prev,
        liquidQty: calculatedLiquidQty.toString()
      }));
    }
  }, [adjustmentQty, formData.productId, formData.deductLiquid, isPlasticBottle, selectedProduct?.sku]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
    );
  }, [products, productSearch]);

  // Get adjustment history for selected product
  const adjustmentHistory = useMemo(() => {
    if (!formData.productId) return [];
    return movements
      .filter((m) => m.productId === formData.productId && m.type === 'adjust')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Show last 10 adjustments
  }, [movements, formData.productId]);

  // Debounced product search
  const debouncedProductSearch = useMemo(
    () =>
      debounce((query: string) => {
        setProductSearch(query);
      }, 200),
    []
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedProductSearch(value);
    setShowProductDropdown(true);
  };

  const handleProductSelect = (product: Product) => {
    setFormData((prev) => ({ ...prev, productId: product.id }));
    setProductSearch(product.name);
    setShowProductDropdown(false);
    setErrors((prev) => ({ ...prev, productId: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate date
    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    // Validate product
    if (!formData.productId) {
      newErrors.productId = 'Debe seleccionar un producto';
    }

    // Validate new stock
    const newStock = parseFloat(formData.newStock);
    if (!formData.newStock || isNaN(newStock)) {
      newErrors.newStock = 'El nuevo stock es requerido';
    } else if (newStock < 0) {
      newErrors.newStock = 'El stock no puede ser negativo';
    }

    // Validate reason (required for adjustments)
    if (!formData.reason.trim()) {
      newErrors.reason = 'La razón del ajuste es requerida para auditoría';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setErrors({});
    setSaveSuccess(false);

    try {
      // Create adjustment movement data
      const movementData = {
        date: new Date(formData.date).toISOString(),
        productId: formData.productId,
        type: 'adjust' as const,
        qty: adjustmentQty,
        note: `Ajuste manual: ${formData.reason.trim()}`,
      };

      // Call onSave callback for adjustment movement
      if (onSave) {
        await onSave(movementData);
      }

      // If deducting liquid from plastic bottle (negative adjustment), create second movement
      if (isPlasticBottle && adjustmentQty < 0 && formData.deductLiquid && formData.liquidProductId && formData.liquidQty) {
        const liquidQty = parseFloat(formData.liquidQty);
        if (!isNaN(liquidQty) && liquidQty > 0) {
          const liquidMovementData = {
            date: new Date(formData.date).toISOString(),
            productId: formData.liquidProductId,
            type: 'adjust' as const,
            qty: -liquidQty, // Negative for deduction
            note: `Descuento automático por ${selectedProduct?.name || 'botella'}: ${formData.reason.trim()}`,
          };
          
          if (onSave) {
            await onSave(liquidMovementData);
          }
        }
      }

      setSaveSuccess(true);

      // Reset form
      setFormData({
        date: new Date().toISOString().slice(0, 16),
        productId: '',
        newStock: '',
        reason: '',
        deductLiquid: true,
        liquidProductId: '',
        liquidQty: '',
      });
      setProductSearch('');
    } catch (error) {
      console.error('Failed to save adjustment:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar el ajuste',
      });
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="stock-adjustment">
      <h3>Ajuste de Stock</h3>
      <p className="adjustment-description">
        Use esta función para corregir discrepancias en el stock. Todos los ajustes quedan
        registrados para auditoría.
      </p>

      {saveSuccess && (
        <div className="alert alert-success">Ajuste guardado exitosamente</div>
      )}

      {errors.general && <div className="alert alert-error">{errors.general}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="date">
            Fecha y Hora <span className="required">*</span>
          </label>
          <input
            type="datetime-local"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={errors.date ? 'error' : ''}
            disabled={saving}
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="product-search">
            Producto <span className="required">*</span>
          </label>
          <div className="product-search-container">
            <input
              type="text"
              id="product-search"
              placeholder="Buscar producto por nombre o SKU..."
              value={productSearch}
              onChange={handleProductSearchChange}
              onFocus={() => setShowProductDropdown(true)}
              className={errors.productId ? 'error' : ''}
              disabled={saving}
            />
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="product-dropdown">
                {filteredProducts.slice(0, 10).map((product) => (
                  <div
                    key={product.id}
                    className="product-dropdown-item"
                    onClick={() => handleProductSelect(product)}
                  >
                    <span className="product-name">{product.name}</span>
                    {product.sku && <span className="product-sku">SKU: {product.sku}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.productId && <span className="error-message">{errors.productId}</span>}
        </div>

        {selectedProduct && (
          <>
            <div className="stock-comparison">
              <div className="stock-comparison-item">
                <span className="label">Stock actual:</span>
                <span className="value current">{currentStock} {selectedProduct.unit}</span>
              </div>
              <div className="stock-comparison-arrow">→</div>
              <div className="stock-comparison-item">
                <span className="label">Nuevo stock:</span>
                <input
                  type="number"
                  name="newStock"
                  value={formData.newStock}
                  onChange={handleChange}
                  className={errors.newStock ? 'error' : ''}
                  disabled={saving}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            {errors.newStock && <span className="error-message">{errors.newStock}</span>}

            {adjustmentQty !== 0 && !isNaN(adjustmentQty) && (
              <div className={`adjustment-preview ${adjustmentQty > 0 ? 'positive' : 'negative'}`}>
                <strong>Ajuste:</strong> {adjustmentQty > 0 ? '+' : ''}{adjustmentQty} {selectedProduct.unit}
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label htmlFor="reason">
            Razón del Ajuste <span className="required">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            className={errors.reason ? 'error' : ''}
            disabled={saving}
            rows={3}
            placeholder="Ej: Inventario físico, producto dañado, error de carga..."
          />
          {errors.reason && <span className="error-message">{errors.reason}</span>}
          <span className="field-hint">
            Esta información es importante para auditoría y trazabilidad
          </span>
        </div>

        {/* Liquid deduction section - only for plastic bottles on negative adjustments */}
        {isPlasticBottle && adjustmentQty < 0 && (
          <div className="liquid-deduction-section">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="deductLiquid"
                  checked={formData.deductLiquid}
                  onChange={(e) => setFormData(prev => ({ ...prev, deductLiquid: e.target.checked }))}
                  disabled={saving}
                />
                <span>Descontar líquido</span>
              </label>
            </div>

            {formData.deductLiquid && (
              <>
                <div className="form-group">
                  <label htmlFor="liquidProduct">
                    Producto Líquido <span className="required">*</span>
                  </label>
                  <select
                    id="liquidProduct"
                    name="liquidProductId"
                    value={formData.liquidProductId}
                    onChange={handleChange}
                    disabled={saving}
                    aria-required="true"
                  >
                    <option value="">Seleccione un líquido...</option>
                    {liquidProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.sku ? `(${product.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="liquidQty">
                    Cantidad de Líquido (Litros) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    id="liquidQty"
                    name="liquidQty"
                    value={formData.liquidQty}
                    onChange={handleChange}
                    disabled={saving}
                    step="0.01"
                    placeholder="0.00"
                    aria-required="true"
                  />
                  <span className="field-hint">
                    Cantidad calculada automáticamente según el SKU de la botella (editable)
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Ajuste'}
          </button>
          {onCancel && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Adjustment History */}
      {selectedProduct && adjustmentHistory.length > 0 && (
        <div className="adjustment-history">
          <div className="history-header">
            <h4>Historial de Ajustes</h4>
            <button
              type="button"
              className="btn-toggle"
              onClick={() => setShowAdjustmentHistory(!showAdjustmentHistory)}
            >
              {showAdjustmentHistory ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {showAdjustmentHistory && (
            <div className="history-list">
              {adjustmentHistory.map((adjustment) => (
                <div key={adjustment.id} className="history-item">
                  <div className="history-date">{formatDate(adjustment.date)}</div>
                  <div className={`history-qty ${adjustment.qty > 0 ? 'positive' : 'negative'}`}>
                    {adjustment.qty > 0 ? '+' : ''}{adjustment.qty} {selectedProduct.unit}
                  </div>
                  <div className="history-note">{adjustment.note || 'Sin nota'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
