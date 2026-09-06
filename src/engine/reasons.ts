// Every human-readable reason the engine writes, in EN and ZH.
// Reasons are written in content.meta.lang (the language of the page), not the UI language.
// Sentence case; clean written Chinese; no slang.
import type { Lang } from './schema.ts';

interface Pair {
  en: string;
  zh: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Known regions get a phrase; unknown regions (and `main`) get none. */
const REGION: Record<string, Pair> = {
  header: { en: 'from the header', zh: '从页眉' },
  sidebar: { en: 'from the sidebar', zh: '从侧栏' },
  footer: { en: 'from the footer', zh: '从页脚' },
  utility: { en: 'from the utility bar', zh: '从工具栏' },
};

export const reasons = {
  /** Rule 1 — decorative images set aside because media is off. */
  hiddenMedia(lang: Lang, n: number): string {
    if (lang === 'zh') return `收起 ${n} 张装饰图片：这个版本不显示装饰图片。`;
    return `Set aside: ${plural(n, 'decorative image', 'decorative images')}. Images are off in this edition.`;
  },

  /** Rule 2 — decorative / secondary blocks set aside, one change per region. */
  /** Rule 1, on request — every image set aside, captions and all; each is one tap away. */
  hiddenAllImages(lang: Lang, n: number): string {
    if (lang === 'zh') return `按你的要求收起 ${n} 张图片，包括有说明的插图；每一张都能展开。`;
    return `${n} image${n === 1 ? '' : 's'} set aside at your request, informative ones included; each can be shown again.`;
  },

  hidden(lang: Lang, n: number, region?: string): string {
    const where = region === undefined ? undefined : REGION[region];
    if (lang === 'zh') return `${where?.zh ?? ''}收起 ${n} 项，完成本页用不到。`;
    const from = where ? ` ${where.en}` : '';
    return `Set aside${from}: ${plural(n, 'item', 'items')} not needed to complete this page.`;
  },

  /** Rule 2 (comfortable) — secondary blocks collapsed in place. */
  collapsedSecondary(lang: Lang, n: number): string {
    if (lang === 'zh') return `各折叠为一行：${n} 项相关内容，需要时再展开。`;
    if (n === 1) return 'Collapsed to one line: 1 related item. Open it when you need it.';
    return `Collapsed to one line each: ${n} related items. Open any of them when you need it.`;
  },

  /** Rule 3 (reduced) — the site menu collapsed to "Menu (n)". */
  navCollapsed(lang: Lang, items: number): string {
    if (lang === 'zh') return `菜单折叠为一行（${items} 项），需要时再展开。`;
    return `Menu collapsed to one line (${plural(items, 'item', 'items')}). Open it when you need it.`;
  },

  /** Rule 3 (hidden) — the site menu set aside behind a stub. */
  navHidden(lang: Lang, items: number): string {
    if (lang === 'zh') return `菜单已收起（${items} 项），可在原位置重新展开。`;
    return `Menu set aside (${plural(items, 'item', 'items')}). It can be brought back where it was.`;
  },

  /** Rule 4 — the deadline moved to the top. Same words as the UI badge (copy deadline.moved). */
  deadlineMoved(lang: Lang): string {
    return lang === 'zh' ? '从页面下方移到了这里。' : 'Moved up from later in the page.';
  },

  /** Rule 5 — a passage replaced by its plain version. */
  rewritten(lang: Lang): string {
    if (lang === 'zh') return '改写为平实语言，原文保留，随时可看。';
    return 'Rewritten in plain words. The original is kept one tap away.';
  },

  /** Rule 5 (translated edition) — a passage replaced by its translation. */
  translated(lang: Lang, target: string): string {
    if (lang === 'zh') return `译成${langName(target, lang)}，原文保留，随时可看。`;
    return `Translated into ${langName(target, lang)}. The original is kept one tap away.`;
  },
  /** Rule 5 (translated edition) — a field's label and help shown translated beside the field. */
  fieldTranslated(lang: Lang, target: string): string {
    if (lang === 'zh') return `填写项的${langName(target, lang)}说明附在旁边，表单本身不变。`;
    return `${langName(target, lang)} for the field shown beside it; the form itself is unchanged.`;
  },
  /** Rule 5 (translated edition) — legal text and decisions are never replaced; the translation sits beside. */
  besideTranslated(lang: Lang, target: string): string {
    if (lang === 'zh') return `原文保持不变，旁边附上${langName(target, lang)}译文。`;
    return `Left as written; a ${langName(target, lang)} translation is shown beside it.`;
  },

  /** Rule 5 — a field's help text replaced by its plain version. */
  helpRewritten(lang: Lang): string {
    if (lang === 'zh') return '说明文字改写为平实语言，原文保留。';
    return 'Help text rewritten in plain words. The original is kept.';
  },

  /** Rule 5 — legal text is never replaced; the summary sits beside it. */
  legalAnnotated(lang: Lang): string {
    if (lang === 'zh') return '法律条文保持原样，旁边附上平实摘要。';
    return 'Legal text left as written; a plain summary is shown beside it.';
  },

  /** Rule 5 — a decision's label is never replaced; the plain label sits beside it. */
  decisionAnnotated(lang: Lang): string {
    if (lang === 'zh') return '选项原文保持不变，旁边附上平实说明。';
    return 'Choice left as written; a plain label is shown beside it.';
  },

  /** Rule 6 — terms explained in place. */
  explained(lang: Lang, n: number): string {
    if (lang === 'zh') return `就地解释 ${n} 个术语，原文不变。`;
    return `${plural(n, 'term', 'terms')} explained in place. The wording is unchanged.`;
  },

  /** Rule 7 — fields and actions enlarged. */
  enlarged(lang: Lang, n: number): string {
    if (lang === 'zh') return `${n} 个控件放大到至少 48 像素，更容易点中。`;
    if (n === 1) return '1 control enlarged to at least 48 px, so it is easier to tap.';
    return `${n} controls enlarged to at least 48 px, so they are easier to tap.`;
  },

  /** Rule 8 — an optional decision brought forward (its own step in one-at-a-time). */
  surfaced(lang: Lang, preChecked: boolean, stepped: boolean): string {
    if (lang === 'zh') {
      const how = stepped ? '单独列为一步' : '摆到台前';
      return preChecked ? `原页面已默认勾选；${how}，由你决定。` : `可选项；${how}，不会被漏掉。`;
    }
    const how = stepped ? 'shown as its own step' : 'brought forward';
    return preChecked
      ? `Pre-checked on the original page; ${how} so you can decide.`
      : `Optional; ${how} so it is not missed.`;
  },

  /** Rule 9 — one step. `others` = non-primary actions folded at the end of this step. */
  stepped(lang: Lang, title: string, items: number, fields: number, others: number): string {
    if (lang === 'zh') {
      const fill = fields > 0 ? `，其中 ${fields} 项需要填写` : '';
      const tail = others > 0 ? `另有 ${others} 个其它操作折叠在末尾。` : '';
      return `一次一步：「${title}」共 ${items} 项${fill}。${tail}`;
    }
    const fill = fields > 0 ? `, ${fields} of them to fill in` : '';
    const tail =
      others > 0
        ? ` ${others === 1 ? '1 other option is' : `${others} other options are`} folded at the end.`
        : '';
    return `One step at a time: “${title}” holds ${plural(items, 'item', 'items')}${fill}.${tail}`;
  },
};

/** Title of a choice step (copy step.choice). */
const LANG_NAMES: Record<string, Pair> = {
  zh: { en: 'Chinese', zh: '中文' },
  en: { en: 'English', zh: '英文' },
  ja: { en: 'Japanese', zh: '日文' },
  ko: { en: 'Korean', zh: '韩文' },
  es: { en: 'Spanish', zh: '西班牙文' },
  fr: { en: 'French', zh: '法文' },
  de: { en: 'German', zh: '德文' },
};
/** Human name of a target language, in the UI language. Unknown codes are shown as given. */
export function langName(code: string, lang: Lang): string {
  return LANG_NAMES[code.toLowerCase().split('-')[0] ?? '']?.[lang] ?? code;
}

export function choiceStepTitle(lang: Lang): string {
  return lang === 'zh' ? '一个选择' : 'A choice';
}

// ---------------------------------------------------------------------------
// Fallback interpreter (§7): effect strings and the reason format
// ---------------------------------------------------------------------------

export type FallbackEffect =
  | 'translate'
  | 'quiet'
  | 'quietKeepImages'
  | 'steps'
  | 'terms'
  | 'plain'
  | 'larger'
  | 'muchLarger'
  | 'contrast'
  | 'mediaOn'
  | 'mediaOff'
  | 'decisions';

const EFFECTS: Record<FallbackEffect, Pair> = {
  quiet: {
    en: 'fewer items on screen, menu folded, decorative images off',
    zh: '屏幕上的内容更少，菜单折叠，装饰图片关闭',
  },
  quietKeepImages: { en: 'fewer items on screen, menu folded', zh: '屏幕上的内容更少，菜单折叠' },
  steps: { en: 'one task per step, choices brought forward', zh: '一次一步，选项摆到台前' },
  terms: { en: 'terms explained in place', zh: '术语就地解释' },
  plain: { en: 'passages shown in plain words', zh: '段落改为平实语言' },
  larger: { en: 'text at 135%', zh: '字号放大到 135%' },
  muchLarger: { en: 'text at 160%', zh: '字号放大到 160%' },
  contrast: { en: 'high contrast', zh: '高对比度' },
  mediaOn: { en: 'images kept', zh: '保留图片' },
  mediaOff: { en: 'images set aside', zh: '收起图片' },
  decisions: { en: 'choices brought forward', zh: '选项摆到台前' },
  translate: { en: 'passages translated, original one tap away', zh: '段落翻译，原文随时可看' },
};

/** `"<matched phrase>" → <effect>` in the given language. */
export function fallbackReason(lang: Lang, phrase: string, effect: FallbackEffect): string {
  return `"${phrase}" → ${EFFECTS[effect][lang]}`;
}

export function fallbackNoMatch(lang: Lang): string {
  if (lang === 'zh') return '你的话里没有匹配到任何设置，页面保持原样。';
  return 'Nothing in your words matched a setting, so the page is unchanged.';
}
