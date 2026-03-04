# Guía de Despliegue en GitHub Pages

Esta guía te ayudará a hospedar tu aplicación Doña Lina Stock en GitHub Pages de forma gratuita.

## Requisitos Previos

1. Una cuenta de GitHub
2. Git instalado en tu computadora
3. El proyecto dona-lina-stock en tu máquina local

## Pasos para Desplegar

### 1. Crear un Repositorio en GitHub

1. Ve a [GitHub](https://github.com) e inicia sesión
2. Haz clic en el botón "+" en la esquina superior derecha
3. Selecciona "New repository"
4. Nombra tu repositorio: `dona-lina-stock` (o el nombre que prefieras)
5. Deja el repositorio como **público** (GitHub Pages gratis solo funciona con repos públicos)
6. **NO** inicialices con README, .gitignore o licencia
7. Haz clic en "Create repository"

### 2. Inicializar Git en tu Proyecto Local

Abre una terminal en la carpeta `dona-lina-stock` y ejecuta:

```bash
# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit - Doña Lina Stock"

# Agregar el repositorio remoto (reemplaza TU_USUARIO con tu nombre de usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/dona-lina-stock.git

# Cambiar a la rama main
git branch -M main

# Subir el código
git push -u origin main
```

### 3. Configurar GitHub Pages

1. Ve a tu repositorio en GitHub
2. Haz clic en "Settings" (Configuración)
3. En el menú lateral, busca "Pages"
4. En "Source", selecciona "GitHub Actions"
5. ¡Listo! El workflow ya está configurado

### 4. Verificar el Despliegue

1. Ve a la pestaña "Actions" en tu repositorio
2. Verás el workflow "Deploy to GitHub Pages" ejecutándose
3. Espera a que termine (toma 2-3 minutos)
4. Una vez completado, tu sitio estará disponible en:
   ```
   https://TU_USUARIO.github.io/dona-lina-stock/
   ```

## Actualizar el Sitio

Cada vez que hagas cambios y los subas a GitHub, el sitio se actualizará automáticamente:

```bash
# Hacer cambios en tu código...

# Agregar los cambios
git add .

# Hacer commit
git commit -m "Descripción de tus cambios"

# Subir a GitHub
git push
```

El workflow se ejecutará automáticamente y tu sitio se actualizará en 2-3 minutos.

## Configuración Importante

### Base Path

El proyecto ya está configurado para funcionar en GitHub Pages. El archivo `vite.config.ts` tiene:

```typescript
base: command === 'build' ? '/dona-lina-stock/' : '/'
```

Si nombraste tu repositorio diferente, actualiza `/dona-lina-stock/` con el nombre de tu repo.

### Nombre del Repositorio Diferente

Si usaste un nombre diferente para tu repositorio, actualiza `vite.config.ts`:

```typescript
base: command === 'build' ? '/TU-NOMBRE-DE-REPO/' : '/'
```

## Dominio Personalizado (Opcional)

Si tienes un dominio propio:

1. Ve a Settings > Pages en tu repositorio
2. En "Custom domain", ingresa tu dominio
3. Sigue las instrucciones para configurar los DNS

## Solución de Problemas

### El sitio muestra una página en blanco

- Verifica que el `base` en `vite.config.ts` coincida con el nombre de tu repositorio
- Asegúrate de que el repositorio sea público
- Revisa los logs en la pestaña "Actions"

### Los cambios no se reflejan

- Espera 2-3 minutos después del push
- Limpia el caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)
- Verifica que el workflow se haya completado exitosamente

### Error 404 al navegar

- Esto es normal en GitHub Pages con React Router
- La aplicación maneja las rutas correctamente una vez cargada
- Si recargas en una ruta específica, GitHub Pages mostrará 404
- Solución: siempre accede desde la URL base

## Características de GitHub Pages

✅ **Gratis** para repositorios públicos
✅ **HTTPS** automático
✅ **CDN global** para carga rápida
✅ **Despliegue automático** con cada push
✅ **Sin límite de ancho de banda** (uso razonable)

## Notas de Seguridad

⚠️ **IMPORTANTE**: 
- Tu código será público en GitHub
- No incluyas tokens o claves secretas en el código
- Los usuarios deben ingresar su propio GitHub token para usar la app
- Los datos se guardan en el Gist del usuario, no en tu servidor

## Próximos Pasos

Una vez desplegado, comparte la URL con tus usuarios:
```
https://TU_USUARIO.github.io/dona-lina-stock/
```

Cada usuario necesitará:
1. Un token de GitHub con permisos de Gist
2. Crear un Gist para almacenar sus datos
3. Configurar el token y Gist ID en la pantalla de login

## Soporte

Si tienes problemas:
1. Revisa los logs en la pestaña "Actions"
2. Verifica la configuración en Settings > Pages
3. Asegúrate de que el repositorio sea público
4. Revisa que el nombre del repo coincida con el `base` en vite.config.ts
