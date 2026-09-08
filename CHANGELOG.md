# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

## 0.22 — 8 September 2026

- Each language now renders at a size tuned to its script. A font size
  sets the box a letter sits in, not the height of the letter, and how
  much of that box a script fills differs — Arabic leaves room above for
  harakat and below for the tails of ب and ج. Every size in the app was
  tuned by eye against Arabic and then shared with every language, so
  Vietnamese came out oversized. Each language now says how much to
  multiply by: Arabic is 1, so nothing about it moves by a single pixel,
  and Vietnamese is 0.78. Hebrew says nothing and so renders unchanged,
  which is also the proof that adding a language never means touching the
  stylesheet.
- Fixed: in the learner's own card editor, the preview of the word was
  drawn in the interface typeface at the size of a statistic, instead of
  in the script's own face at its own size.

## 0.21 — 7 September 2026

- In a practice session, the question and the verdict are now grey rather
  than full-strength text — the same grey the app already uses for
  secondary writing. The verdict's green and red are gone with it: the
  words say which it was, and a wrong answer no longer meets a wall of red
  at the moment it is least wanted.
- The question sits closer under its instruction, and the answer sits
  further below the box you typed in.
- The on-screen keyboards keep their layout at any width. A row of letters
  never folds in half now — the keys share the row and the type steps down
  to fit, so the top row of an Arabic or Hebrew keyboard is where anyone
  who has used one would look for it. The row of word-labelled keys —
  space, clear, hide — still wraps, because "space" cannot shrink to the
  width of a letter.
- Admin → App has a new section, "A question and an answer": every named
  piece of the two practice screens, with what it is and an example of
  what it holds. Naming the piece is the quickest way to ask for a change
  to either screen. A test keeps the list and the screens in step, in both
  directions.

## 0.20 — 7 September 2026

- "Israeli Hebrew" is now called "Modern Hebrew" wherever the language is
  named.
- The selected tab — Home, Progress, Cards, Courses, and the tabs in the
  Teaching and Admin spaces — carries a dark grey outline, so which one
  is current reads at a glance rather than by shade alone. The stylesheet
  had asked for this outline all along, but in a colour that was never
  defined, and a border in a colour that does not exist is quietly thrown
  away. That is why it kept not appearing. The colour exists now.
- The same mistake had also taken the highlight off the select-mode button
  and picked tiles, and left fifteen other rules naming an "ink" colour
  that inherited whatever was around them. All three colours are defined
  now, and a check fails the build if any colour the stylesheet uses is
  ever left undefined again.

## 0.19 — 7 September 2026

- Tapping "I don't know" no longer says "Incorrect. The correct answer
  is:" — nothing was offered to be incorrect. It says "The answer is:",
  in the ordinary text colour rather than the red of a miss.
- The verdict always fits on one line. "Incorrect. The correct answer
  is:" is 496px wide at full size and a phone's column is 288px, so the
  verdict now takes its size from the screen — about 16px on the narrowest
  phone, 20px at 390px, the full 28px from 540px up — and every verdict on
  a given screen is that one size.
- The box you type an answer into is one height whichever language you
  are typing: 64px, a little over what the English box was, and well under
  the 102px the script box was. Each script keeps its own type size.
- Editing a card: the taught-language field and the English field each
  have a + at the end to add another accepted answer, and a − to take one
  away. Several answers are still stored the way they always were — with
  a slash between them — so the checker and every existing card are
  untouched; the slash is simply no longer something a teacher types.

## 0.18 — 7 September 2026

- **Hebrew.** The app now teaches Modern Hebrew alongside Palestinian
  Arabic and Huế Vietnamese. A teacher can make a Hebrew course, deck and
  cards; a student who joins one is switched to Hebrew and sees it right
  to left in a Hebrew typeface, with the standard Israeli keyboard and a
  separate row of niqqud. Marking works the way Arabic's does: type the
  bare letters or the fully pointed spelling and either is accepted, but
  niqqud you do type have to be right. A beginner who types כ at the end
  of a word is not marked wrong for ך — that's a leniency a teacher can
  tighten. After an answer, "Built on the same root" gathers the family:
  כָּתַב shows כּוֹתֵב, מִכְתָּב and כְּתִיבָה.
