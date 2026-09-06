// Output types of the engine (docs/ENGINE.md). transform.ts re-exports them;
// they live here so steps.ts and changes.ts can share them without a cycle.
import type { ContentBlock, DecisionBlock } from './schema.ts';

export type ViewState = 'shown' | 'collapsed' | 'moved' | 'rewritten' | 'annotated' | 'enlarged';
// 'annotated' = a legal block or a decision whose plain summary/label is shown
//               beside the original (text never replaced).

export type ViewBlock = ContentBlock & {
  state: ViewState;
  /** A stub: ids of the set-aside blocks it can restore. */
  stubFor?: string[];
  /** The original text (or field help) when the block was rewritten. */
  original?: string;
};

export interface Step {
  id: string;
  title: string;
  blocks: ViewBlock[];
  choice?: boolean;
}

export interface DecisionSummary {
  count: number;
  optional: DecisionBlock[];
  required: DecisionBlock[];
  preChecked: DecisionBlock[];
}

export type ChangeType =
  | 'hidden'
  | 'collapsed'
  | 'moved'
  | 'rewritten'
  | 'translated'
  | 'explained'
  | 'enlarged'
  | 'stepped'
  | 'surfaced';

export interface Change {
  type: ChangeType;
  blockIds: string[];
  reason: string;
  /** When present, what this change counts for in the summary (else blockIds.length). */
  count?: number;
}

export interface Summary {
  hidden: number;
  collapsed: number;
  moved: number;
  rewritten: number;
  translated: number;
  explained: number;
  enlarged: number;
  steps: number;
  surfaced: number;
}

export interface Transformation {
  /** Ordered blocks to render when taskMode === 'all'; the frame when one-at-a-time. */
  view: ViewBlock[];
  /** Present only when taskMode === 'one-at-a-time'. */
  steps?: Step[];
  /** Always computed; rendered when surfaceDecisions. */
  decisions: DecisionSummary;
  /** Every change, with the blocks it touched and a human reason, in rule order. */
  changes: Change[];
  /** Derived from `changes` only — never typed by hand. */
  summary: Summary;
}
