import { describe, expect, it } from 'vitest';
import { CORS_HEADERS, cors, type CorsResponse } from '../server/cors.ts';
import {
  MAX_TOKENS_CAP,
  SYSTEM_PROMPT,
  digitRuns,
  handlePlain,
  maxTokensFor,
  parsePlainReply,
  rewriteBlocks,
  sameDigits,
  urlsIn,
  validateRewrite,
  type PlainBlock,
  type Rewrite,
} from '../server/plain.ts';

const ENV = {
  LLM_BASE_URL: 'https://api.deepseek.com',
  LLM_MODEL: 'deepseek-chat',
  LLM_API_KEY: 'test-key',
};

const B1: PlainBlock = {
  id: 'b-1',
  kind: 'text',
  text: 'Applications must be lodged no later than 30 days after the notice is issued; late lodgements attract a surcharge of 2,500.',
};
const B2: PlainBlock = {
  id: 'b-2',
  kind: 'deadline',
  text: 'The portal closes at 11:59 pm on 23 October 2026. Submissions received after that time will not be considered.',
};
const B3: PlainBlock = {
  id: 'b-3',
  kind: 'legal',
  text: 'By submitting this form you consent to the processing of your personal data pursuant to the Data Protection Act 2018 for the purpose of assessing your application.',
};
const BLOCKS = [B1, B2, B3];

const GOOD_REWRITES: Rewrite[] = [
  {
    id: 'b-1',
    plainText:
      'You must send in your application within 30 days of the notice. If you send it late, you pay an extra 2,500.',
    terms: [
      { term: 'lodged', plain: 'Sent in and officially received.' },
      { term: 'surcharge', plain: 'An extra amount you have to pay.' },
    ],
  },
  {
    id: 'b-2',
    plainText: 'Deadline: 11:59 pm on 23 October 2026. Anything sent after that is not looked at.',
    terms: [],
  },
  {
    id: 'b-3',
    plainText:
      'If you send this form, you agree that your personal data is used to assess your application, under the Data Protection Act 2018.',
    terms: [
      { term: 'personal data', plain: 'Information about you, such as your name and address.' },
    ],
  },
];
const GOOD = JSON.stringify({ rewrites: GOOD_REWRITES });

/** The good reply with one rewrite altered. */
const withRewrite = (patch: Partial<Rewrite> & { id: string }): string =>
  JSON.stringify({
    rewrites: GOOD_REWRITES.map((r) => (r.id === patch.id ? { ...r, ...patch } : r)),
  });

const ids = (r: { rewrites: Rewrite[] }): string[] => r.rewrites.map((x) => x.id);

describe('validation helpers', () => {
  it('compares digit multisets, not positions', () => {
    expect(digitRuns('HSG-7 at 11:59')).toEqual(['11', '59', '7']);
    expect(sameDigits('30 days, 2,500', '2,500 within 30 days')).toBe(true);
    expect(sameDigits('30 days', '30 days and 30 nights')).toBe(false);
    expect(sameDigits('by 2026', 'by 2062')).toBe(false);
    expect(sameDigits('no digits', 'still none')).toBe(true);
  });
  it('finds URLs without trailing punctuation, case-insensitively', () => {
    expect(urlsIn('See https://gov.example/apply. Or www.Example.org/x, today')).toEqual([
      'https://gov.example/apply',
      'www.example.org/x',
    ]);
    expect(urlsIn('no links here')).toEqual([]);
  });
  it('budgets ~200 tokens per block, capped', () => {
    expect(maxTokensFor(1)).toBe(200);
    expect(maxTokensFor(12)).toBe(MAX_TOKENS_CAP);
    expect(maxTokensFor(13)).toBe(MAX_TOKENS_CAP);
  });
  it('parses the reply shape only, strictly', () => {
    expect(parsePlainReply('```json\n' + GOOD + '\n```').ok).toBe(true);
    expect(parsePlainReply('Sure! ' + GOOD).ok).toBe(true);
    expect(parsePlainReply('not json').ok).toBe(false);
    expect(parsePlainReply('{"rewrites":"x"}').ok).toBe(false);
    expect(parsePlainReply('{"rewrites":[{"id":"b-1","plainText":7}]}').ok).toBe(false);
    expect(parsePlainReply('{"rewrites":[{"id":"b-1","plainText":"ok"}]}').ok).toBe(true);
  });
});

