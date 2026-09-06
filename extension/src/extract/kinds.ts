// Kind and importance rules for the non-control blocks (EXTENSION.md §1, "Kinds"), plus the
// structural predicates the walker uses (nav-like, promo container, floating widget…).
//
// Decisions the contract left open:
// - Class/id matching works on tokens (split on non-alphanumerics and camelCase) so `ad` matches
//   "ad-slot" but not "header" or "loading"; long words also match as prefixes ("promotions").
// - Priority when several text rules match: deadline → legal → floating widget → faq →
//   instruction → live region / error → yearless deadline → notice → promo → text. A dated
//   deadline and a legal/privacy block are never downgraded to a decorative notice, whatever box
//   they sit in (review [15], [20]); a dated deadline wins over an FAQ-looking paragraph.
// - `legal` and `instruction` also look at container classes on ancestors (bounded to containers
//   holding ≤ 1500 characters), because sites mark the box, not the text. `notice` and `promo`
//   container classes only demote *small* containers — ≤ 25 % of main's text, or ≤ 400
//   characters and under half of main — never the body of the page (review [21]); a promo
//   container also needs no heading and no primary-looking action inside (review [45]).
// - A container whose class says promo/ad/sponsor/banner is one composite `promo` block (image,
//   text and button together) when it has no fields, no heading, no primary action and ≤ 800
//   characters. `rating`/`feedback` are text patterns only, not container classes.
// - `[role=alert]`, `[role=status]` and error/invalid/danger containers are notices of importance
//   at least `primary`, `critical` inside the form root: they are never folded (review [39]).
// - A "link bar" — any inline-only element whose text is ≥ 80 % link text with ≥ 3 links — and a
//   breadcrumb (class, aria-label or "您当前的位置…") count as nav, not only `ul`s. A link list,
//   link bar or breadcrumb that holds a form control is not a nav at all (review [2]).
// - A tab bar (role=tablist, data-toggle=tab, or same-document fragment links to tab panes / a
//   tabs class / inside the form root) is not navigation: one primary action per tab (review [47]).
// - A link list in main whose links are documents (附件, 模板, 申请表, .doc/.pdf/.xls, download,
//   form, template…), or that follows an "附件：" / "Attachments:" line, is a primary
//   `instruction` block, not a nav (review [64]).
// - Floating widgets: computed position fixed/sticky, or a chat / cookie / consent-banner /
//   back-to-top class. `widget`, `float`, `feedback` and `consent` alone never float anything
//   (Elementor, Bootstrap float-*, .invalid-feedback — review [1], [20], [38]). A widget that
//   holds a form control, a nav-like element, a primary action, the main root or the anchor
//   heading is not floating either (review [14], [22]). Text inside a floating widget becomes a
//   `notice` with importance `decorative`; a widget with ≥ 20 characters of non-button text is one
//   composite block, buttons included, so a cookie banner is one thing to set aside.
// - Actions also include an `img` with onclick or role=button and a `javascript:` link that
//   holds only an image (image buttons, captcha refreshers — review [17]); their label is alt,
//   title, aria-label, the src file name, else Submit/提交 inside the form root.
// - An attestation is a certify/declare/承诺/声明… label, or an agree/accept/acknowledge/consent/
//   同意/已阅读/知悉/接受 label that is about terms, a policy, 协议/政策/须知… or links to one
//   (review [18]); "agree to receive news" stays optional.
// - Complexity uses ≥ 2 distinct legal/jargon hits (not two occurrences of one word).
import type { Lang } from '@engine/schema.ts';
import type { ExtractContext, Region } from './context.ts';
import { findDeadline, findDeadlineHint } from './dates.ts';
import {
  attr,
  classString,
  classTokens,
  closestUpTo,
  containsControl,
  hasToken,
  hasWordChar,
  humanise,
  isBlockLevel,
  isHidden,
  positionOf,
  textLength,
  textOf,
} from './text.ts';

// --------------------------------------------------------------------------- patterns

export const PROMO_TEXT =
  /download the app|get the app|扫码|下载.*(app|应用)|广告|sponsored|推广|rate this page|was this page helpful|这个页面有帮助|本页面对您是否有帮助/i;
