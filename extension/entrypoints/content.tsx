// Mine on the page you are actually on. Top frame only; nothing runs until you ask
// (or until a remembered site opens the way you left it).
import { defineContentScript } from '#imports';
import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { Controller } from '../src/controller.ts';
import { Panel } from '../src/panel/Panel.tsx';
import { PANEL_CSS } from '../src/panel/panel.css.ts';
import { fontFaceCss } from '../src/apply/css.ts';
// Dispatched by history.content.ts (main world) after pushState/replaceState; entrypoints never import each other.
const URL_CHANGE_EVENT = 'mine:urlchange';
const RAIL_WIDTH = 360;
const WIDE = 720;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // Fonts must be declared in the document scope to reach shadow trees; the page-shift rule lives beside them.
    const fonts = document.createElement('style');
    fonts.id = 'mine-fonts';
    fonts.textContent = fontFaceCss((p) => browser.runtime.getURL(p as never));
    const shift = document.createElement('style');
    shift.id = 'mine-panel-css';
    shift.textContent = 'html[data-mine-open]{overflow-x:clip}';
    (document.head ?? html).append(fonts, shift);

    const host = document.createElement('mine-root');
    host.style.cssText = 'all:initial;position:static;display:block;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    document.body.appendChild(host);
    c.setUiRoot(shadow);
    createRoot(mount).render(<Panel c={c} />);

    // Push the page aside while the rail is open on desktop widths so nothing scrolls behind it.
    // Only the html margin moves: fixed site chrome (sticky headers, chat bubbles) stays where it is,
    // and overflow-x:clip on html keeps 100vw layouts from growing a horizontal scrollbar.
    let scale = 1; // the panel's size relative to unzoomed CSS px (see sync below)
    let shifted = false;
    const layout = () => {
      const open = c.state.open;
      html.toggleAttribute('data-mine-open', open);
      const want = open && window.innerWidth > WIDE;
      if (want) {
        if (!shifted && !reducedMotion()) html.style.setProperty('transition', 'margin-right 150ms ease-out');
        html.style.setProperty('margin-right', `${Math.round(RAIL_WIDTH * scale)}px`, 'important');
      } else {
        html.style.removeProperty('margin-right');
        html.style.removeProperty('transition');
      }
      shifted = want;
    };
    let wasOpen = false;
    c.subscribe(() => {
      if (c.state.open === wasOpen) return;
      wasOpen = c.state.open;
      layout();
    });
    window.addEventListener('resize', layout);

    // Large zooms the body. The panel counters most of it (to max(1/z, 0.8)) so it grows a little with
    // the page instead of becoming the smallest UI on screen; while the original is held (compare),
    // the body zoom is off but the attribute stays, so the host is scaled to the same effective size.
    const sync = () => {
      const z = Number(html.getAttribute('data-mine-zoom')) || 1;
      const bodyZoom = html.hasAttribute('data-mine-compare') ? 1 : z;
      scale = z * Math.max(1 / z, 0.8);
      const hostZoom = scale / bodyZoom;
      host.style.zoom = Math.abs(hostZoom - 1) < 0.001 ? '' : String(hostZoom);
      host.toggleAttribute('data-large', html.hasAttribute('data-mine-large'));
      if (shifted) layout();
    };
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['data-mine-zoom', 'data-mine-large', 'data-mine-compare'] });

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
      // A hash-only change counts when it looks like a hash router (#/… or #!…), not an in-page anchor.
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

    browser.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type === 'TOGGLE_PANEL') c.toggle();
      if (msg?.type === 'MAKE_IT_MINE') void (c.state.mode === 'default' ? c.selectMode('focus') : c.reset());
    });

    await c.init();
  },
});
