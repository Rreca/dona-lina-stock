# Loading States and Empty States Implementation

This document describes the loading states, empty states, and error message improvements implemented across the Doña Lina Stock application.

## Overview

Task 24.2 focused on improving user experience by:
1. Implementing loading spinners for async operations
2. Adding helpful empty states with call-to-action
3. Improving error messages for clarity

## New Components

### 1. LoadingSpinner Component
**Location:** `src/components/LoadingSpinner.tsx`

A reusable loading spinner component with three sizes and optional message.

**Usage:**
```tsx
<LoadingSpinner size="small" message="Cargando..." />
<LoadingSpinner size="medium" message="Cargando datos..." />
<LoadingSpinner size="large" message="Inicializando aplicación..." />
```

**Features:**
- Three sizes: small (24px), medium (40px), large (56px)
- Optional loading message
- Smooth animation
- Consistent styling across the app

### 2. EmptyState Component
**Location:** `src/components/EmptyState.tsx`

A reusable empty state component with icon, title, description, and optional action button.

**Usage:**
```tsx
<EmptyState
  icon="📦"
  title="No hay productos"
  description="Comienza agregando tu primer producto al catálogo"
  actionLabel="Nuevo Producto"
  onAction={() => handleAddProduct()}
/>
```

**Features:**
- Customizable icon (emoji or text)
- Title and description
- Optional call-to-action button
- Responsive design
- Consistent styling

### 3. ErrorMessage Component
**Location:** `src/components/ErrorMessage.tsx`

A reusable error message component with retry and dismiss actions.

**Usage:**
```tsx
<ErrorMessage
  message="Error al cargar los datos"
  onRetry={() => handleRetry()}
  onDismiss={() => handleDismiss()}
/>
```

**Features:**
- Clear error display
- Optional retry button
- Optional dismiss button
- Warning icon
- Accessible design

## Updated Components

### ProductList
**Improvements:**
- Loading skeleton while products load
- Empty state when no products exist
- Different empty state for search with no results
- Clear messaging for each scenario

### MovementList
**Improvements:**
- Loading skeleton while movements load
- Empty state when no movements exist
- Different empty state when filters return no results
- Call-to-action button in empty state (when no filters applied)

### PurchaseList
**Improvements:**
- Empty state when no purchases exist
- Different empty state when filters return no results
- Call-to-action button in empty state (when no filters applied)

### PurchaseHistory
**Improvements:**
- Loading spinner while loading products
- Empty state when no product is selected
- Empty state when selected product has no purchase history
- Clear, helpful messaging

### App.tsx
**Improvements:**
- Loading spinner during app initialization
- Loading spinner for lazy-loaded routes
- Better loading messages in Spanish

## Error Messages Improvements

### Updated error-messages.ts
**Location:** `src/utils/error-messages.ts`

All error messages have been translated to Spanish and improved for clarity:

**Authentication Errors:**
- Invalid token
- Expired token
- Missing token
- Invalid scope

**Network Errors:**
- Network error
- Timeout
- Offline mode

**Data Errors:**
- Save failed
- Load failed
- Conflict detected
- Sync failed

**Validation Errors:**
- Required field
- Invalid format
- Duplicate value
- Invalid number
- Negative not allowed
- Insufficient stock

**Generic Messages:**
- Error
- Success
- Loading
- Saving
- No data

## CSS Improvements

### Global Styles (App.css)
Added:
- Button disabled states
- Alert styles (success, error, warning, info)
- Improved button hover states

### Component-Specific Styles
Created:
- `EmptyState.css` - Empty state styling
- `LoadingSpinner.css` - Loading spinner animations
- `ErrorMessage.css` - Error message styling

## Usage Guidelines

### When to Use LoadingSpinner
- During app initialization
- While loading data from API
- During route transitions
- In forms while saving

### When to Use EmptyState
- When a list has no items
- When search/filter returns no results
- When a feature has no data yet
- Always provide context and next steps

### When to Use ErrorMessage
- When an operation fails
- When validation errors occur
- When network errors happen
- Always provide retry option when applicable

## Best Practices

1. **Loading States:**
   - Show loading immediately when operation starts
   - Use appropriate size for context
   - Include helpful message when possible
   - Don't show loading for very fast operations (<200ms)

2. **Empty States:**
   - Use friendly, encouraging language
   - Provide clear next steps
   - Include call-to-action when appropriate
   - Differentiate between "no data" and "no results"

3. **Error Messages:**
   - Use clear, non-technical language
   - Explain what went wrong
   - Provide actionable next steps
   - Include retry option when applicable
   - Use Spanish for user-facing messages

## Testing

All new components have been checked for:
- TypeScript compilation errors (✓ No errors)
- Import/export correctness (✓ Verified)
- CSS styling (✓ Responsive and accessible)
- Integration with existing components (✓ Working)

## Future Improvements

Potential enhancements for future iterations:
- Add skeleton loaders for specific content types
- Implement progress indicators for long operations
- Add animation transitions for state changes
- Create more specialized empty states for different contexts
- Add accessibility improvements (ARIA labels, screen reader support)
