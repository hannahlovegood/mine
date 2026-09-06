// Shared request handler for POST /api/interpret (§7). Used by the Vercel function
// (api/interpret.ts) and by the Vite dev/preview middleware, so `npm run demo`
// serves the API from localhost without Vercel.
//
// One chat completion, temperature 0, max_tokens 400, 8 s deadline, JSON mode where
// the provider supports it, strip fences → JSON.parse → Zod; on failure retry once with
// the parser error appended; then fall back to the offline interpreter. Logs timing only.
import { z } from 'zod';
import { fallback } from '../src/engine/fallback.ts';
import {
  ModelReplySchema,
  type InterpretResponse,
  type Lang,
  type ModelReply,
} from '../src/engine/schema.ts';

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

export const DEADLINE_MS = 8000;

export const SYSTEM_PROMPT = `You convert a person's description of how they want a web page to feel into an interface configuration.
Return ONLY a JSON object with exactly two keys:
"preferences": an object matching this schema exactly — { "readingLevel": "original"|"plain", "density": "full"|"comfortable"|"minimal", "navigation": "full"|"reduced"|"hidden", "fontScale": 1|1.15|1.35|1.6, "contrast": "default"|"high", "showDecorativeMedia": boolean, "taskMode": "all"|"one-at-a-time", "explainTerms": boolean, "surfaceDecisions": boolean }
"reasons": an array of 1–5 short strings. Each quotes a phrase from the person's text and names the setting it changed, written in the person's language, e.g. "\\"one decision at a time\\" → one task per step".
Rules:
- Start from DEFAULT and change only what the person's words justify. Unmentioned settings stay at DEFAULT.
- Work only from stated preferences. Never infer, mention, or imply a diagnosis, disability, or condition, even if the person names one; respond to the preference, not the label.
- If the person asks for a translation, add one more key "translateTo" with the language code they name ("zh", "en", "ja", "ko", "es", "fr", "de"), or the code of the language they wrote in when they name none. Otherwise omit it.
- If the person asks for something else the schema cannot express, ignore it silently. Do not add other keys.
- Output raw JSON. No prose, no markdown, no code fences.
DEFAULT: {"readingLevel":"original","density":"full","navigation":"full","fontScale":1,"contrast":"default","showDecorativeMedia":true,"taskMode":"all","explainTerms":false,"surfaceDecisions":false}
Example input: "I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time."
Example output: {"preferences":{"readingLevel":"plain","density":"minimal","navigation":"reduced","fontScale":1,"contrast":"default","showDecorativeMedia":false,"taskMode":"one-at-a-time","explainTerms":true,"surfaceDecisions":true},"reasons":["\\"overwhelmed by long forms\\" → fewer items on screen, one task per step","\\"plain words\\" → passages shown in plain language","\\"explain anything I might not know\\" → terms explained inline","\\"one decision at a time\\" → each choice gets its own step"]}`;

/** Strips ```json fences and finds the outermost object. */
export function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s;
}

export function parseReply(
  raw: string,
): { ok: true; reply: ModelReply } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(extractJson(raw));
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  const r = ModelReplySchema.safeParse(data);
  if (!r.success)
    return {
      ok: false,
      error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  return { ok: true, reply: r.data };
}

function endpoint(base: string): string {
  const b = base.replace(/\/+$/, '');
  if (/\/v\d+$/.test(b)) return `${b}/chat/completions`;
  if (/openai\.com$/.test(b)) return `${b}/v1/chat/completions`;
  return `${b}/chat/completions`;
}

function supportsJsonMode(base: string): boolean {
  return /deepseek|openai|moonshot|dashscope|bigmodel|siliconflow|groq/.test(base);
}

export interface ChatCall {
  (messages: { role: 'system' | 'user'; content: string }[], signal: AbortSignal): Promise<string>;
}

/** §7's ceiling for one interpretation; /api/plain passes its own per-batch budget. */
export const MAX_TOKENS = 400;

/** Real provider call; `fetchImpl` is injectable for tests. */
export function makeChatCall(
  env: Required<InterpretEnv>,
  fetchImpl: typeof fetch = fetch,
  opts: { maxTokens?: number } = {},
): ChatCall {
  return async (messages, signal) => {
    const body: Record<string, unknown> = {
      model: env.LLM_MODEL,
      temperature: 0,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      messages,
    };
    if (supportsJsonMode(env.LLM_BASE_URL)) body.response_format = { type: 'json_object' };
    const r = await fetchImpl(endpoint(env.LLM_BASE_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.LLM_API_KEY}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok) throw new Error(`Provider HTTP ${r.status}`);
    const json = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Provider returned no content');
    return content;
  };
}

/** Model → retry once with the parser error → fallback. Never throws. */
export async function interpret(
  text: string,
  lang: Lang,
  chat: ChatCall | null,
  deadlineMs = DEADLINE_MS,
): Promise<InterpretResponse> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  if (chat) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      // The reasons must be readable in the panel's language; a model does not always infer it from the text.
      const langNote = lang === 'zh' ? '（请用中文写 reasons。）' : '(Write the reasons in English.)';
      let userTurn = `${text}\n\n${langNote}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1 && deadlineMs - elapsed() < 1500) break;
        let raw: string;
        try {
          raw = await chat(
            [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userTurn },
            ],
            controller.signal,
          );
        } catch {
          break; // network/timeout: no point retrying inside the same deadline
        }
        const parsed = parseReply(raw);
        if (parsed.ok) {
          console.log(`[interpret] model ${elapsed()} ms (attempt ${attempt + 1})`);
          return { ...parsed.reply, source: 'model', ms: elapsed() };
        }
        userTurn = `${text}\n\n${langNote}\n\nYour previous reply was rejected: ${parsed.error}. Return only the JSON object.`;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const fb = fallback(text, lang);
  console.log(`[interpret] fallback ${elapsed()} ms`);
  return { preferences: fb.preferences, reasons: fb.reasons, source: 'fallback', ms: elapsed() };
}

export async function handleInterpret(rawBody: string, env: InterpretEnv): Promise<HandlerResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody || '{}');
  } catch {
    return { status: 400, body: { error: 'Body must be JSON' } };
  }
  const req = RequestSchema.safeParse(parsed);
  if (!req.success) return { status: 400, body: { error: 'Expected { text, lang }' } };
  const configured = !!(env.LLM_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL);
  const chat = configured
    ? makeChatCall({
        LLM_BASE_URL: env.LLM_BASE_URL!,
        LLM_MODEL: env.LLM_MODEL!,
        LLM_API_KEY: env.LLM_API_KEY!,
      })
    : null;
  const body = await interpret(req.data.text, req.data.lang, chat);
  return { status: 200, body };
}
