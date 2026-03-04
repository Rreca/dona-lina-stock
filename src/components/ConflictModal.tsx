/**
 * Conflict resolution modal component
 * Displays when ETag conflicts are detected from Gist API
 * Requirements: R2.4
 */

import './ConflictModal.css';

export interface ConflictModalProps {
  isOpen: boolean;
  onReload: () => void;
  onRetry: () => void;
  onViewChanges?: () => void;
  onClose: () => void;
}

export function ConflictModal({
  isOpen,
  onReload,
  onRetry,
  onViewChanges,
  onClose,
}: ConflictModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="conflict-modal-overlay" onClick={onClose}>
      <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
        <div className="conflict-modal__header">
          <h2 className="conflict-modal__title">Remote Changes Detected</h2>
          <button
            className="conflict-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="conflict-modal__content">
          <p className="conflict-modal__message">
            The data has been modified remotely (possibly from another browser tab or device).
            Your local changes could not be saved to prevent data loss.
          </p>

          <div className="conflict-modal__warning">
            <span className="conflict-modal__warning-icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              Please choose how to proceed. Reloading will discard your unsaved local changes.
            </span>
          </div>
        </div>

        <div className="conflict-modal__actions">
          <button
            className="conflict-modal__button conflict-modal__button--primary"
            onClick={onReload}
          >
            Reload Data
          </button>
          <button
            className="conflict-modal__button conflict-modal__button--secondary"
            onClick={onRetry}
          >
            Retry Save
          </button>
          {onViewChanges && (
            <button
              className="conflict-modal__button conflict-modal__button--secondary"
              onClick={onViewChanges}
            >
              View Changes
            </button>
          )}
        </div>

        <div className="conflict-modal__help">
          <p>
            <strong>Reload Data:</strong> Fetch the latest data from the server and discard your
            local changes.
          </p>
          <p>
            <strong>Retry Save:</strong> Attempt to save your changes again (may fail if conflict
            persists).
          </p>
          {onViewChanges && (
            <p>
              <strong>View Changes:</strong> See what changed remotely before deciding.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
