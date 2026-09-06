// FROZEN after T01 — changes need a DECISIONS.md line and a test update.
//
// Content model for Mine · 由我. A page is described as an ordered list of
// blocks; the engine (transform.ts) reorganises them without ever deleting a
// critical one. Every type is mirrored by a Zod schema so demo content and
// model responses are validated, never trusted.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Importance and kind
// ---------------------------------------------------------------------------

export type Importance = 'critical' | 'primary' | 'secondary' | 'decorative';
// critical   never omitted in any mode; may be collapsed or moved, never hidden; text never replaced
//            (a plain summary may be added beside it)
// primary    core content; always shown
// secondary  related links, FAQ, announcements; collapsed to a stub in comfortable, set aside in minimal
// decorative promos, banners, stock images; set aside whenever density !== 'full' or media is off

export const IMPORTANCES = ['critical', 'primary', 'secondary', 'decorative'] as const;

export type Kind =
  | 'nav'
  | 'heading'
  | 'text'
  | 'legal'
  | 'notice'
  | 'deadline'
  | 'instruction'
  | 'promo'
  | 'faq'
  | 'field'
  | 'decision'
  | 'action'
  | 'image';

export const KINDS = [
  'nav',
  'heading',
  'text',
  'legal',
  'notice',
  'deadline',
  'instruction',
  'promo',
  'faq',
  'field',
  'decision',
  'action',
  'image',
] as const;

interface Base {
  id: string;
  kind: Kind;
  importance: Importance;
  /** A step id from content.meta.stepOrder. Fields and decisions must have one. */
  group?: string;
  /** Optional region label ("sidebar", "footer", "utility") — stubs are made per region. */
  region?: string;
}

export interface Term {
  term: string;
  plain: string;
}

export type TextKind = 'heading' | 'text' | 'legal' | 'notice' | 'instruction' | 'faq' | 'promo';
export const TEXT_KINDS = ['heading', 'text', 'legal', 'notice', 'instruction', 'faq', 'promo'] as const;

export interface TextBlock extends Base {
  kind: TextKind;
  text: string;
  level?: 1 | 2 | 3;
  complexity: 'simple' | 'medium' | 'complex';
  plainText?: string;
  terms?: Term[];
}

export interface DeadlineBlock extends Base {
  kind: 'deadline';
  text: string;
  /** ISO date, e.g. 2026-10-15 */
  date: string;
  plainText?: string;
}

export interface NavBlock extends Base {
  kind: 'nav';
  items: string[];
}

export type InputType = 'text' | 'date' | 'number' | 'select' | 'file' | 'tel' | 'email';
export const INPUT_TYPES = ['text', 'date', 'number', 'select', 'file', 'tel', 'email'] as const;

export interface FieldBlock extends Base {
  kind: 'field';
  label: string;
  input: InputType;
  required: boolean;
  help?: string;
  plainHelp?: string;
  options?: string[];
}

export interface DecisionBlock extends Base {
  kind: 'decision';
  label: string;
  plainLabel?: string;
  optional: boolean;
  preChecked: boolean;
  consequence?: string;
}

export interface ActionBlock extends Base {
  kind: 'action';
  label: string;
  primary: boolean;
}

export interface ImageBlock extends Base {
  kind: 'image';
  src: string;
  alt: string;
  decorative: boolean;
}

export type ContentBlock =
  | TextBlock
  | DeadlineBlock
  | NavBlock
  | FieldBlock
  | DecisionBlock
  | ActionBlock
  | ImageBlock;

export type Lang = 'en' | 'zh';

export interface ContentMeta {
  title: string;
  lang: Lang;
  stepOrder: { id: string; title: string }[];
}

export interface PageContent {
  meta: ContentMeta;
  blocks: ContentBlock[];
}

// ---------------------------------------------------------------------------
// Preferences (§5)
// ---------------------------------------------------------------------------

export type FontScale = 1 | 1.15 | 1.35 | 1.6;
export const FONT_SCALES = [1, 1.15, 1.35, 1.6] as const;

export interface MinePreferences {
  readingLevel: 'original' | 'plain';
  density: 'full' | 'comfortable' | 'minimal';
  navigation: 'full' | 'reduced' | 'hidden';
  fontScale: FontScale;
  contrast: 'default' | 'high';
  showDecorativeMedia: boolean;
  taskMode: 'all' | 'one-at-a-time';
  explainTerms: boolean;
  surfaceDecisions: boolean;
  /** Target language of a translated edition (BCP 47 primary tag, e.g. 'zh', 'en'); absent = no translation. Added 2026-09-06, see DECISIONS.md. */
  translateTo?: string;
}

// ---------------------------------------------------------------------------
// Zod mirrors
// ---------------------------------------------------------------------------

