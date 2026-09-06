import { describe, expect, it } from 'vitest';
import { transform } from '../src/engine/transform.ts';
import { DEFAULT_PREFERENCES } from '../src/engine/presets.ts';
import { fallback } from '../src/engine/fallback.ts';
import { fixture } from './fixture.ts';

describe('images on request', () => {
  it('"no images" sets aside informative images too; "quieter" keeps them', () => {
    const all = transform(fixture, { ...DEFAULT_PREFERENCES, showDecorativeMedia: false, hideAllImages: true });
    const some = transform(fixture, { ...DEFAULT_PREFERENCES, showDecorativeMedia: false });
    const images = fixture.blocks.filter((b) => b.kind === 'image');
    const hiddenIn = (tr: ReturnType<typeof transform>) => new Set(tr.changes.filter((c) => c.type === 'hidden').flatMap((c) => c.blockIds));
    expect(images.every((b) => hiddenIn(all).has(b.id))).toBe(true);
    expect(images.filter((b) => b.kind === 'image' && !b.decorative).some((b) => hiddenIn(some).has(b.id))).toBe(false);
    expect(all.changes[0]?.reason).toMatch(/at your request|按你的要求/);
  });
  it('the fallback reads 去除图片 / remove the images as all images, and keep-images undoes it', () => {
    expect(fallback('去除图片', 'zh').preferences.hideAllImages).toBe(true);
    expect(fallback('remove the images please', 'en').preferences.hideAllImages).toBe(true);
    expect(fallback('quieter', 'en').preferences.hideAllImages).toBeUndefined();
    expect(fallback('keep the images', 'en').preferences.hideAllImages).toBeUndefined();
  });
});
