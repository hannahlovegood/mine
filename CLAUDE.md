# Mine — CLAUDE.md (hackathon build pack, v2)

Project: **Mine**（中文名：**由我**）· a freedom layer for the web
Theme: 自由 / Freedom
Hackathon: `[HACKATHON_NAME]` · deadline `[DATE TIME]` · budget `[HOURS]` h · demo language `[DEMO_LANG: en | zh]` · team `[TEAM]` · judges `[WHO / CRITERIA]`

Fill the five fields above before starting T01. Everything else in this file is decided.

---

## 0. How to work

You are the founding engineer and product designer on a team of one human (Ningtiao) plus Claude Code sessions.

- Work from `TASKS.md`, one session per task. Do not start a task whose dependencies are unmet.
- Make reasonable product decisions without asking, except at the three human checkpoints in `TASKS.md` (schema freeze, content review, feature freeze).
- If this file and a task disagree, this file wins. If a rule here would cost more than two hours, ship the cheapest version that keeps the rule's intent and write one line in `DECISIONS.md`.
- Build, then run `lint`, `typecheck`, `test`, `build`. Fix everything. Do not describe what should be built; build it.

---

## 1. What we are building

**One line:** The web shouldn't decide how you have to use it. Mine turns a page into the edition that fits the person reading it — and shows exactly what it changed.

**Name.** Mine is the button: "Make it mine" is the product's whole interaction, so the product carries its name. The Chinese name is 由我 — decided by me, and the 由 of 自由. Descriptor, wherever a subtitle is needed: *a freedom layer for the web* / 让任何页面由你决定. The custom mode is called "My words" (我的话) so it never collides with the product name.

**Thesis:** Every interface encodes an imagined user: someone with time, sharp eyes, perfect attention and patience for jargon. Most accessibility work asks real people to adapt to that imagined user. Mine reverses it. The page adapts to the person — transparently, reversibly, and without ever deciding for them.

**Three freedoms, one page** (this is the pitch spine and the feature list):

1. **Freedom to shape.** Presets and My words reorganize the page: set aside, group, enlarge, plain words, one thing at a time.
2. **Freedom to see your choices.** The engine surfaces every decision the page asks for, labels which are optional, and notes what was pre-checked.
3. **Freedom to change your mind.** The original is one gesture away. Every change is listed and reversible. Nothing is auto-decided.

**What this is not** (say it before a judge does):

- Not an accessibility overlay. Overlays are installed by site owners to claim compliance and hide what they do. This runs on the reader's side, never claims compliance for anyone, and logs every change.
- Not reader mode / Immersive Reader. Those adapt *reading*. This adapts *doing*: forms, decisions, deadlines.
- Not a browser agent. Agents act for you; you still don't know what you agreed to. Mine changes the interface so you can act yourself. Delegation is not autonomy.

**Absorbed from the sibling concepts:** the decisions card (from "Agency Access" / "Permission to say no") is in scope; reversibility (from "UNDO") is in scope as hold-to-compare and back-to-original; the portable preference passport (from "My Terms") is roadmap only and lives in the README.

---

## 2. The demo is the product

Storyline (3 minutes; the script is in `PITCH.md`):

1. **The portal.** A plausible, cluttered public-benefits application page. It passes automated accessibility checks. The deadline is in paragraph four. At the bottom of a 12-field form, a consent to share the applicant's data with "partner organizations" is pre-checked.
2. **Make it mine → Focus.** The page morphs. Eight or more items set aside (none critical, list shown), deadline moved to the top, twelve fields become five steps, and one choice surfaced: the pre-checked consent gets its own step, labeled optional, with a note that the original pre-checked it. The colophon counts animate.
3. **My words.** Paste: *"I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time."* The model returns a preference object plus reasons; the page transforms again (plain passages tagged, terms underlined, still stepped); reasons show which words changed which setting.
4. **Hold to see the original. Back to original.** The reversibility beat.
5. **Honesty beat.** Today the page is described in our block schema; extracting that schema from arbitrary DOM is the roadmap, and the engine's invariants are what make that roadmap safe.
6. **Ending screen.**

Demo reliability rules (non-negotiable):

