# Audit: rules for cards nobody can make, and cards nobody planned for

**24 October 2026 · release 0.467, commit 5b7283b.** Read-only: nothing in
the app was changed by this audit. Every finding marked *probed* was
reproduced by running the real code, not by reading it.

> **The owner answered every decision at the end with the recommended
> option, and all of it is in 0.468.** This document is kept as it was
> written. The `CHANGELOG.md` entry for 0.468 says what changed for the
> people using the app; the `DECISIONS.md` entry *Words with several
> answers, in sentences* says how. The tests in
> `tests/several-answers.test.mjs` fail on findings 4 and 5 if they are
> put back, and a test in `tests/deck-quality.test.mjs` does the same for
> finding 6. The open question about cards with no word type is still
> open.

## Why this audit

In 0.463 the deck quality score gained a rule for "a conversation switched
off", and the owner was asked a question about it. No teacher can switch
off a conversation. The rule came from a list of bugs that named a field
in the code, and nobody checked that the editor can ever write that value
on a conversation. The owner asked for the app to be searched for more of
the same.

The search went both ways:

- **Rules for things that cannot happen.** Code, tests, release notes or
  questions about a card no teacher can make. These are the original
  mistake. They mislead whoever reads them, but they do not change what
  students get.
- **Things that do happen and that the code treats as if they could not.**
  This is the same failure looked at from the other side, and it is where
  the harm is: a card teachers make every day that part of the app cannot
  see.

The method: for each kind of card (word, sentence, conversation or text),
what the card editor can actually save, checked against the server, which
keeps what the editor sends. That was then compared with what each part of
the app reads.

## The short version

**The original mistake is mine alone.** Apart from the 0.463 rule for
switched-off conversations, nothing in the code, the tests or the settings
was found to cater for a card or a setting that cannot be made. The
other fixes in 0.463 were each checked, and each covers something a
teacher can do. The open question about cards with no word type is real
too.

**The other direction turned up two real problems, both everyday:**

1. **A word card with more than one accepted answer is invisible wherever
   the app looks for a word inside a sentence** (*probed*). That covers
   the gap-fill, "Words this teaches", the In context tab, a deck's own In
   context section and the editor's check of a sentence's words. Since
   0.463 the quality score credits these sentences, so the score now says
   a word is practised in sentences that students never get. That
   disagreement is mine.
2. **Three places decide "word or phrase" by counting spaces and ignore
   the word type the teacher picked** (*probed*). So every Vietnamese word
   of two syllables, and every word card with two answers, is missed by
   "Words this teaches", the editor's sentence check and a deck's In
   context section. The app's main check was fixed for exactly this
   reason, and these three go round it.

## Part 1 — rules for things that cannot happen

### Finding 1. Switched-off conversations (my 0.463 work)

**What a teacher can do:** nothing. The conversation editor has no switch
for it. Saving a card marks it practised whenever any of its parts is
asked, and a conversation's part is always asked, because the conversation
editor shows no tick for it. The server keeps what the editor sends. Two
things could still carry it: a hand-edited import file, or a card saved
before 0.179, when the switch was a tick of its own. This copy's history
starts at 0.438, so whether the old tick was shown on conversations could
not be checked.

