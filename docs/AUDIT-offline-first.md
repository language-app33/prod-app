# Audit: does the app hold up offline?

**16 September 2026 · release 0.148, commit 1c24f45, the tree on `origin/beta`**

The app's stated objective is to be offline-first: a learner opens it on a
train, practises, and nothing about that depends on a connection. This
audit reads every path a connection touches — the shell the browser keeps,
the document on the device, the sync round trip, the course refresh, the
recordings, the teaching and admin spaces, the sign-in — and judges each
against that objective. The whole check suite is green on this tree: lint,
types, 594 unit tests, build. The build was run and the service worker it
emits was read, so what is said below about the precache is what is in
`dist/sw.js`, not what the config promises.

Nothing here is a bug in the sense the last audit's findings were. Progress
is kept, and the durability work in 0.148 is sound. What follows is the gap
between *the core loop works offline* — which is true — and *the app is
offline-first* — which is true at the centre and not at the edges.

## The short version

**The learner's loop is genuinely offline-first.** The shell is precached
whole, lazy chunks included, with the API kept out of the fallback. The
document lives on the device and every question, mark and schedule is
computed there. A device that has signed in once opens and works with no
connection: the sign-in check on launch fails quietly and the app carries
on. Sync is pull-merge-push, idempotent, re-run on `online`, flushed on
`pagehide`, reconciled across tabs, retried when the disk refuses. Recordings
are cached in IndexedDB the first time they play, a session's clips are
prefetched before it starts, and a whole course can be taken offline from
Account. Nothing external is loaded: no fonts, no CDN, sounds synthesised.
This is more than most apps that call themselves offline-first do.

**The edges are online-only, and the app does not say so.** Five things
stand out, in order of how many people they touch:

1. **The first screen needs the server.** Nobody gets past onboarding
   without a round trip, and the screen says the opposite — "everything
   stays on your device; an account only matters if you join a course or
   use more than one device". Offline, the error it shows is "Can't reach
   the server. Your own cards still work", on a screen with no cards.
2. **What surrounds the cards is forgotten on every launch.** The course
   list, the deck tiles and the teaching and admin spaces are held in
   memory only. The cards themselves are folded into the document and
   survive; the courses they came from do not. An offline launch shows a
   student an error where their courses were, and shows a teacher — who
   opens into Teaching by default — an empty space with an error. The
   material version is also per launch, so every launch's first check is a
   full pull rather than the cheap "unchanged" the server offers.
3. **The guide promises more than the app keeps.** "Anything you do while
   disconnected is kept and sent when a connection returns" is true of
   progress and settings and false of a reported problem, which is tried
   once and dropped; of every teacher action, which fails on the spot; and
   of joining a course.
4. **The app does not know it is offline.** There is no offline state:
   `navigator.onLine` is read only to word one error. The corner dot turns
   red for every failure, and the line beside it says "Offline — will
   retry" whether the cause was no network, a rejected passphrase or a
   document past the size limit. The reason is recorded and, by the code's
   own admission, read nowhere. Polls keep firing into the void every
   forty-five seconds and on every focus.
5. **A listening question is dealt whether or not its recording is here.**
   The prefetch before a session is best-effort and silent, so offline with
   an uncached clip the learner meets a question whose sound says "That
   clip isn't on this device yet" and has to skip it.

Underneath: the document sits in localStorage, whose ceiling is close to
the sync limit and shared with a list of uploaded clip ids that only ever
grows; Safari ignores the persistence request and evicts an uninstalled
site's storage after a week, and nothing nudges anyone to install; a
developer gallery chunk is precached onto every phone; and one line of the
smoke test is the whole of the offline test coverage.

## What is holding up

Read first, so the findings are in proportion.

