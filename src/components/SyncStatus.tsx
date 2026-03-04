/**
 * Sync status indicator component
 * Displays current sync state and last sync timestamp
 * Requirements: N2.2
 */

import { useState, useEffect } from 'react';
import './SyncStatus.css';

export type SyncState = 'saved' | 'saving' | 'pending' | 'error';

export interface SyncStatusProps {
  status: SyncState;
  lastSyncAt?: Date | null;
  errorMessage?: string;
  onRetry?: () => void;
  pendingCount?: number;
}

export function SyncStatus({ status, lastSyncAt, errorMessage, onRetry, pendingCount = 0 }: SyncStatusProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Update time ago every minute
  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastSyncAt) {
        setTimeAgo('');
        return;
      }

      const now = new Date();
      const diffMs = now.getTime() - lastSyncAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        setTimeAgo('just now');
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
      } else {
        setTimeAgo(`${diffDays}d ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSyncAt]);

  const getStatusIcon = () => {
    switch (status) {
      case 'saved':
        return '✓';
      case 'saving':
        return '⟳';
      case 'pending':
        return '⋯';
      case 'error':
        return '⚠';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'saved':
        return 'Saved';
      case 'saving':
        return 'Saving...';
      case 'pending':
        return 'Pending';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className={`sync-status sync-status--${status}`}>
      <span className="sync-status__icon" aria-hidden="true">
        {getStatusIcon()}
      </span>
      <span className="sync-status__text">{getStatusText()}</span>
      {timeAgo && status === 'saved' && (
        <span className="sync-status__time">{timeAgo}</span>
      )}
      {pendingCount > 0 && (
        <span className="sync-status__pending-count" title={`${pendingCount} operation(s) pending sync`}>
          ({pendingCount} pending)
        </span>
      )}
      {status === 'error' && errorMessage && (
        <span className="sync-status__error-message" title={errorMessage}>
          {errorMessage}
        </span>
      )}
      {status === 'error' && onRetry && (
        <button
          className="sync-status__retry-button"
          onClick={onRetry}
          aria-label="Retry sync"
        >
          Retry
        </button>
      )}
    </div>
  );
}
