# Adversarial review of the extension (2026-09-06)

Five lenses (safety, extraction, undo, panel, contract) → 65 findings; the top 10 by severity were each attacked by two independent verifiers and all 10 were confirmed with reproductions. Numbered list below; fixes are tracked in git.

finders 5, verdict agents 20

[0] [critical] Step mode hides the submit button when a control's box swallowed it (LCA box has no foreign-content check)  (extension/src/apply/index.ts:236)
   FIX: In apply, before setting data-mine-step-hidden (and data-mine-hidden) on a box, refuse if the box contains the node of any block that is not in the same step — at minimum any action/field/decision/deadline node — and fall back to hiding only the control+label (or nothing). Additionally in boxes.ts: run hasForeignContent on the LCA before accepting it, and treat button, input[type=submit|button|image], [role=button] and a.btn-like as 'other controls' in otherControls. Add a post-apply invariant: every primary action node must have getClientRects().length > 0 on the last step, else unhide its an

[1] [critical] 'widget' class token (Elementor, jQuery UI) sets an entire page's content aside  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:74)
   FIX: Remove 'widget'/'widgets' from FLOAT_EXACT/FLOAT_PREFIX (a class alone should never make something float — require computed position fixed/sticky, and keep only chat/cookie/consent-banner/backtotop tokens as class hints). In regions.ts, do not let the sidebar token match elements inside the semantic main / largest text container ('widget' should only count outside main, like the header/footer loops already do via insideMain). Add an Elementor fixture (heading + text-editor + form widgets) asserting h1 primary, paragraphs primary text, and a deadline block.

[2] [critical] Link-list / breadcrumb composite nav swallows required form controls  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:232)
   FIX: In isLinkList and isBreadcrumb return false when containsControl(el) (mirror isLinkBar at kinds.ts:250). In Walker.nav(), if the element contains any collected control (ctx.controls keys) do not swallow the subtree — emit the nav for the links only or walk the children. Add fixture rows for both shapes and assert every collected control yields a field whose box holds no nav.

[3] [high] Closed rail stays in the Tab order while aria-hidden; focus never returns to the fab; no Escape  (extension/src/panel/Panel.tsx:192)
   FIX: When closed set `inert` and `visibility:hidden` on .rail (after the 150 ms transition, or immediately under reduced motion) and keep aria-hidden in step; on open move focus to the close button or the rail heading; on close (× / Escape / fab) return focus to the fab; add a keydown listener for Escape on the shadow root (port useEscape). Hide the fab (`hidden`) while the rail is open on desktop or move it left of the rail.

[4] [high] Arrowing through the mode radios re-applies the page on every keypress and steals focus into a site input  (extension/src/panel/Panel.tsx:211)
   FIX: Do not focus site controls from apply(): drop the focus() in showStep or restrict it to an explicit stepper Back/Next click; after a transform keep focus where it was in the rail and rely on the live region (or focus the rail's 'What changed' h2). Consider applying a mode on Enter/Space/click rather than on radio change (buttons with aria-pressed, or debounce change until focus leaves the group).

[5] [high] Large + Hold to compare: body zoom is reset but the panel's counter-zoom is not, so the rail shrinks and the hold releases itself  (extension/src/apply/index.ts:294)
   FIX: In compare(on) also remove/restore data-mine-zoom (or have content.tsx sync from getComputedStyle(document.body).zoom / a MutationObserver on body style), and add a Large-mode hold step to tools/ext/e2e.cjs asserting the rail's bounding width is unchanged during hold.

[6] [high] Injected note / terms / plain / tagline widgets have no background: unreadable on dark sites  (extension/src/apply/css.ts:52)
   FIX: Give .note, .terms, .plain and .tagline `background: var(--paper)` (plus padding) like the other widgets, or pick the token set from the page's computed body background luminance; never set a fixed colour on the site's own text (use opacity or a paper-backed wrapper); use a two-tone focus ring (e.g. `outline: 3px solid var(--pencil); box-shadow: 0 0 0 5px #fff`) in high-contrast mode.

[7] [high] Applier counts the engine's stub ViewBlocks (stub-*) as collapsed secondary blocks, inflating every 'n items set aside' stub and misfiling them under main  (extension/src/apply/index.ts:84)
   FIX: Exclude stubs from the fold list: `tr.view.filter((b) => b.state === 'collapsed' && b.stubFor === undefined && b.kind !== 'nav' && b.kind !== 'action')` — or derive the collapsed ids from `tr.changes.filter(c => c.type === 'collapsed')` minus nav ids, which is what the contract table keys on. Add a widgets.test assertion that the main stub label equals the number of hidden+collapsed main blocks.

[8] [high] Surfaced-decision notes (mine-note) are inserted as siblings of the decision's box and are never step-hidden, so they float orphaned on every step  (extension/src/apply/index.ts:213)
   FIX: Record injected widgets per step: when inserting a note/aside for a block that belongs to a step, push the widget host into that step's stepBoxes entry (or keep a parallel `stepWidgets` array) so showStep() sets/unsets STEP_HIDDEN on it with the box. Alternatively insert the note inside the box (append to box) so it inherits the box's visibility.

[9] [high] 'Other options' stub is anchored at the first non-primary action in document order and stays visible on every step; Show does nothing until the last step  (extension/src/apply/index.ts:245)
   FIX: Treat the stub as part of the last step: add its host to stepBoxes[lastIndex] so it is hidden with the step, and anchor it after the last step's last primary action box (or the form's last box) rather than at otherOptionIds[0]. Consider limiting 'other options' folding to actions inside page.form (extractor already groups those, extract/index.ts:575-585) and leaving header/footer buttons in place, matching the frame branch at src/engine/steps.ts:54.