- Everything except the My words model call is deterministic and offline.
- Plain-language rewrites and the glossary are generated at build time (T03) and shipped as content. Nothing is rewritten live on stage.
- The My words call has an 8-second timeout and an offline keyword fallback that still produces reasons. The network cannot block the demo.
- The live demo runs from localhost (`npm run demo`). The Vercel URL is for judges' links; `*.vercel.app` may be unreachable on mainland networks.
- `?demo=1` enables keyboard beats (§8) so nobody has to type on stage.

---

## 3. Stack and repo

Use what has already shipped from this laptop. Do not introduce a framework the human has not deployed before.

- Vite + React + TypeScript (strict)
- Tailwind CSS, plus `tokens.css` for the design tokens in §9
- `motion` (framer-motion; `import { motion, AnimatePresence, LayoutGroup } from 'motion/react'`) for the single orchestrated morph
- `zod` for every model response and for validating demo content
- `vitest` for engine invariants
- `api/interpret.ts`: one Vercel serverless function (Node runtime) proxying one OpenAI-compatible chat call. Default provider DeepSeek. The key never reaches the client.
- Not used: Next.js, shadcn, Zustand, Supabase, Vercel AI SDK. State is React state. Persistence is `localStorage` for the last My words text only.
- Fonts self-hosted via `@fontsource/*` for Latin faces; Chinese text uses system fonts (PingFang SC / Microsoft YaHei / Noto Sans CJK via the OS) to avoid multi-megabyte downloads. No Google Fonts CDN.

Environment (any OpenAI-compatible endpoint works — OpenAI, Qwen, Kimi, GLM; if a sponsor requires a specific model, change only these three values):

```
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_API_KEY=
```

Scripts: `dev` · `build` · `preview` · `test` · `lint` · `typecheck` · `demo` (build + preview + local API on one port) · `plain` (one-off: drafts `plainText` and glossary entries for the content file; the human edits afterwards).

```
src/
  content/    demo-content.en.ts  demo-content.zh.ts  content.meta.ts
  engine/     schema.ts (FROZEN after T01)  presets.ts  transform.ts  steps.ts  changes.ts  fallback.ts
  ui/         PortalPage  EditionPage  ModeStrip  Colophon  DecisionsCard  Stepper
              WordsComposer  HoldToCompare  Landing  Ending
  copy.ts     every UI string, EN + ZH (§10)
  tokens.css
api/interpret.ts
scripts/plain.ts
test/         invariants.test.ts  fallback.test.ts  content.test.ts
```

---

## 4. Content model — `schema.ts` (frozen after T01)

```ts
export type Importance = 'critical' | 'primary' | 'secondary' | 'decorative'
// critical   never omitted in any mode; may be collapsed or moved, never hidden; text never replaced
//            (a plain summary may be added beside it)
// primary    core content; always shown
// secondary  related links, FAQ, announcements; collapsed to a stub in comfortable, set aside in minimal
// decorative promos, banners, stock images; set aside whenever density !== 'full' or media is off

export type Kind =
  | 'nav' | 'heading' | 'text' | 'legal' | 'notice' | 'deadline' | 'instruction'
  | 'promo' | 'faq' | 'field' | 'decision' | 'action' | 'image'

interface Base { id: string; kind: Kind; importance: Importance; group?: string } // group = a step id from content.meta.stepOrder

export interface Term { term: string; plain: string }
export interface TextBlock extends Base {
  kind: 'heading' | 'text' | 'legal' | 'notice' | 'instruction' | 'faq' | 'promo'
  text: string; level?: 1 | 2 | 3
  complexity: 'simple' | 'medium' | 'complex'
  plainText?: string; terms?: Term[]
}
export interface DeadlineBlock extends Base { kind: 'deadline'; text: string; date: string; plainText?: string }
export interface NavBlock extends Base { kind: 'nav'; items: string[] }
export interface FieldBlock extends Base {
  kind: 'field'; label: string
  input: 'text' | 'date' | 'number' | 'select' | 'file' | 'tel' | 'email'
  required: boolean; help?: string; plainHelp?: string; options?: string[]
}
export interface DecisionBlock extends Base {
  kind: 'decision'; label: string; plainLabel?: string
  optional: boolean; preChecked: boolean; consequence?: string
}
export interface ActionBlock extends Base { kind: 'action'; label: string; primary: boolean }
export interface ImageBlock extends Base { kind: 'image'; src: string; alt: string; decorative: boolean }

export type ContentBlock = TextBlock | DeadlineBlock | NavBlock | FieldBlock | DecisionBlock | ActionBlock | ImageBlock
export interface ContentMeta { title: string; lang: 'en' | 'zh'; stepOrder: { id: string; title: string }[] }
export interface PageContent { meta: ContentMeta; blocks: ContentBlock[] }
```

