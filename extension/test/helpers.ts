// Shared helpers for the extractor tests (vitest + happy-dom).
//
// Fixtures are parsed with DOMParser into their own Document so that `<html lang>` and
// `<title>` survive (setting `documentElement.innerHTML` on the global document drops the
// html attributes). happy-dom gives the parsed document a `defaultView` with a working
// `getComputedStyle`, so stylesheet rules inside the fixtures are visible to the extractor.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ActionBlock,
  ContentBlock,
  DeadlineBlock,
  DecisionBlock,
  FieldBlock,
  ImageBlock,
  Kind,
  NavBlock,
  TextBlock,
} from '@engine/schema.ts';
import type { ExtractedPage } from '../src/extract/index.ts';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function loadFixture(name: string): Document {
  return parseHtml(readFileSync(resolve(FIXTURES, name), 'utf8'));
}

/** The block types whose `kind` union includes K (TextBlock for 'heading', FieldBlock for 'field'…). */
type WithKind<B, K> = B extends { kind: infer BK } ? (K extends BK ? B : never) : never;
export type BlockOfKind<K extends Kind> = WithKind<ContentBlock, K>;

export function byKind<K extends Kind>(page: ExtractedPage, kind: K): BlockOfKind<K>[] {
  return page.content.blocks.filter((b): b is BlockOfKind<K> => b.kind === kind);
}

export const fieldsOf = (page: ExtractedPage): FieldBlock[] => byKind(page, 'field');
export const decisionsOf = (page: ExtractedPage): DecisionBlock[] => byKind(page, 'decision');
export const actionsOf = (page: ExtractedPage): ActionBlock[] => byKind(page, 'action');
export const navsOf = (page: ExtractedPage): NavBlock[] => byKind(page, 'nav');
export const imagesOf = (page: ExtractedPage): ImageBlock[] => byKind(page, 'image');
export const deadlinesOf = (page: ExtractedPage): DeadlineBlock[] => byKind(page, 'deadline');

export function textBlocks(page: ExtractedPage): TextBlock[] {
  return page.content.blocks.filter(
    (b): b is TextBlock =>
      b.kind === 'heading' ||
      b.kind === 'text' ||
      b.kind === 'legal' ||
      b.kind === 'notice' ||
      b.kind === 'instruction' ||
      b.kind === 'faq' ||
      b.kind === 'promo',
  );
}

/** The block whose text/label/items contain `needle` (first match in document order). */
export function findBlock(page: ExtractedPage, needle: string): ContentBlock | undefined {
  return page.content.blocks.find((b) => blockText(b).includes(needle));
}

export function blockText(b: ContentBlock): string {
  switch (b.kind) {
    case 'nav':
      return b.items.join(' | ');
    case 'field':
    case 'decision':
    case 'action':
      return b.label;
    case 'image':
      return b.alt || b.src;
    default:
      return b.text;
  }
}

/** Form controls that count as "other controls" for the box rule (buttons are not controls). */
export function controlsIn(el: Element): Element[] {
  return Array.from(el.querySelectorAll('input,select,textarea')).filter(
    (c) => (c.getAttribute('type') ?? '').toLowerCase() !== 'hidden',
  );
}

/** Asserts the box rule for one block: the box holds the node and no other control. */
export function boxHoldsOnlyItsControl(page: ExtractedPage, id: string): { ok: boolean; why: string } {
  const node = page.nodes.get(id);
  const box = page.boxes.get(id);
  if (!node || !box) return { ok: false, why: `${id}: missing node or box` };
  if (!box.contains(node)) return { ok: false, why: `${id}: box does not contain node` };
  const groupName = node.getAttribute('type') === 'radio' ? node.getAttribute('name') : null;
  const others = controlsIn(box).filter((c) => {
    if (c === node) return false;
    if (groupName && c.getAttribute('type') === 'radio' && c.getAttribute('name') === groupName) return false;
    return true;
  });
  return others.length === 0
    ? { ok: true, why: '' }
    : { ok: false, why: `${id}: box also contains ${others.map((o) => o.outerHTML.slice(0, 60)).join(', ')}` };
}
