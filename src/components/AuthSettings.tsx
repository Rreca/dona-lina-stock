import { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import './AuthSettings.css';

interface AuthSettingsProps {
  onLogout?: () => void;
}

interface FormData {
  token: string;
  gistId: string;
  passphrase: string;
  useEncryption: boolean;
}

interface FormErrors {
  token?: string;
  gistId?: string;
  passphrase?: string;
  general?: string;
}

export function AuthSettings({ onLogout }: AuthSettingsProps) {
  const [formData, setFormData] = useState<FormData>({
    token: '',
    gistId: '',
    passphrase: '',
    useEncryption: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'invalid' | 'not_set'>('not_set');
  const [showToken, setShowToken] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    const token = authService.getToken();
    const gistId = authService.getGistId();
    const encrypted = authService.isEncryptionEnabled();

    setIsEncrypted(encrypted);

    if (!token || !gistId) {
      setTokenStatus('not_set');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      gistId: gistId || '',
      useEncryption: encrypted,
    }));

    setValidating(true);
    const result = await authService.validateToken(token);
    setValidating(false);

    setTokenStatus(result.valid ? 'valid' : 'invalid');
    if (!result.valid && result.error) {
      setErrors({ general: result.error });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.token.trim()) {
      newErrors.token = 'El token es requerido';
    }

    if (!formData.gistId.trim()) {
      newErrors.gistId = 'El ID del Gist es requerido';
    }

    if (formData.useEncryption && !formData.passphrase.trim()) {
      newErrors.passphrase = 'La contraseña es requerida para cifrado';
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
      // Validate token with GitHub API
      const result = await authService.validateToken(formData.token);
      
      if (!result.valid) {
        setErrors({ general: result.error || 'Token inválido' });
        setTokenStatus('invalid');
        setSaving(false);
        return;
      }

      // Save token (encrypted or plain)
      if (formData.useEncryption) {
        await authService.setTokenEncrypted(formData.token, formData.passphrase);
      } else {
        authService.setToken(formData.token);
      }

      // Save Gist ID
      authService.setGistId(formData.gistId);

      setTokenStatus('valid');
      setSaveSuccess(true);
      setIsEncrypted(formData.useEncryption);

      // Clear sensitive fields
      setFormData((prev) => ({
        ...prev,
        token: '',
        passphrase: '',
      }));

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      // Don't log errors that might contain sensitive data
      setErrors({
        general:
          error instanceof Error ? error.message : 'Error al guardar token',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('¿Estás seguro de cerrar sesión? Se borrarán todos los datos locales.')) {
      return;
    }

    try {
      await authService.logout();
      setTokenStatus('not_set');
      setFormData({
        token: '',
        gistId: '',
        passphrase: '',
        useEncryption: false,
      });
      
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      // Don't log errors that might contain sensitive data
      setErrors({
        general: error instanceof Error ? error.message : 'Error al cerrar sesión',
      });
    }
  };

  return (
    <div className="auth-settings">
      <h3>Autenticación</h3>

      {/* Token Status */}
      <div className={`token-status status-${tokenStatus}`}>
        <div className="status-indicator">
          {validating ? (
            <span className="status-text">Validando...</span>
          ) : (
            <>
              <span className="status-icon">
                {tokenStatus === 'valid' && '✓'}
                {tokenStatus === 'invalid' && '✗'}
                {tokenStatus === 'not_set' && '○'}
              </span>
              <span className="status-text">
                {tokenStatus === 'valid' && 'Token válido'}
                {tokenStatus === 'invalid' && 'Token inválido'}
                {tokenStatus === 'not_set' && 'Token no configurado'}
              </span>
            </>
          )}
        </div>
        {isEncrypted && tokenStatus === 'valid' && (
          <span className="encryption-badge">🔒 Cifrado</span>
        )}
      </div>

      {saveSuccess && (
        <div className="alert alert-success">
          Token guardado exitosamente
        </div>
      )}

      {errors.general && (
        <div className="alert alert-error">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="token">
            Personal Access Token (PAT) <span className="required">*</span>
          </label>
          <div className="input-with-toggle">
            <input
              type={showToken ? 'text' : 'password'}
              id="token"
              name="token"
              value={formData.token}
              onChange={handleChange}
              className={errors.token ? 'error' : ''}
              disabled={saving}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowToken(!showToken)}
              tabIndex={-1}
            >
              {showToken ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {errors.token && <span className="error-message">{errors.token}</span>}
          <div className="help-box">
            <p className="help-title">Cómo crear un token:</p>
            <ol className="help-list">
              <li>Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)</li>
              <li>Haz clic en "Generate new token (classic)"</li>
              <li>Selecciona SOLO el scope: <code>gist</code></li>
              <li>Copia el token y pégalo aquí</li>
            </ol>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="gistId">
            Gist ID <span className="required">*</span>
          </label>
          <input
            type="text"
            id="gistId"
            name="gistId"
            value={formData.gistId}
            onChange={handleChange}
            className={errors.gistId ? 'error' : ''}
            disabled={saving}
            placeholder="abc123def456..."
          />
          {errors.gistId && <span className="error-message">{errors.gistId}</span>}
          <span className="help-text">
            El ID del Gist donde se guardarán los datos (visible en la URL del Gist)
          </span>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="useEncryption"
              checked={formData.useEncryption}
              onChange={handleChange}
              disabled={saving}
            />
            <span>Cifrar token con contraseña (opcional)</span>
          </label>
          <span className="help-text">
            Agrega una capa extra de seguridad cifrando el token antes de guardarlo
          </span>
        </div>

        {formData.useEncryption && (
          <div className="form-group">
            <label htmlFor="passphrase">
              Contraseña de Cifrado <span className="required">*</span>
            </label>
            <input
              type="password"
              id="passphrase"
              name="passphrase"
              value={formData.passphrase}
              onChange={handleChange}
              className={errors.passphrase ? 'error' : ''}
              disabled={saving}
              placeholder="Contraseña segura"
            />
            {errors.passphrase && (
              <span className="error-message">{errors.passphrase}</span>
            )}
            <span className="help-text">
              Necesitarás esta contraseña cada vez que uses la aplicación
            </span>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Token'}
          </button>
          {tokenStatus === 'valid' && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleLogout}
              disabled={saving}
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
