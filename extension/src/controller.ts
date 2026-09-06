// Orchestrates extract → transform → apply on the current page and holds the panel's state.
// Pure React state would not survive the panel closing, so this is a tiny external store.
import { transform, type Transformation } from '@engine/transform.ts';
import { fallback } from '@engine/fallback.ts';
import { DEFAULT_PREFERENCES, PRESETS, isDefault, type ModeId, type PresetId } from '@engine/presets.ts';
import { InterpretResponseSchema, type ContentBlock, type Lang, type MinePreferences, type PageContent } from '@engine/schema.ts';
import { z } from 'zod';
import { extractPage, type ExtractedPage } from './extract/index.ts';
import { apply, type Applied } from './apply/index.ts';

export interface Settings {
  server: string;
  lang: 'auto' | Lang;
}
export interface SiteMemory {
  mode: ModeId;
  prefs: MinePreferences;
  words?: string;
  reasons?: string[];
  source?: 'model' | 'fallback';
}
export interface WordsResult {
  text: string;
  preferences: MinePreferences;
  reasons: string[];
  source: 'model' | 'fallback';
  ms: number;
}
export interface State {
  open: boolean;
  lang: Lang;
  mode: ModeId;
  prefs: MinePreferences;
  tr: Transformation | null;
  page: ExtractedPage | null;
  words: WordsResult | null;
  wordsText: string;
  status: string | null;
  notice: string | null;
  settings: Settings;
  stepIndex: number;
  stepCount: number;
  comparing: boolean;
  restored: Set<string>;
  remembered: boolean;
  announcement: string;
}

const PlainResponseSchema = z.object({
  rewrites: z.array(z.object({ id: z.string(), plainText: z.string(), terms: z.array(z.object({ term: z.string(), plain: z.string() })).optional() })),
});

type Storage = { get(keys: string[]): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> };

function pageLang(): Lang {
  const l = document.documentElement.lang || navigator.language;
  return /^zh/i.test(l) ? 'zh' : 'en';
}

export class Controller {
  private listeners = new Set<() => void>();
  private applied: Applied | null = null;
  private storage: Storage;
  private host = location.hostname || 'local';
  private tick = 0;
  state: State = {
    open: false,
    lang: pageLang(),
    mode: 'default',
    prefs: DEFAULT_PREFERENCES,
    tr: null,
    page: null,
    words: null,
    wordsText: '',
    status: null,
    notice: null,
    settings: { server: '', lang: 'auto' },
    stepIndex: 0,
    stepCount: 0,
    comparing: false,
    restored: new Set(),
    remembered: false,
    announcement: '',
  };

