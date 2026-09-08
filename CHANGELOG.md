# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

## 0.32 — 8 September 2026

- Tapping anything on a phone no longer flashes a grey square. The flash
  was the browser's own, drawn as a rectangle over the whole button
  whatever shape the button actually was, so a round icon button, a pill
  and a rounded card all lit up as blocks. The app now draws the press
  itself: a light tint that takes the shape it is pressing, on buttons,
  pills, tabs, cards and the rows that open something. Text-only buttons
  like "Report this" get a rounded press area of their own, and holding a
  button no longer selects its label.
- A filled button no longer stays brightened after being tapped. On a
  touchscreen the hover look sticks to the last thing you touched, and
  this one had been left out of the rule that turns hover off there, so a
  Create or Save button looked busy long after it had finished.

## 0.31 — 8 September 2026

- A person's courses in Admin > People are grouped by what they do in
  them. "Teacher in" once, then the courses they teach; "Student in"
  once, then the courses they study. They used to be a run of badges with
  the role repeated in front of every course, so somebody in six courses
  meant reading the word "Student" six times to reach the six names —
  which are the part that differs. Each course now says what it teaches
  underneath its title, the way it does in the list you pick a course
  from, and somebody in none of them says "In no course" rather than
  showing nothing. Admin stays a badge: it is something a person is, not
  a course they are in.

## 0.30 — 8 September 2026

- Admin > Decks has a filter beside the search box: one button, which
  opens a list of everyone who has made a deck, with how many each of
  them made. Picking a name shows their decks and nothing else. Search
  already matched the maker's name, but only if you knew whose name to
  type, which is the thing you don't know when you are looking at decks
  made by six different people. Anything selected is dropped when the
  filter changes, so a bulk delete can never reach a deck the filter has
  taken off the screen.
- A person's card in Admin > People now says when they were last seen,
  when they last practiced, and when they last made or changed a card or
  a deck — each with the date and the time. They are three different
  questions: somebody who opens the app every morning and never practices
  looks exactly like a diligent student under one "last active" line, and
  a teacher whose course has gone quiet looks like a teacher who is still
  writing cards.
- Practising is recorded on the server the way nothing else about it is:
  the app says "some learning happened" and the server keeps the moment.
  What was practiced and how it went stay in the document on the device,
  which the server cannot read. The app says so at most once a quarter of
  an hour, so a long session is one small message rather than one per
  answer.
- The "Hasn't signed in yet" pill has gone from a person's card. The line
  underneath it says the same thing, beside the two questions it belongs
  with.

## 0.29 — 8 September 2026

- When you type a word correctly but without its vowel marks, the app
  says well done and adds "The harakat are above — worth a look." The
  marks were not above: because the answer was right, the app did not
  show the word, so the only thing on screen was the unmarked spelling
  you had just typed and the nudge pointed at nothing. The properly
  marked spelling is now shown, with the nudge directly under it. The
  same fix reaches the tone marks in Vietnamese and the niqqud in Hebrew,
  which say the same thing.
- Nothing about marking changes: typed marks still have to be right, and
  a course that requires them still marks a bare answer wrong.

## 0.28 — 8 September 2026

The people in a course are now one list rather than two.

- **Everyone appears once.** Teaching and studying are separate things
  someone can hold, and the old screen showed one list of teachers and
  one of students end to end — so a person doing both was listed twice,
  with two identical rows.
- **Each person's roles are two switches** rather than two badges you can
  only read. Switching one off drops just that role. Switching off the
  last one is the way out of the course, and it is the only thing that
  asks first.
- **Fixed: removing someone from one role removed them from both.** Both
  of those duplicate rows had a remove button, and both took the person
  out of the course entirely — so dropping a teacher silently unenrolled
  them as a student, with nothing in the confirmation to say so.
- **One way in.** "Assign a teacher" and "Enrol a student" were two
  buttons opening two pickers, neither showing what the person already
  was. There is one "Add someone" now, offering only people who are not
  in the course, and the role you switch on is the one they arrive with.
- **A new person can be created as both at once**, instead of being made
  with one role and then edited to add the other.
- Making someone a teacher does not quietly enrol them as a student. If
  they want the course's cards in their own practice, that is the second
  switch.

## 0.27 — 8 September 2026

