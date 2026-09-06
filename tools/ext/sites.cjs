// Real-site walk: load the built extension, open each URL, apply Focus, and check the safety
// invariants on a stranger's page (no critical node hidden, primary action visible, console clean,
// reset leaves nothing behind). Screenshots → docs/shots/extension/sites/. Report → docs/sites-run.json.
//   NODE_PATH=<node_modules with playwright> node tools/ext/sites.cjs [url ...]
const { chromium } = require('playwright');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const EXT = join(ROOT, 'extension', '.output', 'chrome-mv3');
const SHOTS = join(ROOT, 'docs', 'shots', 'extension', 'sites');
mkdirSync(SHOTS, { recursive: true });
const DEFAULT_URLS = [
  'https://www.gov.cn/zhengce/zhengceku/',
  'https://www.beijing.gov.cn/',
  'https://www.gov.uk/apply-universal-credit',
  'https://www.usa.gov/benefits',
  'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Your_first_form',
  'https://www.w3schools.com/html/html_forms.asp',
  'https://en.wikipedia.org/wiki/Accessibility',
  'https://github.com/login',
];
const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mine-sites-')), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const report = [];
  for (const url of urls) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR|CORS|third-party cookie/i.test(m.text())) errors.push(m.text().slice(0, 200));
    });
    const row = { url, ok: false };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(2500);
      // Drive the side panel as a page (the app reads ?tab=).
      const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, page.url());
      row.fab = await page.evaluate(() => !!document.querySelector('mine-root')?.shadowRoot?.querySelector('.fab'));
      if (!row.fab) throw new Error('no fab (content script did not run)');
      const panel = await ctx.newPage();
      await panel.goto(`chrome-extension://${extId}/sidepanel.html?tab=${tabId}`);
      await panel.waitForSelector('.opening, .edition, .blocked', { timeout: 10000 });
      if ((await panel.locator('.opening .primary').count()) === 0) throw new Error('panel: ' + (await panel.locator('.blocked').innerText().catch(() => 'no opening')));
      await panel.locator('.opening .primary').click();
      await sleep(2000);
      row.summary = await panel.locator('.summary').innerText().catch(() => '');
      row.notice = await panel.locator('.notice').innerText().catch(() => '');
      const state = await page.evaluate(() => {
        const hidden = document.querySelectorAll('[data-mine-hidden]').length;
        const stepHidden = document.querySelectorAll('[data-mine-step-hidden]').length;
        const stubs = document.querySelectorAll('mine-stub').length;
        const callout = !!document.querySelector('mine-callout');
        const stepper = !!document.querySelector('mine-stepper');
        // any visible submit-like control after Focus?
        const submits = [...document.querySelectorAll('button[type=submit], input[type=submit], button:not([type])')];
        const submitVisible = submits.length === 0 ? null : submits.some((el) => el.getClientRects().length > 0 && el.closest('mine-root') === null);
        const requiredHidden = [...document.querySelectorAll('input[required], select[required], textarea[required]')].filter((el) => el.getClientRects().length === 0 && !el.closest('[data-mine-step-hidden]')).length;
        return { hidden, stepHidden, stubs, callout, stepper, submitCount: submits.length, submitVisible, requiredHiddenOutsideSteps: requiredHidden };
      });
      Object.assign(row, state);
      await page.screenshot({ path: join(SHOTS, `${new URL(url).hostname}.png`), fullPage: false });
      await panel.locator('.reset').click().catch(() => undefined);
      await sleep(600);
      await panel.close();
      row.leftovers = await page.evaluate(() => document.querySelectorAll('[data-mine-hidden], [data-mine-step-hidden], [data-mine-injected], [data-mine-mark], [data-mine-folded]').length);
      row.errors = errors;
      // Sites throw their own errors (ad scripts, bad attributes); only errors that mention Mine count against us.
      row.mineErrors = errors.filter((e) => /mine|data-mine|content-scripts|chrome-extension/i.test(e));
      row.ok = row.leftovers === 0 && row.mineErrors.length === 0 && row.submitVisible !== false && row.requiredHiddenOutsideSteps === 0;
    } catch (e) {
      row.error = String(e).slice(0, 300);
      row.errors = errors;
    }
    report.push(row);
    console.log(`${row.ok ? '✓' : '✗'} ${url}\n   ${row.summary || row.error || ''}${row.notice ? ' | ' + row.notice : ''}\n   hidden=${row.hidden} steps=${row.stepper} callout=${row.callout} submitVisible=${row.submitVisible} leftovers=${row.leftovers} errors=${(row.errors || []).length}`);
    await page.close();
  }
  await ctx.close();
  writeFileSync(join(ROOT, 'docs', 'sites-run.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.filter((r) => r.ok).length}/${report.length} sites clean`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
