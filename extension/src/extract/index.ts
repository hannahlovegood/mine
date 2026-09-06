// Mine · 由我 — page extractor. Turns a live DOM into the engine's block model.
//
//   extractPage(document) → { content: PageContent, nodes, boxes, regions, main, form?, lang }
//
// Pure with respect to the page: reads only, never mutates, never throws (a broken element is
// skipped; a broken page yields an empty one). No React, no chrome.* APIs. Runs in a Chrome MV3
// content script and in happy-dom (every layout-dependent call is guarded, see text.ts).
//
// Contract: extension/docs/EXTENSION.md §1. Decisions the contract left open are listed at the
// top of each module; the ones that belong to the walk and the assembly are these:
// - Composite blocks swallow their subtree: nav (link texts only — a search box or button inside
//   a menu is not a field/action), details/summary (faq), figure/picture (image), promo boxes,
//   floating widgets with text (notice), and an `ol` in main (instruction, "1. … 2. …").
// - A question heading ("…?" / "…？") is paired with the paragraph after it as one faq block
//   whose box is their shared wrapper when they have one of their own, else the heading.
// - `label` and `legend` elements are never blocks of their own; help texts and labels used by a
//   control are consumed (see fields.ts).
// - Heading levels: h1 → 1, h2 → 2, else 3; when main has no h1, its heading levels are ranked
//   (lowest → 1, next → 2, rest → 3) so a page whose title is an h2 still has a level-1 heading
//   for the engine's deadline placement. Headings outside main are `secondary`.
// - The site menu is the biggest nav in the header root, else the first nav with ≥ 5 items above
//   the title (regions.ts); it is `primary` with `region: 'header'`, every other nav secondary.
// - Floating widgets (chat, cookie banner, back-to-top) carry no region: they float over the
//   page rather than belonging to a part of it.
// - Actions inside the form root, or directly after it until the first non-action block, take
//   the last step; primary actions are `critical` even when they float (a sticky submit bar).
// - `lang`: opts.lang → <html lang> (zh* → zh, other → en) → when there is no lang attribute at
//   all, the text is sniffed for CJK (title + first paragraphs) → en.
// - `meta.title`: document.title → first h1 → first heading → "Untitled" / "无标题".
// - Every block is validated with ContentBlockSchema and dropped on failure; ids are re-numbered
//   so `b-n` stays dense and in document order. `regions` holds the first root per name.
import {
  ContentBlockSchema,
  PageContentSchema,
  type ActionBlock,
  type ContentBlock,
  type DeadlineBlock,
  type DecisionBlock,
  type FieldBlock,
  type ImageBlock,
  type Lang,
  type NavBlock,
  type PageContent,
  type TextBlock,
} from '@engine/schema.ts';
import { foldWrappers } from './boxes.ts';
import type { ControlInfo, ExtractContext, Region } from './context.ts';
import { collectControls, isHelpEl } from './fields.ts';
import {
  classifyText,
  complexityOf,
  floatingContainerOf,
  hasDecorativeImageClass,
  headingImportance,
  imageSrc,
  isActionEl,
  isBlockImage,
  isFloatingWidget,
  isHeading,
  isLeafCandidate,
  isNavLike,
  isPrimaryAction,
  isPromoContainer,
  isTextLeaf,
  legalHits,
  navItems,
  PROMO_TEXT_CAP,
  rawHeadingLevel,
} from './kinds.ts';
import { findRegions, hiddenDeep, regionOf } from './regions.ts';
import { assignSteps } from './steps.ts';
import { attr, containsControl, isCjk, isFormControl, isHidden, precedes, textLength, textOf } from './text.ts';

export type { Region } from './context.ts';

export interface ExtractOptions {
  lang?: Lang;
  maxBlocks?: number;
}

