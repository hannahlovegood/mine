// The offline interpreter for My words (CLAUDE.md §7 phrase table).
// Lowercases the text, tests each phrase group in table order, applies the
// group's settings (later groups override earlier ones on the same key) and
// writes one reason per matched group: "<matched phrase>" → <effect>.
import { DEFAULT_PREFERENCES } from './presets.ts';
import type { Lang, MinePreferences } from './schema.ts';
import { fallbackNoMatch, fallbackReason, type FallbackEffect } from './reasons.ts';

export type GroupKey =
  | 'translate'
  | 'quiet'
  | 'steps'
  | 'terms'
  | 'plain'
  | 'larger'
  | 'contrast'
  | 'mediaOn'
  | 'mediaOff'
  | 'decisions';

export interface PhraseGroup {
  key: GroupKey;
  en: readonly string[];
  zh: readonly string[];
  /** Applies the group's settings. `intensified` matters only for `larger`; `text` (lowercased) only for `translate`. */
  apply(p: MinePreferences, intensified: boolean, text: string, lang: Lang): void;
}

/** The §7 table, in table order. English phrases match at word starts; Chinese phrases anywhere. */
export const PHRASE_GROUPS: readonly PhraseGroup[] = [
  {
    key: 'quiet',
    en: ['overwhelm', 'distract', 'quiet', 'clutter', 'noise', 'less', 'calm', 'too much'],
    // 喘不过气 and 太长 are not in the §7 table. They are added so the Chinese pitch
    // sentence (copy words.example.zh, «长表单让我喘不过气…») yields the same
    // preferences as the English one. Noted in DECISIONS.md.
    zh: ['干扰', '太多', '安静', '简洁', '乱', '太满', '喘不过气', '太长'],
    apply: (p) => {
      p.density = 'minimal';
      p.navigation = 'reduced';
      p.showDecorativeMedia = false;
    },
  },
  {
    key: 'steps',
    en: ['one at a time', 'one decision', 'one question', 'step by step', 'one thing'],
    zh: ['一次一个', '一步一步', '一件事', '一个决定'],
    apply: (p) => {
      p.taskMode = 'one-at-a-time';
      p.surfaceDecisions = true;
    },
  },
  {
    key: 'terms',
    en: ['explain', 'unfamiliar', 'jargon', 'terms', 'what does', 'mean'],
    zh: ['解释', '术语', '看不懂', '不懂', '什么意思'],
    apply: (p) => {
      p.explainTerms = true;
    },
  },
  {
    key: 'plain',
    en: ['plain', 'simple language', 'simpler words', 'easy words'],
    zh: ['简单', '通俗', '大白话', '平实'],
    apply: (p) => {
      p.readingLevel = 'plain';
    },
  },
  {
    key: 'larger',
    en: ['bigger', 'larger', 'large text', "can't see", 'small text', 'zoom'],
    zh: ['放大', '大一点', '看不清', '字太小'],
    apply: (p, intensified) => {
      p.fontScale = intensified ? 1.6 : 1.35;
    },
  },
  {
    key: 'contrast',
    en: ['contrast', 'hard to read', 'faint', 'washed out'],
    zh: ['对比度', '看不清楚', '太淡'],
    apply: (p) => {
      p.contrast = 'high';
    },
  },
  {
    key: 'mediaOn',
    en: ['keep the images', 'keep images', 'pictures matter'],
    zh: ['保留图片', '留下图片'],
    apply: (p) => {
      p.showDecorativeMedia = true;
      delete p.hideAllImages;
    },
  },
  {
    key: 'mediaOff',
    en: ['no images', 'remove images', 'remove the images', 'hide pictures', 'hide images', 'without images', 'no pictures'],
    zh: ['去掉图片', '不要图片', '去除图片', '删除图片', '隐藏图片', '不看图片', '去掉插图', '去掉所有图片'],
    apply: (p) => {
      // Said in so many words: every image goes, informative ones included (rule 1).
      p.showDecorativeMedia = false;
      p.hideAllImages = true;
    },
  },
  {
    key: 'translate',
    en: ['translate', 'translation', 'in english', 'into english', 'in chinese', 'into chinese', 'in japanese', 'into japanese'],
    zh: ['翻译', '翻成', '译成', '中文版', '英文版', '看中文', '看英文', '看不懂英文'],
    apply: (p, _i, text, lang) => {
      p.translateTo = targetIn(text, lang);
    },
  },
  {
    key: 'decisions',
    en: ['agreeing to', 'my choices', 'consent', 'what am i signing'],
    zh: ['同意了什么', '选择', '授权', '签了什么'],
    apply: (p) => {
      p.surfaceDecisions = true;
    },
  },
];

/** The language a translation request names; the person's own language when it names none. */
const LANG_WORDS: [RegExp, string][] = [
  [/chinese|中文|汉语|华文/, 'zh'],
  [/english|英文|英语/, 'en'],
  [/japanese|日文|日语/, 'ja'],
  [/korean|韩文|韩语/, 'ko'],
  [/spanish|西班牙/, 'es'],
  [/french|法文|法语/, 'fr'],
  [/german|德文|德语/, 'de'],
];
function codeOf(name: string): string | undefined {
  return LANG_WORDS.find(([re]) => re.test(name))?.[1];
}
function targetIn(text: string, lang: Lang): string {
  // "翻成中文" / "into English": the language after the verb is the target.
  const explicit = /(?:翻成|译成|翻译成|翻译为|翻译到|into|to|in)\s*(chinese|english|japanese|korean|spanish|french|german|中文|汉语|华文|英文|英语|日文|日语|韩文|韩语|西班牙文|西班牙语|法文|法语|德文|德语)/.exec(text);
  if (explicit?.[1]) return codeOf(explicit[1]) ?? lang;
  // "看不懂英文" / "can't read the English": that names the source; the target is the person's own language.
  if (/看不懂|不懂|读不懂|can't read|cannot read|don't understand/.test(text)) return lang;
  for (const [re, code] of LANG_WORDS) if (re.test(text)) return code;
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : lang;
}

