# Proposal: a card opened to look at says everything a card opened to edit says

In the teaching space a card can be opened two ways: to change it, or to
look at it. The second is meant to be the first with the typing taken away.
It is not, and it has never caught up: it was written as its own screen,
listing the things somebody thought were worth showing on the day they wrote
it, and every feature since has had to be added to it a second time by
somebody remembering to.

Nobody remembered. Here is what a teacher cannot see today by looking at a
card, all of which they can see by editing it:

- what kind of word they said it is — a noun, a name, a preposition
- the card's own ID: the name other sentences call this one card by
- which blanks the card leaves, what words will go in them, and the
  sentences it comes out as
- the group tags, other than as one bare line with no counts on it, and
  without the two tags every card wears whether anybody ticked them or not
- a verb's table, or the pronouns on the end of a word: the cells are there,
  as an unnumbered run of *other forms*, with nothing saying which tense or
  which person any of them is
- which forms are asked about, which are written down to be read, and which
  are lent to other cards' sentences
- what a number card is worth, which is the whole of what makes it a part a
  number can be built out of
- the words each turn of a conversation teaches

And one that is worse than missing: a sentence's blanks are printed with
their braces showing — `اسمي {{name}}` — where every other screen in the app
draws a blank as a pill. The view-only screen is the only place left that
shows a teacher the storage.

This proposes fixing all of that, and then making it the last time.

## Why it keeps happening

Because there are two descriptions of what a card is. One is the editor,
which knows every field because it writes them. The other is the view-only
screen, which knows the fields somebody typed into it. Adding a feature
means adding it to the first and remembering the second, and *remembering*
is not a mechanism — it is a thing that works until the day it does not,
with no sign either way.

So the fix is not to go and add nine missing rows. That gets us to today and
leaves tomorrow exactly as fragile.

## The rule to adopt

**The saved card is the contract between the two screens.**

Everything edit mode can do ends as a card being saved. There is no feature
in the editor whose result is not on the card afterwards — that is what the
editor is. So a view-only screen that shows *everything a saved card can
hold* cannot fall behind edit mode, whatever gets added, because a new
feature that stores nothing has changed nothing to show.

That turns a promise about discipline into a question about data, and a
question about data is something the build can check.

It is also better than the obvious alternative, which is to make the two
screens one component with the inputs switched off. The editor is not a list
of fields — it is drag rails, pills you can pull along a sentence, recording
overlays, a grid that mints cells. A locked-down copy of that reads as a
form somebody took the buttons off, and it is not what a student's card
screen should ever show. One description of the card, two ways of drawing
it, is the convergence worth having.

## The change, in three parts

**One list of what a card can hold, and the view-only screen is drawn from
it.** Not a screen that mentions fields, but a plain list — for each thing a
card can carry, its heading, how to say it in words, and who it is worth
showing to. The screen becomes a renderer of that list. Where a feature
adds something to a card, the list is the one place it is described, and the
screen has it.

**And whatever is on a card that the list has not got is shown anyway.** The
screen walks the card in front of it rather than a fixed run of fields. A
field the list knows is drawn the way the list says. A field nobody has
described yet is put at the foot under *Also on this card*, under its own
internal name, with its value as it is stored. Deliberately plain, because
it is the visible sign of a thing nobody has got round to describing — and
in the meantime the teacher can see it.

This is the part that makes the guarantee hold without anybody being
vigilant. Today the default for a new field is silence. After this the
default is *shown, badly*, which is a prompt rather than a hole. The only
way for something to be invisible is for a person to put it on a short
by-name list of things that are not information — internal ids, timestamps,
which version of the record it is — each with a line saying why. That is a
decision somebody makes on purpose, once, in writing.

**And the build refuses to let the two drift.** Two checks, which are what
make the rest of this last:

*Nothing is quietly dropped.* A set of example cards, one per kind and per
feature — a word, a verb with its table, a word with pronoun endings, a
sentence with two blanks, a conversation, a number part, a card that is only
ever lent to other sentences, forms switched off from being asked — each
built by running them through the editor's own save, so they are exactly
what edit mode writes and not an idea of it. Then the view-only screen is
rendered over each one and every piece of information on the card has to
appear on the screen. This walks the card rather than a checklist, so a
field added next month is covered the day it is added and nobody writes a
new test for it.