export interface ExtractedPage {
  /** Validates against PageContentSchema (bad blocks are dropped, never thrown). */
  content: PageContent;
  /** block id → the element that carries the block (p, h2, input, button, img, nav…). */
  nodes: Map<string, Element>;
  /** block id → the element to hide/show for that block. */
  boxes: Map<string, Element>;
  /** region name → its root element ('header' | 'utility' | 'sidebar' | 'footer' | 'main'). */
  regions: Map<string, Element>;
  /** Main content root (deadline echo + stubs are inserted here). */
  main: Element;
  /** The form root when fields were found (the stepper is inserted before its first box). */
  form?: Element;
  lang: Lang;
}

const DEFAULT_MAX_BLOCKS = 400;

/** A block before ids/groups are final. */
interface Draft {
  block: ContentBlock;
  node: Element;
  box: Element;
  rawLevel?: number;
  attestation?: boolean;
}

export function extractPage(doc: Document, opts: ExtractOptions = {}): ExtractedPage {
  try {
    return extract(doc, opts);
  } catch {
    return emptyPage(doc, opts);
  }
}

function emptyPage(doc: Document, opts: ExtractOptions): ExtractedPage {
  const lang = opts.lang ?? 'en';
  const body = safeBody(doc);
  return {
    content: { meta: { title: lang === 'zh' ? '无标题' : 'Untitled', lang, stepOrder: [{ id: 's-1', title: lang === 'zh' ? '第 1 部分' : 'Part 1' }] }, blocks: [] },
    nodes: new Map(),
    boxes: new Map(),
    regions: new Map(body ? [['main', body]] : []),
    main: body ?? (doc.documentElement as Element),
    lang,
  };
}

function safeBody(doc: Document): Element | null {
  try {
    return (doc.body as Element | null) ?? doc.documentElement ?? null;
  } catch {
    return null;
  }
}

function detectLang(doc: Document, body: Element, opts: ExtractOptions): Lang {
  if (opts.lang) return opts.lang;
  const html = doc.documentElement;
  const declared = (html && attr(html, 'lang')) || attr(body, 'lang') || attr(doc.querySelector('[lang]') ?? body, 'lang');
  if (declared) return /^zh/i.test(declared.trim()) ? 'zh' : 'en';
  const sample = `${doc.title ?? ''} ${textOf(body, { max: 600 })}`;
  return isCjk(sample) ? 'zh' : 'en';
}

function extract(doc: Document, opts: ExtractOptions): ExtractedPage {
  const body = safeBody(doc);
  if (!body) return emptyPage(doc, opts);
  const lang = detectLang(doc, body, opts);
  const maxBlocks = Math.max(0, opts.maxBlocks ?? DEFAULT_MAX_BLOCKS);
  const regionInfo = findRegions(doc, body);
  const ctx: ExtractContext = {
    doc,
    body,
    lang,
    maxBlocks,
    roots: regionInfo.roots,
    main: regionInfo.main,
    siteMenu: regionInfo.siteMenu,
    anchor: regionInfo.anchor,
    form: null,
    controls: new Map(),
    memberOf: new Map(),
    consumed: new Set(),
    headings: [],
  };
  collectControls(ctx);
  const hiddenCache = new WeakMap<Element, boolean>();
  // headings that may title a step: visible, and in the main region (a sidebar's "Related links" never is)
  ctx.headings = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')).filter(
    (h) => !hiddenDeep(h, hiddenCache, body) && regionOf(h, ctx) === 'main',
  );
  for (const legend of Array.from(body.querySelectorAll('fieldset > legend'))) {
    if (legend.parentElement && containsControl(legend.parentElement)) ctx.consumed.add(legend);
  }

  const drafts: Draft[] = [];
  const walker = new Walker(ctx, drafts);
  walker.walk(body);

  finishNavs(drafts, ctx);
  finishHeadings(drafts, ctx);
  const stepOrder = finishSteps(drafts, ctx);

  // validate block by block, re-number, build maps
  const blocks: ContentBlock[] = [];
  const nodes = new Map<string, Element>();
  const boxes = new Map<string, Element>();
  for (const d of drafts) {
    const id = `b-${blocks.length + 1}`;
    const candidate = { ...d.block, id } as ContentBlock;
    const result = ContentBlockSchema.safeParse(candidate);
    if (!result.success) continue;
    blocks.push(result.data as ContentBlock);
    nodes.set(id, d.node);
    boxes.set(id, d.box);
  }
  const content: PageContent = { meta: { title: pageTitle(doc, body, drafts, lang), lang, stepOrder }, blocks };
  const check = PageContentSchema.safeParse(content);
  const page: ExtractedPage = {
    content: check.success ? (check.data as PageContent) : content,
    nodes,
    boxes,
    regions: regionInfo.byName,
    main: regionInfo.main,
    lang,
  };
  if (ctx.form && ctx.controls.size > 0) page.form = ctx.form;
  return page;
}

