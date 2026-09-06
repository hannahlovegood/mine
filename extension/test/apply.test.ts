// The applier under happy-dom: small inline documents go through the real extractor and the real
// engine, then apply() — and every assertion is about the DOM that results. Numbers in test names
// are the findings of docs/review-extension-2026-09-06.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESETS } from '@engine/presets.ts';
import type { Lang, MinePreferences } from '@engine/schema.ts';
import { transform } from '@engine/transform.ts';
import { apply, type ApplyHooks, type Applied } from '../src/apply/index.ts';
import { DOCUMENT_CSS, WIDGET_CSS } from '../src/apply/css.ts';
import { extractPage, type ExtractedPage } from '../src/extract/index.ts';
import { findBlock } from './helpers.ts';

const HIDDEN_ATTRS = ['data-mine-hidden', 'data-mine-step-hidden', 'data-mine-folded'];

/** True when Mine hid `el` or any ancestor (happy-dom has no layout, so attributes are the truth). */
function mineHidden(el: Element | null | undefined): boolean {
  for (let e: Element | null = el ?? null; e; e = e.parentElement) {
    if (HIDDEN_ATTRS.some((a) => e!.hasAttribute(a))) return true;
  }
  return false;
}

/** Everything Mine left behind: data-mine-* attributes anywhere (html included) and injected nodes. */
function residue(): string[] {
  const out: string[] = [];
  for (const el of [document.documentElement, ...Array.from(document.querySelectorAll('*'))]) {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith('data-mine-')) out.push(`${el.localName}[${a.name}]`);
    if (/^mine-/.test(el.localName)) out.push(`<${el.localName}>`);
  }
  if (document.body.style.zoom) out.push(`body.zoom=${document.body.style.zoom}`);
  return out;
}

function mount(html: string, lang: Lang = 'en'): ExtractedPage {
  document.body.innerHTML = html;
  return extractPage(document, { lang });
}

function run(html: string, prefs: MinePreferences, hooks?: ApplyHooks, lang: Lang = 'en') {
  const page = mount(html, lang);
  const tr = transform(page.content, prefs);
  const api = apply(page, tr, prefs, lang, hooks);
  return { page, tr, api };
}

/** Re-runs transform + apply on a page whose blocks were patched (plainText from the Plain API). */
function runPatched(page: ExtractedPage, patch: (b: ExtractedPage['content']['blocks'][number]) => ExtractedPage['content']['blocks'][number], prefs: MinePreferences, hooks?: ApplyHooks) {
  const content = { ...page.content, blocks: page.content.blocks.map(patch) };
  const patched = { ...page, content };
  const tr = transform(content, prefs);
  return { page: patched, tr, api: apply(patched, tr, prefs, 'en', hooks) };
}

const sb = (host: Element | null | undefined, selector = 'button'): HTMLElement | null => (host?.shadowRoot?.querySelector(selector) as HTMLElement | null) ?? null;
const stubs = (): HTMLElement[] => Array.from(document.querySelectorAll('mine-stub'));
const stubLabel = (host: Element): string => sb(host, '.stub > span')?.textContent ?? '';
const id = (page: ExtractedPage, needle: string): string => findBlock(page, needle)!.id;

let live: Applied | null = null;
beforeEach(() => {
  document.body.innerHTML = '';
  for (const a of Array.from(document.documentElement.attributes)) if (a.name.startsWith('data-mine-')) document.documentElement.removeAttribute(a.name);
  document.body.style.zoom = '';
});
afterEach(() => {
  live?.undo();
  live = null;
  vi.useRealTimers();
});

// A flat form whose decision box (div.actions) swallowed the submit button: the review's [0] repro.
const ACTIONS = `<main><h1>Grant</h1><p>Apply for the grant before 15 October 2026.</p>
<form><label for="n">Name *</label><input id="n" required><label for="e">Email *</label><input id="e" type="email" required>
<div class="actions"><input type="checkbox" id="c" checked><label for="c">Send me updates</label><button type="submit">Submit application</button></div></form></main>`;