- **The shell.** `dist/sw.js` precaches 13 entries, 648 KiB: the HTML, the
  three JS chunks including the lazily loaded spaces, the CSS, the icons and
  the manifest. Navigation falls back to `index.html` with `/api/` denied,
  so an offline route load gets the app and an offline sync gets a network
  error rather than a page. `skipWaiting`, `clientsClaim` and
  `cleanupOutdatedCaches` are on. The server sends `sw.js` and the manifest
  as `no-cache` and fingerprinted assets as immutable. A lazy chunk that has
  gone after a deploy is recovered by one reload, once.
- **The document.** Whole, on the device, loaded at launch, written sparse.
  A save is debounced and flushed on `pagehide`, on hide, and before any
  reload the app brings on; a failed save retries with backoff under a
  standing warning; another tab's write is merged in rather than fought.
  Durable storage is requested before first paint.
- **Practice.** Building a session, asking, marking, scheduling, crediting
  the words in a sentence: all pure, all local, the clock passed in. The
  learning ping and the flag report are fire-and-forget and cannot reach
  the session.
- **Sync.** One round trip with a 30 s deadline, one retry on conflict,
  idempotent merge per exercise, re-run once after the trip if anything was
  written during it, re-run on `online`. Refusals are named: passphrase,
  too large, would-empty. The server flushes, keeps one copy back, and
  will not accept a wipe. Course material is refreshed only against a
  successful read; a failure holds what the device has.
- **Recordings.** IndexedDB keyed by content hash, text-store fallback,
  fetched on first play and kept, prefetched for a session, and "not here"
  is told apart from "not reachable" so an offline miss is retried and a
  server miss is not. A Download-all button warms everything a learner's
  cards refer to.
- **Nothing external.** Icons are inline paths, sounds are synthesised, no
  font is fetched, and the code says why.
- **Updates.** Unreachable is not shown as out of date; the handover to a
  new worker waits for a session to end and writes what is owed first.

## Findings

Ranked by how many people meet them and what they cost. *Verified* means
the claim was checked against the built output or the running code, not
only the source.

### High

**1. The app cannot be started without the server.**
`ArabicTrainer` renders `Onboarding` whenever there is no account, and both
of its exits — Set up, which calls `signup`, and I already have a key, which
calls `whoami` — are requests. There is no third exit; `onDone` accepts an
undefined account but nothing calls it that way, and an undefined account
renders `Onboarding` again. The screen's own words say an account is
optional. Offline, it shows `explain("offline")`, which is worded for a
signed-in learner with cards. The README notes the same wall for developers:
`npm run dev` "cannot get past its first screen".
*What it means: a person installing the app somewhere without signal — the
situation the objective names — is stopped at the door, by a screen telling
them it should not have.*
*Fix, in two sizes. Small: make the copy true (an account is needed to
begin) and give the offline error on this screen its own wording. Medium:
a local-only start. Almost everything downstream already handles
`account === null` — sync is off, a flag is "noted on this device", the
courses tab invites a join — so the work is a way past the screen that sets
no account, and a Sign in that is reachable later from the account screen,
which already renders signed out. Half a day for the second, with the first
folded in.*

**2. Course material and the spaces are held in memory only.** *Verified.*
`myCourses`, `courseDecks` and `coursesKnown` start empty and are filled
only by `my-material`. The teaching and admin spaces remember their last
contents in a module-level object (`spaceHeld` in `shared.tsx`), which a
reload empties. `materialVersion` is a ref, per launch by design, so the
first check after every launch is the full document of every deck and card
rather than the `unchanged` answer the server keeps for exactly this. The
cards are fine — `foldCourses` writes them into the document — but
everything that frames them goes on each launch.
*What it means offline: the Courses tab shows "Can't reach the server" and
no courses; the deck tiles a learner practises from are absent; a teacher,
who opens into Teaching, sees an empty space and an error; and because the
failed refresh still sets `coursesKnown`, an enrolled student with no cards
yet is offered "Join a course". On a poor connection the full pull on every
launch is the largest request the app makes, with a 20 s deadline, when a
version check would have been a few bytes.*
*Fix: persist the last `my-material` answer (courses, decks, version) and
the last teaching and admin pulls, keyed by handle, beside the document;
render from them at launch and mark them "as of"; hand the persisted version
to the first check. `rememberSpace` is already the one door the spaces go
through, so the persistence goes behind it. A day, with a test that launches
against a stored document and a dead server and asserts the courses are
shown.*

