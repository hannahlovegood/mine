// Text and DOM primitives shared by the extractor: visibility, block-level detection, class
// tokens, and a text reader that mimics `innerText` while honouring the contract's skip rules.
//
// Decisions the contract left open (EXTENSION.md §1):
// - Text is read by our own walker in both environments rather than `innerText`: `innerText`
//   would include `aria-hidden` decorations (★★★★★, required asterisks) and, in happy-dom, is
//   plain `textContent`. The walker skips script/style/template/noscript, hidden and aria-hidden
//   subtrees and form controls' inner text (option lists), inserts a space at block boundaries
//   (tag whitelist, inline `display`, computed `display` when a window is available) and at
//   `<br>`, collapses whitespace and caps at 2000 characters.
// - Visibility: `hidden`, `aria-hidden="true"`, `type=hidden`, closed `<dialog>`, inline
//   `display:none` / `visibility:hidden`, then `checkVisibility()` where it exists (Chrome and
//   happy-dom both have it; a `display: contents` element is not treated as hidden), else
//   `getComputedStyle`, else `getClientRects().length === 0`. Every DOM call is guarded.
// - Custom elements whose tag starts with `mine-` are skipped along with `mine-root`, so the
//   applier's stubs/callouts never become blocks on a re-extraction.
// - `svg`, `math`, `canvas`, `iframe`, `object`, `embed`, `video`, `audio` and `map` subtrees are
//   skipped entirely (the contract lists only img/figure/picture as media).

export const SKIP_TAGS = new Set([
  'script', 'style', 'template', 'noscript', 'head', 'meta', 'link', 'base', 'title',
  'svg', 'math', 'canvas', 'iframe', 'object', 'embed', 'video', 'audio', 'map', 'area',
  'option', 'optgroup', 'datalist', 'br', 'wbr', 'hr',
]);

/** Tags that are block-level by default (used where no computed style is available). */
export const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'center', 'dd', 'details', 'dialog', 'div',
  'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hgroup', 'hr', 'legend', 'li', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'summary',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

const BLOCK_DISPLAYS = new Set(['block', 'flex', 'grid', 'table', 'table-row', 'table-cell', 'table-caption', 'list-item', 'flow-root', 'inline-block']);

export const CONTROL_SELECTOR = 'input,select,textarea';

/** The window of `doc`, when there is one (happy-dom's DOMParser documents have one too). */
export function viewOf(doc: Document): (Window & typeof globalThis) | null {
  try {
    return (doc.defaultView as (Window & typeof globalThis) | null) ?? null;
  } catch {
    return null;
  }
}

export function computedStyle(el: Element): CSSStyleDeclaration | null {
  try {
    const view = viewOf(el.ownerDocument);
    if (!view || typeof view.getComputedStyle !== 'function') return null;
    return view.getComputedStyle(el);
  } catch {
    return null;
  }
}

export function attr(el: Element, name: string): string {
  try {
    return el.getAttribute(name) ?? '';
  } catch {
    return '';
  }
}

export function isMineUi(el: Element): boolean {
  return el.localName.startsWith('mine-');
}

