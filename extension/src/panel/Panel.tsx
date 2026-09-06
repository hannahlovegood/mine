// The Mine panel on a real page: floating button + rail (shadow DOM).
import { useSyncExternalStore, type KeyboardEvent } from 'react';
import { MODE_IDS, type ModeId } from '@engine/presets.ts';
import type { Lang } from '@engine/schema.ts';
import { t, type CopyKey } from '@app/copy.ts';
import { blockName } from '@app/ui/blockNames.ts';
import { fieldsInSteps } from '@app/ui/summary.ts';
import { tn } from '@app/copy.ts';
import type { Controller } from '../controller.ts';

function useController(c: Controller) {
  return useSyncExternalStore(c.subscribe, c.getState, c.getState);
}

function Summary({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  if (!s.tr) return <p className="summary">{t(lang, 'colophon.none')}</p>;
  const sum = s.tr.summary;
  const frags: string[] = [];
  if (sum.hidden) frags.push(tn(lang, 'colophon.frag.hidden', sum.hidden));
  if (sum.collapsed) frags.push(tn(lang, 'colophon.frag.collapsed', sum.collapsed));
  if (sum.moved) frags.push(tn(lang, 'colophon.frag.moved', sum.moved));
  if (sum.rewritten) frags.push(tn(lang, 'colophon.frag.rewritten', sum.rewritten));
  if (sum.explained) frags.push(tn(lang, 'colophon.frag.explained', sum.explained));
  if (sum.enlarged) frags.push(tn(lang, 'colophon.frag.enlarged', sum.enlarged));
  if (sum.steps) frags.push(t(lang, 'colophon.frag.steps', { fields: fieldsInSteps(s.tr), steps: sum.steps }));
  if (sum.surfaced) frags.push(tn(lang, 'colophon.frag.surfaced', sum.surfaced));
  if (frags.length === 0) return <p className="summary">{t(lang, 'colophon.none')}</p>;
  return (
    <p className="summary">
      {t(lang, 'colophon.prefix')} {frags.join(lang === 'zh' ? '，' : ', ')}
      {lang === 'zh' ? '。' : '.'}
    </p>
  );
}

function Changes({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  if (!s.tr || !s.page) return null;
  const lookup = (id: string) => s.page?.content.blocks.find((b) => b.id === id);
  return (
    <section aria-label={t(lang, 'colophon.every')}>
      <h3>{t(lang, 'colophon.every')}</h3>
      <ul className="changes">
        {s.tr.changes.map((ch, i) => {
          const names = ch.blockIds
            .map(lookup)
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map((b) => blockName(b, lang));
          const shown = names.slice(0, 3).join(lang === 'zh' ? '、' : ', ') + (names.length > 3 ? (lang === 'zh' ? ` 等 ${names.length} 项` : ` and ${names.length - 3} more`) : '');
          const restorable = ch.type === 'hidden';
          const all = restorable && ch.blockIds.every((id) => s.restored.has(id));
          return (
            <li key={i}>
              <div className="head2">
                <span className="type">{t(lang, `colophon.type.${ch.type}` as CopyKey)}</span>
                <span className="count">{ch.type === 'stepped' ? '' : ch.blockIds.length === 1 ? t(lang, 'colophon.blocks.one') : t(lang, 'colophon.blocks', { n: ch.blockIds.length })}</span>
              </div>
              <p className="reason">{ch.reason}</p>
              {ch.type !== 'stepped' && <p className="names">{shown}</p>}
              {restorable && (
                <button type="button" className="link" aria-pressed={all} onClick={() => c.restore(ch.blockIds, !all)}>
                  {all ? t(lang, 'stub.hide') : t(lang, 'colophon.restore')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Decisions({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  if (!s.tr || !s.prefs.surfaceDecisions) return null;
  const d = s.tr.decisions;
  const title = d.count === 0 ? t(lang, 'decisions.title.none') : d.count === 1 ? t(lang, 'decisions.title.one') : t(lang, 'decisions.title', { n: d.count });
  return (
    <section className="decisions" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {[...d.optional, ...d.required].map((b) => (
          <li key={b.id}>
            <span>{b.label}</span>
            <span className="flag">{b.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required')}</span>
            {b.preChecked && <span className="flag pre">{t(lang, 'decisions.prechecked')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Words({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  const chips = [1, 2, 3, 4, 5].map((n) => t(lang, `words.chip.${n}` as CopyKey));
  const append = (phrase: string) => {
    const base = s.wordsText.trimEnd();
    const punct = /[.!?。！？]$/.test(base);
    const next = !base ? (lang === 'zh' ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1)) : lang === 'zh' ? `${base}${punct ? '' : '。'}${phrase}` : `${base}${punct ? '' : '.'} ${phrase.charAt(0).toUpperCase() + phrase.slice(1)}`;
    c.setWordsText(next);
  };
  return (
    <section aria-label={t(lang, 'words.title')}>
      <h3>{t(lang, 'words.title')}</h3>
      <textarea
        value={s.wordsText}
        placeholder={t(lang, 'words.placeholder')}
        onChange={(e) => c.setWordsText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && s.wordsText.trim()) void c.applyWords(s.wordsText);
        }}
      />
      <div className="chips">
        {chips.map((ch) => (
          <button key={ch} type="button" className="chip" onClick={() => append(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={!!s.status || !s.wordsText.trim()} onClick={() => void c.applyWords(s.wordsText)}>
          {t(lang, 'words.button')}
        </button>
        {s.status && <span className="status">{s.status}</span>}
      </div>
      {s.words && s.mode === 'words' && (
        <div className="why">
          <ul>
            {s.words.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <span className="badge" data-source={s.words.source}>
            {s.words.source === 'model' ? t(lang, 'words.source.model') : t(lang, 'words.source.fallback')}
          </span>
        </div>
      )}
    </section>
  );
}

function Settings({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  return (
    <details className="settings">
      <summary>{t(lang, 'ext.settings')}</summary>
      <label>
        {t(lang, 'ext.server')}
        <input
          type="text"
          defaultValue={s.settings.server}
          placeholder="https://…"
          onBlur={(e) => void c.saveSettings({ ...s.settings, server: e.target.value.trim() })}
        />
      </label>
      <p className="hint">{t(lang, 'ext.server.hint')}</p>
      <label>
        {t(lang, 'ext.lang')}
        <select value={s.settings.lang} onChange={(e) => void c.saveSettings({ ...s.settings, lang: e.target.value as 'auto' | Lang })}>
          <option value="auto">{t(lang, 'ext.lang.auto')}</option>
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </label>
    </details>
  );
}

export function Panel({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  const active = s.mode !== 'default' && !!s.tr;
  const onHoldKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      c.compare(!s.comparing);
    }
  };
  return (
    <>
      <button type="button" className="fab" data-active={active ? '' : undefined} aria-expanded={s.open} onClick={() => c.toggle()}>
        <span className="m" aria-hidden="true" />
        {active ? t(lang, 'ext.button.active', { mode: t(lang, `modes.${s.mode}` as CopyKey) }) : t(lang, 'ext.button')}
      </button>
      <aside className="rail" data-open={s.open ? '' : undefined} aria-label={t(lang, 'ext.title')} aria-hidden={!s.open}>
        <div className="head">
          <span className="brand">
            {t(lang, 'brand.name')}
            <small>{t(lang, 'brand.descriptor')}</small>
          </span>
          <span className="spacer" />
          <button type="button" className="iconbtn" aria-label={t(lang, 'nav.langLabel')} onClick={() => void c.setLang(lang === 'zh' ? 'en' : 'zh')}>
            {t(lang, 'nav.lang')}
          </button>
          <button type="button" className="iconbtn" aria-label={t(lang, 'ext.close')} onClick={() => c.setOpen(false)}>
            ×
          </button>
        </div>
        <div className="body">
          <div>
            <div className="modes" role="radiogroup" aria-label={t(lang, 'lab.modes')}>
              {MODE_IDS.map((id: ModeId) => (
                <label key={id}>
                  <input type="radio" name="mine-mode" value={id} checked={s.mode === id} onChange={() => void c.selectMode(id)} />
                  <span>{t(lang, `modes.${id}` as CopyKey)}</span>
                </label>
              ))}
            </div>
            <p className="desc">{t(lang, `modes.${s.mode}.desc` as CopyKey)}</p>
          </div>
          {s.mode === 'words' && <Words c={c} />}
          <section>
            <h2>{t(lang, 'colophon.title')}</h2>
            {s.status && s.mode !== 'words' && <p className="status">{s.status}</p>}
            <Summary c={c} />
            {s.notice && <p className="notice">{s.notice}</p>}
            {s.page && <p className="desc">{t(lang, 'ext.blocks', { n: s.page.content.blocks.length })}</p>}
            {s.remembered && active && <p className="desc">{t(lang, 'ext.remembered', { host: location.hostname })}</p>}
          </section>
          {s.stepCount > 1 && (
            <section>
              <div className="stepnav">
                <span>{t(lang, 'step.progress', { i: s.stepIndex + 1, n: s.stepCount })}</span>
                <button type="button" className="btn secondary" disabled={s.stepIndex === 0} onClick={() => c.setStep(s.stepIndex - 1)}>
                  {t(lang, 'step.back')}
                </button>
                <button type="button" className="btn" disabled={s.stepIndex >= s.stepCount - 1} onClick={() => c.setStep(s.stepIndex + 1)}>
                  {t(lang, 'step.next')}
                </button>
              </div>
            </section>
          )}
          <Changes c={c} />
          <Decisions c={c} />
          <section className="actions">
            <button
              type="button"
              className="hold"
              aria-pressed={s.comparing}
              disabled={!active}
              onPointerDown={(e) => {
                e.preventDefault();
                c.compare(true);
              }}
              onPointerUp={() => c.compare(false)}
              onPointerCancel={() => c.compare(false)}
              onPointerLeave={() => s.comparing && c.compare(false)}
              onKeyDown={onHoldKey}
              onClick={(e) => e.preventDefault()}
            >
              {s.comparing ? t(lang, 'hold.showing') : t(lang, 'hold')}
              <span className="sr"> — {t(lang, 'hold.keyboard')}</span>
            </button>
            <button type="button" className="reset" disabled={!active} onClick={() => void c.reset()}>
              {t(lang, 'reset')}
            </button>
          </section>
          <section>
            <Settings c={c} />
          </section>
        </div>
      </aside>
      <div className="sr" aria-live="polite" aria-atomic="true">
        {s.announcement}
      </div>
    </>
  );
}
