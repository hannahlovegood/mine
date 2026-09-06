// A Bootstrap-like form: .form-group wrappers, two fieldsets with legends, a radio group, a
// required attestation checkbox, a pre-checked marketing checkbox, help via .form-text and
// aria-describedby, submit + reset + a link-button.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, boxHoldsOnlyItsControl, byKind, decisionsOf, fieldsOf, findBlock, loadFixture, navsOf } from './helpers.ts';

describe('bootstrap-form.html', () => {
  const doc = loadFixture('bootstrap-form.html');
  const page = extractPage(doc);
  const { blocks, meta } = page.content;

  it('validates and finds the form, main and header roots', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.form).toBe(doc.querySelector('#permit-form'));
    expect(page.main).toBe(doc.querySelector('main'));
    expect(page.regions.get('header')).toBe(doc.querySelector('nav.navbar'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('footer'));
    expect(blocks.length).toBeGreaterThanOrEqual(15);
  });

  it('reads the eight fields with labels, types and required flags', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => f.label)).toEqual([
      'Full name',
      'Email address',
      'Phone',
      'Preferred contact method',
      'Street address',
      'City',
      'Permit zone',
      'Vehicle registration',
    ]);
    expect(fields.map((f) => f.input)).toEqual(['text', 'email', 'tel', 'select', 'text', 'text', 'select', 'text']);
    expect(fields.filter((f) => f.required).map((f) => f.label)).toEqual(['Full name', 'Street address', 'City', 'Permit zone']);
    for (const f of fields) expect(f.importance).toBe(f.required ? 'critical' : 'primary');
  });

  it('reads help from aria-describedby and from .form-text siblings, and options without the placeholder', () => {
    const fields = fieldsOf(page);
    expect(fields[1]!.help).toBe('We will only use this to send your permit and renewal reminders.');
    expect(fields[2]!.help).toBe('Include the area code.');
    expect(fields[0]!.help).toBeUndefined();
    expect(fields[6]!.options).toEqual(['Zone A', 'Zone B', 'Zone C']);
    expect(fields[7]!.options).toBeUndefined();
  });

  it('collapses the radio group into one select field whose box holds all three radios', () => {
    const radio = fieldsOf(page)[3]!;
    expect(radio).toMatchObject({ input: 'select', options: ['Email', 'Phone', 'Post'], required: false });
    expect(page.nodes.get(radio.id)).toBe(doc.querySelector('#contactEmail'));
    const box = page.boxes.get(radio.id)!;
    expect(box.querySelectorAll('input[type=radio]')).toHaveLength(3);
    expect(boxHoldsOnlyItsControl(page, radio.id)).toEqual({ ok: true, why: '' });
    expect(findBlock(page, 'Preferred contact method')?.kind).toBe('field');
  });

  it('reads the two decisions: pre-checked optional marketing, required attestation', () => {
    const [marketing, declare, ...rest] = decisionsOf(page);
    expect(rest).toHaveLength(0);
    expect(marketing).toMatchObject({
      label: 'Send me news and offers from the city and its partners',
      optional: true,
      preChecked: true,
      importance: 'primary',
      consequence: 'You can unsubscribe at any time.',
    });
    expect(declare).toMatchObject({
      label: 'I declare that the information I have given is true and complete',
      optional: false,
      preChecked: false,
      importance: 'critical',
    });
    expect(declare!.consequence).toBeUndefined();
  });

  it('reads submit, reset and the link-button as actions', () => {
    const actions = actionsOf(page);
    expect(actions.map((a) => [a.label, a.primary, a.importance])).toEqual([
      ['Submit registration', true, 'critical'],
      ['Reset', false, 'primary'],
      ['Save for later', false, 'primary'],
    ]);
  });

  it('builds steps from the fieldsets, then the heading before the form, with the attestation in the submit step', () => {
    expect(meta.stepOrder.map((s) => s.title)).toEqual(['Your details', 'Your address', 'Register for the resident parking permit scheme']);
    const [s1, s2, s3] = meta.stepOrder.map((s) => s.id);
    const fields = fieldsOf(page);
    expect(fields.slice(0, 4).map((f) => f.group)).toEqual([s1, s1, s1, s1]);
    expect(fields.slice(4).map((f) => f.group)).toEqual([s2, s2, s2, s2]);
    const [marketing, declare] = decisionsOf(page);
    expect(marketing!.group).toBe(s3);
    expect(declare!.group).toBe(s3);
    expect(actionsOf(page).map((a) => a.group)).toEqual([s3, s3, s3]);
  });

  it('uses the .form-group wrapper as the box of a field and never a box with another control', () => {
    for (const b of [...fieldsOf(page), ...decisionsOf(page)]) {
      expect(boxHoldsOnlyItsControl(page, b.id)).toEqual({ ok: true, why: '' });
    }
    const fullName = fieldsOf(page)[0]!;
    expect(page.boxes.get(fullName.id)?.classList.contains('form-group')).toBe(true);
    const marketing = decisionsOf(page)[0]!;
    expect(page.boxes.get(marketing.id)?.classList.contains('form-check')).toBe(true);
  });

  it('does not turn labels, legends, help texts or the radio-group caption into text blocks', () => {
    const texts = byKind(page, 'text').map((t) => t.text);
    expect(texts.some((t) => t.startsWith('Your details') || t.startsWith('Your address'))).toBe(false);
    expect(texts.some((t) => t.includes('Preferred contact method'))).toBe(false);
    expect(texts.some((t) => t.includes('We will only use this'))).toBe(false);
    expect(texts.some((t) => t.includes('Include the area code'))).toBe(false);
    expect(texts.some((t) => t === 'Full name')).toBe(false);
  });

  it('keeps the navbar as the primary site menu and the lead paragraph as primary text', () => {
    const menu = navsOf(page).find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(expect.arrayContaining(['Home', 'Parking', 'Permits', 'Pay a fine', 'Contact']));
    expect(menu.region).toBe('header');
    expect(byKind(page, 'heading')[0]).toMatchObject({ level: 1, text: 'Register for the resident parking permit scheme' });
    const lead = findBlock(page, 'Residents of the permit zones')!;
    expect(lead.kind).toBe('text');
    expect(lead.importance).toBe('primary');
    const footer = findBlock(page, 'City of Elm.')!;
    expect(footer.region).toBe('footer');
    expect(footer.importance).toBe('secondary');
  });
});
