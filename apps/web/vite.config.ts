import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Vite env vars are injected at build time.
  // - GitHub Pages: VITE_PUBLIC_BASE_PATH=/AIRIA-BEYOND/
  // - Custom domain / Netlify root: VITE_PUBLIC_BASE_PATH=/
  const env = loadEnv(mode, process.cwd(), '');
  // Netlify builds serve from domain root by default. If base is left unset,
  // defaulting to GitHub Pages path will break asset URLs and result in a blank screen.
  const base = String(
    env.VITE_PUBLIC_BASE_PATH || (process.env.NETLIFY ? '/' : '/AIRIA-BEYOND/')
  );

  return {
    plugins: [react()],
    base,
    build: {
      target: 'es2020',
      minify: 'esbuild', // Use esbuild instead of terser (no additional dependency needed)
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  };
});