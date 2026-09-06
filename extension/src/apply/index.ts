// The applier: Transformation → reversible DOM mutations + injected Mine widgets.
// The real form stays the real form. We only hide, fold, echo, step, annotate and enlarge;
// undo() puts every attribute, node and text back.
//
// Safety rules that go beyond the engine (the engine works on blocks, the DOM has more in it):
// - A box is hidden, step-hidden or folded only when it holds no node of a block that must stay
//   visible: any action, field, decision or deadline, anything critical, and a submit control the
//   extractor did not turn into a block. Otherwise only the control and its label are hidden, or
//   nothing at all — the change is still listed, the stub only counts what it really hid.
// - Live regions ([role=alert], [role=status], [aria-live]) are never hidden.
// - A region root is hidden as a whole only when every block in it was hidden and it holds no
//   interactive element the extractor did not account for.
// - After every step change, every critical block of that step and of the frame — and on the last
//   step every primary action — must be visible; if not, Mine's own attributes come off the
//   ancestor chain.
// - apply() never moves focus. Only a Back/Next gesture on the in-page stepper does (to the
//   stepper's own title). undo() hands focus back to what had it before apply when it was lost.
import type { ContentBlock, Lang } from '@engine/schema.ts';
import type { Transformation, ViewBlock } from '@engine/transform.ts';
import { t, tn } from '@app/copy.ts';
import { formatDate } from '@app/ui/format.ts';
import { blockName } from '@app/ui/blockNames.ts';
import type { ExtractedPage } from '../extract/index.ts';
import { DOCUMENT_CSS } from './css.ts';
import { callout, note, plainAside, stepper, stub, tagline, terms as termsWidget, type StepperHandle, type StubHandle, type Widget } from './widgets.ts';

export interface ApplyHooks {
  /** A Back/Next gesture on the in-page stepper moved to step i. */
  onStep?: (i: number) => void;
  /** An on-page stub was toggled; `restored` is the complete set of restored ids afterwards. */
  onRestore?: (restored: Set<string>) => void;
}

export interface Applied {
  undo(): void;
  /** Restore (or set aside again) set-aside blocks by id. Keeps every on-page stub in sync. */
  restore(ids: string[], on: boolean): void;
  restored(): Set<string>;
  /** Programmatic step change (the panel): renders, never moves focus, does not call onStep. */
  setStep(i: number): void;
  stepIndex(): number;
  stepCount: number;
  compare(on: boolean): void;
}

const HIDDEN = 'data-mine-hidden';
const STEP_HIDDEN = 'data-mine-step-hidden';
const FOLDED = 'data-mine-folded';
const MARK = 'data-mine-mark';
const FLASH = 'data-mine-flash';
const REWRITTEN = 'data-mine-rewritten';
const HIDING_ATTRS = [HIDDEN, STEP_HIDDEN, FOLDED];

const LIVE_REGION = '[role=alert],[role=status],[aria-live]';
/** Kinds whose node must never end up inside a hidden box of another block. */
const PROTECTED_KINDS = new Set(['action', 'field', 'decision', 'deadline']);
const SUBMIT = 'input[type=submit],button[type=submit]';
/** Interactive elements a region root may hold that never became blocks. */
const UNACCOUNTED = 'input:not([type=hidden]),select,textarea,button,a[href],[role=button],iframe';
/** Parents whose children must be rows/items: a widget goes inside the anchor or into a wrapper. */
const ROW_PARENTS = new Set(['ul', 'ol', 'dl', 'tr', 'tbody', 'thead', 'tfoot', 'table']);
const UNSAFE_INSIDE = 'a,button,input,select,textarea,img,svg,video,iframe,label,output,progress,meter,details,summary,[contenteditable],[onclick],[tabindex],[role]';
const UNSAFE_SELF = '[contenteditable],[onclick],[tabindex],[role]';

