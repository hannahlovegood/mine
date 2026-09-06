import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleInterpret } from '../server/interpret.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const { status, body } = await handleInterpret(raw, {
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
  });
  res.status(status).json(body);
}
