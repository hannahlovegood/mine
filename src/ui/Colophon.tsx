// The colophon: how this edition was made. Every number is computed from `changes`.
import { Fragment, type ReactNode } from 'react';
import type { ContentBlock, Lang, MinePreferences } from '../engine/schema.ts';
import type { Change, Transformation } from '../engine/transform.ts';
import { copy, t, type CopyKey } from '../copy.ts';
import { blockName } from './blockNames.ts';
import { useCountUp } from './useCountUp.ts';
import { DecisionsCard } from './DecisionsCard.tsx';
import { HoldToCompare } from './HoldToCompare.tsx';
import type { WordsResult } from './useMine.ts';
import { usePrefersReducedMotion } from './a11y.tsx';
import { fieldsInSteps } from './summary.ts';

interface Props {
  tr: Transformation;
  lang: Lang;
  prefs: MinePreferences;
  lookup: (id: string) => ContentBlock | undefined;
  words: WordsResult | null;
  showWhy: boolean;
  isOriginal: boolean;
  comparing: boolean;
  setComparing: (on: boolean) => void;
  onReset: () => void;
  onInspect: (ids: string[] | null) => void;
  restored: Set<string>;
  onRestore: (ids: string[], on: boolean) => void;
  originals: Set<string>;
  onOriginal: (id: string, on: boolean) => void;
  animateCounts?: boolean;
}

/** Fills a copy template, replacing {n}/{fields}/{steps} with animated numbers. */
function Frag({ tpl, values }: { tpl: string; values: Record<string, number> }): ReactNode {
  const parts = tpl.split(/(\{[a-z]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{([a-z]+)\}$/.exec(p);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        const v = values[m[1] ?? ''];
        return (
          <span className="n" key={i}>
            {v ?? p}
          </span>
        );
      })}
    </>
  );
}

function pluralKey(base: string, n: number): CopyKey {
  const one = `${base}.one` as CopyKey;
  const many = `${base}.many` as CopyKey;
  return n === 1 && one in copy ? one : many;
}

function Summary({ tr, lang, animateCounts }: { tr: Transformation; lang: Lang; animateCounts: boolean }) {
  const s = tr.summary;
  const reduced = usePrefersReducedMotion();
  const on = animateCounts && !reduced;
  const fieldsN = fieldsInSteps(tr);
  const hidden = useCountUp(s.hidden, 600, on);
  const collapsed = useCountUp(s.collapsed, 600, on);
  const moved = useCountUp(s.moved, 600, on);
  const rewritten = useCountUp(s.rewritten, 600, on);
  const translated = useCountUp(s.translated, 600, on);
  const explained = useCountUp(s.explained, 600, on);
  const enlarged = useCountUp(s.enlarged, 600, on);
  const steps = useCountUp(s.steps, 600, on);
  const fields = useCountUp(fieldsN, 600, on);
  const surfaced = useCountUp(s.surfaced, 600, on);

  const frags: ReactNode[] = [];
  const push = (base: string, target: number, shown: number) => {
    if (!target) return;
    frags.push(<Frag key={base} tpl={copy[pluralKey(base, target)][lang]} values={{ n: shown }} />);
  };
  push('colophon.frag.hidden', s.hidden, hidden);
  push('colophon.frag.collapsed', s.collapsed, collapsed);
  push('colophon.frag.moved', s.moved, moved);
  push('colophon.frag.rewritten', s.rewritten, rewritten);
  push('colophon.frag.translated', s.translated, translated);
  push('colophon.frag.explained', s.explained, explained);
  push('colophon.frag.enlarged', s.enlarged, enlarged);
  if (s.steps) frags.push(<Frag key="steps" tpl={copy['colophon.frag.steps'][lang]} values={{ fields, steps }} />);
  push('colophon.frag.surfaced', s.surfaced, surfaced);
  if (frags.length === 0) return <p className="summary">{t(lang, 'colophon.none')}</p>;
  const sep = lang === 'zh' ? '，' : ', ';
  const end = lang === 'zh' ? '。' : '.';
  return (
    <p className="summary">
      {t(lang, 'colophon.prefix')}{' '}
      {frags.map((f, i) => (
        <Fragment key={i}>
          {f}
          {i < frags.length - 1 ? sep : end}
        </Fragment>
      ))}
    </p>
  );
}

