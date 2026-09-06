import type { Lang } from '../engine/schema.ts';

export function detectLang(): Lang {
  const q = new URLSearchParams(window.location.search).get('lang');
  if (q === 'zh' || q === 'en') return q;
  try {
    const saved = localStorage.getItem('mine:lang');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return /^zh\b/i.test(navigator.language) ? 'zh' : 'en';
}

export function persistLang(lang: Lang): void {
  try {
    localStorage.setItem('mine:lang', lang);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

export function isDemoMode(): boolean {
  return new URLSearchParams(window.location.search).get('demo') === '1';
}
