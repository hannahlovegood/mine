// Extractor behaviour that does not depend on a particular fixture: safety (never throws, never
// mutates), skipping rules, ids, determinism, limits, lang/title, and the structural invariants
// that must hold on every fixture (leaf wins, boxes never shared, result validates).
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { blockText, boxHoldsOnlyItsControl, byKind, loadFixture, parseHtml } from './helpers.ts';

const FIXTURES = ['portal-en.html', 'portal-zh.html', 'gov-notice-zh.html', 'bootstrap-form.html', 'div-soup.html', 'widgets.html'];

const LOREM =
  'This is a perfectly ordinary paragraph of page text that the extractor should keep as a block.';

describe('safety', () => {
  it('returns a well-formed page for <body></body> and never throws', () => {
    const doc = parseHtml('<!doctype html><html><head></head><body></body></html>');
    const page = extractPage(doc);
    expect(Array.isArray(page.content.blocks)).toBe(true);
    expect(page.content.blocks.length).toBeGreaterThanOrEqual(0);
    expect(page.content.meta.stepOrder.length).toBeGreaterThanOrEqual(1);
    expect(page.content.meta.title.length).toBeGreaterThan(0);
    expect(page.main).toBe(doc.body);
    expect(page.form).toBeUndefined();
    expect(page.lang).toBe('en');
    expect(page.regions.get('main')).toBe(doc.body);
    expect(page.nodes.size).toBe(0);
  });

  it('survives an empty document and a document without a body', () => {
    expect(() => extractPage(parseHtml(''))).not.toThrow();
    const xml = document.implementation.createDocument(null, 'root', null);
    expect(() => extractPage(xml as unknown as Document)).not.toThrow();
  });

  it('does not mutate the page', () => {
    const doc = loadFixture('portal-en.html');
    const before = doc.documentElement.outerHTML;
    extractPage(doc);
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it('ignores everything inside <mine-root> and other mine-* elements', () => {
    const doc = parseHtml(`<body>
      <mine-root><p>Junk junk junk junk junk junk junk junk.</p><input type="text" placeholder="junk"><button>Submit</button><nav><a href="#">a</a><a href="#">b</a><a href="#">c</a></nav></mine-root>
      <mine-stub>3 items set aside · Show</mine-stub>
      <p>${LOREM}</p>
    </body>`);
    const page = extractPage(doc);
    expect(page.content.blocks).toHaveLength(1);
    expect(page.content.blocks[0]?.kind).toBe('text');
    expect(blockText(page.content.blocks[0]!)).toBe(LOREM);
  });
});

describe('skipping rules', () => {
  it('skips script, style, template, noscript, hidden, aria-hidden and non-displayed elements', () => {
    const doc = parseHtml(`<head><style>.sheet-hidden{display:none}.sheet-invisible{visibility:hidden}</style></head><body>
      <script>var junk = "script text that is long enough to be a block";</script>
      <style>.x { color: red; } /* style text that is long enough to be a block */</style>
      <template><p>template text that is long enough to be a block</p></template>
      <noscript><p>noscript text that is long enough to be a block</p></noscript>
      <p hidden>hidden attribute text that is long enough to be a block</p>
      <p aria-hidden="true">aria hidden text that is long enough to be a block</p>
      <p style="display:none">inline display none text that is long enough to be a block</p>
      <p style="visibility:hidden">inline visibility hidden text that is long enough to be a block</p>
      <p class="sheet-hidden">stylesheet display none text that is long enough to be a block</p>
      <p class="sheet-invisible">stylesheet visibility hidden text that is long enough to be a block</p>
      <div hidden><p>nested inside a hidden container, long enough to be a block</p></div>
      <p>${LOREM}</p>
    </body>`);
    const page = extractPage(doc);
    expect(page.content.blocks.map(blockText)).toEqual([LOREM]);
  });

  it('skips blocks with fewer than 3 characters and empty containers', () => {
    const doc = parseHtml(`<body><p>Hi</p><p>  </p><div></div><section><div></div></section><p>${LOREM}</p></body>`);
    expect(extractPage(doc).content.blocks.map(blockText)).toEqual([LOREM]);
  });

  it('skips generic divs/spans holding fewer than 20 characters of inline text', () => {
    const doc = parseHtml(`<body><div>Related links</div><span>short</span><div>${LOREM}</div></body>`);
    expect(extractPage(doc).content.blocks.map(blockText)).toEqual([LOREM]);
  });

  it('caps a block text at 2000 characters', () => {
    const long = 'word '.repeat(1000);
    const page = extractPage(parseHtml(`<body><p>${long}</p></body>`));
    expect(blockText(page.content.blocks[0]!).length).toBeLessThanOrEqual(2000);
  });
});

describe('ids, order, limits, determinism', () => {
  it('numbers blocks b-1, b-2, … in document order', () => {
    const doc = parseHtml(`<body><h1>Title</h1><p>${LOREM}</p><p>${LOREM} Again.</p></body>`);
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => b.id)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(page.content.blocks.map((b) => b.kind)).toEqual(['heading', 'text', 'text']);
  });

  it('stops after maxBlocks', () => {
    const html = `<body>${Array.from({ length: 50 }, (_, i) => `<p>${LOREM} ${i}</p>`).join('')}</body>`;
    const page = extractPage(parseHtml(html), { maxBlocks: 10 });
    expect(page.content.blocks).toHaveLength(10);
    expect(page.content.blocks.at(-1)?.id).toBe('b-10');
    expect(extractPage(parseHtml(html)).content.blocks).toHaveLength(50);
  });

  it('is deterministic: two extractions of the same DOM agree block for block and node for node', () => {
    const doc = loadFixture('portal-en.html');
    const a = extractPage(doc);
    const b = extractPage(doc);
    expect(JSON.stringify(a.content)).toBe(JSON.stringify(b.content));
    for (const [id, node] of a.nodes) expect(b.nodes.get(id)).toBe(node);
    for (const [id, box] of a.boxes) expect(b.boxes.get(id)).toBe(box);
    expect(a.main).toBe(b.main);
    expect(a.form).toBe(b.form);
  });
});

describe('meta', () => {
  it('takes lang from <html lang> (zh* → zh, else en) and lets opts.lang override', () => {
    expect(extractPage(parseHtml('<html lang="zh-CN"><body><p>你好，这是一段足够长的正文。</p></body></html>')).lang).toBe('zh');
    expect(extractPage(parseHtml('<html lang="zh"><body></body></html>')).lang).toBe('zh');
    expect(extractPage(parseHtml('<html lang="en-GB"><body></body></html>')).lang).toBe('en');
    expect(extractPage(parseHtml('<html lang="fr"><body></body></html>')).lang).toBe('en');
    const page = extractPage(parseHtml('<html lang="en"><body></body></html>'), { lang: 'zh' });
    expect(page.lang).toBe('zh');
    expect(page.content.meta.lang).toBe('zh');
  });

  it('sniffs Chinese when the html has no lang attribute at all', () => {
    const zh = parseHtml('<html><head><title>关于开展申报工作的通知</title></head><body><p>为贯彻落实国家决策部署，现将有关事项通知如下。</p></body></html>');
    expect(extractPage(zh).lang).toBe('zh');
    const en = parseHtml(`<html><head><title>Volunteer sign-up</title></head><body><p>${LOREM}</p></body></html>`);
    expect(extractPage(en).lang).toBe('en');
  });

  it('uses the document title, else the first h1, else a placeholder', () => {
    expect(extractPage(parseHtml('<html><head><title> Housing grant </title></head><body><h1>Other</h1></body></html>')).content.meta.title).toBe('Housing grant');
    expect(extractPage(parseHtml('<body><h1>From the heading</h1></body>')).content.meta.title).toBe('From the heading');
    expect(extractPage(parseHtml('<body></body>')).content.meta.title.length).toBeGreaterThan(0);
  });
});

describe('small structural rules', () => {
  it('turns a ul that is mostly links (≥ 3 items) into one nav block, but not a plain list', () => {
    const doc = parseHtml(`<body>
      <ul><li><a href="#">Alpha</a></li><li><a href="#">Beta</a></li><li><a href="#">Gamma</a></li><li><a href="#">Delta</a></li><li>Epsilon plain</li></ul>
      <ul><li>First plain item of the list</li><li>Second plain item of the list</li><li>Third plain item of the list</li></ul>
      <ul><li><a href="#">Only</a></li><li><a href="#">Two links</a></li><li>Third plain item here</li><li>Fourth plain item here</li></ul>
    </body>`);
    const page = extractPage(doc);
    const navs = byKind(page, 'nav');
    expect(navs).toHaveLength(1);
    expect(navs[0]?.items).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(byKind(page, 'text').map(blockText)).toEqual([
      'First plain item of the list',
      'Second plain item of the list',
      'Third plain item of the list',
      'Only',
      'Two links',
      'Third plain item here',
      'Fourth plain item here',
    ]);
  });

  it('deduplicates nav items and keeps the site menu primary in the header', () => {
    const doc = parseHtml(`<body><header><nav><a href="#">Home</a><a href="#">Home</a><a href="#">Apply</a><a href="#">Status</a><a href="#">Forms</a><a href="#">Help</a></nav></header><main><p>${LOREM}</p></main></body>`);
    const nav = byKind(extractPage(doc), 'nav')[0]!;
    expect(nav.items).toEqual(['Home', 'Apply', 'Status', 'Forms', 'Help']);
    expect(nav.importance).toBe('primary');
    expect(nav.region).toBe('header');
  });

  it('maps heading levels h1 → 1, h2 → 2, else 3, and normalises a page that starts at h2', () => {
    const a = extractPage(parseHtml('<body><main><h1>One</h1><h2>Two</h2><h4>Four</h4><h6>Six</h6></main></body>'));
    expect(byKind(a, 'heading').map((h) => h.level)).toEqual([1, 2, 3, 3]);
    const b = extractPage(parseHtml('<body><main><h2>Title</h2><h3>Section</h3><h3>Other</h3><h4>Sub</h4></main></body>'));
    expect(byKind(b, 'heading').map((h) => h.level)).toEqual([1, 2, 2, 3]);
  });

  it('pairs a question heading with its answer paragraph as one faq block', () => {
    const doc = parseHtml('<body><main><h2>Can I apply twice?</h2><p>No. One application per household per cycle.</p><p>Unrelated follow-up paragraph text.</p></main></body>');
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => b.kind)).toEqual(['faq', 'text']);
    expect(blockText(page.content.blocks[0]!)).toBe('Can I apply twice? — No. One application per household per cycle.');
    expect(page.content.blocks[0]?.importance).toBe('secondary');
  });

  it('reads details/summary pairs as faq (Q — A) and a "Q:" paragraph as faq', () => {
    const doc = parseHtml('<body><main><details><summary>How long does it take?</summary><p>About 15 business days.</p></details><p>Q: Is it free? A: Yes.</p></main></body>');
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => b.kind)).toEqual(['faq', 'faq']);
    expect(blockText(page.content.blocks[0]!)).toBe('How long does it take? — About 15 business days.');
  });

  it('reads an ordered list in main as one numbered instruction block', () => {
    const doc = parseHtml('<body><main><ol><li>Gather your documents.</li><li>Fill in the form.</li><li>Submit before the deadline.</li></ol></main></body>');
    const page = extractPage(doc);
    expect(page.content.blocks).toHaveLength(1);
    expect(page.content.blocks[0]?.kind).toBe('instruction');
    expect(blockText(page.content.blocks[0]!)).toBe('1. Gather your documents. 2. Fill in the form. 3. Submit before the deadline.');
  });

  it('classifies legal text (≥ 2 hits), critical when it mentions privacy or personal data', () => {
    const doc = parseHtml(`<body><main>
      <p>The applicant shall be bound by these terms and conditions and accepts all liability arising from them.</p>
      <p>We process your personal data under our privacy policy and the terms of the Data Protection Act.</p>
      <p>${LOREM}</p>
    </main></body>`);
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => [b.kind, b.importance])).toEqual([
      ['legal', 'primary'],
      ['legal', 'critical'],
      ['text', 'primary'],
    ]);
  });

  it('detects a deadline only when the date and the deadline word share a sentence', () => {
    const doc = parseHtml(`<body><main>
      <p>Applications must be received by 11:59 p.m. on Friday, October 23, 2026. Late submissions are not considered.</p>
      <p>The portal will be unavailable on Sunday, September 20, 2026, from 2:00 to 4:00 a.m. Drafts saved before the outage are safe.</p>
      <p>The hearing takes place on October 23, 2026 in room 4 of the county building.</p>
    </main></body>`);
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => b.kind)).toEqual(['deadline', 'text', 'text']);
    const deadline = byKind(page, 'deadline')[0]!;
    expect(deadline.date).toBe('2026-10-23');
    expect(deadline.importance).toBe('critical');
    expect(deadline.group).toBeUndefined();
  });

  it('classifies notices by role, class and leading word', () => {
    const doc = parseHtml(`<body><main>
      <div role="alert">Your session will expire in five minutes. Save your work.</div>
      <div class="alert alert-warning">Please double-check the address before you continue with the form.</div>
      <p>Notice: the counter is closed on public holidays and the day after.</p>
      <p>${LOREM}</p>
    </main></body>`);
    const page = extractPage(doc);
    expect(page.content.blocks.map((b) => b.kind)).toEqual(['notice', 'notice', 'notice', 'text']);
    expect(page.content.blocks.slice(0, 3).every((b) => b.importance === 'secondary')).toBe(true);
  });

  it('rates complexity from sentence length (EN words, ZH characters) and jargon', () => {
    const simple = extractPage(parseHtml('<body><main><p>Bring your card. It is free. Ask at the desk.</p></main></body>'));
    expect(byKind(simple, 'text')[0]?.complexity).toBe('simple');
    const medium = extractPage(parseHtml('<body><main><p>Bring your current card and one proof of address dated within the last three months to any branch.</p></main></body>'));
    expect(byKind(medium, 'text')[0]?.complexity).toBe('medium');
    const complex = extractPage(parseHtml('<body><main><p>The Housing Stability Grant is a means-tested, one-time assistance program administered by the county department on behalf of the board, providing remittance of rental arrears directly to the landlord of an eligible household in order to prevent an imminent loss of tenancy.</p></main></body>'));
    expect(byKind(complex, 'text')[0]?.complexity).toBe('complex');
    const zhSimple = extractPage(parseHtml('<html lang="zh"><body><main><p>请带上身份证。办理免费。有问题请到前台咨询。</p></main></body></html>'));
    expect(byKind(zhSimple, 'text')[0]?.complexity).toBe('simple');
    const zhComplex = extractPage(parseHtml('<html lang="zh"><body><main><p>经认定的就业困难人员和离校两年内未就业的高校毕业生以灵活就业形式实现就业并按规定以个人身份缴纳职工基本养老保险费和职工基本医疗保险费的，按其实际缴费额的三分之二给予补贴。</p></main></body></html>'));
    expect(byKind(zhComplex, 'text')[0]?.complexity).toBe('complex');
  });

  it('skips images under 48 px, keeps unknown-size images, and marks header/alt-less/hero images decorative', () => {
    const doc = parseHtml(`<body>
      <header><img src="logo.png" alt="Site logo" width="120" height="40"></header>
      <main>
        <img src="pixel.gif" width="1" height="1" alt="">
        <img src="chart.png" alt="Applications per month">
        <img src="banner.jpg" class="hero-banner" alt="Skyline" width="900" height="300">
        <img src="stock.jpg" alt="" width="400" height="300">
      </main>
    </body>`);
    const images = byKind(extractPage(doc), 'image');
    expect(images.map((i) => [i.src.split('/').pop(), i.decorative, i.importance])).toEqual([
      ['logo.png', true, 'decorative'],
      ['chart.png', false, 'primary'],
      ['banner.jpg', true, 'decorative'],
      ['stock.jpg', true, 'decorative'],
    ]);
    expect(images[1]?.alt).toBe('Applications per month');
  });

  it('reads actions: submit is primary/critical, others primary, floating widgets decorative, link-buttons included', () => {
    const doc = parseHtml(`<body><main>
      <form><input type="text" aria-label="Name"><input type="email" aria-label="Email"><button>Send</button><button type="button">Cancel</button><input type="submit" value="Apply now"><a class="btn btn-primary" href="#">Continue</a><a class="btn" href="#">Print this page</a></form>
      <button type="button" style="position:fixed;bottom:0">Feedback</button>
      <div class="back-to-top"><a href="#top" role="button">Top</a></div>
    </main></body>`);
    const actions = byKind(extractPage(doc), 'action');
    expect(actions.map((a) => [a.label, a.primary, a.importance])).toEqual([
      ['Send', true, 'critical'],
      ['Cancel', false, 'primary'],
      ['Apply now', true, 'critical'],
      ['Continue', true, 'critical'],
      ['Print this page', false, 'primary'],
      ['Feedback', false, 'decorative'],
      ['Top', false, 'decorative'],
    ]);
  });

  it('groups radios by name into one select field with the radio labels as options', () => {
    const doc = parseHtml(`<body><main><form>
      <fieldset><legend>Contact</legend>
        <label><input type="radio" name="how" value="e"> Email</label>
        <label><input type="radio" name="how" value="p"> Phone</label>
        <label><input type="radio" name="how" value="l"> Letter</label>
      </fieldset>
      <label for="n">Name</label><input id="n" type="text">
    </form></main></body>`);
    const page = extractPage(doc);
    const fields = byKind(page, 'field');
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ label: 'Contact', input: 'select', options: ['Email', 'Phone', 'Letter'], required: false });
    expect(page.nodes.get(fields[0]!.id)?.getAttribute('value')).toBe('e');
    expect(page.boxes.get(fields[0]!.id)?.localName).toBe('fieldset');
    expect(boxHoldsOnlyItsControl(page, fields[0]!.id)).toEqual({ ok: true, why: '' });
  });

  it('reads controls inside wrapping labels, and strips required marks from the label', () => {
    const doc = parseHtml(`<body><main><form>
      <label>Full name (required) <input type="text" name="name"></label>
      <label>Email: <input type="email" name="email" required></label>
      <label><input type="checkbox" name="news"> Keep me posted <small class="hint">About once a month.</small></label>
      <button type="submit">Send</button>
    </form></main></body>`);
    const page = extractPage(doc);
    expect(byKind(page, 'field').map((f) => [f.label, f.required, f.input])).toEqual([
      ['Full name', true, 'text'],
      ['Email', true, 'email'],
    ]);
    const decision = byKind(page, 'decision')[0]!;
    expect(decision).toMatchObject({ label: 'Keep me posted', optional: true, preChecked: false, consequence: 'About once a month.' });
    expect(page.boxes.get(decision.id)?.localName).toBe('label');
    for (const b of [...byKind(page, 'field'), decision]) expect(boxHoldsOnlyItsControl(page, b.id)).toEqual({ ok: true, why: '' });
    expect(byKind(page, 'text')).toHaveLength(0);
  });

  it('ignores search boxes and controls inside navs, and drops a text-only placeholder option', () => {
    const doc = parseHtml(`<body>
      <header><nav><a href="#">Home</a><a href="#">Apply</a><a href="#">Help</a><input type="text" placeholder="Search the site"><button>Go</button></nav></header>
      <main><form role="search"><input type="search" name="q" placeholder="Search"><button>Search</button></form>
      <form><label for="s">Size</label><select id="s"><option>Choose…</option><option>Small</option><option>Large</option></select></form></main>
    </body>`);
    const page = extractPage(doc);
    const fields = byKind(page, 'field');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ label: 'Size', input: 'select', options: ['Small', 'Large'] });
    expect(byKind(page, 'action').map((a) => a.label)).toEqual(['Search']);
    expect(byKind(page, 'nav')[0]?.items).toEqual(['Home', 'Apply', 'Help']);
  });

  it('moves an attestation out of its own fieldset into the submit step and drops the empty step', () => {
    const doc = parseHtml(`<body><main><form>
      <fieldset><legend>About you</legend><label for="a">Name</label><input id="a" type="text"><label for="b">Phone</label><input id="b" type="tel"></fieldset>
      <fieldset><legend>Declaration</legend><label><input type="checkbox" required> I declare the above is true</label></fieldset>
      <button type="submit">Submit</button>
    </form></main></body>`);
    const page = extractPage(doc);
    expect(page.content.meta.stepOrder.map((s) => s.title)).toEqual(['About you']);
    const decision = byKind(page, 'decision')[0]!;
    expect(decision).toMatchObject({ optional: false, importance: 'critical', group: 's-1' });
    expect(byKind(page, 'action')[0]?.group).toBe('s-1');
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
  });

  it('makes a single placeholder step when there are no fields, so the page still validates', () => {
    const page = extractPage(parseHtml(`<body><p>${LOREM}</p></body>`));
    expect(page.content.meta.stepOrder).toEqual([{ id: 's-1', title: 'Part 1' }]);
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    const zh = extractPage(parseHtml('<html lang="zh"><body><p>这是一段足够长的普通正文，应当被保留为一个区块。</p></body></html>'));
    expect(zh.content.meta.stepOrder).toEqual([{ id: 's-1', title: '第 1 部分' }]);
  });

  it('chunks fields without fieldset or heading into steps of four', () => {
    const inputs = Array.from({ length: 9 }, (_, i) => `<div><label for="f${i}">Field ${i + 1}</label><input id="f${i}" type="text"></div>`).join('');
    const page = extractPage(parseHtml(`<body><form>${inputs}<button type="submit">Submit</button></form></body>`));
    expect(page.content.meta.stepOrder.map((s) => s.title)).toEqual(['Part 1', 'Part 2', 'Part 3']);
    const groups = byKind(page, 'field').map((f) => f.group);
    expect(groups).toEqual(['s-1', 's-1', 's-1', 's-1', 's-2', 's-2', 's-2', 's-2', 's-3']);
    expect(byKind(page, 'action')[0]?.group).toBe('s-3');
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
  });
});

