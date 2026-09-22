# Audit: do the tests test the right things, and would they notice?

**22 September 2026 · release 0.212, commit 1296f5a · re-checked against 0.213 (64b000e), which landed on `beta` during the audit: the full check is green there too (950 unit tests, 703 walk checks), and nothing below changes.**

The earlier audits asked whether the app loses work, holds up offline, and
keeps cards and progress straight. This one asks about the tests themselves:
is every part of the app that matters checked by something, and when a check
exists, would it actually go red if the thing it is about broke?

Two ways of answering, and both were run rather than read. First, *reach*:
which code any test runs at all, measured line by line for the rule modules
and function by function for the screens. Second, *bite*: about five hundred
deliberate breakages, one at a time — a `<` made a `<=`, an `and` made an
`or`, a ten made an eleven — each followed by a run of the tests that are
supposed to guard that code, to see how many went red. Every breakage the
tests missed was then looked at to decide whether it was a real gap or a
change that made no difference, and the ones that looked real were run
again against every test there is.

The whole check suite is green on this tree, three times over, and the smoke
walk is green under three other seeds. Everything below is about what the
green does and does not mean.

## The short version

**Where the app's rules live, the tests are real and they bite.** The ladder,
what makes a card cleared and learnt, what being due does and does not do,
the two caps on new words, the typo rule, the letter-by-letter marking,
blanks and the words that fill them, verb tables, the numbers and the clock —
every rule the README states has a test that names it, the modules that hold
them are covered to within a few lines of complete, and when they were
broken on purpose the tests caught about four breakages in five, with most
of the rest being changes nobody could tell from outside. Over the whole
app the figure is seven in ten, and the difference is the same story as the
rest of this note: in the sync code and the server the tests catch about
half. The tests are
written against the real thing: the server over a real socket, the session
builder from the real bundle, the whole app rendered and clicked through.
Nothing is skipped, nothing is marked "to do", and only one test in nine
hundred and forty-five makes no assertion, and that one is right not to.

**The gaps are at the edges — where the app talks to the outside world, and
on screens nobody walks.** In order of what they could cost:

1. **The device's side of sync has no test.** Merging two documents is
   tested twenty-seven ways. The round trip that uses it — fetch the shared
   copy, merge, send it back, and try once more when another device got
   there first — is not run by any test, and neither is what the device does
   when the server refuses: a document that would be emptied, one that is
   too big, a passphrase that is wrong. This is exactly the corner where the
   worst bug in the app's history lived (the September audit's finding 1),
   and the fix for it was tested on the server and not on the phone.
2. **Ten of the server's forty-six actions have no test.** Among them: a
   teacher deleting a deck, a teacher detaching a deck from a course, a
   recording being uploaded, and five things an administrator can do —
   delete a person, delete a course, reissue somebody's key, replace a
   course code, change a course's language. Every one of these is called by
   the app. The two deck actions are the ones the durability audit found
   were destroying progress.
3. **The number and time questions are never asked in a test.** The words
   the app builds are checked against tables a speaker signed off, and that
   part is thorough. But no test ever deals a number or a time question into
   a session, marks one, or walks one on screen. It is the newest part of
   the app and the part with the least behind it.
4. **Whole screens no test has ever rendered.** Signing up and signing in
   (the walk starts already signed in), Settings and closing an account, the
   whole admin space, backups on the device, joining a course with a code,
   the "put a scene in order" exercise, the clock face and dial, recording
   and compressing audio, and pasting a table of cards in. The card editor,
   by contrast, is walked almost completely — ninety-nine of its hundred and
   two functions run — and the note at the top of the walk saying the
   teaching space is *not* walked is simply out of date.
5. **The one check that an answer was saved would pass if nothing was.** The
   walk answers a question, waits for the save, and checks that *at most one*
   new schedule appeared. Zero passes. The decision log already calls this
   "loose"; it is the only place the wiring from screen to marking to disk
   is checked at all.
6. **Two pieces of the server can never run, and say the wrong thing.**
   Closing an account and an admin deleting a person each have a second
   copy of their code further down that nothing can reach — older versions
   left behind when the shared one was written. Anyone reading the file
   finds the wrong behaviour first. Not a test gap, but the coverage is what
   found it, and it is a five-minute fix.

