import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeBase = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return '/';
  const stripped = trimmed.replace(/^\/+|\/+$/g, '');
  return stripped ? `/${stripped}/` : '/';
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const explicitBase = env.VITE_BASE_PATH || env.BASE_PATH;
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
  const resolvedBase =
    mode === 'production'
      ? (explicitBase
          ? normalizeBase(explicitBase)
          : repoName
            ? normalizeBase(repoName)
            : '/')
      : '/';

  return {
    plugins: [react()],
    base: resolvedBase,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
  };
});
