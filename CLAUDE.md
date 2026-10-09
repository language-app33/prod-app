# Working on this repository

Notes for Claude Code, and for anyone driving it. Conventions for the code
itself are in `README.md`; what is here is how work gets delivered.

## Finish on beta, without being asked

**`beta` is the branch that deploys.** Work that only reaches a feature
branch has not been delivered — it is sitting where nobody can see it.

So: develop on whatever branch the task names, and when the work is done and
checked, **merge it to `beta` and push, every time, without asking.** This is
a standing instruction from the repository's owner. Do not stop to ask
whether to merge, and do not report a change as delivered until `origin/beta`
carries it.

Before the push to `beta`:

- `npm run check` is green on the exact tree being pushed — lint, types, unit
  tests, the smoke harness, and the build, which is what CI runs too.
- The release in `package.json` is bumped and `CHANGELOG.md` says what
  changed, in the terms `README.md` describes.

How to push it:

```bash
git fetch origin beta
git push origin <your-branch>:beta      # a fast-forward, the usual case
```

A checkout may hold a **local `beta` that is unrelated to `origin/beta`** —
one that shares no history with it and deploys nothing. Do not merge into
that branch by habit; confirm what you are about to push with
`git rev-list --left-right --count origin/beta...HEAD` and push the branch to
the remote ref, as above. If the push is not a fast-forward, merge
`origin/beta` into the work first and resolve it there — never force-push
`beta`.

Opening a pull request is still something to be asked for. Merging to `beta`
is not.

## Keep the open pull request's title and description current

An open pull request follows its branch, so every push to `beta` adds to the
pull request merging `beta` into `main`, if one is open. **After every push
to a branch that has an open pull request, update that pull request's title
and description, every time, without asking**, so they describe everything
it now carries, not only what it was opened with:

- The title names every release the pull request spans (for example
  "0.364–0.365: …") and what each is about.
- The description has a section per release, newest first, in the plain
  terms of the changelog: what changes for the people using the app, any
  trade-off, and anything still to be checked by hand. Then whatever else
  rode along, and what was checked (`npm run check` on the pushed tree).
- Check for an open pull request after pushing; do not assume there is
  none. A change that is not a release (a test, a note like this one) goes
  under "Also included".

Do not report the work as delivered until the pull request says what it
carries.

## How to talk about the work

**Plans, proposals and summaries of what was done are written for the
owner, not for the code.** Plain language, and short: what is wrong or
wanted, what will change for the people using the app, what it costs, and
how it will be checked. No file paths, function names, line numbers or
mechanism unless the owner asks — those belong in commit messages,
`DECISIONS.md` and comments, where a reader wants them. If a technical
detail must be kept in a plan for the build's sake, put it in one short
section at the end, clearly marked as such.

This applies to every plan presented for approval, every proposal offered
in conversation, and every summary of actions taken at the end of a piece
of work.

## How to ask clarifying questions

Whenever there are questions for the owner, before building or at any other
point, ask them this way, every time:

- A numbered list, grouped by topic with sub-numbers: 1a, 1b, 2a, and so on.
- One question per item, never two in the same item.
- Concise and non-technical, in the same plain terms as above.
- Where what the owner said can be read more than one way, and the ways
  are put back to them, each reading is numbered or named, so the owner
  can answer with which one is right in a word ("2", or "the second").

## How to propose fixes

Whenever there is more than one way to fix something, whether in answer to a
question, in a plan, or offered unprompted, set them out this way, every
time:

- A numbered list, one fix per item, so the owner can answer with a number.
- Where there are several things to decide at once, each with its own
  fixes, number the things and letter the fixes under each: 1a, 1b, 2a,
  2b. Never 1.1 and 1.2, and never a second list restarting at 1 under a
  numbered heading — every option must have a label of its own, so the
  owner can answer "1b, 2a" and be understood.
- Each item says, in the same plain terms as above, what changes for the
  people using the app and what it costs or gives up.
- Then a recommendation, naming one of the numbered fixes and saying in a
  sentence or two why.

Where there is only one sensible fix, still say which it is and why, rather
than presenting it as a list of one.
