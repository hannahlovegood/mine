// A page with a cookie banner, a floating chat button (position: fixed), an ad block, an app
// promo, a hero image, and a normal article.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, byKind, findBlock, imagesOf, loadFixture, navsOf } from './helpers.ts';

describe('widgets.html', () => {
  const doc = loadFixture('widgets.html');
  const page = extractPage(doc);
  const { blocks } = page.content;

  it('validates and finds the landmarks', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.main).toBe(doc.querySelector('main'));
    expect(page.regions.get('header')).toBe(doc.querySelector('header'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('footer'));
    expect(page.form).toBeUndefined();
  });

  it('sets the cookie banner aside as one decorative notice, buttons included', () => {
    const cookie = findBlock(page, 'cookies')!;
    expect(cookie.kind).toBe('notice');
    expect(cookie.importance).toBe('decorative');
    expect(cookie.region).toBeUndefined();
    expect(page.boxes.get(cookie.id)).toBe(doc.querySelector('.cookie-banner'));
    expect(actionsOf(page).some((a) => /accept|reject/i.test(a.label))).toBe(false);
  });

  it('reads the floating chat button as a decorative, non-primary action without region', () => {
    const chat = actionsOf(page).find((a) => a.label === 'Chat with us')!;
    expect(chat).toMatchObject({ primary: false, importance: 'decorative' });
    expect(chat.region).toBeUndefined();
    expect(chat.group).toBeUndefined();
    expect(actionsOf(page)).toHaveLength(1);
  });

  it('reads the ad block and the app promo as decorative promos', () => {
    const ad = findBlock(page, 'Sponsored')!;
    expect(ad.kind).toBe('promo');
    expect(ad.importance).toBe('decorative');
    expect(page.boxes.get(ad.id)).toBe(doc.querySelector('.ad-slot'));
    const app = findBlock(page, 'Download the app')!;
    expect(app.kind).toBe('promo');
    expect(app.importance).toBe('decorative');
  });

  it('keeps the hero and the logo decorative but the figure informative', () => {
    const images = imagesOf(page);
    expect(images.map((i) => [i.src.split('/').pop(), i.decorative, i.importance, i.region])).toEqual([
      ['logo.svg', true, 'decorative', 'header'],
      ['hero-rowhouses.svg', true, 'decorative', undefined],
      ['documents-checklist.svg', false, 'primary', undefined],
    ]);
    expect(images[1]!.alt).toBe('The reading room at the central library');
    expect(images[2]!.alt).toBe('What to bring: your current card and one proof of address');
    expect(page.boxes.get(images[2]!.id)?.localName).toBe('figure');
    expect(page.nodes.get(images[2]!.id)?.localName).toBe('img');
  });

  it('keeps the article itself: site menu, h1, two primary paragraphs, footer line', () => {
    const menu = navsOf(page)[0]!;
    expect(menu.items).toEqual(['Catalogue', 'Events', 'Join', 'Renew', 'Branches', 'Help']);
    expect(menu.importance).toBe('primary');
    expect(byKind(page, 'heading')).toEqual([expect.objectContaining({ text: 'How to renew a library card', level: 1 })]);
    const paragraphs = byKind(page, 'text').filter((t) => t.region === undefined);
    expect(paragraphs.map((t) => blockText(t).slice(0, 12))).toEqual(['Library card', 'Bring your c']);
    expect(paragraphs.every((t) => t.importance === 'primary')).toBe(true);
    const footer = findBlock(page, 'Elm City Council')!;
    expect(footer.region).toBe('footer');
    expect(footer.importance).toBe('secondary');
    expect(blocks.filter((b) => b.importance === 'decorative').length).toBeGreaterThanOrEqual(5);
    expect(blocks.map((b) => b.kind)).toEqual(['image', 'nav', 'image', 'promo', 'heading', 'text', 'promo', 'image', 'text', 'text', 'notice', 'action']);
  });
});
