// Behavioural expectations per preset on the fixture (docs/ENGINE.md rules 1–9).
import { describe, expect, it } from 'vitest';
import type { ContentBlock, MinePreferences, PageContent } from '../src/engine/schema.ts';
import { DEFAULT_PREFERENCES, PRESETS } from '../src/engine/presets.ts';
import { transform, type Transformation, type ViewBlock } from '../src/engine/transform.ts';
import { fixture } from './fixture.ts';

const ids = (blocks: ViewBlock[]) => blocks.map((b) => b.id);
const rendered = (t: Transformation) => [...t.view, ...(t.steps ?? []).flatMap((s) => s.blocks)];
const find = (t: Transformation, id: string): ViewBlock => {
  const b = rendered(t).find((x) => x.id === id);
  if (!b) throw new Error(`${id} is not rendered`);
  return b;
};
const stubs = (t: Transformation) => rendered(t).filter((b) => b.stubFor !== undefined);
const hiddenIds = (t: Transformation) =>
  t.changes.filter((c) => c.type === 'hidden').flatMap((c) => c.blockIds);
const source = (id: string) => {
  const b = fixture.blocks.find((x) => x.id === id);
  if (!b) throw new Error(`${id} missing from fixture`);
  return b;
};
const text = (b: ContentBlock | ViewBlock | undefined) => (b && 'text' in b ? b.text : undefined);

