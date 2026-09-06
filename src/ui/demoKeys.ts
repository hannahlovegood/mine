// ?demo=1 keyboard beats (§8). Inert while focus is inside a text field; absent without ?demo=1.
import { useEffect } from 'react';

export interface DemoActions {
  portal: () => void;
  focus: () => void;
  openWords: () => void;
  applyWords: () => void;
  toggleCompare: () => void;
  ending: () => void;
  reset: () => void;
}

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useDemoKeys(enabled: boolean, actions: DemoActions) {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inTextField(e.target)) return;
      const map: Record<string, () => void> = {
        '1': actions.portal,
        '2': actions.focus,
        '3': actions.openWords,
        '4': actions.applyWords,
        '5': actions.toggleCompare,
        '6': actions.ending,
        r: actions.reset,
        R: actions.reset,
      };
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled, actions]);
}
