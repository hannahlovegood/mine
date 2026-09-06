// Form controls: fields, decisions, radio groups — labels, required, help, options, boxes
// (EXTENSION.md §1, `field` and `decision`). Runs as a pre-pass so the walker already knows which
// labels, legends and help texts are spoken for before it reaches them.
//
// Decisions the contract left open:
// - Search boxes (`type=search`, or inside `[role=search]`) and controls inside nav elements are
//   not fields: they are site chrome, not a task, and a nav is a composite block anyway.
// - Label sources, in order: label[for] → wrapping label → aria-labelledby → aria-label →
//   placeholder → title → (select) the placeholder option → nearest preceding text ≤ 60 chars →
//   humanised name/id. Required marks (`*`, 必填, (required)) and trailing colons are stripped
//   from the label; help-like descendants of the label (class help/hint/consequence…) become
//   the help/consequence instead of label text. The raw label (aria-hidden included) is what
//   decides `required`.
// - A radio group's label is its fieldset legend, else the aria-labelledby/aria-label of the
//   group's common wrapper, else the nearest preceding text; options are the radios' labels
//   (else values). Every radio is `required` if any is.
// - Help: aria-describedby, else the first help-class element inside the box (`.form-text`,
//   `.help-block`, `.hint`, `.consequence`…, ≤ 500 chars), else the small text right after the
//   control (≤ 200 chars). Consumed elements never become text blocks.
// - Select options drop the placeholder (`value=""`, or a leading "Select…/Choose…/请选择").
// - Decisions: `optional = !required && !attestation`; a required checkbox is not optional and,
//   like an attestation, is `critical` ("required to submit").
// - Input types: datetime-local/month/week → date, range → number, everything unknown → text.
import type { InputType } from '@engine/schema.ts';
import { controlBox, otherControls } from './boxes.ts';
import type { ControlInfo, ExtractContext } from './context.ts';
import { ATTESTATION, isHeading } from './kinds.ts';
import { attr, classString, collapse, containsControl, hasToken, humanise, isHidden, textLength, textOf } from './text.ts';

