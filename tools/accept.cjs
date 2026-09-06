// Browser acceptance for Mine: console zero errors, axe zero serious/critical on every screen
// (including the portal), no horizontal overflow at 1280×800 and 360×740, and the storyline
// walked with ?demo=1 keys. Run against a server:
//   NODE_PATH=/Users/ningtiaolovegood/Documents/Claude/karakeep-app/node_modules node tools/accept.cjs http://localhost:4173
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:4173';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const SHOTS = path.join(__dirname, '..', 'docs', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations'] });
    return res.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  check(`axe ${label}: 0 serious/critical`, r.length === 0, r.length ? JSON.stringify(r) : '');
}

async function overflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal overflow ${label}`, o <= 0, o > 0 ? `${o}px` : '');
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const lang of ['en', 'zh']) {
    // Landing
    await page.goto(`${BASE}/?demo=1&lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(SHOTS, `landing-${lang}.png`), fullPage: false });
    await axe(page, `landing ${lang}`);
    await overflow(page, `landing ${lang}`);

    // Lab: portal
    await page.keyboard.press('1');
    await page.waitForTimeout(900);
    const portalHeading = await page.locator('#portal-heading').count();
    check(`portal renders ${lang}`, portalHeading === 1);
    const preChecked = await page.locator('.portal input[type=checkbox]').first().isChecked();
    check(`portal consent is pre-checked ${lang}`, preChecked);
    await page.screenshot({ path: path.join(SHOTS, `portal-${lang}.png`), fullPage: true });
    await axe(page, `portal ${lang}`);
    await overflow(page, `portal ${lang}`);

    // Focus
    await page.keyboard.press('2');
    await page.waitForTimeout(1700);
    const summary = await page.locator('.rail .summary').innerText();
    check(`focus summary ${lang}`, /\d/.test(summary), summary);
    const stepper = await page.locator('.stepper').count();
    check(`focus has a stepper ${lang}`, stepper === 1);
    const deadlineFirst = await page.evaluate(() => {
      const first = document.querySelector('.stepper .step-body .edition-block');
      return first ? `${first.dataset.kind}/${first.dataset.state}` : 'none';
    });
    check(`deadline is the first block of step 1, marked moved ${lang}`, deadlineFirst === 'deadline/moved', deadlineFirst);
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check(`focus moved to the page heading ${lang}`, focused === 'page-heading', String(focused));
    await page.screenshot({ path: path.join(SHOTS, `focus-${lang}.png`), fullPage: true });
    await axe(page, `focus ${lang}`);
    await overflow(page, `focus ${lang}`);

    // Walk to the choice step and check the consent is still pre-checked and labelled optional
    const steps = await page.locator('.stepper .dots i').count();
    let sawChoice = false;
    for (let i = 0; i < steps; i++) {
      const isChoice = (await page.locator('.stepper .dots i[data-choice][data-on]').count()) === 1;
      if (isChoice) {
        sawChoice = true;
        const checked = await page.locator('.stepper .decision input[type=checkbox]').first().isChecked();
        check(`choice step keeps the box pre-checked ${lang}`, checked);
        const notes = await page.locator('.stepper .decision .notes').innerText();
        check(`choice step labels optional + pre-checked ${lang}`, notes.length > 10, notes.replace(/\n/g, ' | '));
        await page.screenshot({ path: path.join(SHOTS, `choice-${lang}.png`), fullPage: false });
        break;
      }
      const next = page.locator('.stepper .step-nav .action.primary');
      if (await next.isDisabled()) break;
      await next.click();
      await page.waitForTimeout(150);
    }
    check(`a choice step exists ${lang}`, sawChoice);

    // Restore a set-aside group from the colophon
    const restore = page.locator('.rail .changes .restore .link-btn').first();
    if (await restore.count()) {
      await restore.click();
      await page.waitForTimeout(200);
      const restoredBlocks = await page.locator('.edition .stub-restored .restored-block').count();
      check(`restore from colophon shows set-aside blocks ${lang}`, restoredBlocks > 0, `${restoredBlocks}`);
      await restore.click();
    }

    // My words (offline fallback path) via keys 3 + 4
    await page.keyboard.press('3');
    await page.waitForTimeout(400);
    const prefilled = await page.locator('.composer textarea').inputValue();
    check(`key 3 prefills the example ${lang}`, prefilled.length > 20);
    await page.keyboard.press('4');
    await page.waitForSelector('.composer .badge', { timeout: 12000 });
    await page.waitForTimeout(1500);
    const badge = await page.locator('.composer .badge').innerText();
    const reasons = await page.locator('.rail .why li').count();
    check(`my words shows source badge ${lang}`, badge.length > 0, badge);
    check(`my words shows reasons in Why ${lang}`, reasons >= 1, `${reasons}`);
    const plainTags = await page.locator('.edition .tag').count();
    check(`plain version tags present ${lang}`, plainTags > 0, `${plainTags}`);
    await page.screenshot({ path: path.join(SHOTS, `words-${lang}.png`), fullPage: true });
    await axe(page, `words ${lang}`);
    await overflow(page, `words ${lang}`);

    // Hold to compare (key 5 toggles)
    await page.keyboard.press('5');
    await page.waitForTimeout(250);
    const overlay = await page.locator('.frame .page.overlay .portal').count();
    check(`hold shows the original ${lang}`, overlay === 1);
    await page.keyboard.press('5');
    await page.waitForTimeout(250);
    check(`release hides the original ${lang}`, (await page.locator('.frame .page.overlay').count()) === 0);

    // Back to original
    await page.click('.rail .reset');
    await page.waitForTimeout(1200);
    check(`back to original ${lang}`, (await page.locator('#portal-heading').count()) === 1);

    // Plain and Large presets
    await page.click('.modes label:nth-child(3)');
    await page.waitForTimeout(1200);
    check(`plain preset rewrites ${lang}`, (await page.locator('.edition .tag').count()) > 0);
    await page.screenshot({ path: path.join(SHOTS, `plain-${lang}.png`), fullPage: true });
    await axe(page, `plain ${lang}`);
    await page.click('.modes label:nth-child(4)');
    await page.waitForTimeout(1200);
    const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim());
    check(`large preset sets --font-scale 1.6 ${lang}`, scale === '1.6', scale);
    await page.screenshot({ path: path.join(SHOTS, `large-${lang}.png`), fullPage: true });
    await axe(page, `large ${lang}`);
    await overflow(page, `large ${lang}`);

    // Ending
    await page.keyboard.press('6');
    await page.waitForTimeout(3200);
    check(`ending shows three lines ${lang}`, (await page.locator('.ending p').count()) === 3);
    await page.screenshot({ path: path.join(SHOTS, `ending-${lang}.png`), fullPage: false });
    await axe(page, `ending ${lang}`);
    await page.keyboard.press('r');
    await page.waitForTimeout(500);
  }

  // Mobile 360×740 (spec: works at 360 px)
  const mctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('console', (m) => {
    if (m.type() === 'error') errors.push('[mobile] ' + m.text());
  });
  mp.on('pageerror', (e) => errors.push('[mobile] ' + String(e)));
  await mp.goto(`${BASE}/?lang=en#lab`, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(800);
  await overflow(mp, 'mobile portal');
  await mp.click('.modes label:nth-child(2)');
  await mp.waitForTimeout(1500);
  await overflow(mp, 'mobile focus');
  await mp.click('.rail-pill');
  await mp.waitForTimeout(300);
  check('mobile rail opens as a sheet', (await mp.locator('.rail[data-open="true"]').count()) === 1);
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-focus.png'), fullPage: false });
  await axe(mp, 'mobile focus');

  // Reduced motion storyline
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  rp.on('pageerror', (e) => errors.push('[reduced] ' + String(e)));
  await rp.goto(`${BASE}/?demo=1&lang=en`, { waitUntil: 'networkidle' });
  await rp.waitForTimeout(500);
  check('reduced motion: static before/after on landing', (await rp.locator('.static-pair').count()) === 1);
  await rp.keyboard.press('2');
  await rp.waitForTimeout(400);
  check('reduced motion: focus renders', (await rp.locator('.stepper').count()) === 1);

  check('console: zero errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
