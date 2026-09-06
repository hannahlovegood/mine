// One-off drafting tool for T03. Not part of the app; never runs at build or demo time.
//
//   npx tsx scripts/plain.ts en      (or: zh)
//
// For every block that should carry a plain version but does not yet — text-kind blocks of
// medium or complex complexity without `plainText`, deadline blocks without `plainText`, fields
// with `help` but no `plainHelp`, decisions without `plainLabel`, plus glossary suggestions for
// complex text blocks without `terms` — it asks an OpenAI-compatible chat endpoint for a draft,
// checks that every digit sequence survived, and writes everything to
// docs/plain-drafts.<lang>.json. A human reads the drafts, edits them and pastes them into
// src/content/demo-content.<lang>.ts; test/content.test.ts checks the digits again there.
// Nothing here writes to the content files (§2: plain text ships as reviewed content).
//
// Configuration: LLM_BASE_URL, LLM_MODEL, LLM_API_KEY from `.env` (parsed here with a tiny
// reader, no dotenv) or from the environment, which wins. Without a key the tool prints what it
// would do and exits 0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getContent } from '../src/content/content.meta.ts';
import {
  TEXT_KINDS,
  TermSchema,
  type ContentBlock,
  type Lang,
  type PageContent,
  type Term,
  type TextBlock,
} from '../src/engine/schema.ts';

type Target = 'plainText' | 'plainHelp' | 'plainLabel' | 'terms';

interface Job {
  id: string;
  kind: ContentBlock['kind'];
  target: Target;
  /** The original the draft must stay faithful to. */
  source: string;
  /** Extra instruction for this job. */
  note: string;
}

interface Draft extends Job {
  draft: string | Term[] | null;
  digitsOk: boolean;
  attempts: number;
  error?: string;
}

