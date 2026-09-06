// An Elementor (WordPress) page: every element carries `elementor-widget*` classes, the form is
// an `elementor-form` with `elementor-field-group` wrappers, an acceptance checkbox whose label
// links to the privacy policy, a semantic header/main/aside/footer, and a fixed back-to-top link.
// Review findings [1] ('widget' must not float or sidebar anything inside main), [18] (agree +
// policy link is an attestation), [45] (header/promo class rules), [53] (rootOf).
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, boxHoldsOnlyItsControl, byKind, deadlinesOf, decisionsOf, fieldsOf, findBlock, loadFixture, navsOf } from './helpers.ts';

describe('elementor.html', () => {
  const doc = loadFixture('elementor.html');
  const page = extractPage(doc);
  const { blocks, meta } = page.content;

  it('validates and finds the semantic landmarks, none of them inside main', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.lang).toBe('en');
    expect(page.main).toBe(doc.querySelector('main'));
    expect(page.regions.get('header')).toBe(doc.querySelector('header'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('footer'));
    expect(page.regions.get('sidebar')).toBe(doc.querySelector('aside'));
    for (const [name, root] of page.regions) {
      if (name !== 'main') expect(page.main.contains(root), `${name} root must not sit inside main`).toBe(false);
    }
    expect(page.form).toBe(doc.querySelector('form.elementor-form'));
  });

  it('keeps the h1 primary, the paragraphs primary text and finds the deadline', () => {
    expect(byKind(page, 'heading').filter((h) => h.region === undefined)).toEqual([
      expect.objectContaining({ text: 'Apply for the 2026 community grant', level: 1, importance: 'primary' }),
    ]);
    const paragraphs = byKind(page, 'text').filter((t) => t.region === undefined);
    expect(paragraphs.map((t) => blockText(t).slice(0, 19))).toEqual(['The community grant', 'Decisions are sent ']);
    expect(paragraphs.every((t) => t.importance === 'primary')).toBe(true);
    expect(findBlock(page, 'Before you start')?.kind).toBe('instruction');
    const deadlines = deadlinesOf(page);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({ date: '2026-06-30', importance: 'critical' });
    expect(deadlines[0]!.region).toBeUndefined();
    expect(blocks.filter((b) => b.kind === 'notice')).toHaveLength(0);
  });

  it('reads the four fields with labels, types and required flags from the field groups', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => [f.label, f.input, f.required])).toEqual([
      ['Your name', 'text', true],
      ['Email', 'email', true],
      ['Project area', 'select', false],
      ['Tell us about the project', 'text', false],
    ]);
    expect(fields[2]!.options).toEqual(['Shared spaces', 'Young people', 'Events']);
    for (const f of fields) expect(boxHoldsOnlyItsControl(page, f.id)).toEqual({ ok: true, why: '' });
    expect(page.boxes.get(fields[0]!.id)?.classList.contains('elementor-field-group')).toBe(true);
  });

  it('reads the acceptance checkbox as a required attestation and the updates checkbox as pre-checked optional', () => {
    const [terms, updates, ...rest] = decisionsOf(page);
    expect(rest).toHaveLength(0);
    expect(terms).toMatchObject({ label: 'I have read and agree to the privacy policy', optional: false, preChecked: false, importance: 'critical' });
    expect(updates).toMatchObject({ label: 'Send me updates about future grant rounds', optional: true, preChecked: true, importance: 'primary' });
  });

  it('reads the submit button as the critical primary action and the back-to-top link as decorative', () => {
    const actions = actionsOf(page);
    const send = actions.find((a) => a.label === 'Send application')!;
    expect(send).toMatchObject({ primary: true, importance: 'critical' });
    const top = actions.find((a) => /back to top/i.test(a.label))!;
    expect(top).toMatchObject({ primary: false, importance: 'decorative' });
    expect(top.region).toBeUndefined();
    expect(actions).toHaveLength(2);
  });

  it('makes one step titled by the h1 and groups every control and the submit into it', () => {
    expect(meta.stepOrder).toEqual([{ id: 's-1', title: 'Apply for the 2026 community grant' }]);
    for (const b of [...fieldsOf(page), ...decisionsOf(page)]) expect(b.group).toBe('s-1');
    expect(actionsOf(page).find((a) => a.primary)?.group).toBe('s-1');
  });

  it('keeps the site menu primary, the sidebar list and title secondary, the footer line secondary', () => {
    const menu = navsOf(page).find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(['Home', 'Grants', 'Apply', 'News', 'About', 'Contact']);
    expect(menu.region).toBe('header');
    const side = navsOf(page).find((n) => n.region === 'sidebar')!;
    expect(side.items).toHaveLength(3);
    expect(side.importance).toBe('secondary');
    expect(findBlock(page, 'Recent news')).toMatchObject({ kind: 'heading', importance: 'secondary', region: 'sidebar' });
    expect(findBlock(page, 'registered charity')).toMatchObject({ kind: 'text', importance: 'secondary', region: 'footer' });
  });

  it('exposes rootOf: the region root element of every block that sits in a root or in main', () => {
    expect(page.rootOf).toBeDefined();
    for (const b of blocks) {
      const root = page.rootOf!.get(b.id);
      const node = page.nodes.get(b.id)!;
      if (b.region === undefined && b.kind !== 'action') expect(root, `${b.id} main`).toBe(page.main);
      if (root) expect(root.contains(node), `${b.id} root contains node`).toBe(true);
    }
    const menu = navsOf(page).find((n) => n.importance === 'primary')!;
    expect(page.rootOf!.get(menu.id)).toBe(doc.querySelector('header'));
    const side = navsOf(page).find((n) => n.region === 'sidebar')!;
    expect(page.rootOf!.get(side.id)).toBe(doc.querySelector('aside'));
  });
});
