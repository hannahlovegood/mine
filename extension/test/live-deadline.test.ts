import { describe, expect, it } from 'vitest';
import { extractPage } from '../src/extract/index.ts';
import { isLiveDeadline } from '../src/extract/kinds.ts';

const NOW = Date.parse('2026-09-06T00:00:00Z');
const page = (html: string) => {
  document.body.innerHTML = html;
  return extractPage(document, { lang: 'en', now: NOW });
};

describe('a dated sentence is a deadline only when it is live', () => {
  it('window: 30 days past to 3 years ahead', () => {
    expect(isLiveDeadline('2026-10-23', NOW)).toBe(true);
    expect(isLiveDeadline('2026-08-20', NOW)).toBe(true);
    expect(isLiveDeadline('2026-07-01', NOW)).toBe(false);
    expect(isLiveDeadline('2019-05-28', NOW)).toBe(false);
    expect(isLiveDeadline('2030-01-01', NOW)).toBe(false);
    expect(isLiveDeadline('nonsense', NOW)).toBe(false);
  });
  it('a historical date in an article stays text; an upcoming one is a critical deadline', () => {
    const p = page(`<main><h1>Accessibility</h1>
      <p>The directive set a deadline of 28 May 2019 for public bodies to comply with the rules on websites.</p>
      <p>Applications must be received by 23 October 2026 to be considered.</p></main>`);
    const kinds = p.content.blocks.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'deadline')).toHaveLength(1);
    const dl = p.content.blocks.find((b) => b.kind === 'deadline');
    expect(dl && 'date' in dl ? dl.date : null).toBe('2026-10-23');
  });
});
