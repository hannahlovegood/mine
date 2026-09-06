// Renders one ViewBlock in the edition's visual language. Blue only where the engine changed something.
import { useCallback, useState } from 'react';
import type { ContentBlock, Lang, MinePreferences, Term } from '../../engine/schema.ts';
import type { ViewBlock } from '../../engine/transform.ts';
import { t, tn } from '../../copy.ts';
import { RichText } from '../rich.tsx';
import type { TermProps } from '../richText.tsx';
import { formatDate } from '../format.ts';
import { blockName } from '../blockNames.ts';
import { useEscape } from '../a11y.tsx';

export interface EditionHandlers {
  restored: Set<string>;
  onRestore: (ids: string[], restore: boolean) => void;
  expanded: Set<string>;
  onExpand: (id: string, open: boolean) => void;
  originals: Set<string>;
  onOriginal: (id: string, show: boolean) => void;
  lookup: (id: string) => ContentBlock | undefined;
}

export interface EditionBlockProps {
  block: ViewBlock;
  lang: Lang;
  prefs: MinePreferences;
  surfaced: boolean;
  h: EditionHandlers;
  headingId?: string;
}

function useTerms(terms: Term[] | undefined, enabled: boolean): { props?: TermProps; note: Term | null } {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  useEscape(close, open !== null);
  if (!enabled || !terms || terms.length === 0) return { note: null };
  const note = open ? (terms.find((x) => x.term === open) ?? null) : null;
  return {
    props: { terms, openTerm: open, onToggle: (term) => setOpen((cur) => (cur === term ? null : term)) },
    note,
  };
}

function TermNote({ note, lang }: { note: Term | null; lang: Lang }) {
  if (!note) return null;
  return (
    <div className="term-note" role="note" aria-label={t(lang, 'term.label', { term: note.term })}>
      <strong>{note.term}</strong>
      {lang === 'zh' ? '：' : ' — '}
      {note.plain}
    </div>
  );
}

function RewrittenTag({ id, lang, h }: { id: string; lang: Lang; h: EditionHandlers }) {
  const showing = h.originals.has(id);
  return (
    <div className="tag">
      <span>{t(lang, 'rewritten.tag')}</span>
      <span className="sep" aria-hidden="true">
        ·
      </span>
      <button type="button" className="link-btn" aria-expanded={showing} onClick={() => h.onOriginal(id, !showing)}>
        {showing ? t(lang, 'rewritten.hide') : t(lang, 'rewritten.show')}
      </button>
    </div>
  );
}

function OriginalText({ id, text, lang, h }: { id: string; text: string | undefined; lang: Lang; h: EditionHandlers }) {
  if (!text || !h.originals.has(id)) return null;
  return (
    <div className="original-text">
      <div className="tag">{t(lang, 'rewritten.original')}</div>
      <RichText text={text} />
    </div>
  );
}

