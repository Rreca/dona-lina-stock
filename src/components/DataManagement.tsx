import { SyncStatus } from './SyncStatus';
import { useState, useRef } from 'react';
import type { Product, Supplier, StockMovement, Purchase, Settings, MetaFile } from '../models/types';
import { BackupService } from '../services/backup-service';
import { csvExportService, type CSVColumn } from '../services/csv-export';
import { csvImportService, type ConflictResolution } from '../services/csv-import';
import { dataClearingService } from '../services/data-clearing';
import './DataManagement.css';

interface DataManagementProps {
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  purchases: Purchase[];
  settings: Settings;
  meta: MetaFile;
  lastSyncAt?: string;
  syncStatus?: 'saved' | 'saving' | 'pending' | 'error';
  pendingQueueCount?: number;
  onProductCreate?: (product: any) => Promise<Product>;
  onProductUpdate?: (id: string, updates: any) => Promise<Product>;
}

const AVAILABLE_COLUMNS: { value: CSVColumn; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'category', label: 'Categoría' },
  { value: 'unit', label: 'Unidad' },
  { value: 'sku', label: 'SKU' },
  { value: 'minStock', label: 'Stock Mínimo' },
  { value: 'salePrice', label: 'Precio de Venta' },
  { value: 'active', label: 'Activo' },
];

