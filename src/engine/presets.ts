import type { MinePreferences } from './schema.ts';

export type PresetId = 'default' | 'focus' | 'plain' | 'large';
export type ModeId = PresetId | 'words' | 'translate';

export const DEFAULT_PREFERENCES: MinePreferences = Object.freeze({
  readingLevel: 'original',
  density: 'full',
  navigation: 'full',
  fontScale: 1,
  contrast: 'default',
  showDecorativeMedia: true,
  taskMode: 'all',
  explainTerms: false,
  surfaceDecisions: false,
}) as MinePreferences;

/** §5 — presets are described by need, never by diagnosis. */
export const PRESETS: Record<PresetId, MinePreferences> = {
  default: DEFAULT_PREFERENCES,
  // For when there is too much on screen.
  focus: {
    readingLevel: 'original',
    density: 'minimal',
    navigation: 'reduced',
    fontScale: 1.15,
    contrast: 'default',
    showDecorativeMedia: false,
    taskMode: 'one-at-a-time',
    explainTerms: false,
    surfaceDecisions: true,
  },
  // For when the words are the obstacle.
  plain: {
    readingLevel: 'plain',
    density: 'comfortable',
    navigation: 'reduced',
    fontScale: 1.15,
    contrast: 'default',
    showDecorativeMedia: true,
    taskMode: 'all',
    explainTerms: true,
    surfaceDecisions: true,
  },
  // For when the text is.
  large: {
    readingLevel: 'original',
    density: 'comfortable',
    navigation: 'full',
    fontScale: 1.6,
    contrast: 'high',
    showDecorativeMedia: true,
    taskMode: 'all',
    explainTerms: false,
    surfaceDecisions: true,
  },
};

export const PRESET_IDS: PresetId[] = ['default', 'focus', 'plain', 'large'];
export const MODE_IDS: ModeId[] = ['default', 'focus', 'plain', 'large', 'words'];

/** The translated edition: Default plus a target language, with choices surfaced (a stranger's form deserves it). */
export function translatePreset(target: string): MinePreferences {
  return { ...DEFAULT_PREFERENCES, translateTo: target, surfaceDecisions: true };
}

export function isDefault(p: MinePreferences): boolean {
  return (Object.keys(DEFAULT_PREFERENCES) as (keyof MinePreferences)[]).every(
    (k) => p[k] === DEFAULT_PREFERENCES[k],
  );
}