[10] [high] FAQ composite (question heading + following answer paragraph) gets a box that covers only the heading, so hiding/collapsing it leaves the answer as orphan text  (extension/src/extract/index.ts:398)
   FIX: Only emit the composite faq when a shared wrapper exists (the current 2-child case); otherwise do not consume the answer and emit the heading (kind heading/secondary) and the paragraph as separate text blocks. If the composite must be kept, extend ExtractedPage.boxes to allow several elements per block (or add `extraBoxes: Map<string, Element[]>`) and have the applier hide/step every box of a block. Add a fixture assertion that every faq block's box contains the answer text.

[11] [high] Overlapping applyPrefs runs leak a whole second edition past "Back to original" (no sequence token)  (extension/src/controller.ts:222)
   FIX: Give applyPrefs a monotonically increasing run id captured on entry; after every await (the setTimeout tick, fetchPlain, storage) return early if a newer run started. Alternatively serialise calls through a promise chain (this.queue = this.queue.then(...)). Never assign this.applied while another Applied is live: if a stale run reaches apply(), skip it. Add an e2e step that switches mode during a slow Plain rewrite and asserts zero leftovers after Reset.

[12] [high] Hold-to-compare cancels itself with a mouse in Large and shrinks the panel in every mode: compare() resets body zoom but leaves data-mine-zoom, so the panel's counter-zoom is wrong  (extension/src/apply/index.ts:294)
   FIX: In compare(on) also toggle the attribute the content script keys on: remove data-mine-zoom while comparing and restore it afterwards (or set it to '1'). Better structurally: mount mine-root on document.documentElement instead of body so it is never inside the zoomed subtree and the MutationObserver counter-zoom in content.tsx can be deleted. Add an e2e check that uses page.mouse on the hold button in Large and asserts data-mine-compare stays set for the duration of the press.