function pageTitle(doc: Document, body: Element, drafts: Draft[], lang: Lang): string {
  let title = '';
  try {
    title = (doc.title ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    title = '';
  }
  if (title) return title.slice(0, 300);
  const h1 = Array.from(body.querySelectorAll('h1')).map((h) => textOf(h, { max: 300 })).find(Boolean);
  if (h1) return h1;
  const heading = drafts.find((d) => d.block.kind === 'heading');
  if (heading && 'text' in heading.block) return heading.block.text;
  return lang === 'zh' ? '无标题' : 'Untitled';
}

// --------------------------------------------------------------------------- the walk

class Walker {
  constructor(
    private readonly ctx: ExtractContext,
    private readonly drafts: Draft[],
  ) {}

  private full(): boolean {
    return this.drafts.length >= this.ctx.maxBlocks;
  }

  private region(el: Element): Region {
    return regionOf(el, this.ctx);
  }

  private regionField(el: Element): { region?: string } {
    const r = this.region(el);
    return r === 'main' ? {} : { region: r };
  }

  private add(draft: Draft): void {
    if (!this.full()) this.drafts.push(draft);
  }

  walk(el: Element): void {
    if (this.full()) return;
    try {
      if (isHidden(el)) return;
      // a consumed element (label, help…) is never a block, but a wrapping label still holds its control
      if (this.ctx.consumed.has(el) && !containsControl(el)) return;
      if (this.ctx.memberOf.has(el) && this.ctx.memberOf.get(el) !== el) return;
      if (this.visit(el)) return;
    } catch {
      return;
    }
    for (const child of Array.from(el.children)) {
      if (this.full()) return;
      this.walk(child);
    }
  }

  /** Handles `el` as a block (composite or leaf). Returns true when the subtree is done. */
  private visit(el: Element): boolean {
    const tag = el.localName;
    const info = this.ctx.controls.get(el);
    if (info) {
      this.control(info);
      return true;
    }
    if (isActionEl(el)) {
      this.action(el);
      return true;
    }
    if (isFormControl(el)) return true;
    if (tag === 'label' || tag === 'legend') return containsControl(el) ? false : true;
    if (isNavLike(el) && this.nav(el)) return true;
    if (isHeading(el)) {
      this.heading(el);
      return true;
    }
    if (tag === 'details' && this.details(el)) return true;
    if ((tag === 'figure' || tag === 'picture') && this.figure(el)) return true;
    if (tag === 'img') {
      this.image(el);
      return true;
    }
    if (isFloatingWidget(el, this.ctx) && this.floating(el)) return true;
    if (isPromoContainer(el) && this.promo(el)) return true;
    if (tag === 'ol' && this.region(el) === 'main' && this.list(el)) return true;
    if (isLeafCandidate(el)) {
      const text = textOf(el);
      if (isTextLeaf(el, text)) {
        this.textLeaf(el, text);
        return true;
      }
    }
    return false;
  }

  private textBlock(el: Element, text: string, box: Element = foldWrappers(el, this.ctx)): void {
    const region = this.region(el);
    const cls = classifyText(el, text, region, this.ctx);
    if (cls.kind === 'deadline' && cls.date) {
      const block: DeadlineBlock = { id: '', kind: 'deadline', importance: 'critical', text, date: cls.date, ...this.regionField(el) };
      this.add({ block, node: el, box });
      return;
    }
    if (cls.kind === 'deadline') return;
    const floating = cls.kind === 'notice' && cls.importance === 'decorative';
    const block: TextBlock = {
      id: '',
      kind: cls.kind,
      importance: cls.importance,
      text,
      complexity: complexityOf(text, this.ctx.lang, cls.legalHits),
      ...(floating ? {} : this.regionField(el)),
    };
    this.add({ block, node: el, box });
  }

  private textLeaf(el: Element, text: string): void {
    if (text.length < 3) return;
    this.textBlock(el, text);
  }

  private control(info: ControlInfo): void {
    const el = info.el;
    if (info.kind === 'field') {
      const block: FieldBlock = {
        id: '',
        kind: 'field',
        importance: info.required ? 'critical' : 'primary',
        label: info.label,
        input: info.inputType,
        required: info.required,
        ...this.regionField(el),
      };
      if (info.help) block.help = info.help;
      if (info.options) block.options = info.options;
      this.add({ block, node: el, box: info.box });
      return;
    }
    const optional = !info.required && !info.attestation;
    const block: DecisionBlock = {
      id: '',
      kind: 'decision',
      importance: optional ? 'primary' : 'critical',
      label: info.label,
      optional,
      preChecked: info.checked,
      ...this.regionField(el),
    };
    if (info.help) block.consequence = info.help;
    this.add({ block, node: el, box: info.box, attestation: info.attestation });
  }

  private action(el: Element): void {
    const label = actionLabel(el);
    if (!label) return;
    const primary = isPrimaryAction(el, label);
    const floating = Boolean(floatingContainerOf(el, this.ctx));
    const block: ActionBlock = {
      id: '',
      kind: 'action',
      importance: primary ? 'critical' : floating ? 'decorative' : 'primary',
      label,
      primary,
      ...(floating ? {} : this.regionField(el)),
    };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx) });
  }

  private nav(el: Element): boolean {
    const items = navItems(el);
    if (items.length === 0) return false;
    const block: NavBlock = { id: '', kind: 'nav', importance: 'secondary', items, ...this.regionField(el) };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx) });
    return true;
  }

  private heading(el: Element): void {
    const text = textOf(el);
    if (text.length < 3) return;
    const region = this.region(el);
    if (/[?？]$/.test(text)) {
      const answer = this.answerAfter(el);
      if (answer) {
        const answerText = textOf(answer);
        this.ctx.consumed.add(answer);
        const wrapper = el.parentElement;
        const shared = wrapper && wrapper === answer.parentElement && visibleChildren(wrapper).length === 2 && !this.ctx.roots.has(wrapper) && wrapper !== this.ctx.main ? foldWrappers(wrapper, this.ctx) : el;
        const faqText = `${text} — ${answerText}`.slice(0, 2000);
        const block: TextBlock = { id: '', kind: 'faq', importance: 'secondary', text: faqText, complexity: complexityOf(faqText, this.ctx.lang, legalHits(faqText)), ...this.regionField(el) };
        this.add({ block, node: el, box: shared });
        return;
      }
    }
    const block: TextBlock = {
      id: '',
      kind: 'heading',
      importance: headingImportance(region),
      text,
      level: 3,
      complexity: complexityOf(text, this.ctx.lang, 0),
      ...this.regionField(el),
    };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx), rawLevel: rawHeadingLevel(el) });
  }

  private answerAfter(heading: Element): Element | null {
    let next = heading.nextElementSibling;
    while (next && isHidden(next)) next = next.nextElementSibling;
    if (!next || isHeading(next) || containsControl(next) || next.querySelector('h1,h2,h3,h4,h5,h6')) return null;
    if (!['p', 'div', 'section', 'dd', 'blockquote'].includes(next.localName)) return null;
    const text = textOf(next);
    return text.length >= 3 && isTextLeaf(next, text) ? next : null;
  }

  private details(el: Element): boolean {
    if (containsControl(el)) return false;
    const summary = Array.from(el.children).find((c) => c.localName === 'summary') ?? null;
    const q = summary ? textOf(summary) : '';
    const a = textOf(el, { exclude: (e) => e === summary });
    const text = (q && a ? `${q} — ${a}` : q || a).slice(0, 2000);
    if (text.length < 3) return true;
    const block: TextBlock = { id: '', kind: 'faq', importance: 'secondary', text, complexity: complexityOf(text, this.ctx.lang, legalHits(text)), ...this.regionField(el) };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx) });
    return true;
  }

  private figure(el: Element): boolean {
    const img = Array.from(el.querySelectorAll('img')).find((i) => !isHidden(i) && imageSrc(i));
    if (!img) return false;
    const caption = Array.from(el.querySelectorAll('figcaption')).map((c) => textOf(c)).find(Boolean) ?? '';
    this.imageBlock(img, el, foldWrappers(el, this.ctx), caption);
    return true;
  }

  private image(img: Element): void {
    if (!isBlockImage(img)) return;
    this.imageBlock(img, img, foldWrappers(img, this.ctx), '');
  }

  private imageBlock(img: Element, host: Element, box: Element, caption: string): void {
    const src = imageSrc(img);
    if (!src) return;
    const alt = attr(img, 'alt').replace(/\s+/g, ' ').trim() || caption;
    const region = this.region(host);
    const floating = Boolean(floatingContainerOf(host, this.ctx));
    const decorative = !alt || region !== 'main' || floating || hasDecorativeImageClass(img, this.ctx) || (host !== img && hasDecorativeImageClass(host, this.ctx));
    const block: ImageBlock = {
      id: '',
      kind: 'image',
      importance: decorative ? 'decorative' : 'primary',
      src,
      alt,
      decorative,
      ...(floating ? {} : this.regionField(host)),
    };
    this.add({ block, node: img, box });
  }

  private floating(el: Element): boolean {
    const text = textOf(el, { exclude: isActionEl });
    if (text.length < 20) return false;
    const full = textOf(el);
    const block: TextBlock = { id: '', kind: 'notice', importance: 'decorative', text: full, complexity: complexityOf(full, this.ctx.lang, legalHits(full)) };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx) });
    return true;
  }

  private promo(el: Element): boolean {
    if (containsControl(el) || textLength(el) > PROMO_TEXT_CAP || el.querySelector('h1,h2') || el === this.ctx.main || this.ctx.roots.has(el)) return false;
    const text = textOf(el);
    if (text.length < 3) return false;
    const block: TextBlock = { id: '', kind: 'promo', importance: 'decorative', text, complexity: complexityOf(text, this.ctx.lang, 0), ...this.regionField(el) };
    this.add({ block, node: el, box: foldWrappers(el, this.ctx) });
    return true;
  }

  private list(ol: Element): boolean {
    if (containsControl(ol) || ol.querySelector('h1,h2,h3,h4,h5,h6,figure,table')) return false;
    for (const img of Array.from(ol.querySelectorAll('img'))) if (!isHidden(img) && isBlockImage(img)) return false;
    const items = Array.from(ol.children).filter((c) => c.localName === 'li' && !isHidden(c)).map((li) => textOf(li)).filter(Boolean);
    if (items.length === 0) return false;
    const text = items.map((t, i) => `${i + 1}. ${t}`).join(' ').slice(0, 2000);
    const block: TextBlock = { id: '', kind: 'instruction', importance: 'primary', text, complexity: complexityOf(text, this.ctx.lang, legalHits(text)), ...this.regionField(ol) };
    this.add({ block, node: ol, box: foldWrappers(ol, this.ctx) });
    return true;
  }
}