  constructor(storage: Storage) {
    this.storage = storage;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  async init(): Promise<void> {
    const data = await this.storage.get(['settings', 'sites', 'wordsText']);
    const settings = { ...this.state.settings, ...((data.settings as Partial<Settings>) ?? {}) };
    const sites = (data.sites as Record<string, SiteMemory>) ?? {};
    const lang = settings.lang === 'auto' ? pageLang() : settings.lang;
    this.set({ settings, lang, wordsText: (data.wordsText as string) ?? '' });
    const memory = sites[this.host];
    if (memory && !isDefault(memory.prefs)) {
      // The smooth part: a remembered site opens the way you left it.
      await new Promise((r) => setTimeout(r, 400));
      if (memory.mode === 'words' && memory.words) {
        this.set({ words: { text: memory.words, preferences: memory.prefs, reasons: memory.reasons ?? [], source: memory.source ?? 'fallback', ms: 0 }, wordsText: memory.words });
      }
      await this.applyPrefs(memory.prefs, memory.mode, false);
    }
  }

  setOpen(open: boolean) {
    this.set({ open });
  }
  setWordsText(wordsText: string) {
    this.set({ wordsText });
  }
  toggle() {
    this.set({ open: !this.state.open });
  }

  async setLang(lang: Lang) {
    const settings = { ...this.state.settings, lang };
    await this.storage.set({ settings });
    this.set({ settings, lang });
    if (!isDefault(this.state.prefs)) await this.applyPrefs(this.state.prefs, this.state.mode, false);
  }

  async saveSettings(settings: Settings) {
    await this.storage.set({ settings });
    const lang = settings.lang === 'auto' ? pageLang() : settings.lang;
    this.set({ settings, lang });
  }

  async selectMode(mode: ModeId) {
    if (mode === 'words') {
      this.set({ mode: 'words' });
      if (this.state.words) await this.applyPrefs(this.state.words.preferences, 'words');
      return;
    }
    if (mode === 'default') {
      await this.reset();
      return;
    }
    await this.applyPrefs(PRESETS[mode as PresetId], mode);
  }

  async applyWords(text: string) {
    const lang = this.state.lang;
    this.set({ status: lang === 'zh' ? '正在读你的话……' : 'Reading your words…', wordsText: text, mode: 'words' });
    await this.storage.set({ wordsText: text });
    const started = performance.now();
    let result: WordsResult;
    try {
      const server = this.state.settings.server.replace(/\/+$/, '');
      if (!server) throw new Error('offline');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const r = await fetch(`${server}/api/interpret`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, lang }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      result = { text, ...InterpretResponseSchema.parse(await r.json()) };
    } catch {
      const fb = fallback(text, lang);
      result = { text, preferences: fb.preferences, reasons: fb.reasons, source: 'fallback', ms: Math.round(performance.now() - started) };
    }
    this.set({ words: result });
    await this.applyPrefs(result.preferences, 'words');
  }

  async reset() {
    this.applied?.undo();
    this.applied = null;
    const sites = ((await this.storage.get(['sites'])).sites as Record<string, SiteMemory>) ?? {};
    delete sites[this.host];
    await this.storage.set({ sites });
    this.set({
      mode: 'default',
      prefs: DEFAULT_PREFERENCES,
      tr: null,
      page: null,
      stepIndex: 0,
      stepCount: 0,
      comparing: false,
      restored: new Set(),
      remembered: false,
      status: null,
      notice: null,
      announcement: this.stamp(this.state.lang === 'zh' ? '已回到原版页面。' : 'Back to the original page.'),
    });
  }

  restore(ids: string[], on: boolean) {
    this.applied?.restore(ids, on);
    this.set({ restored: this.applied?.restored() ?? new Set() });
  }
  setStep(i: number) {
    this.applied?.setStep(i);
    this.set({ stepIndex: this.applied?.stepIndex() ?? 0 });
  }
  compare(on: boolean) {
    this.applied?.compare(on);
    this.set({ comparing: on });
  }

  private stamp(text: string): string {
    this.tick += 1;
    return this.tick % 2 ? text : `${text}​`;
  }

  /** Extract → (plain API) → transform → apply. Remembers the result for this site. */
  private async applyPrefs(prefs: MinePreferences, mode: ModeId, remember = true) {
    const lang = this.state.lang;
    this.applied?.undo();
    this.applied = null;
    this.set({ status: lang === 'zh' ? '正在读这个页面……' : 'Reading the page…', notice: null, comparing: false, restored: new Set() });
    await new Promise((r) => setTimeout(r, 0));
    let page: ExtractedPage;
    try {
      page = extractPage(document, { lang });
    } catch {
      this.set({ status: null, notice: lang === 'zh' ? '这个页面上没有找到足够的内容可以重排。' : 'Mine could not find enough on this page to reorganise.' });
      return;
    }
    if (page.content.blocks.length < 3) {
      this.set({ status: null, notice: lang === 'zh' ? '这个页面上没有找到足够的内容可以重排。' : 'Mine could not find enough on this page to reorganise.' });
      return;
    }
    let content: PageContent = page.content;
    let notice: string | null = null;
    if (prefs.readingLevel === 'plain' || prefs.explainTerms) {
      const server = this.state.settings.server.replace(/\/+$/, '');
      if (!server) {
        notice = lang === 'zh' ? '平实语言需要模型服务，请在「设置」里填写；其余功能都离线可用。' : 'Plain language needs a model server. Add one under Settings; everything else works offline.';
      } else {
        this.set({ status: lang === 'zh' ? '正在改写成平实语言……' : 'Rewriting in plain words…' });
        const merged = await this.fetchPlain(server, content, lang);
        if (merged) content = merged;
        else notice = lang === 'zh' ? '平实语言暂时不可用，其余改动照常。' : 'Plain language is unavailable right now; everything else applied.';
      }
    }
    const tr = transform(content, prefs);
    page = { ...page, content };
    this.applied = apply(page, tr, prefs, lang);
    const summary = summaryOf(tr, lang);
    this.set({
      mode,
      prefs,
      tr,
      page,
      status: null,
      notice,
      stepIndex: 0,
      stepCount: this.applied.stepCount,
      remembered: remember,
      announcement: this.stamp(summary),
    });
    if (remember) {
      const sites = ((await this.storage.get(['sites'])).sites as Record<string, SiteMemory>) ?? {};
      sites[this.host] = { mode, prefs, words: this.state.words?.text, reasons: this.state.words?.reasons, source: this.state.words?.source };
      await this.storage.set({ sites });
    }
  }

  /** Asks the Plain API for plainText/terms of the complex passages; merges them into a copy of the content. */
  private async fetchPlain(server: string, content: PageContent, lang: Lang): Promise<PageContent | null> {
    const kindOf = (b: ContentBlock): string | null => {
      if (b.kind === 'text' || b.kind === 'instruction' || b.kind === 'faq' || b.kind === 'notice' || b.kind === 'legal' || b.kind === 'deadline') return b.kind;
      return null;
    };
    const candidates = content.blocks.filter((b) => {
      const k = kindOf(b);
      if (!k) return false;
      const text = 'text' in b ? b.text : '';
      const complex = 'complexity' in b ? b.complexity !== 'simple' : true;
      return complex && text.length >= 60 && text.length <= 1500;
    });
    if (candidates.length === 0) return content;
    const batches: ContentBlock[][] = [];
    for (let i = 0; i < Math.min(candidates.length, 24); i += 12) batches.push(candidates.slice(i, i + 12));
    const rewrites = new Map<string, { plainText: string; terms?: { term: string; plain: string }[] }>();
    for (const batch of batches) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const r = await fetch(`${server}/api/plain`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lang, blocks: batch.map((b) => ({ id: b.id, text: 'text' in b ? b.text : '', kind: kindOf(b) })) }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (r.status === 503) return null;
        if (!r.ok) continue;
        const parsed = PlainResponseSchema.parse(await r.json());
        for (const rw of parsed.rewrites) rewrites.set(rw.id, { plainText: rw.plainText, terms: rw.terms });
      } catch {
        /* keep going: a failed batch just leaves those passages as written */
      }
    }
    if (rewrites.size === 0) return content;
    return {
      ...content,
      blocks: content.blocks.map((b) => {
        const rw = rewrites.get(b.id);
        if (!rw) return b;
        if (b.kind === 'deadline') return { ...b, plainText: rw.plainText };
        if ('complexity' in b) return { ...b, plainText: rw.plainText, terms: rw.terms?.length ? rw.terms : b.terms };
        return b;
      }),
    };
  }
}

import { summarySentence } from '@app/ui/summary.ts';
function summaryOf(tr: Transformation, lang: Lang): string {
  return summarySentence(tr, lang);
}
