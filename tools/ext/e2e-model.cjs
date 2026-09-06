// Bring-your-own-key path, end to end with a fake OpenAI-compatible server: settings → background relay →
// interpret (My words, source "model") and plain rewrites (validated) applied on the page.
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { extname, join } = require('node:path');
(async () => {
  const ROOT = join(__dirname, '..', '..');
  const EXT = join(ROOT, 'extension', '.output', 'chrome-mv3');
  const FIX = join(ROOT, 'extension', 'test', 'fixtures');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const calls = [];
  // Fake provider: answers interpret with a fixed config, plain with a digit-preserving rewrite of each block.
  const llm = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const j = JSON.parse(body); calls.push({ auth: req.headers.authorization, model: j.model, n: j.messages.length });
    const user = j.messages[j.messages.length - 1].content;
    let content;
    if (/rewrites/i.test(j.messages[0].content) || user.includes('"blocks"')) {
      const req = JSON.parse(user.slice(user.indexOf('{')));
      const blocks = req.blocks ?? [];
      if (req.translateTo) {
        calls[calls.length - 1].translateTo = req.translateTo;
        content = JSON.stringify({ rewrites: blocks.map((b) => ({ id: b.id, plainText: `译文：${b.text}`, terms: [] })) });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
        return;
      }
      // keep every digit and stay within the length window, or the validator drops the block
      content = JSON.stringify({ rewrites: blocks.map((b) => ({ id: b.id, plainText: `In plain words. ${b.text}`, terms: [] })) });
    } else {
      content = JSON.stringify({ preferences: { readingLevel: 'plain', density: 'minimal', navigation: 'reduced', fontScale: 1, contrast: 'default', showDecorativeMedia: false, taskMode: 'one-at-a-time', explainTerms: true, surfaceDecisions: true }, reasons: ['"overwhelmed" → fewer items on screen (fake model)'] });
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  await new Promise((r) => llm.listen(0, '127.0.0.1', r));
  const fix = createServer(async (req, res) => { try { const b = await readFile(join(FIX, decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': extname(req.url) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
  await new Promise((r) => fix.listen(0, '127.0.0.1', r));
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mine-model-')), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  await sw.evaluate((base) => chrome.storage.local.set({ settings: { server: '', lang: 'en', apiKey: 'sk-test', baseUrl: base, model: 'fake-model' } }), `http://127.0.0.1:${llm.address().port}`);
  const page = await ctx.newPage(); const url = `http://127.0.0.1:${fix.address().port}/portal-en.html`; await page.goto(url); await sleep(600);
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, url);
  const panel = await ctx.newPage(); await panel.setViewportSize({ width: 380, height: 900 });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?tab=${tabId}`); await panel.waitForSelector('.opening');
  const ok = (name, v, d = '') => console.log(`${v ? '✓' : '✗'} ${name}${d ? ' — ' + d : ''}`) || v;
  let pass = true;
  // My words via the fake model
  await panel.locator('.tile').filter({ hasText: 'My words' }).click(); await sleep(300);
  await panel.locator('textarea').fill('overwhelmed by long forms');
  await panel.locator('button.primary').filter({ hasText: 'Transform' }).click(); await sleep(3000);
  const badge = await panel.locator('.badge').innerText().catch(() => '');
  pass &= ok('badge says model', /model/i.test(badge), badge);
  pass &= ok('provider got the key and model', calls.some((c) => c.auth === 'Bearer sk-test' && c.model === 'fake-model'), JSON.stringify(calls[0]));
  pass &= ok('provider was asked for rewrites too', calls.length >= 2, `${calls.length} calls`);
  const plainOnPage = await page.evaluate(() => document.querySelectorAll('[data-mine-rewritten], mine-plain').length);
  pass &= ok('plain rewrites applied on the page', plainOnPage > 0, `${plainOnPage}`);
  const summary = await panel.locator('.summary').innerText().catch(() => '');
  pass &= ok('summary mentions plain words', /plain words/.test(summary), summary);
  await panel.screenshot({ path: join(ROOT, 'docs', 'shots', 'extension', 'panel-model-en.png'), fullPage: true });
  // Translated edition via the fake model
  await panel.locator('.pill').filter({ hasText: 'Translated' }).click(); await sleep(3500);
  pass &= ok('provider was asked to translate into en', calls.some((c) => c.translateTo === 'en'), JSON.stringify(calls.map((c) => c.translateTo)));
  const translatedOnPage = await page.evaluate(() => [...document.querySelectorAll('mine-tag')].map((t) => t.shadowRoot?.textContent ?? '').filter((x) => /Translation/.test(x)).length);
  pass &= ok('translation tags on the page', translatedOnPage > 0, `${translatedOnPage}`);
  const tsum = await panel.locator('.summary').innerText().catch(() => '');
  pass &= ok('summary counts translated passages', /translated/.test(tsum), tsum);
  const fieldAside = await page.evaluate(() => [...document.querySelectorAll('mine-plain')].map((t) => t.shadowRoot?.textContent ?? '').filter((x) => /译文：/.test(x)).length);
  pass &= ok('field labels and decisions translated beside', fieldAside > 0, `${fieldAside}`);
  await panel.screenshot({ path: join(ROOT, 'docs', 'shots', 'extension', 'panel-translate-en.png'), fullPage: true });
  await page.screenshot({ path: join(ROOT, 'docs', 'shots', 'extension', 'translate-en.png') });
  await ctx.close(); llm.close(); fix.close();
  console.log(pass ? '\nmodel path OK' : '\nmodel path FAILED'); process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