const SITE = `<header><nav><ul><li><a href="/a">Home</a></li><li><a href="/b">Apply</a></li><li><a href="/c">Help</a></li><li><a href="/d">Forms</a></li><li><a href="/e">Contact</a></li></ul></nav></header>
<main><h1>Grant</h1><div role="alert" class="alert">Notice: the portal is under maintenance tonight.</div>
<p>Intro paragraph about the grant program and who can apply for it.</p>
<form><label for="n">Name</label><input id="n"><label for="e">Email</label><input id="e" type="email"><button type="submit">Submit</button></form></main>
<aside><h3>Related links</h3><ul><li><a href="/x">Housing</a></li><li><a href="/y">Benefits</a></li><li><a href="/z">Contact</a></li></ul><p>Announcement: the office is closed on Monday.</p></aside>
<footer><p>Elm City Council. Privacy policy and terms apply.</p></footer>`;

const LABELS = `<header><button type="button">Sign in</button></header><main><h1>Grant</h1><form><label>Name <input id="n" required></label><label>Email <input id="e" type="email" required></label>
<label id="offers"><input type="checkbox" id="k" checked> Send me offers</label><button type="submit">Submit</button><button type="button">Save draft</button></form></main>`;

const TABLE = `<main><h1>Grant</h1><form><table><tr><td>Name</td><td><input id="n" required></td></tr><tr><td>Email</td><td><input id="e" required></td></tr>
<tr><td><input type="checkbox" id="k" checked><label for="k">Subscribe</label></td><td><button type="submit">Submit</button></td></tr></table></form></main>
<aside><p>Sidebar text here about related programmes.</p><input type="search" placeholder="Search"></aside>`;

describe('safety: what must stay visible stays visible', () => {
  it('[0] never step-hides a box that holds the submit: the last step shows the primary action', () => {
    const { page, api } = run(ACTIONS, PRESETS.focus);
    live = api;
    const submit = document.querySelector('button[type=submit]')!;
    const checkbox = document.getElementById('c')!;
    const actions = document.querySelector('div.actions')!;
    expect(api.stepCount).toBe(2);
    // step 0 is the choice: the fields are hidden, the choice box (with the submit inside) is not
    expect(mineHidden(document.getElementById('n'))).toBe(true);
    expect(mineHidden(actions)).toBe(false);
    api.setStep(1);
    expect(api.stepIndex()).toBe(1);
    expect(mineHidden(submit)).toBe(false);
    expect(mineHidden(actions)).toBe(false);
    // the fallback hides only the control and its label
    expect(mineHidden(checkbox)).toBe(true);
    expect(mineHidden(document.querySelector('label[for=c]'))).toBe(true);
    expect(mineHidden(document.getElementById('n'))).toBe(false);
    // back on the choice step the decision is visible again and the fields are not
    api.setStep(0);
    expect(mineHidden(checkbox)).toBe(false);
    expect(mineHidden(page.nodes.get(id(page, 'Name')))).toBe(true);
  });

  it('[0] post-apply invariant: a stale Mine attribute on an ancestor of the submit or the deadline comes off', () => {
    const { page, api } = run(ACTIONS, PRESETS.focus);
    live = api;
    const form = document.querySelector('form')!;
    const deadline = page.nodes.get(id(page, 'before 15 October'))!;
    // something (an earlier edition, a race) left our attribute on the form: the last step must still show the submit
    form.setAttribute('data-mine-step-hidden', '');
    api.setStep(1);
    expect(form.hasAttribute('data-mine-step-hidden')).toBe(false);
    expect(mineHidden(document.querySelector('button[type=submit]'))).toBe(false);
    // the deadline is critical and in the frame: visible on every step
    deadline.setAttribute('data-mine-hidden', '');
    api.setStep(0);
    expect(mineHidden(deadline)).toBe(false);
  });

  it('[39] a live region is never hidden, even when the engine set it aside', () => {
    // the extractor reads a live region as primary (review [39]), so the engine never sets it aside on its
    // own; downgrade the block to secondary to exercise the applier's guard
    const first = run(SITE, PRESETS.focus);
    first.api.undo();
    const alertId = id(first.page, 'maintenance');
    const { page, tr, api } = runPatched(first.page, (b) => (b.id === alertId ? { ...b, importance: 'secondary' as const } : b), PRESETS.focus);
    live = api;
    const alert = document.querySelector('[role=alert]')!;
    expect(tr.changes.some((c) => c.type === 'hidden' && c.blockIds.includes(alertId))).toBe(true);
    expect(mineHidden(alert)).toBe(false);
    // nothing was hidden in main, so main gets no stub
    expect(stubs().filter((s) => page.main.contains(s) && !page.main.querySelector('aside')?.contains(s)).map(stubLabel)).toEqual([]);
  });

  it('[40] hides a region root as a whole only when it holds nothing unaccounted for', () => {
    const { api } = run(TABLE, PRESETS.focus);
    live = api;
    const aside = document.querySelector('aside')!;
    expect(mineHidden(aside.querySelector('p'))).toBe(true);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(false);
    expect(mineHidden(aside.querySelector('input[type=search]'))).toBe(false);
    // the stub sits before the first hidden box, inside the root
    expect(stubs().length).toBeGreaterThan(0);
    expect(aside.contains(stubs()[0]!)).toBe(true);
  });

  it('[31][37] a region root hidden as a whole comes back with restore(on) and goes away again with restore(off)', () => {
    const { page, tr, api } = run(SITE, PRESETS.focus);
    live = api;
    const aside = document.querySelector('aside')!;
    const sidebarIds = tr.changes.find((c) => c.type === 'hidden' && c.blockIds.includes(id(page, 'Related links')))!.blockIds;
    expect(sidebarIds).toHaveLength(3);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(true);
    api.restore(sidebarIds, true);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(false);
    expect(mineHidden(aside.querySelector('h3'))).toBe(false);
    api.restore(sidebarIds, false);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(true);
    expect(api.restored().size).toBe(0);
    // partial restore keeps the root open until the last one is set aside again
    api.restore([sidebarIds[0]!], true);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(false);
    api.restore([sidebarIds[0]!], false);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(true);
  });
});

