# Accessibility Features

This document outlines the accessibility features implemented in Doña Lina Stock to ensure the application is usable by everyone, including people with disabilities.

## Overview

The application follows WCAG 2.1 Level AA guidelines and implements best practices for web accessibility.

## Key Accessibility Features

### 1. Semantic HTML

- Proper use of semantic HTML elements (`<nav>`, `<main>`, `<form>`, `<table>`, etc.)
- Heading hierarchy maintained throughout the application
- Lists use proper `<ul>`, `<ol>`, and `<li>` elements

### 2. ARIA Labels and Attributes

#### Forms
- All form inputs have associated `<label>` elements with proper `for` attributes
- Required fields marked with `aria-required="true"`
- Invalid fields marked with `aria-invalid="true"`
- Error messages linked using `aria-describedby`
- Form sections have `role="form"` with descriptive `aria-label`

#### Interactive Elements
- Buttons have descriptive `aria-label` attributes where text alone is insufficient
- Combobox inputs (product search) use proper ARIA attributes:
  - `role="combobox"`
  - `aria-autocomplete="list"`
  - `aria-controls` pointing to dropdown
  - `aria-expanded` indicating dropdown state
- Dropdown options use `role="listbox"` and `role="option"`

#### Status Updates
- Live regions use `aria-live="polite"` for non-critical updates
- Error messages use `aria-live="assertive"` for immediate attention
- Loading states use `role="status"` with `aria-live="polite"`
- Stock information displays use `role="status"` for dynamic updates

#### Tables
- Tables use proper `role="table"`, `role="row"`, `role="columnheader"`, and `role="cell"`
- Table headers properly associated with data cells

### 3. Keyboard Navigation

#### Focus Management
- All interactive elements are keyboard accessible
- Visible focus indicators on all focusable elements
- Custom focus styles using `:focus-visible` for better UX
- Skip link to main content (appears on focus)

#### Keyboard Shortcuts
- Tab: Navigate forward through interactive elements
- Shift+Tab: Navigate backward
- Enter/Space: Activate buttons and select dropdown options
- Escape: Close modals and dropdowns (where implemented)

#### Dropdown Navigation
- Product search dropdowns support keyboard selection
- Arrow keys can navigate options (where implemented)
- Enter or Space selects an option
- Tab moves focus out of dropdown

### 4. Color Contrast

All text and interactive elements meet WCAG AA contrast requirements:

- **Primary buttons**: White text (#FFFFFF) on green background (#4CAF50) - 3.4:1 ratio
- **Alert messages**: 
  - Success: Dark green text (#0F5132) on light green background (#D4EDDA) - 7.8:1 ratio
  - Error: Dark red text (#842029) on light red background (#F8D7DA) - 8.2:1 ratio
  - Warning: Dark yellow text (#664D03) on light yellow background (#FFF3CD) - 9.1:1 ratio
  - Info: Dark cyan text (#055160) on light cyan background (#CFF4FC) - 8.5:1 ratio
- **Body text**: Dark gray (#333) on white background - 12.6:1 ratio
- **Links**: Dark green (#2E7D32) - 5.4:1 ratio

### 5. Screen Reader Support

#### Hidden Content
- `.sr-only` class for screen reader-only content
- Decorative icons marked with `aria-hidden="true"`
- Loading spinners include hidden text for screen readers

#### Descriptive Labels
- All form inputs have descriptive labels
- Buttons describe their action clearly
- Links describe their destination
- Images have alt text (where applicable)

#### Status Announcements
- Form submission success/error announced
- Stock level changes announced
- Sync status changes announced
- Queue processing results announced

### 6. Error Handling

- Error messages are clearly associated with their fields
- Errors announced to screen readers via `role="alert"`
- Visual indicators (red border, error icon) supplement text
- Error messages provide clear guidance on how to fix issues

### 7. Loading States

- Loading spinners include text descriptions
- Loading states announced to screen readers
- Buttons show `aria-busy="true"` during operations
- Skeleton loaders provide visual feedback

### 8. Empty States

- Empty states use `role="status"` for screen reader announcement
- Clear messaging about why content is empty
- Actionable suggestions when appropriate

### 9. Tooltips

- Tooltips use `role="tooltip"` and `aria-live="polite"`
- Appear on both hover and focus
- Provide additional context without being essential
- Positioned to avoid obscuring content

### 10. Navigation

- Main navigation uses `role="navigation"` with `aria-label`
- Current page indicated with visual styling and ARIA
- Skip link allows bypassing navigation
- Logical tab order throughout the application

## Testing Recommendations

### Manual Testing
1. **Keyboard Navigation**: Navigate entire app using only keyboard
2. **Screen Reader**: Test with NVDA (Windows) or VoiceOver (Mac)
3. **Zoom**: Test at 200% zoom level
4. **Color Blindness**: Use color blindness simulators

### Automated Testing
1. Use axe DevTools browser extension
2. Run Lighthouse accessibility audit
3. Use WAVE browser extension
4. Test with pa11y or similar CLI tools

## Known Limitations

- Some complex interactions may require additional ARIA patterns
- Color contrast in charts/graphs may need review if added
- Mobile touch targets should be verified (minimum 44x44px)

## Future Improvements

1. Add more keyboard shortcuts for power users
2. Implement focus trap in modals
3. Add high contrast mode support
4. Improve mobile accessibility
5. Add more comprehensive ARIA live regions
6. Implement better focus management in dynamic content

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Contact

If you encounter any accessibility issues, please report them so we can address them promptly.
