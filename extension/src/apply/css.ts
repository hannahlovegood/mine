// Styles injected by the applier. Document-level rules are attribute-scoped so undo is a matter of
// removing attributes; every Mine widget lives in its own shadow root with the Editions tokens.

export const TOKENS = `
  --paper: #ffffff; --ink: #000000; --graphite: #55534f; --rule: #d8d5ce; --stub: #f1efe9;
  --pencil: #2743d9; --pencil-soft: #e4e8fb;
  --font-interface: 'Atkinson Hyperlegible', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --font-edition: 'Literata Variable', Literata, Georgia, 'Songti SC', 'Noto Serif CJK SC', serif;
`;

export function fontFaceCss(url: (path: string) => string): string {
  return `
@font-face { font-family: 'Literata Variable'; font-style: normal; font-weight: 200 900; font-display: swap; src: url(${url('fonts/literata-latin-wght-normal.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Atkinson Hyperlegible'; font-style: normal; font-weight: 400; font-display: swap; src: url(${url('fonts/atkinson-hyperlegible-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Atkinson Hyperlegible'; font-style: normal; font-weight: 700; font-display: swap; src: url(${url('fonts/atkinson-hyperlegible-latin-700-normal.woff2')}) format('woff2'); }
`;
}

/** Document-level rules. Attribute-scoped so nothing leaks and undo = remove attributes. */
export const DOCUMENT_CSS = `
[data-mine-hidden], [data-mine-step-hidden], [data-mine-folded] { display: none !important; }
[data-mine-mark] { box-shadow: -9px 0 0 -6px var(--mine-pencil, #2743d9) !important; }
html[data-mine-compare] [data-mine-hidden], html[data-mine-compare] [data-mine-step-hidden], html[data-mine-compare] [data-mine-folded] { display: revert !important; }
html[data-mine-compare] [data-mine-mark] { box-shadow: none !important; }
html[data-mine-compare] [data-mine-injected] { display: none !important; }
html[data-mine-compare] [data-mine-rewritten] > [data-mine-plain-text] { display: none !important; }
html[data-mine-compare] [data-mine-rewritten] > [data-mine-original-text] { display: revert !important; }
[data-mine-rewritten] > [data-mine-original-text] { display: none; }
html[data-mine-large] input:not([type=checkbox]):not([type=radio]):not([type=hidden]), html[data-mine-large] select, html[data-mine-large] textarea, html[data-mine-large] button, html[data-mine-large] [role=button], html[data-mine-large] input[type=submit] { min-height: 48px !important; }
html[data-mine-large] input[type=checkbox], html[data-mine-large] input[type=radio] { width: 24px !important; height: 24px !important; }
html[data-mine-contrast] a { text-decoration: underline !important; }
html[data-mine-contrast] *:focus-visible { outline: 3px solid #2743d9 !important; outline-offset: 2px !important; }
[data-mine-injected] { display: block; }
[data-mine-injected][data-mine-inline] { display: inline-block; }
`;

/** Shared shadow styles for injected widgets (stub, callout, note, terms, stepper, plain). */
export const WIDGET_CSS = `
:host { ${TOKENS} all: initial; display: block; font-family: var(--font-interface); font-size: 14px; line-height: 1.45; color: var(--ink); margin: 10px 0; contain: content; }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
.link { background: none; border: 0; padding: 0; color: var(--pencil); text-decoration: underline; text-underline-offset: 0.18em; min-height: 32px; display: inline-flex; align-items: center; }
.link:hover { text-decoration-thickness: 2px; }
.link:focus-visible, .btn:focus-visible { outline: 3px solid var(--pencil); outline-offset: 2px; }
.stub { background: var(--stub); border-radius: 2px; padding: 8px 14px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 14px; color: var(--graphite); }
.stub .names { flex-basis: 100%; font-size: 13px; color: var(--graphite); }
.callout { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 10px 0; background: var(--paper); }
.callout .label { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; font-weight: 700; font-size: 13px; }
.callout .label .moved { color: var(--pencil); font-weight: 400; }
.callout .text { margin-top: 4px; font-family: var(--font-edition); font-size: 16px; line-height: 1.55; }
.callout .link { margin-top: 4px; }
.note { border-left: 2px solid var(--pencil); padding: 6px 12px; margin: 6px 0 0; color: var(--graphite); font-size: 14px; display: flex; flex-direction: column; gap: 3px; }
.note .pencil { color: var(--pencil); }
.terms { border-left: 2px solid var(--pencil); padding: 6px 12px; margin: 6px 0 0; font-size: 14px; }
.terms dt { font-weight: 700; display: inline; }
.terms dd { display: inline; margin: 0; color: var(--graphite); }
.terms div + div { margin-top: 4px; }
.plain { border-left: 2px solid var(--pencil); padding: 6px 12px; margin: 6px 0 0; font-family: var(--font-edition); font-size: 15px; line-height: 1.55; }
.plain .tag, .tagline { font-family: var(--font-interface); font-size: 13px; color: var(--pencil); display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.tagline .sep { color: var(--rule); }
.stepper { border-top: 1px solid var(--ink); padding: 12px 0 6px; margin: 16px 0 12px; background: var(--paper); }
.stepper .progress { font-size: 13px; color: var(--graphite); margin: 0 0 2px; display: flex; gap: 12px; align-items: baseline; }
.stepper .progress .choice { color: var(--pencil); }
.stepper .title { font-family: var(--font-edition); font-size: 22px; font-weight: 500; margin: 0 0 8px; line-height: 1.2; }
.stepper .nav { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.btn { min-height: 40px; padding: 0 18px; border-radius: 2px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font-weight: 700; font-size: 15px; }
.btn.primary { background: var(--ink); color: var(--paper); }
.btn:disabled { opacity: 0.4; cursor: default; }
.dots { display: flex; gap: 6px; margin-left: auto; }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--rule); display: block; }
.dots i[data-on] { background: var(--ink); }
.dots i[data-choice] { border: 1px solid var(--pencil); background: var(--paper); }
.dots i[data-choice][data-on] { background: var(--pencil); }
:host([data-mine-inline]) { display: inline-block; margin: 0 0 0 8px; vertical-align: middle; }
`;
