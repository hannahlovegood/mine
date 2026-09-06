import { useCallback, useEffect, useRef, useState } from 'react';

/** A polite live region. Call `announce(text)`; the same text twice still re-announces. */
export function useAnnouncer() {
  const [message, setMessage] = useState('');
  const tick = useRef(0);
  const announce = useCallback((text: string) => {
    tick.current += 1;
    // A trailing zero-width space toggles so identical sentences are re-read.
    setMessage(tick.current % 2 === 0 ? text : `${text}\u200b`);
  }, []);
  const LiveRegion = useCallback(
    () => (
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    ),
    [message],
  );
  return { announce, LiveRegion };
}

/** Focuses an element by id after the next paint (used after every transform). */
export function focusById(id: string, delay = 0) {
  window.setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }, delay);
}

export function useEscape(onEscape: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onEscape, active]);
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setReduced(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduced;
}
