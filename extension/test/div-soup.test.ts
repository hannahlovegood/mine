// A page with no landmarks: generic divs, headings, a form without labels but with placeholders.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, boxHoldsOnlyItsControl, byKind, decisionsOf, fieldsOf, findBlock, loadFixture, navsOf } from './helpers.ts';

describe('div-soup.html', () => {
  const doc = loadFixture('div-soup.html');
  const page = extractPage(doc);
  const { blocks, meta } = page.content;

  it('validates, sniffs English, and picks the content column as main', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.lang).toBe('en');
    expect(meta.title).toBe('Volunteer sign-up');
    expect(page.main).toBe(doc.querySelector('#content'));
    expect(page.form).toBe(doc.querySelector('form'));
  });

  it('assigns header and footer by position when there are no landmarks', () => {
    const brand = findBlock(page, 'Riverside Community Garden')!;
    expect(brand.kind).toBe('text');
    expect(brand.region).toBe('header');
    expect(brand.importance).toBe('secondary');
    const bottom = findBlock(page, 'registered charity')!;
    expect(bottom.region).toBe('footer');
    expect(bottom.importance).toBe('secondary');
    // the only menu above the title, 4 links: the page's site menu
    const links = navsOf(page)[0]!;
    expect(links.items).toEqual(['Home', 'About', 'Volunteer', 'Contact']);
    expect(links.importance).toBe('primary');
    expect(links.region).toBe('header');
    expect(navsOf(page)).toHaveLength(1);
  });

  it('labels the fields from placeholders (and the select from its placeholder option)', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => [f.label, f.input, f.required])).toEqual([
      ['Your name', 'text', true],
      ['Email address', 'email', true],
      ['Phone', 'tel', false],
      ['Preferred day', 'select', false],
      ['Anything we should know?', 'text', false],
    ]);
    expect(fields[3]!.options).toEqual(['Saturday', 'Sunday']);
    for (const f of fields) expect(boxHoldsOnlyItsControl(page, f.id)).toEqual({ ok: true, why: '' });
    expect(page.boxes.get(fields[0]!.id)).toBe(doc.querySelector('input[name=name]')!.parentElement);
  });

  it('reads the newsletter checkbox and the submit input', () => {
    const [newsletter] = decisionsOf(page);
    expect(newsletter).toMatchObject({ label: 'Send me the monthly newsletter', optional: true, preChecked: false, importance: 'primary' });
    const [submit] = actionsOf(page);
    expect(submit).toMatchObject({ label: 'Sign me up', primary: true, importance: 'critical' });
  });

  it('makes one step from the heading before the form and groups the action with it', () => {
    expect(meta.stepOrder).toEqual([{ id: 's-1', title: 'Sign up' }]);
    for (const b of blocks) {
      if (b.kind === 'field' || b.kind === 'decision' || b.kind === 'action') expect(b.group).toBe('s-1');
      else expect(b.group).toBeUndefined();
    }
  });

  it('pairs the question heading with the paragraph after it as one faq block', () => {
    const faqs = byKind(page, 'faq');
    expect(faqs).toHaveLength(1);
    expect(faqs[0]!.text.startsWith('What should I expect? — Most sessions involve')).toBe(true);
    expect(faqs[0]!.importance).toBe('secondary');
    expect(byKind(page, 'heading').map((h) => [h.text, h.level])).toEqual([
      ['Volunteer sign-up', 1],
      ['Sign up', 2],
    ]);
  });

  it('keeps the plain divs and the span-wrapped div as primary text in main', () => {
    const main = byKind(page, 'text').filter((t) => t.region === undefined);
    expect(main.map((t) => t.text.slice(0, 20))).toEqual([
      'Riverside Community ',
      'Sessions run every S',
      'Fill in the form bel',
    ]);
    expect(main.every((t) => t.importance === 'primary')).toBe(true);
  });
});