**3. Teacher actions are online-only, without a draft or a queue.**
Every write in the teaching space — `saveCard`, `deleteCard`, `createDeck`,
`attachDeck`, `putClip` and the rest — is a direct request that throws on
failure, and the space shows `explain(e)`. A recording made in the editor is
uploaded rather than stored on the device, so a teacher who records offline
loses the take. Nothing is kept for later.
*What it means: the objective is stated for learners, and this is the
teacher's side, so it ranks below the two above — but a teacher on the same
train loses a card's worth of typing to a dropped connection, and the app
gives no warning before they start.*
*Fix, staged. Now: keep the editor's draft on the device until the save
succeeds, and say "offline" before the first keystroke rather than after
the last (the offline state from finding 4). Later: an outbox of teacher
mutations replayed on `online`, which needs client-minted card ids so a
replayed save is idempotent — the server mints them today. Half a day for
the first; the second is a design change and should wait until someone asks
for it.*

### Medium

**4. There is no offline state, and the one indicator misreports.** *Verified.*
`syncState` has an `off` value and the stylesheet styles it, but nothing
sets it. `navigator.onLine` is read once, to word one error. No `offline`
listener exists; the `online` listener only re-runs sync. In the corner
menu, `syncState === "error"` renders "Offline — will retry" for every
failure, including the two the code itself says never clear on their own
(`bad-passphrase`, `too-large`) and the one that means a bug
(`would-empty`). `setSyncError` records the reason and the comment beside it
says it is unread. Nothing shows how much is waiting to go up.
*Fix: listen for `offline` and `online`, set `off` on the first, and show
the recorded reason on the menu line — it is one state already computed
and one string already stored. Add "n changes waiting" from `unsaved` and
`lastSync`. Small, and the prerequisite for making findings 3, 5 and 6
honest.*

**5. A listening question can be dealt without its recording.**
`warmSession` prefetches a session's clips and swallows failure;
`buildSession` does not know which clips are local; the player answers
"That clip isn't on this device yet". The mechanism to keep listening
questions out of a session already exists — `listenOffUntil` and
`typeAllowedNow`, used for "can't listen right now" — but it is a clock, not
a fact about the device.
*Fix: before dealing, ask `hasClipLocal` for the session's clips (a key
lookup each, already used by clip sync), and offline treat a form whose
clip is absent as one whose listening exercises are not allowed now, the
same path the quiet window takes. On the home screen, "n recordings not
downloaded" beside the existing Download-all button, so the learner can
choose to fix it before the train. Small to medium.*

**6. The guide's promise is wider than the app.** *Verified.*
"Anything you do while disconnected is kept and sent when a connection
returns" holds for progress, settings, priority marks and resets. It does
not hold for a reported problem: `reportFlag` is tried once, and on failure
the app says "Noted on this device. We couldn't reach the server" — the
note is on the item's `flags`, which sync carries but the server never
reads as a report, so it is never sent. Nor for anything in finding 3, nor
for joining a course.
*Fix: a small outbox for flags — the report already carries a copy of the
question, so it is self-contained and safe to replay — drained on `online`
and after a successful sync; and reword the guide to say what is kept
(everything you learn) and what needs a connection (reporting, teaching,
joining). Small.*

