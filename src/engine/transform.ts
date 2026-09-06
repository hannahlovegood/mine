// The engine (CLAUDE.md §6, docs/ENGINE.md). Pure and deterministic: same
// input, identical output; inputs are never mutated; critical blocks are never
// hidden; preChecked is never altered; the summary is derived from the changes.
//
// Rules run 1 → 9 and record their changes in that order, so the colophon
// reads top to bottom the way the page was reorganised.
import { isDefault } from './presets.ts';
import type {
  ContentBlock,
  DecisionBlock,
  Lang,
  MinePreferences,
  NavBlock,
  PageContent,
} from './schema.ts';
import { createRecorder, summarize, type Recorder } from './changes.ts';
import { reasons } from './reasons.ts';
import { buildSteps } from './steps.ts';
import type { DecisionSummary, Transformation, ViewBlock } from './types.ts';

export type {
  Change,
  ChangeType,
  DecisionSummary,
  Step,
  Summary,
  Transformation,
  ViewBlock,
  ViewState,
} from './types.ts';

interface Ctx {
  prefs: MinePreferences;
  lang: Lang;
  rec: Recorder;
}

export function transform(content: PageContent, prefs: MinePreferences): Transformation {
  const ctx: Ctx = { prefs, lang: content.meta.lang, rec: createRecorder() };

  const plan = planSetAside(content.blocks, ctx); // rules 1–3
  let view = buildView(content.blocks, plan);
  view = moveDeadlines(view, ctx); // rule 4
  view = applyReadingLevel(view, ctx); // rule 5
  explainTerms(view, ctx); // rule 6
  view = enlargeControls(view, ctx); // rule 7
  const decisions = surfaceDecisions(content.blocks, ctx); // rule 8

  const changes = ctx.rec.changes;
  if (prefs.taskMode === 'one-at-a-time') {
    const { frame, steps } = buildSteps(view, content.meta, ctx.rec); // rule 9
    return { view: frame, steps, decisions, changes, summary: summarize(changes) };
  }
  return { view, decisions, changes, summary: summarize(changes) };
}

// ---------------------------------------------------------------------------
// Rules 1–3: what is set aside (behind a stub) and what is collapsed in place
// ---------------------------------------------------------------------------

interface Plan {
  /** id of a set-aside block → id of the stub that restores it. */
  stubOf: Map<string, string>;
  /** stub id → region it stands in. */
  stubRegion: Map<string, string>;
  collapsed: Set<string>;
}

const regionOf = (b: ContentBlock): string => b.region ?? 'main';

/** Rule 3 applies only to the site menu: nav blocks of primary or critical importance. */
const isMenu = (b: ContentBlock): b is NavBlock =>
  b.kind === 'nav' && (b.importance === 'primary' || b.importance === 'critical');

function planSetAside(blocks: readonly ContentBlock[], ctx: Ctx): Plan {
  const { prefs, lang, rec } = ctx;
  const plan: Plan = { stubOf: new Map(), stubRegion: new Map(), collapsed: new Set() };
  const setAside = (b: ContentBlock, stub = `stub-${regionOf(b)}`, region = regionOf(b)) => {
    plan.stubOf.set(b.id, stub);
    if (!plan.stubRegion.has(stub)) plan.stubRegion.set(stub, region);
  };

  // Rule 1 — media. Decorative images are set aside; informative images stay.
  if (!prefs.showDecorativeMedia) {
    const images = blocks.filter((b) => b.kind === 'image' && b.decorative);
    images.forEach((b) => setAside(b));
    rec.record(
      'hidden',
      images.map((b) => b.id),
      reasons.hiddenMedia(lang, images.length),
    );
  }

  // Rule 2 — density. Critical blocks are never touched; the menu is rule 3's.
  if (prefs.density !== 'full') {
    const candidates = blocks.filter((b) => !plan.stubOf.has(b.id) && !isMenu(b));
    const hidden = candidates.filter(
      (b) =>
        b.importance === 'decorative' ||
        (prefs.density === 'minimal' && b.importance === 'secondary'),
    );
    hidden.forEach((b) => setAside(b));
    // One change per region, in the order the stubs appear on the page.
    for (const [stub, region] of stubsInPageOrder(blocks, plan)) {
      const ids = hidden.filter((b) => plan.stubOf.get(b.id) === stub).map((b) => b.id);
      rec.record('hidden', ids, reasons.hidden(lang, ids.length, region));
    }
    if (prefs.density === 'comfortable') {
      const secondary = candidates.filter((b) => b.importance === 'secondary');
      secondary.forEach((b) => plan.collapsed.add(b.id));
      rec.record(
        'collapsed',
        secondary.map((b) => b.id),
        reasons.collapsedSecondary(lang, secondary.length),
      );
    }
  }

  // Rule 3 — navigation. A critical menu may be collapsed but never hidden.
  if (prefs.navigation !== 'full') {
    for (const nav of blocks.filter(isMenu)) {
      const items = nav.items.length;
      if (prefs.navigation === 'hidden' && nav.importance !== 'critical') {
        setAside(nav, 'stub-nav', regionOf(nav));
        rec.record('hidden', [nav.id], reasons.navHidden(lang, items));
      } else {
        plan.collapsed.add(nav.id);
        rec.record('collapsed', [nav.id], reasons.navCollapsed(lang, items));
      }
    }
  }

  return plan;
}

