// T03 acceptance: both demo pages validate, satisfy every count from TASKS.md / CLAUDE.md §4,
// preserve every digit sequence in every plain version (I3 on real content), and mirror each
// other's structure so the engine and the UI never branch on language.
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PageContentSchema,
  TEXT_KINDS,
  type ContentBlock,
  type DeadlineBlock,
  type DecisionBlock,
  type FieldBlock,
  type Lang,
  type PageContent,
  type TextBlock,
} from '../src/engine/schema.ts';
import { DEMO_EXAMPLE, STEP_ORDER, contents, getContent } from '../src/content/content.meta.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LANGS: Lang[] = ['en', 'zh'];
const STEP_IDS = ['start', 'you', 'home', 'income', 'review'];
const IMAGES = ['hero-rowhouses.svg', 'app-promo-phone.svg', 'documents-checklist.svg'];

const digitRuns = (s: string): string[] => (s.match(/\d+/g) ?? []).sort();
const isText = (b: ContentBlock): b is TextBlock => (TEXT_KINDS as readonly string[]).includes(b.kind);
const fieldsOf = (c: PageContent): FieldBlock[] => c.blocks.filter((b): b is FieldBlock => b.kind === 'field');
const decisionsOf = (c: PageContent): DecisionBlock[] =>
  c.blocks.filter((b): b is DecisionBlock => b.kind === 'decision');
const deadlinesOf = (c: PageContent): DeadlineBlock[] =>
  c.blocks.filter((b): b is DeadlineBlock => b.kind === 'deadline');
const contains = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.toLowerCase());

function byId(c: PageContent, id: string): ContentBlock {
  const b = c.blocks.find((x) => x.id === id);
  if (!b) throw new Error(`no block "${id}" in ${c.meta.lang}`);
  return b;
}
function navItems(c: PageContent, id: string): string[] {
  const b = byId(c, id);
  if (b.kind !== 'nav') throw new Error(`${id} is not a nav`);
  return b.items;
}
function textOf(c: PageContent, id: string): TextBlock {
  const b = byId(c, id);
  if (!isText(b)) throw new Error(`${id} is not a text block`);
  return b;
}
function decisionOf(c: PageContent, id: string): DecisionBlock {
  const b = byId(c, id);
  if (b.kind !== 'decision') throw new Error(`${id} is not a decision`);
  return b;
}

