// Orchestrates extract → transform → apply on the current page and holds the panel's state.
// Pure React state would not survive the panel closing, so this is a tiny external store.
import { transform, type Transformation } from '@engine/transform.ts';
import { fallback } from '@engine/fallback.ts';
import { DEFAULT_PREFERENCES, PRESETS, isDefault, translatePreset, type ModeId, type PresetId } from '@engine/presets.ts';
import { InterpretResponseSchema, type ContentBlock, type Lang, type MinePreferences, type PageContent } from '@engine/schema.ts';
import { z } from 'zod';
import { t } from '@app/copy.ts';
import { summarySentence } from '@app/ui/summary.ts';
import { extractPage, type ExtractedPage } from './extract/index.ts';
import { interpret, type ChatCall } from '@server/interpret.ts';
import { rewriteBlocks, type PlainKind } from '@server/plain.ts';
import { browser } from 'wxt/browser';
import { apply, type Applied, type ApplyHooks } from './apply/index.ts';

export interface Settings {
  server: string;
  lang: 'auto' | Lang;
  /** Bring your own key: the extension talks to the provider directly (via the background). */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Target of the translated edition; 'auto' = the panel language. */
  translateTo?: 'auto' | string;
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
  /** Non-null while a transform is in flight; the mode controls are disabled meanwhile. */
  status: string | null;
  notice: string | null;
  settings: Settings;
  stepIndex: number;
  stepCount: number;
  comparing: boolean;
  restored: Set<string>;
  /** What is written for this host in storage (null when nothing is). */
  memory: SiteMemory | null;
  /** True when the current edition is the remembered one (loaded from or written to `memory`). */
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

/** The page with no edition applied — every early return and reset lands here. */
const NO_EDITION = Object.freeze({
  mode: 'default' as ModeId,
  prefs: DEFAULT_PREFERENCES,
  tr: null,
  page: null,
  stepIndex: 0,
  stepCount: 0,
  comparing: false,
  remembered: false,
  status: null,
});
const noEdition = () => ({ ...NO_EDITION, restored: new Set<string>() });

export class Controller {
  private listeners = new Set<() => void>();
  private applied: Applied | null = null;
  private storage: Storage;
  private host = location.hostname || 'local';
  private tick = 0;
  /** Monotonic run id: a newer applyPrefs (or reset) makes every older in-flight run a no-op. */
  private run = 0;
  /** The panel's shadow root, so focus can be kept inside the rail across a transform. */
  private uiRoot: ShadowRoot | null = null;
  state: State = {
    open: false,
    lang: pageLang(),
    ...noEdition(),
    words: null,
    wordsText: '',
    notice: null,
    settings: { server: '', lang: 'auto' },
    memory: null,
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

  /** Where the panel lives; lets a transform give focus back to the rail instead of the page. */
  setUiRoot(root: ShadowRoot | null) {
    this.uiRoot = root;
  }

  /** What the panel calls this site: the hostname, or "this file" for file:// and friends. */
  hostLabel(): string {
    return location.hostname || t(this.state.lang, 'ext.thisFile');
  }

  async init(): Promise<void> {
    const data = await this.storage.get(['settings', 'sites', 'wordsText']);
    const settings = { ...this.state.settings, ...((data.settings as Partial<Settings>) ?? {}) };
    const sites = (data.sites as Record<string, SiteMemory>) ?? {};
    const lang = settings.lang === 'auto' ? pageLang() : settings.lang;
    const memory = sites[this.host] ?? null;
    this.set({ settings, lang, wordsText: (data.wordsText as string) ?? '', memory: memory && !isDefault(memory.prefs) ? memory : null });
    if (this.state.memory) {
      // The smooth part: a remembered site opens the way you left it.
      await new Promise((r) => setTimeout(r, 400));
      await this.applyMemory();
    }
  }

  /** Re-applies the remembered edition (after load, or after a route change once the app settled). */
  async applyMemory(): Promise<void> {
    const memory = this.state.memory;
    if (!memory || this.state.status || this.state.mode !== 'default') return;
    if (memory.mode === 'words' && memory.words) {
      this.set({ words: { text: memory.words, preferences: memory.prefs, reasons: memory.reasons ?? [], source: memory.source ?? 'fallback', ms: 0 }, wordsText: memory.words });
    }
    await this.applyPrefs(memory.prefs, memory.mode, false);
  }

  setOpen(open: boolean) {
    if (open !== this.state.open) this.set({ open });
  }
  setWordsText(wordsText: string) {
    this.set({ wordsText });
  }
  toggle() {
    this.set({ open: !this.state.open });
  }

  async setLang(lang: Lang) {
    await this.saveSettings({ ...this.state.settings, lang });
  }

  /** Persists settings; when the resolved panel language changes, the edition is redone in that language. */
  async saveSettings(settings: Settings) {
    await this.storage.set({ settings });
    const lang = settings.lang === 'auto' ? pageLang() : settings.lang;
    const changed = lang !== this.state.lang;
    this.set({ settings, lang });
    if (changed && this.state.tr && !isDefault(this.state.prefs)) await this.applyPrefs(this.state.prefs, this.state.mode, false);
  }

  async selectMode(mode: ModeId) {
    if (this.state.status) return; // a transform is in flight; the controls are disabled meanwhile
    if (mode === this.state.mode && mode !== 'words') return;
    if (mode === 'words') {
      this.set({ mode: 'words' });
      if (this.state.words) await this.applyPrefs(this.state.words.preferences, 'words');
      return;
    }
    if (mode === 'default') {
      await this.reset();
      return;
    }
    if (mode === 'translate') {
      await this.applyPrefs(translatePreset(this.translateTarget()), 'translate');
      return;
    }
    await this.applyPrefs(PRESETS[mode as PresetId], mode);
  }

  async applyWords(text: string) {
    if (this.state.status) return;
    const lang = this.state.lang;
    this.set({ status: t(lang, 'words.working'), wordsText: text, mode: 'words' });
    await this.storage.set({ wordsText: text });
    const started = performance.now();
    let result: WordsResult;
    const direct = this.directChat();
    if (direct) {
      const r = await interpret(text, lang, direct);
      result = { text, ...r };
    } else {
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
    }
    this.set({ words: result });
    await this.applyPrefs(result.preferences, 'words');
  }

  /** Back to original: undo, forget this site, and cancel anything still in flight. */
  async reset() {
    this.run += 1;
    const restoreFocus = this.captureFocus();
    this.applied?.undo();
    this.applied = null;
    const lang = this.state.lang;
    const hadMemory = !!this.state.memory;
    // State first, storage second: nothing is patched after the awaits, so a mode chosen meanwhile is never clobbered.
    this.set({
      ...noEdition(),
      memory: null,
      notice: hadMemory ? t(lang, 'ext.forgotten') : null,
      announcement: this.stamp(t(lang, 'live.original')),
    });
    restoreFocus();
    const sites = ((await this.storage.get(['sites'])).sites as Record<string, SiteMemory>) ?? {};
    delete sites[this.host];
    await this.storage.set({ sites });
  }

  /** The URL changed under the edition (SPA route): undo and say so; the caller re-applies memory once the app settles. */
  navigated() {
    if (!this.applied && this.state.mode === 'default' && !this.state.status) return;
    this.run += 1;
    this.applied?.undo();
    this.applied = null;
    const lang = this.state.lang;
    this.set({ ...noEdition(), notice: t(lang, 'ext.urlChanged'), announcement: this.stamp(t(lang, 'ext.urlChanged')) });
  }

  restore(ids: string[], on: boolean) {
    if (!this.applied) return;
    const restoreFocus = this.captureFocus();
    this.applied.restore(ids, on);
    this.set({ restored: this.applied.restored() });
    restoreFocus();
  }
  setStep(i: number) {
    if (!this.applied) return;
    const restoreFocus = this.captureFocus();
    this.applied.setStep(i);
    this.set({ stepIndex: this.applied.stepIndex() });
    restoreFocus();
  }
  compare(on: boolean) {
    if (!this.applied) return;
    this.applied.compare(on);
    this.set({ comparing: on });
  }

  /** Alternates a zero-width suffix so an identical announcement is still read out again. */
  private stamp(text: string): string {
    this.tick += 1;
    return this.tick % 2 ? text : `${text}\u200b`;
  }

  /**
   * Remembers where focus is (inside the rail, or on the page) and returns a function that puts it
   * back. The page must never keep focus it was handed by a transform.
   */
  private captureFocus(): () => void {
    const inner = (this.uiRoot?.activeElement ?? null) as HTMLElement | null;
    const outer = document.activeElement as HTMLElement | null;
    return () => {
      if (inner) {
        if (inner.isConnected && this.uiRoot?.activeElement !== inner) inner.focus({ preventScroll: true });
        return;
      }
      const now = document.activeElement;
      if (now === outer) return;
      if (outer && outer !== document.body && outer.isConnected) outer.focus({ preventScroll: true });
      else if (now instanceof HTMLElement && now !== document.body) now.blur();
    };
  }

  /** Extract → (plain API) → transform → apply. Remembers the result for this site. */
  private async applyPrefs(prefs: MinePreferences, mode: ModeId, remember = true) {
    const id = ++this.run;
    const lang = this.state.lang;
    const restoreFocus = this.captureFocus();
    // Extraction skips what is hidden, so the previous edition comes off before the page is read again.
    this.applied?.undo();
    this.applied = null;
    this.set({ ...noEdition(), mode, prefs, status: t(lang, 'ext.reading'), notice: null });
    const fail = (notice: string) => {
      this.set({ ...noEdition(), notice, announcement: this.stamp(notice) });
      restoreFocus();
    };
    await new Promise((r) => setTimeout(r, 0));
    if (id !== this.run) return;
    let page: ExtractedPage;
    try {
      page = extractPage(document, { lang });
    } catch {
      fail(t(lang, 'ext.noBlocks'));
      return;
    }
    if (page.content.blocks.length < 3) {
      fail(t(lang, 'ext.noBlocks'));
      return;
    }
    let content: PageContent = page.content;
    let notice: string | null = null;
    if (prefs.readingLevel === 'plain' || prefs.explainTerms || prefs.translateTo) {
      const server = this.state.settings.server.replace(/\/+$/, '');
      const direct = this.directChat();
      if (direct) {
        this.set({ status: t(lang, 'ext.rewriting') });
        const merged = await this.rewriteDirect(direct, content, lang, prefs.translateTo);
        if (merged) content = merged;
        else notice = t(lang, 'ext.plainUnavailable');
      } else if (!server) {
        notice = prefs.translateTo ? t(lang, 'ext.noModel.translate') : t(lang, 'ext.noModel');
      } else {
        this.set({ status: t(lang, 'ext.rewriting') });
        const merged = await this.fetchPlain(server, content, lang);
        if (id !== this.run) return;
        if (merged) content = merged;
        else notice = t(lang, 'ext.plainUnavailable');
      }
    }
    // One-at-a-time only makes sense with a real form (four fields or more): a search box, a login pair or a three-field contact form stays as it is.
    const fieldCount = content.blocks.filter((b) => b.kind === 'field').length;
    if (prefs.taskMode === 'one-at-a-time' && fieldCount < 4) prefs = { ...prefs, taskMode: 'all' };
    const tr = transform(content, prefs);
    page = { ...page, content };
    // The applier reports user steps and stub toggles here so the panel follows the page.
    const hooks: ApplyHooks = {
      onStep: (i) => {
        if (id === this.run && this.applied) this.set({ stepIndex: i });
      },
      onRestore: (restored) => {
        if (id === this.run && this.applied) this.set({ restored: new Set(restored) });
      },
    };
    const applied = apply(page, tr, prefs, lang, hooks);
    if (id !== this.run) {
      applied.undo();
      return;
    }
    this.applied = applied;
    const summary = summarySentence(tr, lang);
    const remembered = remember ? !isDefault(prefs) : !!this.state.memory;
    this.set({
      mode,
      prefs,
      tr,
      page,
      status: null,
      notice,
      stepIndex: applied.stepIndex(),
      stepCount: applied.stepCount,
      restored: applied.restored(),
      remembered,
      announcement: this.stamp(t(lang, 'live.transformed', { summary })),
    });
    restoreFocus();
    if (remember && !isDefault(prefs)) {
      const memory: SiteMemory = { mode, prefs, words: this.state.words?.text, reasons: this.state.words?.reasons, source: this.state.words?.source };
      const sites = ((await this.storage.get(['sites'])).sites as Record<string, SiteMemory>) ?? {};
      sites[this.host] = memory;
      await this.storage.set({ sites });
      if (id === this.run) this.set({ memory });
    }
  }

  /** Asks the Plain API for plainText/terms of the complex passages; merges them into a copy of the content. */
  /** The translated edition's target: the setting, else the panel language. */
  translateTarget(): string {
    const t = this.state.settings.translateTo;
    return t && t !== 'auto' ? t : this.state.lang;
  }

  /** A chat call through the background when the person has entered their own key. */
  private directChat(): ChatCall | null {
    const s = this.state.settings;
    if (!s.apiKey) return null;
    return async (messages, signal) => {
      const r = (await browser.runtime.sendMessage({ type: 'LLM', messages, maxTokens: messages.length > 2 ? 2400 : 400 })) as { ok: boolean; content?: string; error?: string } | undefined;
      if (signal.aborted) throw new Error('aborted');
      if (!r?.ok || typeof r.content !== 'string') throw new Error(r?.error ?? 'no reply');
      return r.content;
    };
  }

  /** Plain rewrites straight from the provider, validated by the same rules the server uses. */
  private async rewriteDirect(chat: ChatCall, content: PageContent, lang: Lang, translateTo?: string): Promise<PageContent | null> {
    const kindOf = (b: ContentBlock): PlainKind | null =>
      b.kind === 'text' || b.kind === 'instruction' || b.kind === 'faq' || b.kind === 'notice' || b.kind === 'legal' || b.kind === 'deadline' ? b.kind : null;
    // Translating: every passage, plus each field's label + help and each decision's label (shown beside).
    const textOf = (b: ContentBlock): string =>
      b.kind === 'field' ? [b.label, b.help].filter(Boolean).join(' — ') : b.kind === 'decision' ? b.label : 'text' in b ? b.text : '';
    const kindFor = (b: ContentBlock): PlainKind | null =>
      translateTo ? (b.kind === 'field' ? 'field-help' : b.kind === 'decision' ? 'decision-label' : kindOf(b)) : kindOf(b);
    const candidates = content.blocks.filter((b) => {
      const k = kindFor(b);
      if (!k) return false;
      const text = textOf(b);
      if (translateTo) return text.length >= 2 && text.length <= 1500;
      const complex = 'complexity' in b ? b.complexity !== 'simple' : true;
      return complex && text.length >= 60 && text.length <= 1500;
    });
    if (candidates.length === 0) return content;
    const rewrites = new Map<string, { plainText: string; terms?: { term: string; plain: string }[] }>();
    const cap = translateTo ? 48 : 24;
    for (let i = 0; i < Math.min(candidates.length, cap); i += 12) {
      const batch = candidates.slice(i, i + 12).map((b) => ({ id: b.id, text: textOf(b), kind: kindFor(b)! }));
      try {
        const r = await rewriteBlocks(batch, lang, chat, undefined, translateTo ? { translateTo } : {});
        for (const rw of r.rewrites) rewrites.set(rw.id, { plainText: rw.plainText, terms: rw.terms });
      } catch {
        /* a failed batch leaves those passages as written */
      }
    }
    if (rewrites.size === 0) return null;
    return {
      ...content,
      blocks: content.blocks.map((b) => {
        const rw = rewrites.get(b.id);
        if (!rw) return b;
        if (b.kind === 'deadline') return { ...b, plainText: rw.plainText };
        if (b.kind === 'field') return { ...b, plainHelp: rw.plainText };
        if (b.kind === 'decision') return { ...b, plainLabel: rw.plainText };
        if ('complexity' in b) return { ...b, plainText: rw.plainText, terms: rw.terms?.length ? rw.terms : b.terms };
        return b;
      }),
    };
  }

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