/**
 * `#mine-document-css` is the one intentional residue of undo(): every rule in it is scoped to a
 * data-mine-* attribute, so once the attributes are gone it matches nothing. Re-inserting it on
 * every mode switch would only flash styles.
 */
function ensureDocumentCss(): void {
  if (document.getElementById('mine-document-css')) return;
  const style = document.createElement('style');
  style.id = 'mine-document-css';
  style.textContent = DOCUMENT_CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

/** True when a block's node holds nothing but text: its child nodes can be moved aside safely. */
function plainTextSafe(node: Element): boolean {
  if (node.localName.includes('-') || node.shadowRoot || node.matches(UNSAFE_SELF)) return false;
  if ((node as HTMLElement).isContentEditable === true) return false;
  if (node.querySelector(UNSAFE_INSIDE)) return false;
  for (const d of Array.from(node.querySelectorAll('*'))) if (d.localName.includes('-') || d.shadowRoot) return false;
  return true;
}

/** The outermost <label> that is `el` or contains it, else null. */
function outermostLabel(el: Element): Element | null {
  let label = el.closest('label');
  while (label) {
    const up = label.parentElement?.closest('label') ?? null;
    if (!up) break;
    label = up;
  }
  return label;
}

/** Where a widget goes when it must live inside a row/item rather than beside it. */
function cellOf(ref: Element): Element {
  const lastCell = (row: Element) => Array.from(row.children).filter((c) => c.localName === 'td' || c.localName === 'th').pop();
  if (ref.localName === 'tr') return lastCell(ref) ?? ref;
  if (ref.localName === 'tbody' || ref.localName === 'thead' || ref.localName === 'tfoot' || ref.localName === 'table') {
    const rows = Array.from(ref.querySelectorAll('tr'));
    const row = rows[rows.length - 1];
    return row ? (lastCell(row) ?? row) : ref;
  }
  return ref;
}

/** Whether Mine hid `el` or an ancestor, or (with layout) it has no box at all. */
function hiddenByMine(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) if (HIDING_ATTRS.some((a) => e!.hasAttribute(a))) return true;
  return false;
}

interface Guard {
  /** Holds a live region or a submit control that is not a block: never hide. */
  blocked: boolean;
  /** Ids of protected blocks whose node sits inside the element (its own block included). */
  foreign: string[];
}

