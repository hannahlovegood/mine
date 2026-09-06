// Form controls: fields, decisions, radio groups — labels, required, help, options, boxes
// (EXTENSION.md §1, `field` and `decision`). Runs as a pre-pass so the walker already knows which
// labels, legends and help texts are spoken for before it reaches them.
//
// Decisions the contract left open:
// - Search boxes (`type=search`, or inside `[role=search]`) and controls inside nav elements are
//   not fields: they are site chrome, not a task, and a nav is a composite block anyway. So are
//   controls outside the form root that sit in a header/utility/sidebar/footer region (a header
//   search box, a footer newsletter input — review [30]); controls outside the form root but in
//   main stay fields and get their own step (steps.ts).
// - A checkbox or radio that is `aria-hidden` but sits inside a <label> or beside a visible label
//   (Element UI, Ant Design, custom checkboxes) is still a control (review [44]); the walker
//   visits it although it is hidden.
// - Label sources, in order: label[for] → wrapping label → aria-labelledby → aria-label →
//   (checkbox/radio) the text node or inline element right after the control (≤ 200 chars, before
//   any other control — review [19], [43]) → (fields) a <label> without `for` earlier in the same
//   form-item/form-group wrapper (Element UI, review [44]) → placeholder → title → (select) the
//   placeholder option → nearest preceding text ≤ 60 chars (never for a radio member: that is the
//   group's label or the previous option) → humanised name/id (radio: its value). Required marks
//   (`*`, 必填, (required)) and trailing colons are stripped from the label; help-like
//   descendants of the label (class help/hint/consequence/error…) become the help/consequence
//   instead of label text. The raw label (aria-hidden included) is what decides `required`.
// - `required` also comes from an ancestor form item with an is-required / required / asterisk /
//   ant-form-item-required class (CSS asterisks) or a `*` element right before or after the label.
// - A radio group's label is its fieldset legend, else the aria-labelledby/aria-label of the
//   group's common wrapper, else the text right before the first radio inside the group's wrapper,
//   else the nearest preceding text of the wrapper; options are the radios' labels (else values).
//   Every radio is `required` if any is.
// - Help: aria-describedby, else the first help-class element inside the box (`.form-text`,
//   `.help-block`, `.hint`, `.consequence`, `.invalid-feedback`, `.error`…, ≤ 500 chars), else the
//   small text right after the control (≤ 200 chars). Consumed elements never become text blocks.
// - Select options drop the placeholder (`value=""`, or a leading "Select…/Choose…/请选择").
// - Decisions: `optional = !required && !attestation` (attestation: kinds.ts `isAttestation`); a
//   required checkbox is not optional and, like an attestation, is `critical` ("required to submit").
// - Input types: datetime-local/month/week → date, range → number, everything unknown → text.
// - The form root is the <form> holding most of the controls inside main; a form with no control
//   in main (a header search) never wins (review [63]). A form that contains main, a region root
//   or more than half of the page's text (ASP.NET WebForms) is narrowed to the common wrapper of
//   its controls in main (review [29]). Without a form: the common wrapper of the main controls.
import type { InputType } from '@engine/schema.ts';
import { controlBox, otherControls } from './boxes.ts';
import type { ControlInfo, ExtractContext } from './context.ts';
import { isActionEl, isAttestation, isHeading } from './kinds.ts';
import { regionOf } from './regions.ts';
import { SKIP_INPUT_TYPES, attr, classString, collapse, containsControl, controlType, hasToken, humanise, isBlockLevel, isHidden, textLength, textOf } from './text.ts';