describe('steps', () => {
  it('[8] a surfaced note is hidden with the step of its decision', () => {
    const { api } = run(ACTIONS, PRESETS.focus);
    live = api;
    const note = document.querySelector('mine-note')!;
    expect(note).toBeTruthy();
    expect(mineHidden(note)).toBe(false);
    api.setStep(1);
    expect(note.hasAttribute('data-mine-step-hidden')).toBe(true);
    api.setStep(0);
    expect(mineHidden(note)).toBe(false);
  });

  it('[9][16] Other options: folded only inside the form, stub after the primary action, hidden with the last step', () => {
    const { api } = run(LABELS, PRESETS.focus);
    live = api;
    const signIn = document.querySelector('header button')!;
    const save = Array.from(document.querySelectorAll('form button')).find((b) => b.textContent === 'Save draft')!;
    const submit = document.querySelector('button[type=submit]')!;
    expect(mineHidden(signIn)).toBe(false);
    expect(Array.from(signIn.attributes).some((a) => a.name.startsWith('data-mine-'))).toBe(false);
    const other = stubs().find((s) => stubLabel(s) === 'Other options')!;
    expect(other).toBeTruthy();
    expect(submit.nextElementSibling).toBe(other);
    // step 0 is the choice step: the stub and the folded button are out of sight
    expect(mineHidden(other)).toBe(true);
    api.setStep(1);
    expect(mineHidden(other)).toBe(false);
    expect(save.hasAttribute('data-mine-folded')).toBe(true);
    const btn = sb(other)!;
    btn.click();
    expect(save.hasAttribute('data-mine-folded')).toBe(false);
    expect(btn.textContent).toBe('Hide other options');
    btn.click();
    expect(save.hasAttribute('data-mine-folded')).toBe(true);
  });

  it('[13][41][25][33] no focus moves on apply; the stepper announces and reports user steps', () => {
    document.body.innerHTML = ACTIONS;
    const h1 = document.querySelector('h1') as HTMLElement;
    h1.tabIndex = -1;
    h1.focus();
    expect(document.activeElement).toBe(h1);
    const page = extractPage(document, { lang: 'en' });
    const tr = transform(page.content, PRESETS.focus);
    const onStep = vi.fn();
    const api = apply(page, tr, PRESETS.focus, 'en', { onStep });
    live = api;
    expect(document.activeElement).toBe(h1);
    const stepper = document.querySelector('mine-stepper')!;
    expect(sb(stepper, '.progress')?.getAttribute('aria-live')).toBe('polite');
    expect(sb(stepper, 'section')?.getAttribute('aria-label')).toBe('Step 1 of 2');
    // the panel's own setStep is not an in-page gesture
    api.setStep(1);
    expect(onStep).not.toHaveBeenCalled();
    expect(sb(stepper, 'section')?.getAttribute('aria-label')).toBe('Step 2 of 2');
    sb(stepper, '.btn:not(.primary)')!.click(); // Back
    expect(onStep).toHaveBeenCalledWith(0);
    expect(api.stepIndex()).toBe(0);
    expect(sb(stepper, 'section')?.getAttribute('aria-label')).toBe('Step 1 of 2');
    expect(document.activeElement).toBe(stepper);
    // undo hands focus back when it was dropped in the meantime
    (document.activeElement as HTMLElement).blur?.();
    h1.focus();
    h1.blur();
    expect(document.activeElement).toBe(document.body);
    api.undo();
    live = null;
    expect(document.activeElement).toBe(h1);
  });
});

