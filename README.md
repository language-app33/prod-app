# Taleb33

A spaced-repetition app for learning languages, built as a progressive web
app. It started as an Arabic trainer and now also supports Vietnamese (Huế
dialect); adding another language is a matter of describing it in one file.

Teachers publish decks of cards to a course; students join with a code and
the material appears on their devices, along with any recordings. Progress
is tracked per exercise type, not per card, so knowing a word when you read
it and knowing it when you hear it are scheduled separately.

Three rules shape what a session asks, all of them in `src/scheduler.ts`:

- **A card is recognised before it is produced.** Every exercise type stands
  on a level, and a form is asked the next level only once every exercise
  it supports on the levels below has reached that level's bar:

  | level | what it asks | exercises |
  |---|---|---|
  | 1 | what the word means | choose the meaning · {script} → English · listen → English · read a scene |
  | 2 | which word it is | match the pairs · English → choose · choose the missing word |
  | 3 | write it from a cue | {translit} → script · listen → script · listen → tone · choose the reply · put a scene in order |
  | 4 | write it from its meaning | English → script · fill the gap · phrase heard → script |

  Levels 2 and 3 open on *graduated* — through the learning steps and in
  review, at whatever interval. Both are still cued: the word is on the
  screen to be told apart, or its pronunciation is, and neither asks for
  recall from the meaning alone. Level 4 opens on *mastered* — in review,
  with an interval of at least four days — so the strict bar stands where
  writing from memory begins. A level a card has no material for is passed
  straight through. A lapse below closes the levels above until it is
  recovered. Each exercise declares its own level in `src/languages.ts`
  and each level its own bar, in `LEVEL_BARS` beside them; `openTypes` in
  the scheduler reads both.

  Two questions ask for the word in the script and offer its
  transliteration as a nudge — *English → script* and *fill the gap*. On
  those the nudge is the answer said another way, so it is never opened by
  itself and an answer written with it up is marked as a near miss:
  `hintTells` in `src/languages.ts`.

  **The same ladder is what a learner is shown.** `standings` in the
  scheduler reads a card as one row per level it has material on, each
  *not started*, *learning*, *done* or *paused* — paused being a level
  that had opened and has been shut again by a slip further down, which is
  the one thing about the ladder nobody could otherwise make sense of. A
  level is *done* exactly when `openTypes` opens the one above it, so the
  screen and the scheduler cannot come to disagree; a test walks every
  combination to hold them together. `standing` picks the one row to put
  on a card. The Progress tab counts cards by level, and a card's own
  screen lists them.
- **New cards are introduced only while there is room.** Beyond the
  per-session limit in the settings, nothing new is dealt while ten cards
  are already being learnt or forty are young and still coming back for
  review. A card's phase is read over the levels it has reached: *New* is
  never met, *Learning* is met and not yet through the steps somewhere,
  *Young* is graduated everywhere it is open, *Mature* is three weeks out
  everywhere.
- **One tense of a verb is ever new at a time.** Where a language lays its
  verbs out in a table — Arabic in seven persons and three tenses, Huế in
  one person and four markers — each cell of it is a sub-form, drilled and
  scheduled in its own right by the exercises every other form gets. The
  rows open in the order the language teaches them, one waiting on the one
  above it being mastered, so the past of a verb is not asked until its
  present is known and a lapse closes the rows above. Where a language has
  no infinitive it names the cell a dictionary would list instead — Arabic
  cites the he-past — and that cell stands in for the card's own word
  rather than the two being drilled as one word twice. On those languages
  it stands in for it in the editor as well: the block asking for the
  card's own word is not shown, the cell is what the card is saved as, and
  a word first called a verb moves into that cell rather than being asked
  for twice. Where a language cites nothing — Huế cites the bare verb,
  which is a word and not a cell — the block is the verb and stays. A verb card may also
  carry a sentence with its own place marked in it — `{{name}} {{verb}}
  {{object}}` — and the form that stands there is the one whatever filled
  the subject calls for, read off the number and gender its card already
  carries. See `src/verbs.ts`.
- **A word carries the pronouns its language attaches to it.** Arabic and
  Hebrew write *my book* as one word, and the same endings carry a
  preposition — عند is *at*, عندي is *I have*. Those are forms of the word,
  so they are cells of a table like a verb's: one row, a column per pronoun,
  each drilled and scheduled in its own right. A language declares the
  columns or declares none and no such table exists. The row waits on the
  word itself — it opens once the card's own word has climbed past level
  one, which is the ladder's *recognised before produced* turned sideways,
  because meeting كتابي before كتاب is meeting a word you have not learnt in
  a shape you cannot read. Which table a cell belongs to is read off the row
  it sits in, so one card never lays out both.
- **A form can be kept without being asked about.** A card is a word and a
  pile of forms of it — other spellings, the pronouns on its end, every
  person and tense of a verb — and a teacher may want some of that written
  down for a student to read rather than drilled. Each of those is a part
  that can be switched off in the editor: it stays on the card, keeps its
  recordings and keeps whatever progress a student has made on it, and is
  never asked. Stored as `ask: false` on the forms it covers, so a card
  written before this and anything added to one later are both asked;
  `askParts` in `src/card-editor.tsx` is what a teacher is shown, and
  `isAsked` in `src/scheduler.ts` is what every reader goes through. A
  form's own table follows the form off — the pronouns on the end of a
  word wait on that word being known, so under a form nobody is asked they
  could never open.
