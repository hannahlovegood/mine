// Regions: header / utility / sidebar / footer / main (EXTENSION.md §1, "Regions").
//
// Decisions the contract left open:
// - Header and footer roots are also recognised by class/id tokens (header, masthead, topbar,
//   navbar; footer, contentinfo, copyright, colophon) because the demo portal — like many real
//   sites — has no <header>/<footer> elements. Class-based roots must hold ≤ 50 % of the page's
//   text. A <header> inside main/article is the article's header, not a region root, and a
//   page-header / entry-header / card-header / modal-header… class names content (review [45]).
// - Sidebar roots by class (side, aside, sidebar, rail, related…) are only recognised outside the
//   semantic main; `widget`/`widgets` count only when a semantic main exists to be outside of —
//   on an Elementor page every element is a widget (review [1]). Semantic <aside> counts anywhere.
// - The main root is `main`/`[role=main]`, else the single `article`, else the largest text
//   container: descend from body into the child holding ≥ 60 % of the text, through generic
//   containers only, never into a region root, never past the first h1 (else h2), and never into
//   a child that leaves behind a form control that follows the title (review [46]). When such
//   controls still fall outside the chosen root (an article followed by the form), the root is
//   widened to their common ancestor.
// - Blocks outside every root fall back to their position: before the main root → header,
//   after it → footer. Pages made of plain divs thus still get a top and a bottom.
// - The site menu is the biggest nav-like element inside the header root, else the first
//   nav-like with ≥ 5 links that comes before the anchor heading. It is decided here so the
//   utility bars can be found relative to it.
// - Utility roots: other nav-likes inside the header root (≤ 6 items), link bars of ≤ 6 short
//   items that precede the header root (or the site menu, or main when there is no header), and
//   elements whose class says utility/toolbar/skiplinks. Their wrapper-only ancestors are
//   folded so `.portal-utility > div > ul` yields `.portal-utility` as the root.
// - `regions` exposes one element per name: the first root in document order.
import { foldWrappers, lca } from './boxes.ts';
import type { ExtractContext, Region } from './context.ts';
import { isNavLike, navItems } from './kinds.ts';
import { attr, classString, hasToken, isCandidateControl, isHidden, precedes, textLength } from './text.ts';

const HEADER_EXACT = ['header', 'masthead', 'topbar', 'navbar', 'siteheader'];
/** A "header" class that names a piece of content, not the site header. */
const CONTENT_HEADER = /(?:^|[\s_-])(?:page|card|modal|entry|post|article|section|content|panel|box|form|table|list|widget|item|block|accordion|dialog|hero|title)[-_]?(?:header|head|heading)(?:$|[\s_-])/;
const FOOTER_EXACT = ['footer', 'contentinfo', 'copyright', 'colophon', 'sitefooter', 'pagefooter'];
const SIDEBAR_EXACT = ['side', 'aside', 'sidebar', 'sidenav', 'rail', 'related'];
const SIDEBAR_PREFIX = ['sidebar', 'sidenav', 'related', 'aside'];
const WIDGET_EXACT = ['widget', 'widgets'];
const WIDGET_PREFIX = ['widget'];
const UTILITY_EXACT = ['utility', 'utilities', 'utilitynav', 'toolbar', 'skip', 'skiplink', 'skiplinks'];
const GENERIC_CONTAINERS = new Set(['body', 'div', 'section', 'article', 'main', 'center', 'table', 'tbody', 'tr', 'td', 'form', 'span']);

export interface RegionInfo {
  roots: Map<Element, Region>;
  main: Element;
  siteMenu: Element | null;
  anchor: Element | null;
  byName: Map<string, Element>;
}

/** Any ancestor-or-self is hidden (cached per element). */
export function hiddenDeep(el: Element, cache: WeakMap<Element, boolean>, body: Element): boolean {
  const cached = cache.get(el);
  if (cached !== undefined) return cached;
  let result = false;
  if (isHidden(el)) result = true;
  else if (el !== body && el.parentElement && el.parentElement !== el.ownerDocument.documentElement) {
    result = hiddenDeep(el.parentElement, cache, body);
  }
  cache.set(el, result);
  return result;
}

function insideAny(el: Element, roots: Iterable<Element>): boolean {
  for (const r of roots) if (r !== el && r.contains(el)) return true;
  return false;
}

