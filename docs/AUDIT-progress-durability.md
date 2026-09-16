# Audit: is a student's progress ever lost?

**16 September 2026 · release 0.147, commit 9f31b64, the tree on `origin/beta`**

> **All fifteen findings were addressed in 0.148**, findings 1 to 11 by
> fixing them and 12 to 15 as described at the end of this note. This
> document is kept as it was written, because the reasoning is the record of
> why they were there; the release entry in `CHANGELOG.md` says what changed
> for the people using the app, and the `DECISIONS.md` entry *An absence is
> not an instruction* says what changed underneath and what was deliberately
> left alone. Each of the six missing tests the last step asks for exists
> now: a bad file on disk and a document the server cannot read
> (`tests/store.test.mjs`, `tests/server.test.mjs`), an empty refresh and a
> turn removed from a scene (`tests/cards.test.mjs`), and a reset and a mark
> through a merge (`tests/sync.test.mjs`).
>
> The four low findings, which were written down as worth knowing rather
> than as work: **12** (clock skew) stands as described and is inherent to
> the design; **13** is gone, because adopting a sync result now writes the
> adopted document to the device rather than leaving the disk behind; **14**
> is gone, because the legacy document is read and merged before it is
> deleted; **15** stands for two replicas, and the delete is inside the lock
> now, which was the part that was wrong for the one process that runs
> today.

The question this time is narrower and harder than the last audit's: from the
moment a learner presses Continue, is what they did recorded, and is it ever
lost afterwards? Every path progress travels was read — grading, the save to
the device, the sync to the server, the merge between two devices, the course
refresh, the reset button, the update reload — and every doubtful claim was
reproduced against the real code before it was written down here. Findings
marked *reproduced* were run, not read.

The whole check suite is green on this tree. None of the findings below is
covered by a test, which is how they are all still there.

## The short version

**Recording is now sound.** The marking path that 0.146 pulled out of the
screen files a mark against the right form, under the right key, for the
right card, and 0.147's crediting of the words in a sentence goes through
the same door. Nothing found here is in how an answer becomes a mark.

**Keeping it is not.** There are four ways a learner can lose real work, in
order of how much goes at once:

1. **The server can lock every device out of sync for good.** If the stored
   document is ever truncated or unreadable — a host dying mid-write is
   enough, because nothing is flushed to disk and no previous copy is kept —
   the server reports it as "never synced", every device's next push is
   refused as a conflict, and it stays refused for ever behind a bare "Sync
   failed". Nothing done after that moment ever leaves the phone.
   *Reproduced against a real server.*
2. **A course refresh that comes back incomplete deletes progress on every
   device.** Course material is re-fetched every forty-five seconds, and any
   card not in the answer is treated as withdrawn: deleted, and marked
   deleted so that sync removes it from the other devices too. A failed read
   on the server is answered as "nothing", not as an error. So one bad read
   of the course list, or a teacher detaching and re-attaching a deck, or a
   student briefly removed from a course, wipes their progress on every card
   in it, everywhere, and the cards come back new. *Reproduced.*
3. **"Reset scheduling" is undone by the next sync.** The reset writes
   blank schedules, blank schedules are not sent over the wire, and the
   server's copy still holds the old ones — so a few seconds after the
   message says everything was reset, everything is back where it was.
   *Reproduced.*
4. **Two tabs of the app overwrite each other's whole document.** Each tab
   holds the document in memory and saves all of it; whichever saves last
   wins, and the other tab's answers are gone from the device. A signed-in
   learner is usually rescued by sync; one without an account is not.

Underneath them a smaller set: the last answer before closing or
backgrounding the app can be lost because saving is delayed by six hundred
milliseconds with nothing flushing it, and a waiting update reloads the page
inside that window; a card marked *high priority* loses the mark when the
other device merely answers it; a conversation's turns have no names, so
removing one turn shifts every student's progress on the turns below it; and
a device that cannot save — storage full, private browsing — shows one toast
and then loses every further answer on reload while the screen goes on
showing them.

**The design fault common to most of it:** the app treats "not in the
answer" as "deleted", and treats a blank as "nothing to say", in places where
the honest reading is "I do not know yet". A refresh that lists fewer cards,
a document the server cannot read, a schedule with nothing in it — each is
taken as an instruction rather than as an absence.

## Findings

Ranked by what a learner loses and how ordinary the trigger is.

### High

