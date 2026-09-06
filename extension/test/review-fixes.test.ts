// Fixture dates are written for mid-2026; pin the clock so they stay live deadlines.
const FIXTURE_NOW = Date.parse('2026-06-01T00:00:00Z');
// Extractor-side fixes from docs/review-extension-2026-09-06.md, one describe per finding
// (numbers in the titles refer to that file). Inline snippets; the three framework fixtures
// (elementor, element-ui, gov-table-form) cover the rest.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { findDeadline } from '../src/extract/dates.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, boxHoldsOnlyItsControl, byKind, deadlinesOf, decisionsOf, fieldsOf, findBlock, navsOf, parseHtml } from './helpers.ts';

const LOREM = 'This is a perfectly ordinary paragraph of page text that the extractor should keep as a block.';
const MENU = '<ul><li><a href="/">Home</a></li><li><a href="/apply">Apply</a></li><li><a href="/status">Status</a></li><li><a href="/forms">Forms</a></li><li><a href="/help">Help</a></li></ul>';

describe('[0] a control box never swallows an action or foreign content', () => {
  const doc = parseHtml(`<body><main><form>
    <div class="row"><label for="n">Name</label><input id="n" type="text"><button type="submit">Save</button></div>
    <div class="row"><label for="e">Email</label><input id="e" type="email"><button type="button" aria-label="Clear"><svg width="12" height="12"></svg></button></div>
    <div class="row"><label for="p">Phone</label><input id="p" type="tel"><p>${LOREM} ${LOREM} ${LOREM}</p></div>
    <div class="row"><label for="w">Website</label><input id="w" type="text"><a class="btn" href="/check">Check</a></div>
    <div class="row"><label for="c">Comment</label><textarea id="c"></textarea><span class="hint">Optional</span></div>
  </form></main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('keeps buttons (even icon-only ones) and link-buttons out of every field box', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => f.label)).toEqual(['Name', 'Email', 'Phone', 'Website', 'Comment']);
    for (const f of fields) {
      const box = page.boxes.get(f.id)!;
      expect(box.querySelector('button,a.btn'), `${f.label} box holds an action`).toBeNull();
      expect(boxHoldsOnlyItsControl(page, f.id)).toEqual({ ok: true, why: '' });
    }
  });

  it('keeps a foreign paragraph out of the box but folds the help span in', () => {
    const phone = fieldsOf(page)[2]!;
    expect(page.boxes.get(phone.id)!.querySelector('p')).toBeNull();
    expect(findBlock(page, `${LOREM} ${LOREM}`)?.kind).toBe('text');
    const comment = fieldsOf(page)[4]!;
    expect(page.boxes.get(comment.id)!.classList.contains('row')).toBe(true);
    expect(comment.help).toBe('Optional');
  });
});

describe('[1] widget classes never float or sidebar content inside main', () => {
  const doc = parseHtml(`<body><main>
    <div class="widget widget-text"><p>${LOREM}</p></div>
    <div class="elementor-widget elementor-widget-text-editor"><div class="elementor-widget-container"><p>${LOREM} Second.</p></div></div>
    <div class="widgets-area"><p>${LOREM} Third.</p></div>
  </main><aside class="widget-area"><div class="widget"><ul><li><a href="/a">Alpha</a></li><li><a href="/b">Beta</a></li><li><a href="/c">Gamma</a></li></ul></div></aside></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('keeps the three paragraphs as primary main text and the aside as the only sidebar', () => {
    const texts = byKind(page, 'text');
    expect(texts).toHaveLength(3);
    expect(texts.every((t) => t.importance === 'primary' && t.region === undefined)).toBe(true);
    expect(byKind(page, 'notice')).toHaveLength(0);
    expect(page.regions.get('sidebar')).toBe(doc.querySelector('aside'));
    for (const [, root] of page.regions) expect(root === page.main || !page.main.contains(root)).toBe(true);
  });
});

describe('[2] link lists and breadcrumbs holding controls are not composite navs', () => {
  const doc = parseHtml(`<body><main><form>
    <ul class="steps"><li><a href="/s1">Step 1</a></li><li><a href="/s2">Step 2</a></li><li><a href="/s3">Step 3</a></li><li><input type="text" aria-label="Voucher code" required></li></ul>
    <div class="breadcrumb"><a href="/">Home</a> › <a href="/apply">Apply</a> › <a href="/apply/2">Part 2</a> <input type="text" aria-label="Reference" required></div>
    <nav><a href="/">Home</a><a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a></nav>
    <button type="submit">Go</button>
  </form></main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('still yields both required fields, and no nav box holds a field node', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => [f.label, f.required])).toEqual([
      ['Voucher code', true],
      ['Reference', true],
    ]);
    const fieldNodes = fields.map((f) => page.nodes.get(f.id)!);
    for (const n of navsOf(page)) {
      const box = page.boxes.get(n.id)!;
      for (const node of fieldNodes) expect(box.contains(node), `nav ${n.items.join('|')} swallows a field`).toBe(false);
    }
    expect(navsOf(page).map((n) => n.items)).toEqual([['Home', 'A', 'B', 'C', 'D']]);
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
  });
});

describe('[10] faq composites only with a shared wrapper', () => {
  const doc = parseHtml(`<body><main><h1>Grants</h1>
    <div class="faq-item"><h3>Can I apply twice?</h3><p>No. One application per household per cycle.</p></div>
    <h3>What documents do I need?</h3><p>Your ID and a proof of address.</p><p>Bring the originals to the appointment.</p>
    <h2>Need help?</h2><p>Call 020 7946 0000 on weekdays between nine and five.</p>
  </main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('pairs the wrapped question with its answer and gives the pair the wrapper as its box', () => {
    const faq = findBlock(page, 'Can I apply twice?')!;
    expect(faq.kind).toBe('faq');
    expect(blockText(faq)).toBe('Can I apply twice? — No. One application per household per cycle.');
    expect(page.boxes.get(faq.id)).toBe(doc.querySelector('.faq-item'));
  });

  it('emits an unwrapped question as a secondary heading plus a secondary faq answer, each with its own box', () => {
    expect(page.content.blocks.map((b) => [b.kind, b.importance])).toEqual([
      ['heading', 'primary'],
      ['faq', 'secondary'],
      ['heading', 'secondary'],
      ['faq', 'secondary'],
      ['text', 'primary'],
      ['heading', 'secondary'],
      ['faq', 'secondary'],
    ]);
    const q = findBlock(page, 'What documents do I need?')!;
    expect(q.kind).toBe('heading');
    const a = findBlock(page, 'Your ID and a proof')!;
    expect(a.kind).toBe('faq');
    expect(blockText(a)).toBe('Your ID and a proof of address.');
    for (const b of byKind(page, 'faq')) {
      const box = page.boxes.get(b.id)!;
      const answer = blockText(b).split(' — ').pop()!;
      expect(box.textContent?.includes(answer), `${b.id} box must contain its answer`).toBe(true);
    }
  });
});

describe('[14][15][20][22] the floating rule never demotes a deadline, a primary action, the site menu or main content', () => {
  const doc = parseHtml(`<body>
    <div class="site-top" style="position:sticky;top:0">${MENU}</div>
    <main>
      <h1>Grant</h1>
      <div class="float-right"><p>Applications must be received by October 23, 2026.</p></div>
      <div class="consent-note"><p>By continuing you consent to the processing of your personal data as described in the privacy policy and these terms of use.</p></div>
      <div class="invalid-feedback">Please enter a valid email address before you continue with the application.</div>
      <div class="sticky-actions" style="position:sticky;bottom:0"><p>Check your answers, then submit before the deadline of October 23, 2026.</p><button type="submit">Submit</button></div>
      <div style="position:fixed;bottom:0;left:0"><p>Reminder: the portal closes on October 23, 2026 at 5 pm sharp.</p></div>
      <div id="feedback" class="feedback-widget" style="position:fixed;right:0;bottom:0"><p>We would love your feedback on this page. Tell us what you think about the new design.</p><button type="button">Give feedback</button></div>
      <p>${LOREM}</p>
    </main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('keeps the sticky top bar as the primary site menu, not a notice', () => {
    const menu = navsOf(page).find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(['Home', 'Apply', 'Status', 'Forms', 'Help']);
    expect(menu.region).toBe('header');
    expect(byKind(page, 'notice').filter((n) => n.text.includes('Home'))).toHaveLength(0);
  });

  it('finds every deadline (float-* class, sticky submit bar, fixed reminder) as critical', () => {
    const deadlines = deadlinesOf(page);
    expect(deadlines.map((d) => d.text.slice(0, 12))).toEqual(['Applications', 'Check your a', 'Reminder: th']);
    expect(deadlines.every((d) => d.date === '2026-10-23' && d.importance === 'critical')).toBe(true);
  });

  it('keeps the submit critical, the consent text critical legal, and the validation message a primary notice', () => {
    expect(actionsOf(page).find((a) => a.label === 'Submit')).toMatchObject({ primary: true, importance: 'critical' });
    expect(findBlock(page, 'By continuing you consent')).toMatchObject({ kind: 'legal', importance: 'critical' });
    expect(findBlock(page, 'Please enter a valid email')).toMatchObject({ kind: 'notice', importance: 'primary' });
  });

  it('still sets a positioned feedback widget aside as one decorative notice, buttons included', () => {
    const widget = findBlock(page, 'love your feedback')!;
    expect(widget).toMatchObject({ kind: 'notice', importance: 'decorative' });
    expect(page.boxes.get(widget.id)).toBe(doc.querySelector('#feedback'));
    expect(actionsOf(page).some((a) => a.label === 'Give feedback')).toBe(false);
    expect(page.content.blocks.filter((b) => b.importance === 'decorative')).toHaveLength(1);
  });
});

describe('[18][19] attestations: agree/accept/acknowledge about terms or policy, labels from trailing text', () => {
  const doc = parseHtml(`<body><main><form>
    <label><input type="checkbox" name="tos"> I agree to the <a href="/terms">Terms of Service</a></label>
    <label><input type="checkbox" name="news" checked> Send me news and offers from our partners</label>
    <label><input type="checkbox" name="ack"> I acknowledge that I have read the privacy policy</label>
    <div><input type="checkbox" id="c4"> <span>I accept the rules of the competition</span></div>
    <div><input type="checkbox" id="c5"> Yes, I agree to receive marketing emails from time to time</div>
    <div><input type="checkbox" id="c6"> 本人已阅读并知悉上述申报须知</div>
    <div><input type="checkbox" id="c7"> 同意接收活动推送消息</div>
    <button type="submit">Send</button>
  </form></main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('reads the labels from the trailing text or span and decides optional by the subject of the agreement', () => {
    expect(decisionsOf(page).map((d) => [d.label, d.optional, d.importance])).toEqual([
      ['I agree to the Terms of Service', false, 'critical'],
      ['Send me news and offers from our partners', true, 'primary'],
      ['I acknowledge that I have read the privacy policy', false, 'critical'],
      ['I accept the rules of the competition', false, 'critical'],
      ['Yes, I agree to receive marketing emails from time to time', true, 'primary'],
      ['本人已阅读并知悉上述申报须知', false, 'critical'],
      ['同意接收活动推送消息', true, 'primary'],
    ]);
    expect(decisionsOf(page)[1]!.preChecked).toBe(true);
    for (const d of decisionsOf(page)) expect(boxHoldsOnlyItsControl(page, d.id)).toEqual({ ok: true, why: '' });
    expect(byKind(page, 'text')).toHaveLength(0);
  });
});

describe('[21] notice classes only demote small containers; 日前 / on or before are deadline words', () => {
  const long = '为贯彻落实国家和省关于稳就业保就业的决策部署，进一步减轻灵活就业人员参加社会保险的负担，根据市政府统一安排，现就本年度灵活就业人员社会保险补贴申报工作有关事项通知如下，请各单位认真组织实施。';
  const doc = parseHtml(`<html lang="zh"><body><main><h1>通知</h1>
    <div class="notice"><p>${long}</p><p>${long}</p><p>${long}</p><p>请各单位于2026年6月30日前报送材料。</p></div>
    <div class="notice-tip">温馨提示：办理时请携带身份证原件及复印件各一份。</div>
    <div class="alert"><p>注意：请于6月30日前完成网上申报，逾期不再受理。</p></div>
  </main></body></html>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('keeps the body paragraphs of a large .notice container primary text, and the small tip a secondary notice', () => {
    const body = byKind(page, 'text').filter((t) => t.text.startsWith('为贯彻落实'));
    expect(body).toHaveLength(3);
    expect(body.every((t) => t.importance === 'primary')).toBe(true);
    expect(findBlock(page, '温馨提示')).toMatchObject({ kind: 'notice', importance: 'secondary' });
  });

  it('reads 日前 as a deadline word and keeps a yearless deadline sentence primary even inside .alert', () => {
    expect(deadlinesOf(page).map((d) => d.date)).toEqual(['2026-06-30']);
    expect(findBlock(page, '注意：请于6月30日前')).toMatchObject({ kind: 'text', importance: 'primary' });
    expect(findDeadline('请于2026年6月30日前完成报名。', 'zh')).toBe('2026-06-30');
    expect(findDeadline('材料须于2026年7月15日前报送市局。', 'zh')).toBe('2026-07-15');
    expect(findDeadline('Return the signed form on or before June 30, 2026.', 'en')).toBe('2026-06-30');
    expect(findDeadline('日前，市政府印发了2026年6月30日的会议纪要。', 'zh')).toBeNull();
  });
});

describe('[29][30] a page-wide form is narrowed to its controls; controls outside it are chrome or their own group', () => {
  const doc = parseHtml(`<body><form id="aspnetForm" method="post">
    <div class="header"><a href="/">Elm County</a>${MENU}<input type="text" name="q" placeholder="Search"><input type="submit" value="Search"></div>
    <div class="content">
      <h1>Permit application</h1>
      <p>${LOREM}</p>
      <div class="fields"><label for="a">Name</label><input id="a"><label for="b">Email</label><input id="b" type="email"><label for="c">Phone</label><input id="c" type="tel"></div>
      <input type="submit" value="Apply">
      <h2>Stay informed</h2>
      <div class="subscribe"><label for="nl">Newsletter email</label><input id="nl" type="email"><button type="button">Join</button></div>
    </div>
    <div class="footer"><p>© Elm County. All rights reserved by the council.</p><input type="submit" value="Send feedback"></div>
  </form></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('narrows the form root to the common wrapper of the main controls (here the content column, since the newsletter field is in main)', () => {
    expect(page.form).toBe(doc.querySelector('.content'));
    expect(page.form).not.toBe(doc.querySelector('form'));
    expect(page.main).toBe(doc.querySelector('.content'));
    expect(page.regions.get('header')).toBe(doc.querySelector('.header'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('.footer'));
  });

  it('skips the header search box, keeps the main fields, and puts the newsletter field in its own step', () => {
    expect(fieldsOf(page).map((f) => f.label)).toEqual(['Name', 'Email', 'Phone', 'Newsletter email']);
    const [name, , , newsletter] = fieldsOf(page);
    expect(page.content.meta.stepOrder.map((s) => s.title)).toEqual(['Permit application', 'Stay informed']);
    expect(name!.group).toBe('s-1');
    expect(newsletter!.group).toBe('s-2');
  });

  it('groups only the actions inside the narrowed root, never the header or footer buttons', () => {
    const actions = actionsOf(page);
    expect(actions.map((a) => [a.label, a.group])).toEqual([
      ['Search', undefined],
      ['Apply', 's-2'],
      ['Join', 's-2'],
      ['Send feedback', undefined],
    ]);
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
  });
});

describe('[38][39] validation messages are help text; live regions are never secondary', () => {
  const doc = parseHtml(`<body><main><form>
    <div class="form-group"><label for="e">Email</label><input id="e" type="email" class="is-invalid"><div class="invalid-feedback">Please provide a valid email address.</div></div>
    <div role="alert" class="alert alert-danger">There were two errors in your submission. Fix them before you continue.</div>
    <div class="error-summary"><p>The reference number does not match our records for this applicant.</p></div>
    <button type="submit">Send</button>
  </form>
  <div role="status">Your draft was saved a moment ago and will be kept for thirty days.</div>
  <div class="alert alert-info">Offices are closed on public holidays and the day after them.</div>
  </main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('folds .invalid-feedback into the field as help', () => {
    expect(fieldsOf(page)[0]).toMatchObject({ label: 'Email', help: 'Please provide a valid email address.' });
    expect(page.boxes.get(fieldsOf(page)[0]!.id)?.classList.contains('form-group')).toBe(true);
  });

  it('gives role=alert and error containers inside the form critical importance, role=status primary, plain .alert secondary', () => {
    expect(findBlock(page, 'There were two errors')).toMatchObject({ kind: 'notice', importance: 'critical' });
    expect(findBlock(page, 'reference number')).toMatchObject({ kind: 'notice', importance: 'critical' });
    expect(findBlock(page, 'Your draft was saved')).toMatchObject({ kind: 'notice', importance: 'primary' });
    expect(findBlock(page, 'Offices are closed')).toMatchObject({ kind: 'notice', importance: 'secondary' });
    expect(page.content.blocks.filter((b) => b.importance === 'decorative')).toHaveLength(0);
  });
});

describe('[45] promo/header class rules do not catch primary content', () => {
  const doc = parseHtml(`<body>
    <div class="page-header"><h1>Housing grant</h1><p class="lead">Help with rent arrears for eligible households in the county.</p></div>
    <div class="content">
      <div class="banner"><h2>Ready to apply</h2><p>The application takes about twenty minutes. Have your documents ready before you start.</p><a class="btn btn-primary" href="/apply">Start application</a></div>
      <div class="feedback-form"><p>Tell us how we can improve this page; your answers help us plan the next round of improvements.</p></div>
      <div class="rating-box"><p>How useful was this page to you today? Your rating helps us improve the service.</p></div>
      <div class="promo-box"><p>Download the app for reminders on your phone and updates about your case.</p><a href="/app">Get it</a></div>
      <p>${LOREM}</p>
    </div></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('does not make .page-header a header root, and keeps its h1 the primary level-1 title', () => {
    expect(page.regions.get('header')).toBeUndefined();
    expect(findBlock(page, 'Housing grant')).toMatchObject({ kind: 'heading', level: 1, importance: 'primary' });
  });

  it('keeps a banner with a heading and a primary action as content, and only a plain promo box composite', () => {
    expect(findBlock(page, 'Ready to apply')).toMatchObject({ kind: 'heading', importance: 'primary' });
    expect(findBlock(page, 'twenty minutes')).toMatchObject({ kind: 'text', importance: 'primary' });
    expect(actionsOf(page).find((a) => a.label === 'Start application')).toMatchObject({ primary: true, importance: 'critical' });
    expect(findBlock(page, 'Tell us how we can improve')).toMatchObject({ kind: 'text', importance: 'primary' });
    expect(findBlock(page, 'How useful was this page')).toMatchObject({ kind: 'text', importance: 'primary' });
    const promo = findBlock(page, 'Download the app')!;
    expect(promo).toMatchObject({ kind: 'promo', importance: 'decorative' });
    expect(page.boxes.get(promo.id)).toBe(doc.querySelector('.promo-box'));
  });
});

describe('[46] the main root holds every control that follows the title', () => {
  it('widens a single-article main to include the application form after it', () => {
    const doc = parseHtml(`<body><div class="site">
      <div class="masthead"><a href="/">Elm</a>${MENU}</div>
      <article><h1>Community grant</h1><p>${LOREM}</p><p>${LOREM} Again and again.</p></article>
      <div class="apply"><h2>Apply</h2><form><label for="a">Name</label><input id="a" required><label for="b">Email</label><input id="b" type="email"><button type="submit">Apply</button></form></div>
      <div class="site-footer"><p>© 2026 Elm County Council. All rights reserved.</p></div>
    </div></body>`);
    const page = extractPage(doc, { now: FIXTURE_NOW });
    expect(page.main.contains(doc.querySelector('form')!)).toBe(true);
    expect(page.main.contains(doc.querySelector('article')!)).toBe(true);
    expect(fieldsOf(page).map((f) => [f.label, f.region])).toEqual([
      ['Name', undefined],
      ['Email', undefined],
    ]);
    expect(byKind(page, 'heading').find((h) => h.text === 'Apply')).toMatchObject({ importance: 'primary' });
    expect(findBlock(page, '© 2026')).toMatchObject({ region: 'footer', importance: 'secondary' });
    expect(page.regions.get('header')).toBe(doc.querySelector('.masthead'));
  });

  it('does not descend into a table row that leaves the form behind', () => {
    const doc = parseHtml(`<body><table><tbody>
      <tr><td class="menu">${MENU}</td><td class="body"><h1>Permit</h1><p>${LOREM}</p><p>${LOREM} Twice.</p><p>${LOREM} Thrice.</p></td></tr>
      <tr><td colspan="2"><form><label for="a">Name</label><input id="a"><label for="b">Plate</label><input id="b"><input type="submit" value="Apply"></form></td></tr>
    </tbody></table></body>`);
    const page = extractPage(doc, { now: FIXTURE_NOW });
    expect(page.main.contains(doc.querySelector('form')!)).toBe(true);
    expect(fieldsOf(page).map((f) => [f.label, f.region])).toEqual([
      ['Name', undefined],
      ['Plate', undefined],
    ]);
    expect(actionsOf(page)[0]).toMatchObject({ label: 'Apply', importance: 'critical' });
  });
});

describe('[47] tab bars are not navigation', () => {
  const doc = parseHtml(`<body><main><form>
    <ul class="nav nav-tabs" role="tablist"><li><a href="#basic" data-toggle="tab">Basic info</a></li><li><a href="#docs" data-toggle="tab">Documents</a></li><li><a href="#review" data-toggle="tab">Review</a></li></ul>
    <div id="basic" class="tab-pane"><label for="a">Name</label><input id="a" required></div>
    <div id="docs" class="tab-pane"><label for="b">Passport</label><input id="b" type="file" required></div>
    <ul class="ui-tabs-nav"><li><a href="#one">One</a></li><li><a href="#two">Two</a></li><li><a href="#three">Three</a></li></ul>
    <button type="submit">Submit</button>
  </form></main>
  <footer><ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="/contact">Contact</a></li></ul></footer></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('emits one primary, ungrouped action per tab and keeps real link lists as navs', () => {
    const tabs = actionsOf(page).filter((a) => !a.primary);
    expect(tabs.map((a) => [a.label, a.importance, a.group])).toEqual([
      ['Basic info', 'primary', undefined],
      ['Documents', 'primary', undefined],
      ['Review', 'primary', undefined],
      ['One', 'primary', undefined],
      ['Two', 'primary', undefined],
      ['Three', 'primary', undefined],
    ]);
    expect(navsOf(page).map((n) => [n.items, n.region])).toEqual([[['Privacy', 'Terms', 'Contact'], 'footer']]);
    expect(actionsOf(page).find((a) => a.primary)).toMatchObject({ label: 'Submit', group: 's-1' });
    expect(fieldsOf(page)).toHaveLength(2);
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
  });
});

describe('[63] a header search form is never the form root', () => {
  const doc = parseHtml(`<body>
    <header><form class="search" action="/search"><input type="text" name="q" placeholder="Search the site"><button>Search</button></form><nav>${MENU}</nav></header>
    <main><h1>Sign up</h1><div class="MuiBox-root">
      <div class="MuiFormControl-root"><label for="n">Name</label><input id="n" type="text"></div>
      <div class="MuiFormControl-root"><label for="e">Email</label><input id="e" type="email"></div>
      <button type="button" class="MuiButton-containedPrimary">Create account</button>
    </div></main></body>`);
  const page = extractPage(doc, { now: FIXTURE_NOW });

  it('picks the common wrapper of the main controls and skips the search box as chrome', () => {
    expect(page.form).toBe(doc.querySelector('.MuiBox-root'));
    expect(fieldsOf(page).map((f) => f.label)).toEqual(['Name', 'Email']);
    expect(actionsOf(page).map((a) => [a.label, a.group])).toEqual([
      ['Search', undefined],
      ['Create account', 's-1'],
    ]);
    expect(page.content.meta.stepOrder).toEqual([{ id: 's-1', title: 'Sign up' }]);
  });
});

describe('[64] attachment and download lists in main are instructions, not navs', () => {
  it('joins the document links into one primary instruction block', () => {
    const doc = parseHtml(`<body><main><h1>Forms</h1><p>Attachments:</p>
      <ul><li><a href="a.pdf">Application form (PDF)</a></li><li><a href="b.docx">Budget template (DOCX)</a></li><li><a href="c.xlsx">Cost sheet (XLSX)</a></li></ul>
      <ul><li><a href="/about">About us</a></li><li><a href="/news">News</a></li><li><a href="/contact">Contact</a></li></ul>
    </main></body>`);
    const page = extractPage(doc, { now: FIXTURE_NOW });
    const list = findBlock(page, 'Budget template')!;
    expect(list.kind).toBe('instruction');
    expect(list.importance).toBe('primary');
    expect(blockText(list)).toBe('1. Application form (PDF) 2. Budget template (DOCX) 3. Cost sheet (XLSX)');
    expect(navsOf(page).map((n) => n.items)).toEqual([['About us', 'News', 'Contact']]);
  });
});

describe('[53] rootOf maps every rooted block to its region root element', () => {
  it('uses the header/footer roots and main, and omits blocks that only have a position', () => {
    const doc = parseHtml(`<body><header><nav>${MENU}</nav></header><main><p>${LOREM}</p></main><footer><p>© 2026 Elm County Council. All rights reserved.</p></footer><div class="chat" style="position:fixed"><button type="button">Chat with us</button></div></body>`);
    const page = extractPage(doc, { now: FIXTURE_NOW });
    const [nav, text, footer, chat] = page.content.blocks;
    expect([nav!.kind, text!.kind, footer!.kind, chat!.kind]).toEqual(['nav', 'text', 'text', 'action']);
    expect(page.rootOf?.get(nav!.id)).toBe(doc.querySelector('header'));
    expect(page.rootOf?.get(text!.id)).toBe(doc.querySelector('main'));
    expect(page.rootOf?.get(footer!.id)).toBe(doc.querySelector('footer'));
    expect(page.rootOf?.get(chat!.id)).toBeUndefined();
  });
});
