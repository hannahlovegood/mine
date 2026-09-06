import { parseLines, withTerms, type TermProps } from './richText.tsx';

/** Renders text as paragraphs/lists. Each term is wrapped once, at its first occurrence in the block. */
export function RichText({ text, terms, className }: { text: string; terms?: TermProps; className?: string }) {
  const lines = parseLines(text);
  // Find, per term, the first line that contains it, so a term is only wrapped once per block.
  const owner = new Map<string, number>();
  if (terms) {
    for (const term of terms.terms) {
      const idx = lines.findIndex((l) => l.items.some((it) => it.toLowerCase().includes(term.term.toLowerCase())));
      if (idx >= 0) owner.set(term.term, idx);
    }
  }
  const termsFor = (i: number): TermProps | undefined => {
    if (!terms) return undefined;
    const mine = terms.terms.filter((t) => owner.get(t.term) === i);
    return mine.length ? { ...terms, terms: mine } : undefined;
  };
  return (
    <>
      {lines.map((line, i) => {
        const tp = termsFor(i);
        if (line.kind === 'p') {
          return (
            <p key={i} className={className}>
              {withTerms(line.items[0] ?? '', tp)}
            </p>
          );
        }
        const Tag = line.kind;
        return (
          <Tag key={i} className={className}>
            {line.items.map((it, j) => (
              <li key={j}>{withTerms(it, tp)}</li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}