const PROMO_EXACT = ['ad', 'ads', 'advert', 'adverts', 'advertisement', 'advertising', 'promo', 'promos', 'promotion', 'promotions', 'banner', 'banners', 'sponsor', 'sponsored', 'sponsors'];
const PROMO_PREFIX = ['promo', 'advert', 'sponsor', 'banner'];

export const NOTICE_TEXT = /^(notice|attention|maintenance|注意|提示|公告|维护|温馨提示)/i;
const NOTICE_EXACT = ['alert', 'alerts', 'notice', 'notices', 'warning', 'warnings', 'warn', 'announcement', 'callout'];
const NOTICE_PREFIX = ['alert', 'notice', 'warning'];
/** Validation / error containers: never folded, help text when they sit by a control. */
const ERROR_EXACT = ['error', 'errors', 'invalid', 'danger', 'validation'];
const ERROR_STRING = /\b(?:in)?valid-feedback\b|\berror-?(?:message|msg|text|summary|list|tip)\b|\bform-item__error\b|\bform-item-explain-error\b/;

const LEGAL_TERMS: RegExp[] = [
  /\bshall\b/i, /\bhereby\b/i, /\bpursuant\b/i, /\bliabilit(?:y|ies)\b/i, /\bterms\b/i, /\bconditions\b/i,
  /\bprivacy\b/i, /\bpersonal (?:data|information)\b/i,
  /依据/, /条例/, /办法/, /条款/, /责任/, /隐私/, /个人信息/, /法律/, /规定/, /承诺/,
];
/** Register words that make a passage hard even when its sentences are short. */
const JARGON_TERMS: RegExp[] = [
  /\b(?:notwithstanding|thereof|therein|hereinafter|aforementioned|aforesaid|whereas|heretofore)\b/i,
  /\badjudicat(?:e|ed|ion)\b/i, /\bremittance\b/i, /\barrear(?:s|age)\b/i, /\bdisburse(?:d|ment)\b/i,
  /\bcontingent\b/i, /\bmeans-tested\b/i, /\battest(?:ation)?\b/i, /\baffidavit\b/i, /\bstatutory\b/i,
  /\bin accordance with\b/i, /\bdeemed\b/i, /\bwithout prejudice\b/i, /\bin lieu of\b/i, /\bsubsidy\b/i,
  /\btenancy\b/i, /\bappropriated\b/i, /\bdetermination\b/i, /\breconsideration\b/i, /\bprocure(?:d|ment)\b/i,
  /列支/, /拨付/, /复核/, /公示/, /受理/, /补正/, /认定/, /逾期/, /视为/, /不予/, /应当/, /予以/, /另行/, /兹/, /核定/, /申领/,
];
const LEGAL_EXACT = ['legal', 'terms', 'privacy', 'disclaimer', 'disclaimers', 'tos', 'eula'];
const LEGAL_PREFIX = ['legal', 'privacy', 'disclaimer'];
export const PRIVACY = /privacy|personal (?:data|information)|隐私|个人信息/i;

export const INSTRUCTION_TEXT = /^(how to|steps?\b|before you|instructions?\b|请准备|办理流程|申请步骤|操作步骤|须知|申领前请|申请前请|申报前请)/i;
const INSTRUCTION_EXACT = ['instruction', 'instructions', 'howto', 'guide', 'steps', 'procedure', 'checklist'];
const INSTRUCTION_PREFIX = ['instruction'];

export const FAQ_TEXT = /^(q[:：.]|问[:：]|faq)/i;
/** Labels that are attestations on their own. */
export const ATTESTATION = /certify|declare|attest|swear|承诺|保证|声明|属实/i;
/** Agreement verbs: an attestation only when the subject is terms, a policy or the like. */
const AGREEMENT = /\b(?:agree|agrees|accept|accepts|acknowledge|acknowledges|acknowledged|consent)\b|同意|已阅读|阅读并|知悉|接受/i;
const POLICY_SUBJECT =
  /\b(?:terms|conditions|polic(?:y|ies)|privacy|agreement|rules|regulations|disclaimer|guidelines|code of conduct|declaration|statement|notice)\b|协议|条款|政策|隐私|须知|承诺|声明|规则|规定|条例|办法|细则|指南|告知|免责|公约/i;
