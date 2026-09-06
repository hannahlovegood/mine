// The offline interpreter (CLAUDE.md §7 phrase table).
import { describe, expect, it } from 'vitest';
import type { MinePreferences } from '../src/engine/schema.ts';
import { DEFAULT_PREFERENCES } from '../src/engine/presets.ts';
import { fallback, PHRASE_GROUPS } from '../src/engine/fallback.ts';

const diff = (p: MinePreferences): Partial<MinePreferences> => {
  const out: Partial<MinePreferences> = {};
  for (const k of Object.keys(DEFAULT_PREFERENCES) as (keyof MinePreferences)[]) {
    if (p[k] !== DEFAULT_PREFERENCES[k]) Object.assign(out, { [k]: p[k] });
  }
  return out;
};
const REASON = /^"[^"]+" → .+$/;

describe('phrase groups, English', () => {
  it.each([
    ['It is all too much for me', { density: 'minimal', navigation: 'reduced', showDecorativeMedia: false }, 'too much'],
    [
      'one thing at a time please',
      { taskMode: 'one-at-a-time', surfaceDecisions: true },
      'one thing',
    ],
    ['please explain the jargon', { explainTerms: true }, 'explain'],
    ['use simpler words', { readingLevel: 'plain' }, 'simpler words'],
    ['small text is hard for me', { fontScale: 1.35 }, 'small text'],
    ['everything looks washed out', { contrast: 'high' }, 'washed out'],
    ['keep the images', {}, 'keep the images'],
    ['no images please', { showDecorativeMedia: false }, 'no images'],
    ['what am I signing here?', { surfaceDecisions: true }, 'what am I signing'],
  ] as const)('%s', (text, expected, phrase) => {
    const r = fallback(text, 'en');
    expect(diff(r.preferences)).toEqual(expected);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatch(REASON);
    expect(r.reasons[0]?.startsWith(`"${phrase}"`)).toBe(true);
  });
});

describe('phrase groups, Chinese', () => {
  it.each([
    ['页面太满了', { density: 'minimal', navigation: 'reduced', showDecorativeMedia: false }, '太满'],
    ['一步一步来', { taskMode: 'one-at-a-time', surfaceDecisions: true }, '一步一步'],
    ['解释一下术语', { explainTerms: true }, '解释'],
    ['用大白话', { readingLevel: 'plain' }, '大白话'],
    ['字太小', { fontScale: 1.35 }, '字太小'],
    ['对比度高一点', { contrast: 'high' }, '对比度'],
    ['保留图片', {}, '保留图片'],
    ['不要图片', { showDecorativeMedia: false }, '不要图片'],
    ['我签了什么', { surfaceDecisions: true }, '签了什么'],
  ] as const)('%s', (text, expected, phrase) => {
    const r = fallback(text, 'zh');
    expect(diff(r.preferences)).toEqual(expected);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatch(REASON);
    expect(r.reasons[0]?.startsWith(`"${phrase}"`)).toBe(true);
    expect(r.reasons[0]).toMatch(/[一-鿿]/);
  });
});

describe('every phrase in the table triggers its group', () => {
  it('has the nine groups of §7 in table order, plus the translated edition', () => {
    expect(PHRASE_GROUPS.map((g) => g.key)).toEqual([
      'quiet',
      'steps',
      'terms',
      'plain',
      'larger',
      'contrast',
      'mediaOn',
      'mediaOff',
      'translate',
      'decisions',
    ]);
  });

  for (const group of PHRASE_GROUPS) {
    for (const lang of ['en', 'zh'] as const) {
      it(`${group.key} · ${lang}: ${group[lang].join(' / ')}`, () => {
        for (const phrase of group[lang]) {
          const r = fallback(lang === 'en' ? `I want ${phrase} here.` : `我想要${phrase}。`, lang);
          // The group's own settings must be applied (a phrase may legitimately hit a
          // second group too, e.g. 看不清楚 also contains 看不清).
          const expected: MinePreferences = { ...DEFAULT_PREFERENCES };
          group.apply(expected, false, (lang === 'en' ? `i want ${phrase} here.` : `我想要${phrase}。`).toLowerCase(), lang);
          for (const k of Object.keys(expected) as (keyof MinePreferences)[]) {
            if (expected[k] !== DEFAULT_PREFERENCES[k])
              expect(r.preferences[k], `${phrase} · ${k}`).toBe(expected[k]);
          }
          expect(
            r.reasons.some((x) => x.startsWith(`"${phrase}"`)),
            `${phrase}: ${r.reasons.join(' | ')}`,
          ).toBe(true);
        }
      });
    }
  }
});

