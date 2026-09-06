# TASKS.md — Mine hackathon

One task = one Claude Code session. Each task lists inputs, outputs, acceptance criteria and a time box. Read `CLAUDE.md` first in every session. Commit small and often; branch per task if two sessions run at once.

Human checkpoints (Ningtiao, not Claude):
- **C1 Schema freeze** — after T01, 15 minutes: read `schema.ts` once; after this, schema changes need a `DECISIONS.md` line and a test update.
- **C2 Content review** — after T03, 30 minutes: does the portal feel real? Is the deadline believably buried? Would you sign that consent without noticing? Are the plain rewrites true to the original?
- **C3 Feature freeze** — at T-12 h (48 h budget) or T-6 h (24 h budget): no new features after this; only fixes, rehearsal and stretch items already started.

## Dependency graph

```
T01 ─┬─ T02 (engine + tests) ──┐
     └─ T03 (content) ─────────┴─ T04 (renderer + morph) ─┬─ T05 (colophon, decisions, steps)
                                                          └─ T06 (My words API + fallback)
                                                                 └─ T07 (landing, ending, a11y) ─ T08 (ship, demo mode, rehearse)
```

T02 ∥ T03 and T05 ∥ T06 can run as parallel sessions; they touch disjoint files (`src/engine/*` vs `src/content/*`; `src/ui/Colophon|DecisionsCard|Stepper` vs `api/interpret.ts` + `src/ui/WordsComposer`).

---

## T01 — Scaffold and schema freeze · 2 h · blocks everything

Inputs: `CLAUDE.md` §3–§5.
Outputs: Vite + React + TS + Tailwind + `motion` + `zod` + `vitest` + eslint; folder structure; `schema.ts` with all types **and** Zod schemas; `presets.ts`; `copy.ts` skeleton with the §10 table; `api/interpret.ts` stub that returns the fallback; `tokens.css`; a hello-world deployed to Vercel in the first hour (prove the pipeline before there is anything to lose).
Accept: `npm run build`, `lint`, `typecheck` pass · Vercel URL live · `schema.ts` carries a `// FROZEN after T01` header · C1 done.

## T02 — Engine and invariants · 4 h · parallel with T03

Inputs: §4–§6. Use a small fixture (`test/fixture.ts`, ~15 blocks) so this task does not wait on T03.
Outputs: `transform.ts`, `steps.ts`, `changes.ts`, `fallback.ts`; `invariants.test.ts` implementing I1–I8; `fallback.test.ts` covering every phrase group in EN and ZH.
Accept: `npm test` green · pure functions, no React imports · summary derived only from `changes` · running the presets on the fixture prints coherent reasons.

## T03 — The page you were given · 3 h · parallel with T02

Inputs: §4 authoring rules; `[DEMO_LANG]`.
Outputs: `demo-content.[lang].ts` + `content.meta.ts`; `scripts/plain.ts` that drafts `plainText`, `plainHelp`, `plainLabel` and glossary entries with the model once, written to a file the human edits; `content.test.ts` (validates schema; asserts the counts below).
Accept: ≥ 40 blocks · 12 fields (≥ 8 required) · exactly 2 decisions (1 optional pre-checked, 1 required) · 1 deadline positioned after at least 3 text blocks · ≥ 8 secondary/decorative blocks (so Focus sets aside ≥ 8) · ≥ 6 `complex` passages with `plainText` · ≥ 8 terms · I3 (digits preserved) passes on real content · C2 done.

## T04 — Edition renderer, presets, morph · 6 h · after T02 + T03

Inputs: §5, §8 morph notes, §9 tokens and type.
Outputs: `PortalPage` (portal styling, realistic), `EditionPage` (edition styling; renders `view` or `steps`), `ModeStrip`, the `LayoutGroup` morph with `AnimatePresence`, reduced-motion path, `fontScale`/`contrast` CSS variables, `HoldToCompare`, `Back to original`.
Accept: all five modes visibly distinct · the morph completes in under 1 s without layout jank on a laptop · the two-phase fallback exists if `layoutId` was abandoned (note it in `DECISIONS.md`) · everything keyboard-operable · the morph budget (2 h) was respected.

## T05 — Colophon, decisions card, stepper · 3 h · parallel with T06

Inputs: §6 `Transformation`, §10 copy.
Outputs: `Colophon` (animated counts from `summary`, expandable per-change list with reasons, "Show" for every set-aside group, "Show original" for rewrites, `Why` section for My words reasons + source badge), `DecisionsCard` (count, optional/required labels, pre-checked note), `Stepper` (progress text, one step at a time, "A choice" steps, "Other options" link), stubs for collapsed content.
Accept: counts match test expectations for every preset · every set-aside or rewritten item is restorable from the UI · `aria-live` announces the summary sentence · the pre-checked box is displayed as pre-checked, never flipped.