export function findRegions(doc: Document, body: Element): RegionInfo {
  const roots = new Map<Element, Region>();
  const hiddenCache = new WeakMap<Element, boolean>();
  const visible = (el: Element): boolean => !hiddenDeep(el, hiddenCache, body);
  const bodyText = Math.max(1, textLength(body));
  const smallEnough = (el: Element): boolean => textLength(el) <= bodyText * 0.5;

  const all = Array.from(body.getElementsByTagName('*')).filter((el) => el.namespaceURI === null || /xhtml/.test(el.namespaceURI ?? ''));
  const semanticMain = firstVisible(doc.querySelectorAll('main,[role=main]'), visible) ?? singleArticle(doc, visible);
  const insideMain = (el: Element): boolean => Boolean(semanticMain && semanticMain !== el && semanticMain.contains(el));
  const containsMain = (el: Element): boolean => Boolean(semanticMain && el !== semanticMain && el.contains(semanticMain));

  // header
  let headerRoot: Element | null = null;
  for (const el of all) {
    if (!visible(el) || insideMain(el) || containsMain(el)) continue;
    const semantic = el.localName === 'header' || attr(el, 'role') === 'banner';
    if (semantic && !el.closest('article,main,[role=main]')) {
      headerRoot = el;
      break;
    }
    if (!semantic && hasToken(el, HEADER_EXACT) && !CONTENT_HEADER.test(classString(el)) && smallEnough(el) && el.localName !== 'a' && el.localName !== 'img') {
      headerRoot = el;
      break;
    }
  }
  if (headerRoot) roots.set(headerRoot, 'header');

  // footer (the last candidate)
  let footerRoot: Element | null = null;
  for (const el of all) {
    if (!visible(el) || insideMain(el) || containsMain(el)) continue;
    if (headerRoot && (headerRoot === el || headerRoot.contains(el))) continue;
    if (footerRoot && footerRoot.contains(el)) continue; // a .footer-widgets inside <footer> never replaces it
    const semantic = el.localName === 'footer' || attr(el, 'role') === 'contentinfo';
    if (semantic && !el.closest('article,main,[role=main]')) footerRoot = el;
    else if (!semantic && hasToken(el, FOOTER_EXACT) && smallEnough(el) && el.localName !== 'a') footerRoot = el;
  }
  if (footerRoot) roots.set(footerRoot, 'footer');

  // sidebars
  const sidebars: Element[] = [];
  for (const el of all) {
    if (!visible(el) || containsMain(el)) continue;
    if (insideAny(el, [headerRoot, footerRoot].filter((r): r is Element => Boolean(r)))) continue;
    if (insideAny(el, sidebars)) continue;
    const semantic = el.localName === 'aside' || attr(el, 'role') === 'complementary';
    const classed =
      !insideMain(el) &&
      (hasToken(el, SIDEBAR_EXACT, SIDEBAR_PREFIX) || (semanticMain !== null && hasToken(el, WIDGET_EXACT, WIDGET_PREFIX))) &&
      smallEnough(el) &&
      !['a', 'img', 'li', 'button'].includes(el.localName);
    if (semantic || classed) {
      if (el === headerRoot || el === footerRoot) continue;
      sidebars.push(el);
      roots.set(el, 'sidebar');
    }
  }

  // anchor heading and main root
  const anchor =
    firstVisible(body.querySelectorAll('h1'), (h) => visible(h) && !insideAny(h, roots.keys())) ??
    firstVisible(body.querySelectorAll('h2'), (h) => visible(h) && !insideAny(h, roots.keys()));
  // controls that belong to the page's task: after the title, outside header/footer/sidebar roots
  const taskControls = all.filter((el) => isCandidateControl(el) && visible(el) && !insideAny(el, roots.keys()) && (!anchor || precedes(anchor, el)));
  let main = semanticMain ?? largestTextContainer(body, roots, anchor, visible, taskControls);
  const outside = taskControls.filter((c) => !main.contains(c));
  if (outside.length > 0) {
    const wide = lca([main, ...outside]);
    if (wide && wide !== doc.documentElement && !roots.has(wide)) main = wide;
  }

  // site menu
  const navLikes = collectNavLikes(all, visible);
  let siteMenu: Element | null = null;
  if (headerRoot) {
    let best = 0;
    for (const nav of navLikes) {
      if (!headerRoot.contains(nav)) continue;
      const n = navItems(nav).length;
      if (n > best) {
        best = n;
        siteMenu = nav;
      }
    }
    if (best < 2) siteMenu = null;
  }
  if (!siteMenu) {
    const above = navLikes.filter((nav) => {
      if (insideAny(nav, sidebars) || (footerRoot && footerRoot.contains(nav))) return false;
      if (anchor) return precedes(nav, anchor);
      return main === body || precedes(nav, main);
    });
    siteMenu = above.find((nav) => navItems(nav).length >= 5) ?? null;
    // a page whose only menu above the title has 3–4 links: that is its site menu
    if (!siteMenu && above.length === 1 && navItems(above[0]!).length >= 3) siteMenu = above[0]!;
  }

  // utility roots
  const topAnchor = headerRoot ?? siteMenu ?? (main !== body ? main : null);
  const partial: ExtractContext = {
    doc, body, lang: 'en', maxBlocks: 0, now: 0, roots, main, siteMenu, anchor, form: null,
    controls: new Map(), memberOf: new Map(), consumed: new Set(), headings: [],
  };
  for (const nav of navLikes) {
    if (nav === siteMenu || insideAny(nav, sidebars) || (footerRoot && footerRoot.contains(nav))) continue;
    const items = navItems(nav);
    if (items.length === 0 || items.length > 6) continue;
    const inHeader = Boolean(headerRoot && headerRoot.contains(nav));
    const short = items.every((i) => i.length <= 24);
    const above = Boolean(topAnchor && !topAnchor.contains(nav) && precedes(nav, topAnchor) && !main.contains(nav));
    if ((inHeader && nav !== headerRoot) || (above && short)) {
      const root = foldWrappers(nav, partial);
      if (root !== headerRoot && root !== main && root !== body && !roots.has(root)) roots.set(root, 'utility');
    }
  }
  for (const el of all) {
    if (!visible(el) || roots.has(el) || el === main || main.contains(el) || el.contains(main)) continue;
    if (hasToken(el, UTILITY_EXACT) && smallEnough(el) && !insideAny(el, roots.keys())) roots.set(el, 'utility');
  }

  const byName = new Map<string, Element>();
  byName.set('main', main);
  for (const [el, name] of roots) if (!byName.has(name)) byName.set(name, el);
  return { roots, main, siteMenu, anchor, byName };
}

