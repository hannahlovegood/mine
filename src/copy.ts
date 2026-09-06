// Every UI string, EN + ZH. The UI reads only from here (§10).
// Sentence case everywhere. No all-caps eyebrows, no arrows appended to buttons.
import type { Lang } from './engine/schema';

type Entry = { en: string; zh: string };

export const copy = {
  'brand.name': { en: 'Mine', zh: '由我' },
  'brand.descriptor': { en: 'a freedom layer for the web', zh: '让任何页面由你决定' },
  'brand.tagline': { en: 'Mine · 由我', zh: '由我 · Mine' },

  'nav.skip': { en: 'Skip to content', zh: '跳到正文' },
  'nav.lang': { en: '中文', zh: 'English' },
  'nav.langLabel': { en: 'Switch to Chinese', zh: '切换为英文' },
  'nav.lab': { en: 'Lab', zh: '实验台' },
  'nav.repo': { en: 'Code', zh: '代码' },

  // Landing
  'hero.title': { en: 'The interface is not neutral.', zh: '界面从不中立。' },
  'hero.sub': {
    en: 'Every page imagines a reader — someone with time, sharp eyes and patience for jargon. Mine lets you replace that imagined reader with yourself.',
    zh: '每个页面都预设了一位读者：有时间、眼神好、耐得住术语。「由我」让你把这位"预设读者"换成你自己。',
  },
  'hero.cta': { en: 'Make it mine', zh: '变成我的' },
  'hero.secondary': { en: 'See what changed', zh: '看看改了什么' },
  'hero.replay': { en: 'Replay', zh: '重播' },
  'hero.before': { en: 'The page as published', zh: '原页面' },
  'hero.after': { en: 'The same page, in Focus', zh: '同一页面，专注版' },
  'hero.example': { en: 'What one edition changed', zh: '一个版本改了什么' },

  'freedoms.title': { en: 'Three freedoms, one page', zh: '一个页面，三种自由' },
  'freedoms.1.title': { en: 'Freedom to shape', zh: '塑形的自由' },
  'freedoms.1.body': {
    en: 'Presets and My words reorganise the page: set aside, group, enlarge, plain words, one thing at a time.',
    zh: '预设与「我的话」重排页面：收起、归组、放大、平实语言、一次只做一件事。',
  },
  'freedoms.2.title': { en: 'Freedom to see your choices', zh: '看见选择的自由' },
  'freedoms.2.body': {
    en: 'The engine surfaces every decision the page asks for, labels which are optional, and notes what was pre-checked.',
    zh: '引擎把页面要你做的每个决定都摆到台前，标出哪些可选，并注明哪些被默认勾选。',
  },
  'freedoms.3.title': { en: 'Freedom to change your mind', zh: '改变主意的自由' },
  'freedoms.3.body': {
    en: 'The original is one gesture away. Every change is listed and reversible. Nothing is auto-decided.',
    zh: '原版只隔一个手势。每一处改动都有清单、都能撤回。没有任何决定是替你做的。',
  },

  'not.title': { en: 'What this is not', zh: '它不是什么' },
  'not.overlay': {
    en: 'Not an accessibility overlay. Overlays are installed by site owners to claim compliance and hide what they do. This runs on the reader’s side, never claims compliance for anyone, and logs every change.',
    zh: '不是无障碍 overlay。Overlay 由网站主安装，用来宣称合规并掩盖它改了什么。这个东西在读者这一侧运行，从不替任何人宣称合规，每一处改动都记录在案。',
  },
  'not.reader': {
    en: 'Not reader mode. Reader mode adapts reading. This adapts doing: forms, decisions, deadlines.',
    zh: '不是阅读模式。阅读模式解决「读」，这个解决「办」：表单、决定、截止日期。',
  },
  'not.agent': {
    en: 'Not a browser agent. Agents act for you; you still don’t know what you agreed to. Mine changes the interface so you can act yourself. Delegation is not autonomy.',
    zh: '不是浏览器 agent。Agent 替你做，你仍然不知道自己同意了什么。「由我」改的是界面，让你自己来做。委托不等于自主。',
  },

  // Lab
  'lab.title': { en: 'Same information. Your edition.', zh: '同一份信息，属于你的版本。' },
  'lab.pageLabel': { en: 'The page', zh: '页面' },
  'lab.portalLabel': { en: 'Original page', zh: '原版页面' },
  'lab.editionLabel': { en: 'Your edition', zh: '你的版本' },
  'lab.modes': { en: 'Modes', zh: '模式' },

  'modes.default': { en: 'Default', zh: '原版' },
  'modes.focus': { en: 'Focus', zh: '专注' },
  'modes.plain': { en: 'Plain', zh: '平实' },
  'modes.large': { en: 'Large', zh: '大字' },
  'modes.words': { en: 'My words', zh: '我的话' },
  'modes.default.desc': { en: 'The page as published.', zh: '页面原来的样子。' },
  'modes.focus.desc': { en: 'For when there is too much on screen.', zh: '当屏幕上的东西太多。' },
  'modes.plain.desc': { en: 'For when the words are the obstacle.', zh: '当词语本身成了障碍。' },
  'modes.large.desc': { en: 'For when the text is too small.', zh: '当字太小。' },
  'modes.words.desc': { en: 'Describe how the page should feel.', zh: '用你的话说这个页面该是什么感觉。' },

  // My words
  'words.title': { en: 'How should this page feel to you?', zh: '你希望这个页面是什么感觉？' },
  'words.placeholder': {
    en: 'Fewer distractions. Explain unfamiliar words. One decision at a time.',
    zh: '少一点干扰。解释我看不懂的词。一次只让我做一个决定。',
  },
  'words.chip.1': { en: 'quieter', zh: '安静一点' },
  'words.chip.2': { en: 'fewer decisions', zh: '少做决定' },
  'words.chip.3': { en: 'explain unfamiliar words', zh: '解释术语' },
  'words.chip.4': { en: 'bigger text', zh: '字大一点' },
  'words.chip.5': { en: 'keep the images', zh: '保留图片' },
  'words.button': { en: 'Transform', zh: '为我重排' },
  'words.working': { en: 'Reading your words…', zh: '正在读你的话……' },
  'words.source.model': { en: 'Interpreted by model', zh: '由模型理解' },
  'words.source.fallback': { en: 'Interpreted offline', zh: '离线规则理解' },
  'words.clear': { en: 'Clear', zh: '清空' },
  'words.example': {
    en: 'I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time.',
    zh: '长表单让我喘不过气。用大白话，解释我可能不懂的词，一次只让我做一个决定。',
  },
  'words.hint': { en: 'Your words stay on this device. Only this sentence is sent to the interpreter.', zh: '你的话留在这台设备上，只有这句话会发给解释器。' },

  // Colophon
  'colophon.title': { en: 'What changed', zh: '改了什么' },
  'colophon.prefix': { en: 'This edition:', zh: '这个版本：' },
  'colophon.none': { en: 'This is the page as published. Nothing has changed.', zh: '这是页面原来的样子，什么都没改。' },
  'colophon.frag.hidden.one': { en: '1 item set aside', zh: '收起 1 项' },
  'colophon.frag.hidden.many': { en: '{n} items set aside', zh: '收起 {n} 项' },
  'colophon.frag.collapsed.one': { en: '1 section collapsed', zh: '折叠 1 处' },
  'colophon.frag.collapsed.many': { en: '{n} sections collapsed', zh: '折叠 {n} 处' },
  'colophon.frag.moved.one': { en: '1 item moved up', zh: '上移 1 项' },
  'colophon.frag.moved.many': { en: '{n} items moved up', zh: '上移 {n} 项' },
  'colophon.frag.rewritten.one': { en: '1 passage in plain words', zh: '1 段改写为平实语言' },
  'colophon.frag.rewritten.many': { en: '{n} passages in plain words', zh: '{n} 段改写为平实语言' },
  'colophon.frag.explained.one': { en: '1 term explained', zh: '解释 1 个术语' },
  'colophon.frag.explained.many': { en: '{n} terms explained', zh: '解释 {n} 个术语' },
  'colophon.frag.enlarged.one': { en: '1 control enlarged', zh: '放大 1 个控件' },
  'colophon.frag.enlarged.many': { en: '{n} controls enlarged', zh: '放大 {n} 个控件' },
  'colophon.frag.steps': { en: '{fields} fields in {steps} steps', zh: '{fields} 个填写项分成 {steps} 步' },
  'colophon.steps.n': { en: '{n} steps', zh: '共 {n} 步' },
  'colophon.frag.surfaced.one': { en: '1 choice surfaced', zh: '揭示 1 个可选项' },
  'colophon.frag.surfaced.many': { en: '{n} choices surfaced', zh: '揭示 {n} 个可选项' },
  'colophon.why': { en: 'Why', zh: '为什么' },
  'colophon.every': { en: 'Every change', zh: '每一处改动' },
  'colophon.open': { en: 'Show the list', zh: '展开清单' },
  'colophon.close': { en: 'Hide the list', zh: '收起清单' },
  'colophon.pill': { en: '{n} changes', zh: '{n} 处改动' },
  'colophon.pill.one': { en: '1 change', zh: '1 处改动' },
  'colophon.type.hidden': { en: 'Set aside', zh: '收起' },
  'colophon.type.collapsed': { en: 'Collapsed', zh: '折叠' },
  'colophon.type.moved': { en: 'Moved', zh: '移动' },
  'colophon.type.rewritten': { en: 'Rewritten', zh: '改写' },
  'colophon.type.explained': { en: 'Explained', zh: '解释' },
  'colophon.type.enlarged': { en: 'Enlarged', zh: '放大' },
  'colophon.type.stepped': { en: 'Stepped', zh: '分步' },
  'colophon.type.surfaced': { en: 'Surfaced', zh: '揭示' },
  'colophon.restore': { en: 'Show', zh: '展开' },
  'colophon.restored': { en: 'Shown', zh: '已展开' },
  'colophon.blocks': { en: '{n} blocks', zh: '{n} 个块' },
  'colophon.blocks.one': { en: '1 block', zh: '1 个块' },

  // Decisions card
  'decisions.title': { en: 'This page asks you for {n} decisions.', zh: '这个页面需要你做 {n} 个决定。' },
  'decisions.title.one': { en: 'This page asks you for 1 decision.', zh: '这个页面需要你做 1 个决定。' },
  'decisions.title.none': { en: 'This page asks you for no decisions.', zh: '这个页面不需要你做决定。' },
  'decisions.optional': { en: 'Optional — you can decline.', zh: '可选，你可以拒绝。' },
  'decisions.required': { en: 'Required to submit.', zh: '提交所必需。' },
  'decisions.prechecked': { en: 'Pre-checked on the original page.', zh: '原页面已默认勾选。' },
  'decisions.consequence': { en: 'What it means', zh: '这意味着' },

  // Blocks
  'deadline.moved': { en: 'Moved up from later in the page.', zh: '从页面下方移到了这里。' },
  'deadline.label': { en: 'Deadline', zh: '截止日期' },
  'stub.count': { en: '{n} items set aside', zh: '已收起 {n} 项' },
  'stub.count.one': { en: '1 item set aside', zh: '已收起 1 项' },
  'stub.nav': { en: 'Menu ({n})', zh: '菜单（{n}）' },
  'stub.nav.hidden': { en: 'Menu set aside', zh: '菜单已收起' },
  'portal.brand': { en: 'County benefits portal', zh: '政务服务门户' },
  'portal.brandSub': { en: 'Official website', zh: '官方网站' },
  'portal.related': { en: 'Related links', zh: '相关链接' },
  'portal.announcements': { en: 'Announcements', zh: '通知公告' },
  'portal.rate': { en: 'Was this page helpful?', zh: '这个页面有帮助吗？' },
  'stub.hide': { en: 'Set aside again', zh: '重新收起' },
  'rewritten.tag': { en: 'Plain version', zh: '平实版' },
  'rewritten.show': { en: 'Show original', zh: '看原文' },
  'rewritten.hide': { en: 'Hide original', zh: '收起原文' },
  'rewritten.original': { en: 'Original', zh: '原文' },
  'legal.summary': { en: 'In plain words', zh: '平实版摘要' },
  'term.label': { en: 'Explanation of {term}', zh: '「{term}」的解释' },
  'field.required': { en: 'Required', zh: '必填' },
  'field.optional': { en: 'Optional', zh: '选填' },
  'field.help': { en: 'Help', zh: '说明' },
  'image.setAside': { en: 'Image set aside', zh: '图片已收起' },

  // Hold / reset
  'hold': { en: 'Hold to see the original', zh: '按住查看原版' },
  'hold.keyboard': { en: 'Press to toggle the original', zh: '按下切换原版' },
  'hold.showing': { en: 'Showing the original', zh: '正在显示原版' },
  'reset': { en: 'Back to original', zh: '回到原版' },

  // Stepper
  'step.progress': { en: 'Step {i} of {n}', zh: '第 {i} 步，共 {n} 步' },
  'step.choice': { en: 'A choice', zh: '一个选择' },
  'step.next': { en: 'Next', zh: '下一步' },
  'step.back': { en: 'Back', zh: '上一步' },
  'step.other': { en: 'Other options', zh: '其它操作' },
  'step.other.hide': { en: 'Hide other options', zh: '收起其它操作' },
  'step.all': { en: 'All steps', zh: '全部步骤' },

  // Live region
  'live.transformed': { en: 'Page transformed. {summary}', zh: '页面已重排。{summary}' },
  'live.original': { en: 'Back to the original page.', zh: '已回到原版页面。' },

  // Honesty
  'honesty.title': { en: 'Where this stands', zh: '现在做到了哪一步' },
  'honesty.body': {
    en: 'Today the page is described in our block schema. Extracting that schema from any real page is the roadmap — a browser extension with the same invariants: a critical block cannot disappear, a number cannot change in plain words.',
    zh: '今天这个页面是用我们的块结构描述的。从任意真实页面抽出这套结构是下一步：一个带同一套不变量的浏览器扩展——关键信息不会消失，数字在平实版里不会变。',
  },

  // Ending
  'ending.1': { en: 'Access is not enough.', zh: '能进入，还不够。' },
  'ending.2': { en: 'Control is.', zh: '能掌控，才算数。' },
  'ending.3': {
    en: 'Freedom is being able to shape how the world meets you.',
    zh: '自由，是能决定世界以什么方式来到你面前。',
  },
  'ending.repo': { en: 'See the code', zh: '看代码' },
  'ending.again': { en: 'Back to the lab', zh: '回到实验台' },

  // Extension
  'ext.button': { en: 'Make it mine', zh: '变成我的' },
  'ext.open.title': { en: 'This page can be yours.', zh: '这个页面，由你决定。' },
  'ext.open.sub': { en: 'Same information. Your edition. Nothing filled in, nothing submitted, nothing ticked for you.', zh: '同一份信息，属于你的版本。不填写、不提交、不替你勾选。' },
  'ext.open.or': { en: 'Or choose an edition', zh: '或者选一种版本' },
  'ext.edition': { en: '{mode} edition', zh: '{mode}版' },
  'ext.settings.done': { en: 'Done', zh: '完成' },
  'ext.noTab': { en: 'Open a web page, then come back here.', zh: '先打开一个网页，再回到这里。' },
  'ext.unreachable': { en: 'Mine cannot work on this page (browser pages, the extension store and PDFs are off limits). Open an ordinary web page.', zh: '这个页面不能用（浏览器内部页、扩展商店和 PDF 不开放）。换一个普通网页试试。' },
  'ext.promise': { en: 'Every change is listed here and can be undone. The original is one press away.', zh: '每一处改动都列在这里，都能撤回。原版只隔一次按住。' },
  'ext.button.active': { en: 'Mine · {mode}', zh: '由我 · {mode}' },
  'ext.title': { en: 'This page, your edition', zh: '这个页面，你的版本' },
  'ext.close': { en: 'Close', zh: '关闭' },
  'ext.reading': { en: 'Reading the page…', zh: '正在读这个页面……' },
  'ext.rewriting': { en: 'Rewriting in plain words…', zh: '正在改写成平实语言……' },
  'ext.remembered': { en: 'Remembered for {host}. It will open this way next time.', zh: '已为 {host} 记住，下次打开就是这个版本。' },
  'ext.forgotten': { en: 'This site is back to how it was published.', zh: '这个网站已回到原来的样子。' },
  'ext.noModel': { en: 'Plain language needs a model server. Add one under Settings; everything else works offline.', zh: '平实语言需要模型服务，请在「设置」里填写；其余功能都离线可用。' },
  'ext.noBlocks': { en: 'Mine could not find enough on this page to reorganise.', zh: '这个页面上没有找到足够的内容可以重排。' },
  'ext.settings': { en: 'Settings', zh: '设置' },
  'ext.server': { en: 'Model server', zh: '模型服务地址' },
  'ext.server.hint': { en: 'Where My words and plain language are interpreted. Leave empty to stay offline.', zh: '「我的话」和平实语言在这里被理解。留空即完全离线。' },
  'ext.lang': { en: 'Language of this panel', zh: '面板语言' },
  'ext.lang.auto': { en: 'Follow the page', zh: '跟随页面' },
  'ext.goto': { en: 'Go to it on the page', zh: '查看原文位置' },
  'ext.blocks': { en: '{n} blocks read on this page', zh: '这个页面读到 {n} 个块' },
  'ext.plainUnavailable': { en: 'Plain language is unavailable right now; everything else applied.', zh: '平实语言暂时不可用，其余改动照常。' },
  'ext.thisFile': { en: 'this file', zh: '这个文件' },
  'ext.andMore': { en: ' and {n} more', zh: ' 等 {total} 项' },
  'ext.words.shortcut': { en: 'Press ⌘ or Ctrl + Enter to transform.', zh: '按 ⌘ 或 Ctrl + Enter 即可重排。' },
  'ext.urlChanged': { en: 'The page moved to a new address, so your edition was undone.', zh: '页面换了地址，你的版本已撤销。' },
} as const satisfies Record<string, Entry>;

export type CopyKey = keyof typeof copy;

export function t(lang: Lang, key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = copy[key][lang];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Picks `${key}.one` for n === 1 when it exists, otherwise the plural form with {n}. */
export function tn(lang: Lang, key: string, n: number, vars?: Record<string, string | number>): string {
  const one = `${key}.one` as CopyKey;
  const many = `${key}.many` as CopyKey;
  const base = key as CopyKey;
  if (n === 1 && one in copy) return t(lang, one, vars);
  if (many in copy) return t(lang, many, { n, ...vars });
  return t(lang, base, { n, ...vars });
}
