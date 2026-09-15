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
