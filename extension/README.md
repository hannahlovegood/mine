# Mine · 由我 — browser extension

The freedom layer on the page you are actually on. The real form stays the real form: you type into
the site's own inputs and submit with the site's own button. Mine sets aside, folds, echoes the
deadline, steps the form, surfaces pre-checked choices, enlarges — every change listed in the panel,
every change reversible, nothing auto-decided.

## Load it (Chrome, Edge, Brave, Arc — any Chromium)

```bash
cd extension && npm install && npm run build     # → extension/.output/chrome-mv3
```

Then `chrome://extensions` → Developer mode → Load unpacked → pick `extension/.output/chrome-mv3`.
Open any page and press the floating "Make it mine" button (or `Alt+Shift+M` for the panel,
`Alt+Shift+I` for Focus / back to original).

## What it does on a page

1. **Reads the page** into blocks (menu, headings, passages, the deadline, fields, checkboxes, buttons, images, sidebar, footer) — `src/extract/`.
2. **Runs the same engine** as the web demo (`../src/engine`, pure and tested).
3. **Applies the edition in place** — `src/apply/`: hidden blocks get `data-mine-hidden`, one stub per region says how many were set aside and shows them again; the deadline is echoed at the top; the form becomes one step at a time with a stepper; optional pre-checked boxes get a note (never unchecked); Large zooms the page. Hold to compare shows the page as published; Back to original removes every attribute and node Mine added.
4. **Remembers the site**: the mode you chose reopens with the page next time (per hostname, stored locally).

Plain language and My words (by model) need a server: put the web demo's URL (or `http://localhost:4173` from `npm run demo`) under Settings in the panel. Without one, My words uses the offline interpreter and Plain skips the rewrites; everything else is offline.

## Tests

```bash
npm test            # extractor on fixtures (happy-dom)
npm run typecheck
# end to end, with the built extension loaded in Chromium:
NODE_PATH=<node_modules with playwright> node ../tools/ext/e2e.cjs
```

## Limits (honest)

Pages behind a login or rendered late by a framework are read when you press the button, not before; if a page re-renders itself, press Back to original and Make it mine again. Extraction is heuristic: a block Mine cannot classify is left as it is (never hidden). Plain-language rewrites are validated (every number must survive) and dropped otherwise.
