// The applier: Transformation → reversible DOM mutations + injected Mine widgets.
// The real form stays the real form. We only hide, fold, echo, step, annotate and enlarge;
// undo() puts every attribute, node and text back.
import type { Lang } from '@engine/schema.ts';
import type { Transformation, ViewBlock } from '@engine/transform.ts';
import { t, tn } from '@app/copy.ts';
import { formatDate } from '@app/ui/format.ts';
import { blockName } from '@app/ui/blockNames.ts';
import type { ExtractedPage } from '../extract/index.ts';
import { DOCUMENT_CSS } from './css.ts';
import { callout, note, plainAside, stepper, stub, tagline, terms as termsWidget, type StepperHandle, type Widget } from './widgets.ts';

export interface Applied {
  undo(): void;
  /** Restore (or set aside again) set-aside blocks by id. */
  restore(ids: string[], on: boolean): void;
  restored(): Set<string>;
  setStep(i: number): void;
  stepIndex(): number;
  stepCount: number;
  compare(on: boolean): void;
}

const HIDDEN = 'data-mine-hidden';
const STEP_HIDDEN = 'data-mine-step-hidden';
const FOLDED = 'data-mine-folded';
const MARK = 'data-mine-mark';

function ensureDocumentCss(): void {
  if (document.getElementById('mine-document-css')) return;
  const style = document.createElement('style');
  style.id = 'mine-document-css';
  style.textContent = DOCUMENT_CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

/** True when a block's node has no links, controls or images: its text can be swapped safely. */
function plainTextSafe(node: Element): boolean {
  return !node.querySelector('a, button, input, select, textarea, img, svg, video, iframe, label');
}

export function apply(page: ExtractedPage, tr: Transformation, prefs: { fontScale: number; contrast: string }, lang: Lang): Applied {
  ensureDocumentCss();
  const injected: Widget[] = [];
  const attrs: { el: Element; attr: string }[] = [];
  const texts: { el: Element; html: string }[] = [];
  const restoredIds = new Set<string>();
  const html = document.documentElement;

  const byId = new Map<string, ViewBlock>();
  for (const b of tr.view) byId.set(b.id, b);
  for (const s of tr.steps ?? []) for (const b of s.blocks) byId.set(b.id, b);
  const box = (id: string) => page.boxes.get(id);
  const node = (id: string) => page.nodes.get(id);
  const regionOf = (id: string) => page.content.blocks.find((b) => b.id === id)?.region ?? 'main';
  const setAttr = (el: Element | undefined, attr: string) => {
    if (!el || el.hasAttribute(attr)) return;
    el.setAttribute(attr, '');
    attrs.push({ el, attr });
  };
  const unsetAttr = (el: Element | undefined, attr: string) => el?.removeAttribute(attr);
  const insertBefore = (w: Widget, ref: Element | undefined) => {
    if (!ref || !ref.parentNode) return;
    ref.parentNode.insertBefore(w, ref);
    injected.push(w);
  };
  const insertAfter = (w: Widget, ref: Element | undefined) => {
    if (!ref || !ref.parentNode) return;
    ref.insertAdjacentElement('afterend', w);
    injected.push(w);
  };
  const mark = (id: string) => setAttr(box(id) ?? node(id), MARK);
  const lookup = (id: string) => page.content.blocks.find((b) => b.id === id);
  const namesOf = (ids: string[]) =>
    ids
      .map((id) => lookup(id))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .slice(0, 3)
      .map((b) => blockName(b, lang))
      .join(lang === 'zh' ? '、' : ', ');

  // --- 1. hidden + collapsed secondary: hide boxes, one stub per region (whole region root if all hidden) ---
  const hiddenIds = tr.changes.filter((c) => c.type === 'hidden').flatMap((c) => c.blockIds);
  const collapsedSecondary = tr.view.filter((b) => b.state === 'collapsed' && b.kind !== 'nav' && b.kind !== 'action').map((b) => b.id);
  const foldGroups = new Map<string, string[]>();
  for (const id of [...hiddenIds, ...collapsedSecondary]) {
    const r = regionOf(id);
    if (!foldGroups.has(r)) foldGroups.set(r, []);
    foldGroups.get(r)!.push(id);
  }
  const stubFor = new Map<string, Widget>();
  for (const [region, ids] of foldGroups) {
    for (const id of ids) setAttr(box(id), HIDDEN);
    const root = region !== 'main' ? page.regions.get(region) : undefined;
    const allInRegion = page.content.blocks.filter((b) => (b.region ?? 'main') === region).map((b) => b.id);
    const wholeRegion = !!root && root !== page.main && allInRegion.every((id) => ids.includes(id));
    if (wholeRegion) setAttr(root, HIDDEN);
    const anchor = wholeRegion ? root : (ids.map((id) => box(id)).find((b) => !!b) as Element | undefined);
    const collapsedOnly = ids.every((id) => collapsedSecondary.includes(id));
    const w = stub({
      label: collapsedOnly ? tn(lang, 'colophon.frag.collapsed', ids.length) : tn(lang, 'stub.count', ids.length),
      names: namesOf(ids),
      showLabel: t(lang, 'colophon.restore'),
      hideLabel: t(lang, 'stub.hide'),
      open: false,
      onToggle: (open) => api.restore(ids, open),
    });
    if (anchor) insertBefore(w, anchor);
    for (const id of ids) stubFor.set(id, w);
  }

  // --- 2. collapsed nav: hide, "Menu (n) · Show" in its place ---
  for (const b of tr.view.filter((x) => x.kind === 'nav' && x.state === 'collapsed')) {
    const el = box(b.id);
    setAttr(el, HIDDEN);
    const n = b.kind === 'nav' ? b.items.length : 0;
    const w = stub({
      label: t(lang, 'stub.nav', { n }),
      showLabel: t(lang, 'colophon.restore'),
      hideLabel: t(lang, 'stub.hide'),
      open: false,
      onToggle: (open) => api.restore([b.id], open),
    });
    insertBefore(w, el);
    stubFor.set(b.id, w);
  }

  // --- 3. moved deadline: echo at the top of main; the original stays and is marked ---
  const movedIds = tr.changes.filter((c) => c.type === 'moved').flatMap((c) => c.blockIds);
  for (const id of movedIds) {
    const b = byId.get(id);
    if (!b || b.kind !== 'deadline') continue;
    const original = node(id);
    const w = callout({
      label: t(lang, 'deadline.label'),
      date: formatDate(b.date, lang),
      moved: t(lang, 'deadline.moved'),
      text: b.text,
      goto: lang === 'zh' ? '查看原文位置' : 'Go to it on the page',
      onGoto: () => {
        original?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (original instanceof HTMLElement) {
          const prev = original.style.outline;
          original.style.outline = '3px solid #2743d9';
          setTimeout(() => (original.style.outline = prev), 1600);
        }
      },
    });
    const title = tr.view.find((x) => x.kind === 'heading' && x.level === 1 && (x.region ?? 'main') === 'main');
    const titleBox = title ? box(title.id) : undefined;
    if (titleBox && page.main.contains(titleBox)) insertAfter(w, titleBox);
    else {
      const first = page.main.firstElementChild ?? undefined;
      if (first) insertBefore(w, first);
      else {
        page.main.appendChild(w);
        injected.push(w);
      }
    }
    mark(id);
  }

  // --- 4. rewritten / annotated: swap text when safe, else show the plain version beside ---
  for (const b of [...tr.view, ...(tr.steps ?? []).flatMap((s) => s.blocks)]) {
    if (b.state !== 'rewritten' && b.state !== 'annotated') continue;
    const el = node(b.id);
    if (!el) continue;
    const plain = 'plainText' in b ? b.plainText : b.kind === 'field' ? b.plainHelp : b.kind === 'decision' ? b.plainLabel : undefined;
    const rewrittenText = b.state === 'rewritten' && 'text' in b ? b.text : undefined;
    if (b.state === 'rewritten' && rewrittenText && b.original !== undefined && plainTextSafe(el) && el instanceof HTMLElement) {
      texts.push({ el, html: el.innerHTML });
      const originalHtml = el.innerHTML;
      el.setAttribute('data-mine-rewritten', '');
      attrs.push({ el, attr: 'data-mine-rewritten' });
      el.innerHTML = '';
      const plainSpan = document.createElement('span');
      plainSpan.setAttribute('data-mine-plain-text', '');
      plainSpan.textContent = rewrittenText;
      const origSpan = document.createElement('span');
      origSpan.setAttribute('data-mine-original-text', '');
      origSpan.innerHTML = originalHtml;
      el.append(plainSpan, origSpan);
      const tag = tagline(t(lang, 'rewritten.tag'), t(lang, 'rewritten.show'), t(lang, 'rewritten.hide'), (show) => {
        origSpan.style.display = show ? 'block' : '';
        origSpan.style.marginTop = show ? '6px' : '';
        origSpan.style.color = show ? '#55534f' : '';
      });
      insertBefore(tag, el);
    } else if (plain) {
      insertAfter(plainAside(t(lang, 'legal.summary'), plain), box(b.id) ?? el);
    }
    mark(b.id);
  }

  // --- 5. explained: terms under the passage ---
  for (const c of tr.changes.filter((x) => x.type === 'explained')) {
    for (const id of c.blockIds) {
      const b = byId.get(id);
      if (!b || !('terms' in b) || !b.terms?.length) continue;
      insertAfter(termsWidget(b.terms, lang === 'zh' ? '：' : ' — '), box(id) ?? node(id));
      mark(id);
    }
  }

  // --- 6. surfaced decisions: notes after the box; the checkbox is never touched ---
  for (const c of tr.changes.filter((x) => x.type === 'surfaced')) {
    for (const id of c.blockIds) {
      const b = byId.get(id);
      if (!b || b.kind !== 'decision') continue;
      const lines = [{ text: b.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required') }];
      if (b.preChecked) lines.push({ text: t(lang, 'decisions.prechecked'), pencil: true } as { text: string; pencil?: boolean });
      if (b.consequence) lines.push({ text: `${t(lang, 'decisions.consequence')}${lang === 'zh' ? '：' : ': '}${b.consequence}` });
      insertAfter(note(lines), box(id));
      mark(id);
    }
  }

  // --- 7. scale and contrast ---
  const body = document.body;
  const prevZoom = body.style.zoom;
  if (prefs.fontScale !== 1) {
    body.style.zoom = String(prefs.fontScale);
    html.setAttribute('data-mine-zoom', String(prefs.fontScale));
  }
  if (prefs.fontScale >= 1.35) setAttr(html, 'data-mine-large');
  if (prefs.contrast === 'high') setAttr(html, 'data-mine-contrast');

  // --- 8. steps: only the current step's boxes are visible; a stepper sits at the form ---
  let stepHandle: StepperHandle | null = null;
  let current = 0;
  const steps = tr.steps ?? [];
  const stepBoxes = steps.map((s) => s.blocks.map((b) => box(b.id)).filter((x): x is Element => !!x));
  const otherOptionIds = steps.flatMap((s) => s.blocks.filter((b) => b.kind === 'action' && b.state === 'collapsed').map((b) => b.id));
  const showStep = (i: number) => {
    current = i;
    stepBoxes.forEach((boxes, k) => boxes.forEach((el) => (k === i ? unsetAttr(el, STEP_HIDDEN) : setAttr(el, STEP_HIDDEN))));
    const first = steps[i]?.blocks.find((b) => b.kind === 'field' || b.kind === 'decision');
    const control = first ? node(first.id) : undefined;
    if (control instanceof HTMLElement && control.getClientRects().length > 0) control.focus({ preventScroll: true });
  };
  if (steps.length > 0) {
    // Other options fold under a stub in the last step.
    if (otherOptionIds.length > 0) {
      for (const id of otherOptionIds) setAttr(box(id), FOLDED);
      const anchor = box(otherOptionIds[0]!);
      const w = stub({
        label: t(lang, 'step.other'),
        showLabel: t(lang, 'colophon.restore'),
        hideLabel: t(lang, 'stub.hide'),
        open: false,
        onToggle: (open) => otherOptionIds.forEach((id) => (open ? unsetAttr(box(id), FOLDED) : setAttr(box(id), FOLDED))),
      });
      insertBefore(w, anchor);
    }
    stepHandle = stepper({
      count: steps.length,
      titles: steps.map((s) => s.title),
      choice: steps.map((s) => !!s.choice),
      progress: (i, n) => t(lang, 'step.progress', { i, n }),
      choiceLabel: t(lang, 'step.choice'),
      back: t(lang, 'step.back'),
      next: t(lang, 'step.next'),
      onChange: showStep,
    });
    const anchor = stepBoxes.find((b) => b.length > 0)?.[0] ?? (page.form ? page.form.firstElementChild ?? undefined : undefined);
    const stepAnchor = page.form && page.form.contains(anchor ?? null) && page.form.firstElementChild ? page.form.firstElementChild : anchor;
    if (stepAnchor) insertBefore(stepHandle.host, stepAnchor);
    showStep(0);
  }

  const api: Applied = {
    stepCount: steps.length,
    stepIndex: () => current,
    setStep: (i) => stepHandle?.set(i),
    restored: () => new Set(restoredIds),
    restore(ids, on) {
      for (const id of ids) {
        const el = box(id);
        if (on) {
          unsetAttr(el, HIDDEN);
          restoredIds.add(id);
          // If the region root was hidden, show it again while anything inside is restored.
          const root = page.regions.get(regionOf(id));
          if (root) unsetAttr(root, HIDDEN);
        } else {
          setAttr(el, HIDDEN);
          restoredIds.delete(id);
        }
      }
    },
    compare(on) {
      if (on) {
        html.setAttribute('data-mine-compare', '');
        body.style.zoom = prevZoom;
      } else {
        html.removeAttribute('data-mine-compare');
        if (prefs.fontScale !== 1) body.style.zoom = String(prefs.fontScale);
      }
    },
    undo() {
      for (const w of injected) w.remove();
      for (const { el, attr } of attrs) el.removeAttribute(attr);
      for (const { el, html: h } of texts) el.innerHTML = h;
      document.querySelectorAll(`[${STEP_HIDDEN}], [${FOLDED}], [${HIDDEN}], [${MARK}]`).forEach((el) => {
        el.removeAttribute(STEP_HIDDEN);
        el.removeAttribute(FOLDED);
        el.removeAttribute(HIDDEN);
        el.removeAttribute(MARK);
      });
      body.style.zoom = prevZoom;
      html.removeAttribute('data-mine-zoom');
      html.removeAttribute('data-mine-compare');
      html.removeAttribute('data-mine-large');
      html.removeAttribute('data-mine-contrast');
    },
  };
  return api;
}
