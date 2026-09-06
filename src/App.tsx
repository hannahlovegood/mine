// T01 hello world — proves fonts, tokens, Tailwind and the API pipeline. Replaced in T04.
import { useState } from 'react';
import { t } from './copy';
import type { Lang } from './engine/schema';

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [api, setApi] = useState<string>('');
  async function ping() {
    const r = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'quieter', lang }),
    });
    setApi(JSON.stringify(await r.json()));
  }
  return (
    <main className="mx-auto max-w-[68ch] px-6 py-16">
      <p className="text-graphite">{t(lang, 'brand.tagline')}</p>
      <h1 className="font-edition text-4xl leading-tight mt-2">{t(lang, 'hero.title')}</h1>
      <p className="font-edition text-[18px] leading-[1.6] mt-4">{t(lang, 'hero.sub')}</p>
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="min-h-11 px-4 border border-ink"
        >
          {t(lang, 'nav.lang')}
        </button>
        <button type="button" onClick={ping} className="min-h-11 px-4 bg-ink text-paper">
          {t(lang, 'hero.cta')}
        </button>
      </div>
      {api && <pre className="mt-6 text-sm text-graphite whitespace-pre-wrap">{api}</pre>}
    </main>
  );
}
