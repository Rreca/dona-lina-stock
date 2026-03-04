interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorMessage({ message, onRetry, onDismiss }: ErrorMessageProps) {
  return (
    <div className="error-message-container">
      <div className="error-message-icon">⚠️</div>
      <div className="error-message-content">
        <p className="error-message-text">{message}</p>
        <div className="error-message-actions">
          {onRetry && (
            <button className="btn-secondary" onClick={onRetry}>
              Reintentar
            </button>
          )}
          {onDismiss && (
            <button className="btn-text" onClick={onDismiss}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
