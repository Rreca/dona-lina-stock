# Sync Status and Error Handling UI Components

This document describes the sync status and error handling UI components implemented for the Doña Lina Stock application.

## Components Overview

### 1. SyncStatus Component
**File:** `SyncStatus.tsx`

Displays the current synchronization status with visual indicators.

**States:**
- `saved` - Data successfully saved (green, checkmark)
- `saving` - Save in progress (blue, spinning icon)
- `pending` - Save queued (orange, dots)
- `error` - Save failed (red, warning icon)

**Features:**
- Shows last sync timestamp with relative time (e.g., "2m ago")
- Displays error messages on failure
- Provides retry button for failed syncs
- Auto-updates time display every minute

**Usage:**
```tsx
import { SyncStatus } from './components/SyncStatus';

<SyncStatus
  status="saved"
  lastSyncAt={new Date()}
  errorMessage="Network error"
  onRetry={() => handleRetry()}
/>
```

### 2. ConflictModal Component
**File:** `ConflictModal.tsx`

Modal dialog for handling ETag conflicts when remote data changes are detected.

**Features:**
- Clear explanation of the conflict situation
- Warning about potential data loss
- Three action options:
  - **Reload Data** - Fetch latest and discard local changes
  - **Retry Save** - Attempt save again
  - **View Changes** - See what changed remotely (optional)
- Help text explaining each option

**Usage:**
```tsx
import { ConflictModal } from './components/ConflictModal';

<ConflictModal
  isOpen={showConflict}
  onReload={() => reloadFromServer()}
  onRetry={() => retrySave()}
  onViewChanges={() => showDiff()}
  onClose={() => setShowConflict(false)}
/>
```

### 3. ErrorBoundary Component
**File:** `ErrorBoundary.tsx`

React Error Boundary for catching and recovering from component crashes.

**Features:**
- Catches errors in component tree
- Displays user-friendly error message
- Shows error details in expandable section
- Provides "Try Again" and "Reload Page" buttons
- Supports custom fallback UI

**Usage:**
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

// Wrap your app or specific sections
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h1>Oops! {error.message}</h1>
      <button onClick={reset}>Try Again</button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

### 4. Toast Notification System
**Files:** `Toast.tsx`, `ToastContainer.tsx`, `useToast.ts`

Toast notification system for displaying temporary user feedback messages.

**Toast Types:**
- `success` - Green, checkmark icon
- `error` - Red, X icon
- `warning` - Orange, warning icon
- `info` - Blue, info icon

**Features:**
- Auto-dismiss after configurable duration (default 5s)
- Manual dismiss with close button
- Stacks multiple toasts vertically
- Smooth slide-in animation
- Responsive design

**Usage:**
```tsx
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';

function MyComponent() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast.success('Data saved successfully!');
    } catch (error) {
      toast.error('Failed to save data');
    }
  };

  return (
    <>
      <button onClick={handleSave}>Save</button>
      <ToastContainer toasts={toast.toasts} onClose={toast.dismissToast} />
    </>
  );
}
```

**useToast Hook Methods:**
- `success(message, duration?)` - Show success toast
- `error(message, duration?)` - Show error toast
- `warning(message, duration?)` - Show warning toast
- `info(message, duration?)` - Show info toast
- `showToast(type, message, duration?)` - Generic method
- `dismissToast(id)` - Manually dismiss a toast

## Utility Functions

### Error Messages
**File:** `utils/error-messages.ts`

Provides user-friendly error messages for common error scenarios.

**Functions:**
- `getGistErrorMessage(error: GistError)` - Convert GistError to user message
- `getErrorMessage(error: unknown)` - Convert any error to user message

**Constants:**
- `ERROR_MESSAGES` - Predefined error messages for common scenarios

**Usage:**
```tsx
import { getGistErrorMessage, ERROR_MESSAGES } from './utils/error-messages';

try {
  await gistClient.write(data);
} catch (error) {
  if (error instanceof GistError) {
    toast.error(getGistErrorMessage(error));
  } else {
    toast.error(ERROR_MESSAGES.GENERIC_ERROR);
  }
}
```

## Integration Guide

### 1. Wrap App with ErrorBoundary
```tsx
// main.tsx or App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### 2. Add Toast System to App
```tsx
// App.tsx
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';

function App() {
  const toast = useToast();

  // Pass toast to child components via context or props
  return (
    <>
      <YourAppContent toast={toast} />
      <ToastContainer toasts={toast.toasts} onClose={toast.dismissToast} />
    </>
  );
}
```

### 3. Add SyncStatus to Layout
```tsx
// Layout.tsx or Header.tsx
import { SyncStatus } from './components/SyncStatus';

function Header({ syncState, lastSync, onRetry }) {
  return (
    <header>
      <h1>Doña Lina Stock</h1>
      <SyncStatus
        status={syncState}
        lastSyncAt={lastSync}
        onRetry={onRetry}
      />
    </header>
  );
}
```

### 4. Handle Conflicts
```tsx
// In your sync service wrapper
import { ConflictModal } from './components/ConflictModal';

function DataManager() {
  const [showConflict, setShowConflict] = useState(false);

  const handleSave = async () => {
    try {
      await gistSync.save(data);
    } catch (error) {
      if (error instanceof GistError && error.type === 'conflict') {
        setShowConflict(true);
      }
    }
  };

  return (
    <>
      {/* Your UI */}
      <ConflictModal
        isOpen={showConflict}
        onReload={async () => {
          await gistSync.loadFromGist();
          setShowConflict(false);
        }}
        onRetry={async () => {
          await handleSave();
          setShowConflict(false);
        }}
        onClose={() => setShowConflict(false)}
      />
    </>
  );
}
```

## Example Files

Example usage files are provided for each component:
- `SyncStatus.example.tsx` - Interactive sync status demo
- `ConflictModal.example.tsx` - Conflict modal demo
- `Toast.example.tsx` - Toast notification demo
- `ErrorBoundary.example.tsx` - Error boundary demo

These can be used for testing and as reference implementations.

## Requirements Satisfied

- **N2.2** - Sync status indicator showing saved/saving/pending/error states
- **R2.4** - Conflict resolution UI for ETag conflicts
- **R1.4** - Clear error messages for common failures
- **N2.2** - Toast notification system for user feedback
- **R1.4, N2.2** - Error boundary for crash recovery

## Styling

All components include CSS files with:
- Responsive design
- Smooth animations
- Accessible color contrast
- Mobile-friendly layouts
- Consistent design language

Colors follow a standard palette:
- Success: Green (#4caf50)
- Error: Red (#f44336)
- Warning: Orange (#ff9800)
- Info: Blue (#2196f3)
- Neutral: Gray shades

## Accessibility

All components follow accessibility best practices:
- ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Sufficient color contrast
- Focus indicators