- The Marking settings in App preferences now belong to the language you
  are learning. They were Arabic's two, written out by hand and shown to
  everyone — a Vietnamese learner was asked about harakat, and Vietnamese's
  own tone-marks setting had no control at all. Each language now shows
  its own; Hebrew's are niqqud and final letters.
- Importing cards: a table headed with a language's own column names
  ("Hebrew", "Pronunciation note") is read as a table — only "Arabic" used
  to be recognised — and the worked example and placeholder are in the
  language you are learning. The importer also asks the language which
  cell holds the word, rather than checking for Arabic letters.
- The card editor and the bulk-import screens no longer say "Arabic"
  where they meant whichever language you are learning.
- The course-language picker in course settings fits a third name on a
  phone: it now wraps onto a second row instead of running off the
  screen.

## 0.17 — 7 September 2026

- The foot of an exercise screen no longer has a line across its middle:
  "Can't listen right now" and "Flag a problem" sit on the same ground as
  the buttons below them, with one edge at the top of the whole foot. Both
  now carry an icon — a crossed-out speaker and a flag — and both sit
  centred between that edge and the buttons.
- New wording after an answer. A miss says "Incorrect. The correct answer
  is:" and hands over to the answer below it. A hit rotates through
  "Correct!", "Good job!", "Nicely done!" and "Great!" in order, so a long
  session does not say the same word twenty times.
- The verdict is large again — 28px — and the same size in every exercise.
- What else is worth knowing about a card now opens on a tap. Under the
  answer there is a small "Learn more" with a chevron; the box was open by
  default and put five blocks of context between you and the Continue
  button. It opens closed on every new question.

## 0.16 — 7 September 2026

- "Can't listen right now" is now plain text with no outline or fill, like
  "Flag a problem", and sits pinned just above the buttons at the foot of
  the question screen. It used to be a bordered button in the middle of
  the page, which read as a fourth thing to do with the question rather
  than a way past it.
- "Flag a problem" moves to that same place on the answer screen: pinned
  above the Continue bar instead of trailing below the answer, where a
  long answer meant scrolling to reach it. Its menu now opens upward.
- The verdict — "That's right", "Not quite — here it is" — is smaller, and
  is now always smaller than the answer it introduces. At its old size it
  was bigger than the answer in four of the five shapes an answer takes.

## 0.15 — 7 September 2026

- In a practice session, the question is now asked at the same size and
  the same distance below the instruction whatever the exercise is. It
  used to be sized by whichever field the exercise happened to put there:
  the same card was asked at 44px as a word to translate, 25px as a
  meaning to write out, and 19px in grey as a romanisation — the size and
  colour of a hint, for the one thing on the screen that is the question.
  The gap under the instruction moved with it, between 18px and 33px.
- A listening question's Play button now starts exactly where a written
  question's first letter does, so switching between the two no longer
  shifts the screen.
- The size still gets smaller on a narrow screen and smaller again with
  the phone keyboard up. Those are about the room available, not about
  the exercise.

## 0.14 — 7 September 2026

- Card tiles on the Progress tab now open the card when you tap one — the
  same full-screen card the Cards tab shows. They were the one place in
  the app where a small card told you how well you knew it and then had
  nothing to say when you asked to see it. The tiles in Learning → Cards,
  Teaching → Cards and inside a deck already opened, and still do.
- Those progress tiles are also reachable with a keyboard now: Tab to one,
  press Enter.

## 0.13 — 7 September 2026

- The Cards tab, in both Learning and Teaching, now shows the same small
  tile the progress screen uses: the word, its meaning, and the date it was
  added — nothing else. The deck names, the number of forms, the number of
  recordings and the language are gone from the tile; they are all still on
  the card itself when you open it. Three tiles fit on a row on an ordinary
  phone, two on a very narrow one, where one and a half used to.

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
