# Taleb33

A spaced-repetition app for learning languages, built as a progressive web
app. It started as an Arabic trainer and now also supports Vietnamese (Huế
dialect); adding another language is a matter of describing it in one file.

Teachers publish decks of cards to a course; students join with a code and
the material appears on their devices, along with any recordings. Progress
is tracked per exercise type, not per card, so knowing a word when you read
it and knowing it when you hear it are scheduled separately.

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
                   that fill it. Pure, like the two above.
  ArabicTrainer.tsx  the learner's app: scheduler, session builder, screens
  spaces.tsx       the teaching and admin spaces, loaded lazily so a student
                   never downloads them
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
