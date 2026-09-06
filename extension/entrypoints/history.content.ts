// Runs in the page's own world, because a content script's isolated `history` wrapper never sees the
// page's pushState/replaceState calls. It does one thing: after either call, dispatch a DOM event that
// the isolated content script listens for (events cross worlds; variables do not).
import { defineContentScript } from '#imports';

const URL_CHANGE_EVENT = 'mine:urlchange'; // the isolated content script listens for this name

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    if (window.top !== window) return;
    const wrap = (name: 'pushState' | 'replaceState') => {
      const original = history[name];
      history[name] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event(URL_CHANGE_EVENT));
        return result;
      };
    };
    wrap('pushState');
    wrap('replaceState');
  },
});
