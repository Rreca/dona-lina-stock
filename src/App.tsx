import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation, ProtectedRoute, ErrorBoundary, ToastContainer, LoadingSpinner } from './components';
import { LoginScreen } from './screens';
import { authService } from './services/auth';

// Lazy load screens for code splitting
const ProductsScreen = lazy(() => import('./screens/ProductsScreen').then(m => ({ default: m.ProductsScreen })));
const MovementsScreen = lazy(() => import('./screens/MovementsScreen').then(m => ({ default: m.MovementsScreen })));
const PurchasesScreen = lazy(() => import('./screens/PurchasesScreen').then(m => ({ default: m.PurchasesScreen })));
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
import { cacheService } from './services/cache';
import { syncFromGist, syncToGist, getOfflineQueueStatus, processOfflineQueue } from './services/app-sync';
import type {
  Product,
  Supplier,
  StockMovement,
  Purchase,
  Settings,
  MetaFile,
} from './models/types';
import type { ToastProps } from './components/Toast';
import './App.css';
import './components/LoadingSpinner.css';

const defaultSettings: Settings = {
  costMethod: 'last',
  weightedAvgWindow: {
    type: 'last_n_purchases',
    value: 5,
  },
  priceRule: {
    markupPct: 30,
    roundToCents: 10,
    minMarginPct: 20,
  },
};

