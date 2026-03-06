import { useState, useEffect, useMemo } from 'react';
import type { Product, MovementType, StockMovement } from '../models/types';
import { productService } from '../services/product-service';
import { movementService } from '../services/movement-service';
import { debounce } from '../utils/debounce';
import './MovementForm.css';

interface MovementFormProps {
  movements: StockMovement[];
  onSave?: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => Promise<void>;
  onCancel?: () => void;
}

interface FormData {
  date: string;
  productId: string;
  type: MovementType;
  qty: string;
  note: string;
  // Liquid deduction fields
  deductLiquid: boolean;
  liquidProductId: string;
  liquidQty: string;
}

interface FormErrors {
  date?: string;
  productId?: string;
  type?: string;
  qty?: string;
  general?: string;
}

export function MovementForm({ movements, onSave, onCancel }: MovementFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm format
    productId: '',
    type: 'in',
    qty: '',
    note: '',
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

  // Calculate stock after movement
  const stockAfterMovement = useMemo(() => {
    if (!formData.productId || !formData.qty) return currentStock;
    
    const qty = parseFloat(formData.qty);
    if (isNaN(qty)) return currentStock;

    switch (formData.type) {
      case 'in':
        return currentStock + qty;
      case 'out':
        return currentStock - qty;
      case 'adjust':
        return currentStock + qty;
      default:
        return currentStock;
    }
  }, [formData.productId, formData.type, formData.qty, currentStock]);

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

  // Auto-calculate liquid quantity when bottle quantity or product changes
  useEffect(() => {
    if (isPlasticBottle && formData.deductLiquid && formData.qty && selectedProduct?.sku) {
      const bottleQty = parseFloat(formData.qty);
      if (!isNaN(bottleQty)) {
        const calculatedLiquidQty = calculateLiquidQty(bottleQty, selectedProduct.sku);
        setFormData(prev => ({
          ...prev,
          liquidQty: calculatedLiquidQty.toString()
        }));
      }
    }
  }, [formData.qty, formData.productId, formData.deductLiquid, isPlasticBottle, selectedProduct?.sku]);

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

  // Debounced product search
  const debouncedProductSearch = useMemo(
    () =>
      debounce((query: string) => {
        setProductSearch(query);
      }, 200),
    []
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

    // Validate quantity
    const qty = parseFloat(formData.qty);
    if (!formData.qty || isNaN(qty)) {
      newErrors.qty = 'La cantidad es requerida';
    } else if (formData.type === 'adjust') {
      // For adjustments, allow negative values but not zero
      if (qty === 0) {
        newErrors.qty = 'El ajuste no puede ser 0';
      }
    } else if (qty <= 0) {
      newErrors.qty = 'La cantidad debe ser mayor a 0';
    } else if (formData.type === 'out' && qty > currentStock) {
      newErrors.qty = `No hay suficiente stock (disponible: ${currentStock})`;
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
      // Create bottle movement data
      const movementData = {
        date: new Date(formData.date).toISOString(),
        productId: formData.productId,
        type: formData.type,
        qty: parseFloat(formData.qty),
        note: formData.note.trim() || undefined,
      };

      console.log('Saving bottle movement:', movementData);

      // Call onSave callback for bottle movement
      if (onSave) {
        await onSave(movementData);
        console.log('Bottle movement saved successfully');
      }

      // If deducting liquid from plastic bottle, create second movement
      if (isPlasticBottle && formData.deductLiquid && formData.liquidProductId && formData.liquidQty) {
        console.log('Checking liquid deduction conditions:', {
          isPlasticBottle,
          deductLiquid: formData.deductLiquid,
          liquidProductId: formData.liquidProductId,
          liquidQty: formData.liquidQty
        });
        
        const liquidQty = parseFloat(formData.liquidQty);
        if (!isNaN(liquidQty) && liquidQty > 0) {
          const liquidMovementData = {
            date: new Date(formData.date).toISOString(),
            productId: formData.liquidProductId,
            type: formData.type,
            qty: liquidQty,
            note: `Descuento automático por ${selectedProduct?.name || 'botella'}: ${formData.note.trim() || 'sin nota'}`,
          };
          
          console.log('Saving liquid movement:', liquidMovementData);
          
          if (onSave) {
            await onSave(liquidMovementData);
            console.log('Liquid movement saved successfully');
          }
        }
      }

      setSaveSuccess(true);

      // Reset form
      setFormData({
        date: new Date().toISOString().slice(0, 16),
        productId: '',
        type: 'in',
        qty: '',
        note: '',
        deductLiquid: true,
        liquidProductId: '',
        liquidQty: '',
      });
      setProductSearch('');
    } catch (error) {
      console.error('Failed to save movement:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar el movimiento',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="movement-form" role="form" aria-label="Crear nuevo movimiento de stock">
      <h3>Nuevo Movimiento</h3>

      {saveSuccess && (
        <div className="alert alert-success" role="alert" aria-live="polite">Movimiento guardado exitosamente</div>
      )}

      {errors.general && <div className="alert alert-error" role="alert" aria-live="assertive">{errors.general}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
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
              aria-required="true"
              aria-invalid={errors.date ? 'true' : 'false'}
              aria-describedby={errors.date ? 'date-error' : undefined}
            />
            {errors.date && <span className="error-message" id="date-error" role="alert">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="type">
              Tipo de Movimiento <span className="required">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={saving}
              aria-required="true"
              aria-label="Seleccionar tipo de movimiento"
            >
              <option value="in">Entrada</option>
              <option value="out">Salida</option>
              <option value="adjust">Ajuste</option>
            </select>
          </div>
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
              aria-required="true"
              aria-invalid={errors.productId ? 'true' : 'false'}
              aria-describedby={errors.productId ? 'product-error' : undefined}
              aria-autocomplete="list"
              aria-controls="product-dropdown"
              aria-expanded={showProductDropdown && filteredProducts.length > 0}
              role="combobox"
            />
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="product-dropdown" id="product-dropdown" role="listbox" aria-label="Productos disponibles">
                {filteredProducts.slice(0, 10).map((product) => (
                  <div
                    key={product.id}
                    className="product-dropdown-item"
                    onClick={() => handleProductSelect(product)}
                    role="option"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleProductSelect(product);
                      }
                    }}
                  >
                    <span className="product-name">{product.name}</span>
                    {product.sku && <span className="product-sku">SKU: {product.sku}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.productId && <span className="error-message" id="product-error" role="alert">{errors.productId}</span>}
        </div>

        {selectedProduct && (
          <div className="stock-info" role="status" aria-live="polite" aria-label="Información de stock">
            <div className="stock-info-item">
              <span className="label">Stock actual:</span>
              <span className="value">{currentStock} {selectedProduct.unit}</span>
            </div>
            <div className="stock-info-item">
              <span className="label">Stock después del movimiento:</span>
              <span className={`value ${stockAfterMovement < 0 ? 'negative' : ''}`}>
                {stockAfterMovement} {selectedProduct.unit}
              </span>
            </div>
            {selectedProduct.minStock > 0 && stockAfterMovement < selectedProduct.minStock && (
              <div className="stock-warning" role="alert">
                ⚠️ El stock quedará por debajo del mínimo ({selectedProduct.minStock})
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="qty">
            Cantidad <span className="required">*</span>
          </label>
          <input
            type="number"
            id="qty"
            name="qty"
            value={formData.qty}
            onChange={handleChange}
            className={errors.qty ? 'error' : ''}
            disabled={saving}
            step="0.01"
            placeholder="0.00"
            aria-required="true"
            aria-invalid={errors.qty ? 'true' : 'false'}
            aria-describedby={errors.qty ? 'qty-error' : undefined}
          />
          {errors.qty && <span className="error-message" id="qty-error" role="alert">{errors.qty}</span>}
        </div>

        {/* Liquid deduction section - only for plastic bottles on out/adjust */}
        {isPlasticBottle && (formData.type === 'out' || formData.type === 'adjust') && (
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

        <div className="form-group">
          <label htmlFor="note">Nota (opcional)</label>
          <textarea
            id="note"
            name="note"
            value={formData.note}
            onChange={handleChange}
            disabled={saving}
            rows={3}
            placeholder="Agregar nota o comentario..."
            aria-label="Nota opcional sobre el movimiento"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Guardando...' : 'Guardar Movimiento'}
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
    </div>
  );
}
