import type { KeyboardEvent } from 'react';
import type { Lang } from '../engine/schema.ts';
import { t } from '../copy.ts';

interface Props {
  lang: Lang;
  comparing: boolean;
  setComparing: (on: boolean) => void;
  disabled?: boolean;
}

/** Press and hold shows the original over the edition; on the keyboard it is a toggle. */
export function HoldToCompare({ lang, comparing, setComparing, disabled }: Props) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setComparing(!comparing);
    }
  };
  return (
    <button
      type="button"
      className="hold"
      aria-pressed={comparing}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        setComparing(true);
      }}
      onPointerUp={() => setComparing(false)}
      onPointerCancel={() => setComparing(false)}
      onPointerLeave={() => setComparing(false)}
      onKeyDown={onKey}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {comparing ? t(lang, 'hold.showing') : t(lang, 'hold')}
      <span className="sr-only"> — {t(lang, 'hold.keyboard')}</span>
    </button>
  );
}
