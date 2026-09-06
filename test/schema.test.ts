import { describe, expect, it } from 'vitest';
import { MinePreferencesSchema, PageContentSchema } from '../src/engine/schema';
import { DEFAULT_PREFERENCES, PRESETS, PRESET_IDS, isDefault } from '../src/engine/presets';

describe('schema mirrors', () => {
  it('every preset validates against MinePreferencesSchema', () => {
    for (const id of PRESET_IDS) {
      expect(MinePreferencesSchema.safeParse(PRESETS[id]).success, id).toBe(true);
    }
  });
  it('only Default is default', () => {
    expect(isDefault(DEFAULT_PREFERENCES)).toBe(true);
    expect(isDefault(PRESETS.focus)).toBe(false);
  });
  it('rejects a fontScale outside the four stops', () => {
    expect(MinePreferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, fontScale: 2 }).success).toBe(false);
  });
  it('PageContentSchema rejects duplicate ids, unknown groups and ungrouped fields', () => {
    const meta = { title: 'x', lang: 'en', stepOrder: [{ id: 'start', title: 'Start' }] };
    const text = { id: 'a', kind: 'text', importance: 'primary', text: 'hi', complexity: 'simple' };
    expect(PageContentSchema.safeParse({ meta, blocks: [text] }).success).toBe(true);
    expect(PageContentSchema.safeParse({ meta, blocks: [text, text] }).success).toBe(false);
    const field = { id: 'f', kind: 'field', importance: 'critical', label: 'Name', input: 'text', required: true };
    expect(PageContentSchema.safeParse({ meta, blocks: [field] }).success).toBe(false);
    expect(PageContentSchema.safeParse({ meta, blocks: [{ ...field, group: 'nope' }] }).success).toBe(false);
    expect(PageContentSchema.safeParse({ meta, blocks: [{ ...field, group: 'start' }] }).success).toBe(true);
  });
});
