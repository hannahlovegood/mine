// Steps (`meta.stepOrder`) and the `group` of every field/decision (EXTENSION.md §1, "Steps").
//
// Decisions the contract left open:
// - The schema requires at least one step, so a page with fewer than two fields still gets a
//   step: the same grouping rules run for one control, and a page without any control gets one
//   placeholder `s-1` titled "Part 1" / "第 1 部分" (the engine drops empty steps).
// - A heading-titled group with more than six controls is split into chunks of four titled
//   "Part n" — fourteen fields under one "Application form" heading is not a step. Fieldsets are
//   author-defined and are never split.
// - "Nearest preceding heading inside or just before the form": the last heading before the
//   control that is inside the form root or anywhere before the form root's start; for a
//   control outside the form root, simply the last heading before it.
// - Attestation decisions are left out of the sequence and put into the group of the nearest
//   primary (submit) action, which is the last group; when no group exists they are chunked.
// - Chunk titles are numbered by step position ("Part 3" is the third step).
import type { Lang } from '@engine/schema.ts';
import type { ExtractContext } from './context.ts';
import { isHidden, precedes, textOf } from './text.ts';

export interface StepControl {
  id: string;
  el: Element;
  attestation: boolean;
}

export interface StepPlan {
  stepOrder: { id: string; title: string }[];
  groupOf: Map<string, string>;
}

interface Group {
  key: Element | null;
  kind: 'fieldset' | 'heading' | 'chunk';
  title: string;
  ids: string[];
}

const CHUNK = 4;
const SPLIT_ABOVE = 6;
const TITLE_MAX = 80;

export function partTitle(n: number, lang: Lang): string {
  return lang === 'zh' ? `第 ${n} 部分` : `Part ${n}`;
}

function fieldsetOf(el: Element, ctx: ExtractContext): Element | null {
  const fs = el.parentElement?.closest('fieldset') ?? null;
  if (!fs) return null;
  if (ctx.form && fs.contains(ctx.form) && fs !== ctx.form) return null;
  return fs;
}

function headingBefore(el: Element, ctx: ExtractContext): Element | null {
  let last: Element | null = null;
  for (const h of ctx.headings) {
    if (!precedes(h, el)) break;
    last = h;
  }
  if (!last) return null;
  if (ctx.form && ctx.form.contains(el) && !ctx.form.contains(last) && !precedes(last, ctx.form)) return null;
  return last;
}

function legendTitle(fieldset: Element): string {
  const legend = Array.from(fieldset.children).find((c) => c.localName === 'legend' && !isHidden(c));
  return legend ? textOf(legend, { max: TITLE_MAX * 2 }).slice(0, TITLE_MAX) : '';
}

export function assignSteps(controls: StepControl[], ctx: ExtractContext): StepPlan {
  const groups: Group[] = [];
  const attestations: StepControl[] = [];
  const push = (key: Element | null, kind: Group['kind'], title: string, id: string): void => {
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && last.key === key && (kind !== 'chunk' || last.ids.length < CHUNK)) {
      last.ids.push(id);
      return;
    }
    groups.push({ key, kind, title, ids: [id] });
  };

  for (const c of controls) {
    if (c.attestation) {
      attestations.push(c);
      continue;
    }
    const fs = fieldsetOf(c.el, ctx);
    if (fs) {
      push(fs, 'fieldset', legendTitle(fs), c.id);
      continue;
    }
    const h = headingBefore(c.el, ctx);
    if (h) {
      push(h, 'heading', textOf(h, { max: TITLE_MAX * 2 }).slice(0, TITLE_MAX), c.id);
      continue;
    }
    push(null, 'chunk', '', c.id);
  }

  // split oversized heading groups into chunks of four
  const split: Group[] = [];
  for (const g of groups) {
    if (g.kind === 'heading' && g.ids.length > SPLIT_ABOVE) {
      for (let i = 0; i < g.ids.length; i += CHUNK) split.push({ key: null, kind: 'chunk', title: '', ids: g.ids.slice(i, i + CHUNK) });
    } else {
      split.push(g);
    }
  }

  // attestations join the last group (the submit action's group)
  if (attestations.length > 0) {
    if (split.length === 0) split.push({ key: null, kind: 'chunk', title: '', ids: [] });
    const last = split[split.length - 1]!;
    for (const a of attestations) last.ids.push(a.id);
  }

  if (split.length === 0) split.push({ key: null, kind: 'chunk', title: '', ids: [] });

  const stepOrder: { id: string; title: string }[] = [];
  const groupOf = new Map<string, string>();
  split.forEach((g, i) => {
    const id = `s-${i + 1}`;
    const title = g.title.trim() || partTitle(i + 1, ctx.lang);
    stepOrder.push({ id, title });
    for (const blockId of g.ids) groupOf.set(blockId, id);
  });
  return { stepOrder, groupOf };
}
