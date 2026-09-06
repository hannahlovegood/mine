// Records the full storyline (keys 1 → 6) as a backup video, paced like PITCH.md.
//   NODE_PATH=<node_modules with playwright> node tools/record.cjs http://localhost:4173 en
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:4173';
const LANG = process.argv[3] || 'en';
const OUT = path.join(__dirname, '..', 'docs', 'recordings');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  const beat = async (key, ms) => {
    if (key) await page.keyboard.press(key);
    await page.waitForTimeout(ms);
  };
  await page.goto(`${BASE}/?demo=1&lang=${LANG}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // landing autoplay
  await beat('1', 2500); // 0:00 hook — the portal
  await page.mouse.wheel(0, 900); // 0:20 find the deadline
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 1600); // the form and the pre-checked consent
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, -3000);
  await page.waitForTimeout(800);
  await beat('2', 4500); // 0:45 make it mine → Focus
  for (let i = 0; i < 4; i++) {
    // walk to the choice step
    const next = page.locator('.stepper .step-nav .action.primary');
    if (await next.isDisabled()) break;
    await next.click();
    await page.waitForTimeout(1400);
  }
  await page.waitForTimeout(3000);
  await beat('3', 2500); // 1:30 my words
  await beat('4', 5000);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(800);
  await beat('5', 2200); // 2:05 hold to see the original
  await beat('5', 1200);
  await page.click('.rail .reset'); // back to original
  await page.waitForTimeout(3000);
  await beat('6', 5000); // 2:40 ending
  const video = page.video();
  await ctx.close();
  const p = await video.path();
  const final = path.join(OUT, `mine-demo-${LANG}.webm`);
  fs.renameSync(p, final);
  await browser.close();
  console.log(`saved ${final} (${Math.round(fs.statSync(final).size / 1024)} KB)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