- A course can be renamed. In Admin, open a course and its name now sits
  at the top with a Rename beside it. Only the name changes: the join
  codes, the people in it and the decks attached to it are all held
  against the course itself, not its title, so nothing has to be handed
  out again and nobody loses access.

## 0.26 — 8 September 2026

Nothing here changes what the app does. All three are about making the
next change less likely to break it, which an audit said was the weakest
thing about the code.

- **The tests now run themselves.** Every push and every pull request
  runs the linter, the tests, the harness that renders the app, and the
  build. Before this nothing ran unless someone remembered — and the one
  check that opens a session and answers a question was not even part of
  the test command, so it could go a week without running.
- **A linter, and the 130 things it found.** Among them: a key defined
  twice in the server, so one of the two had never done anything; a whole
  CSV export nothing offered; a deck filter left reading as though it
  still worked when nothing could set it; and a card-selection feature
  wired to nothing. All removed. Twenty-one hooks were reading values
  they had not declared — every one turned out to be deliberate, and each
  now says why in a sentence, so the next one that isn't will stand out.
- **The scheduling maths can be tested.** The part that decides when a
  card comes back had no tests and could not have any: it lived inside
  the screen file and read the clock as it went. It is now its own piece
  with the clock passed in, and thirty tests hold it to exact numbers —
  a good answer on a ten-day card gives twenty-five days, ease never
  falls below 1.3, a forgotten card is halved and comes back in ten
  minutes. Each was checked by breaking the maths on purpose and
  confirming the tests noticed.
- **What happens when two devices disagree.** The sync tests only ever
  merged things that did not conflict. There are now tests for a phone
  and a laptop editing the same card: which edit wins, what is kept, and
  — written down plainly rather than glossed — what is lost. The list of
  exercise types those tests ran against had been copied by hand and had
  been wrong by two for months; it is taken from the real list now.

## 0.25 — 8 September 2026

- In the menu in the top right, "Sync now" is a button with a stroke, and
  it is the only part of that row you can tap. The whole row used to
  start a sync, so reading how sync was getting on — which is what the
  row is there for — meant risking the thing it was reporting.
- The app's name in the top left no longer looks like a button. It sat
  between two real buttons wearing the same pill, the same stroke and the
  same shadow, so it read as the third control in the row. It keeps a
  soft ground behind it, because a fixed name over a scrolling page is
  unreadable without one, but nothing else.

## 0.24 — 8 September 2026

- The English meaning and the romanisation are now sized as the Latin
  they are, rather than at sizes meant for Arabic. Every size in the app
  was chosen by eye against Arabic, which spends part of its height on
  the harakat above and the tails below; Latin puts nearly all of its
  height on the line, so the same number came out looking bigger. The
  meaning was reading louder than the word being learnt, which is
  backwards. It now takes the same reduction Vietnamese already takes —
  Vietnamese being Latin — so in a Vietnamese course the word and its
  meaning come out at one size again, as they should.
- The word being taught does not move by a pixel, in any language.
- The question still sits exactly as far below its instruction as it did,
  whichever field fills it. A smaller line has less space above it, so a
  smaller meaning would have crept upward; it is given that space back.

## 0.23 — 8 September 2026

- The stylesheet no longer knows what Arabic is. Where a piece of the
  taught script was drawn, the stylesheet used to name an Arabic typeface
  and right-to-left as what to use if the language had not reached it.
  Arabic was the only language for a long time, so that read as a
  sensible safety net; with three languages it means anything the
  language fails to reach still looks finished, and looks Arabic. It now
  falls back to the interface typeface reading left to right, so a
  language that goes missing looks like the fault it is. A test refuses
  any new fallback, so the old shape cannot come back quietly.
- Fixed: the app's own name at the top of the sign-in screen — مُفْرَدات
  — was being drawn in the typeface of whatever language you were
  learning, so a Vietnamese learner saw an Arabic word rendered in a
  Latin face, and it changed size with the language too. It is the
  product's name rather than anything you are studying, so it now keeps
  its own face at its own size whatever you are learning.
- Fixed: the box you type your answer into was aligned to the right,
  which is where Arabic and Hebrew begin but where Vietnamese ends — so
  Vietnamese was typed into a right-aligned field. It now aligns to
  wherever the language you are learning begins, which leaves Arabic and
  Hebrew exactly as they were.
- Fixed: the internal component gallery drew its sample card with no
  typeface of its own and relied on that same Arabic safety net. It uses
  the real Arabic language description now, like the app does.

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
