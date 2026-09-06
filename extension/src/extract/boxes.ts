// Boxes: the element the applier hides/shows for a block (EXTENSION.md §1, "Boxes").
//
// Decisions the contract left open:
// - Wrapper-only ancestors are folded into a block's box: while the parent holds nothing but this
//   one child (no text, no other elements) and is a plain wrapper (div/span/p/a/li/section…),
//   the box moves up. Hiding `<div><p>…</p></div>` then hides the wrapper too, and the site's
//   margins go with it. Folding stops at body, the main root, region roots, the form root, and
//   structural tags (form, fieldset, table parts, lists, nav, label, button…).
// - A control's box starts at the lowest common ancestor of the control and its label, then
//   grows while the parent adds no other control and no foreign content (help texts and this
//   control's labels are not foreign). Growth stops at form/fieldset/body/main/region roots and
//   list/table containers, and pauses (the level is taken, then stops) at li, tr and
//   `.form-group`-like wrappers. If even the common ancestor holds another control, or foreign
//   content along the way down to the control and its label (review [0]), the box is the
//   control's parent when that is clean, else the control itself — never a box with two
//   controls in it, never a box that hides a button or another block.
// - "Other controls" are real controls (collected ones count even when aria-hidden) and actions:
//   button, input[type=submit|button|image|reset], [role=button], a link styled as a button — an
//   icon-only button included. A box may hold this control's own labels and help, nothing else.
import type { ExtractContext } from './context.ts';
import { isActionEl } from './kinds.ts';
import { CONTROL_SELECTOR, attr, classString, isHidden, isMineUi, textLength } from './text.ts';

const FOLD_OK = new Set(['div', 'span', 'p', 'a', 'center', 'li', 'section', 'font', 'b', 'strong', 'em', 'i', 'small', 'article']);
const HARD_STOP = new Set(['form', 'fieldset', 'body', 'html', 'table', 'tbody', 'thead', 'tfoot', 'ul', 'ol', 'dl', 'nav', 'details', 'figure', 'main', 'header', 'footer', 'aside']);
const SOFT_STOP = new Set(['li', 'tr']);
const FORM_GROUP =
  /\b(?:form-group|form-row|form-item|form-field|form-check|form-floating|form-element|form-line|input-group|control-group|field-wrapper|field-group|field|question|form-control-wrapper)\b/;

export function isFormGroupLike(el: Element): boolean {
  return FORM_GROUP.test(classString(el));
}

function isStructuralBoundary(el: Element, ctx: ExtractContext): boolean {
  return el === ctx.body || el === ctx.main || el === ctx.form || ctx.roots.has(el) || isMineUi(el);
}

function hasOwnText(el: Element): boolean {
  for (let child = el.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3 && (child.nodeValue ?? '').trim() !== '') return true;
  }
  return false;
}

/** Fold wrapper-only ancestors into the box of `el`. */
export function foldWrappers(el: Element, ctx: ExtractContext): Element {
  let box = el;
  for (;;) {
    const parent = box.parentElement;
    if (!parent || isStructuralBoundary(parent, ctx) || !FOLD_OK.has(parent.localName)) break;
    if (parent.children.length !== 1 || hasOwnText(parent)) break;
    box = parent;
  }
  return box;
}

/** Lowest common ancestor of the given elements (null when none share one). */
export function lca(nodes: Element[]): Element | null {
  const list = nodes.filter((n): n is Element => Boolean(n));
  if (list.length === 0) return null;
  let common: Element | null = list[0]!;
  for (let i = 1; i < list.length && common; i++) {
    let node: Element | null = common;
    while (node && !node.contains(list[i]!)) node = node.parentElement;
    common = node;
  }
  return common;
}

export interface OtherControlOptions {
  /** Collected controls count even when aria-hidden (framework checkboxes/radios). */
  ctx?: ExtractContext;
  /** Count actions (buttons, submit inputs, link-buttons) as controls. Default true. */
  actions?: boolean;
}

const ACTION_SELECTOR = 'button,input[type=submit],input[type=button],input[type=image],input[type=reset],[role=button],a[class],img[onclick],a[href^="javascript"]';

