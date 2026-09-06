// End-to-end with the built extension loaded in Chromium. The panel is Chrome's side panel, driven
// here as an ordinary page: chrome-extension://<id>/sidepanel.html?tab=<tabId> (the app reads ?tab).
//   NODE_PATH=<node_modules with playwright> node tools/ext/e2e.cjs
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { mkdtempSync, mkdirSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { extname, join } = require('node:path');

(async () => {
  const ROOT = join(__dirname, '..', '..');
  const EXT = join(ROOT, 'extension', '.output', 'chrome-mv3');
  const FIX = join(ROOT, 'extension', 'test', 'fixtures');
  const SHOTS = join(ROOT, 'docs', 'shots', 'extension');
  mkdirSync(SHOTS, { recursive: true });
  const MIME = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    try { const body = await readFile(join(FIX, p)); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${srv.address().port}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mine-ext-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const tabIdFor = async (url) => sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, url);

  let panel = null;
  const openPanel = async (url) => {
    const tabId = await tabIdFor(url);
    if (panel) await panel.close();
    panel = await ctx.newPage();
    panel.on('pageerror', (e) => errors.push('[panel] ' + String(e)));
    panel.on('console', (m) => { if (m.type() === 'error') errors.push('[panel] ' + m.text()); });
    await panel.setViewportSize({ width: 380, height: 900 });
    await panel.goto(`chrome-extension://${extId}/sidepanel.html?tab=${tabId}`);
    await panel.waitForSelector('.opening, .edition, .blocked', { timeout: 8000 });
    await sleep(200);
  };
  const clickText = async (pg, selector, text) => {
    const loc = pg.locator(selector).filter({ hasText: text }).first();
    await loc.click();
  };
  const mode = async (name) => { await clickText(panel, '.pill, .tile', name); await sleep(900); };

  for (const lang of ['en', 'zh']) {
    const L = lang === 'zh';
    const url = `${BASE}/portal-${lang}.html`;
    await page.goto(url); await sleep(600);
    check(`fab on the page ${lang}`, await page.evaluate(() => !!document.querySelector('mine-root')?.shadowRoot?.querySelector('.fab')));
    await openPanel(url);
    check(`panel shows the opening ${lang}`, (await panel.locator('.opening').count()) === 1);
    check(`opening has one primary button ${lang}`, (await panel.locator('.opening .primary').count()) === 1);
    await panel.screenshot({ path: join(SHOTS, `panel-opening-${lang}.png`) });

    // Make it mine → Focus
    await panel.locator('.opening .primary').click(); await sleep(1200);
    check(`edition view after make it mine ${lang}`, (await panel.locator('.edition').count()) === 1);
    const summary = await panel.locator('.summary').innerText().catch(() => '');
    check(`summary with numbers ${lang}`, /\d/.test(summary), summary);
    const hidden = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden]').length);
    check(`page has set-aside elements ${lang}`, hidden >= 5, `${hidden}`);
    check(`stepper on the page ${lang}`, await page.evaluate(() => !!document.querySelector('mine-stepper')));
    check(`deadline echoed ${lang}`, /2026/.test(await page.evaluate(() => document.querySelector('mine-callout')?.shadowRoot?.querySelector('.callout')?.textContent ?? '')));
    check(`submit visible on the last step ${lang}`, await page.evaluate(() => { const b = document.querySelector('.portal button.primary'); return !!b; }));
    await panel.screenshot({ path: join(SHOTS, `panel-focus-${lang}.png`), fullPage: true });
    await page.screenshot({ path: join(SHOTS, `focus-${lang}.png`) });

    // Walk to the choice step from the panel
    let sawChoice = false;
    for (let i = 0; i < 8; i++) {
      const isChoice = await page.evaluate(() => { const st = document.querySelector('mine-stepper')?.shadowRoot; const c = st?.querySelector('.choice'); return !!c && c.style.display !== 'none'; });
      if (isChoice) {
        sawChoice = true;
        check(`choice step keeps the box checked ${lang}`, await page.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].find((el) => el.getClientRects().length > 0)?.checked === true));
        check(`optional note shown ${lang}`, (await page.evaluate(() => [...document.querySelectorAll('mine-note')].map((n) => n.shadowRoot?.querySelector('.note')?.textContent ?? '').join(''))).length > 10);
        await page.screenshot({ path: join(SHOTS, `choice-${lang}.png`) });
        break;
      }
      const next = panel.locator('.steps .small').nth(1);
      if (await next.isDisabled()) break;
      await next.click(); await sleep(250);
    }
    check(`a choice step exists ${lang}`, sawChoice);
    const panelStep = await panel.locator('.steps span').innerText();
    const pageStep = await page.evaluate(() => document.querySelector('mine-stepper')?.shadowRoot?.querySelector('.progress span')?.textContent ?? '');
    check(`panel and page agree on the step ${lang}`, panelStep === pageStep, `${panelStep} / ${pageStep}`);

    // Restore from the panel, then set aside again
    const first = panel.locator('.rows .link').first();
    await first.click(); await sleep(300);
    const after = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden]').length);
    check(`restore from panel unhides ${lang}`, after < hidden, `${hidden} → ${after}`);
    await first.click(); await sleep(200);

    // Hold to compare from the panel
    const hold = panel.locator('.hold');
    const box = await hold.boundingBox();
    await panel.mouse.move(box.x + 20, box.y + box.height / 2); await panel.mouse.down(); await sleep(250);
    check(`hold shows the original ${lang}`, await page.evaluate(() => document.documentElement.hasAttribute('data-mine-compare')));
    await panel.mouse.up(); await sleep(200);
    check(`release ${lang}`, !(await page.evaluate(() => document.documentElement.hasAttribute('data-mine-compare'))));

    // Large
    await mode(L ? '大字' : 'Large');
    check(`large zooms ${lang}`, (await page.evaluate(() => document.body.style.zoom)) === '1.6');
    await panel.screenshot({ path: join(SHOTS, `panel-large-${lang}.png`) });

    // My words (offline)
    await mode(L ? '我的话' : 'My words'); await sleep(300);
    await panel.locator('textarea').fill(L ? '安静一点，一次一个决定，字大一点' : 'quieter, one decision at a time, bigger text');
    await clickText(panel, 'button.primary', L ? '为我重排' : 'Transform'); await sleep(1500);
    check(`my words badge ${lang}`, (await panel.locator('.badge').count()) === 1, await panel.locator('.badge').innerText().catch(() => ''));
    check(`my words applied ${lang}`, await page.evaluate(() => !!document.querySelector('mine-stepper')));
    await panel.screenshot({ path: join(SHOTS, `panel-words-${lang}.png`), fullPage: true });

    // Settings sheet: opens, Escape closes
    await panel.locator('.gear').click(); await sleep(150);
    check(`settings sheet opens ${lang}`, (await panel.locator('.sheet').count()) === 1);
    await panel.keyboard.press('Escape'); await sleep(150);
    check(`escape closes settings ${lang}`, (await panel.locator('.sheet').count()) === 0);

    // Back to original
    await panel.locator('.reset').click(); await sleep(500);
    const left = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden], [data-mine-injected], [data-mine-mark], [data-mine-step-hidden]').length);
    check(`back to original leaves nothing ${lang}`, left === 0 && (await page.evaluate(() => document.body.style.zoom)) === '', `${left}`);
    check(`panel back to the opening ${lang}`, (await panel.locator('.opening').count()) === 1);

    // Remembered site
    await mode(L ? '专注' : 'Focus'); await sleep(600);
    await page.reload(); await sleep(1800);
    check(`remembered site reopens in Focus ${lang}`, await page.evaluate(() => !!document.querySelector('mine-stepper')));
    await openPanel(url);
    check(`panel reflects the remembered edition ${lang}`, (await panel.locator('.edition').count()) === 1);
    await panel.locator('.reset').click(); await sleep(400);

    // SPA route change undoes
    await mode(L ? '专注' : 'Focus'); await sleep(600);
    await page.evaluate(() => history.pushState({}, '', '/app/step-2'));
    await sleep(400);
    check(`route change undoes the edition ${lang}`, (await page.evaluate(() => document.querySelectorAll('[data-mine-injected]').length)) === 0);
    await page.goto(url); await sleep(800);
    await openPanel(url); await panel.locator('.reset').click().catch(() => undefined); await sleep(300);
  }

  // Other fixtures: Focus never disables a real control
  for (const f of readdirSync(FIX).filter((x) => x.endsWith('.html') && !x.startsWith('portal-'))) {
    const url = `${BASE}/${f}`;
    await page.goto(url); await sleep(500);
    await openPanel(url);
    if ((await panel.locator('.opening .primary').count()) === 1) { await panel.locator('.opening .primary').click(); await sleep(800); }
    const enabled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea, button')].every((el) => !el.disabled || el.closest('mine-root')));
    check(`focus on ${f}`, enabled);
    await page.screenshot({ path: join(SHOTS, `fixture-${f.replace('.html', '')}.png`) });
    await panel.locator('.reset').click().catch(() => undefined); await sleep(200);
  }

  check('console: zero errors', errors.length === 0, errors.slice(0, 4).join(' || '));
  await ctx.close(); srv.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