Mirror every type with a Zod schema (`PageContentSchema`, `MinePreferencesSchema`). Content files are validated in `content.test.ts`.

**Authoring rules for the demo page (T03):**

- Scenario for `en`: "Housing Stability Grant — online application" for a fictional county. Scenario for `zh`: 「灵活就业人员社会保险补贴 — 网上申领」for a fictional city. Same structure either way.
- Structure the page so the pain is real, not cartoonish: a 12-item nav, a utility bar, a promo banner for the portal's app, a maintenance notice, a 120-word intro with jargon, an eligibility list in legal register, the deadline inside the fourth paragraph, a sidebar with 8 related links and 3 announcements, a "rate this page" prompt, a 12-field form with inconsistent required marks, one pre-checked optional consent (data sharing with partner organizations), one required attestation, three competing calls to action (save draft / submit / download PDF) plus a floating "chat with an agent", a privacy notice in the footer, and 6 FAQ items.
- Tag `importance` honestly: deadline, required fields, required attestation, submit action and the privacy notice are `critical`; the intro, eligibility, instructions and the optional consent are `primary`; FAQ, related links, announcements are `secondary`; promos and the app banner are `decorative`.
- Every field and decision has a `group`. Steps: `start` (deadline, eligibility, what you need) → `you` → `home` → `income` → `review` (attestation, privacy notice, submit). The optional consent gets its own step automatically (§6 rule 9).
- `plainText`: same facts, shorter sentences, no new claims. Every digit sequence in `text` must appear in `plainText` (tested). For `legal` blocks `plainText` is a summary shown beside the original, never instead of it.
- `terms`: 8–12 across the page, one-sentence definitions, no legal advice.
- Author `[DEMO_LANG]` first. The second language only if T08 is done.

---

## 5. Preferences and presets

```ts
export interface MinePreferences {
  readingLevel: 'original' | 'plain'
  density: 'full' | 'comfortable' | 'minimal'
  navigation: 'full' | 'reduced' | 'hidden'
  fontScale: 1 | 1.15 | 1.35 | 1.6
  contrast: 'default' | 'high'
  showDecorativeMedia: boolean
  taskMode: 'all' | 'one-at-a-time'
  explainTerms: boolean
  surfaceDecisions: boolean
}
```

| Preset | readingLevel | density | navigation | fontScale | contrast | media | taskMode | explainTerms | surfaceDecisions |
|---|---|---|---|---|---|---|---|---|---|
| Default | original | full | full | 1 | default | true | all | false | false |
| Focus | original | minimal | reduced | 1.15 | default | false | one-at-a-time | false | true |
| Plain | plain | comfortable | reduced | 1.15 | default | true | all | true | true |
| Large | original | comfortable | full | 1.6 | high | true | all | false | true |
| My words | whatever the interpreter returns, starting from Default | | | | | | | | |

Describe presets by need, never by diagnosis: Focus is for when there is too much on screen; Plain is for when the words are the obstacle; Large is for when the text is. The label is "Plain", not "Easy Read" — Easy Read is a specific standard with its own conventions and should not be borrowed.

---

## 6. Engine — `transform.ts` (pure, deterministic, tested)

