/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleInterpret, type InterpretEnv } from './server/interpret.ts';

/** Serves POST /api/interpret in `vite dev` and `vite preview` (so `npm run demo` needs no Vercel). */
function localApi(env: InterpretEnv): Plugin {
  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/api/interpret') return next();
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'POST only' }));
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const { status, body } = await handleInterpret(raw, env);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  return {
    name: 'mine-local-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const env: InterpretEnv = {
    LLM_BASE_URL: process.env.LLM_BASE_URL ?? fileEnv.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL ?? fileEnv.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY ?? fileEnv.LLM_API_KEY,
  };
  return {
    plugins: [react(), tailwindcss(), localApi(env)],
    test: {
      environment: 'node',
      include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    },
  };
});
