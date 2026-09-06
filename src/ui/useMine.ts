// All application state. React state only (§3); localStorage holds the last My words text.
import { useCallback, useMemo, useState } from 'react';
import { transform, type Transformation } from '../engine/transform.ts';
import { fallback } from '../engine/fallback.ts';
import { DEFAULT_PREFERENCES, PRESETS, isDefault, type ModeId, type PresetId } from '../engine/presets.ts';
import { InterpretResponseSchema, type ContentBlock, type Lang, type MinePreferences, type PageContent } from '../engine/schema.ts';
import { getContent } from '../content/content.meta.ts';
import { persistLang } from './lang.ts';

export interface WordsResult {
  text: string;
  preferences: MinePreferences;
  reasons: string[];
  source: 'model' | 'fallback';
  ms: number;
}

const WORDS_KEY = 'mine:words';
const TIMEOUT_MS = 8500;

function loadWordsText(): string {
  try {
    return localStorage.getItem(WORDS_KEY) ?? '';
  } catch {
    return '';
  }
}

export interface Mine {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: ModeId;
  prefs: MinePreferences;
  content: PageContent;
  transformation: Transformation;
  lookup: (id: string) => ContentBlock | undefined;
  words: WordsResult | null;
  wordsText: string;
  setWordsText: (s: string) => void;
  working: boolean;
  restored: Set<string>;
  restore: (ids: string[], on: boolean) => void;
  expanded: Set<string>;
  expand: (id: string, on: boolean) => void;
  originals: Set<string>;
  showOriginal: (id: string, on: boolean) => void;
  stepIndex: number;
  setStepIndex: (i: number) => void;
  comparing: boolean;
  setComparing: (on: boolean) => void;
  inspect: string[] | null;
  setInspect: (ids: string[] | null) => void;
  transformCount: number;
  applyPreset: (id: PresetId) => void;
  selectMode: (id: ModeId) => void;
  applyWords: (text: string) => Promise<WordsResult>;
  reset: () => void;
  isOriginal: boolean;
}

function toggleSet(set: Set<string>, ids: string[], on: boolean): Set<string> {
  const next = new Set(set);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function useMine(initialLang: Lang): Mine {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [mode, setMode] = useState<ModeId>('default');
  const [prefs, setPrefs] = useState<MinePreferences>(DEFAULT_PREFERENCES);
  const [words, setWords] = useState<WordsResult | null>(null);
  const [wordsText, setWordsText] = useState<string>(loadWordsText);
  const [working, setWorking] = useState(false);
  const [restored, setRestored] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [originals, setOriginals] = useState<Set<string>>(() => new Set());
  const [stepIndex, setStepIndex] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [inspect, setInspect] = useState<string[] | null>(null);
  const [transformCount, setTransformCount] = useState(0);

  const content: PageContent = useMemo(() => getContent(lang), [lang]);
  const transformation = useMemo(() => transform(content, prefs), [content, prefs]);
  const lookup = useCallback((id: string) => content.blocks.find((b) => b.id === id), [content]);

  const commit = useCallback((next: MinePreferences, nextMode: ModeId) => {
    setPrefs(next);
    setMode(nextMode);
    setRestored(new Set());
    setExpanded(new Set());
    setOriginals(new Set());
    setStepIndex(0);
    setComparing(false);
    setInspect(null);
    if (!isDefault(next)) setTransformCount((c) => c + 1);
  }, []);

  const applyPreset = useCallback((id: PresetId) => commit(PRESETS[id], id), [commit]);

  const selectMode = useCallback(
    (id: ModeId) => {
      if (id === 'words') {
        setMode('words');
        if (words) commit(words.preferences, 'words');
        return;
      }
      if (id === 'translate') return; // the web demo has no translated content; the extension owns this mode
      applyPreset(id);
    },
    [applyPreset, commit, words],
  );

  const applyWords = useCallback(
    async (text: string): Promise<WordsResult> => {
      setWorking(true);
      const started = performance.now();
      let result: WordsResult;
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
        const r = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, lang }),
          signal: controller.signal,
        });
        window.clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const parsed = InterpretResponseSchema.parse(await r.json());
        result = { text, ...parsed };
      } catch {
        // The network cannot block the demo: interpret offline, and say so.
        const fb = fallback(text, lang);
        result = { text, preferences: fb.preferences, reasons: fb.reasons, source: 'fallback', ms: Math.round(performance.now() - started) };
      }
      try {
        localStorage.setItem(WORDS_KEY, text);
      } catch {
        /* storage unavailable */
      }
      setWords(result);
      setWordsText(text);
      commit(result.preferences, 'words');
      setWorking(false);
      return result;
    },
    [commit, lang],
  );

  const reset = useCallback(() => commit(DEFAULT_PREFERENCES, 'default'), [commit]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    persistLang(l);
    setRestored(new Set());
    setExpanded(new Set());
    setOriginals(new Set());
    setStepIndex(0);
    setInspect(null);
  }, []);

  return {
    lang,
    setLang,
    mode,
    prefs,
    content,
    transformation,
    lookup,
    words,
    wordsText,
    setWordsText,
    working,
    restored,
    restore: (ids, on) => setRestored((s) => toggleSet(s, ids, on)),
    expanded,
    expand: (id, on) => setExpanded((s) => toggleSet(s, [id], on)),
    originals,
    showOriginal: (id, on) => setOriginals((s) => toggleSet(s, [id], on)),
    stepIndex,
    setStepIndex,
    comparing,
    setComparing,
    inspect,
    setInspect,
    transformCount,
    applyPreset,
    selectMode,
    applyWords,
    reset,
    isOriginal: isDefault(prefs),
  };
}
