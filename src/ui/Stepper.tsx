import { useState, type ReactNode } from 'react';
import type { Lang } from '../engine/schema.ts';
import type { Step, ViewBlock } from '../engine/transform.ts';
import { t } from '../copy.ts';

interface Props {
  steps: Step[];
  index: number;
  setIndex: (i: number) => void;
  lang: Lang;
  render: (block: ViewBlock) => ReactNode;
}

export function Stepper({ steps, index, setIndex, lang, render }: Props) {
  const [otherOpen, setOtherOpen] = useState(false);
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const n = steps.length;
  const i = Math.min(index, n - 1);
  const others = step.blocks.filter((b) => b.kind === 'action' && b.state === 'collapsed');
  const shown = step.blocks.filter((b) => !others.includes(b));
  const actions = shown.filter((b) => b.kind === 'action');
  const rest = shown.filter((b) => b.kind !== 'action');

  return (
    <section className="stepper" aria-labelledby="step-title">
      <p className="progress" aria-live="polite">
        <span>{t(lang, 'step.progress', { i: i + 1, n })}</span>
      </p>
      <h3 className="step-title" id="step-title" tabIndex={-1}>
        {step.title}
      </h3>
      <div className="step-body">
        {rest.map((b) => render(b))}
        {actions.length > 0 && <div className="action-row">{actions.map((b) => render(b))}</div>}
        {others.length > 0 && (
          <div className="other-options ui">
            <button type="button" className="link-btn" aria-expanded={otherOpen} onClick={() => setOtherOpen((o) => !o)}>
              {otherOpen ? t(lang, 'step.other.hide') : t(lang, 'step.other')}
            </button>
            {otherOpen && <ul>{others.map((b) => <li key={b.id}>{render(b)}</li>)}</ul>}
          </div>
        )}
      </div>
      <div className="step-nav">
        <button type="button" className="action" disabled={i === 0} onClick={() => setIndex(i - 1)}>
          {t(lang, 'step.back')}
        </button>
        <button type="button" className="action primary" disabled={i === n - 1} onClick={() => setIndex(i + 1)}>
          {t(lang, 'step.next')}
        </button>
        <div className="dots" aria-hidden="true">
          {steps.map((s, k) => (
            <i key={s.id} data-on={k === i ? '' : undefined} data-choice={s.choice ? '' : undefined} />
          ))}
        </div>
      </div>
    </section>
  );
}
