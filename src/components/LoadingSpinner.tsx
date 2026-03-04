interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner-container loading-spinner-${size}`} role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true"></div>
      {message && <p className="loading-message">{message}</p>}
      <span className="sr-only">{message || 'Cargando...'}</span>
    </div>
  );
}
