// Short human names for blocks, used by the colophon list and the live region.
import type { ContentBlock, Lang } from '../engine/schema.ts';

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + '…';
}

export function blockName(block: ContentBlock, lang: Lang): string {
  const zh = lang === 'zh';
  switch (block.kind) {
    case 'nav':
      return block.importance === 'primary' || block.importance === 'critical'
        ? zh
          ? '站点菜单'
          : 'Site menu'
        : `${zh ? '链接' : 'Links'}: ${clip(block.items.join(zh ? '、' : ', '), 36)}`;
    case 'image':
      return `${zh ? '图片' : 'Image'}: ${clip(block.alt || (zh ? '装饰' : 'decorative'), 36)}`;
    case 'field':
      return block.label;
    case 'decision':
      return clip(block.label, 48);
    case 'action':
      return block.label;
    case 'deadline':
      return zh ? '截止日期' : 'Deadline';
    case 'faq':
      return clip(block.text.split(/[—–]|\?|？/)[0] ?? block.text, 44);
    default:
      return clip(block.text, zh ? 24 : 44);
  }
}
