import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8080,
    allowedHosts: ['unbatterable-anahi-unetymologically.ngrok-free.dev'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
        },
      },
    },
  },
});