export function DataManagement({
  products,
  suppliers,
  movements,
  purchases,
  settings,
  meta,
  lastSyncAt,
  syncStatus = 'saved',
  pendingQueueCount = 0,
  onProductCreate,
  onProductUpdate,
}: DataManagementProps) {
  const [selectedColumns, setSelectedColumns] = useState<CSVColumn[]>([
    'name',
    'category',
    'unit',
    'sku',
    'minStock',
    'salePrice',
  ]);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage?: number; quota?: number; usagePercentage?: number }>({});
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  const loadStorageInfo = async () => {
    const info = await dataClearingService.getStorageEstimate();
    setStorageInfo(info);
    setShowStorageInfo(true);
  };

  const handleExportBackup = () => {
    try {
      const backup = BackupService.createBackup(
        products,
        suppliers,
        movements,
        purchases,
        settings,
        meta
      );
      BackupService.downloadBackup(backup);
    } catch (error) {
      console.error('Failed to export backup:', error);
      alert('Error al exportar backup: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleImportBackupClick = () => {
    backupFileInputRef.current?.click();
  };

  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingBackup(true);
    setBackupPreview(null);

    try {
      const content = await file.text();
      const backup = BackupService.parseBackup(content);
      
      // Create preview
      setBackupPreview({
        version: backup.version,
        exportedAt: backup.exportedAt,
        productsCount: backup.products.length,
        suppliersCount: backup.suppliers.length,
        movementsCount: backup.movements.length,
        purchasesCount: backup.purchases.length,
        backup: backup,
      });
    } catch (error) {
      console.error('Failed to read backup file:', error);
      alert('Error al leer archivo de backup: ' + (error instanceof Error ? error.message : 'Archivo inválido'));
    } finally {
      setImportingBackup(false);
      // Reset file input
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmBackupImport = async () => {
    if (!backupPreview || !backupPreview.backup) {
      return;
    }

    if (!confirm('⚠️ ADVERTENCIA: Esto reemplazará TODOS tus datos actuales con los del backup. ¿Estás seguro?')) {
      return;
    }

    setImportingBackup(true);

    try {
      const backup = backupPreview.backup;
      
      // Clear all existing data first
      localStorage.clear();
      
      // Store all data from backup in localStorage
      localStorage.setItem('products', JSON.stringify(backup.products));
      localStorage.setItem('suppliers', JSON.stringify(backup.suppliers));
      localStorage.setItem('movements', JSON.stringify(backup.movements));
      localStorage.setItem('purchases', JSON.stringify(backup.purchases));
      localStorage.setItem('settings', JSON.stringify(backup.settings));
      localStorage.setItem('meta', JSON.stringify(backup.meta));

      // Clear IndexedDB cache to force fresh sync
      try {
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (e) {
        console.warn('Could not clear IndexedDB:', e);
      }

      alert('✓ Backup importado exitosamente. La página se recargará.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to import backup:', error);
      alert('Error al importar backup: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setImportingBackup(false);
    }
  };

  const handleCancelBackupImport = () => {
    setBackupPreview(null);
  };

  const handleColumnToggle = (column: CSVColumn) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const handleExportCSV = async () => {
    try {
      await csvExportService.exportProductsWithConfig(products, {
        columns: selectedColumns,
        includeHeaders: true,
        filename: `productos-${new Date().toISOString().split('T')[0]}.csv`,
      });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Error al exportar CSV: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportPreview(null);
    setImportResult(null);

    try {
      const content = await csvImportService.readFile(file);
      const preview = await csvImportService.preview(content, products);
      setImportPreview(preview);
    } catch (error) {
      console.error('Failed to preview CSV:', error);
      alert('Error al leer archivo CSV: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !onProductCreate || !onProductUpdate) {
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;

      const content = await csvImportService.readFile(file);
      const result = await csvImportService.import(
        content,
        products,
        conflictResolution,
        onProductCreate,
        onProductUpdate
      );

      setImportResult(result);
      setImportPreview(null);
    } catch (error) {
      console.error('Failed to import CSV:', error);
      alert('Error al importar CSV: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setImportResult(null);
  };

  const handleClearCache = async () => {
    if (!confirm('¿Estás seguro de borrar la caché local? Los datos remotos en GitHub no se verán afectados.')) {
      return;
    }

    try {
      const result = await dataClearingService.clearCacheOnly();
      if (result.success) {
        alert('Caché borrada exitosamente. La página se recargará.');
        window.location.reload();
      } else {
        alert('Error al borrar caché: ' + result.errors.join(', '));
      }
    } catch (error) {
      alert('Error al borrar caché: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleViewStorageLocations = () => {
    const locations = dataClearingService.getStorageLocations();
    const message = locations
      .map(
        (loc) =>
          `${loc.location}:\n${loc.description}\n- ${loc.dataTypes.join('\n- ')}`
      )
      .join('\n\n');
    alert('Ubicaciones de Almacenamiento:\n\n' + message);
  };

  return (
    <div className="data-management">
      <h3>Gestión de Datos</h3>

      {/* Sync Status */}
      <SyncStatus
        status={syncStatus}
        lastSyncAt={lastSyncAt ? new Date(lastSyncAt) : null}
        pendingCount={pendingQueueCount}
      />

      {/* Export Backup */}
      <section className="data-section">
        <h4>Exportar Backup Completo</h4>
        <p className="section-description">
          Descarga un archivo JSON con todos tus datos (productos, proveedores, movimientos, compras, configuración).
        </p>
        <button className="btn-primary" onClick={handleExportBackup}>
          📦 Exportar Backup
        </button>
      </section>

      {/* Import Backup */}
      <section className="data-section">
        <h4>Importar Backup Completo</h4>
        <p className="section-description">
          Restaura todos tus datos desde un archivo de backup previamente exportado.
        </p>

        <input
          ref={backupFileInputRef}
          type="file"
          accept=".json"
          onChange={handleBackupFileSelect}
          style={{ display: 'none' }}
        />

        {!backupPreview && (
          <button className="btn-primary" onClick={handleImportBackupClick} disabled={importingBackup}>
            {importingBackup ? 'Cargando...' : '📥 Seleccionar Archivo de Backup'}
          </button>
        )}

        {/* Backup Preview */}
        {backupPreview && (
          <div className="import-preview">
            <h5>Vista Previa del Backup</h5>
            
            <div className="preview-stats">
              <div className="stat">
                <span className="stat-label">Versión:</span>
                <span className="stat-value">{backupPreview.version}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Exportado:</span>
                <span className="stat-value">{new Date(backupPreview.exportedAt).toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="preview-stats">
              <div className="stat stat-info">
                <span className="stat-label">Productos:</span>
                <span className="stat-value">{backupPreview.productsCount}</span>
              </div>
              <div className="stat stat-info">
                <span className="stat-label">Proveedores:</span>
                <span className="stat-value">{backupPreview.suppliersCount}</span>
              </div>
              <div className="stat stat-info">
                <span className="stat-label">Movimientos:</span>
                <span className="stat-value">{backupPreview.movementsCount}</span>
              </div>
              <div className="stat stat-info">
                <span className="stat-label">Compras:</span>
                <span className="stat-value">{backupPreview.purchasesCount}</span>
              </div>
            </div>

            <div className="alert alert-warning">
              ⚠️ ADVERTENCIA: Importar este backup reemplazará TODOS tus datos actuales (local y en GitHub Gist). Esta acción no se puede deshacer. Se recomienda hacer un backup antes de importar.
            </div>

            <div className="preview-actions">
              <button
                className="btn-warning"
                onClick={handleConfirmBackupImport}
                disabled={importingBackup}
              >
                {importingBackup ? 'Importando...' : '⚠️ Confirmar Importación'}
              </button>
              <button className="btn-secondary" onClick={handleCancelBackupImport} disabled={importingBackup}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Export CSV */}
      <section className="data-section">
        <h4>Exportar Productos a CSV</h4>
        <p className="section-description">
          Selecciona las columnas que deseas incluir en el archivo CSV.
        </p>
        
        <div className="column-selector">
          {AVAILABLE_COLUMNS.map((col) => (
            <label key={col.value} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedColumns.includes(col.value)}
                onChange={() => handleColumnToggle(col.value)}
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={handleExportCSV}
          disabled={selectedColumns.length === 0}
        >
          📄 Exportar CSV
        </button>
      </section>

      {/* Import CSV */}
      <section className="data-section">
        <h4>Importar Productos desde CSV</h4>
        <p className="section-description">
          Carga un archivo CSV para crear o actualizar productos masivamente.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {!importPreview && !importResult && (
          <button className="btn-primary" onClick={handleImportClick} disabled={importing}>
            {importing ? 'Cargando...' : '📥 Seleccionar Archivo CSV'}
          </button>
        )}

        {/* Import Preview */}
        {importPreview && (
          <div className="import-preview">
            <h5>Vista Previa de Importación</h5>
            
            <div className="preview-stats">
              <div className="stat">
                <span className="stat-label">Total de filas:</span>
                <span className="stat-value">{importPreview.totalRows}</span>
              </div>
              <div className="stat stat-success">
                <span className="stat-label">Válidas:</span>
                <span className="stat-value">{importPreview.validRows}</span>
              </div>
              <div className="stat stat-error">
                <span className="stat-label">Inválidas:</span>
                <span className="stat-value">{importPreview.invalidRows}</span>
              </div>
              <div className="stat stat-warning">
                <span className="stat-label">Conflictos (SKU existente):</span>
                <span className="stat-value">{importPreview.conflicts.length}</span>
              </div>
            </div>

            {importPreview.conflicts.length > 0 && (
              <div className="conflict-resolution">
                <label>
                  <strong>Resolución de conflictos:</strong>
                </label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="conflictResolution"
                      value="skip"
                      checked={conflictResolution === 'skip'}
                      onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    />
                    <span>Omitir productos con SKU existente</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="conflictResolution"
                      value="update"
                      checked={conflictResolution === 'update'}
                      onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    />
                    <span>Actualizar productos existentes</span>
                  </label>
                </div>
              </div>
            )}

            {importPreview.invalidRows > 0 && (
              <div className="alert alert-warning">
                Hay {importPreview.invalidRows} filas con errores que no se importarán.
              </div>
            )}

            <div className="preview-actions">
              <button
                className="btn-primary"
                onClick={handleConfirmImport}
                disabled={importing || importPreview.validRows === 0}
              >
                {importing ? 'Importando...' : 'Confirmar Importación'}
              </button>
              <button className="btn-secondary" onClick={handleCancelImport} disabled={importing}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="import-result">
            <h5>Resultado de Importación</h5>
            
            <div className="result-stats">
              <div className="stat stat-success">
                <span className="stat-label">Importados:</span>
                <span className="stat-value">{importResult.imported}</span>
              </div>
              <div className="stat stat-info">
                <span className="stat-label">Actualizados:</span>
                <span className="stat-value">{importResult.updated}</span>
              </div>
              <div className="stat stat-warning">
                <span className="stat-label">Omitidos:</span>
                <span className="stat-value">{importResult.skipped}</span>
              </div>
              <div className="stat stat-error">
                <span className="stat-label">Errores:</span>
                <span className="stat-value">{importResult.errors.length}</span>
              </div>
            </div>

            {importResult.success ? (
              <div className="alert alert-success">
                ✓ Importación completada exitosamente
              </div>
            ) : (
              <div className="alert alert-error">
                ✗ Importación completada con errores
              </div>
            )}

            <button className="btn-secondary" onClick={handleCancelImport}>
              Cerrar
            </button>
          </div>
        )}
      </section>

      {/* Privacy and Data Clearing */}
      <section className="data-section privacy-section">
        <h4>Privacidad y Gestión de Datos</h4>
        <p className="section-description">
          Esta aplicación no almacena información personal de clientes. Solo datos de negocio (productos, proveedores, stock).
        </p>

        <div className="privacy-info">
          <div className="info-item">
            <span className="info-icon">🔒</span>
            <div className="info-content">
              <strong>Sin PII</strong>
              <p>No se almacenan nombres, direcciones, teléfonos o emails de clientes</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">💾</span>
            <div className="info-content">
              <strong>Almacenamiento Local</strong>
              <p>Datos en tu navegador (localStorage + IndexedDB)</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">☁️</span>
            <div className="info-content">
              <strong>GitHub Gist</strong>
              <p>Datos remotos en tu cuenta personal de GitHub</p>
            </div>
          </div>
        </div>

        <div className="privacy-actions">
          <button className="btn-secondary" onClick={handleViewStorageLocations}>
            📍 Ver Ubicaciones de Datos
          </button>
          <button className="btn-secondary" onClick={loadStorageInfo}>
            📊 Ver Uso de Almacenamiento
          </button>
          <button className="btn-warning" onClick={handleClearCache}>
            🗑️ Borrar Caché Local
          </button>
        </div>

        {showStorageInfo && storageInfo.usage !== undefined && (
          <div className="storage-info">
            <h5>Uso de Almacenamiento</h5>
            <div className="storage-stats">
              <div className="stat">
                <span className="stat-label">Usado:</span>
                <span className="stat-value">{dataClearingService.formatBytes(storageInfo.usage)}</span>
              </div>
              {storageInfo.quota && (
                <>
                  <div className="stat">
                    <span className="stat-label">Disponible:</span>
                    <span className="stat-value">{dataClearingService.formatBytes(storageInfo.quota)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Porcentaje:</span>
                    <span className="stat-value">{storageInfo.usagePercentage?.toFixed(2)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="help-box">
          <p className="help-title">📄 Documentación de Privacidad</p>
          <p>
            Para más información sobre qué datos se almacenan y dónde, consulta el archivo{' '}
            <code>PRIVACY.md</code> en el repositorio del proyecto.
          </p>
        </div>
      </section>
    </div>
  );
}
