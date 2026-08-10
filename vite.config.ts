import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Charts are the heaviest dependency and only render on a few screens —
        // keep them out of the entry chunk.
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory|react-is)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router)/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
