import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';

/** Animates a number toward `value` after `delay` ms (so the count runs after the morph settles). */
export function useCountUp(value: number, delay = 600, enabled = true): number {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (!enabled || prev.current === value) {
      prev.current = value;
      setShown(value);
      return;
    }
    const from = prev.current;
    prev.current = value;
    const controls = animate(from, value, {
      duration: 0.6,
      delay: delay / 1000,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay, enabled]);
  return shown;
}