```ts
export function transform(content: PageContent, prefs: MinePreferences): Transformation

export interface Transformation {
  view: ViewBlock[]            // ordered blocks to render when taskMode === 'all'
  steps?: Step[]               // when taskMode === 'one-at-a-time'
  decisions: DecisionSummary   // always computed; rendered when surfaceDecisions
  changes: Change[]            // every change, with the blocks it touched and a human reason
  summary: Summary             // derived from changes only — never typed by hand
}
export type ViewBlock = ContentBlock & {
  state: 'shown' | 'collapsed' | 'moved' | 'rewritten' | 'enlarged'
  stubFor?: string[]           // ids of set-aside blocks a stub can restore
  original?: string            // original text when rewritten
}
export interface Step { id: string; title: string; blocks: ViewBlock[] }
export interface DecisionSummary { count: number; optional: DecisionBlock[]; required: DecisionBlock[]; preChecked: DecisionBlock[] }
export interface Change {
  type: 'hidden' | 'collapsed' | 'moved' | 'rewritten' | 'explained' | 'enlarged' | 'stepped' | 'surfaced'
  blockIds: string[]; reason: string
}
export interface Summary { hidden: number; collapsed: number; moved: number; rewritten: number; explained: number; enlarged: number; steps: number; surfaced: number }
```

Apply rules in this order so the reasons read coherently:

1. **Media.** `!showDecorativeMedia` → set aside images with `decorative: true`. Informative images stay.
2. **Density.** `minimal` → set aside `decorative` and `secondary` blocks, replaced by one stub per region ("n items set aside · Show"). `comfortable` → set aside `decorative`, collapse `secondary` into a stub. `full` → nothing.
3. **Navigation.** `reduced` → collapse nav to "Menu (n)". `hidden` → set aside with a restore stub. The stub is itself a `ViewBlock`, so the way back is always on screen.
4. **Deadline.** Any preset other than Default → move deadline blocks to the top (or into the `start` step). Reason: "Moved up from later in the page."
5. **Reading level.** `plain` → text blocks with `plainText` are rewritten (state `rewritten`, `original` kept). `legal` blocks are never replaced; the plain summary is attached beside them.
6. **Terms.** `explainTerms` → attach `terms`; record one `explained` change with the count.
7. **Scale and contrast.** No block changes; the UI sets CSS variables. If `fontScale >= 1.35`, record `enlarged` for `field` and `action` blocks (targets ≥ 48 px).
8. **Decisions.** Compute `DecisionSummary`. When `surfaceDecisions`, record `surfaced` for every optional decision, with the pre-checked note in the reason.
9. **Steps.** `one-at-a-time` → build steps from `meta.stepOrder`; fields, decisions, instructions and the deadline go to their groups; each optional decision becomes its own step titled "A choice"; non-primary actions are demoted to an "Other options" link in the last step. Record `stepped` with the field count.

**Invariants — write these as tests before any UI exists (T02):**

- I1 Every `critical` block is present in `view` or in some step, for every preset and for 50 random preference combinations.
- I2 Every `required` field appears exactly once.
- I3 For every rewritten block, the multiset of digit sequences in `original` equals the one in `plainText`.
- I4 `transform(content, Default)` preserves order and produces zero changes.
- I5 With `one-at-a-time`, the union of step blocks contains every field and every decision exactly once.
- I6 `preChecked` is never altered by the engine. The UI shows the note; the person decides.
- I7 Same input, identical output (run twice, deep-equal).
- I8 Every `summary` number equals the count derived from `changes`.

---

## 7. My words — the only live model call

Route: `POST /api/interpret` `{ text: string; lang: 'en' | 'zh' }` → `{ preferences, reasons, source: 'model' | 'fallback', ms }`

Server: one chat completion, temperature 0, `max_tokens` 400, `AbortController` at 8000 ms. Enable the provider's JSON mode where available (DeepSeek and OpenAI: `response_format: { type: 'json_object' }`; the prompt below contains the word JSON, which they require). Strip code fences → `JSON.parse` → Zod. On any failure, retry once with the parser error appended to the user turn; then return `fallback(text)` with `source: 'fallback'`. Log timing only.

System prompt (use verbatim):