[13] [high] apply() moves focus into the page's first field on every apply: keyboard mode switching breaks and remembered sites steal focus on load; undo() never restores focus  (extension/src/apply/index.ts:239)
   FIX: Do not focus anything from the initial showStep(0); focus only on user-initiated step changes (stepper Back/Next already focus the stepper title, panel setStep can focus the title too). Record document.activeElement (and the panel's shadowRoot.activeElement) before mutating and restore it in undo() when the element is still connected. For the auto-apply path pass a flag so no focus ever moves without a gesture.

[14] [high] Sticky/fixed or 'float-*' containers holding the submit become one decorative notice and are hidden in every non-default preset  (extension/src/apply/index.ts:93)
   FIX: Never let the floating rule swallow or demote a primary action: in the extractor, skip floating() when the container holds a submit/primary action (walk its children instead), and never assign 'decorative' to an action whose label/type is primary. In apply, before hiding any box, check it does not contain a node of a critical block (deadline, required field/decision, primary action) and skip hiding it if so.

[15] [high] A deadline inside a sticky/floating/'float-*' container is classified as a decorative notice and hidden, with no callout  (extension/src/apply/index.ts:93)
   FIX: Run the deadline test before the floating test in classifyText (a dated sentence with a deadline word is critical wherever it sits), and in apply skip hiding any box whose text still parses as a deadline (findDeadline on textOf(box)) as a belt-and-braces guard.

[16] [high] Non-primary helper buttons are folded into one 'Other options' stub placed wherever the first of them sits, leaving them unreachable on other steps  (extension/src/apply/index.ts:245)
   FIX: Fold only actions that live in the last step's DOM neighbourhood (after the last field or beside the primary action); leave a non-primary button alone when its node sits inside an earlier step's box. Insert the 'Other options' stub next to the primary action's box (always in the last step) rather than before the first folded action, and expose the folded ids as a restorable change in the panel.

[17] [high] CAPTCHA image and image-only submit button read as decorative images and hidden  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/index.ts:457)
   FIX: Treat an <img> (or any element) with onclick / role=button / inside a[href^='javascript'] as an action (label from alt, title, aria-label, then the src basename humanised, else 'Submit'/'提交' when inside the form root). Never mark an <img> decorative when it sits inside the form root next to a text control (same td/row/box) — classify it as informative primary (importance primary) regardless of alt. Add both rows to the gov-table fixture.

[18] [high] 'I agree to the terms' checkboxes surfaced as optional decisions  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:70)
   FIX: Extend ATTESTATION with \bagree|\baccept|acknowledg|consent to|同意|已阅读|阅读并|知悉|接受 and test it against label + consequence text and against link texts inside the label (a checkbox whose label links to terms/privacy/协议/政策 is an attestation). Keep the pre-checked marketing case optional by requiring the phrase to be about terms/policy/承诺 rather than any 'agree'.

[19] [high] Checkbox with its label as trailing text is labelled 'Agree' and read as optional  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/fields.ts:235)
   FIX: For checkbox/radio controls with no label/aria/placeholder, read the following text node or first inline sibling (≤ 200 chars, before any other control) as the label before falling back to preceding text or the name; run ATTESTATION on label + help/consequence; add the two rows to the gov-table fixture asserting optional=false and label starting with 本人承诺 / 我已阅读.

[20] [high] Bootstrap/Tailwind float-* and consent classes, or a fixed #app, make content (even the deadline) a decorative notice  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:170)
   FIX: Drop 'float'/'floating'/'consent'/'feedback' from FLOAT_EXACT/FLOAT_PREFIX (keep chat/cookie/backtotop); require computed position fixed/sticky for anything else; in isFloatingWidget also return false when the element is an ancestor of the main root, precedes/contains the anchor heading, or when findDeadline/legal hits match its text; move the floating check in classifyText after the deadline and legal checks so critical content never degrades to decorative.

[21] [high] '.notice*' / '.alert' container classes demote a whole notice body; 日前 deadline phrasing not recognised  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:370)
   FIX: Apply container-class notice/promo only to containers that are small relative to main (e.g. ≤ 25% of main's text or ≤ 400 chars) and never to the largest text child of main or the container holding the page's body paragraphs. Add 日前|前完成|前报送|前提交|前将|以前|on or before to DEADLINE_WORDS. When a deadline word co-occurs with a yearless M月D日 / M/D date, keep the block primary text (or resolve the year from the document date) rather than letting a container class demote it.

[22] [high] Sticky/fixed top bar without header token turns the site menu into a hidden decorative notice  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:164)
   FIX: In isFloatingWidget return false when the element contains a nav-like descendant (run isNavLike over descendants, or isLinkList on any ul/ol inside) or when it is the first visible block-level element of body / precedes the anchor heading; in findRegions, treat the first sticky/fixed bar at the top of body that holds a link list as the header root.

[23] [medium] Page shift via html margin-right breaks 100vw layouts and does not move fixed site chrome; the comment claims otherwise; transition leaks  (extension/entrypoints/content.tsx:40)
   FIX: Either drop the shift and let the rail overlay (as the ≤720 px sheet already does), or keep it and: scope `html[data-mine-open]{overflow-x:clip}` in DOCUMENT_CSS, remove the inline transition on close, re-evaluate on resize, and rewrite the comment to say fixed elements are not moved.

