import { describe, expect, it } from 'vitest';
import { extractJson, handleInterpret, interpret, parseReply } from '../server/interpret.ts';

const GOOD = JSON.stringify({
  preferences: {
    readingLevel: 'plain',
    density: 'minimal',
    navigation: 'reduced',
    fontScale: 1,
    contrast: 'default',
    showDecorativeMedia: false,
    taskMode: 'one-at-a-time',
    explainTerms: true,
    surfaceDecisions: true,
  },
  reasons: ['"plain words" → passages shown in plain language'],
});

describe('parseReply', () => {
  it('strips fences and validates', () => {
    expect(extractJson('```json\n' + GOOD + '\n```')).toBe(GOOD);
    expect(parseReply('Sure! ' + GOOD + ' Hope this helps').ok).toBe(true);
  });
  it('rejects extra keys, bad enums and empty reasons', () => {
    const bad = JSON.parse(GOOD) as { preferences: Record<string, unknown>; reasons: string[] };
    expect(parseReply(JSON.stringify({ ...bad, preferences: { ...bad.preferences, fontScale: 2 } })).ok).toBe(false);
    expect(parseReply(JSON.stringify({ ...bad, reasons: [] })).ok).toBe(false);
    expect(parseReply('not json').ok).toBe(false);
  });
});

describe('interpret', () => {
  it('uses the model when it answers well', async () => {
    const r = await interpret('plain words please', 'en', async () => GOOD);
    expect(r.source).toBe('model');
    expect(r.preferences.readingLevel).toBe('plain');
  });
  it('retries once with the parser error, then succeeds', async () => {
    let calls = 0;
    const r = await interpret('x', 'en', async (messages) => {
      calls++;
      if (calls === 1) return 'garbage';
      expect(messages[1]?.content).toContain('rejected');
      return GOOD;
    });
    expect(calls).toBe(2);
    expect(r.source).toBe('model');
  });
  it('falls back after two bad replies, and on a thrown call, and on timeout', async () => {
    const bad = await interpret('use plain words', 'en', async () => 'nope');
    expect(bad.source).toBe('fallback');
    expect(bad.preferences.readingLevel).toBe('plain');
    expect(bad.reasons.length).toBeGreaterThan(0);
    const thrown = await interpret('use plain words', 'en', async () => {
      throw new Error('boom');
    });
    expect(thrown.source).toBe('fallback');
    const slow = await interpret(
      'bigger text',
      'en',
      (_m, signal) =>
        new Promise((_res, rej) => {
          signal.addEventListener('abort', () => rej(new Error('aborted')));
        }),
      60,
    );
    expect(slow.source).toBe('fallback');
    expect(slow.preferences.fontScale).toBe(1.35);
  });
  it('works with no key at all', async () => {
    const r = await handleInterpret(JSON.stringify({ text: '安静一点，解释术语', lang: 'zh' }), {});
    expect(r.status).toBe(200);
    if ('error' in r.body) throw new Error(r.body.error);
    expect(r.body.source).toBe('fallback');
    expect(r.body.preferences.density).toBe('minimal');
    expect(r.body.preferences.explainTerms).toBe(true);
  });
  it('rejects bad bodies', async () => {
    expect((await handleInterpret('{}', {})).status).toBe(400);
    expect((await handleInterpret('nope', {})).status).toBe(400);
  });
});