describe('order and overrides', () => {
  it('later groups override earlier ones on the same key, in table order', () => {
    expect(
      fallback('keep the images, actually no images', 'en').preferences.showDecorativeMedia,
    ).toBe(false);
    expect(fallback('no images. keep the images', 'en').preferences.showDecorativeMedia).toBe(
      false,
    );
    expect(fallback('不要图片，保留图片', 'zh').preferences.showDecorativeMedia).toBe(false);
  });

  it('a quiet page with the images kept', () => {
    const r = fallback('quieter, but keep the images', 'en');
    expect(diff(r.preferences)).toEqual({ density: 'minimal', navigation: 'reduced' });
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons[0]).not.toMatch(/images off/);
    expect(r.reasons[1]).toMatch(/^"keep the images" → /);
  });

  it('drops the reason of a media phrase that lost the override', () => {
    const r = fallback('keep the images, actually no images', 'en');
    expect(r.reasons.some((x) => x.startsWith('"keep the images"'))).toBe(false);
    expect(r.reasons.some((x) => x.startsWith('"no images"'))).toBe(true);
  });

  it('matches English phrases at word starts only', () => {
    expect(diff(fallback('unless it is required', 'en').preferences)).toEqual({});
    expect(diff(fallback('that would be demeaning', 'en').preferences)).toEqual({});
    expect(diff(fallback('explain this to me', 'en').preferences)).toEqual({ explainTerms: true });
    expect(diff(fallback('less noise, less clutter', 'en').preferences)).toEqual({
      density: 'minimal',
      navigation: 'reduced',
      showDecorativeMedia: false,
    });
  });

  it('is case-insensitive and accepts curly apostrophes', () => {
    expect(diff(fallback('EXPLAIN the TERMS', 'en').preferences)).toEqual({ explainTerms: true });
    expect(fallback('I can’t see the text', 'en').preferences.fontScale).toBe(1.35);
  });
});

describe('the "much" rule', () => {
  it.each([
    ['much bigger text', 1.6],
    ['make it bigger', 1.35],
    ['bigger text, thanks so much', 1.35],
    ['I want the text much larger please', 1.6],
  ] as const)('%s → %s', (text, scale) => {
    const r = fallback(text, 'en');
    expect(r.preferences.fontScale).toBe(scale);
    expect(r.reasons[0]).toMatch(scale === 1.6 ? /160/ : /135/);
  });

  it.each([
    ['字放大很多', 1.6],
    ['非常看不清', 1.6],
    ['字特别小请放大', 1.6],
    ['字太小', 1.35],
    ['字大一点，非常感谢', 1.35],
  ] as const)('%s → %s', (text, scale) => {
    const r = fallback(text, 'zh');
    expect(r.preferences.fontScale).toBe(scale);
    expect(r.reasons[0]).toMatch(scale === 1.6 ? /160/ : /135/);
  });

  it('does not enlarge without a bigger-text phrase', () => {
    expect(fallback('thank you so much', 'en').preferences.fontScale).toBe(1);
  });
});

