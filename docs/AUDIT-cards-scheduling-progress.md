# Audit: cards, scheduling and progress

**16 September 2026 · release 0.143, commit 4fdc4f5 · re-checked against 0.144 (94c18a4), which landed on `beta` during the audit: every probe below still reproduces on the merged tree.**

An in-depth read of how a card is stored, how a session is dealt and marked,
and how progress is kept and shown, judged against two principles:
architectural simplicity and extreme stability. The whole check suite is
green on this tree: lint, types, 479 unit tests, 478 smoke checks, build.
Green is the floor, not the verdict. Everything below is something a green
check could not say, and every finding marked *probed* was reproduced by
running the real code, not by reading a comment.

## The short version

The core has held up better than seven releases in a day would suggest.
The pieces that decide what a learner is asked — what a card is made of,
the ladder, the tables, the blanks — are small, pure, take their clock as
an argument, and are tested against each other. The direction of the recent
work is right: one list of forms instead of two shapes, one door for walking
them, one place for each gate.

Two things pull hard against that.

**Progress is being lost, silently, on five paths.** Two of them fire on
the most ordinary event in the app — a teacher saving any card — and reset
every student's progress on every line of every conversation, and every
sentence card's record of which names it has met. One fires on every page
open and every sync and discards a learner's work on a card's second
spelling. One reshuffles the schedules of a verb's cells across the wrong
words whenever a teacher corrects a typo in the table. And one is on the
teacher's side: since yesterday's change to how a card is stored, the editor
opens the card's own word **blank** for any card saved since, and **stale**
for any older card, and the next Save writes that back.

**None of the five is reached by a test, and the reason is structural.**
The stored shape of a card changed in 0.138, and every fixture in the test
suite is still written in the old shape. The code that reads a card is
deliberately tolerant — it reads the old shape as the new one and never
throws — so the suite went on passing while the one reader that slipped
(the editor) went on reading a field the storage layer had stopped
writing. Tolerance without a round trip is how a wrong reading stays green.

The other half of the structural problem is older: the session builder,
the grader, the migration that runs on every load, and the chain that
decides which questions a form may be asked all live inside the one
11,400-line screen file, unexported, some of them closures over React
state. The pure modules are tested to a high standard; the functions that
*use* them to deal and mark a session are covered by one answered question
in a jsdom walk.

## What is holding up well

- **A card is its forms.** The move to one list was done as a lift-on-read
  with the old shape still readable. Every reader goes through three tiny
  functions, and a test guards that nothing walks `subs` any more.
- **The ladder is one answer.** Opening a level, reading how far a form has
  climbed, and what the progress screen says are three readings of one
  table of bars, and a test walks 125 combinations to hold the screen and
  the scheduler together.
- **Gates are read in one place.** A verb's closed rows, a form the teacher
  keeps without asking about, and a known word's narrowed cells all reduce
  to "which keys does this form climb with", and the dealt session, the
  counts and the screen all read that list. The one exception is below.
- **Storage is tolerant.** Every reader of a stored card takes an unknown
  value and answers "nothing" rather than throwing. States are stored
  sparse and rehydrated. Sync merges per form and per exercise, with
  high-water marks where order must not matter, and is tested idempotent.
- **The clock and the dice are injected** in the scheduler, so its maths is
  asserted exactly.
- **Decisions are written down**, including the ones later reversed, which
  is what let this audit tell a deliberate cost from an accident.
- **0.144 moved in the right direction.** The re-queue of a missed
  question and the spacing of types came out of the session builder as two
  exported pure functions with a test file of their own. That is exactly
  the move step 8 below asks for the rest of the builder and the grader.

## Findings

Ranked by what a person using the app would lose. Severity is about
damage, not about how hard the fix is; most of the fixes are small.

### High

**1. The teacher's editor opens the card's own word blank, or stale, and saves it back that way.** *Probed.*
Since 0.138 the server stores a card's word only as the first of its
forms. The editor still reads it off the top of the card, where it used to
live. A card created since then opens with an empty first block, no
recordings on it, grammar reset to defaults and "asked about" switched
back on; Save is grey until the word is retyped, and then writes the
retyped word with no recordings. A card from before 0.138 that has been
re-saved since opens with its *old* wording and *old* recordings beside
its current other forms, and the next Save quietly reverts the word to the
stale copy. Every fixture handed to the editor by the tests is old-shape,
which is why this is green.
*Fix: read the lead form through the same door everything else uses.
Minutes. Add a test that opens a forms-only card.*

