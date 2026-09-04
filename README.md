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
```

Node 22 or newer. The tests need no configuration; `test:smoke` builds the
app into `tests/.smoke-build/`, which is git-ignored.

Use `npm run serve` to work on anything that touches an account, a course or
sync. `npm run dev` runs Vite on its own, which serves no `/api`, so the app
cannot get past its first screen — that screen signs in, and signing in
needs the server.

## Deploying

One Node process serves both the built app and the API, so it needs a host
that runs a process rather than static files alone. `npm start` runs it, and
it listens on `PORT`.

Documents are stored as files under `DATA_DIR`. **That directory has to
survive a restart.** On a host with an ephemeral filesystem — Railway among
them — attach a volume and point `DATA_DIR` at its mount path, or every
account and course disappears with the next deploy.

Environment variables:

| name | effect |
|---|---|
| `PORT` | port to listen on. Defaults to 3000; most hosts set this for you. |
| `DATA_DIR` | where documents are written. Defaults to `./data`, which is only safe if that path persists. |
| `SIGNUP_CODE` | if set, making an account requires this code. Leave unset to let anyone sign up. |
| `ADMIN_KEY` | if set, an account can promote itself to administrator once by entering it. |

## How it fits together

```
src/
  languages.js     every language-specific rule: grammar axes, grading,
                   keyboards, exercise definitions. Imports nothing from the
                   app, so it can be read and tested on its own.
  ArabicTrainer.jsx  the learner's app: scheduler, session builder, screens
  spaces.jsx       the teaching and admin spaces, loaded lazily so a student
                   never downloads them
  shared.jsx       the component library both sides use
  sync.js          merging two devices' documents, and clip sync
  index.css        one stylesheet, with the design tokens at the top
server/
  index.js         the process: routes /api, serves dist/, nothing else
  store.js         documents on disk, with the conditional writes sync needs
  api/
    sync.js        the per-person sync document
    courses.js     accounts, courses, decks, cards, recordings, backups
tests/
```

`docs/UI-COMPONENTS.md` lists every reusable component with its props and how
widely it is used — worth reading before adding UI.

A few rules the code follows, learned the hard way:

- **Anything language-specific lives in `languages.js`.** Divergent copies of
  a grader or an editor are where the subtle bugs come from.
- **One implementation of a thing.** If two versions of a component coexist,
  the goal is to converge on one, not to keep both.
- **The scheduler owns the schedule.** Exercise state is per card *and* per
  exercise type; states that have never been answered are not stored.
- **Merging is idempotent.** Sync can run twice with the same input and
  nothing changes.

## Notes on the data

Each device holds the whole document in local storage and syncs it under a
token derived from the sign-in key, so every device signed in as one person
shares one document. Recordings live in IndexedDB, keyed by a hash of their
contents, and are fetched on demand.

Course cards carry a `source` pointing back at the deck they came from. The
teacher owns their wording; the student owns their progress. When a teacher
withdraws a card it is tombstoned rather than merely deleted, so the next
sync does not hand it back.