- **A sentence is a card made of blanks, and the vocabulary fills them.** A
  card may leave a hole in itself — `اسمي {{name}}` — and the question fills
  it before anybody reads the card, with a different word next time round.
  A blank is filled three ways, in rising order of how much filing it
  costs the teacher. `{{word}}` takes any word in the language, with
  nothing written on any of them. A blank named after a **kind of word** —
  `{{noun}}`, `{{verb}}`, whichever its pack declares — takes the cards
  that say they are one, which they already did when they said what they
  were. And a blank with a name of the teacher's own takes the cards that
  name it back, in `fills`, which is the only case left where anything has
  to be written twice. Every form of a filler lends itself, not only its
  own word: a plural stands in a sentence its singular does not, gated on
  what that form itself has climbed. A card with a blank in it never fills
  one — a sentence dropped into somebody else's hole is a sentence with a
  gap where the point was — and `{{verb}}` on a verb card's own sentence
  means its own place in it rather than any verb, which `ownSlot` in
  `src/verbs.ts` is the one answer to. The editor asks which kind of card
  it is: a word, a sentence, or a conversation. Nothing is stored saying
  "sentence" — the braces are in the text, so a card with a blank in it is
  one whichever editor wrote it.
- **A learner studying more than one language says which are in play.** A
  switch at the top of Learning, beside the space tabs, lists the languages
  they have cards in and holds the ones switched off in
  `settings.langsOff` — the ones *off*, so a language that arrives later is
  in play by default. Everything the learner is shown reads the cards it
  leaves: the card list, Progress, what is ready, and what a session is
  dealt from. It appears only where there is a choice to make, and the last
  language on cannot be switched off.
- **What varies between askings turns on a right answer.** Which values
  fill a card's holes, which phrase it is shown in, which of its accepted
  spellings is put up and which of its meanings is asked about are all
  rotated rather than drawn, so a card with three of something is met as
  all three before any of them twice. The count is of right answers —
  `turnOf` in the scheduler — so a question that was missed is the one
  asked again, rather than the miss itself turning up a sentence nobody
  has been taught.
- **A matching grid is five questions.** Every word in it is asked, marked
  and scheduled in its own right. Which words stand together is decided
  when the session is built: the grid is filled out from cards already
  met, the most alike first, and a word dealt in to fill it that was not
  due is credited for a right answer without its schedule moving.

## Running it

```bash
npm install
npm run serve      # build, then serve the app and the API on one port
npm run dev        # Vite alone: the UI only, with no API behind it
npm run build      # production build into dist/
npm test           # unit tests, including the server (no browser needed)
npm run test:smoke # renders the whole app in jsdom against a stubbed server
npm run typecheck  # types: every file, strict — see Types below
npm run check      # all of it, as CI runs it
```

Node 22.18 or newer — the first 22 that strips types without a flag, which
the server and the tests both rely on. The tests need no configuration;
`test:smoke` builds the app into `tests/.smoke-build/`, which is
git-ignored.

Use `npm run serve` to work on anything that touches an account, a course or
sync. `npm run dev` runs Vite on its own, which serves no `/api`, so the app
cannot get past its first screen — that screen signs in, and signing in
needs the server.

## Deploying

One Node process serves both the built app and the API, so it needs a host
that runs a process rather than static files alone. `npm start` runs it, and
it listens on `PORT`.

Nothing is needed at run time: the server imports only Node built-ins and the
app's own files, and everything else — React included — is compiled into
`dist/` by the build. The build itself does need the devDependencies, so
`.npmrc` sets `include=dev`; without it a host that installs with
`production=true` skips them and the build stops at `sh: vite: not found`.

Documents are stored as files, and **the directory they go in has to
survive a restart.** Most hosts give a container a disk that is thrown away
on the next deploy, and nothing about that failure is visible while the app
is running: accounts are made, courses are taught, and it all disappears at
the next push.

The server picks its directory in this order, and names the one it chose —
and where the choice came from — in its startup log:

1. `DATA_DIR`, if set.
2. `RAILWAY_VOLUME_MOUNT_PATH`, which Railway sets by itself once a volume
   is attached — so on Railway, attaching the volume is the whole job and
   there is no path to keep in step by hand.
3. `./data`, if neither is set. The server prints a warning at startup,
   because on most hosts this disk does not persist.

Environment variables:

| name | effect |
|---|---|
| `PORT` | port to listen on. Defaults to 3000; most hosts set this for you. |
| `DATA_DIR` | where documents are written. Overrides an attached volume. |
| `SIGNUP_CODE` | if set, making an account requires this code. Leave unset to let anyone sign up. |
| `ADMIN_KEY` | if set, an account can promote itself to administrator once by entering it. |

### Version numbers

