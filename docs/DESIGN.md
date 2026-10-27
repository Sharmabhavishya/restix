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

**Imagery:** the product's own interface fragments (`data-ui`), drawn at real size from real data,
and the owner's own photos and clips from a night at their college fest (no stock, no borrowed
pictures). Captions say what a picture shows, never that it's an event on sale.
- Photos: `npm run photos` imports them (watermark baked bottom-right, EXIF/GPS stripped, optional
  crop with `name@16x9,0.4`). Every crop on the page is anchored `100% 100%` so the mark is never
  cut; shapes that would round that corner off use a pre-cut version instead.
- Where they live: the hero band is cut from a clip (accent wash on top so it stays ours); four
  photos run end to end as one band under the hero; a full-width "don't watch it on someone's
  story" moment (16:9 cut on desktop, portrait on phones); a clip beside the closing line; the
  blue-stage clip on sign-in; the purple stage on the 404 ("this page isn't on the list"); the CO2
  jets on the welcome page.
- Clips (`<LoopVideo>`): muted loops in `public/media/` with stamped posters. The poster is a real
  priority image (it is the LCP, not the video); the clip loads after the page has, only in view,
  fades in when playing, carries an overlay mark, and never plays with reduced motion or Data Saver.

**Sections (argument order):** hero (what it is + sign in) → on sale now (two-ended rows) → how it
works (one wristband in four fields, further along each time) → what keeps it safe (close-ups
board) → questions (tabbed index cards) → closing statement → footer (wristband mark built large).

## Dark mode (added after the first build)

Follows the system setting (`prefers-color-scheme`). True neutral darks (`#0b0b0c` ground,
`#141416` surface, no navy or slate), the raspberry lifted slightly for contrast and still only on
small marks, event tints deepened through CSS `light-dark()`. Every colour is a token in
`globals.css`; components never hard-code hex values. The axe suite scans the main pages in both
schemes (with reduced motion so scroll-entrance content is included).

## The mark (redrawn 2026-10-27, owner request)

The first mark (a band with a round snap tab) read wrong at a glance. The mark is now a **ticket
stub**: notched sides and a perforation say "ticket" at any size, tilted -10 degrees like a sticker
someone slapped on, with a smile and a butter-yellow sparkle (the sparkle twinkles on hover). The
name is set lowercase, **restix**, like a handle. `components/logo.tsx` is the source; the favicon
(`app/icon.svg`) is a flat, sparkle-free cut that survives 16px; the photo watermark cuts the
face and perforation out of a white ticket; the link-preview image draws the same paths.

## Motion (CSS only)

Fun, but cheap: no animation library and no motion JavaScript. Keyframes move `transform` and
`opacity` only, so the compositor runs them (moving the individual `rotate`/`translate`
properties cost about 150 ms of extra paint per load in Lighthouse; switching to `transform` fixed
it). Everything sits behind `prefers-reduced-motion: no-preference`.
- Hero lines slide up on load (transform only, so the headline still paints first).
- Landing sections rise in with scroll-driven animations (`animation-timeline: view()`); browsers
  without it simply show the content. This replaced a small client script.
- The "free. no cap." sticker wobbles twice on arrival and on hover (not forever).
- The logo tilts and its sparkle twinkles on hover; footer letters hop on hover and the big ticket
  sticker floats; agreed prices get a one-shot confetti pop; photos zoom slightly on hover.

## Footer

"see you at the next one.", the links, then the name set enormous and cropped by the page edge,
with the ticket stuck on beside it (`components/site-footer.tsx`).

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