const TERMS_LINK = /terms|privacy|polic|agreement|legal|\btos\b|eula|rules|conditions|协议|条款|政策|隐私|须知|声明|规则|告知|xieyi|xuzhi|yinsi/i;
export const PRIMARY_ACTION = /submit|apply|send|continue|next|提交|申请|发送|确认|下一步/i;
const PRIMARY_EXACT = ['primary', 'submit'];

const FLOAT_EXACT = ['chat', 'chatbot', 'livechat', 'cookie', 'cookies', 'cookiebanner', 'cookieconsent', 'backtotop', 'totop', 'gotop', 'scrolltop'];
const FLOAT_PREFIX = ['chat', 'cookie'];
const FLOAT_STRING = /back-?to-?top|scroll-?(?:to-?)?top|go-?to-?top|consent-?banner|cookie-?(?:banner|consent|notice|bar|popup)/;

/** Link texts (or hrefs) that are documents to fetch, not places to go. */
const DOC_LINK = /附件|模板|范本|样表|样式|申请表|登记表|申报表|汇总表|报名表|承诺书|表格|\.(?:docx?|pdf|xlsx?|pptx?|zip|rar|7z|wps|et|dps|odt|ods)\b|\bdownloads?\b|下载|\bforms?\b|\btemplates?\b|\battachments?\b/i;
const ATTACHMENT_LEAD = /^(?:相关)?附件(?:下载|列表|清单)?[:：]?$|^(?:attachments?|downloads?|related documents?|documents?|forms?)[:：]?$/i;
const ACTION_QUERY = 'button,input,[role=button],a,img[onclick]';

const BUTTON_EXACT = ['btn', 'button', 'buttons'];
const BUTTON_PREFIX = ['btn'];

const IMAGE_DECOR_EXACT = ['ad', 'ads', 'bg', 'icon', 'icons', 'logo', 'logos', 'hero', 'banner', 'promo', 'decor', 'decoration', 'decorative', 'background'];
const IMAGE_DECOR_PREFIX = ['hero', 'banner', 'promo', 'background', 'decor'];

const BREADCRUMB_EXACT = ['breadcrumb', 'breadcrumbs', 'crumb', 'crumbs', 'location', 'locate'];
export const BREADCRUMB_TEXT = /^(您当前的位置|当前位置|您的位置|你的位置|所在位置|you are here)/i;

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role=heading]';
const BLOCK_CHILD_SELECTOR = 'address,article,aside,blockquote,details,dialog,div,dl,fieldset,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,menu,nav,ol,p,pre,section,table,ul';

/** Containers larger than this are never read as legal/notice/promo/instruction by class. */
const CONTAINER_TEXT_CAP = 1500;
/** A promo box bigger than this is not one composite block. */
export const PROMO_TEXT_CAP = 800;
const FLOAT_TEXT_CAP = 600;

// --------------------------------------------------------------------------- predicates

export function isHeading(el: Element): boolean {
  return /^h[1-6]$/.test(el.localName) || attr(el, 'role') === 'heading';
}

export function rawHeadingLevel(el: Element): number {
  const m = /^h([1-6])$/.exec(el.localName);
  if (m) return Number(m[1]);
  const aria = Number(attr(el, 'aria-level'));
  return aria >= 1 && aria <= 6 ? aria : 2;
}

export function isActionEl(el: Element): boolean {
  const tag = el.localName;
  if (tag === 'button') return true;
  if (tag === 'input') return ['submit', 'button', 'reset', 'image'].includes(attr(el, 'type').toLowerCase());
  if (attr(el, 'role') === 'button') return true;
  if (tag === 'img') return el.hasAttribute('onclick');
  if (tag !== 'a') return false;
  if (hasToken(el, BUTTON_EXACT, BUTTON_PREFIX)) return true;
  // a javascript: link that is only an image is an image button (old form pages)
  return /^\s*javascript:/i.test(attr(el, 'href')) && Boolean(el.querySelector('img')) && textOf(el, { max: 20 }) === '';
}

export function isPrimaryAction(el: Element, label: string): boolean {
  const tag = el.localName;
  const type = attr(el, 'type').toLowerCase();
  if (type === 'submit') return true;
  if (tag === 'button' && !el.hasAttribute('type') && el.closest('form')) return true;
  if (PRIMARY_ACTION.test(label)) return true;
  return hasToken(el, PRIMARY_EXACT, PRIMARY_EXACT);
}