describe('validateRewrite', () => {
  const good = GOOD_REWRITES[0]!;
  it('accepts a faithful rewrite and keeps its terms', () => {
    expect(validateRewrite(B1, good)).toEqual(good);
    expect(
      validateRewrite(B1, { ...good, plainText: `  ${good.plainText}  `, terms: undefined }),
    ).toEqual({
      ...good,
      terms: [],
    });
  });
  it('drops a changed, added or missing digit', () => {
    expect(
      validateRewrite(B1, { ...good, plainText: good.plainText.replace('30 days', '31 days') }),
    ).toBeNull();
    expect(
      validateRewrite(B1, {
        ...good,
        plainText: good.plainText.replace('30 days', '30 days (1 month)'),
      }),
    ).toBeNull();
    expect(
      validateRewrite(B1, { ...good, plainText: good.plainText.replace('30 days', 'thirty days') }),
    ).toBeNull();
    expect(validateRewrite(B1, { ...good, plainText: '' })).toBeNull();
  });
  it('drops length inflation and collapse', () => {
    const inflated = `${good.plainText} ${'Read this carefully. '.repeat(8)}`;
    expect(inflated.length).toBeGreaterThan(B1.text.length * 1.3);
    expect(validateRewrite(B1, { ...good, plainText: inflated })).toBeNull();
    const collapsed = '30 days, 2,500.';
    expect(collapsed.length).toBeLessThan(B1.text.length * 0.2);
    expect(validateRewrite(B1, { ...good, plainText: collapsed })).toBeNull();
    const atCeiling = good.plainText + ' '.repeat(0); // unchanged length, inside the window
    expect(validateRewrite(B1, { ...good, plainText: atCeiling })).not.toBeNull();
  });
  it('drops an introduced URL but allows one the original already has', () => {
    expect(
      validateRewrite(B1, {
        ...good,
        plainText: good.plainText.replace(
          'of the notice.',
          'of the notice. See https://example.com/apply.',
        ),
      }),
    ).toBeNull();
    const linked: PlainBlock = {
      id: 'u',
      kind: 'notice',
      text: 'Apply at https://portal.example.gov/apply before the office closes.',
    };
    const r = validateRewrite(linked, {
      id: 'u',
      plainText: 'Go to https://portal.example.gov/apply to apply before the office closes.',
    });
    expect(r?.plainText).toContain('https://portal.example.gov/apply');
  });
  it('filters terms: verbatim in the original, with a definition, no new digits or URLs, at most four', () => {
    const r = validateRewrite(B1, {
      ...good,
      terms: [
        { term: 'penalty', plain: 'A fine.' }, // not in the original
        { term: 'lodged', plain: '' }, // no definition
        { term: 'notice', plain: 'A letter you get within 14 days.' }, // digit the original lacks
        { term: 'issued', plain: 'See https://example.com for details.' }, // new URL
        { term: 'lodged', plain: 'Sent in and officially received.' },
        { term: 'surcharge', plain: 'An extra amount you have to pay, here 2,500.' }, // digits from the original are fine
        { term: 'Applications', plain: 'The forms you send in.' },
        { term: 'notice', plain: 'The letter that tells you about the decision.' },
        { term: 'issued', plain: 'Sent out.' }, // fifth valid term, over the cap
      ],
    });
    expect(r?.terms.map((t) => t.term)).toEqual(['lodged', 'surcharge', 'Applications', 'notice']);
  });
});