Smaller things, worth knowing rather than urgent: the server's answers to a
request that is too large, a wrong method, or its own crash are untested;
the update-and-reload flow is checked by reading the source for the right
words, because the test browser has no service worker — by design, and said
so; a few numbers the app's behaviour hangs on (the two caps on new words,
the three lines a scene needs to be put in order, the fifty-item outbox, the
four-megabyte document limit) are read by the tests rather than stated by
them, so changing one would change nothing red; and the "automatic
difficulty" score is exported, tested, and read by nothing — it is dead, and
its tests are testing a thing the app no longer does.

## What is good, and worth keeping

- **Tests are named for behaviour, and read as claims about the app.** *A
  card written before the change reads as one answer per set of values.*
  *Practising all day never stops a learner meeting new words.* A failure
  names what stopped being true.
- **They test the real thing.** The server tests open a socket and speak
  JSON. The session tests build the trainer with the same bundler the app
  ships with. The smoke walk mounts the whole app and presses its buttons.
  The numbers are checked against golden tables, and a test fails if any
  file that composes them contains a word of any language.
- **Assertions are specific.** Two thousand `equal`s and seven hundred
  `deepEqual`s against four hundred bare `ok`s; six of those `ok`s are on
  things that are always true, and they are harmless.
- **Randomness is under control.** The walk rolls a seeded die and says why.
  The pace simulation runs a learner through ninety days with a fixed clock
  and asserts real bounds, not just that it ran.
- **Structure is tested too.** That no language leaks into a composer, that
  every component the library exports is used and catalogued, that the
  chrome sits above every screen — each a test that reads the source and
  fails when the rule is broken.
- **Nothing is quietly off.** No `skip`, no `todo`, no test that only prints.
  The two tests that read types (`@ts-expect-error`) are run by the type
  checker, so a thing that should be refused stays refused.

## What a fix round would cost

Roughly two days, in four pieces that can land separately:

1. **The device's sync round trip**, against a fake server that says no in
   each of the ways the real one can: a conflict retried once and then given
   up, *would-empty*, *too-large*, a bad passphrase, and the "lost" flag
   when the server recovered an unreadable copy. Half a day. This is the one
   to do first.
2. **The ten server actions**, plus removing the two dead blocks and a test
   that a request past the size limit is refused rather than dropped. Half a
   day.
3. **Number and time questions, asked.** A session dealt from a number
   system, a number and a time marked right and wrong, and one number
   question walked on screen. Half a day.
4. **The walk, tightened and widened.** The save check made to require that
   the answered schedule moved; onboarding, Settings, joining a course and
   one scene-ordering question walked; the stale note at the top corrected.
   Half a day.

Pinning the handful of numbers (item 7 in the technical notes) is an hour
and can ride with any of them.

---

## Technical notes

*For whoever does the work. Everything above was measured on commit 1296f5a
with the dependencies installed from `package-lock.json`; the scripts that
did the measuring were throwaway and are not in the tree.*

### 1. What runs, and how long it takes

`npm run check` — lint, `tsc --noEmit`, 945 unit tests in 38 files
(`node --test`), the smoke walk (698 checks in jsdom, seeded), and the Vite
build — takes 2 m 51 s here and about 3 minutes in CI (950 tests and 703
checks on 0.213, 2 m 58 s). CI (`ci.yml`) runs the
same five steps on every push and pull request; the last eight runs on `beta`
are green. The unit suite was run three times and the smoke walk under
`SMOKE_SEED` 1, 42 and 20260922 in addition to the default: no failure and no
variation.

### 2. Line coverage of the modules the unit tests import directly

`node --experimental-test-coverage`, includes `src/**`, `server/**`,
`scripts/**`. Overall **95.1 % of lines, 84.2 % of branches**.

| module | lines | what is not covered |
|---|---|---|
| `scheduler.ts` | 99.9 % | two lines |
| `grade.ts`, `spelling.ts`, `verbs.ts`, `cards.ts`, `chance.ts`, `answers.ts`, `offers.ts`, `context-links.ts`, `flag-export.ts`, `text-styles.ts`, `screen-elements.ts` | 100 % | — |
| `variables.ts` | 99.6 % | — |
| `dialogs.ts` | 99.5 % | — |
| `numbers/*` | 94–100 % | `build.ts` 94 % |
| `languages.ts` | 96.3 % | a scatter of per-language branches |
| `sync.ts` | **75.6 %** | `syncOnce`, `pull`, `push`, the config load/save, and most of the clip transport (`pushClip`, the worker pool) |
| `outbox.ts` | 98.9 % | — |
| `courses-api.ts` | 90.9 % lines, **5.8 % of functions** | only `whoAmI` and `explain` are called; the other 49 wrappers are pass-throughs |
| `server/api/courses.js` | 90.1 % | see §4 |
| `server/api/sync.js` | **76.2 %** | the three `?audio=` clip routes, `DELETE`, and the storage-error path |
| `server/store.js` | 97.3 % | — |
| `server/index.js` | 84.0 % | `readBody`'s too-large branch (413), the 405, the catch-all 500, the startup warning |

