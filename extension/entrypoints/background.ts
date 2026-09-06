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
  browser.action.onClicked.addListener((tab) => void send(tab.id, 'TOGGLE_PANEL'));
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (command === 'toggle-panel') await send(tab?.id, 'TOGGLE_PANEL');
    if (command === 'make-it-mine') await send(tab?.id, 'MAKE_IT_MINE');
  });
});
