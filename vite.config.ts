import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) return 'charts';
              if (id.includes('lucide-react') || id.includes('motion')) return 'ui-vendor';
            }
          },
        },
      },
    },
    server: {
      // Keep HMR optional so local edits remain stable in constrained environments.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