function inlineStyle(el: Element): { display: string; visibility: string; position: string } {
  const style = (el as HTMLElement).style;
  if (style && typeof style === 'object') {
    return {
      display: (style.display ?? '').toLowerCase(),
      visibility: (style.visibility ?? '').toLowerCase(),
      position: (style.position ?? '').toLowerCase(),
    };
  }
  const raw = attr(el, 'style').toLowerCase();
  const pick = (prop: string): string => raw.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;!]+)`))?.[1]?.trim() ?? '';
  return { display: pick('display'), visibility: pick('visibility'), position: pick('position') };
}

/** True when `el` itself must be skipped (its subtree with it). Does not look at ancestors. */
export function isHidden(el: Element): boolean {
  try {
    const tag = el.localName;
    if (SKIP_TAGS.has(tag) || isMineUi(el)) return true;
    if (el.hasAttribute('hidden')) return true;
    if (attr(el, 'aria-hidden').trim().toLowerCase() === 'true') return true;
    if (tag === 'input' && attr(el, 'type').toLowerCase() === 'hidden') return true;
    if (tag === 'dialog' && !el.hasAttribute('open')) return true;
    const inline = inlineStyle(el);
    if (inline.display === 'none' || inline.visibility === 'hidden') return true;
    const anyEl = el as Element & { checkVisibility?: (o?: { visibilityProperty?: boolean }) => boolean };
    if (typeof anyEl.checkVisibility === 'function') {
      const visible = anyEl.checkVisibility({ visibilityProperty: true });
      if (visible) return false;
      const display = computedStyle(el)?.display;
      return display !== 'contents';
    }
    const cs = computedStyle(el);
    if (cs) return cs.display === 'none' || cs.visibility === 'hidden';
    if (typeof el.getClientRects === 'function') return el.getClientRects().length === 0;
    return false;
  } catch {
    return false;
  }
}

/** Block-level for the purpose of spacing text and deciding what a "leaf" is. */
export function isBlockLevel(el: Element): boolean {
  const tag = el.localName;
  if (BLOCK_TAGS.has(tag)) return true;
  const inline = inlineStyle(el).display;
  if (inline) return BLOCK_DISPLAYS.has(inline);
  const cs = computedStyle(el);
  if (cs && cs.display) return BLOCK_DISPLAYS.has(cs.display);
  return false;
}

/** Position from inline or computed style, lowercase ('' when unknown). */
export function positionOf(el: Element): string {
  const inline = inlineStyle(el).position;
  if (inline) return inline;
  return (computedStyle(el)?.position ?? '').toLowerCase();
}

export function isFormControl(el: Element): boolean {
  const tag = el.localName;
  return tag === 'input' || tag === 'select' || tag === 'textarea';
}

export function containsControl(el: Element): boolean {
  try {
    for (const c of Array.from(el.querySelectorAll(CONTROL_SELECTOR))) {
      if (!(c.localName === 'input' && attr(c, 'type').toLowerCase() === 'hidden')) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const tokenCache = new WeakMap<Element, string[]>();

/** Lower-cased tokens of class and id, split on non-alphanumerics and camelCase. */
export function classTokens(el: Element): string[] {
  let tokens = tokenCache.get(el);
  if (tokens) return tokens;
  const raw = `${attr(el, 'class')} ${attr(el, 'id')}`;
  tokens = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  tokenCache.set(el, tokens);
  return tokens;
}

/** True when a class/id token equals one of `exact` or starts with one of `prefix`. */
export function hasToken(el: Element, exact: readonly string[], prefix: readonly string[] = []): boolean {
  const tokens = classTokens(el);
  return tokens.some((t) => exact.includes(t) || prefix.some((p) => t.startsWith(p)));
}

/** The lower-cased class + id string, for multi-token patterns such as back-to-top. */
export function classString(el: Element): string {
  return `${attr(el, 'class')} ${attr(el, 'id')}`.toLowerCase();
}

export function collapse(s: string): string {
  return s.replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

export const MAX_TEXT = 2000;

export interface TextOptions {
  /** Subtrees to leave out (help texts inside a label, actions inside a banner…). */
  exclude?: (el: Element) => boolean;
  /** Include hidden/aria-hidden text (used to detect required marks). Default false. */
  raw?: boolean;
  /** Cap; default MAX_TEXT. */
  max?: number;
}

/** Visible, whitespace-collapsed text of `el`, ≤ 2000 chars. Never throws. */
export function textOf(el: Element, opts: TextOptions = {}): string {
  const parts: string[] = [];
  let length = 0;
  const max = opts.max ?? MAX_TEXT;
  const walk = (node: Node): boolean => {
    if (length > max * 2) return false;
    if (node.nodeType === 3) {
      const t = node.nodeValue ?? '';
      if (t) {
        parts.push(t);
        length += t.length;
      }
      return true;
    }
    if (node.nodeType !== 1) return true;
    const e = node as Element;
    if (e.localName === 'br' || e.localName === 'hr') {
      parts.push(' ');
      return true;
    }
    if (opts.exclude?.(e) || (opts.raw ? SKIP_TAGS.has(e.localName) || isMineUi(e) : isHidden(e))) {
      if (e !== el && !SKIP_TAGS.has(e.localName) && isBlockLevel(e)) parts.push(' ');
      return true;
    }
    if (e !== el && (isFormControl(e) || e.localName === 'button')) {
      parts.push(' ');
      return true;
    }
    const block = isBlockLevel(e);
    if (block) parts.push(' ');
    for (let child = e.firstChild; child; child = child.nextSibling) {
      if (!walk(child)) return false;
    }
    if (block) parts.push(' ');
    return true;
  };
  try {
    walk(el);
  } catch {
    /* fall through with what we have */
  }
  const text = collapse(parts.join(''));
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

/** `textContent` length of an element, skipping script/style, memoised per document walk. */
const lengthCache = new WeakMap<Element, number>();
export function textLength(el: Element): number {
  const cached = lengthCache.get(el);
  if (cached !== undefined) return cached;
  let n = 0;
  try {
    if (!isHidden(el)) {
      for (let child = el.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) n += collapse(child.nodeValue ?? '').length;
        else if (child.nodeType === 1) n += textLength(child as Element);
      }
    }
  } catch {
    n = 0;
  }
  lengthCache.set(el, n);
  return n;
}

/** Nearest ancestor (inclusive) satisfying `pred`, stopping before `stop`. */
export function closestUpTo(el: Element, pred: (e: Element) => boolean, stop: (e: Element) => boolean): Element | null {
  let node: Element | null = el;
  while (node && !stop(node)) {
    if (pred(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/** `a` comes before `b` in document order. */
export function precedes(a: Node, b: Node): boolean {
  try {
    return (a.compareDocumentPosition(b) & 4) !== 0; // Node.DOCUMENT_POSITION_FOLLOWING
  } catch {
    return false;
  }
}

/** Humanises an attribute name ("first_name" → "First name"). */
export function humanise(name: string): string {
  return collapse(name.replace(/[_\-.[\]]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'))
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function isCjk(text: string): boolean {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const letters = (text.match(/[A-Za-z㐀-鿿豈-﫿]/g) ?? []).length;
  return letters > 0 && cjk / letters >= 0.1;
}