describe('Focus', () => {
  const t = transform(fixture, PRESETS.focus);

  it('sets aside every decorative and secondary block, stubbed per region', () => {
    expect(new Set(hiddenIds(t))).toEqual(
      new Set([
        'hero-image',
        'app-promo',
        'maintenance-notice',
        'related-links',
        'faq-1',
        'faq-2',
        'rate-page',
      ]),
    );
    for (const id of hiddenIds(t)) {
      expect(ids(rendered(t)), `${id} is not rendered`).not.toContain(id);
    }
    expect(ids(stubs(t))).toEqual([
      'stub-header',
      'stub-utility',
      'stub-main',
      'stub-sidebar',
      'stub-footer',
    ]);
    expect(find(t, 'stub-main').stubFor).toEqual(['hero-image', 'faq-1', 'faq-2']);
  });

  it('every hidden id appears in exactly one stub, so restoring is always possible', () => {
    const all = stubs(t).flatMap((s) => s.stubFor ?? []);
    expect([...all].sort()).toEqual([...hiddenIds(t)].sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it('stubs have the documented shape', () => {
    for (const s of stubs(t)) {
      expect(s).toMatchObject({
        kind: 'text',
        importance: 'secondary',
        text: '',
        complexity: 'simple',
        state: 'collapsed',
      });
      expect(s.region).toBeDefined();
      expect(s.id).toBe(`stub-${s.region}`);
      expect(s.group).toBeUndefined();
    }
  });

  it('collapses the menu nav in place, and leaves the sidebar nav to the density rule', () => {
    expect(find(t, 'main-nav').state).toBe('collapsed');
    const c = t.changes.find((x) => x.type === 'collapsed');
    expect(c?.blockIds).toEqual(['main-nav']);
    expect(c?.reason).toContain('12');
    expect(hiddenIds(t)).toContain('related-links');
  });

  it('moves the deadline: first block of its step in one-at-a-time, right after the h1 otherwise', () => {
    const start = t.steps?.find((s) => s.id === 'start');
    expect(start?.blocks[0]?.id).toBe('deadline');
    expect(start?.blocks[0]?.state).toBe('moved');
    expect(t.changes.find((c) => c.type === 'moved')?.blockIds).toEqual(['deadline']);

    const flat = transform(fixture, { ...PRESETS.focus, taskMode: 'all' });
    const order = ids(flat.view);
    expect(order.indexOf('deadline')).toBe(order.indexOf('title') + 1);
    expect(find(flat, 'deadline').state).toBe('moved');
  });

  it('surfaces the optional pre-checked decision without touching it', () => {
    const surfaced = t.changes.filter((c) => c.type === 'surfaced');
    expect(surfaced.map((c) => c.blockIds)).toEqual([['share-consent']]);
    expect(surfaced[0]?.reason).toMatch(/pre-checked/i);
    expect(surfaced[0]?.reason).toMatch(/own step/i);
    const consent = find(t, 'share-consent');
    expect(consent.kind === 'decision' && consent.preChecked).toBe(true);
    expect(t.decisions).toMatchObject({ count: 2 });
    expect(t.decisions.optional.map((d) => d.id)).toEqual(['share-consent']);
    expect(t.decisions.required.map((d) => d.id)).toEqual(['attestation']);
    expect(t.decisions.preChecked.map((d) => d.id)).toEqual(['share-consent']);
  });

  it('builds the steps: choice step before its group, other options collapsed at the end', () => {
    expect(t.steps?.map((s) => s.id)).toEqual([
      'start',
      'you',
      'home',
      'choice-share-consent',
      'review',
    ]);
    expect(t.steps?.map((s) => s.title)).toEqual([
      'Before you start',
      'About you',
      'Your home',
      'A choice',
      'Review and submit',
    ]);
    const choice = t.steps?.find((s) => s.choice);
    expect(choice?.id).toBe('choice-share-consent');
    expect(ids(choice?.blocks ?? [])).toEqual(['share-consent']);
    expect(t.steps?.filter((s) => !s.choice).every((s) => s.choice === undefined)).toBe(true);

    const byId = Object.fromEntries((t.steps ?? []).map((s) => [s.id, ids(s.blocks)]));
    expect(byId['start']).toEqual(['deadline', 'eligibility', 'what-you-need', 'how-assessed']);
    expect(byId['you']).toEqual(['instructions', 'full-name', 'date-of-birth']);
    expect(byId['home']).toEqual(['form-image', 'address', 'monthly-rent', 'household-size']);
    // Demoted actions keep their original page order: download-pdf (utility bar) came before save-draft.
    expect(byId['review']).toEqual([
      'privacy-notice',
      'attestation',
      'submit',
      'download-pdf',
      'save-draft',
    ]);
    expect(find(t, 'save-draft').state).toBe('collapsed');
    expect(find(t, 'download-pdf').state).toBe('collapsed');
    expect(find(t, 'submit').state).toBe('shown');
  });

  it('keeps the frame: every shown block without a group, in original order', () => {
    expect(ids(t.view)).toEqual([
      'main-nav',
      'stub-header',
      'stub-utility',
      'title',
      'stub-main',
      'intro',
      'stub-sidebar',
      'stub-footer',
    ]);
  });

  it('records one stepped change per non-choice step, and the summary matches', () => {
    const stepped = t.changes.filter((c) => c.type === 'stepped');
    expect(stepped).toHaveLength(4);
    expect(stepped.every((c) => c.count === 1)).toBe(true);
    expect(stepped.map((c) => c.blockIds.length)).toEqual([4, 3, 4, 5]);
    expect(t.summary).toEqual({
      hidden: 7,
      collapsed: 1,
      moved: 1,
      rewritten: 0,
      translated: 0,
      explained: 0,
      enlarged: 0,
      steps: 4,
      surfaced: 1,
    });
  });

  it('records changes in rule order so the colophon reads coherently', () => {
    expect(t.changes.map((c) => c.type)).toEqual([
      'hidden',
      'hidden',
      'hidden',
      'hidden',
      'hidden',
      'hidden',
      'collapsed',
      'moved',
      'surfaced',
      'stepped',
      'stepped',
      'stepped',
      'stepped',
    ]);
    expect(t.changes[0]?.blockIds).toEqual(['hero-image']);
    expect(t.changes.slice(1, 6).map((c) => c.blockIds)).toEqual([
      ['app-promo'],
      ['maintenance-notice'],
      ['faq-1', 'faq-2'],
      ['related-links'],
      ['rate-page'],
    ]);
  });
});

describe('Plain', () => {
  const t = transform(fixture, PRESETS.plain);

  it('rewrites text blocks that have plainText and keeps the original', () => {
    for (const id of ['intro', 'eligibility', 'how-assessed', 'instructions']) {
      const b = find(t, id);
      const src = source(id);
      expect(b.state, id).toBe('rewritten');
      expect(text(b), id).toBe('plainText' in src ? src.plainText : undefined);
      expect(b.original, id).toBe('text' in src ? src.text : undefined);
    }
    const untouched = find(t, 'what-you-need');
    expect(untouched.state).toBe('shown');
    expect(untouched.original).toBeUndefined();
  });

  it('rewrites the deadline too, but keeps the more informative state (moved)', () => {
    const d = find(t, 'deadline');
    const src = source('deadline');
    expect(d.state).toBe('moved');
    expect(text(d)).toBe('plainText' in src ? src.plainText : undefined);
    expect(d.original).toBe('text' in src ? src.text : undefined);
    expect(ids(t.view).indexOf('deadline')).toBe(ids(t.view).indexOf('title') + 1);
  });

  it('annotates legal text and decisions instead of replacing them', () => {
    const legal = find(t, 'privacy-notice');
    expect(legal.state).toBe('annotated');
    expect(text(legal)).toBe(text(source('privacy-notice')));
    expect(legal.original).toBeUndefined();
    for (const id of ['share-consent', 'attestation']) {
      const d = find(t, id);
      const src = source(id);
      expect(d.state, id).toBe('annotated');
      expect('label' in d && d.label).toBe('label' in src && src.label);
    }
  });

  it('rewrites field help with plainHelp', () => {
    const f = find(t, 'date-of-birth');
    const src = source('date-of-birth');
    expect(f.state).toBe('rewritten');
    expect('help' in f && f.help).toBe('plainHelp' in src && src.plainHelp);
    expect(f.original).toBe('help' in src ? src.help : undefined);
  });

  it('leaves collapsed secondary blocks as written', () => {
    const faq = find(t, 'faq-1');
    expect(faq.state).toBe('collapsed');
    expect(text(faq)).toBe(text(source('faq-1')));
    expect(faq.original).toBeUndefined();
    expect(t.changes.some((c) => c.blockIds.includes('faq-1') && c.type !== 'collapsed')).toBe(
      false,
    );
  });

  it('records one rewritten change per block, with a reason that says replaced or beside', () => {
    const rewritten = t.changes.filter((c) => c.type === 'rewritten');
    expect(rewritten.map((c) => c.blockIds)).toEqual([
      ['deadline'],
      ['intro'],
      ['eligibility'],
      ['how-assessed'],
      ['instructions'],
      ['date-of-birth'],
      ['privacy-notice'],
      ['share-consent'],
      ['attestation'],
    ]);
    const reasonOf = (id: string) => rewritten.find((c) => c.blockIds[0] === id)?.reason ?? '';
    expect(reasonOf('privacy-notice')).toMatch(/beside/);
    expect(reasonOf('share-consent')).toMatch(/beside/);
    expect(reasonOf('intro')).toMatch(/original/i);
    expect(reasonOf('date-of-birth')).toMatch(/help/i);
  });

  it('explains terms with count = terms.length, skipping collapsed blocks', () => {
    const explained = t.changes.filter((c) => c.type === 'explained');
    expect(explained.map((c) => [c.blockIds[0], c.count])).toEqual([
      ['intro', 2],
      ['eligibility', 1],
      ['how-assessed', 2],
      ['privacy-notice', 1],
    ]);
    expect(t.summary.explained).toBe(6);
  });

  it('comfortable density: decorative set aside per region, secondary collapsed in place', () => {
    expect(ids(stubs(t))).toEqual(['stub-header', 'stub-main', 'stub-footer']);
    expect(new Set(hiddenIds(t))).toEqual(new Set(['app-promo', 'hero-image', 'rate-page']));
    const collapsed = t.changes.filter((c) => c.type === 'collapsed');
    expect(collapsed.map((c) => c.blockIds)).toEqual([
      ['maintenance-notice', 'related-links', 'faq-1', 'faq-2'],
      ['main-nav'],
    ]);
    for (const id of ['maintenance-notice', 'related-links', 'faq-1', 'faq-2', 'main-nav']) {
      expect(find(t, id).state, id).toBe('collapsed');
    }
  });

  it('has no steps and a matching summary', () => {
    expect(t.steps).toBeUndefined();
    expect(t.summary).toEqual({
      hidden: 3,
      collapsed: 5,
      moved: 1,
      rewritten: 9,
      translated: 0,
      explained: 6,
      enlarged: 0,
      steps: 0,
      surfaced: 1,
    });
    const surfaced = t.changes.find((c) => c.type === 'surfaced');
    expect(surfaced?.reason).toMatch(/pre-checked/i);
    expect(surfaced?.reason).not.toMatch(/own step/i);
  });
});

describe('Large', () => {
  const t = transform(fixture, PRESETS.large);

  it('records enlarged for every field and action, in one change', () => {
    const enlarged = t.changes.filter((c) => c.type === 'enlarged');
    expect(enlarged).toHaveLength(1);
    expect(enlarged[0]?.blockIds).toEqual([
      'download-pdf',
      'full-name',
      'date-of-birth',
      'address',
      'monthly-rent',
      'household-size',
      'save-draft',
      'submit',
    ]);
    for (const id of enlarged[0]?.blockIds ?? []) expect(find(t, id).state, id).toBe('enlarged');
    expect(enlarged[0]?.reason).toContain('48');
  });

  it('keeps the full menu and matches the summary', () => {
    expect(find(t, 'main-nav').state).toBe('shown');
    expect(t.summary).toEqual({
      hidden: 3,
      collapsed: 4,
      moved: 1,
      rewritten: 0,
      translated: 0,
      explained: 0,
      enlarged: 8,
      steps: 0,
      surfaced: 1,
    });
  });
});

describe('Default', () => {
  it('yields the page as published: zero changes, no stubs, no steps', () => {
    const t = transform(fixture, DEFAULT_PREFERENCES);
    expect(t.changes).toEqual([]);
    expect(stubs(t)).toEqual([]);
    expect(t.steps).toBeUndefined();
    expect(ids(t.view)).toEqual(fixture.blocks.map((b) => b.id));
    expect(Object.values(t.summary).every((n) => n === 0)).toBe(true);
    expect(t.decisions.count).toBe(2);
  });
});

describe('Navigation hidden', () => {
  it('sets the menu aside behind a stub-nav that can restore it', () => {
    const t = transform(fixture, { ...DEFAULT_PREFERENCES, navigation: 'hidden' });
    expect(t.view[0]).toMatchObject({ id: 'stub-nav', stubFor: ['main-nav'], state: 'collapsed' });
    expect(ids(t.view)).not.toContain('main-nav');
    expect(find(t, 'related-links').state).toBe('shown');
    expect(t.changes.map((c) => c.type)).toEqual(['hidden', 'moved']);
    expect(t.changes[0]?.blockIds).toEqual(['main-nav']);
  });

  it('collapses a critical menu instead of hiding it', () => {
    const content: PageContent = {
      ...fixture,
      blocks: fixture.blocks.map((b) =>
        b.id === 'main-nav' ? { ...b, importance: 'critical' } : b,
      ),
    };
    const t = transform(content, { ...DEFAULT_PREFERENCES, navigation: 'hidden' });
    expect(find(t, 'main-nav').state).toBe('collapsed');
    expect(t.changes[0]?.type).toBe('collapsed');
  });
});

describe('Rule interplay', () => {
  it('keeps the more informative state but still lists the block as enlarged', () => {
    const prefs: MinePreferences = { ...PRESETS.plain, fontScale: 1.6 };
    const t = transform(fixture, prefs);
    expect(find(t, 'date-of-birth').state).toBe('rewritten');
    expect(find(t, 'full-name').state).toBe('enlarged');
    const enlarged = t.changes.find((c) => c.type === 'enlarged');
    expect(enlarged?.blockIds).toContain('date-of-birth');
    expect(enlarged?.blockIds).toContain('full-name');
  });

  it('demoted actions stay collapsed in the last step even when enlarged', () => {
    const t = transform(fixture, { ...PRESETS.focus, fontScale: 1.6 });
    expect(find(t, 'save-draft').state).toBe('collapsed');
    expect(t.changes.find((c) => c.type === 'enlarged')?.blockIds).toContain('save-draft');
  });

  it('with every rule on, every field and decision is still rendered exactly once', () => {
    const everything: MinePreferences = {
      readingLevel: 'plain',
      density: 'minimal',
      navigation: 'hidden',
      fontScale: 1.6,
      contrast: 'high',
      showDecorativeMedia: false,
      taskMode: 'one-at-a-time',
      explainTerms: true,
      surfaceDecisions: true,
    };
    const t = transform(fixture, everything);
    const counts = new Map<string, number>();
    for (const b of rendered(t)) counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
    for (const b of fixture.blocks) {
      if (b.kind === 'field' || b.kind === 'decision') expect(counts.get(b.id), b.id).toBe(1);
    }
    expect(t.view[0]?.id).toBe('stub-nav');
    expect(t.summary.steps).toBe(4);
  });
});

describe('Reasons follow content.meta.lang', () => {
  const zh: PageContent = { ...fixture, meta: { ...fixture.meta, lang: 'zh' } };
  const cjk = /[一-鿿]/;

  it('writes every reason in Chinese for zh content, and titles the choice step 一个选择', () => {
    for (const prefs of [PRESETS.focus, PRESETS.plain, PRESETS.large]) {
      const t = transform(zh, prefs);
      expect(t.changes.length).toBeGreaterThan(0);
      for (const c of t.changes) expect(c.reason, c.type).toMatch(cjk);
      const choice = t.steps?.find((s) => s.choice);
      if (choice) expect(choice.title).toBe('一个选择');
    }
  });

  it('writes every reason in English for en content', () => {
    for (const prefs of [PRESETS.focus, PRESETS.plain, PRESETS.large]) {
      for (const c of transform(fixture, prefs).changes) expect(c.reason, c.type).not.toMatch(cjk);
    }
  });
});
