// Mine on the page you are actually on. Top frame only; nothing runs until you ask
// (or until a remembered site opens the way you left it). The panel lives in Chrome's side
// panel; this script keeps one floating button and a live region on the page, applies the
// edition in place, and answers the panel's commands with snapshots.
import { defineContentScript } from '#imports';
import { browser } from 'wxt/browser';
import { Controller } from '../src/controller.ts';
import { fontFaceCss, TOKENS } from '../src/apply/css.ts';
import { runCommand, snapshot, type PanelCommand } from '../src/bridge.ts';
import { t } from '@app/copy.ts';
// Dispatched by history.content.ts (main world) after pushState/replaceState; entrypoints never import each other.
const URL_CHANGE_EVENT = 'mine:urlchange';

const FAB_CSS = `
:host { ${TOKENS} all: initial; font-family: var(--font-interface); font-size: 15px; color: var(--ink); }
.fab { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; min-height: 46px; padding: 0 18px 0 14px; border-radius: 23px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font: inherit; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 1px 0 var(--rule), 0 6px 20px rgba(0,0,0,0.12); }
.fab:hover { background: var(--stub); }
.fab:focus-visible { outline: 3px solid var(--pencil); outline-offset: 2px; }
.fab .m { display: inline-block; width: 14px; height: 14px; border-bottom: 3px solid var(--pencil); }
.fab[data-active] { background: var(--ink); color: var(--paper); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    if (window.top !== window) return;
    if (document.querySelector('mine-root')) return;
    const storage = {
      get: (keys: string[]) => browser.storage.local.get(keys) as Promise<Record<string, unknown>>,
      set: (items: Record<string, unknown>) => browser.storage.local.set(items),
    };
    const c = new Controller(storage);
    const html = document.documentElement;

    const fonts = document.createElement('style');
    fonts.id = 'mine-fonts';
    fonts.textContent = fontFaceCss((p) => browser.runtime.getURL(p as never));
    (document.head ?? html).append(fonts);

    // The floating button + live region, in a shadow root.
    const host = document.createElement('mine-root');
    host.style.cssText = 'all:initial;position:static;display:block;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = FAB_CSS;
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fab';
    const mark = document.createElement('span');
    mark.className = 'm';
    mark.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    fab.append(mark, label);
    const live = document.createElement('div');
    live.className = 'sr';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    shadow.append(style, fab, live);
    document.body.appendChild(host);
    c.setUiRoot(shadow);
    fab.addEventListener('click', () => void browser.runtime.sendMessage({ type: 'OPEN_PANEL' }).catch(() => undefined));

    const render = () => {
      const s = c.state;
      const active = s.mode !== 'default' && !!s.tr;
      fab.toggleAttribute('data-active', active);
      label.textContent = active ? t(s.lang, 'ext.button.active', { mode: t(s.lang, `modes.${s.mode}` as 'modes.focus') }) : t(s.lang, 'ext.button');
      if (live.textContent !== s.announcement) live.textContent = s.announcement;
    };
    render();

    // Every state change → the side panel (it filters by sender tab).
    let queued = false;
    c.subscribe(() => {
      render();
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        void browser.runtime.sendMessage({ type: 'MINE_STATE', snapshot: snapshot(c) }).catch(() => undefined);
      });
    });

    // Large zooms the body; the button counters it so it keeps its size.
    const sync = () => {
      const z = Number(html.getAttribute('data-mine-zoom')) || 1;
      const bodyZoom = html.hasAttribute('data-mine-compare') ? 1 : z;
      host.style.zoom = Math.abs(1 / bodyZoom - 1) < 0.001 ? '' : String(1 / bodyZoom);
    };
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['data-mine-zoom', 'data-mine-compare'] });

    // SPA route changes: the edition was made for the previous URL, so undo it and say so; on a
    // remembered site, re-apply once the app has settled (800 ms after the last body mutation, 3 s cap).
    let href = location.href;
    let settle: (() => void) | null = null;
    const afterSettle = (fn: () => void) => {
      settle?.();
      let quiet = 0;
      const done = () => {
        clearTimeout(quiet);
        clearTimeout(cap);
        mo.disconnect();
        settle = null;
        fn();
      };
      const mo = new MutationObserver(() => {
        clearTimeout(quiet);
        quiet = window.setTimeout(done, 800);
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      quiet = window.setTimeout(done, 800);
      const cap = setTimeout(done, 3000);
      settle = () => {
        clearTimeout(quiet);
        clearTimeout(cap);
        mo.disconnect();
        settle = null;
      };
    };
    const isRoute = (before: URL, after: URL) => {
      if (before.pathname !== after.pathname || before.search !== after.search) return true;
      return before.hash !== after.hash && /^#[/!]/.test(after.hash);
    };
    const checkUrl = () => {
      if (location.href === href) return;
      const before = new URL(href);
      href = location.href;
      if (!isRoute(before, new URL(href))) return;
      c.navigated();
      if (c.state.memory) afterSettle(() => void c.applyMemory());
    };
    window.addEventListener(URL_CHANGE_EVENT, checkUrl);
    window.addEventListener('popstate', checkUrl);
    window.addEventListener('hashchange', checkUrl);

    // Commands from the side panel and the keyboard shortcut.
    browser.runtime.onMessage.addListener((msg: { kind?: string; type?: string; cmd?: PanelCommand }, _sender, sendResponse: (r: unknown) => void) => {
      if (msg?.kind === 'MINE_CMD' && msg.cmd) {
        void runCommand(c, msg.cmd).then(() => sendResponse(snapshot(c)));
        return true; // async response
      }
      if (msg?.type === 'MAKE_IT_MINE') void (c.state.mode === 'default' ? c.selectMode('focus') : c.reset());
      return undefined;
    });

    await c.init();
  },
});