`server/index.js` reports 44 % if measured naively, because
`tests/server.test.mjs:220` imports it a second time as
`../server/index.js?version-test` and the reporter keeps the second, mostly
idle instance. Skip that one test (`--test-skip-pattern "deployed version"`)
to see the real figure.

### 3. Function reach in the screen files

The `.tsx` files cannot be measured by line: they reach the tests only
through esbuild bundles, and both Node's reporter and `c8` mis-map the
source maps (`c8 --exclude-after-remap` reports every `.tsx` at 100 %,
which is false). So this is measured by function name from raw V8 coverage
(`NODE_V8_COVERAGE`) of the bundles: a function counts as reached if it was
entered at least once under the six bundling unit tests or the smoke walk.

| file | reached | never reached (selection) |
|---|---|---|
| `ArabicTrainer.tsx` | 163 / 221 | `SceneOrder`, `SettingsScreen`, `AccountSettings`, `AppPreferences`, `CloseAccount`, `AccountPanel`, `Guide`, `ItemSheet`, `ReviewItem`, `BulkAddSheet` and its markdown parser (`parseLines`, `readHeader`, `mdCells`, `stripMd`), all clip handling (`saveClip`, `saveClipBlob`, `migrateClips`, `compressAudio`, `startRecorder`, `canRecord`, `dropClip`, `clipStats`), the zip reader/writer (`makeZip`, `readZip`, `crc32`), `ClipPlayer`, `RecordingsField`, `ArabicField`, `replyPool`, `hasRecentMistake`, `familyCounts`, `nextDueLine` |
| `card-editor.tsx` | 99 / 102 | `caretAt`, `hashOf`, `blobToDataUrl` |
| `spaces.tsx` | **8 / 32** | `Onboarding`, `AdminSpace`, `ClaimAdmin`, `BackupScreen`, `buildBackup`, `restoreBackup`, `verifyBackup`, `ClearScreen`, `DeckPicker`, `DeckEditor`, `StudentCourses`, `CourseSettings`, `RosterRow`, `Modal`, `CodeBox`, `SelectionBar` |
| `shared.tsx` | 91 / 99 | `askConfirm`, `modalIsOpen`, `useClipPlayer`, `confirmStrength`, `pullAdmin`, `dateTime` |
| `gallery.tsx` | 9 / 10 | `ScreenElements` |
| `number-system-editor.tsx` | 11 / 17 | `TimesTab`, `PeriodsSection`, the four `with*` writers for the clock's words |
| `clock.tsx` | 1 / 5 | `ClockFace`, `ClockDial`, `hourAngle`, `minuteAngle` |
| `updates.ts` | 2 / 9 | `watchForUpdates`, `applyUpdate`, `checkForUpdate`, `reloadOnce` — jsdom has no service worker; the walk greps the source instead (`tests/smoke.mjs:1504`) |
| `net.ts`, `context-index.ts` | all | — |
| `storage.ts` | 0 / 1 | `requestPersistence` |

Of the 25 exercise types, these are never dealt into a session by any test
and never walked: `num2fig`, `fig2pick`, `rec2fig`, `fig2num`,
`count2phrase`, `time2fig`, `time2dial`, `rec2dial`, `fig2time`,
`clock2time` (each appears in the tests only in the list that says it
exists). `dlgwhole` and `dlgorder` are dealt in `tests/dialogs.test.mjs` but
never through `buildSession` and never in the walk. Marking for the number
types is shared with `ar2en`/`en2ar` (`languages.ts:83–91`), so what is
untested is the dealing and the screens, not the verdict.

### 4. Server actions with no test

Of the 46 `action=` values in `server/api/courses.js`, these are never
requested by `tests/server.test.mjs` (and the smoke walk's fake server never
sees them either): `delete-deck`, `detach-deck`, `put-clip`, `course-decks`,
`deck-cards`, `admin-delete-user`, `admin-delete-course`,
`admin-reissue-key`, `admin-new-code`, `admin-course-language`. All ten
have a wrapper in `src/courses-api.ts`. Also untested on the sync endpoint:
`GET/POST/DELETE ?audio=`, `DELETE` of the document, and the
`storage-unconfigured` error path.