export interface ActionLabelOptions {
  /** Subtrees to leave out of the visible text (help texts inside a button). */
  exclude?: (el: Element) => boolean;
  /** For the Submit/提交 fallback of an image button inside the form root. */
  ctx?: ExtractContext;
}

function fileNameLabel(src: string): string {
  const name = src.split(/[?#]/)[0]!.split('/').pop() ?? '';
  return humanise(name.replace(/\.[a-z0-9]{1,5}$/i, ''));
}

function imageLabel(img: Element): string {
  return attr(img, 'alt').trim() || attr(img, 'title').trim() || attr(img, 'aria-label').trim() || fileNameLabel(imageSrc(img));
}

/** The visible label of an action element: text, else aria-label/title, else the image's alt/title/file name, else value. */
export function actionLabel(el: Element, opts: ActionLabelOptions = {}): string {
  const tag = el.localName;
  const inForm = Boolean(opts.ctx?.form && opts.ctx.form.contains(el));
  const submitWord = opts.ctx?.lang === 'zh' ? '提交' : 'Submit';
  if (tag === 'input') {
    const type = attr(el, 'type').toLowerCase();
    const value = attr(el, 'value').trim();
    if (value) return value.slice(0, 200);
    if (type === 'image') return attr(el, 'alt').trim() || attr(el, 'title').trim() || attr(el, 'aria-label').trim() || submitWord;
    return attr(el, 'aria-label').trim() || attr(el, 'title').trim() || (type === 'reset' ? 'Reset' : type === 'submit' ? submitWord : '');
  }
  if (tag === 'img') return (imageLabel(el) || (inForm ? submitWord : '')).slice(0, 200);
  const text = textOf(el, { exclude: opts.exclude, max: 200 });
  if (text && hasWordChar(text)) return text;
  const named = attr(el, 'aria-label').trim() || attr(el, 'title').trim();
  if (named) return named.slice(0, 200);
  const img = el.querySelector('img');
  const fromImage = img ? imageLabel(img) : '';
  return (fromImage || text || attr(el, 'value').trim() || (img && inForm ? submitWord : '')).slice(0, 200);
}

/** Some descendant is an action whose label or type is primary (a submit button). */
export function hasPrimaryActionInside(el: Element, ctx?: ExtractContext): boolean {
  try {
    for (const a of Array.from(el.querySelectorAll(ACTION_QUERY))) {
      if (isHidden(a) || !isActionEl(a)) continue;
      if (isPrimaryAction(a, actionLabel(a, { ctx }))) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * A decision label reads like an attestation: a certify/declare/承诺 phrase, or an agree/accept/
 * acknowledge/同意/已阅读/知悉 phrase whose subject is terms, a policy, 协议/须知… — in the label,
 * its consequence, or a link inside the label. "Send me news" and "agree to receive emails" stay optional.
 */
export function isAttestation(label: string, help: string | undefined, labelEls: Element[]): boolean {
  if (ATTESTATION.test(label)) return true;
  const text = `${label} ${help ?? ''}`;
  if (!AGREEMENT.test(text)) return false;
  if (POLICY_SUBJECT.test(text)) return true;
  for (const scope of labelEls) {
    const links = scope.localName === 'a' ? [scope] : Array.from(scope.querySelectorAll('a'));
    for (const a of links) if (TERMS_LINK.test(attr(a, 'href')) || TERMS_LINK.test(textOf(a, { max: 100 }))) return true;
  }
  return false;
}

export function isPromoContainer(el: Element): boolean {
  return hasToken(el, PROMO_EXACT, PROMO_PREFIX);
}

function isLegalContainer(el: Element): boolean {
  return hasToken(el, LEGAL_EXACT, LEGAL_PREFIX);
}

function isNoticeContainer(el: Element): boolean {
  const role = attr(el, 'role');
  return role === 'alert' || role === 'status' || hasToken(el, NOTICE_EXACT, NOTICE_PREFIX);
}

function isInstructionContainer(el: Element): boolean {
  return hasToken(el, INSTRUCTION_EXACT, INSTRUCTION_PREFIX);
}

/** Nearest ancestor-or-self (bounded) whose class says `pred`, ignoring big containers (and those failing `extra`). */
function containerHit(el: Element, ctx: ExtractContext, pred: (e: Element) => boolean, extra?: (e: Element) => boolean): boolean {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.main && !ctx.roots.has(node)) {
    if (pred(node) && textLength(node) <= CONTAINER_TEXT_CAP && (!extra || extra(node))) return true;
    node = node.parentElement;
  }
  return false;
}

/** ≤ 25 % of main's text, or ≤ 400 characters and under half of main: a box beside the content, not the content. */
function smallContainer(node: Element, ctx: ExtractContext): boolean {
  const len = textLength(node);
  const mainLen = Math.max(1, textLength(ctx.main));
  return len <= mainLen * 0.25 || (len <= 400 && len < mainLen * 0.5);
}

function isLiveOrErrorContainer(el: Element): boolean {
  const role = attr(el, 'role');
  return role === 'alert' || role === 'status' || hasToken(el, ERROR_EXACT) || ERROR_STRING.test(classString(el));
}

/** The element or an ancestor (up to main/roots) is a live region or an error container. */
export function liveOrErrorContainerOf(el: Element, ctx: ExtractContext): Element | null {
  return closestUpTo(
    el,
    (e) => isLiveOrErrorContainer(e) && textLength(e) <= CONTAINER_TEXT_CAP,
    (e) => e === ctx.body || e === ctx.main || ctx.roots.has(e),
  );
}

/** The element or an ancestor carries a decorative-image class (hero, banner, logo, icon…). */
export function hasDecorativeImageClass(el: Element, ctx: ExtractContext): boolean {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.main && !ctx.roots.has(node)) {
    if (hasToken(node, IMAGE_DECOR_EXACT, IMAGE_DECOR_PREFIX)) return true;
    node = node.parentElement;
  }
  return false;
}

/** A ul/ol/menu link list, a link bar or a breadcrumb inside (or being) `el`. */
function hasNavLikeInside(el: Element): boolean {
  for (const list of Array.from(el.querySelectorAll('ul,ol,menu'))) if (!isHidden(list) && isLinkList(list)) return true;
  return isLinkBar(el) || isBreadcrumb(el);
}

/**
 * A widget that floats over the page: fixed/sticky position or a chat/cookie/back-to-top class —
 * never one that holds a control, a menu, a primary action, the main root or the title.
 */
export function isFloatingWidget(el: Element, ctx: ExtractContext): boolean {
  const tag = el.localName;
  if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'body' || tag === 'html') return false;
  if (ctx.roots.has(el) || el === ctx.main) return false;
  const pos = positionOf(el);
  const positioned = pos === 'fixed' || pos === 'sticky';
  const classed = hasToken(el, FLOAT_EXACT, FLOAT_PREFIX) || FLOAT_STRING.test(classString(el));
  if (!positioned && !classed) return false;
  if (el.contains(ctx.main) || (ctx.anchor && el.contains(ctx.anchor))) return false;
  if (containsControl(el)) return false;
  if (textLength(el) > FLOAT_TEXT_CAP) return false;
  if (el.querySelector('nav,[role=navigation],h1,h2')) return false;
  if (hasNavLikeInside(el)) return false;
  if (hasPrimaryActionInside(el, ctx)) return false;
  return true;
}

/** The floating widget `el` sits in (itself included), or null. */
export function floatingContainerOf(el: Element, ctx: ExtractContext): Element | null {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.main && !ctx.roots.has(node)) {
    if (isFloatingWidget(node, ctx)) return node;
    node = node.parentElement;
  }
  return null;
}

function linkTexts(el: Element): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(el.querySelectorAll('a'))) {
    if (isHidden(a)) continue;
    let text = textOf(a);
    if (!text) text = attr(a, 'aria-label').trim() || attr(a, 'title').trim() || attr(a.querySelector('img') ?? a, 'alt').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

/** Link texts of a nav-like element, trimmed and de-duplicated. */
export function navItems(el: Element): string[] {
  return linkTexts(el);
}

function linkShare(el: Element): number {
  const total = textLength(el);
  if (total === 0) return 0;
  let linked = 0;
  for (const a of Array.from(el.querySelectorAll('a'))) {
    if (a.parentElement?.closest('a')) continue;
    if (!isHidden(a)) linked += textLength(a);
  }
  return linked / total;
}

function visibleListItems(list: Element): Element[] {
  return Array.from(list.children).filter((c) => c.localName === 'li' && !isHidden(c));
}

/** An item "is a link" when it holds a link and the link text is most (≥ 60 %) of its text. */
function isLinkItem(li: Element): boolean {
  const total = textLength(li);
  if (total === 0) return false;
  let linked = 0;
  for (const a of Array.from(li.querySelectorAll('a'))) if (!isHidden(a) && !a.parentElement?.closest('a')) linked += textLength(a);
  return linked > 0 && linked / total >= 0.6;
}

/** A ul/ol/menu whose items are ≥ 80 % links (≥ 3 items) and which holds no form control. */
export function isLinkList(list: Element): boolean {
  const items = visibleListItems(list);
  if (items.length < 3) return false;
  if (items.filter(isLinkItem).length / items.length < 0.8) return false;
  return !containsControl(list);
}

function visibleLinks(el: Element): Element[] {
  return Array.from(el.querySelectorAll('a')).filter((a) => !isHidden(a) && !a.parentElement?.closest('a'));
}

/**
 * A tab bar: role=tablist/tab or data-toggle=tab inside, or same-document fragment links (#pane)
 * that point at tab panes, carry a tabs class, or sit inside the form root. Not navigation.
 */
export function isTabBar(el: Element, ctx: ExtractContext): boolean {
  if (attr(el, 'role') === 'tablist') return true;
  if (el.querySelector('[role=tablist],[role=tab],[data-toggle=tab],[data-bs-toggle=tab],[data-toggle=pill],[data-bs-toggle=pill]')) return true;
  const links = visibleLinks(el);
  if (links.length < 2 || links.length > 12) return false;
  const fragments = links.map((a) => attr(a, 'href').trim());
  if (!fragments.every((h) => /^#.+/.test(h))) return false;
  if (hasToken(el, ['tab', 'tabs', 'tablist'])) return true;
  if (ctx.form && ctx.form.contains(el)) return true;
  for (const h of fragments) {
    let target: Element | null = null;
    try {
      target = ctx.doc.getElementById(decodeURIComponent(h.slice(1)));
    } catch {
      target = null;
    }
    if (target && (attr(target, 'role') === 'tabpanel' || hasToken(target, ['tab', 'tabs', 'tabpanel', 'tabpane', 'pane']))) return true;
  }
  return false;
}

/**
 * A link list whose links are documents to download (附件, 模板, .pdf…), or that follows an
 * "附件：" / "Attachments:" line: part of the task, emitted as an instruction, not a nav.
 */
export function isAttachmentList(list: Element): boolean {
  const links = visibleLinks(list).filter((a) => textLength(a) > 0);
  if (links.length === 0) return false;
  const docs = links.filter((a) => DOC_LINK.test(textOf(a, { max: 200 })) || DOC_LINK.test(attr(a, 'href'))).length;
  if (docs / links.length >= 0.8) return true;
  let prev = list.previousElementSibling;
  while (prev && isHidden(prev)) prev = prev.previousElementSibling;
  return Boolean(prev && !containsControl(prev) && ATTACHMENT_LEAD.test(textOf(prev, { max: 60 })));
}

function hasBlockElementChild(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    if (isHidden(child)) continue;
    if (child.matches(BLOCK_CHILD_SELECTOR)) return true;
  }
  return false;
}

/** An inline-only element whose text is mostly links (≥ 3 of them): a div-based menu. */
export function isLinkBar(el: Element): boolean {
  const tag = el.localName;
  if (!['div', 'span', 'p', 'section', 'header', 'footer', 'center', 'td', 'li'].includes(tag)) return false;
  if (hasBlockElementChild(el) || containsControl(el)) return false;
  const links = Array.from(el.querySelectorAll('a')).filter((a) => !isHidden(a) && textLength(a) > 0);
  if (links.length < 3) return false;
  return textLength(el) <= 300 && linkShare(el) >= 0.8;
}

export function isBreadcrumb(el: Element): boolean {
  if (!el.querySelector('a') || containsControl(el)) return false;
  if (hasToken(el, BREADCRUMB_EXACT)) return true;
  if (/breadcrumb|面包屑|当前位置/i.test(attr(el, 'aria-label'))) return true;
  if (['div', 'p', 'span', 'nav', 'ol', 'ul', 'section'].includes(el.localName) && textLength(el) <= 200) {
    return BREADCRUMB_TEXT.test(textOf(el, { max: 40 }));
  }
  return false;
}

/** nav, [role=navigation], a link list, a link bar, or a breadcrumb. */
export function isNavLike(el: Element): boolean {
  const tag = el.localName;
  if (tag === 'nav' || attr(el, 'role') === 'navigation') return true;
  if ((tag === 'ul' || tag === 'ol' || tag === 'menu') && isLinkList(el)) return true;
  return isBreadcrumb(el) || isLinkBar(el);
}

const LEAF_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'blockquote', 'pre', 'figcaption', 'caption', 'address', 'summary', 'legend']);
const GENERIC_LEAF_TAGS = new Set([
  'div', 'span', 'section', 'article', 'main', 'center', 'font', 'a', 'b', 'strong', 'em', 'i', 'small', 'q', 'cite',
  'mark', 'u', 's', 'sub', 'sup', 'time', 'code', 'kbd', 'samp', 'var', 'output', 'data', 'ins', 'del', 'bdi', 'bdo',
  'header', 'footer', 'aside', 'hgroup', 'abbr', 'dfn', 'label',
]);

