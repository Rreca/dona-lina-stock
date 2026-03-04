import { useState, useEffect, useMemo } from 'react';
import type { Product, Unit, Purchase, Settings } from '../models/types';
import { productService } from '../services/product-service';
import { cacheService } from '../services/cache';
import { costService } from '../services/cost-service';
import { pricingService } from '../services/pricing-service';
import './ProductForm.css';

interface ProductFormProps {
  product?: Product | null;
  purchases?: Purchase[];
  settings?: Settings;
  onSave?: (product: Product) => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  category: string;
  unit: Unit;
  sku: string;
  minStock: string;
  salePriceCents: string;
  active: boolean;
  packSizeLiters: string;
  containerSku: string;
  jugSalePriceCents: string;
  bottleSku: string;
  bottleSalePriceCents: string;
}

interface FormErrors {
  name?: string;
  category?: string;
  unit?: string;
  sku?: string;
  minStock?: string;
  salePriceCents?: string;
  packSizeLiters?: string;
  containerSku?: string;
  jugSalePriceCents?: string;
  bottleSku?: string;
  bottleSalePriceCents?: string;
  general?: string;
}

export function ProductForm({ product, purchases, settings, onSave, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: '',
    unit: 'unit',
    sku: '',
    minStock: '0',
    salePriceCents: '',
    active: true,
    packSizeLiters: '',
    containerSku: '',
    jugSalePriceCents: '',
    bottleSku: '',
    bottleSalePriceCents: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [currentSettings, setCurrentSettings] = useState<Settings | null>(null);

  // Load existing categories, products, and optionally purchases/settings if not provided
  useEffect(() => {
    const loadData = async () => {
      try {
        const products = await productService.getAll();
        const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
        setExistingCategories(categories.sort());
        setAllProducts(products);

        // Use provided purchases or load from cache
        if (purchases) {
          setAllPurchases(purchases);
        } else {
          const cachedPurchases = await cacheService.getPurchases();
          setAllPurchases(cachedPurchases);
        }

        // Use provided settings or load from cache
        if (settings) {
          setCurrentSettings(settings);
        } else {
          const cachedSettings = await cacheService.getSettings();
          setCurrentSettings(cachedSettings || {
            costMethod: 'last',
            weightedAvgWindow: { type: 'last_n_purchases', value: 5 },
            priceRule: { markupPct: 30, roundToCents: 10, minMarginPct: 20 },
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, [purchases, settings]);

  // Load product data if editing
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        unit: product.unit,
        sku: product.sku || '',
        minStock: product.minStock.toString(),
        salePriceCents: product.salePriceCents
          ? (product.salePriceCents / 100).toFixed(2)
          : '',
        active: product.active,
        packSizeLiters: product.packSizeLiters?.toString() || '',
        containerSku: product.containerSku || '',
        jugSalePriceCents: product.jugSalePriceCents
          ? (product.jugSalePriceCents / 100).toFixed(2)
          : '',
        bottleSku: product.bottleSku || '',
        bottleSalePriceCents: product.bottleSalePriceCents
          ? (product.bottleSalePriceCents / 100).toFixed(2)
          : '',
      });
    }
  }, [product]);

  // Calculate real-time margins as user types
  const realTimeMargins = useMemo(() => {
    if (!currentSettings || allPurchases.length === 0 || allProducts.length === 0) {
      return {
        perLiter: null,
        perJug: null,
        perBottle: null,
        hasCostData: false,
      };
    }

    // Create a temporary product object with current form values
    const tempProduct: Partial<Product> = {
      id: product?.id || 'temp',
      sku: formData.sku,
      salePriceCents: formData.salePriceCents.trim()
        ? Math.round(parseFloat(formData.salePriceCents) * 100)
        : undefined,
      jugSalePriceCents: formData.jugSalePriceCents.trim()
        ? Math.round(parseFloat(formData.jugSalePriceCents) * 100)
        : undefined,
      bottleSalePriceCents: formData.bottleSalePriceCents.trim()
        ? Math.round(parseFloat(formData.bottleSalePriceCents) * 100)
        : undefined,
      packSizeLiters: formData.packSizeLiters.trim()
        ? parseFloat(formData.packSizeLiters)
        : undefined,
    };

    // Check if we have cost data
    const hasCostData = product?.id
      ? costService.hasCostData(product.id, allPurchases)
      : false;

    if (!hasCostData || !product?.id) {
      return {
        perLiter: null,
        perJug: null,
        perBottle: null,
        hasCostData: false,
      };
    }

    // Calculate margins using the pricing service
    const isLXL = formData.sku.startsWith('LXL-');

    if (isLXL) {
      // For LXL products, calculate dual margins
      const dualMargin = pricingService.calculateDualMargin(
        { ...product, ...tempProduct } as Product,
        allPurchases,
        allProducts,
        currentSettings
      );

      return {
        perLiter: dualMargin?.perLiter || null,
        perJug: dualMargin?.perJug || null,
        perBottle: dualMargin?.perBottle || null,
        hasCostData: true,
      };
    } else {
      // For non-LXL products, calculate single margin
      const margin = pricingService.calculateMargin(
        { ...product, ...tempProduct } as Product,
        allPurchases,
        allProducts,
        currentSettings
      );

      return {
        perLiter: margin,
        perJug: null,
        perBottle: null,
        hasCostData: true,
      };
    }
  }, [
    formData.salePriceCents,
    formData.jugSalePriceCents,
    formData.bottleSalePriceCents,
    formData.packSizeLiters,
    formData.sku,
    product,
    allPurchases,
    allProducts,
    currentSettings,
  ]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Validate category
    if (!formData.category.trim()) {
      newErrors.category = 'La categoría es requerida';
    }

    // Validate minStock
    const minStock = parseFloat(formData.minStock);
    if (isNaN(minStock) || minStock < 0) {
      newErrors.minStock = 'El stock mínimo debe ser un número mayor o igual a 0';
    }

    // Validate salePriceCents (optional)
    if (formData.salePriceCents.trim()) {
      const salePrice = parseFloat(formData.salePriceCents);
      if (isNaN(salePrice) || salePrice < 0) {
        newErrors.salePriceCents = 'El precio debe ser un número mayor o igual a 0';
      }
    }

    // Validate jugSalePriceCents (optional)
    if (formData.jugSalePriceCents.trim()) {
      const jugSalePrice = parseFloat(formData.jugSalePriceCents);
      if (isNaN(jugSalePrice) || jugSalePrice < 0) {
        newErrors.jugSalePriceCents = 'El precio por bidón debe ser un número mayor o igual a 0';
      }
    }

    // Validate bottleSalePriceCents (optional)
    if (formData.bottleSalePriceCents.trim()) {
      const bottleSalePrice = parseFloat(formData.bottleSalePriceCents);
      if (isNaN(bottleSalePrice) || bottleSalePrice < 0) {
        newErrors.bottleSalePriceCents = 'El precio por botella debe ser un número mayor o igual a 0';
      }
    }

    // Validate packSizeLiters (optional, but must be positive if provided)
    if (formData.packSizeLiters.trim()) {
      const packSize = parseFloat(formData.packSizeLiters);
      if (isNaN(packSize) || packSize <= 0) {
        newErrors.packSizeLiters = 'El tamaño del bidón debe ser un número mayor a 0';
      }
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
      // Convert form data to product data
      const productData: any = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        unit: formData.unit,
        sku: formData.sku.trim() || (product?.sku) || undefined,
        minStock: parseFloat(formData.minStock),
        salePriceCents: formData.salePriceCents.trim()
          ? Math.round(parseFloat(formData.salePriceCents) * 100)
          : undefined,
        active: formData.active,
      };

      // Add LXL fields only if defined
      if (formData.packSizeLiters.trim()) {
        productData.packSizeLiters = parseFloat(formData.packSizeLiters);
      }
      // containerSku and bottleSku are auto-generated, not saved from form
      if (formData.jugSalePriceCents.trim()) {
        productData.jugSalePriceCents = Math.round(parseFloat(formData.jugSalePriceCents) * 100);
      }
      if (formData.bottleSalePriceCents.trim()) {
        productData.bottleSalePriceCents = Math.round(parseFloat(formData.bottleSalePriceCents) * 100);
      }

      let savedProduct: Product;

      if (product) {
        // Update existing product
        savedProduct = await productService.update(product.id, productData);
      } else {
        // Create new product
        savedProduct = await productService.create(productData);
      }

      setSaveSuccess(true);

      // Call onSave callback
      if (onSave) {
        onSave(savedProduct);
      }

      // Reset form if creating new product
      if (!product) {
        setFormData({
          name: '',
          category: '',
          unit: 'unit',
          sku: '',
          minStock: '0',
          salePriceCents: '',
          active: true,
          packSizeLiters: '',
          containerSku: '',
          jugSalePriceCents: '',
          bottleSku: '',
          bottleSalePriceCents: '',
        });
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar el producto',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="product-form" role="form" aria-label={product ? 'Editar producto' : 'Crear nuevo producto'}>
      <h3>{product ? 'Editar Producto' : 'Nuevo Producto'}</h3>

      {saveSuccess && (
        <div className="alert alert-success" role="alert" aria-live="polite">
          Producto guardado exitosamente
        </div>
      )}

      {errors.general && (
        <div className="alert alert-error" role="alert" aria-live="assertive">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">
              Nombre <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
              disabled={saving}
              aria-required="true"
              aria-invalid={errors.name ? 'true' : 'false'}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && <span className="error-message" id="name-error" role="alert">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="category">
              Categoría <span className="required">*</span>
            </label>
            <input
              type="text"
              id="category"
              name="category"
              list="categories-list"
              value={formData.category}
              onChange={handleChange}
              className={errors.category ? 'error' : ''}
              disabled={saving}
              placeholder="Selecciona o escribe una categoría..."
              aria-required="true"
              aria-invalid={errors.category ? 'true' : 'false'}
              aria-describedby={errors.category ? 'category-error' : undefined}
            />
            <datalist id="categories-list">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {errors.category && (
              <span className="error-message" id="category-error" role="alert">{errors.category}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="unit">
              Unidad <span className="required">*</span>
            </label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              disabled={saving}
              aria-required="true"
              aria-label="Seleccionar unidad de medida"
            >
              <option value="unit">Unidad</option>
              <option value="kg">Kilogramo (kg)</option>
              <option value="lt">Litro (lt)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sku">SKU / Código</label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              className={errors.sku ? 'error' : ''}
              disabled={saving}
              placeholder="Se auto-generará si se deja vacío"
              aria-invalid={errors.sku ? 'true' : 'false'}
              aria-describedby={errors.sku ? 'sku-error' : undefined}
            />
            {errors.sku && <span className="error-message" id="sku-error" role="alert">{errors.sku}</span>}
          </div>
        </div>

        {/* LXL Product Fields - Show only if SKU starts with "LXL-" */}
        {formData.sku.startsWith('LXL-') && (
          <div className="form-section lxl-fields">
            <h4>Configuración de Bidones y Botellas (Productos LXL)</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="packSizeLiters">Tamaño del Bidón (litros)</label>
                <input
                  type="number"
                  id="packSizeLiters"
                  name="packSizeLiters"
                  value={formData.packSizeLiters}
                  onChange={handleChange}
                  className={errors.packSizeLiters ? 'error' : ''}
                  disabled={saving}
                  min="0.01"
                  step="0.01"
                  placeholder="5"
                  aria-invalid={errors.packSizeLiters ? 'true' : 'false'}
                  aria-describedby={errors.packSizeLiters ? 'packSizeLiters-error' : undefined}
                />
                {errors.packSizeLiters && (
                  <span className="error-message" id="packSizeLiters-error" role="alert">
                    {errors.packSizeLiters}
                  </span>
                )}
                <small className="field-hint">Por defecto: 5 litros</small>
              </div>

              <div className="form-group">
                <label htmlFor="containerSku">SKU del Bidón (fijo)</label>
                <input
                  type="text"
                  id="containerSku"
                  name="containerSku"
                  value="BP-1"
                  disabled={true}
                  readOnly={true}
                  className="readonly-field"
                  placeholder="BP-1"
                  aria-readonly="true"
                />
                <small className="field-hint">SKU fijo para todos los bidones: BP-1</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bottleSku">SKU de la Botella 1L (fijo)</label>
                <input
                  type="text"
                  id="bottleSku"
                  name="bottleSku"
                  value="BP-3"
                  disabled={true}
                  readOnly={true}
                  className="readonly-field"
                  placeholder="BP-3"
                  aria-readonly="true"
                />
                <small className="field-hint">SKU fijo para todas las botellas: BP-3</small>
              </div>

              <div className="form-group"></div>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="salePriceCents">Precio de Venta Suelto ($)</label>
            <input
              type="number"
              id="salePriceCents"
              name="salePriceCents"
              value={formData.salePriceCents}
              onChange={handleChange}
              className={errors.salePriceCents ? 'error' : ''}
              disabled={saving}
              min="0"
              step="0.01"
              placeholder="0.00"
              aria-invalid={errors.salePriceCents ? 'true' : 'false'}
              aria-describedby={errors.salePriceCents ? 'salePriceCents-error' : undefined}
            />
            {errors.salePriceCents && (
              <span className="error-message" id="salePriceCents-error" role="alert">{errors.salePriceCents}</span>
            )}
            {/* Real-time margin preview */}
            {realTimeMargins.hasCostData && realTimeMargins.perLiter && formData.salePriceCents.trim() && (
              <div className="margin-preview">
                <span className={realTimeMargins.perLiter.marginCents < 0 ? 'margin-negative' : 'margin-positive'}>
                  Margen: ${(realTimeMargins.perLiter.marginCents / 100).toFixed(2)} ({realTimeMargins.perLiter.marginPct.toFixed(1)}%)
                </span>
              </div>
            )}
            {!realTimeMargins.hasCostData && formData.salePriceCents.trim() && (
              <div className="margin-preview">
                <span className="margin-no-data">Sin historial de compras</span>
              </div>
            )}
          </div>

          {formData.sku.startsWith('LXL-') && (
            <div className="form-group">
              <label htmlFor="jugSalePriceCents">Precio de Venta por Bidón ($)</label>
              <input
                type="number"
                id="jugSalePriceCents"
                name="jugSalePriceCents"
                value={formData.jugSalePriceCents}
                onChange={handleChange}
                className={errors.jugSalePriceCents ? 'error' : ''}
                disabled={saving}
                min="0"
                step="0.01"
                placeholder="0.00"
                aria-invalid={errors.jugSalePriceCents ? 'true' : 'false'}
                aria-describedby={errors.jugSalePriceCents ? 'jugSalePriceCents-error' : undefined}
              />
              {errors.jugSalePriceCents && (
                <span className="error-message" id="jugSalePriceCents-error" role="alert">{errors.jugSalePriceCents}</span>
              )}
              {/* Real-time margin preview for jug */}
              {realTimeMargins.hasCostData && realTimeMargins.perJug && formData.jugSalePriceCents.trim() && (
                <div className="margin-preview">
                  <span className={realTimeMargins.perJug.marginCents < 0 ? 'margin-negative' : 'margin-positive'}>
                    Margen: ${(realTimeMargins.perJug.marginCents / 100).toFixed(2)} ({realTimeMargins.perJug.marginPct.toFixed(1)}%)
                  </span>
                </div>
              )}
              {!realTimeMargins.hasCostData && formData.jugSalePriceCents.trim() && (
                <div className="margin-preview">
                  <span className="margin-no-data">Sin historial de compras</span>
                </div>
              )}
            </div>
          )}
        </div>

        {formData.sku.startsWith('LXL-') && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="bottleSalePriceCents">Precio de Venta por Botella 1L ($)</label>
              <input
                type="number"
                id="bottleSalePriceCents"
                name="bottleSalePriceCents"
                value={formData.bottleSalePriceCents}
                onChange={handleChange}
                className={errors.bottleSalePriceCents ? 'error' : ''}
                disabled={saving}
                min="0"
                step="0.01"
                placeholder="0.00"
                aria-invalid={errors.bottleSalePriceCents ? 'true' : 'false'}
                aria-describedby={errors.bottleSalePriceCents ? 'bottleSalePriceCents-error' : undefined}
              />
              {errors.bottleSalePriceCents && (
                <span className="error-message" id="bottleSalePriceCents-error" role="alert">{errors.bottleSalePriceCents}</span>
              )}
              {/* Real-time margin preview for bottle */}
              {realTimeMargins.hasCostData && realTimeMargins.perBottle && formData.bottleSalePriceCents.trim() && (
                <div className="margin-preview">
                  <span className={realTimeMargins.perBottle.marginCents < 0 ? 'margin-negative' : 'margin-positive'}>
                    Margen: ${(realTimeMargins.perBottle.marginCents / 100).toFixed(2)} ({realTimeMargins.perBottle.marginPct.toFixed(1)}%)
                  </span>
                </div>
              )}
              {!realTimeMargins.hasCostData && formData.bottleSalePriceCents.trim() && (
                <div className="margin-preview">
                  <span className="margin-no-data">Sin historial de compras</span>
                </div>
              )}
            </div>

            <div className="form-group"></div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="minStock">
              Stock Mínimo <span className="required">*</span>
            </label>
            <input
              type="number"
              id="minStock"
              name="minStock"
              value={formData.minStock}
              onChange={handleChange}
              className={errors.minStock ? 'error' : ''}
              disabled={saving}
              min="0"
              step="0.01"
              aria-required="true"
              aria-invalid={errors.minStock ? 'true' : 'false'}
              aria-describedby={errors.minStock ? 'minStock-error' : undefined}
            />
            {errors.minStock && (
              <span className="error-message" id="minStock-error" role="alert">{errors.minStock}</span>
            )}
          </div>

          <div className="form-group"></div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
              disabled={saving}
              aria-label="Marcar producto como activo"
            />
            <span>Producto activo</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
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
