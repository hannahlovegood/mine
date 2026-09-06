// Renders one content block in the portal's visual language. Realistic, never parodic.
import type { ContentBlock, FieldBlock, Lang } from '../../engine/schema.ts';
import { RichText } from '../rich.tsx';

function requiredMark(block: FieldBlock, index: number, lang: Lang) {
  if (!block.required) return null;
  // The portal is inconsistent on purpose: asterisks on some fields, the word on others.
  return index % 3 === 2 ? (
    <span className="req-word"> ({lang === 'zh' ? '必填' : 'required'})</span>
  ) : (
    <span className="req" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export function PortalBlock({ block, index, lang, headingId }: { block: ContentBlock; index: number; lang: Lang; headingId?: string }) {
  switch (block.kind) {
    case 'heading': {
      const cls = block.level === 1 ? 'portal-h1' : block.level === 3 ? 'portal-h3' : 'portal-h2';
      const Tag = block.level === 1 ? 'h2' : block.level === 3 ? 'h4' : 'h3';
      return (
        <Tag className={cls} id={block.level === 1 ? headingId : undefined} tabIndex={block.level === 1 ? -1 : undefined}>
          {block.text}
        </Tag>
      );
    }
    case 'text':
    case 'promo':
      return <RichText text={block.text} />;
    case 'notice':
      return <div className="portal-notice">{block.text}</div>;
    case 'instruction':
      return (
        <div className="portal-instruction">
          <RichText text={block.text} />
        </div>
      );
    case 'legal':
      return (
        <div className="portal-legal">
          <RichText text={block.text} />
        </div>
      );
    case 'deadline':
      return (
        <div className="portal-deadline">
          <RichText text={block.text} />
        </div>
      );
    case 'faq': {
      const [q, ...rest] = block.text.split(/\s[—–]\s|\n/);
      return (
        <details className="portal-faq">
          <summary>{q}</summary>
          <p>{rest.join(' ')}</p>
        </details>
      );
    }
    case 'nav':
      return (
        <ul>
          {block.items.map((it) => (
            <li key={it}>
              <a href="#" onClick={(e) => e.preventDefault()}>
                {it}
              </a>
            </li>
          ))}
        </ul>
      );
    case 'image':
      return block.decorative ? (
        <div className="portal-hero">
          <img src={block.src} alt={block.alt} width={720} height={200} />
        </div>
      ) : (
        <figure className="portal-figure">
          <img src={block.src} alt={block.alt} width={720} height={120} />
          <figcaption>{block.alt}</figcaption>
        </figure>
      );
    case 'field': {
      const id = `portal-${block.id}`;
      return (
        <div className="portal-field">
          <label htmlFor={id}>
            {block.label}
            {requiredMark(block, index, lang)}
          </label>
          {block.input === 'select' ? (
            <select id={id} name={block.id} defaultValue="">
              <option value="">{lang === 'zh' ? '请选择' : 'Select…'}</option>
              {(block.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : block.input === 'text' && /statement|describe|说明|描述|陈述/i.test(block.label + (block.help ?? '')) ? (
            <textarea id={id} name={block.id} />
          ) : (
            <input id={id} name={block.id} type={block.input === 'file' ? 'file' : block.input} />
          )}
          {block.help && <div className="help">{block.help}</div>}
        </div>
      );
    }
    case 'decision': {
      const id = `portal-${block.id}`;
      return (
        <div className="portal-check">
          <input id={id} type="checkbox" name={block.id} defaultChecked={block.preChecked} />
          <label htmlFor={id}>
            {block.label}
            {block.consequence && <span className="consequence">{block.consequence}</span>}
          </label>
        </div>
      );
    }
    case 'action': {
      const cls = block.primary ? 'primary' : index % 2 === 0 ? 'secondary' : 'pill';
      return (
        <button type="button" className={`portal-btn ${cls}`} onClick={(e) => e.preventDefault()}>
          {block.label}
        </button>
      );
    }
    default:
      return null;
  }
}
