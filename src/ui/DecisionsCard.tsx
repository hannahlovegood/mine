import type { Lang } from '../engine/schema.ts';
import type { DecisionSummary } from '../engine/transform.ts';
import { t } from '../copy.ts';

export function DecisionsCard({ d, lang, onHover }: { d: DecisionSummary; lang: Lang; onHover?: (ids: string[] | null) => void }) {
  const title = d.count === 0 ? t(lang, 'decisions.title.none') : d.count === 1 ? t(lang, 'decisions.title.one') : t(lang, 'decisions.title', { n: d.count });
  const all = [...d.optional, ...d.required];
  return (
    <section className="decisions-card" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {all.map((b) => (
          <li key={b.id} onMouseEnter={() => onHover?.([b.id])} onMouseLeave={() => onHover?.(null)}>
            <span className="label">{b.plainLabel ?? b.label}</span>
            <span className="flag">{b.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required')}</span>
            {b.preChecked && <span className="flag prechecked">{t(lang, 'decisions.prechecked')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
