// The reader's edition. Renders `view` (or the frame + Stepper) with blue marks where the engine changed things.
import { useMemo, type ReactNode } from 'react';
import type { Lang, MinePreferences, PageContent } from '../engine/schema.ts';
import type { Transformation, ViewBlock } from '../engine/transform.ts';
import { EditionBlock, type EditionHandlers } from './blocks/EditionBlock.tsx';
import { Stepper } from './Stepper.tsx';
import type { Wrap } from './Wrap.tsx';

interface Props {
  tr: Transformation;
  content: PageContent;
  lang: Lang;
  prefs: MinePreferences;
  h: EditionHandlers;
  Wrap: Wrap;
  headingId: string;
  inspect: string[] | null;
  onHoverBlock?: (ids: string[] | null) => void;
  stepIndex: number;
  setStepIndex: (i: number) => void;
  idPrefix?: string;
}

export function EditionPage({ tr, lang, prefs, h, Wrap, headingId, inspect, onHoverBlock, stepIndex, setStepIndex, idPrefix = '' }: Props) {
  // Blue margin marks go on content the engine changed; stepping and enlarging are structural
  // and already visible (the stepper, the bigger controls), so they are listed but not marked.
  const changed = useMemo(
    () => new Set(tr.changes.filter((c) => c.type !== 'stepped' && c.type !== 'enlarged').flatMap((c) => c.blockIds)),
    [tr],
  );
  const surfacedIds = useMemo(
    () => new Set(tr.changes.filter((c) => c.type === 'surfaced').flatMap((c) => c.blockIds)),
    [tr],
  );
  const inspectSet = useMemo(() => new Set(inspect ?? []), [inspect]);

  const render = (b: ViewBlock): ReactNode => {
    const ids = b.stubFor ?? [b.id];
    const isChanged = b.stubFor ? true : changed.has(b.id);
    const isInspected = ids.some((id) => inspectSet.has(id));
    return (
      <Wrap
        key={b.id}
        id={`${idPrefix}${b.id}`}
        className="edition-block"
        attrs={{
          'data-kind': b.kind,
          'data-state': b.state,
          'data-changed': isChanged ? '' : undefined,
          'data-inspect': isInspected ? '' : undefined,
        }}
        onHover={onHoverBlock && isChanged ? (on) => onHoverBlock(on ? ids : null) : undefined}
      >
        <EditionBlock block={b} lang={lang} prefs={prefs} surfaced={surfacedIds.has(b.id)} h={h} headingId={headingId} />
      </Wrap>
    );
  };

  // Group adjacent actions into one row, and adjacent stubs into one row, so they sit together.
  const items: ReactNode[] = [];
  let row: ViewBlock[] = [];
  let rowKind: 'action' | 'stub' | null = null;
  const flush = () => {
    if (row.length === 0) return;
    items.push(
      <div className={`${rowKind === 'action' ? 'action-row' : 'stub-row'} edition-block`} key={`row-${row[0]?.id}`}>
        {row.map((b) => render(b))}
      </div>,
    );
    row = [];
    rowKind = null;
  };
  // The edition is a single column, so the per-region stubs the engine emits are shown as one
  // line, right after the page title: "n items set aside · Show". Restoring shows every block.
  const stubs = tr.view.filter((b) => b.stubFor);
  const merged: ViewBlock | null =
    stubs.length > 0
      ? {
          id: 'stubs',
          kind: 'text',
          importance: 'secondary',
          text: '',
          complexity: 'simple',
          state: 'collapsed',
          stubFor: stubs.flatMap((b) => b.stubFor ?? []),
        }
      : null;
  const body = tr.view.filter((b) => !b.stubFor);
  const titleIndex = body.findIndex((b) => b.kind === 'heading' && b.level === 1);
  const ordered: ViewBlock[] = [...body];
  if (merged) ordered.splice(titleIndex >= 0 ? titleIndex + 1 : 0, 0, merged);

  for (const b of ordered) {
    const kind: 'action' | 'stub' | null = b.kind === 'action' ? 'action' : b.stubFor ? 'stub' : null;
    if (kind) {
      if (rowKind && rowKind !== kind) flush();
      rowKind = kind;
      row.push(b);
    } else {
      flush();
      items.push(render(b));
    }
  }
  flush();

  return (
    <div className="edition" lang={lang === 'zh' ? 'zh-CN' : 'en'} data-face={prefs.fontScale >= 1.35 ? 'interface' : undefined}>
      {items}
      {tr.steps && <Stepper steps={tr.steps} index={stepIndex} setIndex={setStepIndex} lang={lang} render={render} />}
    </div>
  );
}