const HELP_EXACT = ['help', 'hint', 'hints', 'desc', 'description', 'note', 'notes', 'tip', 'tips', 'consequence', 'helper', 'explain', 'explanation', 'muted', 'caption', 'error', 'errors', 'invalid'];
const HELP_PREFIX = ['help', 'hint', 'desc', 'tip'];
const HELP_STRING = /\b(?:form-text|help-block|hint-text|helper-text|field-description|field-hint|(?:in)?valid-feedback|error-?(?:message|msg|text|tip)|form-item__error|form-item-explain(?:-error)?)\b/;
const REQUIRED_MARK = /[*＊]|必填|\(\s*required\s*\)|（\s*必填\s*）|\brequired\b/i;
const REQUIRED_CLASS_EXACT = ['required', 'isrequired', 'asterisk', 'mandatory'];
const NOT_REQUIRED_CLASS = /\b(?:not|non|un)-?required\b/;
const ASTERISK = /^[*＊]$/;
const PLACEHOLDER_OPTION = /^(?:-+|—+|…|select|choose|please|pick|请选择|请选|选择|--)/i;
const CONSUMABLE = new Set(['span', 'div', 'td', 'th', 'p', 'b', 'strong', 'small', 'font', 'label', 'legend', 'em', 'i', 'dt']);
const TRAILING_HELP_TAGS = new Set(['small', 'span', 'div', 'p']);
const FORM_ITEM = /\b(?:form-group|form-row|form-item|form-field|form-check|form-floating|form-element|form-line|input-group|control-group|field-wrapper|field-group|field|question|form-control-wrapper)\b/;
const MAX_FOLLOWING = 200;
const MAX_PRECEDING = 60;

type ControlKind = 'field' | 'decision' | 'radio';

export function isHelpEl(el: Element): boolean {
  if (el.localName === 'input' || el.localName === 'select' || el.localName === 'textarea' || el.localName === 'button') return false;
  return hasToken(el, HELP_EXACT, HELP_PREFIX) || HELP_STRING.test(classString(el));
}

function inputTypeOf(el: Element): InputType {
  const tag = el.localName;
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'text';
  const type = attr(el, 'type').toLowerCase();
  switch (type) {
    case 'email':
    case 'tel':
    case 'number':
    case 'date':
    case 'file':
      return type;
    case 'datetime-local':
    case 'month':
    case 'week':
      return 'date';
    case 'range':
      return 'number';
    default:
      return 'text';
  }
}

export function cleanLabel(raw: string): string {
  let t = collapse(raw);
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^\s*[*＊]+\s*/u, '')
      .replace(/\s*[*＊]+\s*$/u, '')
      .replace(/\s*[(（]\s*(?:required|optional|mandatory|必填|选填|可选|非必填|必选)\s*[)）]\s*$/iu, '')
      .replace(/[:：]\s*$/u, '')
      .trim();
  }
  return t;
}

interface LabelResult {
  el: Element | null;
  text: string;
  raw: string;
  /** Elements the label text was read from (a trailing text run's links), for the attestation link test. */
  links?: Element[];
}

const NONE: LabelResult = { el: null, text: '', raw: '' };

function isSkippedDeep(el: Element, body: Element, cache: WeakMap<Element, boolean>): boolean {
  const cached = cache.get(el);
  if (cached !== undefined) return cached;
  let result = isHidden(el);
  if (!result && el !== body && el.parentElement) result = isSkippedDeep(el.parentElement, body, cache);
  cache.set(el, result);
  return result;
}

/** Text of a label without its help-like parts and without the control's own text. */
function labelText(el: Element, raw = false): string {
  return textOf(el, { exclude: isHelpEl, raw });
}

/** A checkbox/radio that a framework hid with aria-hidden while showing its own label beside it. */
function isFrameworkChoice(el: Element, labelsFor: Map<string, Element[]>): boolean {
  const type = controlType(el);
  if (type !== 'checkbox' && type !== 'radio') return false;
  if (isHidden(el, { ignoreAria: true })) return false;
  const wrapping = el.closest('label');
  if (wrapping && !isHidden(wrapping)) return true;
  const id = attr(el, 'id');
  if (id && (labelsFor.get(id) ?? []).some((l) => !isHidden(l))) return true;
  const near = [el.nextElementSibling, el.parentElement?.nextElementSibling ?? null];
  return near.some((e) => e && !isHidden(e) && (e.localName === 'label' || hasToken(e, ['label'])));
}

