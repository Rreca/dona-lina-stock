/**
 * Example usage of SettingsScreen component
 * This file demonstrates how to integrate the Settings screen in the application
 */

import { useState } from 'react';
import { SettingsScreen } from './SettingsScreen';
import type { Settings, Product, Supplier, StockMovement, Purchase, MetaFile } from '../models/types';

// Example data
const exampleSettings: Settings = {
  costMethod: 'last',
  weightedAvgWindow: {
    type: 'last_n_purchases',
    value: 5,
  },
  priceRule: {
    markupPct: 30,
    roundToCents: 10,
    minMarginPct: 15,
  },
};

const exampleMeta: MetaFile = {
  schemaVersion: '1.0.0',
  lastSyncAt: new Date().toISOString(),
  snapshots: {},
};

export function SettingsScreenExample() {
  const [settings, setSettings] = useState<Settings>(exampleSettings);
  const [products] = useState<Product[]>([]);
  const [suppliers] = useState<Supplier[]>([]);
  const [movements] = useState<StockMovement[]>([]);
  const [purchases] = useState<Purchase[]>([]);

  const handleSettingsSave = (newSettings: Settings) => {
    console.log('Saving settings:', newSettings);
    setSettings(newSettings);
    // In real app: save to Gist via sync service
  };

  const handleLogout = () => {
    console.log('Logging out...');
    // In real app: clear auth and redirect to login
  };

  const handleProductCreate = async (productData: any): Promise<Product> => {
    console.log('Creating product:', productData);
    // In real app: call product service
    return {
      id: crypto.randomUUID(),
      ...productData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Product;
  };

  const handleProductUpdate = async (id: string, updates: any): Promise<Product> => {
    console.log('Updating product:', id, updates);
    // In real app: call product service
    return {
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Product;
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', minHeight: '100vh' }}>
      <SettingsScreen
        settings={settings}
        products={products}
        suppliers={suppliers}
        movements={movements}
        purchases={purchases}
        meta={exampleMeta}
        lastSyncAt={new Date().toISOString()}
        syncStatus="saved"
        onSettingsSave={handleSettingsSave}
        onLogout={handleLogout}
        onProductCreate={handleProductCreate}
        onProductUpdate={handleProductUpdate}
      />
    </div>
  );
}
