import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';

async function send(tabId: number | undefined, type: string) {
  if (tabId === undefined) return;
  try {
    await browser.tabs.sendMessage(tabId, { type });
  } catch {
    /* no content script on this page (chrome://, store, pdf) */
  }
}

export default defineBackground(() => {
  // The toolbar icon opens the side panel for the current tab.
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => undefined);
  browser.runtime.onMessage.addListener((msg: { type?: string; tabId?: number }, sender, sendResponse: (r: unknown) => void) => {
    if (msg?.type === 'OPEN_PANEL' && sender.tab?.id !== undefined) {
      // Allowed because it follows the click on the page's floating button.
      void chrome.sidePanel?.open?.({ tabId: sender.tab.id }).catch(() => undefined);
      return undefined;
    }
    if (msg?.type === 'INJECT' && typeof msg.tabId === 'number') {
      // The panel could not reach the page: the tab was open before Mine was installed or updated.
      // Inject the content scripts now; browser pages, the store and PDFs refuse and that is the answer.
      const tabId = msg.tabId;
      void (async () => {
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content-scripts/history.js'], world: 'MAIN' });
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content-scripts/content.js'] });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      })();
      return true;
    }
    return undefined;
  });
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (command === 'toggle-panel' && tab?.id !== undefined) void chrome.sidePanel?.open?.({ tabId: tab.id }).catch(() => undefined);
    if (command === 'make-it-mine') await send(tab?.id, 'MAKE_IT_MINE');
  });
});
