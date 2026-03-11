# Flujo de Sincronización de Datos

## ¿Qué pasa cuando guardas un nuevo producto?

### Flujo Completo (Paso a Paso)

```
1. Usuario hace click en "Guardar" en el formulario de producto
   ↓
2. App.tsx → handleProductCreate()
   - Crea el producto con ID único y timestamps
   - Actualiza el estado local: setProducts([...products, newProduct])
   - La UI se actualiza INMEDIATAMENTE (ves el producto en la lista)
   ↓
3. Intenta sincronizar con GitHub Gist
   - Cambia estado a: setSyncStatus('saving') → ves "Guardando..." en la UI
   - Llama a: syncToGist(token, { products: updatedProducts })
   ↓
4. syncToGist() → GistSyncService.saveToGist()
   - Prepara el archivo JSON: { "products": [...] }
   - Llama a: gistClient.write(files)
   ↓
5. GistClient.write()
   - Hace PATCH request a: https://api.github.com/gists/{gistId}
   - Envía el JSON con todos los productos
   ↓
6A. SI LA SINCRONIZACIÓN ES EXITOSA:
    - GitHub Gist se actualiza ✓
    - Guarda en IndexedDB (caché local): cacheService.setProducts()
    - Cambia estado a: setSyncStatus('saved') → ves "✓ Guardado" en la UI
    - Actualiza timestamp: setLastSyncAt(now)
    
6B. SI LA SINCRONIZACIÓN FALLA (sin internet, error de red):
    - Guarda en "Offline Queue" (cola de operaciones pendientes)
    - Cambia estado a: setSyncStatus('pending') → ves "⏳ Pendiente" en la UI
    - Cuando vuelva internet, se reintentará automáticamente
```

## Ubicaciones de Almacenamiento

### 1. Estado de React (Memoria RAM)
- **Ubicación**: Variable `products` en App.tsx
- **Duración**: Mientras la app esté abierta
- **Propósito**: UI reactiva e inmediata

### 2. IndexedDB (Caché Local del Navegador)
- **Ubicación**: IndexedDB → base de datos "dona-lina-cache"
- **Duración**: Permanente (hasta que borres caché)
- **Propósito**: Carga rápida al abrir la app (no espera a GitHub)
- **Archivos**: 
  - `products` (todos los productos)
  - `suppliers` (proveedores)
  - `movements` (movimientos de stock)
  - `purchases` (compras)
  - `settings` (configuración)
  - `meta` (metadatos)

### 3. GitHub Gist (Nube)
- **Ubicación**: https://gist.github.com/{tu-usuario}/{gistId}
- **Duración**: Permanente
- **Propósito**: Respaldo en la nube, sincronización entre dispositivos
- **Archivos**:
  - `products.json` - Todos los productos
  - `suppliers.json` - Todos los proveedores
  - `movements_2026_03.json` - Movimientos de marzo 2026
  - `movements_2026_02.json` - Movimientos de febrero 2026
  - `purchases_2026_03.json` - Compras de marzo 2026
  - `settings.json` - Configuración
  - `meta.json` - Metadatos

### 4. Offline Queue (IndexedDB)
- **Ubicación**: IndexedDB → base de datos "offline-queue"
- **Duración**: Hasta que se sincronice exitosamente
- **Propósito**: Guardar operaciones cuando no hay internet

## Flujo al Abrir la App

```
1. Usuario abre la app
   ↓
2. App.tsx → initializeApp()
   - Verifica si hay token guardado
   - Si hay token, valida que sea válido
   ↓
3. loadCachedData()
   - Lee de IndexedDB (caché local)
   - Carga productos, movimientos, etc.
   - Actualiza la UI INMEDIATAMENTE (carga rápida)
   ↓
4. syncInBackground()
   - En segundo plano, lee de GitHub Gist
   - Compara con datos locales
   - Si hay datos más nuevos en Gist, actualiza la UI
   - Actualiza IndexedDB con datos frescos
```

## Ventajas de este Sistema

1. **Carga Instantánea**: Ves tus datos inmediatamente (desde IndexedDB)
2. **Funciona Offline**: Podés crear productos sin internet
3. **Sincronización Automática**: Cuando vuelve internet, se sincronizan automáticamente
4. **Respaldo en la Nube**: Tus datos están seguros en GitHub
5. **Multi-dispositivo**: Podés usar la app desde diferentes navegadores/computadoras

## Estados de Sincronización

- **✓ Guardado** (`saved`): Todo sincronizado con GitHub Gist
- **⏳ Guardando...** (`saving`): Sincronizando ahora mismo
- **⏳ Pendiente** (`pending`): Hay operaciones en cola esperando internet
- **❌ Error** (`error`): Hubo un error de sincronización

## Ejemplo Práctico

```
Escenario: Creás un producto llamado "Lavandina 1L"

1. [0ms] Click en Guardar
2. [10ms] Producto aparece en la lista (estado React)
3. [50ms] Se guarda en IndexedDB (caché local)
4. [100ms] Empieza request a GitHub Gist
5. [500ms] GitHub responde OK
6. [510ms] Ves "✓ Guardado" en la UI

Si NO hay internet:
1. [0ms] Click en Guardar
2. [10ms] Producto aparece en la lista (estado React)
3. [50ms] Se guarda en IndexedDB (caché local)
4. [100ms] Request a GitHub falla
5. [150ms] Se guarda en Offline Queue
6. [160ms] Ves "⏳ Pendiente (1 operación)" en la UI
7. [Cuando vuelve internet] Se sincroniza automáticamente
```

## Archivos Clave del Sistema

- `src/App.tsx` - Maneja el estado y coordina las operaciones
- `src/services/app-sync.ts` - Funciones de sincronización simplificadas
- `src/services/gist-sync.ts` - Lógica de sincronización con Gist
- `src/services/gist-client.ts` - Cliente HTTP para GitHub API
- `src/services/cache.ts` - Manejo de IndexedDB (caché local)
- `src/services/offline-queue.ts` - Cola de operaciones pendientes
