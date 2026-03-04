/**
 * Example usage of SyncStatus component
 * Demonstrates different sync states
 */

import { useState } from 'react';
import { SyncStatus, type SyncState } from './SyncStatus';

export function SyncStatusExample() {
  const [status, setStatus] = useState<SyncState>('saved');
  const [lastSyncAt] = useState<Date>(new Date(Date.now() - 120000)); // 2 minutes ago

  const handleRetry = () => {
    console.log('Retry clicked');
    setStatus('saving');
    setTimeout(() => setStatus('saved'), 2000);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Sync Status Examples</h2>

      <div style={{ marginBottom: '1rem' }}>
        <h3>Current Status</h3>
        <SyncStatus
          status={status}
          lastSyncAt={lastSyncAt}
          errorMessage={status === 'error' ? 'Failed to sync with server' : undefined}
          onRetry={status === 'error' ? handleRetry : undefined}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setStatus('saved')}>Saved</button>
        <button onClick={() => setStatus('saving')}>Saving</button>
        <button onClick={() => setStatus('pending')}>Pending</button>
        <button onClick={() => setStatus('error')}>Error</button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>All States</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SyncStatus status="saved" lastSyncAt={new Date()} />
          <SyncStatus status="saving" />
          <SyncStatus status="pending" />
          <SyncStatus
            status="error"
            errorMessage="Network error"
            onRetry={() => console.log('Retry')}
          />
        </div>
      </div>
    </div>
  );
}
