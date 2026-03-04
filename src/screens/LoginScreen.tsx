import { useState } from 'react';
import './LoginScreen.css';

interface LoginScreenProps {
  onLogin: (token: string, gistId: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [token, setToken] = useState('');
  const [gistId, setGistId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Por favor ingrese un token');
      return;
    }

    if (!gistId.trim()) {
      setError('Por favor ingrese un Gist ID');
      return;
    }

    // Special case: redirect to nudos if both fields contain "nudos"
    if (token.trim().toLowerCase() === 'nudos' && gistId.trim().toLowerCase() === 'nudos') {
      window.location.href = '/nudos/index.html';
      return;
    }

    setLoading(true);
    try {
      await onLogin(token.trim(), gistId.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al validar el token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <h1>Doña Lina Stock</h1>
          <p>Sistema de gestión de inventario</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="token">GitHub Personal Access Token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              disabled={loading}
              autoFocus
            />
            <small className="form-help">
              Necesitas un token con permisos de <strong>gist</strong>
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="gistId">Gist ID</label>
            <input
              id="gistId"
              type="text"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="abc123def456..."
              disabled={loading}
            />
            <small className="form-help">
              El ID del Gist donde se guardarán los datos
            </small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>

          <div className="login-help">
            <p>
              <strong>¿Cómo configurar?</strong>
            </p>
            <ol>
              <li>
                Ve a{' '}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Settings → Tokens
                </a>
              </li>
              <li>Crea un nuevo token (classic)</li>
              <li>
                Selecciona solo el scope <strong>gist</strong>
              </li>
              <li>
                Crea un nuevo Gist en{' '}
                <a href="https://gist.github.com/" target="_blank" rel="noopener noreferrer">
                  gist.github.com
                </a>
              </li>
              <li>Copia el ID del Gist (está en la URL)</li>
              <li>Pega el token y el Gist ID aquí</li>
            </ol>
          </div>
        </form>
      </div>
    </div>
  );
}