const HELP_EXACT = ['help', 'hint', 'hints', 'desc', 'description', 'note', 'notes', 'tip', 'tips', 'consequence', 'helper', 'explain', 'explanation', 'muted', 'caption'];
const HELP_PREFIX = ['help', 'hint', 'desc', 'tip'];
const HELP_STRING = /\b(?:form-text|help-block|hint-text|helper-text|field-description|field-hint)\b/;
const REQUIRED_MARK = /[*＊]|必填|\(\s*required\s*\)|（\s*必填\s*）|\brequired\b/i;
const PLACEHOLDER_OPTION = /^(?:-+|—+|…|select|choose|please|pick|请选择|请选|选择|--)/i;
const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search']);
const CONSUMABLE = new Set(['span', 'div', 'td', 'th', 'p', 'b', 'strong', 'small', 'font', 'label', 'legend', 'em', 'i', 'dt']);

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
}

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
  const ordered: { el: Element; kind: 'field' | 'decision' | 'radio'; members: Element[] }[] = [];
  const groups = new Map<string, Element[]>();
  for (const el of Array.from(body.querySelectorAll('input,select,textarea'))) {
    if (isSkippedDeep(el, body, hiddenCache)) continue;
    if (el.closest('nav,[role=navigation],[role=search]')) continue;
    const type = el.localName === 'input' ? attr(el, 'type').toLowerCase() || 'text' : el.localName;
    if (SKIP_INPUT_TYPES.has(type)) continue;
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

  // 3. per-control details
  for (const item of ordered) {
    try {
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

function chooseFormRoot(controls: Element[], ctx: ExtractContext): Element | null {
  if (controls.length === 0) return null;
  const counts = new Map<Element, number>();
  for (const c of controls) {
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
  if (best) return best;
  const inMain = controls.filter((c) => ctx.main.contains(c));
  const pool = inMain.length > 0 ? inMain : controls;
  let common: Element | null = pool[0]!.parentElement;
  for (const c of pool) while (common && !common.contains(c)) common = common.parentElement;
  if (!common || common === ctx.body || common === ctx.doc.documentElement) return ctx.main;
  return common;
}

function resolveLabel(el: Element, labelsFor: Map<string, Element[]>, ctx: ExtractContext): LabelResult {
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
  for (const name of ['aria-label', 'placeholder', 'title']) {
    const v = cleanLabel(attr(el, name));
    if (v) return { el: null, text: v, raw: v };
  }
  if (el.localName === 'select') {
    const placeholder = placeholderOption(el);
    if (placeholder) return { el: null, text: cleanLabel(placeholder), raw: placeholder };
  }
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

/** The nearest preceding short text (≤ 60 chars) — walking back through siblings and up. */
function precedingText(el: Element, ctx: ExtractContext): LabelResult | null {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.form && node !== ctx.main && node.localName !== 'form') {
    let prev: Node | null = node.previousSibling;
    while (prev) {
      if (prev.nodeType === 3) {
        const t = collapse(prev.nodeValue ?? '');
        if (t) return t.length <= 60 ? { el: null, text: cleanLabel(t), raw: t } : null;
      } else if (prev.nodeType === 1) {
        const pe = prev as Element;
        if (!isHidden(pe) && !containsControl(pe) && !pe.querySelector('button')) {
          const t = textOf(pe, { max: 200 });
          if (t) {
            if (t.length > 60) return null;
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

function isRequired(el: Element, rawLabel: string): boolean {
  if (el.hasAttribute('required')) return true;
  if (attr(el, 'aria-required').toLowerCase() === 'true') return true;
  return REQUIRED_MARK.test(rawLabel);
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

function findHelp(control: Element, labelEl: Element | null, box: Element, ctx: ExtractContext, members: Element[]): string | undefined {
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
  let after: Element | null = control.nextElementSibling;
  if (!after && labelEl && labelEl.contains(control)) after = labelEl.nextElementSibling;
  if (!after && control.parentElement && control.parentElement !== box) after = control.parentElement.nextElementSibling;
  if (after && ['small', 'span', 'div', 'p'].includes(after.localName) && !isHidden(after) && !containsControl(after) && !after.querySelector('button,a[href]') && after !== labelEl && !isHeading(after)) {
    const text = textOf(after, { max: 220 });
    if (text && text.length <= 200 && textLength(after) <= 200) {
      ctx.consumed.add(after);
      return text;
    }
  }
  return undefined;
}

function describeControl(el: Element, kind: 'field' | 'decision', labelsFor: Map<string, Element[]>, ctx: ExtractContext): ControlInfo | null {
  const label = resolveLabel(el, labelsFor, ctx);
  if (!label.text) return null;
  if (label.el) ctx.consumed.add(label.el);
  const box = controlBox({ control: el, members: [], labelEl: label.el, own: [], isHelp: isHelpEl }, ctx);
  const help = findHelp(el, label.el, box, ctx, []);
  const required = isRequired(el, label.raw);
  const info: ControlInfo = {
    el,
    kind,
    members: [],
    labelEl: label.el,
    label: label.text,
    required,
    inputType: inputTypeOf(el),
    checked: kind === 'decision' ? isChecked(el) : false,
    attestation: kind === 'decision' && ATTESTATION.test(label.text),
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
  for (const radio of members) {
    const l = resolveLabel(radio, labelsFor, ctx);
    if (l.el) {
      memberLabels.push(l.el);
      ctx.consumed.add(l.el);
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
  if (fieldset && legend && otherControls(fieldset, first, members).length === 0) {
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
  if (!label) {
    const preceding = precedingText(common && common !== ctx.form ? common : first, ctx);
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
  const help = findHelp(first, labelEl, box, ctx, members);
  const required = members.some((m) => isRequired(m, '')) || REQUIRED_MARK.test(raw);
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
