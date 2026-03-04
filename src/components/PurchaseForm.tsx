import { useState, useEffect, useMemo } from 'react';
import type { Product, Supplier, Purchase, PurchaseItem } from '../models/types';
import { productService } from '../services/product-service';
import { purchaseService } from '../services/purchase-service';
import { formatNumber } from '../utils/format';
import './PurchaseForm.css';

interface PurchaseFormProps {
  suppliers: Supplier[];
  purchase?: Purchase;
  onSave?: (purchase: Purchase) => void;
  onCancel?: () => void;
  onSupplierCreate?: (supplier: Supplier) => void;
}

interface FormData {
  date: string;
  supplierId: string;
  newSupplierName: string;
  note: string;
}

interface PurchaseItemForm {
  id: string;
  productId: string;
  productSearch: string;
  qty: string;
  unitCostCents: string;
}

interface FormErrors {
  date?: string;
  supplierId?: string;
  items?: string;
  general?: string;
}

export function PurchaseForm({ suppliers, purchase, onSave, onCancel, onSupplierCreate }: PurchaseFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<FormData>({
    date: purchase?.date ? new Date(purchase.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    supplierId: purchase?.supplierId || '',
    newSupplierName: '',
    note: purchase?.note || '',
  });
  const [items, setItems] = useState<PurchaseItemForm[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Initialize items when purchase or products change
  useEffect(() => {
    if (purchase && products.length > 0) {
      const initialItems: PurchaseItemForm[] = purchase.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          id: crypto.randomUUID(),
          productId: item.productId,
          productSearch: product?.name || '',
          qty: item.qty.toString(),
          unitCostCents: (item.unitCostCents / 100).toString(),
        };
      });
      setItems(initialItems);
    } else if (!purchase) {
      setItems([
        {
          id: crypto.randomUUID(),
          productId: '',
          productSearch: '',
          qty: '',
          unitCostCents: '',
        },
      ]);
    }
  }, [purchase, products]);

  const loadProducts = async () => {
    try {
      const allProducts = await productService.getAll();
      setProducts(allProducts.filter((p) => p.active));
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Calculate total
  const purchaseTotal = useMemo(() => {
    return items.reduce((total, item) => {
      const qty = parseFloat(item.qty) || 0;
      const cost = parseFloat(item.unitCostCents) || 0;
      return total + qty * cost;
    }, 0);
  }, [items]);

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

  const handleItemChange = (itemId: string, field: keyof PurchaseItemForm, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );

    // Clear items error
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  const handleProductSearch = (itemId: string, query: string) => {
    handleItemChange(itemId, 'productSearch', query);
    setActiveDropdown(itemId);
  };

  const handleProductSelect = (itemId: string, product: Product) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId: product.id,
              productSearch: product.name,
            }
          : item
      )
    );
    setActiveDropdown(null);
  };

  const getFilteredProducts = (searchQuery: string): Product[] => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: '',
        productSearch: '',
        qty: '',
        unitCostCents: '',
      },
    ]);
  };

  const removeItem = (itemId: string) => {
    if (items.length === 1) {
      return; // Keep at least one item
    }
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate date
    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    // Validate supplier (either existing or new)
    if (!formData.supplierId && !formData.newSupplierName.trim()) {
      newErrors.supplierId = 'Debe seleccionar un proveedor o crear uno nuevo';
    }

    // Validate items
    const validItems = items.filter((item) => {
      const qty = parseFloat(item.qty);
      const cost = parseFloat(item.unitCostCents);
      return item.productId && !isNaN(qty) && qty > 0 && !isNaN(cost) && cost >= 0;
    });

    if (validItems.length === 0) {
      newErrors.items = 'Debe agregar al menos un ítem válido';
    }

    // Check for invalid items
    for (const item of items) {
      if (!item.productId && (item.qty || item.unitCostCents)) {
        newErrors.items = 'Todos los ítems deben tener un producto seleccionado';
        break;
      }
      if (item.productId) {
        const qty = parseFloat(item.qty);
        const cost = parseFloat(item.unitCostCents);
        if (isNaN(qty) || qty <= 0) {
          newErrors.items = 'Todas las cantidades deben ser mayores a 0';
          break;
        }
        if (isNaN(cost) || cost < 0) {
          newErrors.items = 'Todos los costos deben ser mayores o iguales a 0';
          break;
        }
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
      // Create new supplier if needed
      let supplierId = formData.supplierId;
      if (!supplierId && formData.newSupplierName.trim()) {
        const newSupplier: Supplier = {
          id: crypto.randomUUID(),
          name: formData.newSupplierName.trim(),
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        if (onSupplierCreate) {
          onSupplierCreate(newSupplier);
        }
        
        supplierId = newSupplier.id;
      }

      // Build purchase items (filter out empty rows)
      const purchaseItems: PurchaseItem[] = items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          qty: parseFloat(item.qty),
          unitCostCents: Math.round(parseFloat(item.unitCostCents) * 100), // Convert to cents
        }));

      const purchaseData = purchaseService.createPurchase({
        date: new Date(formData.date).toISOString(),
        supplierId: supplierId,
        items: purchaseItems,
        note: formData.note.trim() || undefined,
      });

      // If editing, preserve the original ID and createdAt
      const finalPurchase: Purchase = purchase
        ? { ...purchaseData, id: purchase.id, createdAt: purchase.createdAt }
        : purchaseData;

      setSaveSuccess(true);

      // Call onSave callback
      if (onSave) {
        onSave(finalPurchase);
      }

      // Reset form only if creating new purchase
      if (!purchase) {
        setFormData({
          date: new Date().toISOString().slice(0, 10),
          supplierId: '',
          newSupplierName: '',
          note: '',
        });
        setItems([
          {
            id: crypto.randomUUID(),
            productId: '',
            productSearch: '',
            qty: '',
            unitCostCents: '',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to save purchase:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar la compra',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="purchase-form" role="form" aria-label="Crear nueva compra">
      <h3>Nueva Compra</h3>

      {saveSuccess && (
        <div className="alert alert-success" role="alert" aria-live="polite">Compra guardada exitosamente</div>
      )}

      {errors.general && <div className="alert alert-error" role="alert" aria-live="assertive">{errors.general}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">
              Fecha <span className="required">*</span>
            </label>
            <input
              type="date"
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
            <label htmlFor="supplierId">
              Proveedor <span className="required">*</span>
            </label>
            <select
              id="supplierId"
              name="supplierId"
              value={formData.supplierId}
              onChange={handleChange}
              className={errors.supplierId ? 'error' : ''}
              disabled={saving || !!formData.newSupplierName}
              aria-required="true"
              aria-invalid={errors.supplierId ? 'true' : 'false'}
              aria-describedby={errors.supplierId ? 'supplier-error' : undefined}
            >
              <option value="">Seleccionar proveedor...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {errors.supplierId && (
              <span className="error-message" id="supplier-error" role="alert">{errors.supplierId}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="newSupplierName">
              O crear nuevo proveedor
            </label>
            <input
              type="text"
              id="newSupplierName"
              name="newSupplierName"
              value={formData.newSupplierName}
              onChange={handleChange}
              placeholder="Nombre del nuevo proveedor..."
              disabled={saving || !!formData.supplierId}
              aria-label="Nombre del nuevo proveedor"
            />
            <small className="form-hint">Deja este campo vacío si seleccionaste un proveedor existente</small>
          </div>
        </div>

        {/* Items section */}
        <div className="items-section" role="region" aria-label="Ítems de la compra">
          <div className="items-header">
            <h4>Ítems de la compra</h4>
            <button
              type="button"
              className="btn-add-item"
              onClick={addItem}
              disabled={saving}
              aria-label="Agregar nuevo ítem a la compra"
            >
              + Agregar Ítem
            </button>
          </div>

          {errors.items && <div className="alert alert-error" role="alert">{errors.items}</div>}

          <div className="items-list">
            {items.map((item, index) => (
              <div key={item.id} className="item-row">
                <div className="item-number">{index + 1}</div>

                <div className="item-fields">
                  <div className="form-group">
                    <label>Producto *</label>
                    <div className="product-search-container">
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={item.productSearch}
                        onChange={(e) => handleProductSearch(item.id, e.target.value)}
                        onFocus={() => setActiveDropdown(item.id)}
                        disabled={saving}
                        className={item.productId ? 'product-selected' : ''}
                        aria-label={`Buscar producto para ítem ${index + 1}`}
                        aria-autocomplete="list"
                        role="combobox"
                        aria-expanded={activeDropdown === item.id && getFilteredProducts(item.productSearch).length > 0}
                      />
                      {item.productId && (
                        <span className="product-selected-badge" aria-label="Producto seleccionado">✓</span>
                      )}
                      {activeDropdown === item.id &&
                        getFilteredProducts(item.productSearch).length > 0 && (
                          <div className="product-dropdown" role="listbox">
                            {getFilteredProducts(item.productSearch)
                              .slice(0, 10)
                              .map((product) => (
                                <div
                                  key={product.id}
                                  className="product-dropdown-item"
                                  onClick={() => handleProductSelect(item.id, product)}
                                  role="option"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleProductSelect(item.id, product);
                                    }
                                  }}
                                >
                                  <span className="product-name">{product.name}</span>
                                  {product.sku && (
                                    <span className="product-sku">SKU: {product.sku}</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={item.qty}
                      onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                      disabled={saving}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Costo Unitario ($) *</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.unitCostCents}
                      onChange={(e) =>
                        handleItemChange(item.id, 'unitCostCents', e.target.value)
                      }
                      disabled={saving}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Subtotal</label>
                    <div className="subtotal">
                      ${formatNumber(
                        (parseFloat(item.qty) || 0) *
                        (parseFloat(item.unitCostCents) || 0),
                        0
                      )}
                    </div>
                  </div>
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-item"
                    onClick={() => removeItem(item.id)}
                    disabled={saving}
                    title="Eliminar ítem"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="purchase-total" role="status" aria-live="polite">
            <strong>Total de la compra:</strong>
            <span className="total-amount">${formatNumber(purchaseTotal, 0)}</span>
          </div>
        </div>

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
            aria-label="Nota opcional sobre la compra"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Guardando...' : 'Guardar Compra'}
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
