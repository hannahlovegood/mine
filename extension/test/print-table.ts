// Dev utility (not a test): prints what the extractor recovers from a fixture, one block per
// line, so a human can judge it.
//
//   cd extension && ../node_modules/.bin/tsx test/print-table.ts [fixture]   (default portal-en.html)
//
// Columns: id · kind · importance · region · group · first 40 chars of text/label/items.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { extractPage } from '../src/extract/index.ts';

const name = process.argv[2] ?? 'portal-en.html';
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8');
const win = new Window();
const doc = new win.DOMParser().parseFromString(html, 'text/html') as unknown as Document;
const page = extractPage(doc);

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const clip = (s: string): string => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

const rows = page.content.blocks.map((b) => {
  const text =
    b.kind === 'nav' ? `[${b.items.length}] ${b.items.join(' · ')}`
    : b.kind === 'field' ? `${b.label}${b.required ? ' *' : ''} <${b.input}>`
    : b.kind === 'decision' ? `${b.preChecked ? '[x]' : '[ ]'} ${b.optional ? 'optional' : 'required'} ${b.label}`
    : b.kind === 'action' ? `${b.primary ? '(primary) ' : ''}${b.label}`
    : b.kind === 'image' ? `${b.decorative ? 'decorative' : 'informative'} ${b.alt || b.src}`
    : b.kind === 'deadline' ? `${b.date} ${b.text}`
    : `${b.kind === 'heading' ? `h${b.level} ` : ''}${b.text}`;
  return [b.id, b.kind, b.importance, b.region ?? '-', b.group ?? '-', clip(text)];
});

console.log(`${name}: ${page.content.blocks.length} blocks · lang ${page.lang} · title "${page.content.meta.title}"`);
console.log(`steps: ${page.content.meta.stepOrder.map((s) => `${s.id} "${s.title}"`).join(' · ')}`);
console.log(`regions: ${Array.from(page.regions.keys()).join(', ')} · main <${page.main.localName}${page.main.className ? '.' + String(page.main.className).split(' ')[0] : ''}> · form ${page.form ? `<${page.form.localName}${page.form.className ? '.' + String(page.form.className).split(' ')[0] : ''}>` : '-'}`);
console.log('');
console.log(`${pad('id', 5)} ${pad('kind', 12)} ${pad('importance', 11)} ${pad('region', 8)} ${pad('group', 6)} text`);
for (const r of rows) console.log(`${pad(r[0]!, 5)} ${pad(r[1]!, 12)} ${pad(r[2]!, 11)} ${pad(r[3]!, 8)} ${pad(r[4]!, 6)} ${r[5]}`);
