// Kind and importance rules for the non-control blocks (EXTENSION.md §1, "Kinds"), plus the
// structural predicates the walker uses (nav-like, promo container, floating widget…).
//
// Decisions the contract left open:
// - Class/id matching works on tokens (split on non-alphanumerics and camelCase) so `ad` matches
//   "ad-slot" but not "header" or "loading"; long words also match as prefixes ("promotions").
// - Priority when several text rules match: floating widget → deadline → faq → legal →
//   instruction → notice → promo → text. A legal/privacy block is never downgraded to a notice,
//   and a dated deadline wins over an FAQ-looking paragraph.
// - `legal`, `instruction`, `notice` and `promo` also look at container classes on ancestors
//   (bounded to containers holding ≤ 1500 characters), because sites mark the box, not the text.
// - A container whose class says promo/ad/sponsor/rating/feedback is one composite `promo` block
//   (image, text and button together) when it has no fields, no h1/h2 and ≤ 800 characters.
// - A "link bar" — any inline-only element whose text is ≥ 80 % link text with ≥ 3 links — and a
//   breadcrumb (class, aria-label or "您当前的位置…") count as nav, not only `ul`s.
// - Text inside a floating widget (fixed/sticky, or chat/widget/cookie… classes) becomes a
//   `notice` with importance `decorative`; a widget with ≥ 20 characters of non-button text is
//   one composite block, buttons included, so a cookie banner is one thing to set aside.
// - Complexity uses ≥ 2 distinct legal/jargon hits (not two occurrences of one word).
import type { Lang } from '@engine/schema.ts';
import type { ExtractContext, Region } from './context.ts';
import { findDeadline } from './dates.ts';
import {
  attr,
  classString,
  classTokens,
  containsControl,
  hasToken,
  isBlockLevel,
  isHidden,
  positionOf,
  textLength,
  textOf,
} from './text.ts';

// --------------------------------------------------------------------------- patterns

export const PROMO_TEXT =
  /download the app|get the app|扫码|下载.*(app|应用)|广告|sponsored|推广|rate this page|was this page helpful|这个页面有帮助|本页面对您是否有帮助/i;
const PROMO_EXACT = ['ad', 'ads', 'advert', 'adverts', 'advertisement', 'advertising', 'promo', 'promos', 'promotion', 'promotions', 'banner', 'banners', 'sponsor', 'sponsored', 'sponsors', 'rating', 'ratings', 'feedback'];
const PROMO_PREFIX = ['promo', 'advert', 'sponsor', 'banner', 'rating'];

export const NOTICE_TEXT = /^(notice|attention|maintenance|注意|提示|公告|维护|温馨提示)/i;
const NOTICE_EXACT = ['alert', 'alerts', 'notice', 'notices', 'warning', 'warnings', 'warn', 'announcement', 'callout'];
const NOTICE_PREFIX = ['alert', 'notice', 'warning'];

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
export const ATTESTATION = /certify|declare|attest|swear|承诺|保证|声明|属实/i;
export const PRIMARY_ACTION = /submit|apply|send|continue|next|提交|申请|发送|确认|下一步/i;
const PRIMARY_EXACT = ['primary', 'submit'];

const FLOAT_EXACT = ['chat', 'chatbot', 'livechat', 'widget', 'widgets', 'float', 'floating', 'feedback', 'cookie', 'cookies', 'consent', 'backtotop', 'totop', 'gotop', 'scrolltop'];
const FLOAT_PREFIX = ['chat', 'widget', 'float', 'cookie', 'feedback'];
const FLOAT_STRING = /back-?to-?top|scroll-?(?:to-?)?top|go-?to-?top/;

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
  return tag === 'a' && hasToken(el, BUTTON_EXACT, BUTTON_PREFIX);
}

export function isPrimaryAction(el: Element, label: string): boolean {
  const tag = el.localName;
  const type = attr(el, 'type').toLowerCase();
  if (type === 'submit') return true;
  if (tag === 'button' && !el.hasAttribute('type') && el.closest('form')) return true;
  if (PRIMARY_ACTION.test(label)) return true;
  return hasToken(el, PRIMARY_EXACT, PRIMARY_EXACT);
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

/** Nearest ancestor-or-self (bounded) whose class says `pred`, ignoring big containers. */
function containerHit(el: Element, ctx: ExtractContext, pred: (e: Element) => boolean): boolean {
  let node: Element | null = el;
  while (node && node !== ctx.body && node !== ctx.main && !ctx.roots.has(node)) {
    if (pred(node) && textLength(node) <= CONTAINER_TEXT_CAP) return true;
    node = node.parentElement;
  }
  return false;
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

/** A widget that floats over the page: fixed/sticky position or a chat/widget/cookie… class. */
export function isFloatingWidget(el: Element, ctx: ExtractContext): boolean {
  const tag = el.localName;
  if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'body' || tag === 'html') return false;
  if (ctx.roots.has(el) || el === ctx.main) return false;
  const pos = positionOf(el);
  const positioned = pos === 'fixed' || pos === 'sticky';
  const classed = hasToken(el, FLOAT_EXACT, FLOAT_PREFIX) || FLOAT_STRING.test(classString(el));
  if (!positioned && !classed) return false;
  if (containsControl(el)) return false;
  if (textLength(el) > FLOAT_TEXT_CAP) return false;
  if (el.querySelector('nav,h1,h2')) return false;
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

/** A ul/ol/menu whose items are ≥ 80 % links (≥ 3 items). */
export function isLinkList(list: Element): boolean {
  const items = visibleListItems(list);
  if (items.length < 3) return false;
  return items.filter(isLinkItem).length / items.length >= 0.8;
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
  if (!el.querySelector('a')) return false;
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

/** Kind + importance of a text leaf. `region` decides plain text's importance. */
export function classifyText(el: Element, text: string, region: Region, ctx: ExtractContext): TextClass {
  const hits = legalHits(text);
  if (floatingContainerOf(el, ctx)) return { kind: 'notice', importance: 'decorative', legalHits: hits };
  const date = findDeadline(text, ctx.lang);
  if (date) return { kind: 'deadline', importance: 'critical', date, legalHits: hits };
  if (FAQ_TEXT.test(text)) return { kind: 'faq', importance: 'secondary', legalHits: hits };
  if ((hits >= 2 && isLegalProse(el, text)) || containerHit(el, ctx, isLegalContainer)) {
    return { kind: 'legal', importance: PRIVACY.test(text) ? 'critical' : 'primary', legalHits: hits };
  }
  if (INSTRUCTION_TEXT.test(text) || containerHit(el, ctx, isInstructionContainer)) {
    return { kind: 'instruction', importance: 'primary', legalHits: hits };
  }
  if (NOTICE_TEXT.test(text) || containerHit(el, ctx, isNoticeContainer)) {
    return { kind: 'notice', importance: 'secondary', legalHits: hits };
  }
  if (PROMO_TEXT.test(text) || containerHit(el, ctx, isPromoContainer)) {
    return { kind: 'promo', importance: 'decorative', legalHits: hits };
  }
  return { kind: 'text', importance: region === 'main' ? 'primary' : 'secondary', legalHits: hits };
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