export function collectControls(ctx: ExtractContext): void {
  const { doc, body } = ctx;
  const hiddenCache = new WeakMap<Element, boolean>();
  const labelsFor = new Map<string, Element[]>();
  for (const label of Array.from(doc.querySelectorAll('label[for]'))) {
    const id = attr(label, 'for');
    if (!id) continue;
    const list = labelsFor.get(id) ?? [];
    list.push(label);
    labelsFor.set(id, list);
  }

  // 1. gather controls in document order; radios by group
  const ordered: { el: Element; kind: ControlKind; members: Element[] }[] = [];
  const groups = new Map<string, Element[]>();
  for (const el of Array.from(body.querySelectorAll('input,select,textarea'))) {
    const type = controlType(el);
    if (SKIP_INPUT_TYPES.has(type)) continue;
    if (el.closest('nav,[role=navigation],[role=search]')) continue;
    if (isHidden(el) && !isFrameworkChoice(el, labelsFor)) continue;
    if (el.parentElement && isSkippedDeep(el.parentElement, body, hiddenCache)) continue;
    if (type === 'radio') {
      const form = el.closest('form');
      const key = `${form ? formIndex(doc, form) : 'x'}|${attr(el, 'name') || `id:${attr(el, 'id')}`}`;
      const list = groups.get(key);
      if (list) {
        list.push(el);
        ctx.memberOf.set(el, list[0]!);
      } else {
        const members = [el];
        groups.set(key, members);
        ctx.memberOf.set(el, el);
        ordered.push({ el, kind: 'radio', members });
      }
      continue;
    }
    ordered.push({ el, kind: type === 'checkbox' ? 'decision' : 'field', members: [] });
  }

  // 2. the form root (needed by the box rule)
  ctx.form = chooseFormRoot(ordered.map((o) => o.el), ctx);

  // 3. per-control details; controls outside the form root and outside main are site chrome
  for (const item of ordered) {
    try {
      if (ctx.form && !ctx.form.contains(item.el) && regionOf(item.el, ctx) !== 'main') continue;
      const info = item.kind === 'radio' ? describeRadioGroup(item.el, item.members, labelsFor, ctx) : describeControl(item.el, item.kind, labelsFor, ctx);
      if (info) ctx.controls.set(item.el, info);
    } catch {
      /* a broken control is skipped, never fatal */
    }
  }
}

function formIndex(doc: Document, form: Element): number {
  return Array.from(doc.querySelectorAll('form') as NodeListOf<Element>).indexOf(form);
}

function commonWrapper(controls: Element[], ctx: ExtractContext): Element {
  let common: Element | null = controls[0]!.parentElement;
  for (const c of controls) while (common && !common.contains(c)) common = common.parentElement;
  if (!common || common === ctx.body || common === ctx.doc.documentElement) return ctx.main;
  return common;
}

function chooseFormRoot(controls: Element[], ctx: ExtractContext): Element | null {
  if (controls.length === 0) return null;
  const inMain = controls.filter((c) => regionOf(c, ctx) === 'main');
  const pool = inMain.length > 0 ? inMain : controls;
  const counts = new Map<Element, number>();
  for (const c of pool) {
    const form = c.closest('form');
    if (form) counts.set(form, (counts.get(form) ?? 0) + 1);
  }
  let best: Element | null = null;
  let bestCount = 0;
  for (const [form, n] of counts) {
    if (n > bestCount) {
      best = form;
      bestCount = n;
    }
  }
  // a lone control in a form while the task's controls live outside any form: the wrapper wins
  if (best && bestCount < 2 && pool.filter((c) => !c.closest('form')).length >= 2) best = null;
  if (!best) return commonWrapper(pool, ctx);
  const root: Element = best;
  let holdsRoot = root.contains(ctx.main);
  for (const region of ctx.roots.keys()) if (root.contains(region)) holdsRoot = true;
  // page-wide: wraps main or a region root, or holds the page title and most of the page's text
  const pageWide = holdsRoot || (ctx.anchor !== null && root.contains(ctx.anchor) && textLength(root) > textLength(ctx.body) * 0.5);
  if (!pageWide) return root;
  const inside = pool.filter((c) => root.contains(c));
  const narrowed = commonWrapper(inside.length > 0 ? inside : pool, ctx);
  return root.contains(narrowed) ? narrowed : root;
}