function names(c: Change, lookup: Props['lookup'], lang: Lang): string {
  const ns = c.blockIds.map((id) => lookup(id)).filter((b): b is ContentBlock => !!b).map((b) => blockName(b, lang));
  if (ns.length <= 3) return ns.join(lang === 'zh' ? '、' : ', ');
  const more = ns.length - 3;
  return `${ns.slice(0, 3).join(lang === 'zh' ? '、' : ', ')}${lang === 'zh' ? ` 等 ${ns.length} 项` : ` and ${more} more`}`;
}

export function Colophon(p: Props) {
  const { tr, lang } = p;
  const changes = tr.changes;
  return (
    <div className="colophon">
      <h2>{t(lang, 'colophon.title')}</h2>
      <Summary tr={tr} lang={lang} animateCounts={p.animateCounts ?? true} />

      {changes.length > 0 && (
        <section aria-label={t(lang, 'colophon.every')}>
          <h3>{t(lang, 'colophon.every')}</h3>
          <ul className="changes">
            {changes.map((c, i) => {
              const ids = c.blockIds;
              const restorable = c.type === 'hidden';
              const allRestored = restorable && ids.every((id) => p.restored.has(id));
              const showOrig = (c.type === 'rewritten' || c.type === 'translated') && ids.length === 1 && ids[0] !== undefined;
              const origShown = showOrig && p.originals.has(ids[0]!);
              return (
                <li key={i} onMouseEnter={() => p.onInspect(ids)} onMouseLeave={() => p.onInspect(null)} onFocus={() => p.onInspect(ids)} onBlur={() => p.onInspect(null)}>
                  <div className="head">
                    <span className="type">{t(lang, `colophon.type.${c.type}` as CopyKey)}</span>
                    <span className="count">{c.type === 'stepped' ? '' : ids.length === 1 ? t(lang, 'colophon.blocks.one') : t(lang, 'colophon.blocks', { n: ids.length })}</span>
                  </div>
                  <p className="reason">{c.reason}</p>
                  {c.type !== 'stepped' && <p className="names">{names(c, p.lookup, lang)}</p>}
                  {restorable && (
                    <div className="restore">
                      <button type="button" className="link-btn" aria-pressed={allRestored} onClick={() => p.onRestore(ids, !allRestored)}>
                        {allRestored ? t(lang, 'stub.hide') : t(lang, 'colophon.restore')}
                      </button>
                    </div>
                  )}
                  {showOrig && (
                    <div className="restore">
                      <button type="button" className="link-btn" aria-pressed={origShown} onClick={() => p.onOriginal(ids[0]!, !origShown)}>
                        {origShown ? t(lang, 'rewritten.hide') : t(lang, 'rewritten.show')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {p.prefs.surfaceDecisions && <DecisionsCard d={tr.decisions} lang={lang} onHover={p.onInspect} />}

      {p.showWhy && p.words && (
        <section className="why" aria-label={t(lang, 'colophon.why')}>
          <h3>{t(lang, 'colophon.why')}</h3>
          <ul>
            {p.words.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <span className="badge" data-source={p.words.source}>
            {p.words.source === 'model' ? t(lang, 'words.source.model') : t(lang, 'words.source.fallback')}
          </span>
        </section>
      )}

      <section className="rail-actions" aria-label={t(lang, 'reset')}>
        <HoldToCompare lang={lang} comparing={p.comparing} setComparing={p.setComparing} disabled={p.isOriginal} />
        <button type="button" className="reset" onClick={p.onReset} disabled={p.isOriginal}>
          {t(lang, 'reset')}
        </button>
      </section>
    </div>
  );
}
