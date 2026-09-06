// Text helpers shared by both pages: paragraph/list parsing and inline term buttons.
import { Fragment, type ReactNode } from 'react';
import type { Term } from '../engine/schema.ts';

export interface Line {
  kind: 'p' | 'ul' | 'ol';
  items: string[];
}

/** Splits text on newlines into paragraphs and "- " / "1. " lists. */
export function parseLines(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const ul = /^[-•]\s+(.*)$/.exec(line);
    const ol = /^(\d+|[一二三四五六七八九十]+)[.、．)]\s*(.*)$/.exec(line);
    const kind: Line['kind'] = ul ? 'ul' : ol ? 'ol' : 'p';
    const item = ul ? ul[1]! : ol ? ol[2]! : line;
    const last = out[out.length - 1];
    if (kind !== 'p' && last && last.kind === kind) last.items.push(item);
    else out.push({ kind, items: [item] });
  }
  return out;
}

export interface TermProps {
  terms: Term[];
  openTerm: string | null;
  onToggle: (term: string) => void;
}

/** Wraps the first occurrence of each term (in `text`) in a button. */
export function withTerms(text: string, t?: TermProps): ReactNode {
  if (!t || t.terms.length === 0) return text;
  const hits: { start: number; end: number; term: Term }[] = [];
  const lower = text.toLowerCase();
  for (const term of t.terms) {
    const i = lower.indexOf(term.term.toLowerCase());
    if (i < 0) continue;
    const end = i + term.term.length;
    if (hits.some((h) => i < h.end && end > h.start)) continue;
    hits.push({ start: i, end, term });
  }
  if (hits.length === 0) return text;
  hits.sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  hits.forEach((h, n) => {
    if (h.start > cursor) parts.push(text.slice(cursor, h.start));
    const open = t.openTerm === h.term.term;
    parts.push(
      <button key={`${h.term.term}-${n}`} type="button" className="term" aria-expanded={open} onClick={() => t.onToggle(h.term.term)}>
        {text.slice(h.start, h.end)}
      </button>,
    );
    cursor = h.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