interface LlmEnv {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// --------------------------------------------------------------------------- env

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function loadEnv(): LlmEnv {
  const file = readEnvFile(resolve(ROOT, '.env'));
  const pick = (k: string): string => process.env[k] ?? file[k] ?? '';
  return {
    baseUrl: pick('LLM_BASE_URL') || 'https://api.deepseek.com',
    model: pick('LLM_MODEL') || 'deepseek-chat',
    apiKey: pick('LLM_API_KEY'),
  };
}

// ------------------------------------------------------------------------- jobs

const isTextKind = (b: ContentBlock): b is TextBlock => (TEXT_KINDS as readonly string[]).includes(b.kind);

const digitRuns = (s: string): string[] => (s.match(/\d+/g) ?? []).sort();

function sameDigits(a: string, b: string): boolean {
  const x = digitRuns(a);
  const y = digitRuns(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** CLAUDE.md §4: 8–12 terms across the page. Above the ceiling, no glossary drafts are suggested. */
const TERM_CEILING = 12;

const countTerms = (content: PageContent): number =>
  content.blocks.reduce((n, b) => n + (isTextKind(b) ? (b.terms?.length ?? 0) : 0), 0);

function jobsFor(content: PageContent): Job[] {
  const jobs: Job[] = [];
  const wantTerms = countTerms(content) < TERM_CEILING;
  for (const b of content.blocks) {
    if (isTextKind(b)) {
      if (b.complexity !== 'simple' && !b.plainText) {
        let note = '';
        if (b.kind === 'legal') {
          note = 'This is legal text. Write a plain summary that will be shown BESIDE the original, never instead of it.';
        } else if (b.kind === 'faq') {
          note = 'Keep the question-and-answer shape of the source.';
        }
        jobs.push({ id: b.id, kind: b.kind, target: 'plainText', source: b.text, note });
      }
      if (wantTerms && b.complexity === 'complex' && (b.terms?.length ?? 0) === 0) {
        jobs.push({ id: b.id, kind: b.kind, target: 'terms', source: b.text, note: '' });
      }
    } else if (b.kind === 'deadline' && !b.plainText) {
      jobs.push({
        id: b.id,
        kind: b.kind,
        target: 'plainText',
        source: b.text,
        note: 'This paragraph contains a deadline. Put the deadline in the first sentence and keep the date and time exactly as written.',
      });
    } else if (b.kind === 'field' && b.help && !b.plainHelp) {
      jobs.push({
        id: b.id,
        kind: b.kind,
        target: 'plainHelp',
        source: b.help,
        note: `Help text under the form field "${b.label}".`,
      });
    } else if (b.kind === 'decision' && !b.plainLabel) {
      jobs.push({
        id: b.id,
        kind: b.kind,
        target: 'plainLabel',
        source: b.label,
        note: 'This is a checkbox the person is asked to tick. Say in the second person what ticking it means. Do not say whether they should.',
      });
    }
  }
  return jobs;
}

// ---------------------------------------------------------------------- prompts

function systemPrompt(lang: Lang, target: Target): string {
  const language = lang === 'zh' ? 'Simplified Chinese (干净的书面中文，用短句和常用词)' : 'English';
  if (target === 'terms') {
    return [
      `You pick the jargon in a passage from a public-services web page and define each term for a general reader, in ${language}.`,
      'Return ONLY a JSON object of the form {"terms":[{"term":"…","plain":"…"}]} with 1 to 4 entries.',
      'Rules: "term" must appear verbatim in the passage. "plain" is one sentence in common words. No legal advice. No claims about this programme that the passage does not make.',
    ].join('\n');
  }
  return [
    `You rewrite text from a public-services web page into plain language, in ${language}.`,
    'Rules:',
    '- Same facts, nothing added, nothing dropped. Never introduce a claim, condition, example, number or date that is not in the source.',
    '- Every digit sequence in the source (for example 30, 2,500, 11:59, 2026, HSG-7) must appear in your text exactly as written, the same number of times. Never spell numbers out and never add new ones.',
    '- Short sentences. Common words. Address the reader as "you". Keep the order of ideas where you can.',
    '- If the source uses a jargon term that a reader may need explained, you may keep the term once so it can be explained separately.',
    '- No legal advice, no reassurance, no opinions.',
    '- Return only the rewritten text. No preamble, no quotes, no markdown.',
  ].join('\n');
}

// ------------------------------------------------------------------------- model

function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (typeof first !== 'object' || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

const stripFences = (s: string): string =>
  s
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

async function chat(env: LlmEnv, system: string, user: string, json: boolean): Promise<string> {
  const base = env.baseUrl.endsWith('/') ? env.baseUrl : `${env.baseUrl}/`;
  const url = new URL('chat/completions', base).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.apiKey}` },
      body: JSON.stringify({
        model: env.model,
        temperature: 0,
        max_tokens: 800,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const content = extractContent(await res.json());
    if (content === null) throw new Error('no choices[0].message.content in the reply');
    return stripFences(content);
  } finally {
    clearTimeout(timer);
  }
}

const TermsReplySchema = z.object({ terms: z.array(TermSchema).min(1).max(4) });

async function runJob(env: LlmEnv, lang: Lang, job: Job): Promise<Draft> {
  const system = systemPrompt(lang, job.target);
  const user = [job.note, `Source (${job.kind}, ${job.target}):`, job.source].filter(Boolean).join('\n\n');
  let attempts = 0;
  let feedback = '';
  let lastError = '';
  let lastDraft: string | null = null;
  while (attempts < 2) {
    attempts += 1;
    try {
      const prompt = feedback ? `${user}\n\nYour previous draft was rejected: ${feedback}` : user;
      const reply = await chat(env, system, prompt, job.target === 'terms');
      lastDraft = reply;
      if (job.target === 'terms') {
        const parsed = TermsReplySchema.safeParse(JSON.parse(reply));
        if (!parsed.success) {
          feedback = 'the reply was not a JSON object of the form {"terms":[{"term":"…","plain":"…"}]}';
          lastError = feedback;
          continue;
        }
        const missing = parsed.data.terms.filter((t) => !job.source.includes(t.term));
        if (missing.length > 0) {
          feedback = `these terms do not appear verbatim in the passage: ${missing.map((t) => t.term).join(', ')}`;
          lastError = feedback;
          continue;
        }
        return { ...job, draft: parsed.data.terms, digitsOk: true, attempts };
      }
      if (!sameDigits(job.source, reply)) {
        feedback = `the digit sequences differ. Source has [${digitRuns(job.source).join(', ')}], draft has [${digitRuns(reply).join(', ')}]. Every digit sequence must appear exactly as in the source, the same number of times.`;
        lastError = feedback;
        continue;
      }
      return { ...job, draft: reply, digitsOk: true, attempts };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      feedback = '';
    }
  }
  return { ...job, draft: lastDraft, digitsOk: false, attempts, error: lastError };
}

// -------------------------------------------------------------------------- main

async function main(): Promise<number> {
  const arg = process.argv[2] ?? 'en';
  if (arg !== 'en' && arg !== 'zh') {
    console.error(`Usage: npx tsx scripts/plain.ts <en|zh>   (got "${arg}")`);
    return 2;
  }
  const lang: Lang = arg;
  const content = getContent(lang);
  const jobs = jobsFor(content);
  const env = loadEnv();
  const outPath = resolve(ROOT, 'docs', `plain-drafts.${lang}.json`);

  const termCount = countTerms(content);
  console.log(`Content "${content.meta.title}" (${lang}): ${content.blocks.length} blocks.`);
  console.log(
    `Glossary: ${termCount} terms on the page (§4 asks for 8–${TERM_CEILING})${
      termCount >= TERM_CEILING ? '; no term drafts suggested' : ''
    }.`,
  );
  if (jobs.length === 0) {
    console.log('Every block that should carry a plain version already has one. Nothing to draft.');
    return 0;
  }
  console.log(`${jobs.length} draft(s) needed:`);
  for (const j of jobs) console.log(`  ${j.id.padEnd(26)} ${j.kind.padEnd(11)} → ${j.target}`);

  if (!env.apiKey) {
    console.log('\nNo LLM_API_KEY in .env or the environment, so nothing was called.');
    console.log(
      `With a key this would ask ${env.model} at ${env.baseUrl} for each draft, check that every digit sequence`,
    );
    console.log(`survived, and write the drafts to ${relative(ROOT, outPath)} for a human to edit and paste in.`);
    return 0;
  }

  console.log(`\nAsking ${env.model} at ${env.baseUrl} …`);
  const drafts: Draft[] = [];
  for (const job of jobs) {
    const d = await runJob(env, lang, job);
    drafts.push(d);
    const mark = d.draft === null ? 'failed' : d.digitsOk ? 'ok' : 'needs attention';
    console.log(`  ${d.id.padEnd(26)} ${d.target.padEnd(10)} ${mark}${d.error ? ` — ${d.error}` : ''}`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const file = {
    lang,
    generatedAt: new Date().toISOString(),
    model: env.model,
    note: 'Drafts only. A human edits these and pastes them into src/content/demo-content.<lang>.ts; test/content.test.ts checks the digits again.',
    drafts,
  };
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`);
  const bad = drafts.filter((d) => !d.digitsOk).length;
  console.log(`\nWrote ${drafts.length} draft(s) to ${relative(ROOT, outPath)}${bad ? ` — ${bad} need attention` : ''}.`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  },
);