```
You convert a person's description of how they want a web page to feel into an interface configuration.
Return ONLY a JSON object with exactly two keys:
"preferences": an object matching this schema exactly — { "readingLevel": "original"|"plain", "density": "full"|"comfortable"|"minimal", "navigation": "full"|"reduced"|"hidden", "fontScale": 1|1.15|1.35|1.6, "contrast": "default"|"high", "showDecorativeMedia": boolean, "taskMode": "all"|"one-at-a-time", "explainTerms": boolean, "surfaceDecisions": boolean }
"reasons": an array of 1–5 short strings. Each quotes a phrase from the person's text and names the setting it changed, written in the person's language, e.g. "\"one decision at a time\" → one task per step".
Rules:
- Start from DEFAULT and change only what the person's words justify. Unmentioned settings stay at DEFAULT.
- Work only from stated preferences. Never infer, mention, or imply a diagnosis, disability, or condition, even if the person names one; respond to the preference, not the label.
- If the person asks for something the schema cannot express, ignore it silently. Do not add keys.
- Output raw JSON. No prose, no markdown, no code fences.
DEFAULT: {"readingLevel":"original","density":"full","navigation":"full","fontScale":1,"contrast":"default","showDecorativeMedia":true,"taskMode":"all","explainTerms":false,"surfaceDecisions":false}
Example input: "I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time."
Example output: {"preferences":{"readingLevel":"plain","density":"minimal","navigation":"reduced","fontScale":1,"contrast":"default","showDecorativeMedia":false,"taskMode":"one-at-a-time","explainTerms":true,"surfaceDecisions":true},"reasons":["\"overwhelmed by long forms\" → fewer items on screen, one task per step","\"plain words\" → passages shown in plain language","\"explain anything I might not know\" → terms explained inline","\"one decision at a time\" → each choice gets its own step"]}
```

Client validation: `InterpretResponseSchema = z.object({ preferences: MinePreferencesSchema, reasons: z.array(z.string().max(160)).min(1).max(5) })`.

**Fallback (`fallback.ts`, tested).** Lowercase the text, match phrase groups, apply in order, and generate a reason from the matched phrase. Start from Default.

| Sets | EN phrases | ZH phrases |
|---|---|---|
| density minimal, media off | overwhelm, distract, quiet, clutter, noise, less, calm, too much | 干扰, 太多, 安静, 简洁, 乱, 太满 |
| taskMode one-at-a-time, surfaceDecisions | one at a time, one decision, one question, step by step, one thing | 一次一个, 一步一步, 一件事, 一个决定 |
| explainTerms | explain, unfamiliar, jargon, terms, what does, mean | 解释, 术语, 看不懂, 不懂, 什么意思 |
| readingLevel plain | plain, simple language, simpler words, easy words | 简单, 通俗, 大白话, 平实 |
| fontScale 1.35 (1.6 if "much") | bigger, larger, large text, can't see, small text, zoom | 放大, 大一点, 看不清, 字太小 |
| contrast high | contrast, hard to read, faint, washed out | 对比度, 看不清楚, 太淡 |
| media on | keep the images, keep images, pictures matter | 保留图片, 留下图片 |
| media off | no images, remove images, hide pictures | 去掉图片, 不要图片 |
| surfaceDecisions | agreeing to, my choices, consent, what am I signing | 同意了什么, 选择, 授权, 签了什么 |

UI: reasons appear in the colophon under "Why", with a source badge — "Interpreted by model" or "Interpreted offline". The source is never hidden.

---

## 8. Screens and interactions

- **Landing.** The hero is the morph itself, playing once on load (portal → Focus), then a Replay control. Headline, one subheading, primary "Make it mine" → Lab, secondary "See what changed" → scrolls to a static colophon example. With reduced motion, a static before/after side by side.
- **Lab.** `ModeStrip` (Default · Focus · Plain · Large · My words) as plain text tabs with an underline indicator. The page frame. The `Colophon` rail (right on desktop; bottom sheet with a count pill on mobile). `HoldToCompare` (press and hold shows the original over the edition; keyboard toggles). "Back to original".
- **My words.** Textarea, five example chips that append phrases, "Transform", status text "Reading your words…", then reasons and the source badge. The last text is saved to `localStorage`.
- **Ending.** Three lines revealed after the third transformation or on scroll: "Access is not enough." / "Control is." / "Freedom is being able to shape how the world meets you." Then the repo link.