/** Would `img` be an image block? (≥ 48 px in either dimension, or unknown size, with a src.) */
export function isBlockImage(img: Element): boolean {
  if (!imageSrc(img)) return false;
  const dims = [imageDim(img, 'width'), imageDim(img, 'height')].filter((n) => n > 0);
  if (dims.length === 0) return true;
  return dims.some((n) => n >= 48);
}

function imageDim(img: Element, name: 'width' | 'height'): number {
  const fromAttr = Number.parseFloat(attr(img, name));
  if (fromAttr > 0) return fromAttr;
  const style = (img as HTMLElement).style;
  const fromStyle = style ? Number.parseFloat(style[name] ?? '') : NaN;
  if (fromStyle > 0) return fromStyle;
  const prop = (img as HTMLImageElement)[name];
  return typeof prop === 'number' && prop > 0 ? prop : 0;
}

export function imageSrc(img: Element): string {
  const current = (img as HTMLImageElement).currentSrc;
  if (typeof current === 'string' && current) return current;
  return attr(img, 'src') || attr(img, 'data-src') || attr(img, 'data-lazy-src') || attr(img, 'data-original');
}

/** Cheap tag test: could `el` be a text leaf at all? (Saves reading the text of every container.) */
export function isLeafCandidate(el: Element): boolean {
  return LEAF_TAGS.has(el.localName) || GENERIC_LEAF_TAGS.has(el.localName);
}