/** Stubs in the order they will stand on the page: where each region's first set-aside block was. */
function stubsInPageOrder(blocks: readonly ContentBlock[], plan: Plan): [string, string][] {
  const seen = new Map<string, string>();
  for (const b of blocks) {
    const stub = plan.stubOf.get(b.id);
    if (stub !== undefined && !seen.has(stub)) seen.set(stub, plan.stubRegion.get(stub) ?? 'main');
  }
  return [...seen.entries()];
}

/** The page in original order, set-aside blocks replaced by one stub per region. */
function buildView(blocks: readonly ContentBlock[], plan: Plan): ViewBlock[] {
  const members = new Map<string, string[]>();
  for (const b of blocks) {
    const stub = plan.stubOf.get(b.id);
    if (stub === undefined) continue;
    const list = members.get(stub) ?? [];
    list.push(b.id);
    members.set(stub, list);
  }
  const emitted = new Set<string>();
  const view: ViewBlock[] = [];
  for (const b of blocks) {
    const stub = plan.stubOf.get(b.id);
    if (stub === undefined) {
      view.push({ ...b, state: plan.collapsed.has(b.id) ? 'collapsed' : 'shown' });
    } else if (!emitted.has(stub)) {
      emitted.add(stub);
      view.push(makeStub(stub, plan.stubRegion.get(stub) ?? 'main', members.get(stub) ?? []));
    }
  }
  return view;
}

function makeStub(id: string, region: string, stubFor: string[]): ViewBlock {
  return {
    id,
    kind: 'text',
    importance: 'secondary',
    region,
    text: '',
    complexity: 'simple',
    state: 'collapsed',
    stubFor,
  };
}

// ---------------------------------------------------------------------------
// Rule 4 — the deadline moves to just after the first level-1 heading
// ---------------------------------------------------------------------------