export function apply(page: ExtractedPage, tr: Transformation, prefs: { fontScale: number; contrast: string }, lang: Lang, hooks: ApplyHooks = {}): Applied {
  ensureDocumentCss();
  const doc = document;
  const html = doc.documentElement;
  const body = doc.body;
  const focusBefore = doc.activeElement;

  const injected: Element[] = [];
  const touched = new Map<Element, Set<string>>();
  const swaps: { el: Element; plainSpan: Element; origSpan: Element }[] = [];
  const restoredIds = new Set<string>();
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let flashed: Element | null = null;

  // --- lookups ---
  const blocks = page.content.blocks;
  const blockById = new Map<string, ContentBlock>(blocks.map((b) => [b.id, b]));
  const indexOf = new Map<string, number>(blocks.map((b, i) => [b.id, i]));
  const byId = new Map<string, ViewBlock>();
  for (const b of tr.view) byId.set(b.id, b);
  const steps = tr.steps ?? [];
  for (const s of steps) for (const b of s.blocks) byId.set(b.id, b);
  const box = (id: string) => page.boxes.get(id);
  const node = (id: string) => page.nodes.get(id);
  const has = (id: string) => blockById.has(id);
  const regionOf = (id: string) => blockById.get(id)?.region ?? 'main';
  const isMenu = (b: ContentBlock | undefined) => !!b && b.kind === 'nav' && (b.importance === 'primary' || b.importance === 'critical');
  const namesOf = (ids: string[]) =>
    ids
      .map((id) => blockById.get(id))
      .filter((b): b is ContentBlock => !!b)
      .slice(0, 3)
      .map((b) => blockName(b, lang))
      .join(lang === 'zh' ? '、' : ', ');

  // --- attributes: everything set here is removed by undo() ---
  const setAttr = (el: Element | undefined, attr: string, value = '') => {
    if (!el) return;
    el.setAttribute(attr, value);
    let set = touched.get(el);
    if (!set) touched.set(el, (set = new Set()));
    set.add(attr);
  };
  const unsetAttr = (el: Element | undefined, attr: string) => el?.removeAttribute(attr);
  const mark = (id: string) => setAttr(box(id) ?? node(id), MARK);

  // --- placement: widgets never land inside a label, and never as a stray child of a list/table ---
  const place = (w: Widget, ref: Element | undefined, where: 'before' | 'after'): Element | null => {
    if (!ref) return null;
    const label = outermostLabel(ref);
    if (label) ref = label;
    const parent = ref.parentElement;
    if (!parent) return null;
    if (ROW_PARENTS.has(parent.localName)) {
      if (where === 'after') {
        cellOf(ref).appendChild(w);
        injected.push(w);
        return w;
      }
      // before a row/item: a wrapper of the parent's own kind, so the list/table stays valid
      let row = ref;
      let container = parent;
      if (parent.localName === 'tr') {
        row = parent;
        container = parent.parentElement ?? parent;
      }
      const wrap = doc.createElement(container.localName === 'ul' || container.localName === 'ol' ? 'li' : container.localName === 'dl' ? 'div' : 'tr');
      wrap.setAttribute('data-mine-injected', '');
      if (wrap.localName === 'tr') {
        const cell = doc.createElement('td');
        cell.setAttribute('colspan', '100');
        cell.appendChild(w);
        wrap.appendChild(cell);
      } else wrap.appendChild(w);
      container.insertBefore(wrap, row);
      injected.push(wrap);
      return wrap;
    }
    if (where === 'after') ref.insertAdjacentElement('afterend', w);
    else parent.insertBefore(w, ref);
    injected.push(w);
    return w;
  };

  // --- steps (computed first: widgets of a stepped block are hidden with its step) ---
  const last = steps.length - 1;
  const stepOf = new Map<string, number>();
  steps.forEach((s, k) => s.blocks.forEach((b) => stepOf.set(b.id, k)));
  const stepWidgets: Element[][] = steps.map(() => []);
  const placeFor = (id: string, w: Widget, ref: Element | undefined, where: 'before' | 'after') => {
    const el = place(w, ref, where);
    const k = stepOf.get(id);
    if (el && k !== undefined) stepWidgets[k]!.push(el);
  };

  // --- protection ---
  const protectedBlocks = blocks.filter((b) => PROTECTED_KINDS.has(b.kind) || b.importance === 'critical');
  const blockNodes = new Set<Element>();
  for (const b of blocks) {
    const n = node(b.id);
    if (n) blockNodes.add(n);
  }
  const guards = new Map<Element, Guard>();
  const guardOf = (el: Element): Guard => {
    let g = guards.get(el);
    if (g) return g;
    const foreign: string[] = [];
    let blocked = !!el.closest(LIVE_REGION);
    if (!blocked) {
      for (const b of protectedBlocks) {
        const n = node(b.id);
        if (n && el.contains(n)) foreign.push(b.id);
      }
      for (const s of Array.from(el.querySelectorAll(SUBMIT))) {
        if (!blockNodes.has(s)) {
          blocked = true;
          break;
        }
      }
    }
    guards.set(el, (g = { blocked, foreign }));
    return g;
  };
  /** The control and its labels: what is hidden when the whole box cannot be. */
  const fallbackTargets = (id: string, b: Element): Element[] => {
    const kind = blockById.get(id)?.kind;
    const n = node(id);
    if (!n || (kind !== 'field' && kind !== 'decision')) return [];
    const out = [n];
    for (const l of Array.from(b.querySelectorAll('label'))) {
      if ((n.id && l.getAttribute('for') === n.id) || l.contains(n)) out.push(l);
    }
    // The extractor knows the label even when the box shrank to the bare control.
    const known = page.labelOf?.get(id);
    if (known && !out.includes(known)) out.push(known);
    if (n.id) for (const l of Array.from(document.querySelectorAll(`label[for="${CSS.escape(n.id)}"]`))) if (!out.includes(l)) out.push(l);
    return out;
  };
  /** The box when it is safe to hide, else whatever of the control + labels is. */
  const targetsFor = (id: string, ok: (g: Guard) => boolean): Element[] => {
    const b = box(id);
    if (!b) return [];
    if (ok(guardOf(b))) {
      // A box that shrank to the bare control (the extractor refused to swallow a neighbour) still
      // needs its label to go with it, so no orphan "Send me updates" text is left behind.
      const n = node(id);
      if (n && b === n) {
        const labels = fallbackTargets(id, b).filter((el) => el !== n && !b.contains(el) && ok(guardOf(el)));
        return [b, ...labels];
      }
      return [b];
    }
    return fallbackTargets(id, b).filter((el) => ok(guardOf(el)));
  };

  // --- set aside (rules 1–2): what the engine hid or collapsed, minus the engine's own stub ViewBlocks
  //     and anything the extractor does not know; the site menu is handled apart ---
  const hiddenIds = tr.changes.filter((c) => c.type === 'hidden').flatMap((c) => c.blockIds).filter(has);
  const collapsedSecondary = tr.view
    .filter((b) => b.state === 'collapsed' && b.stubFor === undefined && has(b.id) && b.kind !== 'action' && !isMenu(blockById.get(b.id)))
    .map((b) => b.id);
  const collapsedSet = new Set(collapsedSecondary);
  const menuHidden = hiddenIds.filter((id) => isMenu(blockById.get(id)));
  const menuCollapsed = tr.view.filter((b) => b.state === 'collapsed' && isMenu(blockById.get(b.id))).map((b) => b.id);
  const setAside = new Set([...hiddenIds.filter((id) => !isMenu(blockById.get(id))), ...collapsedSecondary]);
  const hidingAll = new Set([...setAside, ...menuHidden, ...menuCollapsed]);
  const okSetAside = (g: Guard, own: string) => !g.blocked && g.foreign.every((f) => f === own || hidingAll.has(f));

  const hiddenPlan = new Map<string, Element[]>();
  const hiddenRoots = new Map<string, Element>();
  const stubOf = new Map<string, StubHandle>();
  const stubIds = new Map<StubHandle, string[]>();
  const byDocumentOrder = (a: string, b: string) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
  const hasUnaccounted = (root: Element, ids: string[]): boolean => {
    if (root.querySelector('[data-mine-injected]')) return true; // a stub inside the root must stay reachable
    const hidden = ids.flatMap((id) => hiddenPlan.get(id) ?? []);
    for (const el of Array.from(root.querySelectorAll(UNACCOUNTED))) {
      if (!hidden.some((h) => h.contains(el))) return true;
    }
    return false;
  };
  const registerStub = (handle: StubHandle, ids: string[]) => {
    stubIds.set(handle, ids);
    for (const id of ids) stubOf.set(id, handle);
  };

  // --- 1. the site menu: hidden or collapsed, "Menu (n) · Show" in its place (before the region
  //        groups, so a region that holds the menu stub is never hidden as a whole) ---
  for (const id of [...menuCollapsed, ...menuHidden]) {
    const targets = targetsFor(id, (g) => okSetAside(g, id));
    hiddenPlan.set(id, targets);
    if (targets.length === 0) continue;
    for (const el of targets) setAttr(el, HIDDEN);
    const b = blockById.get(id);
    const n = b && b.kind === 'nav' ? b.items.length : 0;
    const handle = stub({
      label: menuHidden.includes(id) ? t(lang, 'stub.nav.hidden') : t(lang, 'stub.nav', { n }),
      showLabel: t(lang, 'colophon.restore'),
      hideLabel: t(lang, 'stub.hide'),
      open: false,
      onToggle: (open) => {
        api.restore([id], open);
        hooks.onRestore?.(api.restored());
      },
    });
    place(handle.host, targets[0], 'before');
    registerStub(handle, [id]);
  }

  // --- 2. hidden + collapsed secondary: hide boxes, one stub per region (whole region root if all hidden) ---
  const foldGroups = new Map<string, string[]>();
  for (const id of [...setAside].sort(byDocumentOrder)) {
    const r = regionOf(id);
    if (!foldGroups.has(r)) foldGroups.set(r, []);
    foldGroups.get(r)!.push(id);
  }
  for (const [region, ids] of foldGroups) {
    const hidden = ids.filter((id) => {
      const targets = targetsFor(id, (g) => okSetAside(g, id));
      hiddenPlan.set(id, targets);
      for (const el of targets) setAttr(el, HIDDEN);
      return targets.length > 0;
    });
    if (hidden.length === 0) continue;
    const root = region !== 'main' ? page.regions.get(region) : undefined;
    const allInRegion = blocks.filter((b) => (b.region ?? 'main') === region).map((b) => b.id);
    const fullyHidden = (id: string) => hiddenPlan.get(id)?.[0] === box(id);
    const wholeRegion = !!root && root !== page.main && allInRegion.every(fullyHidden) && !hasUnaccounted(root, allInRegion);
    if (wholeRegion) {
      setAttr(root, HIDDEN);
      hiddenRoots.set(region, root);
    }
    const anchor = wholeRegion ? root : hiddenPlan.get(hidden[0]!)?.[0];
    const collapsedOnly = hidden.every((id) => collapsedSet.has(id));
    const handle = stub({
      label: collapsedOnly ? tn(lang, 'colophon.frag.collapsed', hidden.length) : tn(lang, 'stub.count', hidden.length),
      names: namesOf(hidden),
      showLabel: t(lang, 'colophon.restore'),
      hideLabel: t(lang, 'stub.hide'),
      open: false,
      onToggle: (open) => {
        api.restore(hidden, open);
        hooks.onRestore?.(api.restored());
      },
    });
    place(handle.host, anchor, 'before');
    registerStub(handle, hidden);
  }

  // --- 3. moved deadline: echo at the top of main; the original stays and is marked ---
  const movedIds = tr.changes.filter((c) => c.type === 'moved').flatMap((c) => c.blockIds);
  const flash = (el: Element) => {
    if (flashTimer) clearTimeout(flashTimer);
    if (flashed && flashed !== el) flashed.removeAttribute(FLASH);
    flashed = el;
    el.setAttribute(FLASH, '');
    flashTimer = setTimeout(() => {
      el.removeAttribute(FLASH);
      flashTimer = null;
      if (flashed === el) flashed = null;
    }, 1600);
  };
  for (const id of movedIds) {
    const b = byId.get(id);
    if (!b || b.kind !== 'deadline') continue;
    const original = node(id);
    const w = callout({
      label: t(lang, 'deadline.label'),
      date: formatDate(b.date, lang),
      moved: t(lang, 'deadline.moved'),
      text: b.text,
      goto: t(lang, 'ext.goto'),
      onGoto: () => {
        if (!original) return;
        const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        try {
          original.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        } catch {
          /* no layout */
        }
        flash(original);
      },
    });
    const title = tr.view.find((x) => x.kind === 'heading' && x.level === 1 && (x.region ?? 'main') === 'main');
    const titleBox = title ? box(title.id) : undefined;
    if (titleBox && page.main.contains(titleBox)) place(w, titleBox, 'after');
    else if (page.main.firstElementChild) place(w, page.main.firstElementChild, 'before');
    else {
      page.main.appendChild(w);
      injected.push(w);
    }
    mark(id);
  }

  // --- 4. rewritten / annotated: swap text when safe, else show the plain version beside ---
  // `original !== undefined` is the rewrite signal whatever the state says (a moved deadline keeps 'moved').
  for (const b of [...tr.view, ...steps.flatMap((s) => s.blocks)]) {
    if (b.stubFor !== undefined) continue;
    const annotated = b.state === 'annotated';
    const rewritten = b.state === 'rewritten' || b.original !== undefined;
    if (!annotated && !rewritten) continue;
    const el = node(b.id);
    if (!el) continue;
    const plain = 'plainText' in b ? b.plainText : b.kind === 'field' ? b.plainHelp : b.kind === 'decision' ? b.plainLabel : undefined;
    const swapText = rewritten && !annotated && 'text' in b && b.original !== undefined ? b.text : undefined;
    if (swapText && plainTextSafe(el) && el instanceof HTMLElement) {
      const kids = Array.from(el.childNodes);
      setAttr(el, REWRITTEN);
      const plainSpan = doc.createElement('span');
      plainSpan.setAttribute('data-mine-plain-text', '');
      plainSpan.textContent = swapText;
      const origSpan = doc.createElement('span');
      origSpan.setAttribute('data-mine-original-text', '');
      origSpan.append(...kids); // the live nodes move; nothing is serialised
      el.append(plainSpan, origSpan);
      swaps.push({ el, plainSpan, origSpan });
      const tag = tagline(t(lang, 'rewritten.tag'), t(lang, 'rewritten.show'), t(lang, 'rewritten.hide'), (show) => {
        origSpan.style.display = show ? 'block' : '';
        origSpan.style.marginTop = show ? '6px' : '';
        origSpan.style.color = show ? '#55534f' : '';
      });
      placeFor(b.id, tag, el, 'before');
    } else if (plain) {
      placeFor(b.id, plainAside(t(lang, 'legal.summary'), plain), box(b.id) ?? el, 'after');
    }
    mark(b.id);
  }

  // --- 5. explained: terms under the passage ---
  for (const c of tr.changes.filter((x) => x.type === 'explained')) {
    for (const id of c.blockIds) {
      const b = byId.get(id);
      if (!b || !('terms' in b) || !b.terms?.length) continue;
      placeFor(id, termsWidget(b.terms, lang === 'zh' ? '：' : ' — '), box(id) ?? node(id), 'after');
      mark(id);
    }
  }

  // --- 6. surfaced decisions: notes after the box; the checkbox is never touched ---
  for (const c of tr.changes.filter((x) => x.type === 'surfaced')) {
    for (const id of c.blockIds) {
      const b = byId.get(id);
      if (!b || b.kind !== 'decision') continue;
      const lines: { text: string; pencil?: boolean }[] = [{ text: b.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required') }];
      if (b.preChecked) lines.push({ text: t(lang, 'decisions.prechecked'), pencil: true });
      if (b.consequence) lines.push({ text: `${t(lang, 'decisions.consequence')}${lang === 'zh' ? '：' : ': '}${b.consequence}` });
      placeFor(id, note(lines), box(id) ?? node(id), 'after');
      mark(id);
    }
  }

  // --- 7. scale and contrast ---
  const prevZoom = body.style.zoom;
  const zoomOn = () => {
    if (prefs.fontScale === 1) return;
    body.style.zoom = String(prefs.fontScale);
    html.setAttribute('data-mine-zoom', String(prefs.fontScale));
  };
  const zoomOff = () => {
    body.style.zoom = prevZoom;
    html.removeAttribute('data-mine-zoom');
  };
  zoomOn();
  if (prefs.fontScale >= 1.35) setAttr(html, 'data-mine-large');
  if (prefs.contrast === 'high') setAttr(html, 'data-mine-contrast');

  // --- 8. steps: only the current step's boxes are visible; a stepper sits at the form ---
  let stepHandle: StepperHandle | null = null;
  let current = 0;
  // Non-primary actions fold under "Other options" only when they live in the form and not inside
  // another step's box; header/footer buttons are left exactly where they are.
  const stepIds: string[][] = steps.map((s) => s.blocks.map((b) => b.id));
  const collapsedActions = last >= 0 ? steps[last]!.blocks.filter((b) => b.kind === 'action' && b.state === 'collapsed').map((b) => b.id) : [];
  const otherBoxes = steps.flatMap((s, k) => (k === last ? [] : s.blocks.map((b) => box(b.id)).filter((x): x is Element => !!x)));
  const otherOptionIds = collapsedActions.filter((id) => {
    const n = node(id);
    return !!n && !!page.form && page.form.contains(n) && !otherBoxes.some((b) => b.contains(n));
  });
  for (const id of collapsedActions) {
    if (otherOptionIds.includes(id)) continue;
    stepOf.delete(id);
    stepIds[last] = stepIds[last]!.filter((x) => x !== id);
  }
  const okStep = (g: Guard, own: string, j: number) =>
    !g.blocked && g.foreign.every((f) => f === own || hidingAll.has(f) || (stepOf.has(f) && stepOf.get(f) !== j));
  const visible = (el: Element) => {
    if (hiddenByMine(el)) return false;
    try {
      return typeof el.getClientRects !== 'function' || el.getClientRects().length > 0;
    } catch {
      return true;
    }
  };
  const unhideChain = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) for (const a of HIDING_ATTRS) e.removeAttribute(a);
  };
  /** Every critical block of step j and of the frame, and on the last step every primary action, must be visible. */
  const invariant = (j: number) => {
    for (const b of blocks) {
      const inScope = !stepOf.has(b.id) || stepOf.get(b.id) === j;
      const must = (b.importance === 'critical' && inScope) || (j === last && b.kind === 'action' && b.primary);
      if (!must) continue;
      const n = node(b.id);
      if (n && !visible(n)) unhideChain(n);
    }
  };
  const showStep = (i: number) => {
    current = i;
    stepIds.forEach((ids, k) => {
      for (const id of ids) {
        const b = box(id);
        if (!b) continue;
        const targets = k === i ? [] : targetsFor(id, (g) => okStep(g, id, i));
        for (const el of [b, ...fallbackTargets(id, b)]) if (!targets.includes(el)) unsetAttr(el, STEP_HIDDEN);
        for (const el of targets) setAttr(el, STEP_HIDDEN);
      }
    });
    stepWidgets.forEach((ws, k) => ws.forEach((w) => (k === i ? unsetAttr(w, STEP_HIDDEN) : setAttr(w, STEP_HIDDEN))));
    invariant(i);
  };
  if (steps.length > 0) {
    if (otherOptionIds.length > 0) {
      const folds = otherOptionIds.flatMap((id) => {
        const b = box(id);
        return b && okStep(guardOf(b), id, last) ? [b] : [];
      });
      const setFolded = (on: boolean) => folds.forEach((b) => (on ? setAttr(b, FOLDED) : unsetAttr(b, FOLDED)));
      setFolded(true);
      const primaryBox = steps[last]!.blocks.filter((b) => b.kind === 'action' && b.primary).map((b) => box(b.id)).find((b): b is Element => !!b);
      const anchor = primaryBox ?? page.form?.lastElementChild ?? folds[0];
      const handle = stub({
        label: t(lang, 'step.other'),
        showLabel: t(lang, 'colophon.restore'),
        hideLabel: t(lang, 'step.other.hide'),
        open: false,
        onToggle: (open) => setFolded(!open),
      });
      const el = place(handle.host, anchor ?? undefined, 'after');
      if (el) stepWidgets[last]!.push(el);
    }
    stepHandle = stepper({
      count: steps.length,
      titles: steps.map((s) => s.title),
      choice: steps.map((s) => !!s.choice),
      progress: (i, n) => t(lang, 'step.progress', { i, n }),
      choiceLabel: t(lang, 'step.choice'),
      back: t(lang, 'step.back'),
      next: t(lang, 'step.next'),
      onChange: (i, user) => {
        showStep(i);
        if (user) hooks.onStep?.(i);
      },
    });
    const firstBox = stepIds.map((ids) => ids.map((id) => box(id)).find((b): b is Element => !!b)).find((b): b is Element => !!b);
    let stepAnchor = firstBox ?? page.form?.firstElementChild ?? undefined;
    if (page.form && stepAnchor && page.form.contains(stepAnchor) && !page.form.contains(page.main) && page.form.firstElementChild) {
      stepAnchor = page.form.firstElementChild;
    }
    if (stepAnchor) place(stepHandle.host, stepAnchor, 'before');
    showStep(0);
  }

  const syncStubs = (ids: string[]) => {
    const seen = new Set<StubHandle>();
    for (const id of ids) {
      const s = stubOf.get(id);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      const own = stubIds.get(s) ?? [];
      s.set(own.every((x) => restoredIds.has(x)));
    }
  };

  const api: Applied = {
    stepCount: steps.length,
    stepIndex: () => current,
    setStep: (i) => stepHandle?.set(i),
    restored: () => new Set(restoredIds),
    restore(ids, on) {
      const regions = new Set<string>();
      for (const id of ids) {
        for (const el of hiddenPlan.get(id) ?? []) on ? unsetAttr(el, HIDDEN) : setAttr(el, HIDDEN);
        if (on) restoredIds.add(id);
        else restoredIds.delete(id);
        regions.add(regionOf(id));
      }
      // A region root hidden as a whole shows while anything inside is restored, and hides again after.
      for (const r of regions) {
        const root = hiddenRoots.get(r);
        if (!root) continue;
        const open = [...restoredIds].some((x) => regionOf(x) === r && (hiddenPlan.get(x)?.length ?? 0) > 0);
        if (open) unsetAttr(root, HIDDEN);
        else setAttr(root, HIDDEN);
      }
      syncStubs(ids);
    },
    compare(on) {
      if (on) {
        html.setAttribute('data-mine-compare', '');
        zoomOff();
      } else {
        html.removeAttribute('data-mine-compare');
        zoomOn();
      }
    },
    undo() {
      // Inventory: timers, injected nodes (widgets + wrappers), moved text nodes, attributes,
      // zoom, focus. The document stylesheet stays on purpose (see ensureDocumentCss).
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = null;
      flashed?.removeAttribute(FLASH);
      flashed = null;
      for (const w of injected) w.remove();
      for (const { el, plainSpan, origSpan } of swaps) {
        // Only when the element still holds Mine's spans; a site that re-rendered keeps its own content.
        if (plainSpan.parentNode !== el || origSpan.parentNode !== el) continue;
        plainSpan.remove();
        origSpan.replaceWith(...Array.from(origSpan.childNodes));
      }
      for (const [el, attrs] of touched) for (const a of attrs) el.removeAttribute(a);
      doc.querySelectorAll(`[${STEP_HIDDEN}],[${FOLDED}],[${HIDDEN}],[${MARK}],[${FLASH}],[${REWRITTEN}]`).forEach((el) => {
        for (const a of [STEP_HIDDEN, FOLDED, HIDDEN, MARK, FLASH, REWRITTEN]) el.removeAttribute(a);
      });
      zoomOff();
      html.removeAttribute('data-mine-compare');
      html.removeAttribute('data-mine-large');
      html.removeAttribute('data-mine-contrast');
      // Focus goes back to what had it before apply, but only when nobody has it now (the panel
      // keeps its own focus; a control that lost focus because it was hidden gets it back).
      const active = doc.activeElement;
      const nobody = !active || active === body || active === html || !active.isConnected;
      if (nobody && focusBefore instanceof HTMLElement && focusBefore.isConnected && focusBefore !== body) {
        try {
          focusBefore.focus({ preventScroll: true });
        } catch {
          /* not focusable any more */
        }
      }
    },
  };
  return api;
}
