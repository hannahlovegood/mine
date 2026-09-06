// Mine on the page you are actually on. Top frame only; nothing runs until you ask
// (or until a remembered site opens the way you left it).
import { defineContentScript } from '#imports';
import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { Controller } from '../src/controller.ts';
import { Panel } from '../src/panel/Panel.tsx';
import { PANEL_CSS } from '../src/panel/panel.css.ts';
import { fontFaceCss } from '../src/apply/css.ts';

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

    // Fonts must be declared in the document scope to reach shadow trees.
    const fonts = document.createElement('style');
    fonts.id = 'mine-fonts';
    fonts.textContent = fontFaceCss((p) => browser.runtime.getURL(p as never));
    (document.head ?? document.documentElement).appendChild(fonts);

    const host = document.createElement('mine-root');
    host.style.cssText = 'all:initial;position:static;display:block;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    document.body.appendChild(host);
    createRoot(mount).render(<Panel c={c} />);

    // Push the page aside while the rail is open so nothing hides behind it (desktop widths only).
    let wasOpen = false;
    c.subscribe(() => {
      const open = c.state.open;
      if (open === wasOpen) return;
      wasOpen = open;
      const wide = window.innerWidth > 720;
      const root = document.documentElement;
      if (open && wide) {
        root.style.setProperty('transition', 'margin-right 150ms ease-out');
        root.style.setProperty('margin-right', '360px', 'important');
      } else {
        root.style.removeProperty('margin-right');
      }
    });

    // Counter the body zoom used by Large so the panel keeps its size.
    const sync = () => {
      const z = document.documentElement.getAttribute('data-mine-zoom');
      host.style.zoom = z ? String(1 / Number(z)) : '';
    };
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mine-zoom'] });

    browser.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type === 'TOGGLE_PANEL') c.toggle();
      if (msg?.type === 'MAKE_IT_MINE') void (c.state.mode === 'default' ? c.selectMode('focus') : c.reset());
    });

    await c.init();
  },
});