**2. Every course-material refresh resets a student's progress on every line of every conversation.** *Probed.*
When new material arrives, a card's forms are folded so the student keeps
their progress. The lines of a conversation are not folded: they are taken
from the fresh copy, which carries no progress. The refresh runs whenever
any teacher on the course saves anything; 0.144's own comment beside the
fold puts it more starkly — the teacher's card is taken whole, so anything
of the learner's not listed there is wiped by the next refresh, "which
happens every forty-five seconds". 0.144 listed the new priority mark.
Lines and the met record are still not listed.
*Fix: fold the lines the way the forms are folded. An hour.*

**3. Progress on a card's second accepted spelling is discarded on every page open and every sync.** *Probed.*
A card written "سفر / رحلة" keeps a schedule for each spelling on the
questions that show one. The second one's schedule is written and stored
correctly, but the routine that rebuilds a card's states when a document
is read copies only the plain exercise names, so it is dropped. That
routine runs on load, after every sync and on import. Since 0.99.
*Fix: copy every stored key that names a live exercise, whatever its
suffix. An hour with the round-trip test.*

**4. A verb's cells have no name, so an edit to the table reshuffles students' schedules across the wrong words.** *Probed for the naming; the reordering is read off the editor's write path.*
Forms were given names in 0.131 precisely so that inserting one above
another could not move every student's progress down a place. Cells of a
table never got one: the editor mints names for plain forms only, and it
rewrites an edited cell to the *end* of the list on every keystroke. On a
student's device a nameless form is known by its position, so a teacher
fixing a typo in "present · I" hands that cell's schedule to the next
cell, and so on down the table. The same happens when a plain form is
added above the table.
*Fix: name a cell when it is made and update it in place. An hour. The
positional fallback then carries existing tables across the first
re-save.*

**5. A sentence card's record of which names it has met is dropped on every material refresh.** *Probed.*
The fold keeps a form's schedule and nothing else. The high-water mark
that says "this frame has met Raphael at level three" lives beside the
schedule and is not carried, so after a refresh every name reads as
unmet and the sentence is held back, or asked at the bottom again.
*Fix: carry it in the same fold. Minutes, once finding 2 is done.*

### Medium

**6. The old card shape is left on disk beside the new one.**
Saving an existing card spreads the stored record under the new fields and
never clears the old top-level word, recordings, answers or `subs`. Every
pre-0.138 card carries both shapes for ever, every card payload on the
wire carries a stale copy of the word, and any reader that slips picks the
wrong half — which is finding 1.
*Fix: clear the retired fields on save. Minutes. Add an assertion that a
saved record carries no `subs` or top-level word.*

**7. "Build a session" ignores two gates the dealt session honours, and reads cards in the wrong language.**
A dealt session leaves out a form the teacher switched off and a verb cell
whose row has not opened. A hand-built session walks every form of the
chosen cards directly and applies neither, so a "kept, not asked" table is
asked there and a future tense is dealt before the present is known. It
also asks which exercises a form supports in the app's current language
rather than the card's own, so in a two-language deck a Vietnamese card is
judged by the Arabic pack. The decision record says the gate is read "in
one place"; this is the second place.
*Fix: take the units from the same function the dealt session does. An
hour.*

**8. "This was too easy" reads the ladder off the question as shown, not off the form as stored.**
The question on screen is a narrowed copy of the form — one spelling, one
meaning, holes filled — and the lift computes which keys to raise from
that copy. On a two-spelling card the copy has one spelling, so a lift on
the second spelling's question raises the first spelling's states. The
message says "moved up a level" and the level does not open.
*Fix: compute the keys from the stored form, which the routine already
looks up to write to. Half an hour.*

**9. "Reset scheduling" does nothing on a current card.**
It writes fresh states onto the card and onto a `subs` list, neither of
which is where a card's progress lives any more; the next load strips the
junk. The message says the schedule was reset. Nothing was.
*Fix: reset the forms. Minutes.*

**10. Backups never include a conversation's recordings.**
The backup manifest collects recording hashes from a card's forms only;
the lines of a conversation carry recordings of their own and are not
listed, so every restore lacks them. No backup or restore is tested.
*Fix: walk the lines too. Minutes, plus the missing test.*

**11. Two source files contain raw NUL bytes, and git treats the editor as binary.**
Five places build a lookup key by joining two strings with a literal NUL
character, typed as the byte rather than the escape. One sits early enough
in the card editor that git classifies the whole file as binary: every one
of the last fifteen diffs of the editor reads "Bin", so the most-changed
file of the restructuring has been unreviewable by diff, and grep stops on
both files. Not a runtime fault; a review fault, and possibly why finding 1
was not seen.
*Fix: write the escape. Minutes.*