Two unreachable blocks, both the older inline version of an action that was
later moved into a shared function: `courses.js:774–815` (`delete-account`,
shadowed by line 676 which calls `wipeAccount`) and `courses.js:2800–2821`
(`admin-delete-user`, shadowed by line 2790). Lines 1080–1104 and
1562–1573 are also never reached and are worth a look for the same reason.

### 5. Mutation results

One breakage at a time, each run against the test file(s) that own the
module; every survivor was read. Operators: `<`↔`<=`, `>`↔`>=`, `===`↔`!==`,
`&&`↔`||`, `if (!x)`→`if (x)`, `return true`↔`return false`, `n`→`n+1` on
numeric literals, `+ 1`↔`- 1`. Sites were sampled evenly across the file,
comments and strings excluded.

| module | tests | killed | notes on the survivors |
|---|---|---|---|
| `scheduler.ts` (lines 1–600, against six files incl. session and pace; cut short after about 35 of 60) | ≈35 | ≈28 | all seven survivors are `n`→`n+1` on floors and defaults: `FRONT_DOOR_CAP`, the one-day floor on a relearned interval, the no-date fallback, `MIN` |
| `scheduler.ts` (lines 600–1302) | 48 | 32 | `difficultyScore`'s weights and its 22-point threshold; the `reviewLine` thresholds (`60`, `24`, `365`); the noon trick in `dayKey`/last-N-days; `topLevelOf`'s initial value (equivalent) |
| `grade.ts` | 37 | 32 | `skips`/`near` accumulation (`\|\| 0`→`&& 0`), the `subId` match in `withMark` and `isLine`, `fillerMarks` with one key |
| `sync.ts` | 40 | 21 | the round trip (`allowEmpty`, `would-empty`, `changed`), clip transport, `MAX_DOC_BYTES`, several `\|\| {}` defaults (equivalent), and three `>=`/`>` boundaries on timestamps |
| `spelling.ts` | 29 | 23 | four inside the edit-distance table's initialisation (equivalent), the `typoed` guard, `allWrong` |
| `chance.ts` | 24 | 17 | the hash seed (equivalent), `PICK_OPTIONS`, the duplicate-option guard and `wanted - 1` |
| `verbs.ts` | 24 | 23 | one |
| `variables.ts` | 29 | 24 | `isLent` with no form, a value's id when dropped into a blank |
| `dialogs.ts` | 20 | 14 | `MIN_ORDER_LINES` 3→4 and its `>=`; speaker ordering |
| `answers.ts` | 19 | 18 | one |
| `outbox.ts` | 18 | 13 | `OUTBOX_CAP`, the day cutoff boundary, the shape check on load |
| `numbers/range.ts` | 20 | **10** | the confusable-minute marks, the sampling steps, and `return true` for an impossible time |
| `numbers/compose.ts` | 20 | 15 | `% 24` on "to the next hour" past 23:00 — the golden tables have no such case |
| `numbers/generate.ts` | 19 | 13 | fallbacks (`\|\|` on audio, `en`, `source`) |
| `server/store.js` | 18 | 12 | `ENOENT` guards (equivalent), the write-chain cleanup, the ETag's length |
| `ArabicTrainer.tsx` (session builder, 2097–3900, against session.test) | 40 | 20 | `isUrgent` counted as waiting; new cards behind urgent ones; `hasRecentMistake`'s fallback; the cut reaching the last asked-for card; the number pick's `PICK_OPTIONS - 1`; `LEARNED_PING_MS`; the similarity key |
| `server/api/courses.js` | 40 | **20** | `wipeAccount` leaving the person on course rosters (`:588`) and its return value (`:597`); `delete-deck` leaving the deck on its courses (`:1776`); the `attach-deck` permission check inverted (`:1795` — the teachers in the tests are admins, so nobody is ever refused); `put-clip`'s size guard; several `\|\| 0` / `\|\| []` defaults and slice limits (equivalent) |
| `server/api/sync.js` | 19 | **8** | the three clip routes (untested), `MAX_BYTES` 4→5 MiB, the 413 boundary, status codes on the untested routes |

