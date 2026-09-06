// Invariants I1–I8 (CLAUDE.md §6, made precise in docs/ENGINE.md).
// `runInvariants(name, content)` registers the describe/it blocks for any
// PageContent, so the same suite runs on the fixture now and on the real demo
// content later. It depends only on the engine's public surface.
import { describe, expect, it } from 'vitest';
import { FONT_SCALES, type MinePreferences, type PageContent } from '../src/engine/schema.ts';
import { DEFAULT_PREFERENCES, PRESETS, PRESET_IDS } from '../src/engine/presets.ts';
import {
  transform,
  type Change,
  type Summary,
  type Transformation,
  type ViewBlock,
} from '../src/engine/transform.ts';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) so the 50 random combinations are reproducible.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPTIONS = {
  readingLevel: ['original', 'plain'],
  density: ['full', 'comfortable', 'minimal'],
  navigation: ['full', 'reduced', 'hidden'],
  fontScale: [...FONT_SCALES],
  contrast: ['default', 'high'],
  showDecorativeMedia: [true, false],
  taskMode: ['all', 'one-at-a-time'],
  explainTerms: [true, false],
  surfaceDecisions: [true, false],
} as const satisfies { [K in keyof MinePreferences]: readonly MinePreferences[K][] };

export function randomPreferences(count: number, seed = 20260906): MinePreferences[] {
  const next = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => {
    const v = list[Math.floor(next() * list.length)];
    if (v === undefined) throw new Error('empty option list');
    return v;
  };
  const out: MinePreferences[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      readingLevel: pick(OPTIONS.readingLevel),
      density: pick(OPTIONS.density),
      navigation: pick(OPTIONS.navigation),
      fontScale: pick(OPTIONS.fontScale),
      contrast: pick(OPTIONS.contrast),
      showDecorativeMedia: pick(OPTIONS.showDecorativeMedia),
      taskMode: pick(OPTIONS.taskMode),
      explainTerms: pick(OPTIONS.explainTerms),
      surfaceDecisions: pick(OPTIONS.surfaceDecisions),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers over a Transformation
// ---------------------------------------------------------------------------

/** Every rendered block: the view (or frame) plus every step, in order. */
export function renderedBlocks(t: Transformation): ViewBlock[] {
  return [...t.view, ...(t.steps ?? []).flatMap((s) => s.blocks)];
}

function stepBlocks(t: Transformation): ViewBlock[] {
  return (t.steps ?? []).flatMap((s) => s.blocks);
}

function countIds(blocks: ViewBlock[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of blocks) m.set(b.id, (m.get(b.id) ?? 0) + 1);
  return m;
}

function digits(s: string): string {
  return [...(s.match(/\d+/g) ?? [])].sort().join(',');
}

function summaryFromChanges(changes: Change[]): Summary {
  const s: Summary = {
    hidden: 0,
    collapsed: 0,
    moved: 0,
    rewritten: 0,
    explained: 0,
    enlarged: 0,
    steps: 0,
    surfaced: 0,
  };
  for (const c of changes) {
    const n = c.count ?? c.blockIds.length;
    if (c.type === 'stepped') s.steps += n;
    else s[c.type] += n;
  }
  return s;
}

interface Combo {
  label: string;
  prefs: MinePreferences;
}

function combos(): Combo[] {
  const presets = PRESET_IDS.map((id) => ({ label: `preset ${id}`, prefs: PRESETS[id] }));
  const random = randomPreferences(50).map((prefs, i) => ({
    label: `random #${i + 1} ${JSON.stringify(prefs)}`,
    prefs,
  }));
  return [...presets, ...random];
}

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

export function runInvariants(name: string, content: PageContent): void {
  const all = combos();
  const critical = content.blocks.filter((b) => b.importance === 'critical').map((b) => b.id);
  const requiredFields = content.blocks
    .filter((b) => b.kind === 'field' && b.required)
    .map((b) => b.id);
  const fieldsAndDecisions = content.blocks
    .filter((b) => b.kind === 'field' || b.kind === 'decision')
    .map((b) => b.id);
  const preCheckedById = new Map(
    content.blocks.flatMap((b) => (b.kind === 'decision' ? [[b.id, b.preChecked] as const] : [])),
  );

  describe(`invariants · ${name}`, () => {
    it('I1 every critical block is rendered (never hidden, never only in a stub) — presets and 50 random combinations', () => {
      expect(critical.length, 'the content has critical blocks').toBeGreaterThan(0);
      for (const { label, prefs } of all) {
        const t = transform(content, prefs);
        const rendered = countIds(renderedBlocks(t));
        const stubbed = new Set(renderedBlocks(t).flatMap((b) => b.stubFor ?? []));
        for (const id of critical) {
          expect(rendered.get(id), `${label}: critical ${id} rendered exactly once`).toBe(1);
          expect(stubbed.has(id), `${label}: critical ${id} must not be set aside`).toBe(false);
        }
      }
    });

    it('I2 every required field appears exactly once across view and steps', () => {
      expect(requiredFields.length, 'the content has required fields').toBeGreaterThan(0);
      for (const { label, prefs } of all) {
        const rendered = countIds(renderedBlocks(transform(content, prefs)));
        for (const id of requiredFields) {
          expect(rendered.get(id), `${label}: required field ${id}`).toBe(1);
        }
      }
    });

    it('I3 rewritten blocks keep the same multiset of digit sequences', () => {
      let checked = 0;
      for (const { label, prefs } of all) {
        for (const b of renderedBlocks(transform(content, prefs))) {
          if (b.original === undefined) continue;
          checked++;
          const now = b.kind === 'field' ? (b.help ?? '') : 'text' in b ? b.text : '';
          expect(digits(now), `${label}: digits of ${b.id}`).toBe(digits(b.original));
        }
      }
      const rewritable = content.blocks.some(
        (b) => ('plainText' in b && b.plainText) || ('plainHelp' in b && b.plainHelp),
      );
      if (rewritable) expect(checked, 'at least one rewrite was checked').toBeGreaterThan(0);
    });

    it('I4 Default preserves the original order and produces zero changes', () => {
      const t = transform(content, DEFAULT_PREFERENCES);
      expect(t.view.map((b) => b.id)).toEqual(content.blocks.map((b) => b.id));
      expect(t.view.every((b) => b.state === 'shown' && b.stubFor === undefined)).toBe(true);
      expect(t.steps).toBeUndefined();
      expect(t.changes).toEqual([]);
      expect(t.summary).toEqual({
        hidden: 0,
        collapsed: 0,
        moved: 0,
        rewritten: 0,
        explained: 0,
        enlarged: 0,
        steps: 0,
        surfaced: 0,
      });
    });

    it('I5 one-at-a-time: the union of step blocks has every field and decision exactly once', () => {
      const oneAtATime = [
        {
          label: 'default + one-at-a-time',
          prefs: { ...DEFAULT_PREFERENCES, taskMode: 'one-at-a-time' as const },
        },
        ...all.filter((c) => c.prefs.taskMode === 'one-at-a-time'),
      ];
      expect(oneAtATime.length).toBeGreaterThan(1);
      for (const { label, prefs } of oneAtATime) {
        const t = transform(content, prefs);
        expect(t.steps, `${label}: steps exist`).toBeDefined();
        const inSteps = countIds(stepBlocks(t));
        const inFrame = countIds(t.view);
        for (const id of fieldsAndDecisions) {
          expect(inSteps.get(id), `${label}: ${id} in steps`).toBe(1);
          expect(inFrame.get(id), `${label}: ${id} not in the frame`).toBeUndefined();
        }
      }
    });

    it('I6 preChecked is never altered, and the input is never mutated', () => {
      const before = JSON.stringify(content);
      for (const { label, prefs } of all) {
        const t = transform(content, prefs);
        for (const b of renderedBlocks(t)) {
          if (b.kind !== 'decision') continue;
          expect(b.preChecked, `${label}: ${b.id} preChecked`).toBe(preCheckedById.get(b.id));
        }
        for (const list of [t.decisions.optional, t.decisions.required, t.decisions.preChecked]) {
          for (const d of list) {
            expect(d.preChecked, `${label}: summary ${d.id} preChecked`).toBe(
              preCheckedById.get(d.id),
            );
          }
        }
        expect(t.decisions.preChecked.every((d) => d.preChecked)).toBe(true);
      }
      expect(JSON.stringify(content)).toBe(before);
    });

    it('I7 same input, identical output', () => {
      for (const { label, prefs } of all) {
        const a = transform(content, prefs);
        const b = transform(content, { ...prefs });
        expect(a, label).toStrictEqual(b);
      }
    });

    it('I8 every summary number equals the count derived from changes', () => {
      for (const { label, prefs } of all) {
        const t = transform(content, prefs);
        expect(t.summary, label).toEqual(summaryFromChanges(t.changes));
        for (const c of t.changes) {
          expect(c.blockIds.length, `${label}: a change lists at least one block`).toBeGreaterThan(
            0,
          );
          expect(c.reason.trim().length, `${label}: a change has a reason`).toBeGreaterThan(0);
        }
      }
    });
  });
}