Two numbers appear at the foot of the top-right menu, and they answer
different questions.

The **release** — `0.1`, `0.2`, `0.3` — is what you are on. It lives in
`package.json`'s `version` field, which is the only place it lives, and it
is bumped by hand in the same commit as the work it names: once per batch of
change a person would notice, not once per commit. The second digit counts
rather than divides, so `0.9` is followed by `0.10`, and `1.0` is reserved
for a launch. npm insists on a third part, so the field reads `0.1.0`; the
app never shows it. `CHANGELOG.md` says what each release contained.

The **commit** beneath it is the build, and it is the one that answers "is
what I merged actually running?" — see `scripts/version.mjs` for where it
comes from. The app compares its own commit against `/api/version` and
offers a Reload when a service worker is still serving an older copy, so a
release number alone is never taken as proof of a deploy.

## How it fits together

```
src/
  languages.ts     every language-specific rule: grammar axes, grading,
                   keyboards, exercise definitions. Imports nothing from the
                   app, so it can be read and tested on its own.
  variables.ts     a hole in a card — "My name is {{name}}" — and the cards
                   and forms that fill it. Pure, like the two above.
  cards.ts         what a card is made of: its own word and the forms it
                   carries, as one list. The single door everything that
                   walks a card's forms goes through. Pure, imports nothing.
  verbs.ts         a word's forms as a table over the card's own sub-forms —
                   a verb's persons and tenses, or the pronouns a language
                   attaches to the end of a word:
                   where the rows and columns come from, what a cell means,
                   which cell a subject calls for, and which rows are open
                   yet. Pure, and imports nothing.
  ArabicTrainer.tsx  the learner's app: scheduler, session builder, screens
  spaces.tsx       the teaching and admin spaces, loaded lazily so a student
                   never downloads them
  card-editor.tsx  editing a card: the editor and the pieces it is built
                   from, apart from the spaces so each reads as itself
  shared.tsx       the component library both sides use
  sync.ts          merging two devices' documents, and clip sync
  index.css        one stylesheet, with the design tokens at the top
server/
  index.js         the process: routes /api, serves dist/, nothing else
  store.js         documents on disk, with the conditional writes sync needs
  api/
    sync.js        the per-person sync document
    courses.js     accounts, courses, decks, cards, recordings, reported
                   problems, backups
tests/
```

`docs/UI-COMPONENTS.md` lists every reusable component with its props and how
widely it is used — worth reading before adding UI.

A few rules the code follows, learned the hard way:

- **Anything language-specific lives in `languages.ts`.** Divergent copies of
  a grader or an editor are where the subtle bugs come from.
- **One implementation of a thing.** If two versions of a component coexist,
  the goal is to converge on one, not to keep both.
- **The scheduler owns the schedule.** Exercise state is per card *and* per
  exercise type; states that have never been answered are not stored.
- **Merging is idempotent.** Sync can run twice with the same input and
  nothing changes.

### Types

Every file is checked, in `strict` mode, by `npm run typecheck` — which
`npm run check` and CI both run. Nothing is compiled by tsc: it is a second
reader, and the server still runs from source.

**`src` is TypeScript, and there is still no build step for it.** Node 22
strips types on the way in, so a `.ts` module is imported by the tests and
by the server exactly as a `.js` one was — no loader, no transpile, and
nothing emitted by tsc. Only erasable syntax is used, which is what makes
that true: no `enum`, no `namespace`, no parameter properties. DECISIONS.md
records how the conversion went and what it found.

What Node will not do is guess an extension, so **an import names the file
it means**: `"./chance.ts"`, `"./shared.tsx"`. The server is JavaScript and
stays JavaScript — it runs the same modules `src` does, and has nothing to
gain from the move.

The records both sides pass are in `src/types.ts` — a card, a deck, a
course, an account, a report, a language pack. It has no runtime value; it
exists so the two ends of a request describe the same thing. `LangId` is a
string and a `Lang` is the pack that has one, and sending the second where
the first was wanted is the bug that prompted all of this.

`tests/types.test-d.js` tests the types themselves. Node does not run it;
tsc does, and its assertions are `@ts-expect-error` comments, which fail
the build if the thing they mark stops being an error. It is the only way
to test that something is *rejected*.

Types are a second reader, not a replacement for the tests. They would not
have caught reporting a card by the device's id instead of the server's —
both are strings. `tests/cards.test.mjs` catches that one.

## Notes on the data

Each device holds the whole document in local storage and syncs it under a
token derived from the sign-in key, so every device signed in as one person
shares one document. Recordings live in IndexedDB, keyed by a hash of their
contents, and are fetched on demand.

Course cards carry a `source` pointing back at the deck they came from. The
teacher owns their wording; the student owns their progress. When a teacher
withdraws a card it is tombstoned rather than merely deleted, so the next
sync does not hand it back.

A card that fills a variable (`fills: "name"`) belongs to no deck: the server
sends it with every deck whose phrases leave a hole of that name. It is the
one thing in the material that crosses a deck boundary, which is why a
teacher's values carry a revision of their own — see DECISIONS.md.