Survivors that looked like real gaps were re-run against the **whole** unit
suite (and, for the session builder, the smoke walk as well), since a
module's own test file is not the only thing that guards it. The result of
that pass is in §6.

### 6. Survivors confirmed against everything

Twenty-six survivors that read as real were re-run against every unit test
(`version.test.mjs` aside, which needs a `.git`), and the five in the session
builder against the smoke walk as well. Three were caught by a test in
another file, which is the suite working as it should: `isAsked` inverted
(caught by the read-out, the ladder and the session tests), `wanted - 1`
in pick options (caught by *the replies offered include the right one and
never a copy of it*), and `MIN_ORDER_LINES` (caught by *a conversation is
offered what a conversation can be asked*). **Twenty-three survived
everything.** Grouped by what they mean:

*Real gaps, worth a test each — an hour or two in all, and most belong in
the fix round above:*

- `grade.ts:306, :311` — `skips` and `near` reset to 1 instead of
  accumulating. Nothing skips a question twice, or misses narrowly twice.
- `grade.ts:350, :393` — a mark on a conversation turn matched by the
  *wrong* line id goes unnoticed: no test marks a turn and checks which
  line's schedule moved.
- `grade.ts:442` — `fillerMarks` with exactly one filled word credits
  nothing.
- `chance.ts:77` — a pick question may offer the same meaning twice. The
  grid has this test (`matchSet`); the choices do not.
- `sync.ts:139` — a scene's turns merged under the wrong guard.
  `sync.ts:231` — when both devices parked the same card, the older copy
  can win.
- `spelling.ts:156` — `typoed` runs on an empty answer or with no letter
  fold. `spelling.ts:312` — *nothing marked when not one letter belongs*
  is not pinned when nothing was typed at all.
- `numbers/range.ts:421` — an impossible time (25:70) is offered.
  `numbers/compose.ts:220` — "to the next hour" past 23:00 wraps to hour
  24 rather than 0; the golden tables stop short of it.
- `ArabicTrainer.tsx:3147` — a card the learner marked is not counted as
  waiting. `:3169` — the session is cut before the last marked card, which
  is the promise the README makes in *A learner can ask for a card*.
  `:3012` — new cards no longer go behind the asked-for ones. `:2713` —
  `hasRecentMistake` answers yes for a card with history and no recent
  miss. `:2818` — a number question that cannot find three wrong options
  is still asked as a pick. The walk has a section on asked-for cards
  (`tests/smoke.mjs:3393`) and did not notice any of these.
- `scheduler.ts:288` — a relearned card's interval floor moved from one
  day to two.

*Numbers nobody states (see §7):* `scheduler.ts:89` — `FRONT_DOOR_CAP`.

*Boundaries that only matter on equal timestamps, harmless in practice:*
`sync.ts:85`.

*Dead code, so survival was expected:* `scheduler.ts:883, :895` —
`difficultyScore` and `difficulty` are exported and nothing in `src/` or
`server/` calls them; "easiest first" is ordered another way. Delete them
rather than test them.

### 7. Numbers the tests read rather than state

`FRONT_DOOR_CAP` (10), `IN_HAND_CAP` (60), `MIN_ORDER_LINES` (3),
`OUTBOX_CAP` (50), `MAX_DOC_BYTES` (4 MiB), `PICK_OPTIONS` (4),
`LEARNED_PING_MS`. Each is imported by the test that is about it, so the
assertion moves with the constant. The pace test is the README's stated way
of judging the two caps, and it would still report a change — but nothing
goes red. A one-line test per constant, saying the number and pointing at
the README, makes changing one a decision rather than a drift.

### 8. The save check in the walk

`tests/smoke.mjs:2149` — `storedStates.length - beforeStates <= 1`. Replace
with: find the exercise key that was dealt (the instruction on screen says
which), and assert that key's `updated` stamp on the answered form is later
than it was before the session. That is the "wiring" the decision log
*Marking an answer comes out of the screen* says only the walk can check.

### 9. Things that are fine and were checked anyway

- Test files are linted (`eslint.config.js:114`) and type-checked
  (`tsconfig.json` includes `tests`); the build directories they write are
  excluded from both.
- Time is injected everywhere it matters (`clock` on the scheduler and
  grader; `Date.now()` in fixtures is relative). `Math.random` is seeded in
  the walk and the pace test; the session tests use the real one, and three
  runs did not vary.
- `tests/helpers.mjs`'s `must` is used 54 times in the walk and throughout
  the suite, so a missing element fails where it is looked for.