describe('stubs and restore', () => {
  it('[7][61] the engine stub ViewBlocks are not counted as folded blocks', () => {
    const { page, api } = run(SITE, PRESETS.plain);
    live = api;
    const aside = document.querySelector('aside')!;
    const sidebar = stubs().find((s) => s.nextElementSibling === aside || aside.contains(s))!;
    expect(sidebar).toBeTruthy();
    expect(stubLabel(sidebar)).toBe('3 sections collapsed');
    // the alert in main is refused, so main has no fold stub at all
    const inMain = stubs().filter((s) => page.main.contains(s) && !aside.contains(s));
    expect(inMain.map(stubLabel)).toEqual([]);
  });

  it('[55] only the site menu gets a Menu stub; the sidebar link list folds into its region', () => {
    const { api } = run(SITE, PRESETS.plain);
    live = api;
    const labels = stubs().map(stubLabel);
    expect(labels.filter((l) => l.startsWith('Menu'))).toEqual(['Menu (5)']);
    expect(mineHidden(document.querySelector('header nav'))).toBe(true);
    expect(mineHidden(document.querySelector('aside ul'))).toBe(true);
  });

  it('[55] a hidden site menu gets its own "Menu set aside" stub and the header keeps that stub reachable', () => {
    const prefs: MinePreferences = { ...PRESETS.focus, navigation: 'hidden' };
    const { api } = run(SITE, prefs);
    live = api;
    const header = document.querySelector('header')!;
    const nav = header.querySelector('nav')!;
    expect(nav.hasAttribute('data-mine-hidden')).toBe(true);
    const menu = stubs().find((s) => stubLabel(s) === 'Menu set aside')!;
    expect(menu).toBeTruthy();
    expect(mineHidden(menu)).toBe(false);
    sb(menu)!.click();
    expect(nav.hasAttribute('data-mine-hidden')).toBe(false);
    expect(sb(menu)!.textContent).toBe('Set aside again');
  });

  it('[24][34] restore() keeps every stub in sync and stub toggles report through onRestore', () => {
    const onRestore = vi.fn();
    const { page, tr, api } = run(SITE, PRESETS.focus, { onRestore });
    live = api;
    const aside = document.querySelector('aside')!;
    const sidebarIds = tr.changes.find((c) => c.type === 'hidden' && c.blockIds.includes(id(page, 'Related links')))!.blockIds;
    const stub = stubs().find((s) => s.nextElementSibling === aside)!;
    const btn = sb(stub)!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.textContent).toBe('Show');
    api.restore(sidebarIds, true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toBe('Set aside again');
    expect(onRestore).not.toHaveBeenCalled();
    btn.click();
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(Array.from(onRestore.mock.calls[0]![0] as Set<string>)).toEqual([]);
    expect(api.restored().size).toBe(0);
    expect(aside.hasAttribute('data-mine-hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    expect(new Set(onRestore.mock.calls[1]![0] as Set<string>)).toEqual(new Set(sidebarIds));
    expect(api.restored()).toEqual(new Set(sidebarIds));
  });
});

describe('compare', () => {
  it('[5][12] hold-to-compare drops data-mine-zoom while comparing and restores it after', () => {
    const { api } = run(SITE, PRESETS.large);
    live = api;
    const html = document.documentElement;
    expect(html.getAttribute('data-mine-zoom')).toBe('1.6');
    expect(document.body.style.zoom).toBe('1.6');
    api.compare(true);
    expect(html.hasAttribute('data-mine-compare')).toBe(true);
    expect(html.hasAttribute('data-mine-zoom')).toBe(false);
    expect(document.body.style.zoom).toBe('');
    api.compare(false);
    expect(html.hasAttribute('data-mine-compare')).toBe(false);
    expect(html.getAttribute('data-mine-zoom')).toBe('1.6');
    expect(document.body.style.zoom).toBe('1.6');
  });
});

describe('plain rewrites', () => {
  const INTRO = `<main><h1>Grant</h1><p id="intro">The <em>Housing Stability Grant</em> provides assistance to eligible households experiencing housing insecurity pursuant to section 4.</p>
<p id="deadline">Applications must be received before 15 October 2026.</p><p>Second paragraph of plain filler text about the programme.</p></main>`;

  it('[36][60] swaps text by moving the live child nodes, and undo() puts the same nodes back', () => {
    const page = mount(INTRO);
    const intro = document.getElementById('intro')!;
    const kids = Array.from(intro.childNodes);
    const em = intro.querySelector('em')!;
    const { api } = runPatched(page, (b) => (b.id === id(page, 'Housing Stability') ? { ...b, plainText: 'The grant helps households at risk of losing their home. See section 4.' } : b), PRESETS.plain);
    live = api;
    expect(intro.hasAttribute('data-mine-rewritten')).toBe(true);
    const orig = intro.querySelector('[data-mine-original-text]')!;
    expect(orig.contains(em)).toBe(true);
    expect(Array.from(orig.childNodes)).toEqual(kids);
    expect(intro.querySelector('[data-mine-plain-text]')?.textContent).toContain('at risk of losing');
    expect(intro.previousElementSibling?.localName).toBe('mine-tag');
    api.undo();
    live = null;
    expect(Array.from(intro.childNodes)).toEqual(kids);
    expect(intro.querySelector('em')).toBe(em);
    expect(residue()).toEqual([]);
  });

  it('[36][60] a node with a custom element, tabindex or role is annotated beside, never swapped', () => {
    const page = mount(`<main><h1>Grant</h1><p id="a">Assistance is provided to eligible households <x-tip>pursuant</x-tip> to the regulation and the policy.</p><p id="b" tabindex="0">Assistance is provided to eligible households pursuant to the regulation and the policy.</p><p>Plain filler paragraph about the programme.</p></main>`);
    const { api } = runPatched(page, (b) => ('text' in b && b.kind === 'text' && /Assistance/.test(b.text) ? { ...b, plainText: 'Help goes to households that qualify.' } : b), PRESETS.plain);
    live = api;
    for (const p of [document.getElementById('a')!, document.getElementById('b')!]) {
      expect(p.hasAttribute('data-mine-rewritten')).toBe(false);
      expect(p.nextElementSibling?.localName).toBe('mine-plain');
    }
  });

  it('[54] a deadline that is moved and rewritten shows the plain text in the callout and the tagline at the original', () => {
    const page = mount(INTRO);
    const dl = document.getElementById('deadline')!;
    const { tr, api } = runPatched(page, (b) => (b.kind === 'deadline' ? { ...b, plainText: 'Send your application by 15 October 2026.' } : b), PRESETS.plain);
    live = api;
    const moved = tr.view.find((b) => b.kind === 'deadline')!;
    expect(moved.state).toBe('moved');
    expect(moved.original).toBeDefined();
    const callout = document.querySelector('mine-callout')!;
    expect(sb(callout, '.text')?.textContent).toBe('Send your application by 15 October 2026.');
    expect(sb(callout, '.label')?.textContent).toContain(' · ');
    expect(dl.hasAttribute('data-mine-rewritten')).toBe(true);
    expect(dl.previousElementSibling?.localName).toBe('mine-tag');
  });
});

describe('widget placement', () => {
  it('[42] a note for a label-wrapped decision goes after the label, not inside it', () => {
    const { api } = run(LABELS, PRESETS.large);
    live = api;
    const label = document.getElementById('offers')!;
    const note = document.querySelector('mine-note') as HTMLElement;
    expect(label.contains(note)).toBe(false);
    expect(label.nextElementSibling).toBe(note);
    const checkbox = document.getElementById('k') as HTMLInputElement;
    note.click();
    expect(checkbox.checked).toBe(true);
  });

  it('[52] a note after a table cell goes inside the cell; a stub before a list item is wrapped in an item', () => {
    const { api } = run(TABLE, PRESETS.large);
    live = api;
    const cell = document.getElementById('k')!.closest('td')!;
    const note = document.querySelector('mine-note')!;
    expect(note.parentElement).toBe(cell);
    expect(document.querySelector('tr > mine-note, table > mine-note, tbody > mine-note')).toBeNull();
    api.undo();
    live = null;

    const list = run(
      `<main><h1>Grant</h1><p>Intro paragraph about the grant program and who can apply for it.</p><ul><li>Bring proof of address to the office.</li><li class="ad-slot">Sponsored: download the county app today.</li><li>Bring your current card.</li></ul></main>`,
      PRESETS.focus,
    );
    live = list.api;
    const ul = document.querySelector('ul')!;
    expect(Array.from(ul.children).every((c) => c.localName === 'li')).toBe(true);
    const stub = ul.querySelector('mine-stub')!;
    expect(stub).toBeTruthy();
    expect(mineHidden(stub)).toBe(false);
    expect(stub.parentElement?.localName).toBe('li');
    expect(mineHidden(document.querySelector('li.ad-slot'))).toBe(true);
  });
});

describe('undo', () => {
  it('[58][35] leaves nothing behind: no data-mine-* attributes, no injected nodes, flash cleared', () => {
    vi.useFakeTimers();
    const { api } = run(ACTIONS, PRESETS.focus);
    live = api;
    const original = document.querySelector('main > p')!;
    const callout = document.querySelector('mine-callout')!;
    const go = sb(callout, 'button.link')!;
    go.click();
    expect(original.hasAttribute('data-mine-flash')).toBe(true);
    go.click();
    expect(document.querySelectorAll('[data-mine-flash]')).toHaveLength(1);
    api.undo();
    live = null;
    expect(residue()).toEqual([]);
    vi.runAllTimers();
    expect(residue()).toEqual([]);
    expect(document.getElementById('mine-document-css')).toBeTruthy();
    expect(DOCUMENT_CSS).toMatch(/\[data-mine-flash\]/);
  });

  it('is clean after Plain and Large too', () => {
    for (const prefs of [PRESETS.plain, PRESETS.large]) {
      const { api } = run(SITE, prefs);
      api.undo();
      expect(residue()).toEqual([]);
    }
  });
});

describe('css', () => {
  it('[6] notes, terms, plain asides and taglines have a paper background', () => {
    for (const cls of ['.note', '.terms', '.plain', '.tagline']) {
      const rule = WIDGET_CSS.split('\n').find((l) => l.startsWith(`${cls} {`) || l.startsWith(`${cls}, `) || l.includes(`, ${cls} {`));
      expect(rule, cls).toBeTruthy();
      expect(rule).toMatch(/background: var\(--paper\)/);
    }
  });
});
