import { motion } from 'motion/react';
import type { Lang } from '../engine/schema.ts';
import { t } from '../copy.ts';
import { usePrefersReducedMotion } from './a11y.tsx';
import { REPO_URL } from './format.ts';

export function Ending({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const reduced = usePrefersReducedMotion();
  const lines = [t(lang, 'ending.1'), t(lang, 'ending.2'), t(lang, 'ending.3')];
  return (
    <section className="ending" id="content" aria-label={t(lang, 'ending.3')}>
      {lines.map((line, i) => (
        <motion.p
          key={i}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.35 + i * 0.7, ease: [0.2, 0, 0, 1] }}
        >
          {line}
        </motion.p>
      ))}
      <motion.div className="links" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 2.6, duration: 0.4 }}>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {t(lang, 'ending.repo')}
        </a>
        <button type="button" className="text-btn" onClick={onBack}>
          {t(lang, 'ending.again')}
        </button>
      </motion.div>
    </section>
  );
}
