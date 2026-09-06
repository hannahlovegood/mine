// Rule 9 — one-at-a-time. Builds the steps from meta.stepOrder and leaves the
// frame (every shown block without a group) behind.
import type { ContentMeta } from './schema.ts';
import type { Recorder } from './changes.ts';
import { choiceStepTitle, reasons } from './reasons.ts';
import type { Step, ViewBlock } from './types.ts';

export interface StepBuild {
  /** Every shown block without a group, in original order. */
  frame: ViewBlock[];
  steps: Step[];
}

const isChoice = (b: ViewBlock): boolean => b.kind === 'decision' && b.optional;
const isOtherOption = (b: ViewBlock): boolean => b.kind === 'action' && !b.primary;
const isMovedDeadline = (b: ViewBlock): boolean => b.kind === 'deadline' && b.state === 'moved';
const isField = (b: ViewBlock): boolean => b.kind === 'field';

export function buildSteps(
  view: readonly ViewBlock[],
  meta: ContentMeta,
  rec: Recorder,
): StepBuild {
  const lang = meta.lang;
  const others = view.filter(isOtherOption);
  const grouped = view.filter((b) => b.group !== undefined && !isOtherOption(b));

  const steps: Step[] = [];
  for (const { id, title } of meta.stepOrder) {
    const mine = grouped.filter((b) => b.group === id);
    // Each optional decision becomes its own step, immediately before its group's step.
    for (const decision of mine.filter(isChoice)) {
      steps.push({
        id: `choice-${decision.id}`,
        title: choiceStepTitle(lang),
        blocks: [decision],
        choice: true,
      });
    }
    const rest = mine.filter((b) => !isChoice(b));
    // A moved deadline opens its step; everything else keeps its original order.
    const blocks = [...rest.filter(isMovedDeadline), ...rest.filter((b) => !isMovedDeadline(b))];
    if (blocks.length > 0) steps.push({ id, title, blocks });
  }

  // Non-primary actions, wherever they were, fold under "Other options" at the end of the last step.
  const last = lastNonChoice(steps);
  let frame: ViewBlock[];
  if (last) {
    last.blocks.push(...others.map((b) => ({ ...b, state: 'collapsed' as const })));
    frame = view.filter((b) => b.group === undefined && !isOtherOption(b));
  } else {
    // No step to fold them into: they stay where they were.
    frame = view.filter((b) => b.group === undefined || isOtherOption(b));
  }

  for (const step of steps) {
    if (step.choice) continue;
    const folded = step === last ? others.length : 0;
    const items = step.blocks.length - folded;
    const fields = step.blocks.filter(isField).length;
    rec.record(
      'stepped',
      step.blocks.map((b) => b.id),
      reasons.stepped(lang, step.title, items, fields, folded),
      1,
    );
  }

  return { frame, steps };
}

function lastNonChoice(steps: readonly Step[]): Step | undefined {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step && !step.choice) return step;
  }
  return undefined;
}
