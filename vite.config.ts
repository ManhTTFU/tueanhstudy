import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { devApiPlugin } from './dev/apiPlugin';

export default defineConfig(({ mode }) => {
  // Nạp biến môi trường server (DATABASE_URL...) cho dev API. Chỉ biến VITE_* mới vào bundle frontend.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['DATABASE_URL', 'PARENT_SESSION_SECRET']) {
    if (env[key] && process.env[key] === undefined) process.env[key] = env[key]; // `DATABASE_URL= npm run dev` => ép dùng PGlite
  }
  return {
    plugins: [react(), devApiPlugin()],
    build: {
      // Tách file build (có hash) khỏi public/assets (hình, âm thanh).
      assetsDir: 'static',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'motion';
            return undefined;
          },
        },
      },
    },
    server: { port: 5173 },
  };
});
