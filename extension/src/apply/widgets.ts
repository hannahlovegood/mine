// Injected Mine widgets: plain elements with a shadow root. Every one carries data-mine-injected
// so undo() can remove them all, and hold-to-compare can hide them all.
import { WIDGET_CSS } from './css.ts';

export type Widget = HTMLElement;

function make(tag: string, inline = false): { host: Widget; root: ShadowRoot } {
  const host = document.createElement(tag);
  host.setAttribute('data-mine-injected', '');
  if (inline) host.setAttribute('data-mine-inline', '');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  root.appendChild(style);
  return { host, root };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface StubOptions {
  label: string;
  names?: string;
  showLabel: string;
  hideLabel: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** "n items set aside · Show" */
export function stub(o: StubOptions): Widget {
  const { host, root } = make('mine-stub');
  const box = el('div', 'stub');
  const label = el('span', undefined, o.label);
  const btn = el('button', 'link', o.open ? o.hideLabel : o.showLabel);
  btn.type = 'button';
  btn.setAttribute('aria-expanded', String(o.open));
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(next));
    btn.textContent = next ? o.hideLabel : o.showLabel;
    o.onToggle(next);
  });
  box.append(label, btn);
  if (o.names) box.append(el('span', 'names', o.names));
  root.append(box);
  return host;
}

export interface CalloutOptions {
  label: string;
  date: string;
  moved: string;
  text: string;
  goto: string;
  onGoto: () => void;
}

/** The deadline, echoed at the top of the page. */
export function callout(o: CalloutOptions): Widget {
  const { host, root } = make('mine-callout');
  const box = el('div', 'callout');
  box.setAttribute('role', 'note');
  const label = el('p', 'label');
  label.append(el('span', undefined, o.label), el('span', 'date', o.date), el('span', 'moved', o.moved));
  const text = el('p', 'text', o.text);
  const btn = el('button', 'link', o.goto);
  btn.type = 'button';
  btn.addEventListener('click', o.onGoto);
  box.append(label, text, btn);
  root.append(box);
  return host;
}

/** Notes under a decision: optional/required, pre-checked, consequence. */
export function note(lines: { text: string; pencil?: boolean }[]): Widget {
  const { host, root } = make('mine-note');
  const box = el('div', 'note');
  box.setAttribute('role', 'note');
  for (const l of lines) box.append(el('span', l.pencil ? 'pencil' : undefined, l.text));
  root.append(box);
  return host;
}

/** Terms explained under a passage. */
export function terms(list: { term: string; plain: string }[], sep: string): Widget {
  const { host, root } = make('mine-terms');
  const dl = el('dl', 'terms');
  for (const t of list) {
    const row = el('div');
    row.append(el('dt', undefined, t.term), el('dd', undefined, `${sep}${t.plain}`));
    dl.append(row);
  }
  root.append(dl);
  return host;
}

/** A plain version shown beside the original (legal, decisions, passages with links). */
export function plainAside(tag: string, text: string): Widget {
  const { host, root } = make('mine-plain');
  const box = el('div', 'plain');
  box.append(el('div', 'tag', tag), el('div', undefined, text));
  root.append(box);
  return host;
}

/** "Plain version · Show original" tag line placed before a rewritten passage. */
export function tagline(tag: string, showLabel: string, hideLabel: string, onToggle: (show: boolean) => void): Widget {
  const { host, root } = make('mine-tag');
  const line = el('div', 'tagline');
  const btn = el('button', 'link', showLabel);
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(next));
    btn.textContent = next ? hideLabel : showLabel;
    onToggle(next);
  });
  line.append(el('span', undefined, tag), el('span', 'sep', '·'), btn);
  root.append(line);
  return host;
}

export interface StepperOptions {
  count: number;
  titles: string[];
  choice: boolean[];
  progress: (i: number, n: number) => string;
  choiceLabel: string;
  back: string;
  next: string;
  onChange: (i: number) => void;
}

export interface StepperHandle {
  host: Widget;
  set(i: number): void;
}

/** Step i of n · title · Back / Next */
export function stepper(o: StepperOptions): StepperHandle {
  const { host, root } = make('mine-stepper');
  const box = el('section', 'stepper');
  box.setAttribute('aria-label', o.progress(1, o.count));
  const progress = el('p', 'progress');
  const progressText = el('span');
  const choiceTag = el('span', 'choice', o.choiceLabel);
  progress.append(progressText, choiceTag);
  const title = el('h2', 'title');
  title.tabIndex = -1;
  const nav = el('div', 'nav');
  const back = el('button', 'btn', o.back);
  back.type = 'button';
  const next = el('button', 'btn primary', o.next);
  next.type = 'button';
  const dots = el('div', 'dots');
  dots.setAttribute('aria-hidden', 'true');
  const dotEls: HTMLElement[] = [];
  for (let k = 0; k < o.count; k++) {
    const d = el('i');
    if (o.choice[k]) d.setAttribute('data-choice', '');
    dots.append(d);
    dotEls.push(d);
  }
  nav.append(back, next, dots);
  box.append(progress, title, nav);
  root.append(box);
  let current = 0;
  const render = () => {
    progressText.textContent = o.progress(current + 1, o.count);
    choiceTag.style.display = o.choice[current] ? '' : 'none';
    title.textContent = o.titles[current] ?? '';
    back.disabled = current === 0;
    next.disabled = current === o.count - 1;
    dotEls.forEach((d, k) => (k === current ? d.setAttribute('data-on', '') : d.removeAttribute('data-on')));
  };
  const set = (i: number) => {
    current = Math.max(0, Math.min(o.count - 1, i));
    render();
    o.onChange(current);
  };
  back.addEventListener('click', () => {
    set(current - 1);
    title.focus();
  });
  next.addEventListener('click', () => {
    set(current + 1);
    title.focus();
  });
  render();
  return { host, set };
}