**Morph.** Wrap `PortalPage` and `EditionPage` in one `<LayoutGroup>`; every block wrapper gets `layoutId={block.id}`; exiting blocks fade and collapse via `AnimatePresence`; the moved deadline glides to the top; colophon counts animate up after layout settles (~600 ms). Budget: two hours. If `layoutId` is janky with text scaling, fall back to a two-phase transition: collapse set-aside blocks in place (300 ms), then crossfade to the edition (250 ms). `prefers-reduced-motion` → crossfade only, 120 ms. After every transform, an `aria-live="polite"` region announces the summary sentence and focus moves to the page heading.

**Demo mode (`?demo=1`).** Keys: `1` portal · `2` Focus · `3` open My words with the example text prefilled · `4` apply My words · `5` toggle hold-to-compare · `6` Ending · `r` reset. Shortcuts are inert while focus is inside a text field and do not exist without `?demo=1`.

---

## 9. Visual system — "Editions"

**Concept.** The same text has always existed in editions: large-print, abridged, annotated, plain-language. The after-state is the person's edition of the page, and the colophon — the note at the end of a book about how it was made — is its changelog. This grounds the design in something older than software and keeps it away from dashboard and chatbot looks.

**Two visual languages on one screen.**

- *Before, the portal:* government-portal vernacular done plausibly. `--portal-blue #1E5AA8` header, `--portal-panel #EEF1F5`, `--portal-alert #C8102E`, Public Sans or system-ui at 14 px, tight leading, bordered boxes, three different button styles. Ugly through realism, never through parody — judges must believe it.
- *After, the edition:* `--paper #FFFFFF`, `--ink #000000`, `--graphite #55534F` (secondary text), `--rule #D8D5CE` (hairlines only where structure needs them), `--stub #F1EFE9` (set-aside stubs), `--pencil #2743D9`. Type: Literata for edition body, 18 px / 1.6, max 68 ch, left-aligned; Atkinson Hyperlegible for interface text, labels, form fields, and as the body face in Large. Chinese body 17 px / 1.8 in the system serif or sans.

**The blue pencil rule.** `--pencil` marks only things the system changed or that lead back to the original: the dotted underline on explained terms, the "Plain version" tag, the moved marker on the deadline, stub "Show" links, hold-to-compare, focus rings. If it's blue, we changed it, and you can inspect or undo it. There is no other accent color.

**Motion.** Exactly one orchestrated moment: the morph. Everything else is instant or under 150 ms.

**Do not:** all-caps eyebrow labels ("MINE / 01"), tracked-out mode labels, arrows appended to button text, middle-dot metadata strings, identical rounded cards with drop shadows, gradients, purple, near-black backgrounds with a neon accent, monospace for data labels. Sentence case everywhere.

---

## 10. Copy — `copy.ts` (the UI reads only from here)

| Key | EN | ZH |
|---|---|---|
| hero.title | The interface is not neutral. | 界面从不中立。 |
| hero.sub | Every page imagines a reader — someone with time, sharp eyes and patience for jargon. Mine lets you replace that imagined reader with yourself. | 每个页面都预设了一位读者：有时间、眼神好、耐得住术语。「由我」让你把这位"预设读者"换成你自己。 |
| hero.cta | Make it mine | 变成我的 |
| hero.secondary | See what changed | 看看改了什么 |
| lab.title | Same information. Your edition. | 同一份信息，属于你的版本。 |
| modes | Default · Focus · Plain · Large · My words | 原版 · 专注 · 平实 · 大字 · 我的话 |
| words.title | How should this page feel to you? | 你希望这个页面是什么感觉？ |
| words.placeholder | Fewer distractions. Explain unfamiliar words. One decision at a time. | 少一点干扰。解释我看不懂的词。一次只让我做一个决定。 |
| words.chips | quieter · fewer decisions · explain unfamiliar words · bigger text · keep the images | 安静一点 · 少做决定 · 解释术语 · 字大一点 · 保留图片 |
| words.button | Transform | 为我重排 |
| words.working | Reading your words… | 正在读你的话…… |
| words.source | Interpreted by model / Interpreted offline | 由模型理解 / 离线规则理解 |
| colophon.title | What changed | 改了什么 |
| colophon.line | This edition: {hidden} items set aside, {rewritten} passages in plain words, {fields} fields in {steps} steps, {surfaced} choice surfaced. | 这个版本：收起 {hidden} 项，{rewritten} 段改写为平实语言，{fields} 个填写项分成 {steps} 步，揭示 {surfaced} 个可选项。 |
| colophon.why | Why | 为什么 |
| decisions.title | This page asks you for {n} decisions. | 这个页面需要你做 {n} 个决定。 |
| decisions.optional | Optional — you can decline. | 可选，你可以拒绝。 |
| decisions.required | Required to submit. | 提交所必需。 |
| decisions.prechecked | Pre-checked on the original page. | 原页面已默认勾选。 |
| deadline.moved | Moved up from later in the page. | 从页面下方移到了这里。 |
| stub | {n} items set aside · Show | 已收起 {n} 项 · 展开 |
| rewritten.tag | Plain version · Show original | 平实版 · 看原文 |
| hold | Hold to see the original | 按住查看原版 |
| reset | Back to original | 回到原版 |
| step.progress | Step {i} of {n} | 第 {i} 步，共 {n} 步 |
| step.choice | A choice | 一个选择 |
| ending.1 | Access is not enough. | 能进入，还不够。 |
| ending.2 | Control is. | 能掌控，才算数。 |
| ending.3 | Freedom is being able to shape how the world meets you. | 自由，是能决定世界以什么方式来到你面前。 |