/** True when `el` should become one text block (p, li, td… or an inline-only div/span). */
export function isTextLeaf(el: Element, text: string): boolean {
  const tag = el.localName;
  if (!LEAF_TAGS.has(tag) && !GENERIC_LEAF_TAGS.has(tag)) return false;
  if (hasBlockElementChild(el) || containsControl(el)) return false;
  for (const child of Array.from(el.children)) {
    if (!isHidden(child) && child.localName !== 'br' && !LEAF_TAGS.has(child.localName) && isBlockLevelByStyle(child)) return false;
  }
  if (el.querySelector('button,[role=button],details,figure,nav,table,ul,ol,' + HEADING_SELECTOR)) return false;
  for (const a of Array.from(el.querySelectorAll('a'))) if (isActionEl(a)) return false;
  for (const img of Array.from(el.querySelectorAll('img'))) if (!isHidden(img) && isBlockImage(img)) return false;
  return LEAF_TAGS.has(tag) ? text.length >= 3 : text.length >= 20;
}

/** Inline style says block (computed style is deliberately not consulted for leaf-ness). */
function isBlockLevelByStyle(el: Element): boolean {
  const style = (el as HTMLElement).style;
  const display = style ? (style.display ?? '').toLowerCase() : '';
  return display !== '' && display !== 'inline' && display !== 'none' && isBlockLevel(el);
}

