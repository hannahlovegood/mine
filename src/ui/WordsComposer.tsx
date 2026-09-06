import { useId } from 'react';
import type { Lang } from '../engine/schema.ts';
import { t, type CopyKey } from '../copy.ts';
import type { WordsResult } from './useMine.ts';

interface Props {
  lang: Lang;
  text: string;
  setText: (s: string) => void;
  working: boolean;
  onTransform: (text: string) => void;
  result: WordsResult | null;
}

function appendPhrase(text: string, phrase: string, lang: Lang): string {
  const base = text.trimEnd();
  if (!base) return lang === 'zh' ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const endsWithPunct = /[.!?。！？]$/.test(base);
  if (lang === 'zh') return `${base}${endsWithPunct ? '' : '。'}${phrase}`;
  const p = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return `${base}${endsWithPunct ? '' : '.'} ${p}`;
}

export function WordsComposer({ lang, text, setText, working, onTransform, result }: Props) {
  const id = useId();
  const chips = [1, 2, 3, 4, 5].map((n) => t(lang, `words.chip.${n}` as CopyKey));
  return (
    <section className="composer" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t(lang, 'words.title')}</h2>
      <label className="sr-only" htmlFor={`${id}-text`}>
        {t(lang, 'words.title')}
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        placeholder={t(lang, 'words.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) onTransform(text);
        }}
        rows={3}
      />
      <div className="chips" aria-label={lang === 'zh' ? '示例' : 'Examples'}>
        {chips.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => setText(appendPhrase(text, c, lang))}>
            {c}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={working || !text.trim()} onClick={() => onTransform(text)}>
          {t(lang, 'words.button')}
        </button>
        {text && !working && (
          <button type="button" className="text-btn" onClick={() => setText('')}>
            {t(lang, 'words.clear')}
          </button>
        )}
        <span className="status" role="status">
          {working ? t(lang, 'words.working') : ''}
        </span>
      </div>
      {result && !working && (
        <div className="why">
          <ul>
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <span className="badge" data-source={result.source}>
            {result.source === 'model' ? t(lang, 'words.source.model') : t(lang, 'words.source.fallback')}
            {' · '}
            {result.ms} ms
          </span>
        </div>
      )}
      <p className="hint">{t(lang, 'words.hint')}</p>
    </section>
  );
}
