import { useState } from 'react';
import type { Product, Supplier, StockMovement, Purchase, Settings, MetaFile } from '../models/types';
import { SettingsForm } from './SettingsForm';
import { AuthSettings } from './AuthSettings';
import { DataManagement } from './DataManagement';
import './SettingsScreen.css';

interface SettingsScreenProps {
  settings: Settings;
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  purchases: Purchase[];
  meta: MetaFile;
  lastSyncAt?: string;
  syncStatus?: 'saved' | 'saving' | 'pending' | 'error';
  pendingQueueCount?: number;
  onSettingsSave?: (settings: Settings) => void;
  onLogout?: () => void;
  onProductCreate?: (product: any) => Promise<Product>;
  onProductUpdate?: (id: string, updates: any) => Promise<Product>;
}

type TabType = 'general' | 'auth' | 'data';

export function SettingsScreen({
  settings,
  products,
  suppliers,
  movements,
  purchases,
  meta,
  lastSyncAt,
  syncStatus,
  pendingQueueCount = 0,
  onSettingsSave,
  onLogout,
  onProductCreate,
  onProductUpdate,
}: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <h2>Configuración</h2>
      </div>

      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          ⚙️ General
        </button>
        <button
          className={`tab-button ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          🔐 Autenticación
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          💾 Datos
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <SettingsForm settings={settings} onSave={onSettingsSave} />
        )}

        {activeTab === 'auth' && (
          <AuthSettings onLogout={onLogout} />
        )}

        {activeTab === 'data' && (
          <DataManagement
            products={products}
            suppliers={suppliers}
            movements={movements}
            purchases={purchases}
            settings={settings}
            meta={meta}
            lastSyncAt={lastSyncAt}
            syncStatus={syncStatus}
            pendingQueueCount={pendingQueueCount}
            onProductCreate={onProductCreate}
            onProductUpdate={onProductUpdate}
          />
        )}
      </div>
    </div>
  );
}
