import { describe, expect, it } from 'vitest';
import { handlePlain, rewriteBlocks, translatePrompt, validateRewrite } from '../server/plain.ts';

const EN = 'Applications must be received by 11:59 p.m. on Friday, October 23, 2026. Late submissions will not be considered.';
const ZH = '申请必须在2026年10月23日星期五晚上11:59前送达。逾期提交的申请不予受理。';

describe('translated edition on the server', () => {
  it('accepts a translation three times longer or shorter than the original, still digit-exact', () => {
    const block = { id: 'b-1', text: ZH, kind: 'deadline' as const };
    expect(validateRewrite(block, { id: 'b-1', plainText: EN, terms: [] }, { translateTo: 'en' })?.plainText).toBe(EN);
    // the same length ratio is rejected by the plain-language window
    expect(validateRewrite(block, { id: 'b-1', plainText: EN, terms: [] })).toBeNull();
    // a changed digit is dropped in both modes
    expect(validateRewrite(block, { id: 'b-1', plainText: EN.replace('2026', '2027'), terms: [] }, { translateTo: 'en' })).toBeNull();
  });
  it('rewriteBlocks sends the translation prompt and the target', async () => {
    let system = '';
    let user = '';
    const r = await rewriteBlocks([{ id: 'b-1', text: ZH, kind: 'deadline' }], 'zh', async (messages) => {
      system = messages[0]?.content ?? '';
      user = messages[1]?.content ?? '';
      return JSON.stringify({ rewrites: [{ id: 'b-1', plainText: EN, terms: [] }] });
    }, 5000, { translateTo: 'en' });
    expect(system).toBe(translatePrompt('en'));
    expect(JSON.parse(user).translateTo).toBe('en');
    expect(r.rewrites[0]?.plainText).toBe(EN);
  });
  it('handlePlain threads translateTo through the request', async () => {
    const r = await handlePlain(JSON.stringify({ lang: 'zh', translateTo: 'en', blocks: [{ id: 'b-1', text: ZH, kind: 'text' }] }), {});
    expect(r.status).toBe(503); // no key configured: the shape is accepted, the model is not there
    const bad = await handlePlain(JSON.stringify({ lang: 'zh', translateTo: 'nope!', blocks: [{ id: 'b-1', text: ZH, kind: 'text' }] }), {});
    expect(bad.status).toBe(400);
  });
});
