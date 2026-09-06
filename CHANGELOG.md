# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

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