describe.each(LANGS)('demo content (%s)', (lang) => {
  const content = getContent(lang);

  it('validates against PageContentSchema', () => {
    const r = PageContentSchema.safeParse(content);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it('meta: language, the five steps in order, title is the single h1', () => {
    expect(content.meta.lang).toBe(lang);
    expect(content.meta.stepOrder.map((s) => s.id)).toEqual(STEP_IDS);
    const h1s = content.blocks.filter((b): b is TextBlock => b.kind === 'heading' && b.level === 1);
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.text).toBe(content.meta.title);
    expect(h1s[0]?.importance).toBe('primary');
  });

  it('is the cluttered page from §4: ≥ 40 blocks, 12-item menu, utility bar, promos, notice, sidebar, footer', () => {
    expect(content.blocks.length).toBeGreaterThanOrEqual(40);

    expect(navItems(content, 'nav-main')).toHaveLength(12);
    expect(byId(content, 'nav-main').importance).toBe('primary');
    expect(byId(content, 'nav-main').region).toBe('header');

    const utility = navItems(content, 'nav-utility');
    expect(utility.length).toBeGreaterThanOrEqual(4);
    expect(utility.length).toBeLessThanOrEqual(5);
    expect(byId(content, 'nav-utility').region).toBe('utility');
    expect(byId(content, 'nav-utility').importance).toBe('secondary');

    const promo = byId(content, 'promo-app');
    expect(promo.kind).toBe('promo');
    expect(promo.importance).toBe('decorative');
    expect(promo.region).toBe('header');

    const notice = textOf(content, 'notice-maintenance');
    expect(notice.kind).toBe('notice');
    expect(notice.importance).toBe('secondary');
    expect(digitRuns(notice.text).length).toBeGreaterThan(0);

    expect(navItems(content, 'nav-related')).toHaveLength(8);
    expect(byId(content, 'nav-related').region).toBe('sidebar');
    expect(byId(content, 'nav-related').importance).toBe('secondary');
    const announcements = content.blocks.filter((b): b is TextBlock => b.kind === 'text' && b.region === 'sidebar');
    expect(announcements).toHaveLength(3);
    for (const a of announcements) {
      expect(a.importance).toBe('secondary');
      expect(['simple', 'medium']).toContain(a.complexity);
    }
    expect(announcements.some((a) => digitRuns(a.text).length > 0)).toBe(true);
    const rate = byId(content, 'promo-rate');
    expect(rate.kind).toBe('promo');
    expect(rate.importance).toBe('decorative');
    expect(rate.region).toBe('sidebar');

    const footer = navItems(content, 'nav-footer');
    expect(footer.length).toBeGreaterThanOrEqual(5);
    expect(footer.length).toBeLessThanOrEqual(6);
    expect(byId(content, 'nav-footer').region).toBe('footer');
    expect(byId(content, 'nav-footer').importance).toBe('secondary');

    const h2 = textOf(content, 'heading-form');
    expect(h2.level).toBe(2);
    expect(h2.importance).toBe('primary');
    const instruction = textOf(content, 'form-instruction');
    expect(instruction.kind).toBe('instruction');
    expect(instruction.complexity).toBe('medium');
    expect(instruction.text).toContain('*'); // the mixed messaging about required marks
    expect(instruction.plainText).toBeDefined();
  });

  it('12 fields, ≥ 8 required, four per step, critical when required, helps with jargon and digits', () => {
    const fields = fieldsOf(content);
    expect(fields).toHaveLength(12);
    expect(fields.filter((f) => f.required).length).toBeGreaterThanOrEqual(8);
    for (const f of fields) {
      expect(f.importance, f.id).toBe(f.required ? 'critical' : 'primary');
      expect(['you', 'home', 'income'], f.id).toContain(f.group);
      if (f.plainHelp) expect(f.help, `${f.id} has plainHelp without help`).toBeDefined();
      if (f.input === 'select') expect(f.options?.length ?? 0, f.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of ['you', 'home', 'income']) expect(fields.filter((f) => f.group === g), g).toHaveLength(4);
    expect(fields.filter((f) => f.help).length).toBeGreaterThanOrEqual(10);
    const withPlainHelp = fields.filter((f) => f.plainHelp);
    expect(withPlainHelp.length).toBeGreaterThanOrEqual(4);
    expect(withPlainHelp.filter((f) => digitRuns(f.help ?? '').length > 0).length).toBeGreaterThanOrEqual(2);
    expect(fields.filter((f) => f.input === 'select').length).toBeGreaterThanOrEqual(2);
    expect(fields.some((f) => f.input === 'file')).toBe(true);
    expect(fields.some((f) => f.input === 'number')).toBe(true);
    expect(fields.some((f) => f.input === 'date')).toBe(true);
  });

  it('exactly two decisions: the pre-checked optional consent and the required attestation', () => {
    const decisions = decisionsOf(content);
    expect(decisions).toHaveLength(2);
    expect(decisions.filter((d) => d.optional)).toHaveLength(1);
    expect(decisions.filter((d) => d.preChecked)).toHaveLength(1);

    const trap = decisionOf(content, 'decision-share-data');
    expect(trap.optional).toBe(true);
    expect(trap.preChecked).toBe(true);
    expect(trap.importance).toBe('primary');
    expect(trap.group).toBe('review');
    expect(trap.plainLabel).toBeDefined();
    expect(trap.consequence).toBeDefined();

    const attest = decisionOf(content, 'decision-attest');
    expect(attest.optional).toBe(false);
    expect(attest.preChecked).toBe(false);
    expect(attest.importance).toBe('critical');
    expect(attest.group).toBe('review');
    expect(attest.plainLabel).toBeDefined();
  });

  it('one critical deadline, buried as the fourth paragraph of the body', () => {
    const deadlines = deadlinesOf(content);
    expect(deadlines).toHaveLength(1);
    const d = deadlines[0];
    if (!d) throw new Error('unreachable');
    expect(d.importance).toBe('critical');
    expect(d.group).toBe('start');
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [year = '', , day = ''] = d.date.split('-');
    expect(d.text).toContain(year);
    expect(d.text).toContain(String(Number(day)));
    expect(d.plainText).toBeDefined();

    const index = content.blocks.indexOf(d);
    const before = content.blocks.slice(0, index);
    expect(before.filter(isText).length).toBeGreaterThanOrEqual(3);
    const paragraphsBefore = before.filter(
      (b) => isText(b) && b.region === undefined && (b.kind === 'text' || b.kind === 'legal' || b.kind === 'instruction'),
    );
    expect(paragraphsBefore).toHaveLength(3);
    expect(index).toBeGreaterThan(content.blocks.indexOf(byId(content, 'heading-title')));
  });

  it('≥ 8 secondary or decorative blocks for Focus to set aside; critical is exactly the right set', () => {
    const quiet = content.blocks.filter((b) => b.importance === 'secondary' || b.importance === 'decorative');
    expect(quiet.length).toBeGreaterThanOrEqual(8);
    const critical = content.blocks.filter((b) => b.importance === 'critical').map((b) => b.id);
    const expected = [
      'deadline',
      'decision-attest',
      'privacy-notice',
      'action-submit',
      ...fieldsOf(content)
        .filter((f) => f.required)
        .map((f) => f.id),
    ];
    expect([...critical].sort()).toEqual([...expected].sort());
  });

  it('≥ 6 complex passages with plainText; 8–12 terms that appear in the original and in the plain version', () => {
    const texts = content.blocks.filter(isText);
    expect(texts.filter((b) => b.complexity === 'complex' && b.plainText).length).toBeGreaterThanOrEqual(6);
    for (const b of texts) {
      if (b.complexity === 'complex') expect(b.plainText, `${b.id} is complex but has no plainText`).toBeDefined();
      if (b.plainText) {
        expect(b.plainText).not.toBe(b.text);
        expect(b.plainText.trim().length).toBeGreaterThan(0);
      }
    }
    const legal = texts.filter((b) => b.kind === 'legal');
    expect(legal.length).toBeGreaterThanOrEqual(2);
    for (const b of legal) expect(b.plainText, b.id).toBeDefined();

    const terms = texts.flatMap((b) => (b.terms ?? []).map((t) => ({ block: b, ...t })));
    expect(terms.length).toBeGreaterThanOrEqual(8);
    expect(terms.length).toBeLessThanOrEqual(12);
    for (const t of terms) {
      expect(contains(t.block.text, t.term), `${t.block.id}: "${t.term}" is not in the text`).toBe(true);
      if (t.block.plainText) {
        expect(contains(t.block.plainText, t.term), `${t.block.id}: "${t.term}" is not in the plainText`).toBe(true);
      }
      expect(t.plain.length).toBeGreaterThan(6);
    }
  });

  it('I3 on content: every plain version preserves every digit sequence', () => {
    for (const b of content.blocks) {
      if (isText(b) && b.plainText) expect(digitRuns(b.plainText), b.id).toEqual(digitRuns(b.text));
      if (b.kind === 'deadline' && b.plainText) expect(digitRuns(b.plainText), b.id).toEqual(digitRuns(b.text));
      if (b.kind === 'field' && b.plainHelp) expect(digitRuns(b.plainHelp), b.id).toEqual(digitRuns(b.help ?? ''));
      if (b.kind === 'decision' && b.plainLabel) expect(digitRuns(b.plainLabel), b.id).toEqual(digitRuns(b.label));
    }
  });

  it('privacy notice: critical legal text in the footer with a retention period in digits and a summary', () => {
    const p = textOf(content, 'privacy-notice');
    expect(p.kind).toBe('legal');
    expect(p.importance).toBe('critical');
    expect(p.region).toBe('footer');
    expect(p.group).toBe('review');
    expect(digitRuns(p.text).length).toBeGreaterThan(0);
    expect(p.plainText).toBeDefined();
    expect(p.terms?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('four competing calls to action; only Submit is primary and critical', () => {
    const actions = content.blocks.filter((b) => b.kind === 'action');
    expect(actions).toHaveLength(4);
    expect(actions.filter((a) => a.kind === 'action' && a.primary).map((a) => a.id)).toEqual(['action-submit']);
    expect(byId(content, 'action-submit').importance).toBe('critical');
    expect(byId(content, 'action-submit').group).toBe('review');
    expect(byId(content, 'action-save-draft').importance).toBe('primary');
    expect(byId(content, 'action-download-pdf').importance).toBe('secondary');
    expect(byId(content, 'action-chat').importance).toBe('decorative');
  });

  it('six FAQ items, secondary, ≥ 3 complex with plainText, ≥ 1 with terms and digits', () => {
    const faqs = content.blocks.filter((b): b is TextBlock => b.kind === 'faq');
    expect(faqs).toHaveLength(6);
    for (const f of faqs) {
      expect(f.importance).toBe('secondary');
      expect(f.group).toBeUndefined();
    }
    expect(faqs.filter((f) => f.complexity === 'complex' && f.plainText).length).toBeGreaterThanOrEqual(3);
    expect(faqs.filter((f) => (f.terms?.length ?? 0) > 0 && digitRuns(f.text).length > 0).length).toBeGreaterThanOrEqual(1);
  });

  it('images: a decorative hero and an informative documents graphic, both shipped SVGs', () => {
    const images = content.blocks.filter((b) => b.kind === 'image');
    expect(images).toHaveLength(2);
    const hero = byId(content, 'image-hero');
    expect(hero.kind === 'image' && hero.decorative).toBe(true);
    expect(hero.importance).toBe('decorative');
    const docs = byId(content, 'image-documents');
    expect(docs.kind === 'image' && docs.decorative).toBe(false);
    expect(docs.importance).toBe('primary');
    expect(docs.group).toBe('start');
    for (const img of images) {
      if (img.kind !== 'image') continue;
      expect(img.src).toMatch(/^\/img\/[a-z0-9-]+\.svg$/);
      expect(img.alt.length).toBeGreaterThan(8);
      expect(IMAGES).toContain(img.src.replace('/img/', ''));
    }
  });
});

describe('portal images', () => {
  it('ships the three SVGs, each under 6 KB, flat colours only', () => {
    for (const name of IMAGES) {
      const path = resolve(ROOT, 'public', 'img', name);
      const svg = readFileSync(path, 'utf8');
      expect(statSync(path).size, name).toBeLessThan(6 * 1024);
      expect(svg.trimStart().startsWith('<svg'), name).toBe(true);
      expect(svg, name).not.toMatch(/Gradient|filter=/);
    }
  });
});

describe('EN and ZH mirror each other', () => {
  const en = contents.en;
  const zh = contents.zh;
  const shape = (b: ContentBlock) => ({
    id: b.id,
    kind: b.kind,
    importance: b.importance,
    group: b.group,
    region: b.region,
    ...(b.kind === 'field' ? { input: b.input, required: b.required } : {}),
    ...(b.kind === 'decision' ? { optional: b.optional, preChecked: b.preChecked } : {}),
    ...(b.kind === 'image' ? { decorative: b.decorative, src: b.src } : {}),
    ...(b.kind === 'action' ? { primary: b.primary } : {}),
    ...(b.kind === 'heading' ? { level: b.level } : {}),
  });

  it('identical id sequence, kinds, importances, groups and regions (plus field, decision, image, action flags)', () => {
    expect(zh.blocks.map(shape)).toEqual(en.blocks.map(shape));
  });

  it('same step ids with localized titles; same navigation sizes', () => {
    expect(zh.meta.stepOrder.map((s) => s.id)).toEqual(en.meta.stepOrder.map((s) => s.id));
    en.meta.stepOrder.forEach((s, i) => expect(zh.meta.stepOrder[i]?.title).not.toBe(s.title));
    for (const id of ['nav-main', 'nav-utility', 'nav-related', 'nav-footer']) {
      expect(navItems(zh, id).length, id).toBe(navItems(en, id).length);
    }
  });
});

describe('content.meta', () => {
  it('exposes STEP_ORDER, contents, getContent and the demo sentence per language', () => {
    for (const lang of LANGS) {
      expect(getContent(lang)).toBe(contents[lang]);
      expect(STEP_ORDER[lang]).toEqual(contents[lang].meta.stepOrder);
      expect(STEP_ORDER[lang].map((s) => s.id)).toEqual(STEP_IDS);
    }
    expect(DEMO_EXAMPLE.en).toBe(
      'I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time.',
    );
    expect(DEMO_EXAMPLE.zh).toBe('长表单让我喘不过气。用大白话，解释我可能不懂的词，一次只让我做一个决定。');
  });
});
