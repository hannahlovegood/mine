# Mine extension — contract

The extension does what the web demo does, on the page you are actually on. The real form stays
the real form: you type into the site's own inputs and submit with the site's own button. Mine
only sets aside, folds, echoes, steps, annotates and enlarges — every change listed, every change
reversible, nothing auto-decided (CLAUDE.md §11 applies verbatim).

```
page DOM  →  extract  →  PageContent (+ element maps)  →  engine transform (unchanged, pure)
          →  apply     →  reversible DOM mutations + injected Mine UI (shadow DOM)
```

## 1. Extractor — `extension/src/extract/`

`extractPage(doc: Document, opts?: { lang?: 'en' | 'zh'; maxBlocks?: number }): ExtractedPage`

```ts
export interface ExtractedPage {
  content: PageContent;              // validates against PageContentSchema (drop bad blocks, never throw)
  nodes: Map<string, Element>;       // block id → the element that carries the block (p, h2, input, button, img, nav…)
  boxes: Map<string, Element>;       // block id → the element to hide/show for that block (see "boxes")
  regions: Map<string, Element>;     // region name → its root element ('header' | 'utility' | 'sidebar' | 'footer' | 'main')
  main: Element;                     // main content root (deadline echo + stubs are inserted here)
  form?: Element;                    // the form root when fields were found (stepper is inserted before its first box)
  lang: 'en' | 'zh';
}
```