## T06 — My words · 3 h · parallel with T05

Inputs: §7.
Outputs: `api/interpret.ts` (OpenAI-compatible call through `LLM_*` env, JSON mode where supported, temperature 0, 8 s abort, retry once, Zod, fallback with `source`), `WordsComposer` (textarea, chips, Transform, working state, reasons, source badge, `localStorage` for the last text), local dev wiring so `npm run demo` serves the API without Vercel.
Accept: works with no key (fallback, reasons shown) · works with a DeepSeek key (source "model") · malformed JSON and timeouts degrade to fallback without an error state · the demo example text produces the expected preferences from both paths.

## T07 — Landing, ending, accessibility pass · 4 h

Inputs: §8, §9, §10, §12.
Outputs: `Landing` with the autoplayed morph (static with reduced motion) and both CTAs; `Ending`; mobile layout at 360 px; skip link; focus management; axe run on every screen including the portal.
Accept: axe reports zero serious/critical issues everywhere · a keyboard-only run of the whole storyline succeeds · reduced-motion run of the whole storyline succeeds · portal page passes axe (the pitch line depends on it).

## T08 — Ship, demo mode, rehearse · 3 h

Inputs: §2, §8 demo mode, §13, §14.
Outputs: README; `?demo=1` keyboard beats; env vars on Vercel; production build; `npm run demo` verified with wifi off; a screen recording of the full demo as backup; three timed rehearsals.
Accept: every line of the Definition of done checked · rehearsal under 3:00 three times · `DECISIONS.md` lists every deviation from `CLAUDE.md`.

---

## Stretch (only after T08, in this order)

- **S1 Clip-path comparison slider** · 1 h · a draggable divider over two stacked full-width layers using `clip-path: inset(0 X% 0 0)`; ships only if it feels better than hold-to-compare.
- **S2 Second page** · 2 h, content only · an article or a checkout flow; proves the engine is not hard-coded to one page. Costs no engine changes if T02 was done right.
- **S3 Live audit beat** · 1 h · run axe on the portal page on stage and show "0 violations" before the morph. Strong opener; skip if axe integration is fiddly.
- **S4 Second language** · 2 h · the other `demo-content` file plus `copy.ts` review.
- **S5 Extension proof of concept** · 4 h+ · only with ≥ 8 h left after C3 and everything frozen: a Chrome extension with one hand-written adapter for one known site that emits our block schema. Ningtiao has shipped an extension before; still, this is the first thing to abandon.

## Cut order (when behind)

Cut from the top: S5 → S4 → S3 → S2 → S1 → landing autoplay (static hero instead) → Large preset (fold `fontScale` into a control inside any mode) → term popovers (keep the dotted underline with a `title` tooltip) → live model for My words (keep the fallback; reasons still show).

Never cut: the engine and its invariants · Focus · the surfaced pre-checked choice · the colophon with computed counts · back-to-original · offline operation.

---

## Hour plan — 48 h budget, solo + Claude Code

| Hours | Work |
|---|---|
| 0–2 | T01, C1 |
| 2–8 | T02 ∥ T03 (two sessions); C2 at 6–8 |
| 8–14 | T04 |
| 14–17 | T05 ∥ T06 |
| 17–22 | Sleep block 1 (5 h). A rested demo beats a polished slider. |
| 22–26 | T07 |
| 26–29 | T08 first pass (README, demo mode, deploy) |
| 29–36 | C3 at 36. Stretch S1–S3 only; fixes |
| 36–41 | Sleep block 2 (4–5 h) |
| 41–46 | Rehearsals, backup video, fixes only |
| 46–48 | No new code. Setup checklist from `PITCH.md`. |

## Hour plan — 24 h budget

T01 1.5 h → T02 ∥ T03 4 h → T04 5 h → T05 2 h → T06 2 h → T07 3 h → T08 2 h → buffer 4.5 h. Skip Large, skip the landing autoplay (static hero), skip all stretch. If the hackathon runs overnight, sleep 3–4 h between T06 and T07 and take those hours from the buffer.

## Pre-demo checklist (T-2 h)

- `npm run demo` running from localhost; a full run-through with wifi off succeeds.
- One real interpreter call succeeds with the key (then leave it; do not burn quota).
- Phone hotspot ready; backup video open in a second window; timer on.
- Demo machine: reduced motion off, browser zoom 100%, no other tabs, notifications off, fonts loaded (check the serif renders).
- `?demo=1` keys tested in order 1 → 6 → r.
- Rehearsed once more, under 3:00.