[24] [medium] Panel 'Show' and on-page stub are two controls for one state and never sync (aria-expanded / aria-pressed lie)  (extension/src/apply/index.ts:106)
   FIX: Make Applied.restore the single owner of the state: have stub() return a handle with set(open), keep a map id→stub in apply(), update the stub button label/aria-expanded inside restore(), and pass an onRestored callback from the controller into apply() so state.restored is refreshed whichever control was used.

[25] [medium] Stepper never announces progress; its region label goes stale; focusing site inputs is a side effect on the site  (extension/src/apply/widgets.ts:149)
   FIX: Put aria-live="polite" on .progress (or announce via the panel live region), update the section aria-label in render(), add aria-describedby from the title to the progress text; stop focusing site inputs — focus the stepper title from the stepper and keep focus in the rail from the panel.

[26] [medium] Targets and focus rings below the product's own §12 contract; Large makes the panel the smallest UI on screen  (extension/src/panel/panel.css.ts:19)
   FIX: Raise min-height/min-width to 44 px (48 px when html[data-mine-large]); scale the panel with the chosen fontScale instead of fully cancelling it (e.g. counter-zoom to max(1/z, 0.8) or set :host font-size from a --mine-scale variable); add one shared `:focus-visible { outline: 3px solid var(--pencil); outline-offset: 2px }` rule in PANEL_CSS.

[27] [medium] User-facing strings hardcoded in controller/applier instead of copy.ts; one string has no key; wrong hide label on 'Other options'  (extension/src/controller.ts:249)
   FIX: Replace every literal with t()/tn() (add ext.plainUnavailable), use step.other.hide for the Other-options stub, delete or wire the unused keys, and correct the width in EXTENSION.md.

[28] [medium] 'Remembered for {host}. It will open this way next time.' shows in the wrong state and is sometimes false  (extension/src/controller.ts:265)
   FIX: Derive the line from whether a memory exists for this host (keep a `memory` field in state set by init() and applyPrefs), only write/claim memory when !isDefault(prefs), and use the same host fallback ('local' / 'this file') in the panel.

[29] [medium] A page-wide <form> (ASP.NET WebForms pattern) becomes the form root: stepper lands above the site header and header/footer buttons are grouped into the last step  (extension/src/extract/fields.ts:170)
   FIX: In chooseFormRoot, when the winning <form> contains ctx.main, contains any region root, or holds >50 % of body text, narrow it to the lowest common ancestor of its controls (reuse the existing no-form branch, lines 171-176). In finishSteps only group actions inside that narrowed root. In the applier, when page.form contains page.main, anchor the stepper at stepBoxes[0][0] instead of form.firstElementChild.

[30] [medium] Controls outside the main form (footer newsletter input) are assigned to the main form's heading step and counted as its fields  (extension/src/extract/steps.ts:60)
   FIX: When a real form root exists, controls outside it should either be skipped as site chrome (like search boxes, fields.ts:116) or put into their own trailing group titled by their region ('Footer' / '页脚'), and never joined to a heading group that lives inside ctx.form. Document the choice in EXTENSION.md §1 'Steps'.

[31] [medium] A region root hidden as a whole is shown again by restore(on) but never re-hidden by restore(off), leaving an empty region shell  (extension/src/apply/index.ts:285)
   FIX: Remember which roots were hidden as whole regions (a Set from step 1) and, in restore(off), re-add HIDDEN to the root when no id of that region remains in restoredIds. Add a widgets/apply test: apply → restore(on) → restore(off) leaves the root hidden.

[32] [medium] When re-extraction fails on a re-rendered page, the controller keeps the old tr/page/mode/stepCount: the panel claims Focus is applied while nothing is  (extension/src/controller.ts:235)
   FIX: On every early return also reset the edition state: tr: null, page: null, stepCount: 0, stepIndex: 0, comparing: false, restored: new Set(), mode: 'default', prefs: DEFAULT_PREFERENCES, remembered: false (or, cleaner, extract first and only undo the previous edition once the new extraction succeeded, so a failed switch keeps the old edition consistent). compare()/restore()/setStep() should no-op state updates when this.applied is null.

