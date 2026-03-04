# Doña Lina Stock

A web application for managing product catalog, stock, purchases, and pricing using GitHub Gist for persistence and GitHub Pages for hosting.

## Features

- **Product Catalog**: Manage products with categories, units, SKUs, and minimum stock levels
- **Stock Tracking**: Record entries, exits, and manual adjustments with full audit trail
- **Purchase History**: Track supplier purchases with historical cost data
- **Cost Calculation**: Choose between "last cost" or "weighted average" methods
- **Pricing & Margins**: Calculate margins and get price suggestions based on configurable rules
- **CSV Import/Export**: Bulk operations for product data
- **Offline Support**: Local caching with IndexedDB for fast loading and offline reading
- **Conflict Resolution**: ETag-based optimistic concurrency to prevent data loss
- **GitHub Gist Persistence**: Serverless storage using GitHub's free Gist API

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm (comes with Node.js)
- A GitHub account
- GitHub Personal Access Token (see setup below)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd dona-lina-stock

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## GitHub Personal Access Token Setup

The app requires a GitHub Personal Access Token (PAT) to read and write data to your private Gist.

### Creating a PAT Token

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "Doña Lina Stock App")
4. Set expiration (recommended: 90 days or custom)
5. **Select ONLY the `gist` scope** (this is the minimum required permission)
   - ✅ `gist` - Create and edit gists
   - ❌ Do NOT select any other scopes for security