function resolveLabel(el: Element, labelsFor: Map<string, Element[]>, ctx: ExtractContext, kind: ControlKind): LabelResult {
  const id = attr(el, 'id');
  if (id) {
    for (const label of labelsFor.get(id) ?? []) {
      if (isHidden(label)) continue;
      const text = cleanLabel(labelText(label));
      if (text) return { el: label, text, raw: labelText(label, true) };
    }
  }
  const wrapping = el.closest('label');
  if (wrapping) {
    const text = cleanLabel(labelText(wrapping));
    if (text) return { el: wrapping, text, raw: labelText(wrapping, true) };
  }
  const labelled = referenced(el, 'aria-labelledby', ctx);
  if (labelled.text) return { el: labelled.els[0] ?? null, text: cleanLabel(labelled.text), raw: labelled.text };
  const aria = cleanLabel(attr(el, 'aria-label'));
  if (aria) return { el: null, text: aria, raw: attr(el, 'aria-label') };
  if (kind !== 'field') {
    const following = followingText(el, ctx);
    if (following) return following;
  } else {
    const inItem = labelInFormItem(el, ctx);
    if (inItem) return inItem;
  }
  for (const name of ['placeholder', 'title']) {
    const v = cleanLabel(attr(el, name));
    if (v) return { el: null, text: v, raw: v };
  }
  if (el.localName === 'select') {
    const placeholder = placeholderOption(el);
    if (placeholder) return { el: null, text: cleanLabel(placeholder), raw: placeholder };
  }
  if (kind === 'radio') return NONE;
  const preceding = precedingText(el, ctx);
  if (preceding) return preceding;
  const fallback = humanise(attr(el, 'name') || attr(el, 'id'));
  return { el: null, text: fallback, raw: fallback };
}

function referenced(el: Element, name: string, ctx: ExtractContext): { text: string; els: Element[] } {
  const ids = attr(el, name).split(/\s+/).filter(Boolean);
  const els: Element[] = [];
  const parts: string[] = [];
  for (const id of ids) {
    const target = ctx.doc.getElementById(id);
    if (!target || target === el) continue;
    const text = textOf(target, { max: 500 });
    if (!text) continue;
    els.push(target);
    parts.push(text);
    ctx.consumed.add(target);
  }
  return { text: parts.join(' '), els };
}

function placeholderOption(select: Element): string {
  const options = Array.from(select.querySelectorAll('option'));
  const first = options[0];
  if (!first) return '';
  const text = collapse(first.textContent ?? '');
  if (first.getAttribute('value') === '' || PLACEHOLDER_OPTION.test(text)) return text.replace(/[…:：.]+$/u, '').replace(/^(?:-+|—+)\s*|\s*(?:-+|—+)$/gu, '').trim();
  return '';
}

/** An inline element that may carry a checkbox's text: not block-level, not a control, not a button. */
function isInlineLabelCandidate(el: Element): boolean {
  if (isHidden(el) || el.localName === 'br' || isBlockLevel(el)) return false;
  if (containsControl(el) || isActionEl(el) || el.querySelector('button,[role=button]')) return false;
  if (el.localName === 'label' && attr(el, 'for')) return false;
  return true;
}

/**
 * The text right after a checkbox/radio: the inline run of text nodes and inline elements
 * ("我已阅读并同意<a>《须知》</a>", ≤ 200 chars) up to a <br>, a block, a control or a button.
 */