[33] [medium] The in-page stepper never notifies the controller: panel step counter and Back/Next go stale and jump the user backwards  (extension/src/apply/index.ts:263)
   FIX: Let apply() take an onStep(i) callback (or return an EventTarget) invoked from showStep, and have the controller set({ stepIndex }) from it; Controller.setStep should read back stepIndex() as it does now. Add an e2e assertion comparing the stepper's progress text with the panel's after walking with the page stepper.

[34] [medium] Stub 'Show/Set aside again' and the panel's per-change restore button run two disconnected states  (extension/src/apply/index.ts:106)
   FIX: Route stub toggles through the controller (pass an onRestore callback into apply, or have api.restore emit an event the controller subscribes to) and have Applied.restore() refresh every stub in stubFor for the affected ids (aria-expanded + label derived from restoredIds). Keep a single source of truth: restoredIds in Applied, mirrored into state.restored after every change from either side.

[35] [medium] 'Go to it on the page' double-click leaves a permanent blue outline that survives Back to original  (extension/src/apply/index.ts:143)
   FIX: Implement the flash as an attribute (data-mine-flash) styled by DOCUMENT_CSS, guard re-entry (clear any pending timer before starting a new one, keep the first captured prev), and in undo() clear pending timers and remove the attribute/inline outline.

[36] [medium] Plain rewrites replace a node's children through innerHTML, destroying node identity; undo() reproduces the markup but not the nodes, so framework-managed text breaks  (extension/src/apply/index.ts:171)
   FIX: Never serialise: move the original child nodes (el.append is fine — append(...Array.from(el.childNodes)) into origSpan) and on undo move the same nodes back into el, so identity is preserved; or leave el's children untouched and hide them with an attribute while showing the plain text in a sibling widget (mine-plain), which is already the annotated path. Extend plainTextSafe to reject custom elements, shadow hosts and contenteditable.

[37] [medium] restore(ids, false) re-hides the boxes but not the region root it un-hid, leaving an empty visible column  (extension/src/apply/index.ts:284)
   FIX: In restore(off), after re-hiding the boxes, re-hide the region root when it was hidden by apply and no block of that region remains in restoredIds (track the set of roots apply hid). The same rule should apply when the panel restores a change that spans several regions.

[38] [medium] Bootstrap-style '.invalid-feedback' validation messages carry the 'feedback' float token and are hidden in Focus, Plain and Large  (extension/src/apply/index.ts:93)
   FIX: Remove 'feedback' (and 'consent') from the floating class tokens, or require positioned (fixed/sticky) OR a class token AND being outside the form root; never classify an element inside page.form (or one that follows a control within the same box) as a floating widget. Treat elements with class tokens error/invalid/feedback near a control as help/error text and keep them visible.

[39] [medium] role=alert / .alert / .notice / .warning content is 'secondary' and is display:none'd in Focus (hidden) and in Plain/Large ('folded' uses the same attribute)  (extension/src/apply/index.ts:84)
   FIX: Exempt live regions and error containers from hiding/folding: in classifyText give role=alert/role=status (and class tokens error/invalid) importance 'critical' or at least 'primary'; in apply, never set data-mine-hidden on a box that is, or is inside, [role=alert], [role=status], [aria-live]. Consider a real 'collapsed' rendering (summary line + expand) instead of display:none for secondary blocks in comfortable density.

[40] [medium] Whole-region hiding removes content that never became a block (unlabeled/search/nav controls, short links, everything past maxBlocks)  (extension/src/apply/index.ts:96)
   FIX: Only hide a region root when it holds no element the extractor did not account for: check root.querySelector('input:not([type=hidden]),select,textarea,button,a[href],[role=button],iframe') outside the hidden boxes is empty, and never hide a root when extraction stopped early (expose a `truncated` flag from extractPage). Otherwise hide only the boxes.

[41] [medium] apply() steals keyboard focus into the site's form on every mode/language change and on remembered-site load  (extension/src/apply/index.ts:239)
   FIX: Do not call focus() from showStep when the change did not originate from a user gesture on the stepper: pass a `focus: boolean` argument (true only from the stepper buttons/panel step buttons), and on initial apply move focus to the stepper title or leave it where it was (save document.activeElement before apply and restore it, when it is still connected).