function firstVisible(list: NodeListOf<Element>, visible: (el: Element) => boolean): Element | null {
  for (const el of Array.from(list)) if (visible(el)) return el;
  return null;
}

function singleArticle(doc: Document, visible: (el: Element) => boolean): Element | null {
  const articles = Array.from(doc.querySelectorAll('article')).filter((a) => visible(a) && !a.parentElement?.closest('article'));
  return articles.length === 1 ? articles[0]! : null;
}

function collectNavLikes(all: Element[], visible: (el: Element) => boolean): Element[] {
  const out: Element[] = [];
  for (const el of all) {
    if (!visible(el) || insideAny(el, out)) continue;
    if (isNavLike(el)) out.push(el);
  }
  return out;
}

function largestTextContainer(body: Element, roots: Map<Element, Region>, anchor: Element | null, visible: (el: Element) => boolean, controls: Element[]): Element {
  let node = body;
  for (;;) {
    const total = textLength(node);
    if (total === 0) break;
    let best: Element | null = null;
    let bestLen = 0;
    for (const child of Array.from(node.children)) {
      if (roots.has(child) || !visible(child) || !GENERIC_CONTAINERS.has(child.localName)) continue;
      const len = textLength(child);
      if (len > bestLen) {
        best = child;
        bestLen = len;
      }
    }
    if (!best || bestLen < total * 0.6) break;
    if (anchor && !best.contains(anchor)) break;
    const chosen = best;
    if (controls.some((c) => !chosen.contains(c))) break;
    node = best;
  }
  return node;
}

/** The region of an element: nearest root, else main, else by position (see file header). */
export function regionOf(el: Element, ctx: ExtractContext): Region {
  let node: Element | null = el;
  while (node && node !== ctx.body) {
    const r = ctx.roots.get(node);
    if (r) return r;
    if (node === ctx.main) return 'main';
    node = node.parentElement;
  }
  if (ctx.main !== ctx.body && !ctx.main.contains(el) && !el.contains(ctx.main)) {
    return precedes(el, ctx.main) ? 'header' : 'footer';
  }
  return 'main';
}
