// Which page to show for which language, plus the demo's "My words" example sentence.
// Step ids are shared by both pages (start → you → home → income → review); only the titles
// are localized, so the engine and the stepper never branch on language.
import type { Lang, PageContent } from '../engine/schema.ts';
import { contentEn } from './demo-content.en.ts';
import { contentZh } from './demo-content.zh.ts';

export type StepOrder = PageContent['meta']['stepOrder'];

export const contents: Record<Lang, PageContent> = { en: contentEn, zh: contentZh };

export const STEP_ORDER: Record<Lang, StepOrder> = {
  en: contentEn.meta.stepOrder,
  zh: contentZh.meta.stepOrder,
};

export function getContent(lang: Lang): PageContent {
  return contents[lang];
}

/** The sentence the pitch pastes into My words (PITCH.md, 1:30), per language. */
export const DEMO_EXAMPLE: Record<Lang, string> = {
  en: 'I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time.',
  zh: '长表单让我喘不过气。用大白话，解释我可能不懂的词，一次只让我做一个决定。',
};