6. Click **"Generate token"**
7. **Copy the token immediately** (you won't be able to see it again!)

### Using the Token in the App

1. Open the app and go to **Settings** (gear icon)
2. In the **Authentication** section, paste your token
3. Click **"Save Token"**
4. The app will validate the token and create a Gist if needed

**Security Notes:**
- The token is stored in your browser's localStorage
- Never share your token with anyone
- You can enable optional encryption with a passphrase in Settings
- Use the **"Logout"** button to clear the token and all local data

## Deployment to GitHub Pages

### Option 1: Automated Deployment (Recommended)

The repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages on every push to `main`.

1. **Enable GitHub Pages in your repository:**
   - Go to repository **Settings** → **Pages**
   - Under **Source**, select **"GitHub Actions"**

2. **Update the base path** (if your repo name is different):
   - Edit `vite.config.ts`
   - Change `base: '/dona-lina-stock/'` to match your repository name
   - Example: if repo is `my-stock-app`, use `base: '/my-stock-app/'`

3. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Configure for deployment"
   git push origin main
   ```

4. **Access your app:**
   - After the workflow completes, visit: `https://<username>.github.io/<repo-name>/`

### Option 2: Manual Deployment

```bash
# Build and deploy manually
npm run deploy
```

This uses the `gh-pages` package to deploy the `dist` folder to the `gh-pages` branch.

## Project Structure

```
dona-lina-stock/
├── src/
│   ├── models/          # TypeScript interfaces and validation
│   │   ├── types.ts     # Core domain types
│   │   └── validation.ts
│   ├── services/        # Business logic and API clients
│   │   ├── auth.ts      # Token management
│   │   ├── gist-client.ts    # GitHub Gist API
│   │   ├── gist-sync.ts      # Sync orchestration
│   │   ├── cache.ts          # IndexedDB caching
│   │   ├── product-service.ts
│   │   ├── movement-service.ts
│   │   ├── purchase-service.ts
│   │   ├── cost-service.ts
│   │   ├── pricing-service.ts
│   │   ├── csv-export.ts
│   │   └── csv-import.ts
│   ├── components/      # React UI components
│   │   ├── ProductList.tsx
│   │   ├── ProductForm.tsx
│   │   ├── MovementForm.tsx
│   │   ├── PurchaseForm.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── ...
│   ├── screens/         # Main screen components
│   ├── utils/           # Utility functions
│   └── hooks/           # Custom React hooks
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actions deployment
├── vite.config.ts       # Vite configuration
└── package.json
```

## Usage Guide

### First Time Setup

1. **Login**: Enter your GitHub PAT token in the Settings screen
2. **Add Products**: Go to Products → Add Product
3. **Record Purchases**: Go to Purchases → New Purchase to record supplier purchases
4. **Track Stock**: Go to Movements → Add Movement to record stock changes
5. **View Margins**: Products screen shows current cost, sale price, and margin

### Cost Calculation Methods

**Last Cost** (default):
- Uses the unit cost from the most recent purchase
- Simple and straightforward
- Best for stable pricing

**Weighted Average**:
- Calculates average cost across multiple purchases
- Configurable window (last N purchases or last X days)
- Better for fluctuating prices

Configure in **Settings** → **Cost Calculation Method**

### CSV Operations

**Export Products:**
1. Go to Settings → Data Management
2. Click "Export CSV"
3. Select columns to include
4. Download the CSV file

**Import Products:**
1. Prepare a CSV file with columns: name, category, unit, sku, minStock, salePriceCents
2. Go to Settings → Data Management
3. Click "Import CSV"
4. Preview and resolve conflicts
5. Confirm import

### Backup and Data Management

**Export Backup:**
- Settings → Data Management → "Export Backup"
- Downloads a complete JSON backup of all data
- Includes products, suppliers, movements, purchases, and settings

**Clear All Data:**
- Settings → Data Management → "Clear All Data"
- Removes all local data and logs out
- Use before switching accounts or for fresh start

## Troubleshooting

### Token Issues

**"Invalid token" error:**
- Verify the token has the `gist` scope
- Check if the token has expired
- Generate a new token and update in Settings

**"Rate limit exceeded":**
- GitHub API has rate limits (5000 requests/hour for authenticated users)
- Wait a few minutes and try again
- The app implements automatic retry with backoff

### Sync Issues

**"Remote changes detected" conflict:**
- This happens when the Gist was modified from another device/tab
- Click "Reload" to fetch the latest data
- Your local changes will be preserved in the offline queue

**"Pending sync" status:**
- The app queues changes when offline
- Changes will sync automatically when connection returns
- Check Settings → Data Management for sync status

### Performance Issues

**Slow product search:**
- The app is optimized for 1,000-5,000 products
- Search uses client-side indexing with debouncing
- If you have more products, consider filtering by category first

**Slow loading:**
- First load fetches from Gist (may take a few seconds)
- Subsequent loads use IndexedDB cache (instant)
- Check your internet connection
- Clear cache in Settings if data seems stale

### Build Issues

**TypeScript errors during build:**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Base path issues on GitHub Pages:**
- Ensure `base` in `vite.config.ts` matches your repository name
- Example: repo `my-app` needs `base: '/my-app/'`
- Don't forget the trailing slash!

### Data Issues

**Missing data after login:**
- Check if you're using the correct token
- Verify the Gist exists in your GitHub account
- Try "Export Backup" from another device if you have it

**Stock calculations seem wrong:**
- Go to Settings → Data Management
- Check "Refresh Stock Snapshots"
- This recalculates stock from movement history

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Testing
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI

# Deployment
npm run deploy       # Build and deploy to gh-pages branch
```

### Technology Stack

- **React 19**: UI framework
- **TypeScript**: Type-safe development (strict mode)
- **Vite 8**: Fast build tool and dev server
- **React Router 7**: Client-side routing
- **date-fns**: Date manipulation
- **Vitest**: Unit testing
- **GitHub Gist API**: Serverless persistence
- **IndexedDB**: Local caching and offline support

### Architecture Highlights

- **Event Sourcing**: Stock and costs derived from immutable movement/purchase events
- **Optimistic Concurrency**: ETag-based conflict detection
- **Monthly Partitioning**: Movements and purchases split by month for scalability
- **Cache-First**: Fast loads with background sync
- **Offline Queue**: Changes queued when offline, synced when online

## Security & Privacy

- **No PII Storage**: The app doesn't store customer personal information
- **Minimal Permissions**: Only requires `gist` scope (no repo access)
- **Local Storage**: Token stored in browser localStorage
- **Optional Encryption**: Enable passphrase-based token encryption in Settings
- **Easy Logout**: Clear all data with one click

## Data Storage

All data is stored in a single GitHub Gist with multiple JSON files:

- `products.json` - Product catalog
- `suppliers.json` - Supplier list
- `movements_YYYY_MM.json` - Stock movements (partitioned by month)
- `purchases_YYYY_MM.json` - Purchase history (partitioned by month)
- `settings.json` - App settings
- `meta.json` - Metadata and stock snapshots

## Contributing

This is a private project. For issues or feature requests, please contact the maintainer.

## License

Private project - All rights reserved