const ImportanceSchema = z.enum(IMPORTANCES);
const idSchema = z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case');

const BaseSchema = z.object({
  id: idSchema,
  importance: ImportanceSchema,
  group: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
});

export const TermSchema = z.object({
  term: z.string().min(1),
  plain: z.string().min(1),
});

export const TextBlockSchema = BaseSchema.extend({
  kind: z.enum(TEXT_KINDS),
  text: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  complexity: z.enum(['simple', 'medium', 'complex']),
  plainText: z.string().min(1).optional(),
  terms: z.array(TermSchema).optional(),
});

export const DeadlineBlockSchema = BaseSchema.extend({
  kind: z.literal('deadline'),
  text: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date'),
  plainText: z.string().min(1).optional(),
});

export const NavBlockSchema = BaseSchema.extend({
  kind: z.literal('nav'),
  items: z.array(z.string().min(1)).min(1),
});

export const FieldBlockSchema = BaseSchema.extend({
  kind: z.literal('field'),
  label: z.string().min(1),
  input: z.enum(INPUT_TYPES),
  required: z.boolean(),
  help: z.string().min(1).optional(),
  plainHelp: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).optional(),
});

export const DecisionBlockSchema = BaseSchema.extend({
  kind: z.literal('decision'),
  label: z.string().min(1),
  plainLabel: z.string().min(1).optional(),
  optional: z.boolean(),
  preChecked: z.boolean(),
  consequence: z.string().min(1).optional(),
});

export const ActionBlockSchema = BaseSchema.extend({
  kind: z.literal('action'),
  label: z.string().min(1),
  primary: z.boolean(),
});

export const ImageBlockSchema = BaseSchema.extend({
  kind: z.literal('image'),
  src: z.string().min(1),
  alt: z.string(),
  decorative: z.boolean(),
});

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  DeadlineBlockSchema,
  NavBlockSchema,
  FieldBlockSchema,
  DecisionBlockSchema,
  ActionBlockSchema,
  ImageBlockSchema,
]);

export const ContentMetaSchema = z.object({
  title: z.string().min(1),
  lang: z.enum(['en', 'zh']),
  stepOrder: z.array(z.object({ id: idSchema, title: z.string().min(1) })).min(1),
});

export const PageContentSchema = z
  .object({
    meta: ContentMetaSchema,
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .superRefine((page, ctx) => {
    const seen = new Set<string>();
    const stepIds = new Set(page.meta.stepOrder.map((s) => s.id));
    page.blocks.forEach((b, i) => {
      if (seen.has(b.id)) {
        ctx.addIssue({ code: 'custom', path: ['blocks', i, 'id'], message: `duplicate id ${b.id}` });
      }
      seen.add(b.id);
      if (b.group !== undefined && !stepIds.has(b.group)) {
        ctx.addIssue({
          code: 'custom',
          path: ['blocks', i, 'group'],
          message: `group ${b.group} is not in meta.stepOrder`,
        });
      }
      if ((b.kind === 'field' || b.kind === 'decision') && b.group === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['blocks', i, 'group'],
          message: `${b.kind} ${b.id} must belong to a step`,
        });
      }
    });
  });

export const MinePreferencesSchema = z.object({
  readingLevel: z.enum(['original', 'plain']),
  density: z.enum(['full', 'comfortable', 'minimal']),
  navigation: z.enum(['full', 'reduced', 'hidden']),
  fontScale: z.union([z.literal(1), z.literal(1.15), z.literal(1.35), z.literal(1.6)]),
  contrast: z.enum(['default', 'high']),
  showDecorativeMedia: z.boolean(),
  taskMode: z.enum(['all', 'one-at-a-time']),
  explainTerms: z.boolean(),
  surfaceDecisions: z.boolean(),
  translateTo: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/).optional(),
});

/** What /api/interpret returns and what the client accepts. */
export const InterpretResponseSchema = z.object({
  preferences: MinePreferencesSchema,
  reasons: z.array(z.string().max(160)).min(1).max(5),
  source: z.enum(['model', 'fallback']),
  ms: z.number().nonnegative(),
});
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>;

/** The model's raw reply, before source/ms are attached. */
export const ModelReplySchema = z.object({
  preferences: MinePreferencesSchema,
  reasons: z.array(z.string().max(160)).min(1).max(5),
});
export type ModelReply = z.infer<typeof ModelReplySchema>;

// Compile-time proof that the Zod mirrors match the hand-written types.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _prefsMirror: Equals<z.infer<typeof MinePreferencesSchema>, MinePreferences> = true;
const _termMirror: Equals<z.infer<typeof TermSchema>, Term> = true;
void _prefsMirror;
void _termMirror;
