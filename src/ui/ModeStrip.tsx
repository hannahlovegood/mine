import type { Lang } from '../engine/schema.ts';
import { MODE_IDS, type ModeId } from '../engine/presets.ts';
import { t, type CopyKey } from '../copy.ts';

export function ModeStrip({ lang, mode, onSelect }: { lang: Lang; mode: ModeId; onSelect: (id: ModeId) => void }) {
  return (
    <div>
      <div className="modes" role="radiogroup" aria-label={t(lang, 'lab.modes')}>
        {MODE_IDS.map((id) => (
          <label key={id}>
            <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => onSelect(id)} />
            <span>{t(lang, `modes.${id}` as CopyKey)}</span>
          </label>
        ))}
      </div>
      <p className="modes-desc">{t(lang, `modes.${mode}.desc` as CopyKey)}</p>
    </div>
  );
}
