// The same invariants (I1–I8), run on the real demo content in both languages.
import { contents } from '../src/content/content.meta.ts';
import { runInvariants } from './invariants.ts';

runInvariants('demo content (en)', contents.en);
runInvariants('demo content (zh)', contents.zh);
