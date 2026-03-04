import { useState, useEffect } from 'react';
import type { Settings, CostMethod, WeightedAvgWindowType } from '../models/types';
import './SettingsForm.css';

interface SettingsFormProps {
  settings: Settings;
  onSave?: (settings: Settings) => void;
}

interface FormData {
  costMethod: CostMethod;
  windowType: WeightedAvgWindowType;
  windowValue: string;
  markupPct: string;
  roundToCents: string;
  minMarginPct: string;
}

interface FormErrors {
  windowValue?: string;
  markupPct?: string;
  roundToCents?: string;
  minMarginPct?: string;
  general?: string;
}

export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [formData, setFormData] = useState<FormData>({
    costMethod: settings.costMethod,
    windowType: settings.weightedAvgWindow.type,
    windowValue: settings.weightedAvgWindow.value.toString(),
    markupPct: settings.priceRule.markupPct.toString(),
    roundToCents: settings.priceRule.roundToCents.toString(),
    minMarginPct: settings.priceRule.minMarginPct?.toString() || '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      costMethod: settings.costMethod,
      windowType: settings.weightedAvgWindow.type,
      windowValue: settings.weightedAvgWindow.value.toString(),
      markupPct: settings.priceRule.markupPct.toString(),
      roundToCents: settings.priceRule.roundToCents.toString(),
      minMarginPct: settings.priceRule.minMarginPct?.toString() || '',
    });
  }, [settings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate window value
    const windowValue = parseFloat(formData.windowValue);
    if (isNaN(windowValue) || windowValue <= 0) {
      newErrors.windowValue = 'Debe ser un número mayor a 0';
    }

    // Validate markup percentage
    const markupPct = parseFloat(formData.markupPct);
    if (isNaN(markupPct) || markupPct < 0) {
      newErrors.markupPct = 'Debe ser un número mayor o igual a 0';
    }

    // Validate round to cents
    const roundToCents = parseFloat(formData.roundToCents);
    if (isNaN(roundToCents) || roundToCents <= 0) {
      newErrors.roundToCents = 'Debe ser un número mayor a 0';
    }

    // Validate min margin (optional)
    if (formData.minMarginPct.trim()) {
      const minMarginPct = parseFloat(formData.minMarginPct);
      if (isNaN(minMarginPct) || minMarginPct < 0) {
        newErrors.minMarginPct = 'Debe ser un número mayor o igual a 0';
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
      const updatedSettings: Settings = {
        costMethod: formData.costMethod,
        weightedAvgWindow: {
          type: formData.windowType,
          value: parseFloat(formData.windowValue),
        },
        priceRule: {
          markupPct: parseFloat(formData.markupPct),
          roundToCents: parseFloat(formData.roundToCents),
          minMarginPct: formData.minMarginPct.trim()
            ? parseFloat(formData.minMarginPct)
            : undefined,
        },
      };

      if (onSave) {
        onSave(updatedSettings);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar configuración',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-form">
      <h3>Configuración de Costos y Precios</h3>

      {saveSuccess && (
        <div className="alert alert-success">
          Configuración guardada exitosamente
        </div>
      )}

      {errors.general && (
        <div className="alert alert-error">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Cost Method Section */}
        <section className="settings-section">
          <h4>Método de Cálculo de Costo</h4>
          <div className="form-group">
            <label htmlFor="costMethod">Método de Costo</label>
            <select
              id="costMethod"
              name="costMethod"
              value={formData.costMethod}
              onChange={handleChange}
              disabled={saving}
            >
              <option value="last">Último Costo</option>
              <option value="weighted_avg">Promedio Ponderado</option>
            </select>
            <span className="help-text">
              {formData.costMethod === 'last'
                ? 'Usa el costo de la compra más reciente'
                : 'Calcula el promedio ponderado de compras recientes'}
            </span>
          </div>

          {formData.costMethod === 'weighted_avg' && (
            <>
              <div className="form-group">
                <label htmlFor="windowType">Ventana de Promedio</label>
                <select
                  id="windowType"
                  name="windowType"
                  value={formData.windowType}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="last_n_purchases">Últimas N Compras</option>
                  <option value="last_days">Últimos X Días</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="windowValue">
                  {formData.windowType === 'last_n_purchases'
                    ? 'Número de Compras'
                    : 'Número de Días'}
                </label>
                <input
                  type="number"
                  id="windowValue"
                  name="windowValue"
                  value={formData.windowValue}
                  onChange={handleChange}
                  className={errors.windowValue ? 'error' : ''}
                  disabled={saving}
                  min="1"
                  step="1"
                />
                {errors.windowValue && (
                  <span className="error-message">{errors.windowValue}</span>
                )}
              </div>
            </>
          )}
        </section>

        {/* Price Suggestion Section */}
        <section className="settings-section">
          <h4>Reglas de Sugerencia de Precio</h4>
          
          <div className="form-group">
            <label htmlFor="markupPct">Margen de Ganancia (%)</label>
            <input
              type="number"
              id="markupPct"
              name="markupPct"
              value={formData.markupPct}
              onChange={handleChange}
              className={errors.markupPct ? 'error' : ''}
              disabled={saving}
              min="0"
              step="0.1"
            />
            {errors.markupPct && (
              <span className="error-message">{errors.markupPct}</span>
            )}
            <span className="help-text">
              Porcentaje de ganancia sobre el costo (ej: 30 = 30%)
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="roundToCents">Redondeo (centavos)</label>
            <input
              type="number"
              id="roundToCents"
              name="roundToCents"
              value={formData.roundToCents}
              onChange={handleChange}
              className={errors.roundToCents ? 'error' : ''}
              disabled={saving}
              min="1"
              step="1"
            />
            {errors.roundToCents && (
              <span className="error-message">{errors.roundToCents}</span>
            )}
            <span className="help-text">
              Redondear precio a múltiplos de (ej: 10, 50, 100 centavos)
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="minMarginPct">Margen Mínimo (%) - Opcional</label>
            <input
              type="number"
              id="minMarginPct"
              name="minMarginPct"
              value={formData.minMarginPct}
              onChange={handleChange}
              className={errors.minMarginPct ? 'error' : ''}
              disabled={saving}
              min="0"
              step="0.1"
              placeholder="Sin mínimo"
            />
            {errors.minMarginPct && (
              <span className="error-message">{errors.minMarginPct}</span>
            )}
            <span className="help-text">
              Margen mínimo requerido para alertas (dejar vacío para no validar)
            </span>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>
    </div>
  );
}
