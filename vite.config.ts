/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cors } from './server/cors.ts';
import { handleInterpret, type InterpretEnv } from './server/interpret.ts';
import { handlePlain } from './server/plain.ts';

/** A shared route handler (server/*.ts): raw JSON body + env → status + JSON body. */
type ApiHandler = (
  rawBody: string,
  env: InterpretEnv,
) => Promise<{ status: number; body: unknown }>;

const ROUTES: Record<string, ApiHandler> = {
  '/api/interpret': handleInterpret,
  '/api/plain': handlePlain,
};

/**
 * Serves POST /api/interpret and POST /api/plain (with CORS and OPTIONS preflight) in `vite dev`
 * and `vite preview`, so `npm run demo` and the extension need no Vercel.
 */
function localApi(env: InterpretEnv): Plugin {
  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    const handle = ROUTES[path];
    if (!handle) return next();
    if (cors(req.method, res)) return;
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'POST only' }));
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const { status, body } = await handle(raw, env);
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
    // Vite's own CORS middleware runs before plugin middleware and answers every OPTIONS itself,
    // by default only for localhost origins — so a page on another site would fail the preflight
    // for /api/plain. The router above sets CORS for the two API routes; everything else stays
    // same-origin (no other origin can read dev-server source files).
    server: { cors: false },
    preview: { cors: false },
    test: {
      environment: 'node',
      include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    },
  };
});
