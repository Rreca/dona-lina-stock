/**
 * Example usage of Toast notification system
 * Demonstrates different toast types and the useToast hook
 */

import { useToast } from '../hooks/useToast';
import { ToastContainer } from './ToastContainer';

export function ToastExample() {
  const toast = useToast();

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Toast Notification Examples</h2>
      <p>Click buttons to show different types of toast notifications.</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button onClick={() => toast.success('Operation completed successfully!')}>
          Show Success
        </button>
        <button onClick={() => toast.error('An error occurred. Please try again.')}>
          Show Error
        </button>
        <button onClick={() => toast.warning('This action cannot be undone.')}>
          Show Warning
        </button>
        <button onClick={() => toast.info('New features are available.')}>Show Info</button>
        <button
          onClick={() => {
            toast.success('First notification');
            setTimeout(() => toast.info('Second notification'), 500);
            setTimeout(() => toast.warning('Third notification'), 1000);
          }}
        >
          Show Multiple
        </button>
        <button
          onClick={() =>
            toast.success('This toast will stay for 10 seconds', 10000)
          }
        >
          Long Duration
        </button>
      </div>

      <ToastContainer toasts={toast.toasts} onClose={toast.dismissToast} />
    </div>
  );
}