**12. A setting nobody can see still hides cards.**
Whether words, phrases, sentences and conversations are practised is read
from a stored setting that no screen sets any more and that the recent
clear-out of retired settings did not clear. A device that switched
conversations off in an old release keeps them off, everywhere, with
nothing on any screen to say so — the exact case the clear-out was written
to prevent.
*Fix: retire it. Minutes.*

**13. A saved card with a table cannot have its kind corrected, and an old preposition is guessed to be a noun.**
The kind radio is withheld whenever a card carries a table, so a card that
was never asked what it is cannot be told. Where it is guessed, the guess
is the first kind that declares the table, and nouns and prepositions
share one — so every pre-0.137 preposition with pronouns opens as "Noun",
is saved as one on the next Save, and from 0.139 starts filling `{{noun}}`
blanks. The 0.137 changelog promised the teacher could say otherwise
before saving; for these cards they cannot.

### Low

**14. Room for new cards is counted through the listening quiet-window.** The count of cards in hand reads the open exercises after the fifteen-minute listening silence is applied, so slightly more new cards are admitted during the window. The comment says it counts the way the progress screen counts; the screen reads the list before the window.

**15. Six functions read which exercises a form supports in the app's language, not the card's.** The recent-mistake test, the fully-learnt test, the unmet-scene test, the difficulty ranking and the manual builder call the support check with its default language. The correctly-written sibling has a comment warning about precisely this.

**16. The smoke harness is not deterministic.** It runs on the real clock and real randomness with 283 real sleeps, and its own comments record a check that "failed about one run in seven" and was loosened. The scheduler already routes time and chance through one object; the harness never pins it.

**17. Silent caps on the server.** Forms, recordings per form, speakers, lines, uses and text lengths are all cut with no error and no matching check on the client. A teacher who exceeds one finds out by what is missing.

**18. A cell pointing at a form that no longer exists is dropped on save without being counted** in the "put aside" warning, which counts only cells of another table.

## Simplicity, measured

Where the code that decides a card's fate lives:

| what | where | size | reachable by a unit test |
|---|---|---|---|
| what a card is made of | `cards.ts` | 114 lines | yes |
| the ladder and the maths | `scheduler.ts` | 833 | yes |
| tables and agreement | `verbs.ts` | 574 | yes |
| blanks and values | `variables.ts` | 574 | yes |
| dealing, marking, gates, migration, indexes, progress | `ArabicTrainer.tsx` | 11,398 | mostly no |
| editing, four editors over one draft | `card-editor.tsx` | 3,383 | the rules, not the save |

**Five hand-kept lists say which fields a card has**, and they must agree
by hand: the server's save whitelist, the reader that turns a teacher's
card into a device item, the load-time split of card fields from form
fields, the editor's split of a patch, and the editor's opener. The fifth
disagreed with the first and nothing noticed.

Inside the screen file, a form's exercises pass through a chain of five
named filters before one is dealt — supported, enabled, laddered, open,
askable, then pickable — each a real distinction with a comment explaining
why it is not the one beside it. Six other functions bypass the chain and
read the first link directly, which is where findings 7 and 15 come from.
Ten module-level variables are written during render so that these
functions can look pure while reading a map; two comments admit that a
gate "that reads the answer it is in the middle of writing reads whatever
the last render left behind".

Inside the editor, one thing is stored (the kind of word) and five are
derived on every open (the shape, the table, whether it stands in for a
cited cell, whether the table is per form, whether it waits on the word).
About sixteen sites branch on one of those; twenty-one tell the card's own
word from its other forms by position. The four-editors split cleaned the
screen — the blocks are genuinely flag-free — but the draft underneath
still carries the kind as four booleans, and the save reassembles the card
from three lists.

The decision record openly carries four accepted second sources of truth,
each with a stated rule. This audit adds three unstated ones: the list of
exercise names copied on load (finding 3), the old shape kept beside the
new on the server (finding 6), and the position of a cell standing in for
its name (finding 4).

## Stability, measured

Paths by which a card enters memory: read from storage, adopted after a
sync, pulled from a course, imported, made in the editor. The first,
second and fourth go through one lift; the third and fifth build a full
state table themselves. That is why the unguarded state reads inside the
session builder are safe today, and why they stop being safe the day a
sixth path is added without the lift.

