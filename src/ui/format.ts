import type { Lang } from '../engine/schema.ts';

export const REPO_URL = 'https://github.com/hannahlovegood/mine';

export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
