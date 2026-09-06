// Dates for deadline blocks. Pure string functions, no DOM.
//
// Contract (EXTENSION.md §1, `deadline`): the first parseable date in a text block, as ISO
// `YYYY-MM-DD`, for `YYYY-MM-DD`, `YYYY/M/D`, `YYYY年M月D日`, `Month D, YYYY`, `D Month YYYY`,
// `M/D/YYYY` (US) and `Mon D YYYY`. Decisions the contract left open:
// - `YYYY.M.D` is accepted too (common on Chinese sites); `D/M/YYYY` is not (ambiguous with US).
// - Ordinals ("23rd"), a weekday prefix, "Sept"/"Sep." style abbreviations and an optional
//   trailing 日 are tolerated. Full-width digits are normalised for `lang: 'zh'` only.
// - A match must be a real calendar date (no February 30) with a year in 1900–2199, and must not
//   sit inside a longer digit run (so "12026-10-23" and "20261023" are not dates).
// - `findDeadline` requires the date and a deadline word to share one sentence; sentence breaks
//   are `。！？；` anywhere and `.!?` only when followed by whitespace and a capital letter, so
//   "11:59 p.m. on Friday" does not split while "4:00 a.m. Drafts saved before…" does.
import type { Lang } from '@engine/schema.ts';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_WORD = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const ORDINAL = '(?:st|nd|rd|th)?';

interface Pattern {
  re: RegExp;
  /** Returns [year, month, day] from the match groups. */
  pick: (m: RegExpExecArray) => [string, string, string];
}

// Order matters only for ties at the same index; the earliest match in the text wins.
const PATTERNS: Pattern[] = [
  // 2026-10-23 · 2026/10/23 · 2026.10.23 (one separator, used consistently)
  { re: /(?<!\d)(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?!\d)/g, pick: (m) => [m[1]!, m[3]!, m[4]!] },
  // 2026年10月30日 · 2026 年 10 月 30 (日 optional)
  { re: /(?<!\d)(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g, pick: (m) => [m[1]!, m[2]!, m[3]!] },
  // October 23, 2026 · Oct. 23 2026 · October 23rd, 2026
  { re: new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})(?!\\d)`, 'gi'), pick: (m) => [m[3]!, monthNumber(m[1]!), m[2]!] },
  // 23 October 2026 · 23rd Oct 2026
  { re: new RegExp(`(?<!\\d)(\\d{1,2})${ORDINAL}\\s+${MONTH_WORD},?\\s+(\\d{4})(?!\\d)`, 'gi'), pick: (m) => [m[3]!, monthNumber(m[2]!), m[1]!] },
  // 10/23/2026 (US month/day/year)
  { re: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g, pick: (m) => [m[3]!, m[1]!, m[2]!] },
];

function monthNumber(word: string): string {
  const key = word.toLowerCase().replace(/\.$/, '');
  return String(MONTHS[key] ?? 0);
}

function toIso(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2199 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Full-width digits → ASCII (Chinese pages sometimes use them inside dates). */
function normaliseDigits(text: string, lang: Lang): string {
  if (lang !== 'zh') return text;
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

/** The first parseable date in `text` as `YYYY-MM-DD`, or null. Never throws. */
export function parseDateIso(text: string, lang: Lang): string | null {
  try {
    const s = normaliseDigits(String(text ?? ''), lang);
    let best: { index: number; iso: string } | null = null;
    for (const { re, pick } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        if (best && m.index >= best.index) break;
        const [y, mo, d] = pick(m);
        const iso = toIso(y, mo, d);
        if (iso) {
          best = { index: m.index, iso };
          break;
        }
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return best?.iso ?? null;
  } catch {
    return null;
  }
}

/**
 * Words that make a dated sentence a deadline (EN + ZH, from the contract, plus the review's
 * 日前 / 前完成 / 前报送 / 前将 / 以前 / on or before). `日前` counts only right after a day number
 * ("6月30日前"), because on its own it means "a few days ago" in news copy.
 */
export const DEADLINE_WORDS =
  /\b(?:deadline|due|by|before|on or before|no later than|closes?|closing|expires?|expiry|until|must be (?:received|submitted))\b|截止|截至|不迟于|之前|前提交|前完成|前报送|前将|以前|到期|(?<=\d)\s*日前|止(?![^\s]*痛)/i;

const MONTH_WORD_RE = new RegExp(`\\b${MONTH_WORD}`, 'i').source;
/** A date without a year: 6月30日 · 6/30 · June 30 · 30 June (none followed by a year). */
const YEARLESS_DATE: RegExp[] = [
  /(?<![\d年])\d{1,2}\s*月\s*\d{1,2}\s*日/,
  /(?<![\d/])\d{1,2}\/\d{1,2}(?![\d/])/,
  new RegExp(`${MONTH_WORD_RE}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?!,?\\s*\\d{4})`, 'i'),
  new RegExp(`(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_WORD_RE}\\b(?!,?\\s*\\d{4})`, 'i'),
];

/**
 * True when some sentence holds a deadline word and a yearless date (6月30日, 6/30, June 30) but no
 * parseable dated deadline: the block cannot become a `deadline` (no ISO date), yet it must stay
 * primary text — a container class must never demote it (review [21]).
 */
export function findDeadlineHint(text: string, lang: Lang): boolean {
  try {
    for (const sentence of sentences(normaliseDigits(String(text ?? ''), lang))) {
      if (!DEADLINE_WORDS.test(sentence)) continue;
      if (parseDateIso(sentence, lang)) continue;
      if (YEARLESS_DATE.some((re) => re.test(sentence))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z"“(\[])|(?<=[。！？；;])/;

/** Splits text into sentences without breaking on "p.m." or "No. 5". */
export function sentences(text: string): string[] {
  return text.split(SENTENCE_BREAK).map((s) => s.trim()).filter(Boolean);
}

/**
 * The deadline's ISO date when some sentence of `text` holds both a parseable date and a
 * deadline word; otherwise null. Never throws.
 */
export function findDeadline(text: string, lang: Lang): string | null {
  try {
    for (const sentence of sentences(String(text ?? ''))) {
      if (!DEADLINE_WORDS.test(sentence)) continue;
      const iso = parseDateIso(sentence, lang);
      if (iso) return iso;
    }
    return null;
  } catch {
    return null;
  }
}
