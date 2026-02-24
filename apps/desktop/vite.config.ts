import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// TAURI_DEV_HOST is set by `tauri dev` when on a mobile device / remote target.
// For desktop-only builds it is undefined and we bind to localhost.
const tauriDevHost = process.env['TAURI_DEV_HOST']

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  build: {
    // Tauri bundles the renderer from dist/renderer.
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // Tauri supports modern browsers — no need to target legacy environments.
    target: 'esnext',
    minify: !process.env['TAURI_DEBUG'] ? 'esbuild' : false,
    sourcemap: Boolean(process.env['TAURI_DEBUG']),
    rollupOptions: {
      // Node-native modules must never enter the browser bundle.
      external: [
        'better-sqlite3',
        'node:fs',
        'node:path',
        'node:os',
        'node:child_process',
        'node:crypto',
        'node:fs/promises',
        'node:util',
        'fs',
        'path',
        'os',
        'child_process',
        'crypto',
        '@agenthub/infrastructure',
        '@agenthub/graph-tools',
      ],
    },
  },
  optimizeDeps: {
    // Prevent Vite from pre-bundling Node-native packages for the browser.
    exclude: [
      'better-sqlite3',
      'node:fs',
      'node:path',
      'node:os',
      'node:child_process',
      'node:crypto',
      '@agenthub/infrastructure',
      '@agenthub/graph-tools',
    ],
  },
  server: {
    // Tauri expects a stable port for its devUrl.
    port: 5173,
    strictPort: true,
    host: tauriDevHost ?? false,
    hmr: tauriDevHost
      ? { protocol: 'ws', host: tauriDevHost, port: 5183 }
      : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
  // Expose VITE_* and TAURI_* env vars to the renderer.
  envPrefix: ['VITE_', 'TAURI_'],
})