Silent progress-loss paths found: five (1 through 5). Silent
misbehaviour paths: four (7, 8, 9, 13). Content-loss path in backups:
one (10). All ten are on the read, write or fold side of a card — none in
the pure layer — and none is reached by a test. The pure layer is sound.

## What to do, in order

1. **Today.** Findings 1 and 6: open the lead through the one door, clear
   the old shape on save, and add a test that a forms-only card opens
   correctly. A teacher cannot safely edit a card until this is in.
2. **Today.** Findings 2 and 5: fold lines and the met record. Every
   teacher save is currently resetting students.
3. Finding 3: keep suffixed keys through the load-time lift, with the
   round-trip test.
4. Finding 4: name cells, update in place.
5. Findings 7, 8, 9, 10: the manual builder, the too-easy lift, the reset
   button, the backup manifest. Each under an hour.
6. Findings 11 and 12: the NUL bytes and the invisible setting. Minutes.
7. **Then rewrite the fixtures.** Every test fixture that builds a card
   should build it in the stored shape, and one test should take a card
   from save → server → student device → editor → save and assert nothing
   changed. That single test would have caught findings 1, 2, 4, 5 and 6.
8. **Then the structural move**, the one item here that is not a patch:
   take dealing, marking and the load-time lift out of the screen file into
   a module that takes its indexes as arguments, and give the grader a pure
   core that returns the states to write. It is the same move the scheduler
   made when it left the screen file, for the same reason — the part of the
   app that decides what you practise had no tests because it could not
   have any. Two or three days, leaves first, each step green.

---

## Technical appendix

For whoever picks the items up. Lines are as of commit 4fdc4f5.

**1.** `initialForms`, `src/card-editor.tsx:1200-1212`, reads `card.ar`,
`card.en`, `card.lat`, `card.clips`, `card.slowClips`, `card.ask`;
`seedCited` (3229-3239) likewise. `save-card` (`server/api/courses.js:792-
872`) stores no top-level word; `my-cards` (786) and `pullTeaching`
(`src/shared.tsx:2751`) pass the record raw; `setEditing({ card: c })`
(`src/spaces.tsx:4696, 4721`) hands it to the editor as is. Probe: the
bundled `initialForms({ forms: [{ ar: "كتاب", en: "book", ask: false,
clips: ["c1"] }] }, null)[0]` returns `{ ar: "", en: "", clips: [] }` with
no `ask`. Fixtures at `tests/cards.test.mjs:954-994` are all old-shape.
Fix: `const lead = leadOf(card)` and read the six fields off it.

**2.** `foldCourses`, `src/shared.tsx:3193`: `{ ...fresh, forms:
foldForms(...) }` — `lines` come from `fresh`, built by `cardToItem` with
`s: freshStates()` (2941-2953). Probe: a line with `reps: 5` folds to
`reps: 0`. Fix: fold `lines` by id the way `foldForms` folds forms (line
ids are positional, `-l{i}`, which is the same fallback).

**3.** `liftStates`, `src/ArabicTrainer.tsx:2814`, copies `V2_MAP` and
`TYPES` only. Keys `${type}@${n}` (`keyFor`, `src/languages.ts:509`) are
not copied. Reached from `liftItem` (2870) via `merge` (2949) on load
(2983), after every sync (4914) and on import (6669). Probe: `{ ar2en,
"ar2en@1" }` lifts to `{ ar2en }`. Fix: copy every key with
`TYPES.includes(typeOf(key))`.

**4.** `VerbTable.write`, `src/card-editor.tsx:723-731`: a new cell is `{
...blankForm(), row, col, of }` with no `id` (`blankForm`, line 64), and
the list is rewritten as `rest.concat([next])` on every edit. `formName` is
applied at 1215, 1778, 1788 only; `seedCited` (3229) mints none. The server
keeps an id only if sent (`courses.js:846`). `cardToItem` names an id-less
form `-f{i}` (`shared.tsx:2873, 2934`) and `foldForms` (3165-3179) matches
those by position. Probe: a verb's cells arrive as `srvv1-f0, srvv1-f1`.
Fix: mint in `write` and `seedCited`; replace in place rather than append.

**5.** `foldForms`, `src/shared.tsx:3177`: `{ ...f, s: mate.s }` carries
`s` only; `met` (`types.ts:760`, written at `ArabicTrainer.tsx:6411`) is
dropped. Probe: `met: { "name:raphael": 3 }` folds to `undefined`. Fix:
carry `met` beside `s` (sync already merges it by max, `sync.ts:122`).