/** "much" / 很 / 非常 / 特别 in the same clause as a bigger-text phrase → fontScale 1.6. */
const INTENSIFIERS = ['much', '很', '非常', '特别'];
const CLAUSE_BREAK = /[.!?;:,\n，。！？；：、]/;
/** When more than five groups match, keep the most impactful (then restore table order). */
const PRIORITY: readonly GroupKey[] = [
  'translate',
  'quiet',
  'steps',
  'plain',
  'terms',
  'larger',
  'contrast',
  'mediaOff',
  'mediaOn',
  'decisions',
];
const MAX_REASONS = 5;
const MAX_REASON_LENGTH = 160;
const MAX_QUOTE_LENGTH = 60;

export interface FallbackResult {
  preferences: MinePreferences;
  reasons: string[];
}

export function fallback(text: string, lang: Lang): FallbackResult {
  const preferences: MinePreferences = { ...DEFAULT_PREFERENCES };
  const lowered = lower(text);
  const matched: { key: GroupKey; quote: string }[] = [];

  for (const group of PHRASE_GROUPS) {
    const hit = firstHit(lowered, group);
    if (!hit) continue;
    const clause = clauseAround(lowered, hit.at, hit.phrase.length);
    group.apply(
      preferences,
      INTENSIFIERS.some((w) => clause.includes(w)),
      lowered,
      lang,
    );
    matched.push({ key: group.key, quote: quoteAt(text, lowered, hit.at, hit.phrase) });
  }

  if (matched.length === 0) return { preferences, reasons: [fallbackNoMatch(lang)] };

  const reasons = matched.flatMap(({ key, quote }) => {
    const effect = effectOf(key, preferences);
    return effect ? [{ key, text: clamp(fallbackReason(lang, quote, effect)) }] : [];
  });
  return { preferences, reasons: keepMostImpactful(reasons).map((r) => r.text) };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Length-preserving lowercase (ASCII only) so indices map back onto the original text. */
function lower(text: string): string {
  return text.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/[‘’]/g, "'");
}

const isAscii = (s: string): boolean => /^[\x20-\x7e]+$/.test(s);
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[a-z0-9']/i.test(c);

/** Index of `phrase` in the text; English phrases must start at a word boundary ("plain" never matches "explain"). */
function indexOfPhrase(lowered: string, phrase: string): number {
  const wordStart = isAscii(phrase);
  let from = 0;
  for (;;) {
    const i = lowered.indexOf(phrase, from);
    if (i < 0) return -1;
    if (!wordStart || !isWordChar(lowered[i - 1])) return i;
    from = i + 1;
  }
}

/** The group's phrase that occurs earliest in the text (ties: table order). */
function firstHit(lowered: string, group: PhraseGroup): { phrase: string; at: number } | undefined {
  let best: { phrase: string; at: number } | undefined;
  for (const phrase of [...group.en, ...group.zh]) {
    const at = indexOfPhrase(lowered, phrase);
    if (at >= 0 && (best === undefined || at < best.at)) best = { phrase, at };
  }
  return best;
}

function clauseAround(lowered: string, at: number, length: number): string {
  let start = at;
  while (start > 0 && !CLAUSE_BREAK.test(lowered[start - 1] ?? '')) start--;
  let end = at + length;
  while (end < lowered.length && !CLAUSE_BREAK.test(lowered[end] ?? '')) end++;
  return lowered.slice(start, end);
}

/** The phrase as the person wrote it: original casing, whole words for English. */
function quoteAt(text: string, lowered: string, at: number, phrase: string): string {
  let start = at;
  let end = at + phrase.length;
  if (isAscii(phrase)) {
    while (isWordChar(lowered[start - 1])) start--;
    while (isWordChar(lowered[end])) end++;
  }
  const quote = text.slice(start, end);
  return quote.length > MAX_QUOTE_LENGTH ? `${quote.slice(0, MAX_QUOTE_LENGTH - 1)}…` : quote;
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

/** The effect to name for a matched group, given the final preferences (an overridden media phrase gets none). */
function effectOf(key: GroupKey, final: MinePreferences): FallbackEffect | undefined {
  switch (key) {
    case 'quiet':
      return final.showDecorativeMedia ? 'quietKeepImages' : 'quiet';
    case 'larger':
      return final.fontScale === 1.6 ? 'muchLarger' : 'larger';
    case 'mediaOn':
      return final.showDecorativeMedia ? 'mediaOn' : undefined;
    case 'mediaOff':
      return final.showDecorativeMedia ? undefined : 'mediaOff';
    default:
      return key;
  }
}

function keepMostImpactful<T extends { key: GroupKey }>(reasons: T[]): T[] {
  if (reasons.length <= MAX_REASONS) return reasons;
  const rank = (r: T) => PRIORITY.indexOf(r.key);
  const kept = new Set([...reasons].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_REASONS));
  return reasons.filter((r) => kept.has(r));
}

function clamp(reason: string): string {
  return reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH - 1)}…` : reason;
}