**Where it is written down:** a rule in the quality score; a test that
builds such a card; the 0.463 changelog ("A conversation switched off is no
longer counted, since students are never given it"); the matching line in
DECISIONS.md; the open pull request's description; and the comment at the
top of the score's code.

**What it costs:** no wrong numbers, since the rule never fires. A teacher
reading the changelog is told about a switch they cannot find, and the
owner was asked a question about it.

### Finding 2. The other fixes of 0.463 cover real cases

Each was checked against the editor:

| Fix | Can a teacher make it? |
| --- | --- |
| A sentence card with two accepted answers | Yes: "Add another accepted answer" under its words |
| A conversation line with two answers | Only by picking a sentence card that has two |
| A second version of a sentence card | Yes: "Duplicate this form"; also older cards with `subs` |
| A line picked from a sentence card | Yes: "Pick a sentence card" |
| A line with no letters, such as "." | Yes, though unlikely: any line with something typed is kept |
| A card stored with its words in its forms | Yes: every card saved since 0.138 |
| A word card with no word type (the open question) | Yes: picking one is never required, and the guess is not stored |

### Finding 3. Nothing else of this kind turned up

- **Settings:** every setting the app reads either has a screen or comes
  from the language itself, and old stored values for retired settings are
  dropped on load. No hidden setting was found.
- **Tests:** apart from the 0.463 test above, none of the tests builds a
  card that breaks the editor's rules for its kind: a conversation
  switched off, a sentence with a word type, or a line marked "not asked".
- **Harmless leftovers:** a couple of checks guard against states that
  cannot arise, such as a conversation line marked "not asked". They cost
  a line each and say nothing to anybody, so they are not worth touching.

## Part 2 — things that do happen, and parts of the app that miss them

### Finding 4. Words with several accepted answers are never found inside a sentence (*probed*)

A word card's form can accept several answers, and teachers use this
widely: كيف حالَك؟ or كيفَك؟, تمام or منيح. They are stored as one text
with a separator between them. Every place that looks for a word inside a
sentence reads that text whole, as one long "word" with the separator in
it, and finds it nowhere.

Probed with a card accepting تمام or منيح, a card accepting كيف حالَك؟ or
كيفَك؟, and a sentence linked to both, "مرحبا، كيفك؟ أنا تمام":

- **Gap-fill:** 0 sentences for either word, despite the confirmed link.
  Students never practise these words inside a sentence.
- **"Words this teaches"** in the editor: neither word is offered for a
  sentence that holds it.
- **In context tab:** no link is offered. The تمام / منيح card is listed
  under "Not in any phrase yet", and the كيف card is not counted as a
  word at all.
- **A deck's own In context section:** both words are counted as phrases
  and left out of its word list.
- **The editor's check of a sentence's words:** "أنا تمام" is said to
  hold a word no card teaches (تمام).
- **A learner's own Add screen** links the lines of a conversation to
  their words the same way, and misses these words too (read, not probed).
- **The quality score** has read each answer on its own since 0.463, so it
  credits the linked sentence. **The score and the gap-fill now
  disagree:** the score says the word is practised in that sentence, and
  the student never gets it. One spot in the score was also missed: a
  verb's own sentences still read the verb's answers whole.

### Finding 5. "Word or phrase" decided by counting spaces, ignoring the word type (*probed*)

Three places guess whether a card is a word from its text alone and never
look at the word type the teacher picked:

- **"Words this teaches"** in the editor
- **the editor's check of a sentence's words**
- **a deck's own In context section**

A text with a space in it reads as a phrase. So **every Vietnamese word of
two syllables** is missed: cà phê, a noun card, is never offered and
never counted (*probed*). So is every word card with two accepted
answers, because the separator counts as a space. The app's main
word-or-phrase check was changed to put the teacher's word type first,
for exactly this reason, and its comment says so. These three were not
changed with it.

This is separate from the open question about cards with **no** word type.
Here the teacher answered the question and the answer is ignored.

### Finding 6. A form with two answers counts as recorded when only one is

The score's recording and pronunciation checks look at the form as a whole,
and a form counts as recorded when any of its answers has a recording.
Since recordings became per answer, the voice a question plays is the
answer's own, so a second answer with no recording has no voice. The score
does not say so. This is minor, and it is the same "read the whole and not
each answer" pattern as finding 4.

## Decisions for the owner

1. What should happen to the switched-off conversation rule and the words
   written about it?
   a. Take it out of the changelog, DECISIONS.md and the pull request, and
   keep the rule quietly as a safeguard for odd imported files.
   b. Remove the rule and its test as well.
   c. Leave everything as it is.
   *Recommended: a. The words mislead and the rule costs nothing.*

2. Words with several accepted answers: how should the gap-fill and the
   teaching screens find them?
   a. Read each answer on its own, as the score now does, so these words
   are practised in sentences and offered, linked and counted everywhere.
   b. Make the score stop crediting them for now, so it agrees with what
   students get, and fix the rest later.
   c. Leave it.
   *Recommended: a. Teachers already link these words, and students are
   missing the sentences.*

3. When a gap's word accepts several answers, what may the student type?
   a. Only the answer the sentence actually holds.
   b. Any of the word's accepted answers.
   *Recommended: a. The sentence was written and recorded with that answer.*

4. Should the three places that ignore the word type use it?
   a. Yes, the teacher's word type first and the guess only when there is
   none, as the app's main check already does.
   b. Leave them.
   *Recommended: a. It is the fix the app already chose once; these three
   were missed.*

5. Should the score count a form with two answers as unrecorded until each
   answer has its own recording?
   a. Yes, and the same for pronunciation.
   b. No, one recording on the form is enough.
   *Recommended: a. A question asking for the second answer has no voice to
   play.*

The open question about cards with **no** word type still stands, and is
narrower once 4a is done: it would then only concern cards where the
teacher never picked a word type.

---

## Technical notes (for the build)

- Switched-off conversations: `writtenCard` in `src/card-editor.tsx` sets
  `drill: written.some(partAsked)`. `SceneEditor` draws no `FormBlock` or
  `NothingAsked`, so a scene's lead form is never `ask: false`. The server
  stores `drill: card.drill !== false` (`server/api/courses.js`). The rule
  is `practised` in `src/deck-quality.ts`, and the test is "a conversation
  switched off is no sentences and no conversation".
- Several answers read whole (finding 4): `buildContextIndex` and
  `wordsOffered` (via `bestWordIn` with `unit.ar`) in `src/context-index.ts`;
  `textOf` in `src/context-links.ts` (`pairsIn`, `unknownWords`, `bare`);
  `contextCoverage` in `src/languages.ts`; `sentenceWords` in
  `src/sentence-words.ts`; `usesIn` in the learner's add screen in
  `src/ArabicTrainer.tsx`; and the own-slot credit in `deckQuality`, which
  calls `findWordSpan(s.ar, f.ar)`. The splitter to reuse is `splitForms`
  in `src/languages.ts`, as `answersIn` in the score does.
- Word type ignored (finding 5): `guessKind(lead)` in `wordsOffered` and
  in `sentenceWords`, and `c.kind || guessKind(...)` in `contextCoverage`.
  `kindOf` in `src/languages.ts` is the reading that puts `category` first.
- Recordings (finding 6): `packAnswers` in `src/answers.ts` stores a form's
  `clips` as the union of its answers' clips; `recorded` in
  `src/deck-quality.ts` reads the form.
- The probes are small scripts that build the cards described and call
  `buildContextIndex`, `wordsOffered`, `linkReport`, `sentenceWords` and
  `contextCoverage` directly. Each finding above states the results.