Rules:
- Never throw; never mutate the page; skip anything inside `mine-root` (our UI), `script`, `style`, `template`, `noscript`, elements with `hidden`, `aria-hidden="true"`, or computed `display: none` / `visibility: hidden` (use `getClientRects().length === 0` as the cheap test; happy-dom has no layout, so in tests fall back to attributes/inline styles).
- Ids: `b-1`, `b-2`, … in document order (schema: lowercase kebab-case). `meta.title` = document title or the first h1. `meta.lang` from `<html lang>` (`zh*` → zh, else en), overridable by `opts.lang`.
- **Regions**: the nearest ancestor that is `header`/`[role=banner]` → `header`; `nav`/`[role=navigation]` inside the header, or a bar of ≤ 6 short links above the header → `utility`; `aside`/`[role=complementary]`/class or id matching `/side|aside|rail|related|widget/i` → `sidebar`; `footer`/`[role=contentinfo]` → `footer`; else `main`. `regions.get('main')` is `main`/`[role=main]`/`article`/the largest text container, else `body`. Blocks in `main` carry no `region` (schema treats undefined as main).
- **Kinds**:
  - `nav`: `nav`, `[role=navigation]`, a `ul` whose items are ≥ 80 % links (≥ 3 items). Items = link texts (trimmed, deduplicated). The site menu (in `header`, or the first nav with ≥ 5 items) is `importance: 'primary'` and `region: 'header'`; other navs are `secondary` with their region.
  - `heading`: h1–h6 (level: h1 → 1, h2 → 2, else 3). `importance: 'primary'`.
  - `field`: `input` (not hidden/submit/button/reset/image/checkbox/radio), `select`, `textarea`. Label: `<label for>`, wrapping label, `aria-labelledby`, `aria-label`, `placeholder`, `title`, or the nearest preceding text (≤ 60 chars). `input` type map: email/tel/number/date/file → same; select → select; everything else → text. `required` = `required` attr, `aria-required`, or the label containing `*`/`必填`/`(required)`. Radio groups (same `name`) → one `field` with `input: 'select'` and `options` = the radio labels; `nodes` → the first radio, `boxes` → the group's common wrapper. `help`: text of `aria-describedby`, or a sibling with class matching `/help|hint|desc|note|tip/i`, or the small text right after the control (≤ 200 chars). `importance`: critical when required, else primary. `group` (see steps).
  - `decision`: a checkbox with a label. `preChecked` = `checked` at extraction time. `optional` = not `required` and the label does not read like an attestation (`/certify|declare|attest|swear|承诺|保证|声明|属实/i`). Attestations are `critical`; optional decisions `primary`. `consequence`: help text as for fields. `group` = the checkbox's form group.
  - `action`: `button`, `input[type=submit|button|reset]`, `[role=button]`, `a` whose class matches `/btn|button/i`. `primary` = type submit, or text matching `/submit|apply|send|continue|next|提交|申请|发送|确认|下一步/i`, or class matching `/primary|submit/i`. Importance: primary actions `critical`; others `primary`; floating widgets (`position: fixed` / class `/chat|widget|float|feedback|cookie|back-?to-?top/i`) `decorative`. Buttons inside the site menu are ignored.
  - `image`: `img` (≥ 48 px in either dimension or unknown size) and `figure`/`picture`. `decorative` = empty/missing alt, or region ≠ main, or class matching `/banner|hero|promo|ad|logo|icon|bg/i`; else informative (alt kept).
  - `promo`: an element in header/main whose text matches `/download the app|get the app|扫码|下载.*(app|应用)|广告|sponsored|推广|rate this page|was this page helpful|这个页面有帮助/i`, or class/id matching `/promo|banner|ad-|ads|advert|sponsor|rating|feedback/i` → `decorative`.
  - `notice`: `[role=alert|status]`, `.alert`, `.notice`, `.warning`, text starting with `/notice|attention|maintenance|注意|提示|公告|维护/i` → `secondary`.
  - `deadline`: a text block (p, li, td, div-with-only-text) containing a parseable date AND a deadline word (`/deadline|due|by|before|no later than|closes?|expires?|until|must be received|截止|止|之前|不迟于|前提交|截至|到期/i`). `date` = ISO of the first parseable date (formats: `YYYY-MM-DD`, `YYYY/M/D`, `YYYY年M月D日`, `Month D, YYYY`, `D Month YYYY`, `M/D/YYYY` (US), `Mon D YYYY`). → `critical`, no group.
  - `legal`: a text block whose text matches ≥ 2 of `/shall|hereby|pursuant|liability|terms|conditions|privacy|personal data|依据|条例|办法|条款|责任|隐私|个人信息|法律|规定|承诺/i`, or sits in a container with class/id `/legal|terms|privacy|disclaimer/i`. `critical` when it mentions privacy/personal data (隐私/个人信息); else `primary`.
  - `instruction`: an `ol` in main, or a text block starting with `/how to|steps?|before you|instructions|请准备|办理流程|申请步骤|操作步骤|须知/i` → `primary`.
  - `faq`: `details`/`summary` pairs, or a text block matching `/^(q[:：.]|问[:：]|faq)/i`, or headings that end with `?`/`？` plus their following paragraph (text = `Q — A`) → `secondary`.
  - `text`: every other p, li (outside navs), td/th with text, blockquote, dd/dt, and `div`/`span` whose own text nodes hold ≥ 20 chars and which contain no block children. Importance: main → `primary`; header/sidebar/footer → `secondary`. A block with < 3 characters is skipped. `complexity`: `complex` when the average sentence length > 25 words (EN) or > 45 characters (ZH), or the block contains ≥ 2 legal/jargon hits; `medium` when > 15 words / > 28 characters; else `simple`. `plainText`/`terms` are never produced by the extractor (the Plain API adds them later).
- **Boxes** (what to hide): for text/heading/image/nav/action blocks the element itself; for fields and decisions the smallest ancestor that contains this control (and its label) but no other control — stop at `form`, `fieldset`, `tr`, `li`, `.form-group`-like wrappers; if none, the control's parent. Two blocks never share a box except radio groups (one block).
- **Steps** (`meta.stepOrder`): only when ≥ 2 fields exist. Group fields and decisions by their `fieldset` (title = legend), else by the nearest preceding heading inside or just before the form (title = heading text), else chunks of 4 (title = `Part n` / `第 n 部分`). Ids `s-1`, `s-2`, … in order. Every field and decision gets a `group`; actions inside or just after the form get the last group; the deadline and all other text stay ungrouped. Attestation decisions belong to the group of the nearest submit action (usually the last).
- **Order and limits**: blocks in document order; stop after `maxBlocks` (default 400). Skip empty containers. Deduplicate: an element that is an ancestor of another block's node is not itself a block (the leaf wins), except `nav`, `faq` and radio groups which are composite.
- Text: `innerText` when available, else `textContent`, whitespace-collapsed, trimmed, ≤ 2000 chars.