function followingText(el: Element, ctx: ExtractContext): LabelResult | null {
  const parts: string[] = [];
  const raws: string[] = [];
  const els: Element[] = [];
  let ownText = '';
  for (let node: Node | null = el.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 3) {
      const t = node.nodeValue ?? '';
      parts.push(t);
      raws.push(t);
      ownText += t;
    } else if (node.nodeType === 1) {
      const e = node as Element;
      if (e.localName === 'br' || isBlockLevel(e) || containsControl(e) || isActionEl(e)) break;
      if (!isInlineLabelCandidate(e)) continue;
      const t = textOf(e, { exclude: isHelpEl, max: MAX_FOLLOWING + 20 });
      if (!t) continue;
      parts.push(t);
      raws.push(textOf(e, { exclude: isHelpEl, raw: true, max: MAX_FOLLOWING + 20 }));
      els.push(e);
    }
  }
  const text = collapse(parts.join(''));
  if (!text || text.length > MAX_FOLLOWING) return null;
  for (const e of els) if (CONSUMABLE.has(e.localName) || e.localName === 'a') ctx.consumed.add(e);
  const only = els.length === 1 && collapse(ownText) === '' ? els[0]! : null;
  return { el: only, text: cleanLabel(text), raw: collapse(raws.join('')), links: els };
}

/** The nearest form-item/form-group wrapper of `el` below the form root, else null. */
function formItemOf(el: Element, ctx: ExtractContext): Element | null {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++) {
    if (node === ctx.form || node === ctx.main || node === ctx.body || node.localName === 'form') return null;
    if (FORM_ITEM.test(classString(node))) return node;
    node = node.parentElement;
  }
  return null;
}

/** A <label> without a usable `for`, earlier in the same form item, holding no control: its text. */
function labelInFormItem(el: Element, ctx: ExtractContext): LabelResult | null {
  const item = formItemOf(el, ctx);
  if (!item) return null;
  for (const label of Array.from(item.querySelectorAll('label'))) {
    if (isHidden(label) || containsControl(label) || label.contains(el)) continue;
    const forId = attr(label, 'for');
    if (forId && ctx.doc.getElementById(forId)) continue;
    if ((label.compareDocumentPosition(el) & 4) === 0) continue; // label must precede the control
    const text = cleanLabel(labelText(label));
    if (text && text.length <= MAX_FOLLOWING) return { el: label, text, raw: labelText(label, true) };
  }
  return null;
}

/**
 * The nearest preceding short text (≤ 60 chars) — walking back through siblings and up, never
 * above `bound` when one is given (the radio group's wrapper).
 */
function precedingText(el: Element, ctx: ExtractContext, bound: Element | null = null): LabelResult | null {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.form && node !== ctx.main && node.localName !== 'form') {
    if (bound && node === bound) return null;
    let prev: Node | null = node.previousSibling;
    while (prev) {
      if (prev.nodeType === 3) {
        const t = collapse(prev.nodeValue ?? '');
        if (t) return t.length <= MAX_PRECEDING ? { el: null, text: cleanLabel(t), raw: t } : null;
      } else if (prev.nodeType === 1) {
        const pe = prev as Element;
        if (!isHidden(pe) && !containsControl(pe) && !pe.querySelector('button')) {
          const t = textOf(pe, { max: 200 });
          if (t) {
            if (t.length > MAX_PRECEDING) return null;
            const heading = isHeading(pe);
            if (!heading && CONSUMABLE.has(pe.localName)) ctx.consumed.add(pe);
            return { el: heading ? null : pe, text: cleanLabel(t), raw: textOf(pe, { raw: true, max: 200 }) };
          }
        }
      }
      prev = prev.previousSibling;
    }
    node = node.parentElement;
  }
  return null;
}

/** A lone `*` right before or after the label element (`<span class="required">*</span>`). */
function asteriskBeside(labelEl: Element | null): boolean {
  if (!labelEl) return false;
  for (const sib of [labelEl.previousSibling, labelEl.nextSibling]) {
    if (!sib) continue;
    if (sib.nodeType === 3 && ASTERISK.test(collapse(sib.nodeValue ?? ''))) return true;
    if (sib.nodeType === 1 && !isHidden(sib as Element) && ASTERISK.test(textOf(sib as Element, { raw: true, max: 10 }))) return true;
  }
  return false;
}

