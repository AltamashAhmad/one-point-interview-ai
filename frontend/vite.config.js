import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Existing .env files and Amplify variables use the CRA prefix.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { port: 3000 },
  preview: { port: 3000 },
  build: {
    // Amplify publishes frontend/build (amplify.yml baseDirectory).
    outDir: 'build',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    css: false,
    restoreMocks: true,
    // Fake values so tests never depend on a local .env (absent in CI).
    env: {
      REACT_APP_FIREBASE_API_KEY: 'test-api-key',
      REACT_APP_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      REACT_APP_FIREBASE_PROJECT_ID: 'test-project',
      REACT_APP_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      REACT_APP_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
    },
  },
});
