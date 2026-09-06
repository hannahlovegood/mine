import { describe, expect, it } from 'vitest';
import { transform } from '../src/engine/transform.ts';
import { translatePreset } from '../src/engine/presets.ts';
import { fallback } from '../src/engine/fallback.ts';
import { fixture } from './fixture.ts';

describe('translated edition', () => {
  it('records translated (not rewritten) for every block that carries a plain slot, digits intact', () => {
    const tr = transform(fixture, translatePreset('zh'));
    const translated = tr.changes.filter((c) => c.type === 'translated');
    expect(translated.length).toBeGreaterThan(0);
    expect(tr.changes.some((c) => c.type === 'rewritten')).toBe(false);
    expect(tr.summary.translated).toBe(translated.reduce((n, c) => n + (c.count ?? c.blockIds.length), 0));
    expect(tr.summary.rewritten).toBe(0);
    for (const b of tr.view) if (b.original !== undefined && 'text' in b) {
      const d = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
      expect(d(b.original)).toBe(d(b.text));
    }
    expect(translated[0]?.reason).toMatch(/Translated into Chinese|译成中文/);
  });
  it('legal text and decisions stay as written with the translation beside', () => {
    const tr = transform(fixture, translatePreset('en'));
    const all = [...tr.view, ...(tr.steps ?? []).flatMap((s) => s.blocks)];
    for (const b of all) {
      if (b.kind === 'legal' && b.plainText) expect(b.state).toBe('annotated');
      if (b.kind === 'decision' && b.plainLabel) expect(b.state).toBe('annotated');
    }
  });
  it('fallback picks the target from the words, else the person\'s language', () => {
    expect(fallback('please translate this page into english', 'zh').preferences.translateTo).toBe('en');
    expect(fallback('翻成中文', 'zh').preferences.translateTo).toBe('zh');
    expect(fallback('看不懂英文，翻译一下', 'zh').preferences.translateTo).toBe('zh');
    expect(fallback('translate this', 'en').preferences.translateTo).toBe('en');
    expect(fallback('quieter please', 'en').preferences.translateTo).toBeUndefined();
    expect(fallback('翻译', 'zh').reasons[0]).toMatch(/^"翻译" → /);
  });
});