**1. A corrupt or truncated server document locks every device out of sync, permanently.** *Reproduced.*
The server writes the document to a temporary file and renames it, which is
right for a process crash and not for a host crash: nothing is flushed to
disk, so a power loss or a killed container can leave the renamed file empty
or half-written, and no previous version is kept. When that happens the
server answers a read of the document with exactly what it answers when
nothing has ever been synced. The device then pushes as a first write, the
server refuses because a file exists, the device re-pulls, pushes again, is
refused again, and gives up with "Sync failed". Every device sharing the
passphrase hits the same wall, and the only delete the app ever issues is of
a legacy key, so there is no way out from the client. From that moment
nothing a learner does is backed up, and they are told only that sync
failed.
*Fix: flush before the rename and keep one previous copy; answer an
unreadable document as an error rather than as nothing, so the device can
say what happened; and let the device offer to overwrite a document the
server admits it cannot read. Half a day, with the test that writes a bad
file and asserts what the next two requests do.*

**2. A course refresh that lists fewer cards deletes progress on every device.** *Reproduced.*
`foldCourses` keeps the course cards that arrive and treats every other
course card the device holds as withdrawn: it is removed, and a deletion
marker is written so that the next sync removes it from the other devices
too. When the card comes back it arrives with a fresh schedule. That is a
defensible reading of a teacher deliberately withdrawing a card. It is the
wrong reading of every other way a card can be missing, and there are
several: on the server, a failed read of the course list, a deck or a card is
answered as an empty result rather than an error, so one bad read produces
a "complete" answer with the card missing; a teacher who detaches a deck to
reorganise it and attaches it again; a student removed from a course by
mistake and added back. In each of those the learner's work on every card in
question is destroyed on every device, silently, and it is not reversible.
*Fix, in two halves. On the server, a read that fails must fail the request
rather than answer "nothing". On the device, a withdrawn card's progress is
parked rather than destroyed — kept beside the document under the card's
id, restored the moment the card returns, pruned after the same window
deletions already age out of — and the deletion marker removes the card,
never the progress. A day, with a test that folds an empty answer and
asserts nothing is lost.*

**3. Reset scheduling is undone by the next sync, with or without a second device.** *Reproduced.*
The reset writes a blank schedule onto every form. A blank schedule is
exactly what the app makes for a missing one on load, so it is left off the
wire and off the disk to keep documents small — which means the reset device
sends nothing for those keys, the merge keeps whatever the other side has,
and the server's own copy alone is enough to put every card back where it
was within seconds of the message saying it was reset. The same mechanism
undoes the reset of what a sentence has been filled with.
*Fix: the reset stamps the card with when it was reset, the stamp travels
and merges by taking the later one, and the merge drops any schedule older
than it. Half a day. The alternative — sending the blank states stamped
"now" — is right and costs the document size the sparse wire exists to
save.*

**4. Two tabs or windows overwrite each other's whole document.**
The document is read from storage once, at launch, and written whole on
every save. Nothing listens for another tab's writes. Two tabs open: tab one
answers and saves; tab two, still holding the document as it was, answers
and saves over it; tab one answers again and saves over that. Storage holds
whichever tab saved last, and the other tab's answers are gone from the
device the moment it is closed. A signed-in learner is rescued only if both
tabs complete a sync before closing — the merge is per answer, so it takes
the union — and a learner without an account is not rescued at all.
*Fix: listen for the storage event and merge the stored document back in;
the merge already exists and is idempotent. Half a day.*

### Medium

**5. The last answer before closing or backgrounding the app can be lost, and an update can reload the page inside the window.**
A save is delayed six hundred milliseconds after each change so that a run
of changes writes once. Nothing flushes it on closing the tab, killing the
app, or putting it in the background. A waiting update reloads the page as
soon as no session is running, and ending a session, resetting scheduling or
switching tab releases that hold in the same tick as the change is made —
so the reload can run before the save, and the change is gone. The comment
in the update code saying everything is written to the device as it
happens is not true.
*Fix: flush the pending save on page hide and before any reload the app
itself triggers. Small.*

**6. A high-priority mark is lost when the other device merely answers the card.** *Reproduced.*
The merge takes the whole card from whichever device touched it last and
merges only the schedules underneath. Every graded answer stamps the card,
so a mark set on one device is dropped the next time the other device
answers a question about the card — including its standing in a sentence
as a filler, since 0.147.
*Fix: the mark carries the time it was set or cleared, and the merge takes
the later. Small.*

**7. A conversation's turns have no name anywhere, so removing a turn shifts every student's progress below it.**
The server stores a turn's words and recordings and no id; the editor mints
none; the device names turns by their position; the fold matches them by
position. It is the fault 0.131 fixed for forms and 0.145 for table cells,
on the one kind of form left out. Removing a middle turn — which the editor
allows — hands each remaining turn the schedule of the one above it, on
every device.
*Fix: the same one, a third time — name them on the way in, store the name,
fold by it. Small.*

