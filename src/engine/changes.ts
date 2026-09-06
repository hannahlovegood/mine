// Change recorder and the summary derived from it.
// summary[type] = Σ over changes of that type of (change.count ?? change.blockIds.length);
// summary.steps = Σ over 'stepped' changes.
import type { Change, ChangeType, Summary } from './types.ts';

export interface Recorder {
  readonly changes: Change[];
  /** Records one change. A change with no blocks is not a change and is dropped. */
  record(type: ChangeType, blockIds: readonly string[], reason: string, count?: number): void;
}

export function createRecorder(): Recorder {
  const changes: Change[] = [];
  return {
    changes,
    record(type, blockIds, reason, count) {
      if (blockIds.length === 0) return;
      const change: Change = { type, blockIds: [...blockIds], reason };
      if (count !== undefined) change.count = count;
      changes.push(change);
    },
  };
}

export function emptySummary(): Summary {
  return {
    hidden: 0,
    collapsed: 0,
    moved: 0,
    rewritten: 0,
    translated: 0,
    explained: 0,
    enlarged: 0,
    steps: 0,
    surfaced: 0,
  };
}

export function summarize(changes: readonly Change[]): Summary {
  const summary = emptySummary();
  for (const change of changes) {
    const n = change.count ?? change.blockIds.length;
    if (change.type === 'stepped') summary.steps += n;
    else summary[change.type] += n;
  }
  return summary;
}