function visibleChildren(el: Element): Element[] {
  return Array.from(el.children).filter((c) => !isHidden(c));
}

function actionLabel(el: Element): string {
  const tag = el.localName;
  if (tag === 'input') {
    const type = attr(el, 'type').toLowerCase();
    const value = attr(el, 'value').trim();
    if (value) return value.slice(0, 200);
    if (type === 'image') return attr(el, 'alt').trim() || attr(el, 'title').trim() || 'Submit';
    return attr(el, 'aria-label').trim() || attr(el, 'title').trim() || (type === 'reset' ? 'Reset' : type === 'submit' ? 'Submit' : '');
  }
  const text = textOf(el, { exclude: isHelpEl, max: 200 });
  if (text) return text;
  const img = el.querySelector('img');
  return attr(el, 'aria-label').trim() || attr(el, 'title').trim() || (img ? attr(img, 'alt').trim() : '') || attr(el, 'value').trim();
}

// --------------------------------------------------------------------------- post-passes

function finishNavs(drafts: Draft[], ctx: ExtractContext): void {
  const navs = drafts.filter((d) => d.block.kind === 'nav');
  let menu = ctx.siteMenu ? navs.find((d) => d.node === ctx.siteMenu || (ctx.siteMenu!.contains(d.node) && d.node.contains(ctx.siteMenu!))) : undefined;
  if (!menu) {
    menu = navs.find((d) => {
      const b = d.block as NavBlock;
      const region = b.region ?? 'main';
      return b.items.length >= 5 && (region === 'header' || region === 'main') && (!ctx.anchor || precedes(d.node, ctx.anchor));
    });
  }
  if (menu) {
    menu.block.importance = 'primary';
    menu.block.region = 'header';
  }
}