describe('invariants on every fixture', () => {
  for (const name of FIXTURES) {
    describe(name, () => {
      const page = extractPage(loadFixture(name));

      it('validates against PageContentSchema', () => {
        const result = PageContentSchema.safeParse(page.content);
        expect(result.success, JSON.stringify(result.success ? '' : result.error.issues.slice(0, 3))).toBe(true);
      });

      it('has a node and a box for every block, and the box contains the node', () => {
        for (const b of page.content.blocks) {
          const node = page.nodes.get(b.id);
          const box = page.boxes.get(b.id);
          expect(node, b.id).toBeDefined();
          expect(box, b.id).toBeDefined();
          expect(box!.contains(node!), `${b.id} box must contain its node`).toBe(true);
          expect(page.main.ownerDocument.contains(node!), `${b.id} node must be in the document`).toBe(true);
        }
        expect(page.nodes.size).toBe(page.content.blocks.length);
      });

      it('never makes a block out of an ancestor of another block (the leaf wins)', () => {
        const nodes = page.content.blocks.map((b) => page.nodes.get(b.id)!);
        for (let i = 0; i < nodes.length; i++) {
          for (let j = 0; j < nodes.length; j++) {
            if (i !== j) expect(nodes[i]!.contains(nodes[j]!), `${page.content.blocks[i]!.id} contains ${page.content.blocks[j]!.id}`).toBe(false);
          }
        }
      });

      it('never lets two blocks share a box', () => {
        const boxes = page.content.blocks.map((b) => page.boxes.get(b.id)!);
        expect(new Set(boxes).size).toBe(boxes.length);
      });

      it('gives every field and decision a box holding only its own control, and a step from stepOrder', () => {
        const steps = new Set(page.content.meta.stepOrder.map((s) => s.id));
        for (const b of page.content.blocks) {
          if (b.kind !== 'field' && b.kind !== 'decision') continue;
          expect(boxHoldsOnlyItsControl(page, b.id)).toEqual({ ok: true, why: '' });
          expect(b.group && steps.has(b.group), `${b.id} group`).toBe(true);
        }
      });

      it('keeps ids sequential and blocks in document order', () => {
        page.content.blocks.forEach((b, i) => expect(b.id).toBe(`b-${i + 1}`));
        const nodes = page.content.blocks.map((b) => page.nodes.get(b.id)!);
        for (let i = 1; i < nodes.length; i++) {
          const rel = nodes[i - 1]!.compareDocumentPosition(nodes[i]!);
          expect(rel & Node.DOCUMENT_POSITION_FOLLOWING, `${page.content.blocks[i]!.id} should follow ${page.content.blocks[i - 1]!.id}`).toBeTruthy();
        }
      });

      it('never leaves a text-kind block shorter than 3 characters or longer than 2000', () => {
        for (const b of page.content.blocks) {
          if ('text' in b) {
            expect(b.text.length).toBeGreaterThanOrEqual(3);
            expect(b.text.length).toBeLessThanOrEqual(2000);
          }
        }
      });

      it('leaves deadlines ungrouped and critical', () => {
        for (const d of byKind(page, 'deadline')) {
          expect(d.group).toBeUndefined();
          expect(d.importance).toBe('critical');
          expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });

      it('exposes main and the region roots as elements of this document', () => {
        expect(page.regions.get('main')).toBe(page.main);
        for (const [, el] of page.regions) expect(page.main.ownerDocument.contains(el)).toBe(true);
      });
    });
  }
});