describe('rewriteBlocks', () => {
  it('passes a good batch through, in request order, with timing', async () => {
    let seen: { role: string; content: string }[] = [];
    const reordered = JSON.stringify({ rewrites: [...GOOD_REWRITES].reverse() });
    const r = await rewriteBlocks(BLOCKS, 'en', async (messages) => {
      seen = messages;
      return reordered;
    });
    expect(r.rewrites).toEqual(GOOD_REWRITES);
    expect(typeof r.ms).toBe('number');
    expect(seen[0]?.role).toBe('system');
    expect(seen[0]?.content).toContain('JSON');
    expect(seen[1]?.content).toContain(B2.text);
    expect(seen[1]?.content).toContain('"lang":"en"');
  });
  it('drops the rewrite that changes a digit while the others survive', async () => {
    const r = await rewriteBlocks(BLOCKS, 'en', async () =>
      withRewrite({
        id: 'b-2',
        plainText:
          'Deadline: 11:59 pm on 24 October 2026. Anything sent after that is not looked at.',
      }),
    );
    expect(ids(r)).toEqual(['b-1', 'b-3']);
  });
  it('drops a term that is not in the original; the block survives without it', async () => {
    const r = await rewriteBlocks(BLOCKS, 'en', async () =>
      withRewrite({
        id: 'b-1',
        terms: [
          { term: 'lodged', plain: 'Sent in and officially received.' },
          { term: 'penalty', plain: 'A fine.' },
        ],
      }),
    );
    expect(ids(r)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(r.rewrites[0]?.terms).toEqual([
      { term: 'lodged', plain: 'Sent in and officially received.' },
    ]);
  });
  it('drops length inflation', async () => {
    const r = await rewriteBlocks(BLOCKS, 'en', async () =>
      withRewrite({
        id: 'b-2',
        plainText: `Deadline: 11:59 pm on 23 October 2026. ${'Read this carefully. '.repeat(8)}`,
      }),
    );
    expect(ids(r)).toEqual(['b-1', 'b-3']);
  });
  it('ignores unknown ids and keeps the first of duplicate ids', async () => {
    const r = await rewriteBlocks([B1, B2], 'en', async () =>
      JSON.stringify({
        rewrites: [
          { id: 'b-9', plainText: 'nothing to do with the request', terms: [] },
          GOOD_REWRITES[1],
          {
            id: 'b-2',
            plainText: 'Deadline: 11:59 pm on 23 October 2026. A second try.',
            terms: [],
          },
          GOOD_REWRITES[0],
        ],
      }),
    );
    expect(r.rewrites).toEqual([GOOD_REWRITES[0], GOOD_REWRITES[1]]);
  });
  it('retries once with the parser error, then succeeds', async () => {
    let calls = 0;
    const r = await rewriteBlocks(BLOCKS, 'zh', async (messages) => {
      calls++;
      if (calls === 1) return 'garbage';
      expect(messages[1]?.content).toContain('rejected');
      expect(messages[1]?.content).toContain(B1.text);
      return GOOD;
    });
    expect(calls).toBe(2);
    expect(ids(r)).toEqual(['b-1', 'b-2', 'b-3']);
  });
  it('returns empty rewrites, not an error, after two bad replies, a thrown call, and a timeout', async () => {
    let calls = 0;
    const bad = await rewriteBlocks(BLOCKS, 'en', async () => {
      calls++;
      return 'nope';
    });
    expect(calls).toBe(2);
    expect(bad).toEqual({ rewrites: [], ms: expect.any(Number) });
    const thrown = await rewriteBlocks(BLOCKS, 'en', async () => {
      throw new Error('boom');
    });
    expect(thrown.rewrites).toEqual([]);
    const slow = await rewriteBlocks(
      BLOCKS,
      'en',
      (_m, signal) =>
        new Promise((_res, rej) => {
          signal.addEventListener('abort', () => rej(new Error('aborted')));
        }),
      60,
    );
    expect(slow.rewrites).toEqual([]);
    expect(slow.ms).toBeGreaterThanOrEqual(40);
  });
});

describe('handlePlain', () => {
  const body = (blocks: unknown, lang: unknown = 'en') => JSON.stringify({ lang, blocks });

  it('answers 503 no-model when no key is configured', async () => {
    const r = await handlePlain(body(BLOCKS), {});
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: 'no-model' });
    expect(
      (await handlePlain(body(BLOCKS), { LLM_BASE_URL: 'https://x', LLM_MODEL: 'm' })).status,
    ).toBe(503);
  });
  it('rejects bad bodies with 400', async () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => ({
      id: `b-${i}`,
      kind: 'text',
      text: 'hello world',
    }));
    const cases = [
      'nope',
      '',
      '{}',
      body(BLOCKS, 'fr'),
      body([]),
      body(thirteen),
      body([{ ...B1, text: 'x'.repeat(1501) }]),
      body([{ ...B1, text: '   ' }]),
      body([{ ...B1, kind: 'heading' }]),
      body([{ kind: 'text', text: 'no id' }]),
      body([B1, { ...B2, id: 'b-1' }]),
    ];
    for (const c of cases) expect((await handlePlain(c, ENV)).status, c.slice(0, 60)).toBe(400);
    const twelve = thirteen.slice(0, 12);
    expect((await handlePlain(body(twelve), {})).status).toBe(503);
  });
  it('makes one provider call for the whole batch: JSON mode, temperature 0, token budget per block', async () => {
    const sent: Record<string, unknown>[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ choices: [{ message: { content: GOOD } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const r = await handlePlain(body(BLOCKS), ENV, fetchImpl);
    expect(r.status).toBe(200);
    if ('error' in r.body) throw new Error(r.body.error);
    expect(r.body.rewrites).toEqual(GOOD_REWRITES);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      model: 'deepseek-chat',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });
    const messages = sent[0]?.messages as { role: string; content: string }[];
    expect(messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(messages[1]?.content).toContain(B3.text);
  });
  it('turns a provider error into 200 with empty rewrites', async () => {
    const fetchImpl: typeof fetch = async () => new Response('upstream down', { status: 502 });
    const r = await handlePlain(body(BLOCKS), ENV, fetchImpl);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ rewrites: [], ms: expect.any(Number) });
  });
});

describe('cors', () => {
  class FakeRes implements CorsResponse {
    statusCode = 200;
    ended = 0;
    headers: Record<string, string> = {};
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    end() {
      this.ended++;
    }
  }
  it('answers an OPTIONS preflight with 204 and the three headers', () => {
    const res = new FakeRes();
    expect(cors('OPTIONS', res)).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(1);
    expect(res.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    });
    expect(res.headers).toEqual(CORS_HEADERS);
    expect(cors('options', new FakeRes())).toBe(true);
  });
  it('adds the headers to other requests and leaves them to the route', () => {
    const res = new FakeRes();
    expect(cors('POST', res)).toBe(false);
    expect(cors(undefined, res)).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(0);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
