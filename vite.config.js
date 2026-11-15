import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  base: process.env.GITHUB_ACTIONS ? '/Hamam-b-ce-i-surfers/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
