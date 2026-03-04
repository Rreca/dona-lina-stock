/**
 * Example usage of ErrorBoundary component
 * Demonstrates error catching and recovery
 */

import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('This is a test error from BuggyComponent');
  }
  return <div>Component is working fine!</div>;
}

export function ErrorBoundaryExample() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [key, setKey] = useState(0);

  const triggerError = () => {
    setShouldThrow(true);
  };

  const reset = () => {
    setShouldThrow(false);
    setKey((k) => k + 1); // Force remount of ErrorBoundary
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Error Boundary Example</h2>
      <p>Click the button to trigger an error and see the error boundary in action.</p>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={triggerError} disabled={shouldThrow}>
          Trigger Error
        </button>
        <button onClick={reset} style={{ marginLeft: '0.5rem' }}>
          Reset
        </button>
      </div>

      <ErrorBoundary key={key}>
        <div
          style={{
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
          }}
        >
          <BuggyComponent shouldThrow={shouldThrow} />
        </div>
      </ErrorBoundary>
    </div>
  );
}
