# Backlog

Work that is wanted and not started, each with why it waits. One entry per
item, newest last. An entry leaves when it ships, or when a decision says
it never will.

What is *not* here: anything already being worked on, and anything nobody
has actually asked for. A wish is not a backlog item until somebody can
say what it would change for the people using the app.

These lived in a proposal's *open questions*, an audit's *what to do next*
or a *revisit if* line in `DECISIONS.md` before this file existed. Those
are still where a reason belongs; this is where the item goes so it can be
found without reading the reason first.

---

## A speaker to read the Hebrew clock

`tests/golden/he-IL.times.json` says in its own note, and in a test, that
nobody who speaks the language has read it. Every row in it is what the
composer says given the words in the fixture, and the dozen rows where two
answers are both plausible carry a line saying what the other one would be.
The Arabic table is in the same position and says so too.

The words are the claim; the rows are arithmetic over them. So a speaker
correcting the words fixes their own screen and nothing here has to change,
which is the point of the lexicon being data — but the table should stop
being a set of hypotheses at some point, and `reviewedBy` is where it stops.

## Telling the time in Huế Vietnamese

Numbers, yes; a clock, not yet. Nobody has written down how the language
does it, and the composer registry answers `null` for it, which the app
already handles everywhere: the Time tab says the language has no clock.
Waits on somebody who teaches it.

## Text-to-speech for a number nobody recorded

A rendered number with no recording could be spoken by the device. Waits on
two answers nobody has: which voice per dialect, and whether a synthetic
voice is a thing this app wants a learner to imitate. The audio policy
stays *components only* until then — one clip per word, and a time may play
its two pieces one after the other.

## Deleting the old number cards

The migration marks them `derived` and deletes nothing: a card carries
recordings and somebody's progress, and clearing a box was never a way of
asking for either to be thrown away. A learner's schedule on one has
already been handed to the card that replaces it. One release from now they
can go, with their recordings kept as clips the system points at.

## Counting the nouns a teacher already wrote

The counting exercise draws its nouns from a short list written in the
number system rather than off the cards. What blocked that was the axis:
no card could say a word was a pair. It can since 0.207 — a noun's
accepted answer may be marked dual, and an adjective beside it takes the
right form — so what is left is the reading. The curated list then becomes
the fallback rather than the source, and a counting question asks about
words the learner is already being taught.

## A transliteration a number can be built out of

A word in a system may carry a transliteration per face, and the composer
does not join them — so a range has no *transliteration → script* question,
which is the level-3 exercise every ordinary card gets. Wants the same
answer the script gets, through the same composition.

## Hebrew's ten thousand

`scale` gives the bound form to three through nine and counts ten the
masculine way with the singular after it, which is what the app has said
since 0.152 and what the port kept deliberately. The written language would
have the bound form there too. A correction for whoever reads the Hebrew
table, because changing it changes what an existing learner sees.

## A preview each language chooses

The list of numbers under *What a student will be asked* is one list for
all three languages, chosen by eye to cover the shapes any of them can get
wrong. It is Arabic-shaped, and it shows: the unit that changes after two
tens is a Huế rule, and it is in there because somebody remembered, not
because Huế asked for it. A composer already declares which boxes it needs
and which ranges it can build; which numbers are worth showing is the same
kind of answer and belongs beside them.

## One system per course

A teacher of two courses in one language who wants different words in each.
No known ask; the per-teacher rule stands until there is one.

## Ordinals, fractions, dates, currency

Out of scope by decision for the first version of the number system. Each
is a composer of its own over the same lexicon, which is the shape that
makes them cheap later and was worth designing for now.

## Stitching audio inside a number

Playing *forty* and then *seven* as one clip. Declined for the first
version: the joins are where a dialect's sandhi lives, and a stitched clip
teaches a sound nobody makes. A time is the one exception and plays two
recorded pieces, which are two words and not two halves of one.

## `Doc.version` is written and never read

The lifts key on the shape of what they find, which is what makes them safe
to run twice. The version field is written on every save and read by
nothing. Either give it a meaning or drop it.
