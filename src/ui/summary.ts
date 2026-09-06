// The summary sentence, composed only from `summary` (which is derived only from `changes`).
import type { Lang } from '../engine/schema.ts';
import type { Transformation } from '../engine/transform.ts';
import { t, tn } from '../copy.ts';

export function fieldsInSteps(tr: Transformation): number {
  return tr.steps ? tr.steps.flatMap((st) => st.blocks).filter((b) => b.kind === 'field').length : 0;
}

export function summarySentence(tr: Transformation, lang: Lang): string {
  const s = tr.summary;
  const frags: string[] = [];
  if (s.hidden) frags.push(tn(lang, 'colophon.frag.hidden', s.hidden));
  if (s.collapsed) frags.push(tn(lang, 'colophon.frag.collapsed', s.collapsed));
  if (s.moved) frags.push(tn(lang, 'colophon.frag.moved', s.moved));
  if (s.rewritten) frags.push(tn(lang, 'colophon.frag.rewritten', s.rewritten));
  if (s.translated) frags.push(tn(lang, 'colophon.frag.translated', s.translated));
  if (s.explained) frags.push(tn(lang, 'colophon.frag.explained', s.explained));
  if (s.enlarged) frags.push(tn(lang, 'colophon.frag.enlarged', s.enlarged));
  if (s.steps) frags.push(t(lang, 'colophon.frag.steps', { fields: fieldsInSteps(tr), steps: s.steps }));
  if (s.surfaced) frags.push(tn(lang, 'colophon.frag.surfaced', s.surfaced));
  if (frags.length === 0) return t(lang, 'colophon.none');
  const sep = lang === 'zh' ? '，' : ', ';
  const end = lang === 'zh' ? '。' : '.';
  return `${t(lang, 'colophon.prefix')} ${frags.join(sep)}${end}`;
}
