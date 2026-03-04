/**
 * Example usage of ConflictModal component
 * Demonstrates conflict resolution UI
 */

import { useState } from 'react';
import { ConflictModal } from './ConflictModal';

export function ConflictModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleReload = () => {
    console.log('Reload clicked');
    setIsOpen(false);
  };

  const handleRetry = () => {
    console.log('Retry clicked');
    setIsOpen(false);
  };

  const handleViewChanges = () => {
    console.log('View changes clicked');
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Conflict Modal Example</h2>
      <p>Click the button to see the conflict resolution modal.</p>

      <button onClick={() => setIsOpen(true)}>Show Conflict Modal</button>

      <ConflictModal
        isOpen={isOpen}
        onReload={handleReload}
        onRetry={handleRetry}
        onViewChanges={handleViewChanges}
        onClose={handleClose}
      />
    </div>
  );
}