/** An ancestor form item (below the form root) whose class says required (CSS asterisk frameworks). */
function requiredByAncestor(el: Element, ctx: ExtractContext): boolean {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++) {
    if (node === ctx.form || node === ctx.main || node === ctx.body || node.localName === 'form') return false;
    if (hasToken(node, REQUIRED_CLASS_EXACT) && !NOT_REQUIRED_CLASS.test(classString(node))) return true;
    node = node.parentElement;
  }
  return false;
}

function isRequired(el: Element, rawLabel: string, labelEl: Element | null, ctx: ExtractContext): boolean {
  if (el.hasAttribute('required')) return true;
  if (attr(el, 'aria-required').toLowerCase() === 'true') return true;
  if (REQUIRED_MARK.test(rawLabel)) return true;
  if (labelEl && hasToken(labelEl, REQUIRED_CLASS_EXACT) && !NOT_REQUIRED_CLASS.test(classString(labelEl))) return true;
  return asteriskBeside(labelEl) || requiredByAncestor(el, ctx);
}

function selectOptions(select: Element): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  Array.from(select.querySelectorAll('option')).forEach((o, i) => {
    const text = collapse(o.textContent ?? '');
    if (!text) return;
    if (o.getAttribute('value') === '' || (i === 0 && PLACEHOLDER_OPTION.test(text))) return;
    if (seen.has(text) || out.length >= 100) return;
    seen.add(text);
    out.push(text);
  });
  return out.length > 0 ? out : undefined;
}

function isTrailingHelp(after: Element | null, labelEl: Element | null): after is Element {
  return Boolean(
    after &&
      TRAILING_HELP_TAGS.has(after.localName) &&
      !isHidden(after) &&
      !containsControl(after) &&
      !after.querySelector('button,a[href]') &&
      after !== labelEl &&
      !isHeading(after) &&
      textLength(after) <= MAX_FOLLOWING,
  );
}

/** The small text right after the control (or after its wrapping label): part of the control, not a block. */
function trailingHelpEl(control: Element, labelEl: Element | null): Element | null {
  let after: Element | null = control.nextElementSibling;
  if (!after && labelEl && labelEl.contains(control)) after = labelEl.nextElementSibling;
  return isTrailingHelp(after, labelEl) ? after : null;
}

function findHelp(control: Element, labelEl: Element | null, box: Element, trailing: Element | null, ctx: ExtractContext, members: Element[]): string | undefined {
  const described = referenced(control, 'aria-describedby', ctx);
  if (described.text) return described.text.slice(0, 500);
  for (const el of Array.from(box.querySelectorAll('*'))) {
    if (el === control || el === labelEl || members.includes(el) || isHidden(el)) continue;
    if (!isHelpEl(el) || containsControl(el)) continue;
    if (el.querySelector('*') && Array.from(el.querySelectorAll('*')).some(isHelpEl)) continue;
    const text = textOf(el, { max: 500 });
    if (text) {
      ctx.consumed.add(el);
      return text;
    }
  }
  let after: Element | null = trailing;
  if (!after && control.parentElement && control.parentElement !== box) {
    const next = control.parentElement.nextElementSibling;
    if (isTrailingHelp(next, labelEl)) after = next;
  }
  if (after) {
    const text = textOf(after, { max: 220 });
    if (text && text.length <= MAX_FOLLOWING) {
      ctx.consumed.add(after);
      return text;
    }
  }
  return undefined;
}

function describeControl(el: Element, kind: 'field' | 'decision', labelsFor: Map<string, Element[]>, ctx: ExtractContext): ControlInfo | null {
  const label = resolveLabel(el, labelsFor, ctx, kind);
  if (!label.text) return null;
  if (label.el) ctx.consumed.add(label.el);
  const trailing = trailingHelpEl(el, label.el);
  const box = controlBox({ control: el, members: [], labelEl: label.el, own: trailing ? [trailing] : [], isHelp: isHelpEl }, ctx);
  const help = findHelp(el, label.el, box, trailing, ctx, []);
  const required = isRequired(el, label.raw, label.el, ctx);
  const info: ControlInfo = {
    el,
    kind,
    members: [],
    labelEl: label.el,
    label: label.text,
    required,
    inputType: inputTypeOf(el),
    checked: kind === 'decision' ? isChecked(el) : false,
    attestation: kind === 'decision' && isAttestation(label.text, help, [label.el, ...(label.links ?? [])].filter((e): e is Element => Boolean(e))),
    box,
  };
  if (help) info.help = help;
  if (el.localName === 'select') {
    const options = selectOptions(el);
    if (options) info.options = options;
  }
  return info;
}

