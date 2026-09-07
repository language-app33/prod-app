# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

## 0.12 — 7 September 2026

- In Admin → App → the components, "where it's used" now names screens
  instead of files: "App preferences", "Editing a card", "The menu in the
  top right", grouped under Learning, Teaching and Admin. The file names
  and line numbers are gone, and a place that turns up several times on
  one screen is one line with a count.

## 0.11 — 7 September 2026

- Reload works on the first press. It used to reload the page while the
  old copy of the app was still in charge, so the old version came back
  and only a second press got you the new one. It now waits for the new
  version to take over — and says "Reloading…" while it does, so the
  press does not look like it did nothing.

## 0.10 — 7 September 2026

- A picker now comes in two widths that mean different things. The
  compact one takes only the width its labels need, with every option as
  wide as the longest — it is what Appearance, Sounds and the rest of the
  settings use. The full-width one fills the space it is given, for a
  picker in a narrow column or a menu.
- The chosen option is a flat fill. Its translucent green edge read as a
  glow around it rather than as an edge.

## 0.9 — 7 September 2026

- Picking between two or three options now looks like one control: a
  track holding the options side by side with the chosen one filled in,
  rather than three separate buttons of which one happened to be green.
  Everywhere one is used — Appearance, Sounds, Hints, on-screen keys, the
  sort-and-filter bar, the teaching screens.
- The sort-and-filter bar puts each label above its picker instead of
  beside it, so the options have room to sit in one row.

## 0.8 — 7 September 2026

- Loud is louder, and the four sounds you hear in a session — right,
  wrong, "I don't know", and moving to the next question — are longer and
  easier to notice. The next-question tick was a 45ms blip at the top of
  the register and was inaudible over almost anything; it is now a short
  two-note turn.
- The Test button in App preferences is a normal-sized button with a play
  icon, and it plays a right answer followed by a wrong one — the two you
  actually hear — rather than ending on the end-of-session fanfare.
- Appearance in the top-right menu is now three options side by side with
  the current one lit, instead of one button that cycled through them and
  made you tap twice to go back one.
- Every component in Admin → App → the components carries a number, and
  each specimen under it carries that number and its own — 12, 12.1, 12.2
  — so a change can be asked for by number.
- "Hide the components" now sits exactly where "Show the components" was,
  rather than at the far end of fifty components.
- A row of buttons that cannot fit on one line now puts the last one on a
  second row instead of running off the edge of the screen, with each
  button's own label still on a single line. The bar in a practice
  session is the exception: it shrinks its type as before, because it is
  pinned to the foot of the screen with a measured amount of room
  underneath it.

## 0.7 — 6 September 2026

- "Practice" is spelled the same way everywhere in the app.
- In Teaching → Decks, editing a deck: ticking a course now updates the
  tick straight away instead of waiting until you leave the screen and
  come back, and nothing is shared with a course until you press Save. The
  screen says how many courses are waiting to be added or removed.

## 0.6 — 6 September 2026

- Opening a tab or a screen now starts at the top of it. Reading halfway
  down a list and then moving somewhere else used to hand you the new
  place already scrolled into its middle, past whatever it opens with.

## 0.5 — 6 September 2026

- A student who is in a course that has no cards is no longer told to join
  a course. All three screens that can be empty — Home, Progress and Cards
  — now say *"You're in 1 course, but there are no cards in it yet"*,
  counting the courses they are actually in, and the Join a course button
  appears only for someone who is not in one.

## 0.4 — 6 September 2026

- The version line in the top-right menu has a **Check** button. It asks
  the server there and then, so after a merge you can sit on the menu and
  press it rather than closing and reopening the menu, which was the only
  way to re-check before. If a newer build turns up, the line says so and
  the button becomes Reload; if not, it tells you you're on the latest.

## 0.3 — 6 September 2026

- On the answer screen, everything that is not the answer — where the word
  turned up, how it's written, how it's pronounced or what it means, how it
  sounds, and the words built on the same root — now sits together in one
  inset box instead of trailing down the page. "This is how it sounds" used
  to be three blocks below its own siblings; it has joined them.
- Nothing animates when the answer appears. The question and the answer box
  used to shrink and fade over a quarter of a second; they now stay exactly
  as they were.

## 0.2 — 6 September 2026

- In a practice session, Continue moved to the bar pinned to the foot of
  the screen — the same one that carried the hint, "I don't know" and
  Check a moment earlier. A long answer can no longer push the way on out
  of reach.
- The three buttons in that bar sit closer together and closer to the
  edges, and the room that buys goes into the buttons themselves, which
  are now a size or so larger on every phone.

## 0.1 — 6 September 2026

The first numbered release. Everything before it was identified only by its
commit, which is still shown underneath the number.

- The version line in the top-right menu now leads with a release number
  instead of a commit hash. The hash stays beneath it, because it is the
  only thing that can tell you whether a deploy has actually reached your
  device — and the menu still offers Reload when it has not.
- A practice session lost its card: the question and answer sit directly on
  the page, and the answer bar is pinned to the bottom of the screen, above
  the device keyboard.
- The hint button stays put after it is tapped, so a hint can be hidden
  again.
- Feedback sounds are louder, and preferences now offer loud, soft or off.
- Buttons never wrap onto a second line: a crowded row shrinks to fit.
- Words are taught in the phrases you recorded — fill the gap, and hear it
  in a phrase — and Arabic words built on the same root are shown together
  after an answer.
- Cards can be sorted and filtered by recordings, number of forms, when
  they were added and when they were last changed.
- Saving a card, deck or course says so.
