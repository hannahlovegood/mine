// Rasterises the Mine mark into the PNG sizes WXT expects (public/icon/{16,32,48,96,128}.png).
//   NODE_PATH=<node_modules with playwright> node tools/ext/icons.cjs
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const OUT = join(__dirname, '..', '..', 'extension', 'public', 'icon');
mkdirSync(OUT, { recursive: true });
const svg = (s) => `<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${s}" height="${s}"><rect width="32" height="32" rx="6" fill="#ffffff"/><rect x="0.5" y="0.5" width="31" height="31" rx="5.5" fill="none" stroke="#d8d5ce"/><path d="M7 22V9l5 8 5-8v13" fill="none" stroke="#000" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 27h20" stroke="#2743D9" stroke-width="2.8" stroke-linecap="round"/></svg></body>`;
(async () => {
const browser = await chromium.launch();
for (const s of [16, 32, 48, 96, 128]) {
  const page = await browser.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
  await page.setContent(svg(s));
  await page.screenshot({ path: join(OUT, `${s}.png`), omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
  await page.close();
}
await browser.close();
console.log('icons written to', OUT);
})();
