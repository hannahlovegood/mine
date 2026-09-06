// Loads the built extension in Chromium and walks the storyline on the fixture pages:
// Make it mine → Focus (stubs, deadline echo, stepper, choice step, surfaced note),
// restore from the panel, hold-to-compare, Large (zoom), My words (offline), back to original,
// remembered site (reload → still Focus). Also opens each hand-written fixture in Focus and checks
// nothing throws and the real inputs are still there and enabled.
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
const MIME = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript' };
const srv = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const body = await readFile(join(FIX, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mine-ext-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

// helpers reaching into the panel's shadow root
const inPanel = async (fn, arg) => page.evaluate(([f, a]) => {
  const root = document.querySelector('mine-root')?.shadowRoot;
   
  return new Function('root', 'arg', `return (${f})(root, arg)`)(root, a);
}, [fn.toString(), arg]);
const clickInPanel = async (selector, text) => {
  const ok = await inPanel((root, { selector, text }) => {
    const els = [...root.querySelectorAll(selector)];
    const el = text ? els.find((e) => e.textContent.trim().startsWith(text)) : els[0];
    if (!el) return false;
    el.click();
    return true;
  }, { selector, text });
  if (!ok) throw new Error(`panel element not found: ${selector} ${text ?? ''}`);
};
const chooseMode = async (id) => {
  await inPanel((root, id) => {
    const input = root.querySelector(`input[name="mine-mode"][value="${id}"]`);
    input.click();
  }, id);
};

for (const lang of ['en', 'zh']) {
  await page.goto(`${BASE}/portal-${lang}.html`);
  await sleep(700);
  check(`fab present ${lang}`, (await inPanel((root) => !!root.querySelector('.fab'))) === true);
  await clickInPanel('.fab');
  await sleep(200);
  check(`panel opens ${lang}`, await inPanel((root) => root.querySelector('.rail')?.hasAttribute('data-open')));
  await chooseMode('focus');
  await sleep(900);
  const summary = await inPanel((root) => root.querySelector('.summary')?.textContent ?? '');
  check(`focus summary ${lang}`, /\d/.test(summary), summary);
  const hidden = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden]').length);
  check(`set-aside elements hidden ${lang}`, hidden >= 5, `${hidden}`);
  const stubs = await page.evaluate(() => document.querySelectorAll('mine-stub').length);
  check(`stubs injected ${lang}`, stubs >= 1, `${stubs}`);
  const callout = await page.evaluate(() => document.querySelector('mine-callout')?.shadowRoot?.querySelector('.callout')?.textContent ?? '');
  check(`deadline echoed at the top ${lang}`, /2026/.test(callout), callout.slice(0, 80));
  const stepper = await page.evaluate(() => !!document.querySelector('mine-stepper'));
  check(`stepper injected ${lang}`, stepper);
  const visibleInputs = await page.evaluate(() => [...document.querySelectorAll('.portal input, .portal select, .portal textarea')].filter((el) => el.getClientRects().length > 0 && el.type !== 'checkbox').length);
  check(`only the current step's fields are visible ${lang}`, visibleInputs > 0 && visibleInputs <= 6, `${visibleInputs}`);
  const allInputsEnabled = await page.evaluate(() => [...document.querySelectorAll('.portal input, .portal select, .portal textarea')].every((el) => !el.disabled));
  check(`real inputs untouched (enabled) ${lang}`, allInputsEnabled);
  await page.screenshot({ path: join(SHOTS, `focus-${lang}.png`), fullPage: false });

  // Walk to the choice step
  let sawChoice = false;
  for (let i = 0; i < 8; i++) {
    const isChoice = await page.evaluate(() => {
      const st = document.querySelector('mine-stepper')?.shadowRoot;
      const c = st?.querySelector('.choice');
      return c && c.style.display !== 'none';
    });
    if (isChoice) {
      sawChoice = true;
      const checked = await page.evaluate(() => {
        const box = [...document.querySelectorAll('input[type=checkbox]')].find((el) => el.getClientRects().length > 0);
        return box ? box.checked : null;
      });
      check(`choice step keeps the box pre-checked ${lang}`, checked === true, String(checked));
      const noteText = await page.evaluate(() => [...document.querySelectorAll('mine-note')].map((n) => n.shadowRoot?.querySelector('.note')?.textContent ?? '').join(' | '));
      check(`optional + pre-checked note shown ${lang}`, noteText.length > 10, noteText.slice(0, 120));
      await page.screenshot({ path: join(SHOTS, `choice-${lang}.png`), fullPage: false });
      break;
    }
    const moved = await page.evaluate(() => {
      const st = document.querySelector('mine-stepper')?.shadowRoot;
      const next = st?.querySelector('.btn.primary');
      if (!next || next.disabled) return false;
      next.click();
      return true;
    });
    if (!moved) break;
    await sleep(150);
  }
  check(`a choice step exists ${lang}`, sawChoice);

  // Restore from the panel
  await clickInPanel('.changes .link');
  await sleep(200);
  const restored = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden]').length);
  check(`restore from the panel unhides ${lang}`, restored < hidden, `${hidden} → ${restored}`);
  await clickInPanel('.changes .link');
  await sleep(100);

  // Hold to compare
  await inPanel((root) => root.querySelector('.hold').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await sleep(150);
  check(`hold shows the original ${lang}`, await page.evaluate(() => document.documentElement.hasAttribute('data-mine-compare')));
  const visibleWhileHeld = await page.evaluate(() => [...document.querySelectorAll('[data-mine-hidden]')].filter((el) => el.getClientRects().length > 0).length);
  check(`hidden blocks visible while held ${lang}`, visibleWhileHeld > 0, `${visibleWhileHeld}`);
  await inPanel((root) => root.querySelector('.hold').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await sleep(100);
  check(`release ${lang}`, !(await page.evaluate(() => document.documentElement.hasAttribute('data-mine-compare'))));

  // Large: zoom
  await chooseMode('large');
  await sleep(700);
  const zoom = await page.evaluate(() => document.body.style.zoom);
  check(`large zooms the page ${lang}`, zoom === '1.6', zoom);
  await page.screenshot({ path: join(SHOTS, `large-${lang}.png`), fullPage: false });

  // My words (offline)
  await chooseMode('words');
  await sleep(200);
  await inPanel((root, text) => {
    const ta = root.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, lang === 'zh' ? '安静一点，一次一个决定，字大一点' : 'quieter, one decision at a time, bigger text');
  await sleep(100);
  await clickInPanel('.btn', lang === 'zh' ? '为我重排' : 'Transform');
  await sleep(1200);
  const badge = await inPanel((root) => root.querySelector('.badge')?.textContent ?? '');
  check(`my words offline badge ${lang}`, badge.length > 0, badge);
  check(`my words applied (stepper back) ${lang}`, await page.evaluate(() => !!document.querySelector('mine-stepper')));
  await page.screenshot({ path: join(SHOTS, `words-${lang}.png`), fullPage: false });

  // Back to original
  await clickInPanel('.reset');
  await sleep(400);
  const left = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden], [data-mine-injected], [data-mine-mark], [data-mine-step-hidden]').length);
  check(`back to original leaves nothing behind ${lang}`, left === 0 && (await page.evaluate(() => document.body.style.zoom)) === '', `${left}`);

  // Remembered site: choose Focus, reload, expect Focus applied automatically
  await chooseMode('focus');
  await sleep(800);
  await page.reload();
  await sleep(1600);
  check(`remembered site reopens in Focus ${lang}`, await page.evaluate(() => !!document.querySelector('mine-stepper')));
  await clickInPanel('.fab');
  await sleep(100);
  await clickInPanel('.reset');
  await sleep(300);
}

// Other fixtures: Focus must not throw and must keep real controls enabled
for (const f of readdirSync(FIX).filter((x) => x.endsWith('.html') && !x.startsWith('portal-'))) {
  await page.goto(`${BASE}/${f}`);
  await sleep(500);
  await clickInPanel('.fab');
  await chooseMode('focus');
  await sleep(700);
  const enabled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea, button')].every((el) => !el.disabled || el.hasAttribute('data-was-disabled')));
  const notice = await inPanel((root) => root.querySelector('.notice')?.textContent ?? '');
  check(`focus on ${f}`, enabled, notice);
  await page.screenshot({ path: join(SHOTS, `fixture-${f.replace('.html', '')}.png`), fullPage: false });
  await clickInPanel('.reset');
  await sleep(200);
}

check('console: zero errors', errors.length === 0, errors.slice(0, 4).join(' || '));
await ctx.close();
srv.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