**7. Polling continues while offline, on three timers.**
`useLiveRefresh` fires a refresh every 45 s and on every `focus` and
`visibilitychange`, for the learner's courses and again for whichever space
is open. Offline each is a failed fetch, an error set, and on the learner's
side `coursesKnown` set again. The sync path backs off on a failed save;
the refresh path has no backoff at all. Cheap per call, and a battery cost
over an afternoon.
*Fix: skip the poll when the offline state from finding 4 is set, and back
off after consecutive failures, with the `online` event as the way back.
Small.*

**8. The document's home has a low ceiling, shared with a list that never shrinks.**
The document is in localStorage, whose limit in the common browsers is
about five megabytes of UTF-16, while the sync limit it is warned against
is four mebibytes on the wire. The same origin's localStorage holds the sync
config, whose `uploaded` list gains one id per clip ever sent and is never
pruned, and — where IndexedDB is unavailable — every recording as base64.
`docSize` warns only against the server's limit.
*Fix: prune `uploaded` to ids the document still refers to, on each sync;
warn against the local ceiling as well as the remote one; and, when it is
worth it, move the document to IndexedDB, which is already open for clips,
with localStorage as the read-once migration path. Half a day for the first
two; the move is a day with the migration test.*

**9. Nothing asks to be installed, and on iOS that is the durability lever.**
`requestPersistence` is called and the code notes that Safari ignores it.
What the code does not say is that Safari evicts a site's storage —
localStorage and IndexedDB both — once seven days of Safari use pass
without a visit to the site, unless the app is on the home screen. A signed-in learner is rescued by sync; a
local-only learner (finding 1's second fix) would lose everything. No
`beforeinstallprompt` is handled and no hint is shown.
*Fix: one dismissible line on the home screen for a browser that is not
standalone, worded per platform, and `beforeinstallprompt` where it exists.
Small.*

### Low

**10. A developer reference ships in the precache.** *Verified.* The
gallery chunk — 60 KiB, 15 gzipped, "a reading tool, not a test" — is
precached onto every device because it is a lazy chunk like the spaces.
`globIgnores` for it, or a `manualChunks` name the glob can exclude.

**11. A captive portal reads as "Sync failed".** `pull` calls `res.json()`
on a 200 without checking that the body is JSON; the courses client checks
and says `bad-response`. Under a hotel wifi login page the sync dot turns
red with no reason, and finding 4's line would say "Sync failed". Guard
`pull` the way `call` is guarded and name it.

**12. Offline coverage is one check.** The smoke test stubs `/api/version`
to throw and asserts the version line is not marked stale. Nothing tests:
launching against a stored document with every request failing; a sync
failure leaving the document intact and a later `online` event syncing it;
a refresh failure folding nothing; the flag path offline; or the precache
list in `dist/sw.js` — that the spaces chunk is in it and `/api/` is
denied. The build test that would catch a regressed `navigateFallbackDenylist`
is a dozen lines.

## What to do, in order

1. **Know when you are offline, and say so** (findings 4 and 7): the
   state, the reason on the menu line, the count of what is waiting, and
   the polls paused. Everything else that follows is made honest by this.
2. **Persist what frames the cards** (finding 2): courses, decks and the
   spaces, with the version handed to the launch check. The likeliest
   thing a learner notices offline today, and the biggest request the app
   makes made cheap.
3. **A way past the first screen, and true words on it** (finding 1).
   The copy in the same commit either way; the local-only start is the
   product call.
4. **Sound that is here** (finding 5) and **a flag that is sent** (finding
   6), with the guide reworded.
5. **Drafts kept and an honest editor** (finding 3), then the outbox only if
   teachers ask.
6. **Storage hygiene** (finding 8) and **an install hint** (finding 9).
7. **Precache hygiene, a guarded pull, and the tests** (findings 10 to 12),
   each with the test the audit found missing.

---

## Technical appendix

Lines are as of commit 1c24f45.

**Shell.** `vite.config.js:76-82` — `globPatterns`, `cleanupOutdatedCaches`,
`navigateFallbackDenylist: [/^\/api\//]`. Built and read: `dist/sw.js`
precaches `registerSW.js`, `index.html`, `manifest.webmanifest`, three icons,
`assets/index-*.js`, `assets/spaces-*.js`, `assets/gallery-*.js`,
`assets/index-*.css`; `createHandlerBoundToURL("index.html")` with the
denylist; `skipWaiting()`, `clientsClaim()`, `cleanupOutdatedCaches()`
present. `server/index.js:78-82` cache headers. `ArabicTrainer.tsx:45-60`
chunk recovery.

**1.** `ArabicTrainer.tsx:7301-7309` renders `Onboarding` for `!account`;
`spaces.tsx:119-168` — `create()` → `API.signUp` (:136), `signIn()` →
`API.whoAmI` (:157); `onDone` signature `(account?: …)` (:119), never called
without one. Lede at :174-177. `courses-api.ts:250` the offline wording.
`README.md:238-241`.

**2.** `ArabicTrainer.tsx:5190-5198` state; `:5209-5211` `materialVersion`
"per device and per launch"; `:6057-6158` `refreshCourses`, `finally` sets
`coursesKnown` (:6156); `:7393` "Join a course" on `coursesKnown &&
myCourses.length === 0`. `shared.tsx:2700-2730` `spaceHeld`, `rememberSpace`,
`recallSpace` — a module object; `spaces.tsx:3919` teaching reads it,
`:1387-1398` admin refresh. `courses-api.ts:52-91` `CALL_TIMEOUT_MS` 20 s
and every fetch failure as `"offline"`.

**3.** `spaces.tsx:4464, 4587, 4679, 5171, 5322` saves and deletes;
`card-editor.tsx:464` `putClip`; `ArabicTrainer.tsx:3774-3777` "the teaching
space uploads rather than saving locally". `server/api/courses.js:1165`
mints the id.

**4.** `ArabicTrainer.tsx:5304` `syncState` comment lists `off`;
`index.css:1032` styles `.at-cdot.off`; no `setSyncState("off")` anywhere
(grep). `:5309-5312` `setSyncError` "unread on purpose"; `:5463-5470` the
five messages; `:11583-11588` the menu line. `:5541-5548` the `online`
listener; no `offline` listener (grep).

**5.** `ArabicTrainer.tsx:6225-6232` `warmSession`, `.catch(() => {})`;
`:8865-8869` "That clip isn't on this device yet"; `:1705-1707`
`typeAllowedNow`; `:3753-3762` `hasClipLocal`.

**6.** `ArabicTrainer.tsx:11027` the guide; `:6751-6778` `reportFlag`, one
`.catch` and a toast; `:6739-6749` the note written to `it.flags`.

**7.** `shared.tsx:2776-2792` `useLiveRefresh`: `setInterval(45000)`,
`focus`, `visibilitychange`; used at `ArabicTrainer.tsx:6219`,
`spaces.tsx:1427` and `:4015`.

**8.** `storage.ts:14-33` localStorage; `sync.ts:29-46` config with
`uploaded`; `ArabicTrainer.tsx:5389-5411` `uploaded` carried forward, never
pruned; `sync.ts:397-400` `docSize` against `MAX_DOC_BYTES` only;
`ArabicTrainer.tsx:3712-3720` base64 fallback into the text store.

**9.** `storage.ts:50-62` `requestPersistence`, "Safari currently ignores
it"; no `beforeinstallprompt` or `display-mode` read anywhere in `src/`
(grep).

**10.** `dist/assets/gallery-*.js` 60.19 kB in the precache list;
`spaces.tsx:38-44` the lazy import.

**11.** `sync.ts:277-282` `pull` → `res.json()` unguarded;
`courses-api.ts:99-109` the guarded reader.

**12.** `tests/smoke.mjs:1451-1465` the one offline check; no other test
names `offline`, `onLine` or `serviceWorker` (grep across `tests/`).
