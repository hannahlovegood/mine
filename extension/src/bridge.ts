// What crosses between the page (content script + controller) and the side panel.
// The panel never sees DOM; it gets a serialisable snapshot and sends commands.
import type { ModeId } from '@engine/presets.ts';
import type { Lang, MinePreferences } from '@engine/schema.ts';
import type { ChangeType } from '@engine/transform.ts';
import { blockName } from '@app/ui/blockNames.ts';
import { summarySentence } from '@app/ui/summary.ts';
import type { Controller, Settings } from './controller.ts';

export interface SnapshotChange {
  type: ChangeType;
  count: number;
  reason: string;
  names: string;
  ids: string[];
  restorable: boolean;
  restored: boolean;
}
export interface SnapshotDecision {
  id: string;
  label: string;
  optional: boolean;
  preChecked: boolean;
}
export interface Snapshot {
  lang: Lang;
  mode: ModeId;
  prefs: MinePreferences;
  active: boolean;
  summary: string;
  changes: SnapshotChange[];
  decisions: SnapshotDecision[] | null;
  stepIndex: number;
  stepCount: number;
  comparing: boolean;
  status: string | null;
  notice: string | null;
  words: { reasons: string[]; source: 'model' | 'fallback' } | null;
  wordsText: string;
  settings: Settings;
  remembered: boolean;
  host: string;
  announcement: string;
}

export type PanelCommand =
  | { type: 'GET_STATE' }
  | { type: 'SELECT_MODE'; mode: ModeId }
  | { type: 'APPLY_WORDS'; text: string }
  | { type: 'SET_WORDS_TEXT'; text: string }
  | { type: 'RESET' }
  | { type: 'RESTORE'; ids: string[]; on: boolean }
  | { type: 'SET_STEP'; index: number }
  | { type: 'COMPARE'; on: boolean }
  | { type: 'SAVE_SETTINGS'; settings: Settings };

export type PageEvent = { type: 'MINE_STATE'; snapshot: Snapshot };

export function snapshot(c: Controller): Snapshot {
  const s = c.state;
  const lang = s.lang;
  const lookup = (id: string) => s.page?.content.blocks.find((b) => b.id === id);
  const changes: SnapshotChange[] = (s.tr?.changes ?? []).map((ch) => {
    const names = ch.blockIds.map(lookup).filter((b): b is NonNullable<typeof b> => !!b).map((b) => blockName(b, lang));
    const shown = names.slice(0, 3).join(lang === 'zh' ? '、' : ', ') + (names.length > 3 ? (lang === 'zh' ? ` 等 ${names.length} 项` : ` and ${names.length - 3} more`) : '');
    return {
      type: ch.type,
      count: ch.type === 'stepped' ? 0 : ch.blockIds.length,
      reason: ch.reason,
      names: shown,
      ids: ch.blockIds,
      restorable: ch.type === 'hidden',
      restored: ch.type === 'hidden' && ch.blockIds.every((id) => s.restored.has(id)),
    };
  });
  const d = s.tr?.decisions;
  return {
    lang,
    mode: s.mode,
    prefs: s.prefs,
    active: s.mode !== 'default' && !!s.tr,
    summary: s.tr ? summarySentence(s.tr, lang) : '',
    changes,
    decisions: d && s.prefs.surfaceDecisions ? [...d.optional, ...d.required].map((b) => ({ id: b.id, label: b.label, optional: b.optional, preChecked: b.preChecked })) : null,
    stepIndex: s.stepIndex,
    stepCount: s.stepCount,
    comparing: s.comparing,
    status: s.status,
    notice: s.notice,
    words: s.words ? { reasons: s.words.reasons, source: s.words.source } : null,
    wordsText: s.wordsText,
    settings: s.settings,
    remembered: s.remembered,
    host: c.hostLabel(),
    announcement: s.announcement,
  };
}

/** Runs a panel command against the page's controller. */
export async function runCommand(c: Controller, cmd: PanelCommand): Promise<void> {
  switch (cmd.type) {
    case 'GET_STATE':
      return;
    case 'SELECT_MODE':
      return c.selectMode(cmd.mode);
    case 'APPLY_WORDS':
      await c.applyWords(cmd.text);
      return;
    case 'SET_WORDS_TEXT':
      c.setWordsText(cmd.text);
      return;
    case 'RESET':
      return c.reset();
    case 'RESTORE':
      c.restore(cmd.ids, cmd.on);
      return;
    case 'SET_STEP':
      c.setStep(cmd.index);
      return;
    case 'COMPARE':
      c.compare(cmd.on);
      return;
    case 'SAVE_SETTINGS':
      return c.saveSettings(cmd.settings);
  }
}
