import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend this dev server forwards to. Override to test against another backend, e.g.
//   VITE_PROXY_TARGET=http://localhost:3999 npx vite --port 5199
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
      '/output': { target, changeOrigin: true }
    }
  }
});
