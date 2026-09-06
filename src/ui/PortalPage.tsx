// The page as published: a plausible public-benefits portal. Regions come from block.region.
import type { ReactNode } from 'react';
import type { ActionBlock, ContentBlock, Lang, PageContent, TextBlock } from '../engine/schema.ts';
import { t } from '../copy.ts';
import { PortalBlock } from './blocks/PortalBlock.tsx';
import type { Wrap } from './Wrap.tsx';

interface Props {
  content: PageContent;
  lang: Lang;
  Wrap: Wrap;
  idPrefix?: string;
  inert?: boolean;
}

type MainItem = { kind: 'block'; block: ContentBlock } | { kind: 'form'; blocks: ContentBlock[] };

function groupMain(blocks: ContentBlock[]): MainItem[] {
  const out: MainItem[] = [];
  let form: ContentBlock[] | null = null;
  for (const b of blocks) {
    const formish = b.kind === 'field' || b.kind === 'decision' || (b.kind === 'action' && b.importance !== 'decorative');
    if (formish) {
      if (!form) {
        form = [];
        out.push({ kind: 'form', blocks: form });
      }
      form.push(b);
    } else {
      form = null;
      out.push({ kind: 'block', block: b });
    }
  }
  return out;
}

export function PortalPage({ content, lang, Wrap, idPrefix = '', inert }: Props) {
  const blocks = content.blocks;
  const region = (r: string) => blocks.filter((b) => b.region === r);
  const utility = region('utility');
  const header = region('header');
  const sidebar = region('sidebar');
  const footer = region('footer');
  const floating = blocks.filter((b): b is ActionBlock => b.kind === 'action' && b.importance === 'decorative');
  const main = blocks.filter(
    (b) => !b.region && !(b.kind === 'action' && b.importance === 'decorative'),
  );
  const menu = header.find((b) => b.kind === 'nav');
  const headerRest = header.filter((b) => b !== menu);
  const wid = (b: ContentBlock) => `${idPrefix}${b.id}`;
  const idx = (b: ContentBlock) => blocks.indexOf(b);

  const W = (b: ContentBlock, node: ReactNode, className?: string) => (
    <Wrap key={b.id} id={wid(b)} className={className}>
      {node}
    </Wrap>
  );

  const announcements = sidebar.filter((b): b is TextBlock => b.kind === 'text' || b.kind === 'notice');
  const sideOther = sidebar.filter((b) => !(announcements as ContentBlock[]).includes(b));

  return (
    <div className="portal" lang={lang === 'zh' ? 'zh-CN' : 'en'} inert={inert || undefined}>
      {utility.length > 0 && (
        <div className="portal-utility">
          {utility.map((b) => W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />))}
        </div>
      )}
      <div className="portal-masthead">
        <div className="portal-brand">
          {t(lang, 'portal.brand')}
          <small>{t(lang, 'portal.brandSub')}</small>
        </div>
        {menu && (
          <nav className="portal-mainnav" aria-label={lang === 'zh' ? '站点菜单' : 'Site menu'}>
            {W(menu, <PortalBlock block={menu} index={idx(menu)} lang={lang} />)}
          </nav>
        )}
      </div>
      {headerRest.map((b) =>
        b.kind === 'promo'
          ? W(
              b,
              <div className="portal-promo">
                <img src="/img/app-promo-phone.svg" alt="" width={44} height={44} />
                <span>{b.text}</span>
                <button type="button" className="portal-btn" onClick={(e) => e.preventDefault()}>
                  {lang === 'zh' ? '立即下载' : 'Get the app'}
                </button>
              </div>,
            )
          : W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />),
      )}
      <div className="portal-body">
        <div className="portal-main">
          {groupMain(main).map((item) =>
            item.kind === 'block' ? (
              W(item.block, <PortalBlock block={item.block} index={idx(item.block)} lang={lang} headingId={`${idPrefix}portal-heading`} />)
            ) : (
              <div className="portal-form" key={item.blocks[0]?.id ?? 'form'}>
                {item.blocks
                  .filter((b) => b.kind !== 'action')
                  .map((b) => W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />))}
                <div className="portal-actions">
                  {item.blocks
                    .filter((b) => b.kind === 'action')
                    .map((b) => W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />))}
                </div>
              </div>
            ),
          )}
        </div>
        {sidebar.length > 0 && (
          <div className="portal-side">
            {sideOther.map((b) =>
              b.kind === 'nav'
                ? W(
                    b,
                    <div className="portal-side-box">
                      <div className="portal-side-title">{t(lang, 'portal.related')}</div>
                      <div className="portal-side-content">
                        <PortalBlock block={b} index={idx(b)} lang={lang} />
                      </div>
                    </div>,
                  )
                : b.kind === 'promo'
                  ? W(
                      b,
                      <div className="portal-rate">
                        <strong>{t(lang, 'portal.rate')}</strong>
                        <span className="stars" aria-hidden="true">
                          ★★★★★
                        </span>
                        <span>{b.text}</span>
                      </div>,
                    )
                  : W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />),
            )}
            {announcements.length > 0 && (
              <div className="portal-side-box">
                <div className="portal-side-title">{t(lang, 'portal.announcements')}</div>
                <div className="portal-side-content">
                  <ul>
                    {announcements.map((b) => (
                      <li key={b.id}>{W(b, <>{b.text}</>)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {footer.length > 0 && (
        <div className="portal-footer">
          {footer.map((b) => W(b, <PortalBlock block={b} index={idx(b)} lang={lang} />))}
        </div>
      )}
      {floating.map((b) =>
        W(
          b,
          <button type="button" className="portal-btn" onClick={(e) => e.preventDefault()}>
            {b.label}
          </button>,
          'portal-chat',
        ),
      )}
    </div>
  );
}
