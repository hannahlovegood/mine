# Engine contract — decisions that CLAUDE.md §6 leaves open

Read with CLAUDE.md §4–§7. This file makes the engine's outputs precise enough that the
engine (T02), the content (T03) and the UI (T04/T05) can be built in parallel.
Anything here that contradicts CLAUDE.md is a mistake in this file; CLAUDE.md wins.

## Files (all pure TypeScript, no React, imports use explicit `.ts` extensions)

```
src/engine/schema.ts     FROZEN (T01)
src/engine/presets.ts    DEFAULT_PREFERENCES, PRESETS, isDefault (T01)
src/engine/transform.ts  transform(content, prefs) → Transformation  + the exported types below
src/engine/steps.ts      buildSteps(...)  — rule 9
src/engine/changes.ts    change recorder + summarize(changes) → Summary
src/engine/reasons.ts    every reason string, EN + ZH, keyed; reasons are written in content.meta.lang
src/engine/fallback.ts   fallback(text, lang) → { preferences, reasons }  — §7 table
```

## Types (exported from transform.ts)

```ts
export type ViewState = 'shown' | 'collapsed' | 'moved' | 'rewritten' | 'annotated' | 'enlarged'
// 'annotated' = a legal block or a decision whose plain summary/label is shown BESIDE the
//               original (text never replaced). Added to the §6 union; noted in DECISIONS.md.
export type ViewBlock = ContentBlock & {
  state: ViewState
  stubFor?: string[]   // a stub: ids of set-aside blocks it can restore
  original?: string    // the original text/help when state === 'rewritten'
}
export interface Step { id: string; title: string; blocks: ViewBlock[]; choice?: boolean }
export interface DecisionSummary { count: number; optional: DecisionBlock[]; required: DecisionBlock[]; preChecked: DecisionBlock[] }
export type ChangeType = 'hidden' | 'collapsed' | 'moved' | 'rewritten' | 'explained' | 'enlarged' | 'stepped' | 'surfaced'
export interface Change { type: ChangeType; blockIds: string[]; reason: string; count?: number }
// summary[type] = Σ over changes of that type of (change.count ?? change.blockIds.length)
export interface Summary { hidden: number; collapsed: number; moved: number; rewritten: number; explained: number; enlarged: number; steps: number; surfaced: number }
export interface Transformation { view: ViewBlock[]; steps?: Step[]; decisions: DecisionSummary; changes: Change[]; summary: Summary }
```

## Stubs

- A stub is a synthetic ViewBlock: `{ id: 'stub-<region>', kind: 'text', importance: 'secondary', region, text: '', complexity: 'simple', state: 'collapsed', stubFor: [ids…] }`.
  The UI renders it from copy (`stub` / `stub.one`), never from `text`.
- Blocks without `region` belong to region `main`. One stub per region per transformation, placed where the first set-aside block of that region was.
- Restoring is a UI concern: the UI keeps a set of restored ids and renders the original blocks (looked up in `content.blocks`) beneath the stub. The engine never needs to know.

## Rules, made precise (apply in this order; record changes in this order)

1. **Media.** `!showDecorativeMedia` → every `image` with `decorative: true` is set aside → change `hidden`. Informative images stay.
2. **Density.** `minimal` → set aside every `decorative` and `secondary` block (except `nav` blocks handled by rule 3 — see below) → `hidden`, one stub per region. `comfortable` → set aside `decorative` (→ `hidden`, stubbed); `secondary` blocks stay in place individually with `state: 'collapsed'` → one `collapsed` change listing them (the UI shows each as a one-line expandable stub). `full` → nothing.
   Rule 3 applies only to the site menu: `nav` blocks whose importance is `primary` or `critical`. A `nav` block with importance `secondary` (e.g. a sidebar of related links) is an ordinary secondary block for rule 2.
   Critical blocks are never hidden or collapsed by any rule.
3. **Navigation.** `reduced` → the menu nav stays in place with `state: 'collapsed'` → change `collapsed` (UI shows "Menu (n)"). `hidden` → set aside, stub `stub-nav` with `stubFor: [nav.id]` → change `hidden`.
4. **Deadline.** `!isDefault(prefs)` → every `deadline` block moves to just after the first `heading` with `level: 1` (or to index 0), `state: 'moved'` → one `moved` change. In one-at-a-time mode the deadline is the first block of the `start` step, still `state: 'moved'`, still recorded as `moved`.
5. **Reading level.** `plain` → text blocks (kinds heading/text/notice/instruction/faq/promo) with `plainText`: `text = plainText`, `original = text`, `state: 'rewritten'`. `legal` blocks: text unchanged, `state: 'annotated'` (UI shows the plain summary beside). `field` with `plainHelp`: `help = plainHelp`, `original = help`, `state: 'rewritten'`. `decision` with `plainLabel`: unchanged label, `state: 'annotated'`. `deadline` with `plainText`: rewritten like text. Record ONE `rewritten` change per affected block (blockIds: [id]); the reason says whether it was replaced or shown beside.
6. **Terms.** `explainTerms` → for each text block with `terms` (length ≥ 1) record one `explained` change `{ blockIds: [id], count: terms.length }`. Blocks are otherwise untouched (the UI reads `terms` from the ViewBlock).
7. **Scale and contrast.** No block changes. If `fontScale >= 1.35`: every shown `field` and `action` block gets `state: 'enlarged'` (unless already rewritten/moved — then keep the more informative state but still list it) → one `enlarged` change listing them all.
8. **Decisions.** `DecisionSummary` always. When `surfaceDecisions`: one `surfaced` change per optional decision; reason includes the pre-checked note when `preChecked`. (Required decisions are shown in the card but are not "surfaced changes".)
9. **Steps.** `one-at-a-time` → `steps` built from `meta.stepOrder` in order. Every non-hidden block with a `group` goes to its step (original order inside the step). Each optional decision leaves its group and becomes its own step `{ id: 'choice-<id>', title: <copy step.choice in lang>, choice: true }` inserted immediately BEFORE its group's step. Non-primary `action` blocks (wherever they are) are moved to the end of the last non-choice step with `state: 'collapsed'` (UI shows them under "Other options"). Empty steps are dropped. Record one `stepped` change per non-choice step: `{ blockIds: <ids in that step>, count: 1 }`, so `summary.steps` = number of steps and the pitch line "12 fields in 5 steps" holds; the choice step is accounted for by its `surfaced` change. In this mode `view` holds the frame: every shown block WITHOUT a group (heading, nav, stubs, ungrouped text) in original order; everything grouped is in `steps`.

## Invariants (test/invariants.ts exports `runInvariants(name, content)`; invariants.test.ts runs it on the fixture)

I1–I8 as in CLAUDE.md §6. "Present" for I1 means: the id appears in `view`, in some step, or in a stub's `stubFor` is NOT enough — critical blocks must be rendered, so they must appear in `view` or a step with a state other than hidden. For I2/I5 count occurrences across `view` and all steps. I3 compares `original` vs the rewritten text with `/\d+/g`. Random combinations: seeded PRNG over every field of MinePreferences.

## Fallback (§7)

`fallback(text, lang)` lowercases, tests each phrase group in table order, applies the sets, and returns `{ preferences, reasons }` with one reason per matched group, formatted `"<matched phrase>" → <effect>` in the same language (effect strings live in reasons.ts). "much"/"很"/"非常" near a bigger-text phrase → fontScale 1.6. Later groups override earlier ones on the same key (so "no images" after "keep the images" wins). No match → Default preferences and a single reason saying nothing in the text matched a setting.