const defaultMeta: MetaFile = {
  schemaVersion: '1.0.0',
  lastSyncAt: new Date().toISOString(),
  snapshots: {},
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [meta, setMeta] = useState<MetaFile>(defaultMeta);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'pending' | 'error'>('saved');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

  // Check for network connectivity and process offline queue
  useEffect(() => {
    const handleOnline = async () => {
      const token = localStorage.getItem('github_token');
      if (token && isAuthenticated) {
        try {
          const processed = await processOfflineQueue(token);
          if (processed > 0) {
            addToast({
              id: crypto.randomUUID(),
              message: `${processed} operación(es) sincronizada(s)`,
              type: 'success',
            });
            await updateQueueStatus(token);
          }
        } catch (error) {
          console.error('Error processing offline queue:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated]);

  // Update queue status periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateQueue = async () => {
      const token = localStorage.getItem('github_token');
      if (token) {
        await updateQueueStatus(token);
      }
    };

    updateQueue();
    const interval = setInterval(updateQueue, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const updateQueueStatus = async (token: string) => {
    try {
      const status = await getOfflineQueueStatus(token);
      setPendingQueueCount(status.pendingCount);
    } catch (error) {
      console.error('Error getting queue status:', error);
    }
  };

  const addToast = (toast: Omit<ToastProps, 'onClose'>) => {
    setToasts((prev) => [...prev, toast]);
  };

  const initializeApp = async () => {
    try {
      // Check for stored token and gist ID
      const token = localStorage.getItem('github_token');
      const gistId = localStorage.getItem('gist_id');
      if (token && gistId) {
        // Validate token
        const result = await authService.validateToken(token);
        if (result.valid) {
          setIsAuthenticated(true);
          // Load cached data
          await loadCachedData();
          // Sync with Gist in background
          syncInBackground(token);
        } else {
          localStorage.removeItem('github_token');
          localStorage.removeItem('gist_id');
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadCachedData = async () => {
    try {
      const products = await cacheService.getProducts();
      const suppliers = await cacheService.getSuppliers();
      const movements = await cacheService.getMovements();
      const purchases = await cacheService.getPurchases();
      const settings = await cacheService.getSettings();
      const meta = await cacheService.getMeta();

      if (products.length > 0) setProducts(products);
      if (suppliers.length > 0) setSuppliers(suppliers);
      if (movements.length > 0) setMovements(movements);
      if (purchases.length > 0) setPurchases(purchases);
      if (settings) setSettings(settings);
      if (meta) setMeta(meta);
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  const syncInBackground = async (token: string) => {
    try {
      setSyncStatus('saving');
      const data = await syncFromGist(token);
      if (data.products.length > 0) setProducts(data.products);
      if (data.suppliers.length > 0) setSuppliers(data.suppliers);
      if (data.movements.length > 0) setMovements(data.movements);
      if (data.purchases.length > 0) setPurchases(data.purchases);
      if (data.settings) setSettings(data.settings);
      if (data.meta) setMeta(data.meta);

      setSyncStatus('saved');
      setLastSyncAt(new Date().toISOString());
    } catch (error) {
      console.error('Background sync error:', error);
      setSyncStatus('error');
    }
  };

  const handleLogin = async (token: string, gistId: string) => {
    const result = await authService.validateToken(token);
    if (!result.valid) {
      throw new Error(result.error || 'Token inválido o sin permisos de gist');
    }
    localStorage.setItem('github_token', token);
    localStorage.setItem('gist_id', gistId);
    setIsAuthenticated(true);
    await loadCachedData();
    syncInBackground(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('gist_id');
    setIsAuthenticated(false);
    setProducts([]);
    setSuppliers([]);
    setMovements([]);
    setPurchases([]);
    setSettings(defaultSettings);
    setMeta(defaultMeta);
  };

  const handleProductCreate = async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> => {
    const newProduct: Product = {
      ...productData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { products: updatedProducts });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }

    return newProduct;
  };

  const handleProductUpdate = async (
    id: string,
    updates: Partial<Product>
  ): Promise<Product> => {
    const updatedProducts = products.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    setProducts(updatedProducts);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { products: updatedProducts });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }

    return updatedProducts.find((p) => p.id === id)!;
  };

  const handleMovementCreate = async (
    movementData: Omit<StockMovement, 'id' | 'createdAt'>
  ): Promise<StockMovement> => {
    const newMovement: StockMovement = {
      ...movementData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updatedMovements = [...movements, newMovement];
    setMovements(updatedMovements);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { movements: updatedMovements });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }

    return newMovement;
  };

  const handlePurchaseCreate = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt'>
  ): Promise<Purchase> => {
    const newPurchase: Purchase = {
      ...purchaseData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updatedPurchases = [...purchases, newPurchase];
    setPurchases(updatedPurchases);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { purchases: updatedPurchases });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }

    return newPurchase;
  };

  const handlePurchaseUpdate = async (
    id: string,
    updates: Partial<Purchase>
  ): Promise<Purchase> => {
    const updatedPurchases = purchases.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    setPurchases(updatedPurchases);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { purchases: updatedPurchases });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }

    return updatedPurchases.find((p) => p.id === id)!;
  };

  const handlePurchaseDelete = async (id: string): Promise<void> => {
    const updatedPurchases = purchases.filter((p) => p.id !== id);
    setPurchases(updatedPurchases);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { purchases: updatedPurchases });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }
  };

  const handleSupplierCreate = async (supplier: Supplier): Promise<void> => {
    const updatedSuppliers = [...suppliers, supplier];
    setSuppliers(updatedSuppliers);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { suppliers: updatedSuppliers });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }
  };

  const handleSettingsSave = async (newSettings: Settings) => {
    setSettings(newSettings);

    // Sync to Gist
    const token = localStorage.getItem('github_token');
    if (token) {
      try {
        setSyncStatus('saving');
        await syncToGist(token, { settings: newSettings });
        setSyncStatus('saved');
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('pending');
        await updateQueueStatus(token);
      }
    }
  };

  const handleToastClose = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  if (isInitializing) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" message="Inicializando aplicación..." />
      </div>
    );
  }

  // Loading fallback for lazy-loaded routes
  const RouteLoadingFallback = () => (
    <div className="route-loading">
      <LoadingSpinner size="medium" message="Cargando pantalla..." />
    </div>
  );

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <a href="#main-content" className="skip-link">
            Saltar al contenido principal
          </a>
          {isAuthenticated && <Navigation />}
          <main id="main-content" className="app-main" role="main">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    isAuthenticated ? <Navigate to="/products" replace /> : <LoginScreen onLogin={handleLogin} />
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <ProductsScreen
                        products={products}
                        purchases={purchases}
                        movements={movements}
                        settings={settings}
                        onProductCreate={handleProductCreate}
                        onProductUpdate={handleProductUpdate}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/movements"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <MovementsScreen
                        movements={movements}
                        onMovementCreate={handleMovementCreate}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchases"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <PurchasesScreen
                        purchases={purchases}
                        suppliers={suppliers}
                        products={products}
                        onPurchaseCreate={handlePurchaseCreate}
                        onPurchaseUpdate={handlePurchaseUpdate}
                        onPurchaseDelete={handlePurchaseDelete}
                        onSupplierCreate={handleSupplierCreate}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SettingsScreen
                        settings={settings}
                        products={products}
                        suppliers={suppliers}
                        movements={movements}
                        purchases={purchases}
                        meta={meta}
                        lastSyncAt={lastSyncAt || undefined}
                        syncStatus={syncStatus}
                        pendingQueueCount={pendingQueueCount}
                        onSettingsSave={handleSettingsSave}
                        onLogout={handleLogout}
                        onProductCreate={handleProductCreate}
                        onProductUpdate={handleProductUpdate}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/products" replace />} />
              </Routes>
            </Suspense>
          </main>
          <ToastContainer toasts={toasts} onClose={handleToastClose} />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
