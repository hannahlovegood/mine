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
  browser.runtime.onMessage.addListener((msg: { type?: string }, sender) => {
    if (msg?.type === 'OPEN_PANEL' && sender.tab?.id !== undefined) {
      // Allowed because it follows the click on the page's floating button.
      void chrome.sidePanel?.open?.({ tabId: sender.tab.id }).catch(() => undefined);
    }
  });
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (command === 'toggle-panel' && tab?.id !== undefined) void chrome.sidePanel?.open?.({ tabId: tab.id }).catch(() => undefined);
    if (command === 'make-it-mine') await send(tab?.id, 'MAKE_IT_MINE');
  });
});
