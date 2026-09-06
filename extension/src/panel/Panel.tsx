// The Mine panel on a real page: floating button + rail (shadow DOM).
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { MODE_IDS, type ModeId } from '@engine/presets.ts';
import type { Lang } from '@engine/schema.ts';
import { t, tn, type CopyKey } from '@app/copy.ts';
import { blockName } from '@app/ui/blockNames.ts';
import { fieldsInSteps } from '@app/ui/summary.ts';
import type { Controller } from '../controller.ts';

function useController(c: Controller) {
  return useSyncExternalStore(c.subscribe, c.getState, c.getState);
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    <section aria-labelledby="mine-every">
      <h3 id="mine-every">{t(lang, 'colophon.every')}</h3>
      <ul className="changes">
        {s.tr.changes.map((ch, i) => {
          const names = ch.blockIds
            .map(lookup)
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map((b) => blockName(b, lang));
          const shown = names.slice(0, 3).join(lang === 'zh' ? '、' : ', ') + (names.length > 3 ? t(lang, 'ext.andMore', { n: names.length - 3, total: names.length }) : '');
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
    <section className="decisions" aria-labelledby="mine-decisions">
      <h3 id="mine-decisions">{title}</h3>
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
  const busy = !!s.status;
  const ready = !busy && !!s.wordsText.trim();
  const chips = [1, 2, 3, 4, 5].map((n) => t(lang, `words.chip.${n}` as CopyKey));
  const append = (phrase: string) => {
    const base = s.wordsText.trimEnd();
    const punct = /[.!?。！？]$/.test(base);
    const next = !base ? (lang === 'zh' ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1)) : lang === 'zh' ? `${base}${punct ? '' : '。'}${phrase}` : `${base}${punct ? '' : '.'} ${phrase.charAt(0).toUpperCase() + phrase.slice(1)}`;
    c.setWordsText(next);
  };
  const go = () => {
    if (ready) void c.applyWords(s.wordsText);
  };
  return (
    <section aria-labelledby="mine-words" aria-busy={busy}>
      <h3 id="mine-words">{t(lang, 'words.title')}</h3>
      <textarea
        aria-labelledby="mine-words"
        aria-describedby="mine-words-hint"
        value={s.wordsText}
        placeholder={t(lang, 'words.placeholder')}
        onChange={(e) => c.setWordsText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            go();
          }
        }}
      />
      <p className="hint" id="mine-words-hint">
        {t(lang, 'words.hint')} {t(lang, 'ext.words.shortcut')}
      </p>
      <div className="chips">
        {chips.map((ch) => (
          <button key={ch} type="button" className="chip" onClick={() => append(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <div className="row">
        {/* aria-disabled, not disabled: the button keeps focus while the words are being read. */}
        <button type="button" className="btn" aria-disabled={!ready} onClick={go}>
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

/** Mode strip: buttons with aria-pressed. Click / Enter / Space apply; arrow keys only move focus. */
function Modes({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  const busy = !!s.status;
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
    const i = buttons.findIndex((b) => b === (e.currentTarget.getRootNode() as ShadowRoot | Document).activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <div className="modes" role="group" aria-label={t(lang, 'lab.modes')} onKeyDown={onKey}>
      {MODE_IDS.map((id: ModeId) => (
        <button
          key={id}
          type="button"
          data-mode={id}
          aria-pressed={s.mode === id}
          aria-disabled={busy}
          onClick={() => {
            if (!busy) void c.selectMode(id);
          }}
        >
          {t(lang, `modes.${id}` as CopyKey)}
        </button>
      ))}
    </div>
  );
}

export function Panel({ c }: { c: Controller }) {
  const s = useController(c);
  const lang = s.lang;
  const active = s.mode !== 'default' && !!s.tr;
  const fabRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Parked = fully out of the way: inert + visibility:hidden once the slide-out has finished.
  // Any change of `open` un-parks during render; a timer parks again after the transition.
  const [parked, setParked] = useState(!s.open);
  const [prevOpen, setPrevOpen] = useState(s.open);
  if (prevOpen !== s.open) {
    setPrevOpen(s.open);
    setParked(false);
  }

  useEffect(() => {
    if (s.open) {
      // Focus moves into the rail; the fab it came from is hidden meanwhile.
      closeRef.current?.focus({ preventScroll: true });
      wasOpen.current = true;
      return;
    }
    const timer = setTimeout(() => setParked(true), reducedMotion() ? 0 : 180);
    if (wasOpen.current) {
      wasOpen.current = false;
      fabRef.current?.focus({ preventScroll: true });
    }
    return () => clearTimeout(timer);
  }, [s.open]);

  // Escape closes the rail (listener on the shadow root, so it works from any control inside).
  useEffect(() => {
    const root = railRef.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const onKey = (e: Event) => {
      if (!(e instanceof KeyboardEvent) || e.key !== 'Escape' || !c.state.open) return;
      if (e.target instanceof HTMLSelectElement) return; // Escape closes the open select first
      e.stopPropagation();
      c.setOpen(false);
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [c]);

  const onHoldKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      c.compare(!s.comparing);
    }
  };
  const onHoldDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      // Keep the pointer even if the button moves under it (Large resets the zoom while held).
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events carry no active pointer */
    }
    c.compare(true);
  };
  return (
    <>
      <button ref={fabRef} type="button" className="fab" hidden={s.open} data-active={active ? '' : undefined} aria-expanded={s.open} onClick={() => c.toggle()}>
        <span className="m" aria-hidden="true" />
        {active ? t(lang, 'ext.button.active', { mode: t(lang, `modes.${s.mode}` as CopyKey) }) : t(lang, 'ext.button')}
      </button>
      <aside ref={railRef} className="rail" data-open={s.open ? '' : undefined} data-parked={parked && !s.open ? '' : undefined} inert={!s.open} aria-label={t(lang, 'ext.title')} aria-hidden={!s.open}>
        <div className="head">
          <h2 className="brand">
            {t(lang, 'brand.name')}
            <small>{t(lang, 'brand.descriptor')}</small>
          </h2>
          <span className="spacer" />
          <button type="button" className="iconbtn" lang={lang === 'zh' ? 'en' : 'zh'} onClick={() => void c.setLang(lang === 'zh' ? 'en' : 'zh')}>
            <span className="sr">{t(lang, 'nav.langLabel')} </span>
            {t(lang, 'nav.lang')}
          </button>
          <button ref={closeRef} type="button" className="iconbtn" aria-label={t(lang, 'ext.close')} onClick={() => c.setOpen(false)}>
            ×
          </button>
        </div>
        <div className="body">
          <div>
            <Modes c={c} />
            <p className="desc">{t(lang, `modes.${s.mode}.desc` as CopyKey)}</p>
          </div>
          {s.mode === 'words' && <Words c={c} />}
          <section aria-labelledby="mine-changed" aria-busy={!!s.status}>
            <h3 id="mine-changed">{t(lang, 'colophon.title')}</h3>
            {s.status && s.mode !== 'words' && <p className="status">{s.status}</p>}
            <Summary c={c} />
            {s.notice && <p className="notice">{s.notice}</p>}
            {s.page && <p className="desc">{t(lang, 'ext.blocks', { n: s.page.content.blocks.length })}</p>}
            {s.remembered && s.memory && active && <p className="desc">{t(lang, 'ext.remembered', { host: c.hostLabel() })}</p>}
          </section>
          {s.stepCount > 1 && (
            <section aria-label={t(lang, 'step.progress', { i: s.stepIndex + 1, n: s.stepCount })}>
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
              onPointerDown={onHoldDown}
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
      {/* One live region: the working status while a transform runs, then the summary (or the notice). */}
      <div className="sr" aria-live="polite" aria-atomic="true">
        {s.status ?? s.announcement}
      </div>
    </>
  );
}
