// Landing: the hero is the morph itself, playing once on load (portal → Focus), then Replay.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang, PageContent } from '../engine/schema.ts';
import { transform, type Transformation } from '../engine/transform.ts';
import { DEFAULT_PREFERENCES, PRESETS } from '../engine/presets.ts';
import { t } from '../copy.ts';
import { PageFrame } from './PageFrame.tsx';
import { PortalPage } from './PortalPage.tsx';
import { EditionPage } from './EditionPage.tsx';
import type { EditionHandlers } from './blocks/EditionBlock.tsx';
import { Colophon } from './Colophon.tsx';
import { PlainBlock } from './Wrap.tsx';
import { usePrefersReducedMotion } from './a11y.tsx';
import { REPO_URL } from './format.ts';

interface Props {
  lang: Lang;
  content: PageContent;
  onStart: () => void;
}

const noop = () => {};

interface StageProps {
  lang: Lang;
  content: PageContent;
  trFocus: Transformation;
  trDefault: Transformation;
  h: EditionHandlers;
  step: number;
  setStep: (i: number) => void;
}

/** The hero morph: portal → Focus once on mount, then Replay. Keyed by lang so a language switch replays. */
function HeroStage({ lang, content, trFocus, trDefault, h, step, setStep }: StageProps) {
  const [focus, setFocus] = useState(false);
  const timer = useRef<number | null>(null);
  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFocus(true), 900);
  }, []);
  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [schedule]);
  const replay = () => {
    setFocus(false);
    setStep(0);
    schedule();
  };
  return (
    <>
      <PageFrame
        groupId="hero"
        content={content}
        tr={focus ? trFocus : trDefault}
        lang={lang}
        prefs={focus ? PRESETS.focus : DEFAULT_PREFERENCES}
        showPortal={!focus}
        h={h}
        headingId="hero-heading"
        stepIndex={step}
        setStepIndex={setStep}
        label={focus ? t(lang, 'hero.after') : t(lang, 'hero.before')}
      />
      <button type="button" className="text-btn replay" onClick={replay}>
        {t(lang, 'hero.replay')}
      </button>
    </>
  );
}

export function Landing({ lang, content, onStart }: Props) {
  const reduced = usePrefersReducedMotion();
  const [restored, setRestored] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [originals, setOriginals] = useState<Set<string>>(() => new Set());
  const [step, setStep] = useState(0);
  const trFocus = useMemo(() => transform(content, PRESETS.focus), [content]);
  const trDefault = useMemo(() => transform(content, DEFAULT_PREFERENCES), [content]);
  const lookup = (id: string) => content.blocks.find((b) => b.id === id);
  const toggle = (set: Set<string>, ids: string[], on: boolean) => {
    const n = new Set(set);
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
    return n;
  };
  const h: EditionHandlers = {
    restored,
    onRestore: (ids: string[], on: boolean) => setRestored((s) => toggle(s, ids, on)),
    expanded,
    onExpand: (id: string, on: boolean) => setExpanded((s) => toggle(s, [id], on)),
    originals,
    onOriginal: (id: string, on: boolean) => setOriginals((s) => toggle(s, [id], on)),
    lookup,
  };

  return (
    <div className="landing" id="content">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">{t(lang, 'hero.title')}</h1>
          <p className="sub">{t(lang, 'hero.sub')}</p>
          <div className="ctas">
            <button type="button" className="btn" onClick={onStart}>
              {t(lang, 'hero.cta')}
            </button>
            <a className="text-btn pencil" href="#example">
              {t(lang, 'hero.secondary')}
            </a>
          </div>
        </div>
        <div className="hero-stage">
          {reduced ? (
            <div className="static-pair">
              <div>
                <p className="hero-caption">{t(lang, 'hero.before')}</p>
                <div className="frame">
                  <div className="page">
                    <PortalPage content={content} lang={lang} Wrap={PlainBlock} idPrefix="hb-" inert />
                  </div>
                </div>
              </div>
              <div>
                <p className="hero-caption">{t(lang, 'hero.after')}</p>
                <div className="frame">
                  <div className="page">
                    <EditionPage tr={trFocus} content={content} lang={lang} prefs={PRESETS.focus} h={h} Wrap={PlainBlock} headingId="hero-heading" inspect={null} stepIndex={step} setStepIndex={setStep} idPrefix="ha-" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <HeroStage key={lang} lang={lang} content={content} trFocus={trFocus} trDefault={trDefault} h={h} step={step} setStep={setStep} />
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="freedoms-title">
        <h2 id="freedoms-title">{t(lang, 'freedoms.title')}</h2>
        <div className="three">
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <h3>{t(lang, `freedoms.${n}.title` as 'freedoms.1.title')}</h3>
              <p>{t(lang, `freedoms.${n}.body` as 'freedoms.1.body')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="example" aria-labelledby="example-title">
        <h2 id="example-title">{t(lang, 'hero.example')}</h2>
        <div className="example-colophon">
          <Colophon
            tr={trFocus}
            lang={lang}
            prefs={PRESETS.focus}
            lookup={lookup}
            words={null}
            showWhy={false}
            isOriginal={true}
            comparing={false}
            setComparing={noop}
            onReset={noop}
            onInspect={noop}
            restored={restored}
            onRestore={h.onRestore}
            originals={originals}
            onOriginal={h.onOriginal}
            animateCounts={false}
          />
        </div>
      </section>

      <section className="section not" aria-labelledby="not-title">
        <h2 id="not-title">{t(lang, 'not.title')}</h2>
        <p>{t(lang, 'not.overlay')}</p>
        <p>{t(lang, 'not.reader')}</p>
        <p>{t(lang, 'not.agent')}</p>
      </section>

      <section className="section not" aria-labelledby="honesty-title">
        <h2 id="honesty-title">{t(lang, 'honesty.title')}</h2>
        <p>{t(lang, 'honesty.body')}</p>
        <p>
          <button type="button" className="btn" onClick={onStart}>
            {t(lang, 'hero.cta')}
          </button>
        </p>
      </section>

      <footer className="footer">
        <span>{t(lang, 'brand.tagline')}</span>
        <span>{t(lang, 'brand.descriptor')}</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {t(lang, 'ending.repo')}
        </a>
      </footer>
    </div>
  );
}
