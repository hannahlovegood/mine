# DECISIONS.md — deviations from CLAUDE.md and choices it left open

One line each. Newest at the bottom.

- 2026-09-06 · The five header fields were not filled by the human. Hackathon name / deadline / judges left as placeholders; budget treated as the 48 h plan; **demo language: built bilingual** (EN and ZH content and copy), default follows the browser language, `?lang=en|zh` and a header toggle override it. The pitch can be given in either language without a rebuild.
- 2026-09-06 · Repo lives as a nested repository in the vault (`~/Documents/Claude/mine/`), no remote yet; Vercel deploys go through `deploy.sh` (a copy without `.git`, see the vault memory on Vercel's git-author check).
- 2026-09-06 · Local API: a Vite plugin serves `POST /api/interpret` in dev and preview; the Vercel function and the plugin share `server/interpret.ts`. `npm run demo` = build + preview on 4173.
- 2026-09-06 · Fonts via `@fontsource-variable/literata` and `@fontsource/atkinson-hyperlegible` (self-hosted through Vite); Chinese text uses system fonts as specified.
- 2026-09-06 · Schema: added an optional `region` field to `Base` (sidebar / footer / utility) so density rules can make one stub per region as §6 rule 2 asks; fields and decisions must carry a `group` (validated). Zod content validation also rejects duplicate ids and unknown groups.