function moveDeadlines(view: ViewBlock[], ctx: Ctx): ViewBlock[] {
  if (isDefault(ctx.prefs)) return view;
  const deadlines = view.filter((b) => b.kind === 'deadline');
  if (deadlines.length === 0) return view;
  const rest = view.filter((b) => b.kind !== 'deadline');
  const at = rest.findIndex((b) => b.kind === 'heading' && b.level === 1) + 1; // 0 when there is no h1
  const moved = deadlines.map((b) => ({ ...b, state: 'moved' as const }));
  ctx.rec.record(
    'moved',
    moved.map((b) => b.id),
    reasons.deadlineMoved(ctx.lang),
  );
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

// ---------------------------------------------------------------------------
// Rule 5 — reading level. Legal text and decision labels are never replaced.
// ---------------------------------------------------------------------------

function applyReadingLevel(view: ViewBlock[], ctx: Ctx): ViewBlock[] {
  // A translated edition reuses the plain slots (plainText / plainHelp / plainLabel hold the translation)
  // and is recorded as 'translated' rather than 'rewritten'; the same digit invariant applies.
  if (!ctx.prefs.translateTo && ctx.prefs.readingLevel !== 'plain') return view;
  return view.map((b) => rewrite(b, ctx));
}

/** Collapsed blocks and stubs are folded away, so they are left as written. */
const isFolded = (b: ViewBlock): boolean => b.stubFor !== undefined || b.state === 'collapsed';

function rewrite(b: ViewBlock, ctx: Ctx): ViewBlock {
  if (isFolded(b)) return b;
  const { lang, rec } = ctx;
  const target = ctx.prefs.translateTo;
  const type = target ? 'translated' : 'rewritten';
  const why = {
    text: target ? reasons.translated(lang, target) : reasons.rewritten(lang),
    help: target ? reasons.fieldTranslated(lang, target) : reasons.helpRewritten(lang),
    legal: target ? reasons.besideTranslated(lang, target) : reasons.legalAnnotated(lang),
    decision: target ? reasons.besideTranslated(lang, target) : reasons.decisionAnnotated(lang),
  };
  switch (b.kind) {
    case 'legal':
      if (!b.plainText) return b;
      rec.record(type, [b.id], why.legal);
      return { ...b, state: 'annotated' };
    case 'heading':
    case 'text':
    case 'notice':
    case 'instruction':
    case 'faq':
    case 'promo':
      if (!b.plainText) return b;
      rec.record(type, [b.id], why.text);
      return { ...b, text: b.plainText, original: b.text, state: 'rewritten' };
    case 'deadline':
      if (!b.plainText) return b;
      rec.record(type, [b.id], why.text);
      // 'moved' is the more informative state; `original` still marks the rewrite.
      return {
        ...b,
        text: b.plainText,
        original: b.text,
        state: b.state === 'moved' ? 'moved' : 'rewritten',
      };
    case 'field': {
      if (!b.plainHelp) return b;
      rec.record(type, [b.id], why.help);
      const next: ViewBlock = { ...b, help: b.plainHelp, state: 'rewritten' };
      if (b.help !== undefined) next.original = b.help;
      return next;
    }
    case 'decision':
      if (!b.plainLabel) return b;
      rec.record(type, [b.id], why.decision);
      return { ...b, state: 'annotated' };
    default:
      return b;
  }
}

// ---------------------------------------------------------------------------
// Rule 6 — terms. Blocks are untouched; the UI reads `terms` from the ViewBlock.
// ---------------------------------------------------------------------------

function explainTerms(view: readonly ViewBlock[], ctx: Ctx): void {
  if (!ctx.prefs.explainTerms) return;
  for (const b of view) {
    if (isFolded(b) || !('terms' in b) || !b.terms || b.terms.length === 0) continue;
    ctx.rec.record(
      'explained',
      [b.id],
      reasons.explained(ctx.lang, b.terms.length),
      b.terms.length,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 7 — scale. No layout change; fields and actions are listed as enlarged.
// ---------------------------------------------------------------------------

function enlargeControls(view: ViewBlock[], ctx: Ctx): ViewBlock[] {
  if (ctx.prefs.fontScale < 1.35) return view;
  const targets = view.filter((b) => (b.kind === 'field' || b.kind === 'action') && !isFolded(b));
  if (targets.length === 0) return view;
  ctx.rec.record(
    'enlarged',
    targets.map((b) => b.id),
    reasons.enlarged(ctx.lang, targets.length),
  );
  const ids = new Set(targets.map((b) => b.id));
  // A block already rewritten or moved keeps that more informative state.
  return view.map((b) =>
    ids.has(b.id) && b.state === 'shown' ? { ...b, state: 'enlarged' as const } : b,
  );
}

// ---------------------------------------------------------------------------
// Rule 8 — decisions. Always summarised; optional ones surfaced on request.
// ---------------------------------------------------------------------------

function surfaceDecisions(blocks: readonly ContentBlock[], ctx: Ctx): DecisionSummary {
  const decisions = blocks
    .filter((b): b is DecisionBlock => b.kind === 'decision')
    .map((d) => ({ ...d }));
  const summary: DecisionSummary = {
    count: decisions.length,
    optional: decisions.filter((d) => d.optional),
    required: decisions.filter((d) => !d.optional),
    preChecked: decisions.filter((d) => d.preChecked),
  };
  if (ctx.prefs.surfaceDecisions) {
    const stepped = ctx.prefs.taskMode === 'one-at-a-time';
    for (const d of summary.optional) {
      ctx.rec.record('surfaced', [d.id], reasons.surfaced(ctx.lang, d.preChecked, stepped));
    }
  }
  return summary;
}
