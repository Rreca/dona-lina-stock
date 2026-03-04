import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/', // Serve from root
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split vendor code
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
          // Split services
          if (id.includes('/services/product-service') ||
              id.includes('/services/movement-service') ||
              id.includes('/services/purchase-service') ||
              id.includes('/services/cost-service') ||
              id.includes('/services/pricing-service')) {
            return 'services';
          }
          // Split gist/sync related code
          if (id.includes('/services/gist-client') ||
              id.includes('/services/gist-sync') ||
              id.includes('/services/app-sync') ||
              id.includes('/services/cache')) {
            return 'sync';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}))
