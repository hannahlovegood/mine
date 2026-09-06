import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '../src/engine/schema.ts';
import { fixture } from './fixture.ts';
import { runInvariants } from './invariants.ts';

describe('fixture', () => {
  it('validates against PageContentSchema', () => {
    const r = PageContentSchema.safeParse(fixture);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
  });
});

runInvariants('fixture (housing grant)', fixture);