**6.** `courses.js:1000`: `saved = { ...existing, ...fields, ... }`;
`fields` never sets `ar/en/lat/clips/slowClips/answers/subs/ask/row/col`
to undefined. Fix: spread an explicit `RETIRED_CARD_FIELDS` of undefined
after `existing`.

**7.** `buildManualSession`, `ArabicTrainer.tsx:2240`: iterates
`unitsOf(it)` at 2291 with no `isAsked`/`isQuiet`; `supportedFor`/`usableFor`
(2272-2282) rebuild keys from `availableTypes(unit)` (default language) and
`openTypesOf`, not `laddered`. Compare `buildSession` (1879) and
`drillableUnits` (606). Fix: `drillableUnits(it, settings)` and
`availableTypes(unit, langOf(settingsFor(settings, unit)))`.

**8.** `liftCurrent` (6210): `keys = laddered(item, settings)` where `item`
is the cast unit (5741-5750; `castAnswer` → `withAnswer`, `answers.ts:246`,
sets `answers: [answer]`, so `keysFor` returns bare keys). `liftLevel`
(`scheduler.ts:363`) then lifts bare keys while `exercise.type` may be
`ar2en@1`. Fix: compute `keys` from `target` inside the `persist` callback.

**9.** `resetScheduling` (5705-5712) writes `s` and `subs`; `forms[].s`
untouched; `liftItem` (2892-2901) strips both on the next load.

**10.** Backup manifest, `courses.js:1631-1641`: `formsOf(c)` only;
`lines[].clips`/`slowClips` (stored at 913-914) are not collected. Same
omission in `admin-clear` (1785-1794).

**11.** Raw `\x00` at `src/ArabicTrainer.tsx` bytes 22757 (`valueKey`, line
679) and 60362 (`withoutListening`, 1493); `src/card-editor.tsx` bytes
7871, 7946, 8226 (`ScriptAnswers`, lines 190-200). Git's binary heuristic
reads the first 8 KB, which is why only the editor is flagged. Line 2627
of the trainer shows the right spelling (`" "`).

**12.** `settings.kinds` read at `ArabicTrainer.tsx:1681` and 2263,
defaulted at 303, merged at 2963; no writer in `src/`; not in
`RETIRED_SETTINGS` (2936).

**13.** `categoryOffer` (`card-editor.tsx:1532`) is empty whenever
`storedFormsOf` (1288) is true; `initialCategory` (1267-1271) takes the
first category declaring the table; `noun` and `preposition` both declare
`attached` (`languages.ts:1290, 1312`).

**14.** `phaseCounts(…, (u) => openTypes(u, settings))` at 1924; `openTypes`
(1634) applies `typeAllowedNow`; `cardStandings` (241) reads `laddered`.

**15.** `availableTypes(unit)` with the default `activeLang()` at 235,
1809, 1818, 2183, 2216, 2273; `enabledTypes` (1558) is the sibling that
passes the card's language.

**16.** `tests/smoke.mjs`: no override of `Date.now`/`Math.random`;
`REAL_CLOCK` (`scheduler.ts:75`) is the one injection point.

**17.** `courses.js:838` (65 forms), 870-871 and 913-914 (12 clips), 896 (4
speakers), 908 (12 lines), 883 and 918 (24 uses), 798/806/847-849 (text).

**18.** `tableCellsOf`, `card-editor.tsx:1336-1339`; `asideOf` (1301-1313)
counts other-table cells only.

Unexported, and therefore untestable as units: `buildSession`, `withGrids`,
`withReadThroughs`, `pickableTypes`, `laddered`, `openTypes`,
`askableTypes`, `fillableAt`, `liftItem`, `liftStates`, `liftAnswers`,
`merge`, `RETIRED_SETTINGS`; `applyGrade` (6250) is a closure over ten
pieces of component state. Reached by tests via an esbuild bundle:
`drillableUnits`, `onePerLevel`, `easedUnits`, `quietUnits`, `agreeTook`,
`withoutListening`, `formIsAmbiguous`, `deckPercent`, `leadSpeed`, and
since 0.144 `varyTypes`, `requeueMissed` and `isUrgent`
(`tests/session.test.mjs`).

Test counts at 4fdc4f5: 479 `node --test` cases across twenty files
(scheduler 59, cards 58, languages 65, layers 47, verbs 38, server 35);
478 smoke checks, and a FAIL line does fail `npm test` (`smoke.mjs:4731`).
0.144 adds fourteen session cases and four card cases.