Tests (vitest, happy-dom): fixtures in `extension/test/fixtures/*.html` — `portal-en.html` and `portal-zh.html` (generated from the web demo: `npm run ext:fixture` at the repo root), plus hand-written fixtures for other shapes (a Chinese government notice page with a table and no form; a Bootstrap-style form with `.form-group`, fieldsets, a radio group, a required checkbox and a pre-checked optional one; a div-soup page with no landmarks; a page with a cookie banner and a floating chat widget). Assert counts, kinds, importances, regions, groups, the deadline's ISO date, that every field/decision has a box that contains its node and no other control, that the result validates, and that extraction never throws on `<body></body>`.

## 2. Applier — `extension/src/apply/` (reversible DOM mutations)

The applier turns a `Transformation` into DOM changes and can undo all of them (`Applied.undo()`), so switching modes = undo + apply.

| Engine output | DOM |
|---|---|
| `hidden` (block ids) | `box.setAttribute('data-mine-hidden', '')`; injected CSS `[data-mine-hidden]{display:none!important}`. One `<mine-stub>` per region inserted before the first hidden box of that region: "n items set aside · Show". If every block of a region root is hidden, the region root is hidden too and the stub goes before it. |
| `collapsed` secondary blocks | hidden the same way, but the stub reads "n sections folded · Show" and lists their first words. |
| `collapsed` nav | nav box hidden; `<mine-stub>` "Menu (n) · Show" at its position. |
| `moved` deadline | the original stays; a `<mine-callout>` is inserted at the top of `main`: "Deadline · <date> · Shown again from later in the page · Go to it" (scrolls to and briefly outlines the original). |
| `rewritten` | requires plainText from the Plain API. If the block's node has no links/controls/inline images: replace its text (keep `data-mine-original`), prepend a "Plain version · Show original" tag. Otherwise leave the text and append the plain version beneath as an annotation. `legal` and `decision`: always annotated beside, never replaced. |
| `explained` | append a `<mine-terms>` note under the node listing `term — plain` (no inline wrapping of the site's text). |
| `enlarged` (fontScale ≥ 1.35) | `document.body.style.zoom = fontScale`; injected CSS raises `min-height` of inputs/buttons to 48 px; our UI counter-zooms. `contrast: high` → underline links, 3 px focus rings. |
| `surfaced` | a `<mine-note>` inserted after the decision's box: "Optional — you can decline." / "Required to submit." + "Pre-checked on the original page." (pencil) + consequence. The checkbox state is never touched. |
| `stepped` | a `<mine-stepper>` inserted before the form's first box: "Step i of n · title · Back / Next". Boxes of steps other than the current one get `data-mine-step-hidden` (same CSS). Choice steps show only that decision's box. The frame (ungrouped, shown blocks) is never hidden by stepping. Non-primary actions folded under "Other options" in the last step (a stub that reveals them). |

Hold to compare: `html[data-mine-compare]` disables every rule above via CSS (`[data-mine-hidden], [data-mine-step-hidden] { display: revert !important }`, injected nodes hidden, zoom reset). Back to original: `undo()`.

Every injected element is a custom element with a shadow root and the Editions tokens; blue (`--pencil`) only on things Mine changed or that lead back.

## 3. Panel — `extension/src/panel/`

A `<mine-root>` host appended to `body` (shadow DOM; fonts via `chrome.runtime.getURL('fonts/…')`). Floating button "Make it mine" bottom-right → opens the rail (right, 340 px; bottom sheet under 720 px). The rail = ModeStrip (Default · Focus · Plain · Large · My words) + summary sentence + Every change (reasons, Show/restore) + Decisions card + Why (My words reasons + source badge) + Hold to see the original + Back to original + a settings row (server URL for the model; language). Per-site memory: the last mode per hostname in `chrome.storage.local`; on load, if a mode is remembered, apply it (the "smooth" part).

## 4. Server — `/api/plain` (Plain API; shared handler `server/plain.ts`)

`POST /api/plain` `{ lang, blocks: [{ id, text, kind }] }` (≤ 12 blocks, ≤ 1500 chars each) → `{ rewrites: [{ id, plainText, terms }], ms }`. No key → `503 { error: 'no-model' }` and the extension says plain language needs a model. Every rewrite is validated server-side: digit multiset equal, length ≤ 1.3× original, terms ≤ 4 per block and each term appears verbatim in the original; a block that fails validation is dropped, never patched. CORS `*` with OPTIONS preflight on both `/api/*` routes (Vercel function and Vite middleware).