function isChecked(el: Element): boolean {
  const prop = (el as HTMLInputElement).checked;
  if (typeof prop === 'boolean') return prop;
  return el.hasAttribute('checked');
}

function describeRadioGroup(first: Element, members: Element[], labelsFor: Map<string, Element[]>, ctx: ExtractContext): ControlInfo | null {
  const memberLabels: Element[] = [];
  const options: string[] = [];
  let firstLabel: Element | null = null;
  for (const radio of members) {
    const l = resolveLabel(radio, labelsFor, ctx, 'radio');
    if (l.el) {
      memberLabels.push(l.el);
      ctx.consumed.add(l.el);
      if (radio === first) firstLabel = l.el;
    }
    const text = l.text || humanise(attr(radio, 'value'));
    if (text && !options.includes(text)) options.push(text);
  }
  let common: Element | null = first.parentElement;
  for (const m of [...members, ...memberLabels]) while (common && !common.contains(m)) common = common.parentElement;
  let labelEl: Element | null = null;
  let label = '';
  let raw = '';
  const fieldset = common?.closest('fieldset') ?? null;
  const legend = fieldset ? Array.from(fieldset.children).find((c) => c.localName === 'legend') : undefined;
  if (fieldset && legend && otherControls(fieldset, first, members, { ctx, actions: false }).length === 0) {
    label = cleanLabel(textOf(legend));
    raw = textOf(legend, { raw: true });
    labelEl = legend;
    common = fieldset;
  }
  if (!label && common) {
    const group = common.matches('[role=radiogroup],[aria-labelledby],[aria-label]') ? common : common.querySelector('[role=radiogroup]');
    if (group && group.contains(first)) {
      const labelled = referenced(group, 'aria-labelledby', ctx);
      const text = labelled.text || attr(group, 'aria-label');
      if (text) {
        label = cleanLabel(text);
        raw = text;
        labelEl = labelled.els[0] ?? null;
      }
    }
  }
  if (!label && common && common !== ctx.form) {
    // the text right before the first radio inside the group's own wrapper ("性别 (o)男 (o)女")
    const start = firstLabel && firstLabel.contains(first) ? firstLabel : first;
    const inside = precedingText(start, ctx, common);
    const preceding = inside ?? precedingText(common, ctx);
    if (preceding) {
      label = preceding.text;
      raw = preceding.raw;
      labelEl = preceding.el;
    }
  } else if (!label) {
    const preceding = precedingText(first, ctx);
    if (preceding) {
      label = preceding.text;
      raw = preceding.raw;
      labelEl = preceding.el;
    }
  }
  if (!label) {
    label = humanise(attr(first, 'name'));
    raw = label;
  }
  if (!label) return null;
  if (labelEl) ctx.consumed.add(labelEl);
  const box = controlBox({ control: first, members, labelEl, own: memberLabels, isHelp: isHelpEl }, ctx);
  const help = findHelp(first, labelEl, box, null, ctx, members);
  const required = members.some((m) => isRequired(m, '', null, ctx)) || REQUIRED_MARK.test(raw) || asteriskBeside(labelEl) || (labelEl !== null && hasToken(labelEl, REQUIRED_CLASS_EXACT));
  const info: ControlInfo = {
    el: first,
    kind: 'field',
    members,
    labelEl,
    label,
    required,
    inputType: 'select',
    checked: false,
    attestation: false,
    box,
  };
  if (options.length > 0) info.options = options;
  if (help) info.help = help;
  return info;
}
