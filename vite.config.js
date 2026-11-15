import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend this dev server forwards to. Override to test against another backend, e.g.
//   VITE_PROXY_TARGET=http://localhost:3999 npx vite --port 5199
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';

const proxy = {
  '/api': { target, changeOrigin: true },
  '/uploads': { target, changeOrigin: true },
  '/output': { target, changeOrigin: true }
};

/**
 * Chunking. Pages are lazy (see src/app/routes.jsx), so without this Rollup also splits every small piece shared
 * between two pages into its own file, and opening a page meant ~15 tiny requests. Instead:
 *   react / router / icons / other libraries: their own long-lived files (they rarely change, so a new release of
 *                                             the studio does not make anyone download React again)
 *   ui:                                       the design-system primitives every page uses
 * The entry imports from these, so the browser starts fetching them from the HTML itself, in parallel.
 */
function manualChunks(id) {
  const p = id.replace(/\\/g, '/');
  if (p.includes('/node_modules/')) {
    if (/\/node_modules\/(react|react-dom|scheduler)\//.test(p)) return 'react';
    if (/\/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(p)) return 'router';
    if (p.includes('/node_modules/lucide-react/')) return 'icons';
    if (p.includes('/node_modules/@fontsource')) return undefined; // CSS + font files: left to Vite
    return 'vendor';
  }
  if (p.includes('/src/ui/') || p.endsWith('/src/lib/queryCache.js')) return 'ui';
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks } } },
  server: { port: 5173, proxy },
  // `npm run preview` serves the production build: same proxy, so it can be tested against a real backend
  preview: { port: 4173, proxy }
});
