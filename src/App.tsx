import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { t } from './copy.ts';
import { DEMO_EXAMPLE } from './content/content.meta.ts';
import { useMine } from './ui/useMine.ts';
import { detectLang, isDemoMode, persistLang } from './ui/lang.ts';
import { useAnnouncer } from './ui/a11y.tsx';
import { Landing } from './ui/Landing.tsx';
import { Lab } from './ui/Lab.tsx';
import { ModeStrip } from './ui/ModeStrip.tsx';
import { Ending } from './ui/Ending.tsx';
import { useDemoKeys } from './ui/demoKeys.ts';
import './ui/app.css';
import './ui/portal.css';
import './ui/edition.css';

type Screen = 'landing' | 'lab' | 'ending';

function screenFromHash(): Screen {
  const h = window.location.hash.replace('#', '');
  return h === 'lab' || h === 'ending' ? h : 'landing';
}

export default function App() {
  const m = useMine(detectLang());
  const [screen, setScreenState] = useState<Screen>(screenFromHash);
  const { announce, LiveRegion } = useAnnouncer();
  const [demo] = useState(isDemoMode);

  const setScreen = useCallback((s: Screen) => {
    setScreenState(s);
    const url = new URL(window.location.href);
    url.hash = s === 'landing' ? '' : s;
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    persistLang(m.lang);
    document.title = m.lang === 'zh' ? '由我 · Mine' : 'Mine · 由我';
  }, [m.lang]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(m.prefs.fontScale));
    document.documentElement.style.setProperty('--target', m.prefs.fontScale >= 1.35 ? '48px' : '44px');
    if (m.prefs.contrast === 'high') document.documentElement.dataset.contrast = 'high';
    else delete document.documentElement.dataset.contrast;
  }, [m.prefs]);

  useEffect(() => {
    const onHash = () => setScreenState(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const example = DEMO_EXAMPLE[m.lang];
  const actions = useMemo(
    () => ({
      portal: () => {
        setScreen('lab');
        m.reset();
      },
      focus: () => {
        setScreen('lab');
        m.applyPreset('focus');
      },
      openWords: () => {
        setScreen('lab');
        m.selectMode('words');
        m.setWordsText(example);
      },
      applyWords: () => {
        setScreen('lab');
        void m.applyWords(m.wordsText.trim() || example);
      },
      toggleCompare: () => m.setComparing(!m.comparing),
      ending: () => setScreen('ending'),
      reset: () => {
        m.reset();
        setScreen('landing');
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.reset, m.applyPreset, m.selectMode, m.setWordsText, m.applyWords, m.wordsText, m.comparing, m.setComparing, example, setScreen],
  );
  useDemoKeys(demo, actions);

  const otherLang = m.lang === 'zh' ? 'en' : 'zh';

  return (
    <MotionConfig reducedMotion="user">
      <div className="app" lang={m.lang === 'zh' ? 'zh-CN' : 'en'}>
        <a className="skip-link" href="#content">
          {t(m.lang, 'nav.skip')}
        </a>
        <header className="app-header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setScreen('landing');
            }}
          >
            {t(m.lang, 'brand.name')}
            <small>{t(m.lang, 'brand.descriptor')}</small>
          </a>
          {screen === 'lab' && <ModeStrip lang={m.lang} mode={m.mode} onSelect={m.selectMode} />}
          <span className="spacer" />
          {screen !== 'lab' && (
            <button type="button" className="text-btn" onClick={() => setScreen('lab')}>
              {t(m.lang, 'nav.lab')}
            </button>
          )}
          <button type="button" className="text-btn" aria-label={t(m.lang, 'nav.langLabel')} lang={otherLang === 'zh' ? 'zh-CN' : 'en'} onClick={() => m.setLang(otherLang)}>
            {t(m.lang, 'nav.lang')}
          </button>
        </header>
        <main>
          {screen === 'landing' && <Landing lang={m.lang} content={m.content} onStart={() => setScreen('lab')} />}
          {screen === 'lab' && <Lab mine={m} announce={announce} goEnding={() => setScreen('ending')} />}
          {screen === 'ending' && <Ending lang={m.lang} onBack={() => setScreen('lab')} />}
        </main>
        <LiveRegion />
      </div>
    </MotionConfig>
  );
}