[42] [medium] A surfaced-decision note (and plain aside / terms) can be inserted inside a wrapping <label>, so clicking Mine's note toggles the checkbox  (extension/src/apply/index.ts:213)
   FIX: When inserting after a decision/field box, walk up from the box: if any ancestor is a <label> (or the box itself is), insert after that label instead (or after the control's nearest non-label ancestor). Give injected widgets a click handler that calls preventDefault() on label activation as a second guard.

[43] [medium] Radio group in a table cell with trailing text labels: wrong options and lost choice  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/fields.ts:345)
   FIX: For radio/checkbox members prefer the following text node / inline sibling before any other source, fall back to `value`, and exclude a member's preceding text when it is the same element the group would use as its label (or when the member is the first radio and the text is outside the members' own container). Add this row to the gov-table fixture asserting label 性别 and options 男/女.

[44] [medium] Element UI (Vue) radios and checkboxes are aria-hidden → decisions vanish; placeholder and CSS-only asterisks lose required  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/text.ts:89)
   FIX: Do not treat aria-hidden as hidden for input[type=checkbox|radio] that sit inside a <label> or have a visible sibling label span (framework artefact); collect them and read the label from the wrapping label's visible text. Prefer a visible <label> in the same form-item/row (even without for) over placeholder. Derive required from ancestor classes (is-required|required|ant-form-item-required|asterisk) and from a preceding * sibling of the label. Add an Element UI fixture.

[45] [medium] Promo/header class rules catch primary content: .banner CTA, .feedback form, .page-header title  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/index.ts:295)
   FIX: Composite promo only when the container has no heading and no primary-looking action (isPrimaryAction on any a/button inside); drop 'feedback' and 'rating' from the container token lists (keep them in PROMO_TEXT). For header-root-by-class, require the element to precede the anchor heading and not contain it, and prefer semantic <header>/first top-level bar; treat page-header/card-header/modal-header tokens as content.

[46] [medium] Main root too narrow: content after the article (the application form) or outside the biggest table row falls into footer/header  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/regions.ts:192)
   FIX: Never descend past the chosen form root or into an element that does not contain every collected control that lies outside header/footer/sidebar roots; stop descent at table, tbody, tr, td and form. After choosing main, if controls exist outside main and outside other roots, widen main to the lowest common ancestor of main and those controls.

