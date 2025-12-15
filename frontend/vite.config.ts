import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  // Vite automatically loads VITE_* prefixed variables from .env files
  // No need for manual definition - just let Vite handle it
  // Files loaded: .env, .env.local, .env.[mode], .env.[mode].local

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // Listen on all interfaces for Docker
      host: '0.0.0.0',
      port: 5173,
      // Enable HMR for Docker
      watch: {
        usePolling: true,
        interval: 1000,
      },
      // Configure HMR for Docker
      hmr: {
        clientPort: 5173,
      },
    },
    // Optimize dependencies for faster cold starts
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'framer-motion',
      ],
    },
    // Build configuration
    build: {
      // Output directory
      outDir: 'dist',
      // Generate source maps for production debugging
      sourcemap: mode === 'development',
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
    },
  }
})
