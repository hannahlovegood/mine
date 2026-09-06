// Shared request handler for /api/interpret. Used by the Vercel function
// (api/interpret.ts) and by the Vite dev/preview middleware so `npm run demo`
// serves the API from localhost without Vercel.
//
// T01 stub: returns Default preferences with source 'fallback'.
// T06 replaces the body with the model call + fallback (§7).
import { z } from 'zod';
import { DEFAULT_PREFERENCES } from '../src/engine/presets.ts';
import type { InterpretResponse } from '../src/engine/schema.ts';

export interface InterpretEnv {
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  LLM_API_KEY?: string;
}

const RequestSchema = z.object({
  text: z.string().min(1).max(2000),
  lang: z.enum(['en', 'zh']),
});

export interface HandlerResult {
  status: number;
  body: InterpretResponse | { error: string };
}

export async function handleInterpret(rawBody: string, _env: InterpretEnv): Promise<HandlerResult> {
  const started = Date.now();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody || '{}');
  } catch {
    return { status: 400, body: { error: 'Body must be JSON' } };
  }
  const req = RequestSchema.safeParse(parsed);
  if (!req.success) return { status: 400, body: { error: 'Expected { text, lang }' } };

  return {
    status: 200,
    body: {
      preferences: { ...DEFAULT_PREFERENCES },
      reasons: [req.data.lang === 'zh' ? '解释器尚未接入（T06）' : 'Interpreter not wired yet (T06)'],
      source: 'fallback',
      ms: Date.now() - started,
    },
  };
}
