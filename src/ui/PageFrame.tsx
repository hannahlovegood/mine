// One frame, two pages, one orchestrated morph. Hold-to-compare lays the portal over the edition.
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { Lang, MinePreferences, PageContent } from '../engine/schema.ts';
import type { Transformation } from '../engine/transform.ts';
import { t } from '../copy.ts';
import { PortalPage } from './PortalPage.tsx';
import { EditionPage } from './EditionPage.tsx';
import type { EditionHandlers } from './blocks/EditionBlock.tsx';
import { MorphBlock, PlainBlock } from './Wrap.tsx';
import { usePrefersReducedMotion } from './a11y.tsx';

interface Props {
  groupId: string;
  content: PageContent;
  tr: Transformation;
  lang: Lang;
  prefs: MinePreferences;
  showPortal: boolean;
  comparing?: boolean;
  h: EditionHandlers;
  headingId: string;
  inspect?: string[] | null;
  onHoverBlock?: (ids: string[] | null) => void;
  stepIndex: number;
  setStepIndex: (i: number) => void;
  label?: string;
}

export function PageFrame(p: Props) {
  const reduced = usePrefersReducedMotion();
  const Wrap = reduced ? PlainBlock : MorphBlock;
  const fade = reduced ? { duration: 0.12 } : { duration: 0.4 };
  return (
    <section className="frame" aria-label={p.label ?? t(p.lang, 'lab.pageLabel')}>
      <LayoutGroup id={p.groupId}>
        <AnimatePresence initial={false}>
          {p.showPortal ? (
            <motion.div key="portal" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
              <PortalPage content={p.content} lang={p.lang} Wrap={Wrap} />
            </motion.div>
          ) : (
            <motion.div key="edition" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
              <EditionPage
                tr={p.tr}
                content={p.content}
                lang={p.lang}
                prefs={p.prefs}
                h={p.h}
                Wrap={Wrap}
                headingId={p.headingId}
                inspect={p.inspect ?? null}
                onHoverBlock={p.onHoverBlock}
                stepIndex={p.stepIndex}
                setStepIndex={p.setStepIndex}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
      {p.comparing && !p.showPortal && (
        <div className="page overlay" aria-label={t(p.lang, 'hold.showing')}>
          <PortalPage content={p.content} lang={p.lang} Wrap={PlainBlock} idPrefix="cmp-" inert />
        </div>
      )}
    </section>
  );
}
