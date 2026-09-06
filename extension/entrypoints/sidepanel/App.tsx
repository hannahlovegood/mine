// The side panel: one statement and one button before, the colophon after.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { animate } from 'motion/react';
import { PRESET_IDS, type ModeId, type PresetId } from '@engine/presets.ts';
import { t, type CopyKey } from '@app/copy.ts';
import type { Lang } from '@engine/schema.ts';
import type { PanelCommand, Snapshot } from '../../src/bridge.ts';
import type { Settings } from '../../src/controller.ts';

type Tab = { id: number } | null;

async function activeTab(): Promise<Tab> {
  const q = new URLSearchParams(location.search).get('tab');
  if (q) return { id: Number(q) };
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined ? { id: tab.id } : null;
}

function useBridge() {
  const [tab, setTab] = useState<Tab>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const tabRef = useRef<Tab>(null);
  tabRef.current = tab;
  const injected = useRef<Set<number>>(new Set());

  const send = useCallback(async (cmd: PanelCommand) => {
    const id = tabRef.current?.id;
    if (id === undefined) return;
    const ask = async () => (await browser.tabs.sendMessage(id, { kind: 'MINE_CMD', cmd })) as Snapshot | undefined;
    try {
      const res = await ask();
      if (res) {
        setSnap(res);
        setUnreachable(false);
      }
    } catch {
      // No content script in this tab (opened before Mine was installed or updated): inject once, retry.
      if (!injected.current.has(id)) {
        injected.current.add(id);
        try {
          const r = (await browser.runtime.sendMessage({ type: 'INJECT', tabId: id })) as { ok?: boolean } | undefined;
          if (r?.ok) {
            await new Promise((res) => setTimeout(res, 350));
            const again = await ask();
            if (again) {
              setSnap(again);
              setUnreachable(false);
              return;
            }
          }
        } catch {
          /* fall through */
        }
      }
      setUnreachable(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const tb = await activeTab();
      if (!alive) return;
      setTab(tb);
      tabRef.current = tb;
      setSnap(null);
      await send({ type: 'GET_STATE' });
    };
    void refresh();
    const onActivated = () => void refresh();
    const onUpdated = (_id: number, info: { status?: string }) => {
      if (info.status === 'complete') void refresh();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    const onMessage = (msg: { type?: string; snapshot?: Snapshot }, sender: { tab?: { id?: number } }) => {
      if (msg?.type === 'MINE_STATE' && msg.snapshot && sender.tab?.id === tabRef.current?.id) {
        setSnap(msg.snapshot);
        setUnreachable(false);
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      alive = false;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, [send]);

  return { tab, snap, unreachable, send };
}

/** Numbers in the summary count up after the page settles (the one moment of delight). */
function CountingText({ text }: { text: string }) {
  const parts = text.split(/(\d+)/);
  return (
    <>
      {parts.map((p, i) => (/^\d+$/.test(p) ? <Count key={`${i}-${p}`} n={Number(p)} /> : <span key={i}>{p}</span>))}
    </>
  );
}
function Count({ n }: { n: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(n);
      return;
    }
    const c = animate(0, n, { duration: 0.6, delay: 0.5, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [n]);
  return <span className="n">{v}</span>;
}

/** One row per kind of change: "Set aside · 17 blocks", not seven rows that all say "Set aside". */
function groupChanges(changes: Snapshot['changes'], lang: Lang) {
  const order = ['hidden', 'collapsed', 'moved', 'rewritten', 'translated', 'explained', 'enlarged', 'surfaced', 'stepped'] as const;
  const groups = new Map<string, { type: Snapshot['changes'][number]['type']; ids: string[]; count: number; reasons: string[]; names: string[]; restorable: boolean; restored: boolean }>();
  for (const ch of changes) {
    const g = groups.get(ch.type) ?? { type: ch.type, ids: [], count: 0, reasons: [], names: [], restorable: ch.restorable, restored: true };
    g.ids.push(...ch.ids);
    g.count += ch.type === 'stepped' ? 1 : ch.count;
    if (ch.reason && !g.reasons.includes(ch.reason)) g.reasons.push(ch.reason);
    if (ch.names) g.names.push(...ch.names.split(lang === 'zh' ? '、' : ', ').filter((n) => !/^(等 \d+ 项|and \d+ more)$/.test(n)));
    g.restored = g.restored && ch.restored;
    groups.set(ch.type, g);
  }
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((g) => {
      const names = [...new Set(g.names)];
      const shown = names.slice(0, 4).join(lang === 'zh' ? '、' : ', ') + (names.length > 4 ? (lang === 'zh' ? ` 等 ${names.length} 项` : ` and ${names.length - 4} more`) : '');
      // The first reason speaks for the group; region-specific ones repeat the same sentence.
      return { type: g.type, ids: g.ids, count: g.count, reason: g.reasons[0] ?? '', names: g.type === 'stepped' ? '' : shown, restorable: g.restorable, restored: g.restored };
    });
}

function Gear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function Opening({ s, send, busy }: { s: Snapshot; send: (c: PanelCommand) => void; busy: boolean }) {
  const lang = s.lang;
  return (
    <main className="opening">
      <div className="lede">
        <h1 className="statement">{t(lang, 'ext.open.title')}</h1>
        <p className="sub">{t(lang, 'ext.open.sub')}</p>
      </div>
      <button type="button" className="primary" aria-disabled={busy} onClick={() => !busy && send({ type: 'SELECT_MODE', mode: 'focus' })}>
        {busy ? (s.status ?? t(lang, 'ext.reading')) : t(lang, 'ext.button')}
      </button>
      <div>
        <p className="or">{t(lang, 'ext.open.or')}</p>
        <div className="tiles">
          {(['focus', 'plain', 'large', 'translate', 'words'] as ModeId[]).map((id) => (
            <button key={id} type="button" className="tile" onClick={() => !busy && send({ type: 'SELECT_MODE', mode: id })}>
              <b>{t(lang, `modes.${id}` as CopyKey)}</b>
              <span>{t(lang, `modes.${id}.desc` as CopyKey)}</span>
            </button>
          ))}
        </div>
      </div>
      {s.notice && <p className="notice">{s.notice}</p>}
      <p className="promise">{t(lang, 'ext.promise')}</p>
    </main>
  );
}

function Words({ s, send }: { s: Snapshot; send: (c: PanelCommand) => void }) {
  const lang = s.lang;
  const [text, setText] = useState(s.wordsText);
  const chips = [1, 2, 3, 4, 5].map((n) => t(lang, `words.chip.${n}` as CopyKey));
  const append = (phrase: string) => {
    const base = text.trimEnd();
    const punct = /[.!?。！？]$/.test(base);
    const cap = lang === 'zh' ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1);
    setText(!base ? cap : lang === 'zh' ? `${base}${punct ? '' : '。'}${phrase}` : `${base}${punct ? '' : '.'} ${cap}`);
  };
  const go = () => text.trim() && send({ type: 'APPLY_WORDS', text });
  return (
    <section aria-labelledby="words-title" aria-busy={!!s.status}>
      <h3 id="words-title">{t(lang, 'words.title')}</h3>
      <textarea
        aria-labelledby="words-title"
        value={text}
        placeholder={t(lang, 'words.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => send({ type: 'SET_WORDS_TEXT', text })}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') go();
        }}
      />
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => append(c)}>
            {c}
          </button>
        ))}
      </div>
      <button type="button" className="primary" aria-disabled={!!s.status || !text.trim()} onClick={go}>
        {s.status ?? t(lang, 'words.button')}
      </button>
      {s.words && (
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

function Edition({ s, send }: { s: Snapshot; send: (c: PanelCommand) => void }) {
  const lang = s.lang;
  const busy = !!s.status;
  const hold = (on: boolean) => send({ type: 'COMPARE', on });
  const onHoldKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      hold(!s.comparing);
    }
  };
  return (
    <>
      <main className="edition">
        <div className="pills" role="group" aria-label={t(lang, 'lab.modes')}>
          {([...PRESET_IDS.filter((p) => p !== 'default'), 'translate', 'words'] as (PresetId | 'translate' | 'words')[]).map((id) => (
            <button key={id} type="button" className="pill" aria-pressed={s.mode === id} aria-disabled={busy} onClick={() => !busy && send({ type: 'SELECT_MODE', mode: id })}>
              {t(lang, `modes.${id}` as CopyKey)}
            </button>
          ))}
        </div>
        {s.mode === 'words' && <Words s={s} send={send} />}
        {s.status && s.mode !== 'words' && <p className="status">{s.status}</p>}
        {s.summary && (
          <h1 className="summary">
            <CountingText text={s.summary} />
          </h1>
        )}
        {s.notice && <p className="notice">{s.notice}</p>}
        {s.stepCount > 1 && (
          <div className="steps">
            <span>{t(lang, 'step.progress', { i: s.stepIndex + 1, n: s.stepCount })}</span>
            <button type="button" className="small" disabled={s.stepIndex === 0} onClick={() => send({ type: 'SET_STEP', index: s.stepIndex - 1 })} aria-label={t(lang, 'step.back')}>
              ‹
            </button>
            <button type="button" className="small" disabled={s.stepIndex >= s.stepCount - 1} onClick={() => send({ type: 'SET_STEP', index: s.stepIndex + 1 })} aria-label={t(lang, 'step.next')}>
              ›
            </button>
          </div>
        )}
        {s.changes.length > 0 && (
          <section aria-label={t(lang, 'colophon.every')}>
            <h3>{t(lang, 'colophon.every')}</h3>
            <ul className="rows">
              {groupChanges(s.changes, lang).map((g) => (
                <li className="row" key={g.type}>
                  <div className="head">
                    <span className="type">{t(lang, `colophon.type.${g.type}` as CopyKey)}</span>
                    {g.count > 0 && <span className="count">{g.type === 'stepped' ? t(lang, 'colophon.steps.n', { n: g.count }) : g.count === 1 ? t(lang, 'colophon.blocks.one') : t(lang, 'colophon.blocks', { n: g.count })}</span>}
                  </div>
                  <span className="reason">{g.reason}</span>
                  {g.names && <span className="names">{g.names}</span>}
                  {g.restorable && (
                    <button type="button" className="link" aria-pressed={g.restored} onClick={() => send({ type: 'RESTORE', ids: g.ids, on: !g.restored })}>
                      {g.restored ? t(lang, 'stub.hide') : t(lang, 'colophon.restore')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {s.decisions && (
          <section aria-label={t(lang, 'decisions.title', { n: s.decisions.length })}>
            <h3>{s.decisions.length === 0 ? t(lang, 'decisions.title.none') : s.decisions.length === 1 ? t(lang, 'decisions.title.one') : t(lang, 'decisions.title', { n: s.decisions.length })}</h3>
            <ul className="rows">
              {s.decisions.map((d) => (
                <li className="row" key={d.id}>
                  <span>{d.label}</span>
                  <span className="flag">{d.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required')}</span>
                  {d.preChecked && <span className="flag pre">{t(lang, 'decisions.prechecked')}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {s.remembered && <p className="hint">{t(lang, 'ext.remembered', { host: s.host })}</p>}
      </main>
      <div className="bar">
        <button
          type="button"
          className="hold"
          aria-pressed={s.comparing}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            hold(true);
          }}
          onPointerUp={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onKeyDown={onHoldKey}
          onClick={(e) => e.preventDefault()}
        >
          {s.comparing ? t(lang, 'hold.showing') : t(lang, 'hold')}
          <span className="sr"> — {t(lang, 'hold.keyboard')}</span>
        </button>
        <button type="button" className="reset" onClick={() => send({ type: 'RESET' })}>
          {t(lang, 'reset')}
        </button>
      </div>
    </>
  );
}

function SettingsSheet({ s, send, close }: { s: Snapshot; send: (c: PanelCommand) => void; close: () => void }) {
  const lang = s.lang;
  const [draft, setDraft] = useState<Settings>(s.settings);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  const done = () => {
    send({ type: 'SAVE_SETTINGS', settings: { ...draft, server: draft.server.trim(), apiKey: (draft.apiKey ?? '').trim(), baseUrl: (draft.baseUrl ?? '').trim(), model: (draft.model ?? '').trim() } });
    close();
  };
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div>
        <h2 id="settings-title">{t(lang, 'ext.settings')}</h2>
        <label>
          {t(lang, 'ext.apiKey')}
          <input ref={first} type="password" autoComplete="off" value={draft.apiKey ?? ''} placeholder="sk-…" onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
          <span>{t(lang, 'ext.apiKey.hint')}</span>
        </label>
        <label>
          {t(lang, 'ext.lang')}
          <select value={draft.lang} onChange={(e) => setDraft({ ...draft, lang: e.target.value as 'auto' | Lang })}>
            <option value="auto">{t(lang, 'ext.lang.auto')}</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label>
          {t(lang, 'ext.translateTo')}
          <select value={draft.translateTo ?? 'auto'} onChange={(e) => setDraft({ ...draft, translateTo: e.target.value })}>
            <option value="auto">{t(lang, 'ext.lang.auto')}</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <details>
          <summary>{t(lang, 'ext.advanced')}</summary>
          <label>
            {t(lang, 'ext.baseUrl')}
            <input type="text" value={draft.baseUrl ?? ''} placeholder="https://api.deepseek.com" onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
          </label>
          <label>
            {t(lang, 'ext.model')}
            <input type="text" value={draft.model ?? ''} placeholder="deepseek-chat" onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
          </label>
          <label>
            {t(lang, 'ext.server.alt')}
            <input type="text" value={draft.server} placeholder="https://…" onChange={(e) => setDraft({ ...draft, server: e.target.value })} />
            <span>{t(lang, 'ext.server.hint')}</span>
          </label>
        </details>
        <button type="button" className="done" onClick={done}>
          {t(lang, 'ext.settings.done')}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const { tab, snap, unreachable, send } = useBridge();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lang: Lang = snap?.lang ?? (/^zh/i.test(navigator.language) ? 'zh' : 'en');
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = lang === 'zh' ? '由我 · Mine' : 'Mine · 由我';
  }, [lang]);

  let body: ReactNode;
  if (!tab) body = <p className="blocked">{t(lang, 'ext.noTab')}</p>;
  else if (unreachable || !snap) body = <p className="blocked">{unreachable ? t(lang, 'ext.unreachable') : t(lang, 'ext.reading')}</p>;
  else if (snap.active || snap.mode === 'words') body = <Edition s={snap} send={send} />;
  else body = <Opening s={snap} send={send} busy={!!snap.status} />;

  return (
    <div className="app">
      <header className="top">
        <span className="mark" aria-label="Mine · 由我">
          Mine<span className="dot">.</span>
          <small>由我</small>
        </span>
        {snap && (
          <button type="button" className="gear" aria-label={t(lang, 'ext.settings')} onClick={() => setSettingsOpen(true)}>
            <Gear />
          </button>
        )}
      </header>
      {body}
      {settingsOpen && snap && <SettingsSheet s={snap} send={send} close={() => setSettingsOpen(false)} />}
      <div className="sr" aria-live="polite" aria-atomic="true">
        {snap?.announcement ?? ''}
      </div>
    </div>
  );
}