/** Other real controls (and, by default, actions) inside `scope`: not this control, not its radio siblings, not hidden. */
export function otherControls(scope: Element, control: Element, members: Element[], opts: OtherControlOptions = {}): Element[] {
  const out: Element[] = [];
  const collected = (c: Element): boolean => Boolean(opts.ctx && (opts.ctx.controls.has(c) || opts.ctx.memberOf.has(c)));
  try {
    for (const c of Array.from(scope.querySelectorAll(CONTROL_SELECTOR))) {
      if (c === control || members.includes(c)) continue;
      if (c.localName === 'input' && attr(c, 'type').toLowerCase() === 'hidden') continue;
      if (isHidden(c) && !collected(c)) continue;
      out.push(c);
    }
    if (opts.actions !== false) {
      for (const a of Array.from(scope.querySelectorAll(ACTION_SELECTOR))) {
        if (a === control || isHidden(a) || !isActionEl(a)) continue;
        out.push(a);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function hasOtherControl(scope: Element, control: Element, members: Element[], ctx?: ExtractContext): boolean {
  return otherControls(scope, control, members, { ctx }).length > 0;
}

/** A child of a box candidate that is neither this control's own element nor help nor empty. */
function isForeignNode(child: Node, own: Set<Element>, isHelp: (e: Element) => boolean, allowText: boolean): boolean {
  if (child.nodeType === 3) return !allowText && (child.nodeValue ?? '').trim() !== '';
  if (child.nodeType !== 1) return false;
  const el = child as Element;
  if (isHidden(el) || own.has(el) || isHelp(el)) return false;
  if (el.localName === 'br') return false;
  if (textLength(el) > 0) return true;
  return Boolean(el.querySelector('img,svg,video,iframe'));
}

/** Content in `parent` outside `box` that is not a label/help of this control. */
function hasForeignContent(parent: Element, box: Element, own: Set<Element>, isHelp: (e: Element) => boolean): boolean {
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child === box) continue;
    if (isForeignNode(child, own, isHelp, false)) return true;
  }
  return false;
}

/**
 * Foreign content anywhere between `lca` and this control's own elements: every level on the
 * path from an own element up to `lca` is checked for siblings that are not own, help or empty.
 * Text nodes count (a stray "(kg)" is foreign); the parent fallback tolerates them.
 */
function foreignInside(lca: Element, own: Set<Element>, isHelp: (e: Element) => boolean): boolean {
  if (own.has(lca)) return false; // a wrapping label: its inside is the control's own text
  const spine = new Set<Element>();
  for (const e of own) {
    let node = e.parentElement;
    while (node && node !== lca && lca.contains(node)) {
      if (!own.has(node)) spine.add(node); // never look inside an own element (a member's wrapping label)
      node = node.parentElement;
    }
  }
  const okChild = (child: Node): boolean => child.nodeType === 1 && (own.has(child as Element) || spine.has(child as Element));
  for (const level of [lca, ...spine]) {
    for (let child = level.firstChild; child; child = child.nextSibling) {
      if (okChild(child)) continue;
      if (isForeignNode(child, own, isHelp, false)) return true;
    }
  }
  return false;
}

/** The control's parent is a box when it is not a boundary and holds no other control and no foreign element (text nodes are fine). */
function cleanParent(control: Element, members: Element[], own: Set<Element>, isHelp: (e: Element) => boolean, ctx: ExtractContext): Element | null {
  const parent = control.parentElement;
  if (!parent || isStructuralBoundary(parent, ctx) || hasOtherControl(parent, control, members, ctx)) return null;
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child === control || (child.nodeType === 1 && own.has(child as Element))) continue;
    if (isForeignNode(child, own, isHelp, true)) return null;
  }
  return parent;
}

export interface ControlBoxInput {
  control: Element;
  members: Element[];
  labelEl: Element | null;
  /** Elements that belong to this control (labels of radio members, legend…). */
  own: Element[];
  isHelp: (e: Element) => boolean;
}

/** The smallest clean ancestor holding the control and its label (see file header). */
export function controlBox(input: ControlBoxInput, ctx: ExtractContext): Element {
  const { control, members, labelEl, isHelp } = input;
  const own = new Set<Element>([control, ...members, ...input.own, ...(labelEl ? [labelEl] : [])]);
  let box = lca([control, ...members, ...(labelEl ? [labelEl] : [])]) ?? control;
  if (box === control || box.localName === 'input' || box.localName === 'select' || box.localName === 'textarea') {
    box = cleanParent(control, members, own, isHelp, ctx) ?? control;
  } else if (hasOtherControl(box, control, members, ctx) || foreignInside(box, own, isHelp)) {
    return cleanParent(control, members, own, isHelp, ctx) ?? control;
  }
  if (box === control) return box;
  if (box.localName === 'fieldset' || SOFT_STOP.has(box.localName) || isFormGroupLike(box)) return box;
  for (;;) {
    const parent = box.parentElement;
    if (!parent || isStructuralBoundary(parent, ctx) || HARD_STOP.has(parent.localName)) break;
    if (hasOtherControl(parent, control, members, ctx)) break;
    if (hasForeignContent(parent, box, own, isHelp)) break;
    box = parent;
    if (SOFT_STOP.has(parent.localName) || isFormGroupLike(parent)) break;
  }
  return box;
}
