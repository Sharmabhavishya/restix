# ResTix design direction

Dealt with the installed `taste-skill` (sheets saved in `.taste-skill/`; reprint with
`node ~/.claude/skills/taste-skill/scripts/draw.mjs --show`).

## App screens: `accent-ladder` (seed 1287906864)

Chosen because students use ResTix in quick looks on a phone and the product is full of states
(listing status, resale policy, report priority) that need one hue in pale tints rather than a
money ledger's greyscale.

- **Type:** DM Sans 400/500/600/700, one face. Title 32 · section 18 · KPI 24 · body 14 · small 12
  (marketing body text stays 16+). Tabular figures on every price, count and table.
- **Colour:** ground `#f9fafb`, surface `#fff`, raised `#f3f4f6`, border `#e5e7eb`, text `#111827`,
  muted `#5f6672`. One hue: raspberry `#b8336a` at full strength only on small marks (the primary
  button, data series, the active nav icon); its tints `#fdf2f7` / `#f8dbe8` / ink `#6b1d3e` carry
  areas (active nav row, badges, progress tracks). No second accent family, no violet/indigo.
- **Shape:** card radius 8, control radius 6, one gap value 24 (16 on phones), no shadows at rest,
  1px borders.
- **Shell:** open plane. Labelled navigation on the page ground; no top bar on desktop app screens;
  folds to a 48px top bar + full-screen sheet on phones.
- **Screens:** list = count cards that filter; detail = object header + grid; analytics =
  per-period and running-total pairs; settings = two columns (label column + panel).

**Its face:** the product's objects lead. Listings are drawn as **wristbands**: a flat band in the
event's own pale tint with a snap-tab end that carries the price. Each event gets a stable identity
tint (pale, hues >= 60 degrees apart), like people do in the app rules; identity, not data.

**Signature element:** the wristband strip (`<Wristband>`): event, ticket type, format, quantity on
the band; price and status on the tab.

## Landing page: `one-motif` (seed 1223124312), palette and type kept

**The idea:** On this page, *the fest wristband (a coloured Tyvek band with its snap tab)* becomes
*the one motif*: the giant cropped band in the hero, the bullet beside list rows, the button's
notched end, the striped band that splits the page and the footer mark. A rival ticket app has QR
codes; this campus has wristbands, so the competitor test passes.

**The live thing:** the hero's right half is the real exchange: upcoming events with the number of
tickets available right now and the lowest asking price, read from the database. No numbers are
invented; with no listings it says so.

**Imagery:** no photographs exist and none are faked. Pictures are the product's own interface
fragments (`data-ui`), drawn at real size from real data.

**Sections (argument order):** hero (what it is + sign in) → on sale now (two-ended rows) → how it
works (one wristband in four fields, further along each time) → what keeps it safe (close-ups
board) → questions (tabbed index cards) → closing statement → footer (wristband mark built large).

## Voice: Gen Z, but trustworthy (owner request, 2026-10-27)

Write like a friend in your batch who actually reads the rules.
- **Casual and short in product moments:** "got a spare wristband?", "someone's looking for this",
  "no tickets here yet. be the first.", "sorted", "lowkey the safest way to resell".
- **Lowercase is fine for tiny moments** (empty states, toasts, button sublines); headings and
  buttons stay sentence case so they scan.
- **Never slang where it matters:** errors, safety guidance, policy, privacy, moderation and anything
  about money or handover are plain and exact. No jokes about scams.
- No emoji in the UI (house rule), no "fam/bestie" overload, no fake hype or fake numbers.
- Second person, active verbs, Indian campus context (fests, wristbands, hostel gates, UPI happens
  between you two, not on ResTix).

## House rules kept everywhere
No eyebrows, no monospace outside code, no 01/02/03, no gradients, no shadows at rest, no glass, no
emoji, no icon-topped feature cards, headlines two lines or fewer, sentence case, one h1 per page.