function finishHeadings(drafts: Draft[], ctx: ExtractContext): void {
  const headings = drafts.filter((d) => d.block.kind === 'heading' && d.rawLevel !== undefined);
  const inMain = headings.filter((d) => regionOf(d.node, ctx) === 'main');
  const hasH1 = inMain.some((d) => d.rawLevel === 1);
  const ranks = Array.from(new Set(inMain.map((d) => d.rawLevel!))).sort((a, b) => a - b);
  for (const d of headings) {
    const raw = d.rawLevel!;
    let level: 1 | 2 | 3;
    if (!hasH1 && inMain.includes(d)) {
      const rank = ranks.indexOf(raw);
      level = rank === 0 ? 1 : rank === 1 ? 2 : 3;
    } else {
      level = raw === 1 ? 1 : raw === 2 ? 2 : 3;
    }
    (d.block as TextBlock).level = level;
  }
}

function finishSteps(drafts: Draft[], ctx: ExtractContext): { id: string; title: string }[] {
  drafts.forEach((d, i) => {
    d.block.id = `b-${i + 1}`;
  });
  const controls = drafts
    .filter((d) => d.block.kind === 'field' || d.block.kind === 'decision')
    .map((d) => ({ id: d.block.id, el: d.node, attestation: Boolean(d.attestation) }));
  const plan = assignSteps(controls, ctx);
  for (const d of drafts) {
    const group = plan.groupOf.get(d.block.id);
    if (group) d.block.group = group;
  }
  // actions inside the form root, or right after it, take the last step
  const last = plan.stepOrder[plan.stepOrder.length - 1];
  if (last && ctx.form && controls.length > 0) {
    const form = ctx.form;
    let lastInside = -1;
    drafts.forEach((d, i) => {
      if (form.contains(d.node)) lastInside = i;
    });
    drafts.forEach((d, i) => {
      if (d.block.kind !== 'action') return;
      if (form.contains(d.node)) {
        d.block.group = last.id;
        return;
      }
      if (i > lastInside && lastInside >= 0) {
        for (let j = lastInside + 1; j < i; j++) if (drafts[j]!.block.kind !== 'action') return;
        d.block.group = last.id;
      }
    });
  }
  return plan.stepOrder;
}
