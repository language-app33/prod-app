# Round-two fixes — what changed and what to know before deploying

Every item from the round-two audit is in, plus three things the new tests
turned up along the way. Verified with `npm run build` (clean),
`npm test` (11 unit tests, no dependencies beyond Node 22) and
`npm run test:smoke` (the real app rendered in jsdom against a stubbed
server: 21 checks across launch, sync, refresh and one answered exercise).

## Read this first — behaviour changes on upgrade

- **Sync is now keyed to the sign-in key.** Each device's first sync after
  this build pushes its full local copy under the shared token, then
  deletes the private document its old random key named. Nothing is lost;
  two devices signed in as one person will meet for the first time on
  their next sync and merge card by card.
- **Course material reads are eventually consistent** (`my-material`,
  `clip`). A student may see a teacher's change up to a minute late.
  Teacher and admin paths stay strongly consistent so what you just saved
  is what you see.
- **`SIGNUP_CODE`** — optional site environment variable. When set, making
  an account requires the code; the app only shows the field after the
  server asks for it. Existing accounts are unaffected.
- **Older backups never contained recordings** (clip values were being
  parsed as JSON). Backups made from this build do. The new Restore action
  is additive: it writes the file's records over same-named ones and folds
  indexes together; it never deletes.
- The teacher's card editor no longer refetches after every save; the
  45-second background check still runs, so lists cannot drift for long.

## Stability

| | Fix | Where |
|---|---|---|
| R1 | Sync token derived from the sign-in key; local `makeAccount` removed; `account` stripped from stored/imported documents; legacy remote document retired after the first successful sync | `ArabicTrainer.jsx` |
| R2 | Clip sync reads a data URL (`clipDataUrl`) and checks existence locally (`hasClipLocal`); `syncClips` refuses to upload anything that isn't `data:` | `ArabicTrainer.jsx`, `sync.js` |
| R3 | Merged documents pass through `merge()` (lifting) before adoption; `stateReady`/`applyGrade` tolerate a missing state | `ArabicTrainer.jsx` |
| R4 | Untouched exercise states are omitted on the wire and in storage (`compactItem`); measured 4,161 → ~1,080 bytes per 3-form card | `sync.js`, `ArabicTrainer.jsx` |
| R5 | Stale lazy chunk → one guarded reload; error boundary with Reload / Download-my-data | `ArabicTrainer.jsx`, `main.jsx` |
| R6 | IndexedDB open timeout raised to 8 s and no longer cached as "no IDB" | `ArabicTrainer.jsx` |
| R7 | JSON/zip import merges via `mergeData` behind a confirm; never imports `account` | `ArabicTrainer.jsx` |
| R8 | Server sync: no unconditional-write fallback; etag from `set()` (one fewer round trip) | `netlify/functions/sync.js` |
| R9 | Sub-form edits keep every declared grammar/lexical field (`dimValues`); `BLANK_SUB` likewise | `ArabicTrainer.jsx` |
| R10 | Answer input declared as the target language; home-screen copy no longer says "Arabic" | `ArabicTrainer.jsx` |
| R11 | `AudioPrompt` handles decode errors and resets on any recording change; language auto-switch stops once chosen by hand (`settings.languageChosen`); Escape handled only by the topmost `Screen`; `SIGNUP_CODE` gate with on-demand field in onboarding | `ArabicTrainer.jsx`, `shared.jsx`, `spaces.jsx`, `courses.js` |

## Performance

| | Fix | Where |
|---|---|---|
| P1 | Own-cards code behind a foldable `OWN` gate; entry points restored behind the same flag. Bundle 351 → 328 KB (108 → 101 KB gz). The audit's 25–30 KB gz estimate was too high — the dead JSX compressed well; the parse-time saving is the ~23 KB raw | `ArabicTrainer.jsx` |
| P2 | `my-material` action: courses + decks + cards in one answer with a version; `{ unchanged: true }` when nothing moved; the duplicate `my-courses` launch call is gone. Launch is now whoami + my-material + sync GET + sync POST | `courses.js`, `shared.jsx`, `ArabicTrainer.jsx` |
| P3 | `save-card` uses a reverse index (`card.inDecks`) and touches only the decks that gain/lose the card, bumping versions on content edits; `delete-cards` batch with grouped deck writes; the teacher's screens splice the server's answer into local state instead of refetching | `courses.js`, `spaces.jsx`, `courses-api.js` |
| P4 | Sync no longer creates object URLs or fetches recordings; players own and revoke their URLs; a session warms its own clips at start; "Download all recordings for offline" in Account settings | `ArabicTrainer.jsx`, `shared.jsx` |
| P5 | Eventual reads on student material and immutable clips; strong everywhere a write follows or a teacher just saved | `courses.js` |
| P6 | Keyboard hook re-renders only when open flips or height moves ≥ 20 px | `ArabicTrainer.jsx` |
| P7 | `ItemList` paged at 120 with "Show more"; stable match memo; progress computed once per card per change | `shared.jsx`, `ArabicTrainer.jsx` |
| P8 | Backup streams into a Blob chunk by chunk with the checks run in passing; Restore action and UI | `spaces.jsx`, `courses.js` |
| P9 | Minimal pairs computed once per answer; `clipStats` uses one `getAll` | `ArabicTrainer.jsx` |

## Found by the new tests and fixed too

- **Launch race** (round-one S2, sync half): the launch sync and the first
  course refresh finish in the same tick and each built on the state before
  the other's change — the smoke test lost the course card outright. Every
  writer now goes through `commit()`, which updates the ref synchronously,
  and grading/flagging use `persist(fn)` against the current document.
  Sync and course refresh both re-fold against the current state before
  adopting. The other ten `persist` callers still spread their render's
  `data`; they are user-paced and not in the race window, but converting
  them to the function form is the remaining round-one work.
- **`đ` was folded into `d`** in `normViet`, so typing `di` for `đi` was
  accepted — the language's own rules say it must not be. Removed.
- **Backups had no recordings** (see above).

## Tests

- `tests/sync.test.mjs` — fresh-state rule, compaction ratio, sparse merge,
  idempotence, clip-sync guards.
- `tests/languages.test.mjs` — grader behaviour that has been wrong before.
- `tests/smoke.mjs` — the full app in jsdom. Needs `jsdom` (added as a
  devDependency); builds to `tests/.smoke-build/` (git-ignored).
