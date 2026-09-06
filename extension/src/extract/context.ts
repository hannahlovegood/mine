// Types shared by the extractor modules. No logic here.
import type { InputType, Lang } from '@engine/schema.ts';

export type Region = 'header' | 'utility' | 'sidebar' | 'footer' | 'main';

/** Everything the pre-pass learned about one form control (or radio group). */
export interface ControlInfo {
  /** The element that carries the block: the input/select/textarea, or the first radio. */
  el: Element;
  kind: 'field' | 'decision';
  /** All radios of the group (empty for other controls). */
  members: Element[];
  labelEl: Element | null;
  label: string;
  required: boolean;
  inputType: InputType;
  options?: string[];
  help?: string;
  /** Checked at extraction time (decisions only). */
  checked: boolean;
  /** The label reads like an attestation (decisions only). */
  attestation: boolean;
  /** The element to hide/show for this control (see boxes.ts). */
  box: Element;
}

export interface ExtractContext {
  doc: Document;
  body: Element;
  lang: Lang;
  maxBlocks: number;
  /** Epoch ms used to judge whether a dated sentence is a live deadline. */
  now: number;
  /** Region roots other than main, nearest ancestor wins. */
  roots: Map<Element, Region>;
  /** The main content root. */
  main: Element;
  /** The site menu element, when one was identified. */
  siteMenu: Element | null;
  /** The first h1 (else h2) outside header/footer/sidebar — anchors the main root. */
  anchor: Element | null;
  /** The form root (a <form>, or the common wrapper of the main controls). */
  form: Element | null;
  /** Block-carrying control → its info. */
  controls: Map<Element, ControlInfo>;
  /** Any radio → the first radio of its group. */
  memberOf: Map<Element, Element>;
  /** Elements consumed by a control (labels, legends, help) or a composite; never blocks. */
  consumed: Set<Element>;
  /** Visible headings in document order. */
  headings: Element[];
}
