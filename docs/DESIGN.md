# Design notes — "Editions"

CLAUDE.md §9 fixes palette and type. What it leaves open, decided here.

**Subject.** A cluttered public-benefits application page, and the same page as the reader's edition.
Audience: hackathon judges and, past them, people for whom the default interface is the obstacle.
The page's single job: make one transformation legible and reversible.

**Palette** (§9): paper #FFFFFF · ink #000000 · graphite #55534F · rule #D8D5CE · stub #F1EFE9 · pencil #2743D9
(pencil-soft #E4E8FB only as the wash behind a change the person is inspecting). Portal: #1E5AA8 / #EEF1F5 / #C8102E.

**Type** (§9): Literata for the edition body (18/1.6, 68ch) and for the hero line; Atkinson Hyperlegible for every
interface string, label and field, and as the body face in Large. Chinese body: system serif/sans, 17/1.8.

**Layout.** The Lab is a desk: one page frame on the left, the colophon rail on the right, the mode strip as plain text
tabs above. On narrow screens the rail becomes a bottom sheet with a count pill.

**Signature: the margin is the index of changes.** Every block the engine touched carries a hairline blue mark in
the left margin. Hovering or focusing an entry in the colophon washes the blocks it touched in pencil-soft; hovering
a marked block highlights its entry. "If it's blue, we changed it" is a rule the page can be checked against.

**Motion.** One orchestrated moment: the morph (shared `layoutId` per block across portal and edition; hidden blocks fade
with the portal, kept blocks glide, stubs and tags fade in, the colophon counts run up after layout settles).
Reduced motion: crossfade in 120 ms. Everything else ≤ 150 ms.

**Self-critique against the usual defaults.** Cream + serif + terracotta is the common default; the brief chooses pure
paper, black ink and a single blue, and the design's interest comes from the collision of two visual languages on one
screen, not from the palette. Hairlines are used only where structure needs them (deadline, colophon sections). No
numbered markers except "Step i of n", which is a real sequence. No eyebrows, no gradients, no cards with shadows.