*And the examples stay exhaustive.* The check above only proves what the
examples carry, so a second one reads the record's own field list and fails
when a field no example card holds. This is how two other parts of the app
already stay honest — the list of text styles and the reference of named
screen parts are both checked against the source they describe.

Together they fail in the right order. Add a field: the build says *no
example card carries this*. Add it to an example: the build says *and the
view-only screen does not show it*. Give it a heading: green. At no point
can the work be finished and the parity quietly broken.

## What a teacher notices

Opening a card to look at it shows the card. A verb's table is a table, with
its tenses and its persons. A sentence says what its blanks are, what goes
in them and what it comes out as. The tags say how many words are behind
each. The forms say which are asked about and which are there to be read.
Blanks are drawn as pills, as they are everywhere else.

A plain word card with none of that reads as it does today: anything with
nothing in it is left out, so the screen does not get longer for cards that
have nothing more to say.

The student's card screen is drawn from the same list, and each thing on
that list says whether it is the teacher's business or both. What a student
sees does not grow: group tags, IDs and what is lent to whom are the
teacher's side of the card, and stay there.

## What this does not fix

Some of what edit mode shows is not on the card — it is worked out while the
teacher is looking: how many words are behind a blank, the filled-in example
sentences, the warning that a name is taken. The rule above says nothing
about those, because there is no stored field for the check to find.

They are worth having on the view-only screen and two of them are in the
list of gaps above, so they get written; what they do not get is the
automatic guarantee. The honest mitigation is that all of them come from a
handful of named functions, and a third check can assert that the view-only
screen reads the same ones. That is a weaker promise than the other two and
should be described as one rather than counted with them.

## What it costs, and how we will know it worked

One release. Nothing stored changes, so there is no migration and no card is
rewritten: this is a reading of what is already there.

The work is the list, the screen redrawn from it, the example cards, and the
two checks. Call it a day or two. The nine gaps at the top are not separate
work — they are what the first check reports on the first run, and fixing
them is filling in the list.

We will know it worked the next time a feature is added to the editor by
somebody who has never read this document, and it turns up on the view-only
screen because the build would not let them finish without it.

---

## For the build

Everything below is mechanism, and belongs in `DECISIONS.md` once it is
settled.

- The list is a new pure module — `src/card-facts.ts`, in the family of
  `cards.ts`, `variables.ts` and `verbs.ts`: imports nothing but the pack,
  no React, reachable by a test without the app. It exports the described
  fields (key, heading, how to render, audience, which card shapes it
  applies to), the by-name ignore list with a reason on each entry, and one
  function that takes a card and returns its facts in groups, unknown keys
  last.
- `CardReadout` in `src/shared.tsx` becomes the renderer of that. Its two
  current branches stay — a conversation is read as a scene, not as a word
  with forms — but both draw their rows from the list. `whereItLives`
  collapses into the audience on each fact, so the student's screen and the
  teacher's are one call with a different reader.
- Answers go through `Written`/`splitSlots` so blanks draw as pills, which
  is the one-line half of the braces bug.
- Table cells: group `forms` by `of` and `row`/`col` through `verbs.ts` and
  draw the table, rather than listing cells as `Other form N`.
- The corpus is built with `writtenCard` from `src/card-editor.tsx` over
  drafts, not written as literals — that is what makes it *what edit mode
  writes*. `initialForms`/`initialCells`/`useWordDraft` are the seeds; the
  draft hooks are React, so the corpus either renders the editor in jsdom
  (the smoke harness already does this) or calls `writtenCard` over drafts
  assembled by hand. The first is stronger and is what to try first.
- Check one renders the readout in jsdom and asserts every non-empty
  primitive leaf of the card appears in `textContent`, recursing into
  `forms`, `lines` and the grammar axes; recordings count as shown when
  their label and count are, since a hash is not information. Failures name
  the field and the card.
- Check two reads the `Card` and `CardForm` field names out of
  `src/types.ts` — the way `tests/text-styles.test.mjs` and
  `tests/screen-elements.test.mjs` read the sources they describe — and
  asserts each appears in the corpus or in the ignore list. `Card` is
  `& Record<string, unknown>`, so the type cannot be enumerated at runtime;
  reading the source is what is left, and it is the repo's existing idiom.
- Number cards carry `value`, and it is written from the number-parts screen
  in `src/spaces.tsx` rather than the card editor. Worth keeping in mind:
  the editor is not the only writer, which is the second reason to walk the
  card instead of mirroring the editor.
