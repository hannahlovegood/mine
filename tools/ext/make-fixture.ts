// Renders the web demo's portal page to static HTML so the extension's extractor can be tested
// against the very page the demo uses. Output: extension/test/fixtures/portal-{en,zh}.html (+ img/).
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalPage } from '../../src/ui/PortalPage.tsx';
import { PlainBlock } from '../../src/ui/Wrap.tsx';
import { contents } from '../../src/content/content.meta.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'extension', 'test', 'fixtures');
mkdirSync(join(OUT, 'img'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'public', 'img'))) copyFileSync(join(ROOT, 'public', 'img', f), join(OUT, 'img', f));
const tokens = readFileSync(join(ROOT, 'src', 'tokens.css'), 'utf8');
const portalCss = readFileSync(join(ROOT, 'src', 'ui', 'portal.css'), 'utf8');

for (const lang of ['en', 'zh'] as const) {
  const content = contents[lang];
  const body = renderToStaticMarkup(createElement(PortalPage, { content, lang, Wrap: PlainBlock })).replaceAll('src="/img/', 'src="img/');
  const html = `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${content.meta.title}</title>
<style>
${tokens}
body { margin: 0; background: #e9ecef; }
.portal { max-width: 1100px; margin: 0 auto; }
${portalCss}
</style>
</head>
<body>
${body}
</body>
</html>
`;
  writeFileSync(join(OUT, `portal-${lang}.html`), html);
  console.log(`wrote extension/test/fixtures/portal-${lang}.html (${Math.round(html.length / 1024)} KB)`);
}