// --------------------------------------------------------------------------- classification

export interface TextClass {
  kind: 'text' | 'legal' | 'notice' | 'instruction' | 'faq' | 'promo' | 'deadline';
  importance: 'critical' | 'primary' | 'secondary' | 'decorative';
  date?: string;
  legalHits: number;
}

export function legalHits(text: string): number {
  let n = 0;
  for (const re of LEGAL_TERMS) if (re.test(text)) n++;
  return n;
}

export function jargonHits(text: string): number {
  let n = 0;
  for (const re of JARGON_TERMS) if (re.test(text)) n++;
  return n;
}

/** Legal by hits needs prose: at least 60 characters and not mostly links (a footer link row). */
function isLegalProse(el: Element, text: string): boolean {
  return text.length >= 60 && linkShare(el) < 0.5;
}

/** A promo container by class: small, without a heading and without a primary-looking action. */
function isPromoBox(node: Element, ctx: ExtractContext): boolean {
  return smallContainer(node, ctx) && !node.querySelector(HEADING_SELECTOR) && !hasPrimaryActionInside(node, ctx);
}

/** A dated sentence is a live deadline only within a window: 30 days past to 3 years ahead of `now`.
 *  (A 2019 date in an encyclopaedia article is history, not something to echo at the top.) */
export function isLiveDeadline(iso: string, now: number): boolean {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const day = 86_400_000;
  return t >= now - 30 * day && t <= now + 3 * 365 * day;
}