---

## 11. Product rules

Never: diagnose or infer conditions · claim WCAG compliance for the portal or for us · hide a critical block, a required field, or a required decision · flip a pre-checked or default choice · change a number, date, or amount in plain text · rewrite legal text in place · show a model output without its source · submit anything automatically.

Always: keep the original one gesture away · list every change with a reason · label rewritten text · let the person restore any set-aside item · work with no network · keep the human as the one who decides.

---

## 12. Accessibility of the product itself

- Landmarks (`header`, `nav`, `main`, `aside`, `footer`), one `h1`, correct heading order, a skip link.
- Every control keyboard-reachable; 3 px `--pencil` focus ring; `Escape` closes popovers; hold-to-compare is a toggle on the keyboard.
- Targets ≥ 44 px; ≥ 48 px in Large. Text contrast ≥ 4.5:1, interface contrast ≥ 3:1; high-contrast mode adds link underlines and heavier rules.
- `aria-live="polite"` summary after each transform; focus moves to the heading; the stepper announces progress.
- Term popovers are buttons with `aria-expanded`; nothing is hover-only.
- `prefers-reduced-motion` respected everywhere, including the landing autoplay.
- Works at 360 px wide.
- Run axe in dev; zero serious or critical issues on every screen — including the portal page, so the line "it passes the automated checks" is true.

---

## 13. README

Sections: title · one-sentence thesis · screenshot · the three freedoms · how it works (content schema → engine → edition; changes → colophon) · run locally · environment · tests · accessibility principles · limitations · roadmap.

Include this sentence: *Mine is a prototype exploring interface sovereignty: the idea that people should be able to shape software around their needs instead of continually shaping themselves around software.*

Limitations, stated plainly: demo pages are described in our block schema, not extracted from the live web; plain-language text is generated at build time and checked by a human; this is not a compliance tool; user testing so far: `[none | n informal sessions]`.

Roadmap: browser extension that extracts blocks from real DOM (readability heuristics + form detection + a model classifier, with the same invariants) · a portable preference passport · per-site memory · a second content type (checkout, medical intake).

---

## 14. Definition of done

- Runs with no API key and no network; `npm run demo` serves everything from localhost.
- All invariant tests pass; content validates against the schema.
- Default / Focus / Plain / Large are each visibly different; My words works via the model and via the fallback, both showing reasons and the source.
- Colophon numbers are computed from `changes`; every set-aside item is restorable; hold-to-compare and back-to-original work.
- Decisions card shows optional / required / pre-checked correctly; pre-checked state is untouched.
- `aria-live`, focus management and reduced motion work; axe is clean on every screen including the portal; 360 px layout works.
- README complete; Vercel deployment green; `?demo=1` beats work.
- Backup screen recording of the full demo exists; the demo has been rehearsed three times under 3:00.
