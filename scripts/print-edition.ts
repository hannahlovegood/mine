// Prints the fixture's edition for a preset, so a human can judge whether the
// reasons read coherently:
//   npx tsx scripts/print-edition.ts focus        (default | focus | plain | large)
//   npx tsx scripts/print-edition.ts focus zh     same page, reasons written in Chinese
import { PRESETS, PRESET_IDS, type PresetId } from '../src/engine/presets.ts';
import type { PageContent } from '../src/engine/schema.ts';
import { transform, type ViewBlock } from '../src/engine/transform.ts';
import { fixture } from '../test/fixture.ts';

const arg = (process.argv[2] ?? 'focus').toLowerCase();
const isPreset = (s: string): s is PresetId => (PRESET_IDS as string[]).includes(s);
if (!isPreset(arg)) {
  console.error(`Unknown preset "${arg}". Use one of: ${PRESET_IDS.join(', ')}.`);
  process.exit(1);
}
const lang = process.argv[3] === 'zh' ? 'zh' : fixture.meta.lang;
const content: PageContent = { ...fixture, meta: { ...fixture.meta, lang } };

const t = transform(content, PRESETS[arg]);
const line = (b: ViewBlock): string =>
  `${b.id} · ${b.kind} · ${b.state}${b.stubFor ? ` · restores ${b.stubFor.join(', ')}` : ''}`;

console.log(`Edition: ${arg} — ${content.meta.title} (${lang})\n`);
console.log(t.steps ? 'Frame (blocks without a group)' : 'View');
for (const b of t.view) console.log(`  ${line(b)}`);

if (t.steps) {
  console.log('\nSteps');
  t.steps.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.title}${s.choice ? ' (choice)' : ''} [${s.id}]`);
    for (const b of s.blocks) console.log(`     ${line(b)}`);
  });
}

const d = t.decisions;
console.log(
  `\nDecisions: ${d.count} (${d.optional.length} optional, ${d.required.length} required, ${d.preChecked.length} pre-checked)`,
);

console.log(`\nChanges (${t.changes.length})`);
for (const c of t.changes) {
  const count = c.count !== undefined ? ` (count ${c.count})` : '';
  console.log(`  ${c.type.padEnd(9)} ${c.blockIds.join(', ')}${count}`);
  console.log(`            ${c.reason}`);
}

console.log(
  `\nSummary: ${Object.entries(t.summary)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')}`,
);