[47] [medium] Tab bars for hidden panes become a secondary nav that Focus hides while the required fields in those panes are unreachable  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:232)
   FIX: A link list whose links are all same-document fragments (href starts with #), or that carries role=tablist / data-toggle=tab / ui-tabs-nav, is not navigation: emit it as primary actions (one per tab) or as a nav with importance primary. Optionally collect controls inside the panes those fragments point to and mark them as belonging to that tab's step.

[48] [low] Two language controls behave differently; header toggle's accessible name does not contain its visible label  (extension/src/controller.ts:134)
   FIX: Have saveSettings re-apply when the resolved lang changes (same path as setLang); drop the aria-label on the header toggle or make it 'Switch to Chinese (中文)' so the visible text is contained.

[49] [low] My words: unlabeled textarea, silent working state, focus dropped when Transform disables, h3 before h2  (extension/src/panel/Panel.tsx:111)
   FIX: aria-label={t(lang,'words.title')} on the textarea (or aria-labelledby the h3), aria-busy on the section and route status through the live region, use aria-disabled instead of disabled while working, mention the shortcut in words.hint or the button title, and move the h2 above the mode strip so section h3s follow it.

[50] [low] Motion ignores prefers-reduced-motion (rail slide, html margin transition, smooth scroll)  (extension/src/panel/panel.css.ts:12)
   FIX: Add `@media (prefers-reduced-motion: reduce) { .rail { transition: none } }`, skip the inline html transition when matchMedia('(prefers-reduced-motion: reduce)').matches, and pass behavior:'auto' to scrollIntoView in that case.

[51] [low] Deadline callout label concatenates without separators; settings input border fails non-text contrast  (extension/src/apply/widgets.ts:69)
   FIX: Insert ' · ' / spaces between the spans (or use a <dl>), and use var(--graphite) or var(--ink) for form-control borders in the panel.

[52] [low] Widgets inserted as siblings of tr/li/td produce invalid table and list structure  (extension/src/apply/index.ts:213)
   FIX: When the anchor's parent is tr/tbody/table/ul/ol/dl, insert the widget inside the anchor (append to the last cell / the li) or wrap it in a matching row/item; keep the same fallback for the deadline callout.

[53] [low] Only the first root per region name is hidden or used as the stub anchor; a second sidebar/utility root stays as an empty shell  (extension/src/extract/regions.ts:169)
   FIX: Expose roots per name as a list (regions: Map<string, Element[]>) or expose blockRoot: Map<blockId, Element>, and let the applier group hidden ids by root element rather than by region name.

[54] [low] A deadline that is both moved and rewritten keeps state 'moved', so the applier never shows a plain version or 'Show original' on the page although the change list says it was rewritten  (src/engine/transform.ts:239)
   FIX: In the applier, treat `b.original !== undefined` as the rewrite signal regardless of state (or check `'plainText' in b && b.text !== original`), and render the tagline/aside on the original node; or have the callout show both plain and original texts.

[55] [low] Secondary link lists (sidebar 'Related links') collapsed by rule 2 are rendered as a 'Menu (n)' stub and split from the region's folded stub  (extension/src/apply/index.ts:113)
   FIX: Route only navs with importance primary/critical (the engine's isMenu) to the 'Menu (n)' stub, and fold secondary navs into the region's collapsed group with their names; for a hidden site menu (hidden change containing the menu id) emit the 'Menu (n)' stub as the contract table specifies.

[56] [low] Panel close keeps focus inside the aria-hidden rail and there is no Escape to close (CLAUDE.md §12: Escape closes popovers)  (extension/src/panel/Panel.tsx:202)
   FIX: Add a keydown listener on the rail (or the shadow host) for Escape → c.setOpen(false); in setOpen(false) move focus to the .fab (or the element that had focus before opening, stored on open). Optionally set inert on the rail when closed instead of aria-hidden alone.

[57] [low] SPA route changes leave the old edition's hidden attributes, stubs and zoom on the persistent site chrome with no navigation hook  (extension/src/controller.ts:100)
   FIX: Wrap history.pushState/replaceState and listen to popstate (plus hashchange) in the content script; on URL change either undo and clear state (safe default) or, for remembered sites, undo then re-apply after the app settles (debounced MutationObserver on page.main). Surface a notice in the panel when the current edition predates the URL.

[58] [low] undo() inventory gaps: document-level stylesheet, html transition, scroll position are never restored  (extension/src/apply/index.ts:29)
   FIX: Remove the transition property together with margin-right on close (or set both via a data attribute + injected rule). Remove #mine-document-css in undo() when no Applied is live, or document it as the one intentional residue. Record activeElement/scrollY before apply and restore them in undo when sensible.

[59] [low] Mode radio and FAB snap back to Default during a preset's async apply (Plain rewrite wait), misreporting the user's choice  (extension/src/controller.ts:150)
   FIX: Set { mode, prefs, status } at the start of applyPrefs (as selectMode('words') already does) and disable the mode radiogroup while status is non-null; on failure revert to 'default'.

[60] [low] innerHTML swap replaces the paragraph's children with serialized copies and undo() writes back a stale snapshot  (extension/src/apply/index.ts:181)
   FIX: Instead of serializing, move the original child nodes into origSpan (append the live nodes) and on undo move them back — identity and listeners survive. In undo, only restore when the element's current content is still Mine's (compare to the spans you inserted); otherwise leave the site's newer content. Extend plainTextSafe to reject [onclick], [tabindex], [role], output, progress, meter, details/summary and any tag containing '-'.

[61] [low] The engine's own stub ViewBlocks (stub-main, stub-sidebar…) are counted as folded blocks, inflating the stub's 'n items set aside'  (extension/src/apply/index.ts:84)
   FIX: Exclude ViewBlocks that carry `stubFor` (and any id not present in page.content.blocks) when building collapsedSecondary/foldGroups.

[62] [low] Image-only calls to action are hidden as decorative images  (extension/src/apply/index.ts:93)
   FIX: Treat an <img> whose nearest ancestor is an <a href> (or a button) as an action/image with importance 'primary' regardless of alt/class, and never hide it; label it from alt/title/href.

[63] [low] Header search <form> chosen as the form root on SPA pages whose fields are not in a <form>  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/fields.ts:155)
   FIX: Ignore candidate forms whose controls all sit in header/utility/footer roots or that hold fewer than two controls when two or more controls exist outside any form; pick the form root by controls inside main, falling back to the common wrapper. Add a Tailwind/MUI SPA fixture.

[64] [low] Lists of required attachment/download links read as secondary navigation  (/Users/ningtiaolovegood/Documents/Claude/mine/extension/src/extract/kinds.ts:232)
   FIX: In main, a link list whose link texts look like documents (附件|模板|表|.doc|.pdf|.xls|download|form) — or that is preceded by a text block ending in 附件/attachments — should be emitted as an instruction/text block of importance primary (items joined), not as nav.

--- verdicts ---
REAL Confirmed by reading the code and by running the extractor + engine on a minimal fixture.  Code path (all verified): - /Users/ningtiaolovegood/Documents/Claude/
REAL CONFIRMED by reading the code and executing the scenario through the real extractor + engine (happy-dom, vitest).  Chain, with lines: 1. Token matching — extens
REAL I could not refute it; the claim traces cleanly and reproduces against the real extractor + engine.  Trace (all cited lines verified by reading the code): - ext
REAL Could not refute; reproduced end-to-end in happy-dom (extract → engine Focus/Plain/Large → apply). Trace for `<main><h1>Grant</h1><div class="float-right"><p>Ap
REAL Confirmed by tracing the code and by a happy-dom run of the exact scenario (temporary vitest file, 5/5 assertions passed, then deleted).  Extraction (extension/
REAL Confirmed by running the real extractor → engine → applier chain under vitest/happy-dom. The floating-widget rule pre-empts deadline detection in two places, an
REAL Confirmed by code trace and by running the scenario through extractPage + transform(PRESETS.focus) in happy-dom (throwaway test under extension/test/, deleted a
REAL Confirmed by reading the code and by an end-to-end run. In extension/src/extract/kinds.ts, isLinkList (:232-236) only counts visible li items whose link text is
REAL Confirmed by code reading and a live extractor + engine run (happy-dom vitest, 8/8 assertions passed; temp test deleted afterwards).  Mechanism, cited: 1. `exte
REAL Confirmed against the code and by running the full extract → transform(Focus) → apply pipeline under happy-dom.  Mechanism (all cited from the repo): - src/engi
REAL Confirmed end-to-end (extract → engine transform → apply) under happy-dom with a minimal gov-style table form.  Code path, verified against source: - extension/
REAL Confirmed by reading the code and by a happy-dom reproduction (temporary test written in the repo's tmp-repro-*.test.ts style, run, then deleted). The full chai
REAL Could not refute it; the exact code path produces the wrong outcome and I reproduced it end-to-end (extract → transform(PRESETS.focus) → apply) in happy-dom for
REAL Confirmed by reading the code path and by running both scenarios through extractPage under happy-dom (temp test since deleted).  Trace, all in /Users/ningtiaolo
REAL Confirmed in code, in happy-dom, and in real Chromium with the built extension (extension/.output/chrome-mv3, newer than every source file).  Code path (all fil
REAL CONFIRMED by code trace and a happy-dom reproduction (temporary vitest file, since deleted; the repo's own 9 test files stay green).  Trace (all paths absolute 
REAL Confirmed by reading the code and running the extractor + engine + applier under happy-dom. Path: extension/src/extract/kinds.ts:164-176 `isFloatingWidget` trea
REAL Confirmed by running extractPage on two minimal fixtures (plus one variant) with the project's happy-dom test setup. Root cause is exactly as claimed: resolveLa
REAL Confirmed. The class-only path is exactly as claimed. `FLOAT_EXACT` at extension/src/extract/kinds.ts:74 contains 'float', 'floating' and 'consent'; `classToken
REAL Confirmed by code trace and an empirical happy-dom run (temporary vitest file under extension/test/, deleted afterwards; tree clean).  Exact lines producing the