function Stub({ block, lang, prefs, h }: EditionBlockProps) {
  const ids = block.stubFor ?? [];
  const onlyMenu = ids.length === 1 && (h.lookup(ids[0] ?? '')?.kind === 'nav') && h.lookup(ids[0] ?? '')?.importance !== 'secondary';
  const shownIds = ids.filter((id) => h.restored.has(id));
  const allOpen = ids.length > 0 && shownIds.length === ids.length;
  const remaining = ids.length - shownIds.length;
  const label = onlyMenu ? t(lang, 'stub.nav.hidden') : tn(lang, 'stub.count', remaining);
  return (
    <div>
      <div className="stub">
        <span>{remaining > 0 ? label : tn(lang, 'stub.count', ids.length)}</span>
        <button type="button" className="link-btn" aria-expanded={allOpen} onClick={() => h.onRestore(ids, !allOpen)}>
          {allOpen ? t(lang, 'stub.hide') : t(lang, 'colophon.restore')}
        </button>
      </div>
      {shownIds.length > 0 && (
        <div className="stub-restored">
          {shownIds.map((id) => {
            const b = h.lookup(id);
            if (!b) return null;
            const vb: ViewBlock = { ...b, state: 'shown' };
            return (
              <div key={id} className="restored-block">
                <EditionBlock block={vb} lang={lang} prefs={prefs} surfaced={false} h={h} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EditionBlock(props: EditionBlockProps) {
  const { block, lang, prefs, surfaced, h, headingId } = props;
  const isText = ['text', 'instruction', 'notice', 'promo', 'faq', 'heading', 'legal'].includes(block.kind);
  const terms = useTerms(isText && 'terms' in block ? block.terms : undefined, prefs.explainTerms);

  if (block.stubFor) return <Stub {...props} />;

  // Secondary blocks collapsed in place (comfortable density).
  if (block.state === 'collapsed' && block.kind !== 'nav' && block.kind !== 'action') {
    const open = h.expanded.has(block.id);
    if (!open) {
      return (
        <div className="collapsed-line">
          <span className="title">{blockName(block, lang)}</span>
          <button type="button" className="link-btn" aria-expanded={false} onClick={() => h.onExpand(block.id, true)}>
            {t(lang, 'colophon.restore')}
          </button>
        </div>
      );
    }
    const shown: ViewBlock = { ...block, state: 'shown' };
    return (
      <div>
        <EditionBlock {...props} block={shown} />
        <div className="tag">
          <button type="button" className="link-btn" aria-expanded={true} onClick={() => h.onExpand(block.id, false)}>
            {t(lang, 'stub.hide')}
          </button>
        </div>
      </div>
    );
  }

  switch (block.kind) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h2' : block.level === 3 ? 'h4' : 'h3';
      const cls = block.level === 1 ? 'edition-h1' : block.level === 3 ? 'edition-h3' : 'edition-h2';
      return (
        <Tag className={cls} id={block.level === 1 ? headingId : undefined} tabIndex={block.level === 1 ? -1 : undefined}>
          {block.text}
        </Tag>
      );
    }
    case 'text':
    case 'instruction':
    case 'notice':
    case 'promo':
    case 'faq': {
      const rewritten = block.state === 'rewritten';
      return (
        <div>
          {rewritten && <RewrittenTag id={block.id} lang={lang} h={h} />}
          <RichText text={block.text} terms={terms.props} />
          <TermNote note={terms.note} lang={lang} />
          {rewritten && <OriginalText id={block.id} text={block.original} lang={lang} h={h} />}
        </div>
      );
    }
    case 'legal': {
      const annotated = block.state === 'annotated' && block.plainText;
      return (
        <div>
          <RichText text={block.text} terms={terms.props} />
          <TermNote note={terms.note} lang={lang} />
          {annotated && (
            <div className="aside-plain">
              <div className="tag">{t(lang, 'legal.summary')}</div>
              <RichText text={block.plainText ?? ''} />
            </div>
          )}
        </div>
      );
    }
    case 'deadline': {
      const rewritten = block.state === 'rewritten';
      return (
        <div className="deadline">
          <p className="label">
            <span>{t(lang, 'deadline.label')}</span>
            <span className="date">{formatDate(block.date, lang)}</span>
            {block.state === 'moved' && <span className="moved pencil">{t(lang, 'deadline.moved')}</span>}
          </p>
          {rewritten && <RewrittenTag id={block.id} lang={lang} h={h} />}
          <RichText text={block.text} />
          {rewritten && <OriginalText id={block.id} text={block.original} lang={lang} h={h} />}
        </div>
      );
    }
    case 'nav': {
      const menu = block.importance === 'primary' || block.importance === 'critical';
      const collapsed = block.state === 'collapsed';
      const open = h.expanded.has(block.id);
      if (menu && collapsed && !open) {
        return (
          <div className="tag" style={{ margin: 0 }}>
            <button type="button" className="link-btn" aria-expanded={false} onClick={() => h.onExpand(block.id, true)}>
              {t(lang, 'stub.nav', { n: block.items.length })}
            </button>
          </div>
        );
      }
      return (
        <nav className="edition-nav" aria-label={blockName(block, lang)}>
          <ul>
            {block.items.map((it) => (
              <li key={it}>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  {it}
                </a>
              </li>
            ))}
          </ul>
          {menu && collapsed && (
            <div className="tag">
              <button type="button" className="link-btn" aria-expanded={true} onClick={() => h.onExpand(block.id, false)}>
                {t(lang, 'stub.hide')}
              </button>
            </div>
          )}
        </nav>
      );
    }
    case 'image':
      return (
        <figure>
          <img src={block.src} alt={block.alt} width={720} height={block.decorative ? 200 : 120} />
          {!block.decorative && <figcaption>{block.alt}</figcaption>}
        </figure>
      );
    case 'field': {
      const id = `edition-${block.id}`;
      const rewritten = block.state === 'rewritten';
      const long = block.input === 'text' && /statement|describe|说明|描述|陈述/i.test(block.label + (block.help ?? ''));
      return (
        <div className="field">
          <label htmlFor={id}>
            {block.label}
            <span className="req">{block.required ? t(lang, 'field.required') : t(lang, 'field.optional')}</span>
          </label>
          {block.help && (
            <div className="help">
              {rewritten && <RewrittenTag id={block.id} lang={lang} h={h} />}
              {block.help}
              {rewritten && <OriginalText id={block.id} text={block.original} lang={lang} h={h} />}
            </div>
          )}
          {block.input === 'select' ? (
            <select id={id} name={block.id} defaultValue="">
              <option value="">{lang === 'zh' ? '请选择' : 'Select…'}</option>
              {(block.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : long ? (
            <textarea id={id} name={block.id} />
          ) : (
            <input id={id} name={block.id} type={block.input === 'file' ? 'file' : block.input} />
          )}
        </div>
      );
    }
    case 'decision': {
      const id = `edition-${block.id}`;
      const annotated = block.state === 'annotated' && block.plainLabel;
      return (
        <div className="decision" data-surfaced={surfaced ? '' : undefined}>
          <div className="row">
            <input id={id} type="checkbox" name={block.id} defaultChecked={block.preChecked} />
            <label htmlFor={id}>{block.label}</label>
          </div>
          {annotated && (
            <div className="aside-plain" style={{ marginLeft: 'calc(24px * var(--font-scale) + 0.8em)' }}>
              <div className="tag">{t(lang, 'legal.summary')}</div>
              <p>{block.plainLabel}</p>
            </div>
          )}
          {surfaced && (
            <div className="notes">
              <span>{block.optional ? t(lang, 'decisions.optional') : t(lang, 'decisions.required')}</span>
              {block.preChecked && <span className="prechecked">{t(lang, 'decisions.prechecked')}</span>}
              {block.consequence && (
                <span className="consequence">
                  {t(lang, 'decisions.consequence')}
                  {lang === 'zh' ? '：' : ': '}
                  {block.consequence}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
    case 'action':
      return (
        <button
          type="button"
          className={`action ${block.primary ? 'primary' : block.state === 'collapsed' ? 'quiet' : ''}`}
          onClick={(e) => e.preventDefault()}
        >
          {block.label}
        </button>
      );
    default:
      return null;
  }
}