**8. A device that cannot save shows one toast and then loses everything on reload.**
When storage is full or blocked, the save returns false, one message says
the last answer may not stick, and nothing is retried. Every later answer
fails the same way with no further message, while the screen shows the
progress. Sync still reads memory, so a signed-in learner's answers reach the
server until the page is reloaded; a learner without an account loses them
all.
*Fix: retry with a visible, persistent warning, and prompt a signed-in
learner to sync now. Small.*

**9. A document over four megabytes can never sync again, and is not told why.**
The server refuses a document over the limit with a bare "too large", which
the device shows as "Sync failed". Nothing prunes the document and nothing
warns as it grows, so once crossed the failure is permanent: everything
after it stays on one device. The limit is measured in characters rather
than bytes, and the transport layer's own larger limit most likely never
delivers its answer at all because it destroys the connection first.
*Fix: measure in bytes, warn from three megabytes, explain the refusal, and
look at what grows — the answer histories are already capped. Half a day.*

**10. The server accepts an empty document as readily as a full one, and keeps no previous copy.**
Any well-formed object with a valid version tag overwrites the only copy.
A client-side fault, or an over-eager merge, is one request away from
irrecoverable loss. *Reproduced.*
*Fix: keep one previous copy (finding 1's fix), and refuse a write that
drops the card count to nothing when the stored copy had many, unless the
device says it means it. Small once the previous copy exists.*

**11. Answers given while a sync is in flight wait for the next change.**
Sync runs at launch, four seconds after a change, and when the network comes
back. A sync started while one is running simply returns, and adopting the
result clears the timer that would have re-run it — so an answer given
during the round trip is on the device but not on the server until the next
answer or the next launch. A window of exposure rather than a loss.
*Fix: re-run once after adoption if anything changed during the trip.
Small.*

### Low

**12. Every merge is last-writer-wins on the device's own clock.** A device
whose clock is behind loses its newer answers to the other device's older
ones, and a device whose clock is ahead writes deletion markers that beat
edits made after them elsewhere. Inherent to the design; worth knowing.

**13. A save scheduled just before a sync's result is adopted writes the
older document over the adopted one.** Memory and the server are right; the
device's disk is behind until the next save.

**14. A legacy sync document is deleted without being read.** After a
successful sync, the app deletes the document under any previous private
key this device once used, on the assumption it holds nothing this device
lacks — untrue if another device wrote to it in between.

**15. The server's write lock is in memory and its delete is outside it.**
Fine for one process on one volume, which is what runs today; two replicas
would silently lose updates.

## What is holding up

- **The mark is filed correctly.** The write path has a pure core with
  twenty-nine tests; a mark lands on the right form under the right key,
  practice does not move a schedule, a grid marks each word on its own
  pair, a withdrawn card is passed over.
- **Two devices cannot silently overwrite each other on the server.** The
  conditional write is serialised per key and proven under eight concurrent
  writers; the version tag is derived from content.
- **The merge is idempotent and per answer.** Two devices drilling
  different exercises both keep their work; a frame's record of what it has
  met merges by high-water mark; deletions age out.
- **The rehydration round trip is whole.** Since 0.145 every key a form
  carries survives load, sync and import, and a card goes to a device and
  back through the editor unchanged.

## What to do, in order

1. **Server durability** (findings 1 and 10): flush, keep a previous copy,
   report an unreadable document as an error, refuse a wipe without consent.
   The lockout is rare and total, and there is no way back from it.
2. **Park withdrawn progress instead of destroying it** (finding 2), and
   make the server fail a request whose reads failed. This is the
   likeliest large loss in ordinary use.
3. **A reset that sticks** (finding 3), **a mark that sticks** (finding 6),
   and **named turns** (finding 7): three small changes to what travels and
   how it merges.
4. **Flush on hide and before reload** (finding 5), **merge in another
   tab's writes** (finding 4), and **retry a failed save loudly**
   (finding 8): the device holds on to what it has.
5. **Size** (finding 9): measure honestly, warn early, explain the refusal.
6. Each with the test the audit found missing: a bad file on disk, an empty
   refresh, a reset through a sync, two tabs, a mark through a merge, a turn
   removed from a scene.

---

## Technical appendix

Lines are as of commit 9f31b64.

**1.** `server/store.js:121-134` writes `<key>.<pid>.<rand>.tmp` then
`rename`; no `fsync` of file or directory; no previous copy. `server/api/
sync.js:87-94` answers `{ etag: null, data: null }` when `JSON.parse` fails,
identical to "never stored". Client `src/sync.ts:279-289` pushes with
`etag: null` → `sync.js:118` `onlyIfNew` → `store.js:175` refuses because
`readRaw` returns `""` (not null) → 409, re-pull, 409, `throw
Error("conflict")` → `ArabicTrainer.tsx` shows "Sync failed". Reproduced
end to end by truncating the stored file under a live server: GET
`{etag:null,data:null}`, POST 409, POST 409.

**2.** `server/api/courses.js:239-246` `readJson` catches every error and
returns null; `:359-361` `readManyJson` maps it; `my-material` (`:1420`)
filters nulls with `.filter(Boolean)` and answers `ok: true` with whatever
is left. `src/shared.tsx:3188-3230` `foldCourses`: `own.concat(kept)`
drops every `source` item not in `incoming`; `goneIds` → `ArabicTrainer.tsx:
5916` `tombstones[id] = now()`; `src/sync.ts:157-159` deletes any item with
`updated <= tombstone` on every device; `cardToItem` (`shared.tsx:2863`)
rebuilds a returning card with `freshStates()`. Reproduced: a tombstone
stamped now against a card answered yesterday removes it on the other device
(`mergeData` → 0 items).

**3.** `resetScheduling` (`ArabicTrainer.tsx` ~6074) writes `freshStates()`
(`updated: 0`); `isFreshState` (`sync.ts:229`) is true for it; `compactStates`
drops it from `forWire` and `saveData`. `mergeStates` (`sync.ts:70-81`) keeps
the side that has a state when the other has none. Reproduced: after the
reset syncs against a copy with the old states, `reps` is back to its old
value; the wire carries `s: {}` for the reset form.

**4.** `loadData` runs once (`ArabicTrainer.tsx` ~5470); `persist` →
`saveData(next)` writes the whole document under one key
(`src/storage.ts:23-32`); no `storage` event listener, `BroadcastChannel`,
`beforeunload` or `pagehide` anywhere in `src/` (grep, this audit).

**5.** `persist` (`~5512-5523`): `setTimeout(saveData, 600)`. `updates.ts:
73-79` `holdUpdates(false)` calls `reloadOnce()` synchronously when an update
is waiting; the hold follows `session` (`ArabicTrainer.tsx:5142-5143`), so
`setSession(null)` in `resetScheduling` and at session end can reload before
the timer fires. `updates.ts:135-139` also reloads on `visibilitychange` to
hidden. `updates.ts:29-30` claims progress is written as it happens.

**6.** `mergeItem` (`sync.ts:83-112`): `base` by later `updated`; `{ ...base,
forms, lines }` — every item-level field including `priority` from base
only; `gradeInto` stamps `item.updated` on every mark (`grade.ts`
`withMark`). Reproduced: `priority: true, updated: t1` merged with an
answer at `t2 > t1` → `priority: undefined`.

**7.** Server line whitelist `courses.js` (`card.lines.slice(0, 12).map(...)`)
stores `who, ar, en, lat, clips, slowClips, uses`, no `id`; editor
`blankLine` (`card-editor.tsx:94`) mints none; `cardToItem`
(`shared.tsx:2947`) names `-l${i}`; `foldForms` matches by id then position;
`removeLine` (`card-editor.tsx:2070`) filters by index.

**8.** `storage.ts:23-32` returns null on throw; `saveData` returns false;
`persist` sets `saveFailed`; one toast (`ArabicTrainer.tsx` ~8033); no
retry; `runSync`'s and `refreshCourses`'s own `saveData` calls ignore the
result.

**9.** `sync.js:16,110` `MAX_BYTES = 4 MiB` compared against
`JSON.stringify(...).length` (UTF-16 units); `sync.ts:215` → `push-failed-
413` → generic message; `index.js:28,95-98` 12 MiB cap that calls
`req.destroy()` before answering.

**10.** `sync.js:105` accepts any non-null object; reproduced: `{ items: [] }`
with a valid etag → 200.

**11.** Sync triggers: launch, `setTimeout(runSync, 4000)` on data change
(`~5445`), `online` (`~5466`). `runSync` returns if `syncing.current`;
adoption's `commit` sets `fromSync`, whose effect cleanup clears the timer.

**12.** `sync.ts:78` `(sa.updated || 0) >= (sb.updated || 0)`; `:158`
`tombstones[it.id] >= it.updated`; both on device wall clocks.

**13.** `runSync` adopts via `commit` + `saveData` without clearing
`timer.current`.

**14.** `ArabicTrainer.tsx` ~5378-5387, `forgetRemote` on each of
`LEGACY_SYNC_KEYS` after a successful sync; errors swallowed.

**15.** `store.js:74-98` in-memory `underLock`; `:187-195` `delete` not under
it.

Tests that would have caught the high findings and do not exist: a stored
document overwritten with `""` followed by GET and POST; `foldCourses`
against an empty or partial `incoming` asserting no progress is lost;
`resetScheduling` followed by `mergeData` against the pre-reset copy; two
documents diverged from one and saved to one key; `priority` through
`mergeItem` where the other side is newer; a scene with a middle turn removed
through `foldCourses`.
