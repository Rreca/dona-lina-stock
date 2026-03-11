# Uso Multi-Dispositivo: Problemas y Soluciones

## ⚠️ Problema Actual: "Last Write Wins"

### Escenario Problemático

```
Dispositivo A (Computadora)          Dispositivo B (Celular)
─────────────────────────────────    ─────────────────────────────────

1. Abre la app                       1. Abre la app
   Lee Gist: 10 productos               Lee Gist: 10 productos
   
2. Crea "Producto A"                 
   Guarda en Gist: 11 productos
   
3.                                   2. Crea "Producto B"
                                        Guarda en Gist: 11 productos
                                        
4. Resultado: ❌ "Producto A" se PIERDE
   El Gist ahora tiene solo "Producto B"
```

### ¿Por Qué Pasa Esto?

Ambos dispositivos:
1. Leen el Gist con 10 productos
2. Agregan 1 producto localmente (A o B)
3. Escriben TODO el array al Gist (11 productos)
4. El último que escribe SOBRESCRIBE al anterior

Esto se llama **"Last Write Wins"** (el último que escribe gana).

## 🔍 Estado Actual del Código

El código tiene soporte para ETags pero **NO lo está usando**:

```typescript
// gist-client.ts - Lee y guarda ETag
async read(): Promise<GistReadResult> {
  const etag = response.headers.get("ETag");
  if (etag) {
    this.etag = etag;  // ✓ Guarda el ETag
  }
}

// gist-client.ts - NO usa ETag al escribir
async write(files: Record<string, string | null>): Promise<GistWriteResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${this.config.token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    // ❌ Falta: "If-Match": this.etag
  };
}
```

## ✅ Soluciones

### Solución 1: Usar ETags (Recomendado para Uso Ocasional)

**Cómo funciona:**
- Cada vez que lees el Gist, GitHub te da un "ETag" (versión)
- Al escribir, envías el ETag
- Si otro dispositivo escribió primero, GitHub rechaza tu escritura con error 412
- La app detecta el conflicto y muestra un modal para resolverlo

**Ventajas:**
- Detecta conflictos automáticamente
- El usuario decide qué datos mantener
- Ya hay un `ConflictModal.tsx` implementado

**Desventajas:**
- Requiere intervención manual del usuario
- Puede ser molesto si hay muchos conflictos

**Implementación:**
```typescript
// En gist-client.ts
async write(files: Record<string, string | null>): Promise<GistWriteResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${this.config.token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  // Agregar ETag para detección de conflictos
  if (this.etag) {
    headers["If-Match"] = this.etag;
  }

  const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ files: gistFiles }),
  });

  // Si hay conflicto, GitHub responde 412 Precondition Failed
  if (response.status === 412) {
    throw new GistError("conflict", "Conflict detected", 412);
  }
}
```

### Solución 2: Sincronización Periódica (Recomendado para Uso Frecuente)

**Cómo funciona:**
- Cada 30-60 segundos, la app lee el Gist en segundo plano
- Si hay cambios remotos, los fusiona con los locales
- Usa timestamps para determinar qué cambio es más reciente

**Ventajas:**
- Menos conflictos (los dispositivos se mantienen sincronizados)
- Experiencia más fluida

**Desventajas:**
- Más requests a GitHub API (límite: 5000/hora)
- Más complejo de implementar

### Solución 3: Usar un Backend Real (Ideal para Producción)

**Opciones:**
- Firebase Realtime Database
- Supabase
- PocketBase
- Backend propio con WebSockets

**Ventajas:**
- Sincronización en tiempo real
- Manejo robusto de conflictos
- Sin límites de API

**Desventajas:**
- Requiere infraestructura adicional
- Más complejo de configurar

## 🎯 Recomendación Actual

### Para tu caso de uso (negocio pequeño):

**Opción A: Usar un solo dispositivo a la vez**
- Más simple y sin riesgo de conflictos
- Si necesitás usar otro dispositivo, cerrá la app en el primero

**Opción B: Implementar ETags + ConflictModal**
- Si ocasionalmente usás 2 dispositivos
- El modal te permite elegir qué datos mantener
- Requiere modificar `gist-client.ts` (15 líneas de código)

**Opción C: Sincronización periódica**
- Si usás 2 dispositivos frecuentemente
- Más complejo pero mejor experiencia

## 📋 Buenas Prácticas Actuales

Mientras no se implemente detección de conflictos:

1. **Usá un dispositivo principal** para operaciones importantes
2. **Esperá a que sincronice** antes de cambiar de dispositivo
   - Verificá que diga "✓ Guardado" antes de cerrar
3. **Refrescá la página** al abrir en otro dispositivo
   - Esto fuerza una sincronización desde el Gist
4. **Hacé backups regulares** usando "Exportar Backup Completo"

## 🔧 ¿Querés que Implemente la Detección de Conflictos?

Puedo implementar la Solución 1 (ETags + ConflictModal) que:
- Detecta cuando 2 dispositivos modificaron datos
- Muestra un modal con ambas versiones
- Te permite elegir cuál mantener o fusionar manualmente

Es una modificación pequeña (~50 líneas de código) y ya tenés el `ConflictModal.tsx` listo.

¿Te gustaría que lo implemente?