/** Kind + importance of a text leaf. `region` decides plain text's importance. */
export function classifyText(el: Element, text: string, region: Region, ctx: ExtractContext): TextClass {
  const hits = legalHits(text);
  const plain: TextClass = { kind: 'text', importance: region === 'main' ? 'primary' : 'secondary', legalHits: hits };
  // a dated deadline and legal/privacy prose are critical wherever they sit — before the floating test
  const date = findDeadline(text, ctx.lang);
  if (date && isLiveDeadline(date, ctx.now)) return { kind: 'deadline', importance: 'critical', date, legalHits: hits };
  if ((hits >= 2 && isLegalProse(el, text)) || containerHit(el, ctx, isLegalContainer)) {
    return { kind: 'legal', importance: PRIVACY.test(text) ? 'critical' : 'primary', legalHits: hits };
  }
  if (floatingContainerOf(el, ctx)) return { kind: 'notice', importance: 'decorative', legalHits: hits };
  if (FAQ_TEXT.test(text)) return { kind: 'faq', importance: 'secondary', legalHits: hits };
  if (INSTRUCTION_TEXT.test(text) || containerHit(el, ctx, isInstructionContainer)) {
    return { kind: 'instruction', importance: 'primary', legalHits: hits };
  }
  if (liveOrErrorContainerOf(el, ctx)) {
    return { kind: 'notice', importance: ctx.form && ctx.form.contains(el) ? 'critical' : 'primary', legalHits: hits };
  }
  // "6月30日前" with no year: not a deadline block, but never demoted by a notice/promo class
  if (findDeadlineHint(text, ctx.lang)) return plain;
  if (NOTICE_TEXT.test(text) || containerHit(el, ctx, isNoticeContainer, (n) => smallContainer(n, ctx))) {
    return { kind: 'notice', importance: 'secondary', legalHits: hits };
  }
  if (PROMO_TEXT.test(text) || containerHit(el, ctx, isPromoContainer, (n) => isPromoBox(n, ctx))) {
    return { kind: 'promo', importance: 'decorative', legalHits: hits };
  }
  return plain;
}

/** simple / medium / complex from sentence length (EN words, ZH characters) and legal + jargon hits. */
export function complexityOf(text: string, lang: Lang, hits: number): 'simple' | 'medium' | 'complex' {
  if (hits + jargonHits(text) >= 2) return 'complex';
  const parts = text.split(/[.!?。！？;；]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const count = Math.max(1, parts.length);
  const cjk = lang === 'zh' || /[一-鿿]/.test(text);
  if (cjk) {
    const chars = text.replace(/[\s.!?。！？;；,，、：:（）()]/g, '').length / count;
    return chars > 45 ? 'complex' : chars > 28 ? 'medium' : 'simple';
  }
  const words = text.split(/\s+/).filter(Boolean).length / count;
  return words > 25 ? 'complex' : words > 15 ? 'medium' : 'simple';
}

/** Importance of a heading: primary in main, secondary in header/sidebar/footer/utility. */
export function headingImportance(region: Region): 'primary' | 'secondary' {
  return region === 'main' ? 'primary' : 'secondary';
}

export function classTokensOf(el: Element): string[] {
  return classTokens(el);
}
