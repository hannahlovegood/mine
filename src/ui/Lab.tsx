// The Lab: mode strip, the page frame, the colophon rail.
import { useEffect, useRef, useState } from 'react';
import { t } from '../copy.ts';
import { PageFrame } from './PageFrame.tsx';
import { Colophon } from './Colophon.tsx';
import { summarySentence } from './summary.ts';
import { WordsComposer } from './WordsComposer.tsx';
import type { Mine } from './useMine.ts';
import { focusById, usePrefersReducedMotion } from './a11y.tsx';

interface Props {
  mine: Mine;
  announce: (text: string) => void;
  goEnding: () => void;
}

const HEADING = 'page-heading';

export function Lab({ mine: m, announce, goEnding }: Props) {
  const [railOpen, setRailOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const firstRun = useRef(true);

  // After every transform: announce the summary, bring the frame into view, move focus to the page heading.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const sentence = m.isOriginal ? t(m.lang, 'live.original') : t(m.lang, 'live.transformed', { summary: summarySentence(m.transformation, m.lang) });
    announce(sentence);
    const el = frameRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 84;
      if (window.scrollY > top + 40) window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }
    focusById(m.isOriginal ? 'portal-heading' : HEADING, reduced ? 50 : 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.prefs]);

  const changeCount = m.transformation.changes.length;

  return (
    <div className="lab" id="content">
      <h1 className="lab-title">{t(m.lang, 'lab.title')}</h1>
      {m.mode === 'words' && (
        <WordsComposer lang={m.lang} text={m.wordsText} setText={m.setWordsText} working={m.working} onTransform={(text) => void m.applyWords(text)} result={m.words} />
      )}
      <div className="lab-grid">
        <div ref={frameRef}>
          <PageFrame
            groupId="lab"
            content={m.content}
            tr={m.transformation}
            lang={m.lang}
            prefs={m.prefs}
            showPortal={m.isOriginal}
            comparing={m.comparing}
            h={{ restored: m.restored, onRestore: m.restore, expanded: m.expanded, onExpand: m.expand, originals: m.originals, onOriginal: m.showOriginal, lookup: m.lookup }}
            headingId={HEADING}
            inspect={m.inspect}
            onHoverBlock={m.setInspect}
            stepIndex={m.stepIndex}
            setStepIndex={m.setStepIndex}
          />
        </div>
        <aside className="rail" aria-label={t(m.lang, 'colophon.title')} data-open={railOpen ? 'true' : 'false'}>
          <Colophon
            tr={m.transformation}
            lang={m.lang}
            prefs={m.prefs}
            lookup={m.lookup}
            words={m.words}
            showWhy={m.mode === 'words'}
            isOriginal={m.isOriginal}
            comparing={m.comparing}
            setComparing={m.setComparing}
            onReset={m.reset}
            onInspect={m.setInspect}
            restored={m.restored}
            onRestore={m.restore}
            originals={m.originals}
            onOriginal={m.showOriginal}
          />
          {m.transformCount >= 3 && (
            <section>
              <button type="button" className="text-btn pencil" onClick={goEnding}>
                {t(m.lang, 'ending.1')}
              </button>
            </section>
          )}
        </aside>
        <button type="button" className="rail-pill" aria-expanded={railOpen} data-open={railOpen ? 'true' : 'false'} onClick={() => setRailOpen((o) => !o)}>
          {changeCount === 1 ? t(m.lang, 'colophon.pill.one') : t(m.lang, 'colophon.pill', { n: changeCount })}
        </button>
      </div>
    </div>
  );
}