describe('no match', () => {
  it('returns Default and a single reason in the same language', () => {
    const en = fallback('hello there, nice weather', 'en');
    expect(en.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(en.reasons).toHaveLength(1);
    expect(en.reasons[0]).not.toMatch(REASON);
    expect(en.reasons[0]).toMatch(/nothing/i);

    const zh = fallback('今天天气不错', 'zh');
    expect(zh.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(zh.reasons).toHaveLength(1);
    expect(zh.reasons[0]).toMatch(/[一-鿿]/);
  });

  it('never returns the frozen Default object itself', () => {
    const r = fallback('', 'en');
    expect(r.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(r.preferences).not.toBe(DEFAULT_PREFERENCES);
    expect(Object.isFrozen(r.preferences)).toBe(false);
  });
});

describe('reason format and limits', () => {
  const everything =
    'too much clutter, one at a time, explain the terms, plain words, much bigger text, hard to read, keep the images, no images, what am I signing';

  it('quotes the phrase as written and names the effect', () => {
    const r = fallback('I get overwhelmed easily', 'en');
    expect(r.reasons[0]).toBe('"overwhelmed" → fewer items on screen, menu folded, decorative images off');
  });

  it('caps at 5 reasons of at most 160 characters, keeping the most impactful', () => {
    const r = fallback(everything, 'en');
    expect(r.reasons.length).toBeLessThanOrEqual(5);
    expect(r.reasons.length).toBeGreaterThanOrEqual(1);
    for (const reason of r.reasons) {
      expect(reason.length).toBeLessThanOrEqual(160);
      expect(reason).toMatch(REASON);
    }
    expect(r.reasons.some((x) => x.startsWith('"too much"'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('"one at a time"'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('"plain"'))).toBe(true);
    expect(r.preferences).toEqual({
      readingLevel: 'plain',
      density: 'minimal',
      navigation: 'reduced',
      fontScale: 1.6,
      contrast: 'high',
      showDecorativeMedia: false,
      taskMode: 'one-at-a-time',
      explainTerms: true,
      surfaceDecisions: true,
      hideAllImages: true,
    });
  });

  it('stays under 160 characters even for absurd input', () => {
    const r = fallback(`bigger${'x'.repeat(300)} please`, 'en');
    expect(r.preferences.fontScale).toBe(1.35);
    for (const reason of r.reasons) expect(reason.length).toBeLessThanOrEqual(160);
    expect(r.reasons[0]).toMatch(/^"bigger.*…" → text at 135%$/);
  });
});

describe('the pitch sentences (§7 example)', () => {
  it('English', () => {
    const r = fallback(
      'I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time.',
      'en',
    );
    expect(r.preferences).toMatchObject({
      readingLevel: 'plain',
      density: 'minimal',
      navigation: 'reduced',
      showDecorativeMedia: false,
      taskMode: 'one-at-a-time',
      explainTerms: true,
      surfaceDecisions: true,
    });
    expect(r.reasons).toEqual([
      '"overwhelmed" → fewer items on screen, menu folded, decorative images off',
      '"one decision" → one task per step, choices brought forward',
      '"explain" → terms explained in place',
      '"plain" → passages shown in plain words',
    ]);
  });

  it('Chinese', () => {
    const r = fallback(
      '长表单让我喘不过气。用大白话，解释我可能不懂的词，一次只让我做一个决定。',
      'zh',
    );
    expect(r.preferences).toMatchObject({
      readingLevel: 'plain',
      density: 'minimal',
      navigation: 'reduced',
      showDecorativeMedia: false,
      taskMode: 'one-at-a-time',
      explainTerms: true,
      surfaceDecisions: true,
    });
    expect(r.reasons).toHaveLength(4);
    expect(r.reasons[0]?.startsWith('"喘不过气"')).toBe(true);
    expect(r.reasons[1]?.startsWith('"一个决定"')).toBe(true);
    expect(r.reasons[2]?.startsWith('"解释"')).toBe(true);
    expect(r.reasons[3]?.startsWith('"大白话"')).toBe(true);
    for (const reason of r.reasons) expect(reason).toMatch(/[一-鿿]/);
  });
});
