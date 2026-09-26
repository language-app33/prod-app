# Proposal: a pronoun that reads three ways in English

**Status: built in 0.250.** One change from what is below: a teacher's
own readings are kept on the pronoun's card rather than on its word, beside
the person it is, and are stored only where they differ from the automatic
ones.

Palestinian Arabic says *I am tired* without any word for *am*: أنا تعبان
is *I* and then *tired*, and the *am* is understood. Hebrew does the same.
The app does not know that, and two things go wrong in sentence frames
because of it.

## What is wrong

**1. A frame cannot say whether its pronoun means "I" or "I am".**

A sentence with a pronoun blank in it — `{{pronoun}} تعبان` — is filled
from the pronoun cards written on the Pronouns screen, and each of those
carries one English: *I*, *you (m)*, *he* and so on. So the frame's English
comes out as *I tired*, *he tired*, *they tired*. A teacher who writes the
verb into the frame instead — `{{pronoun}} am tired` — gets *I am tired*
once and *he am tired*, *they am tired* the other seven times, because the
frame's words are fixed and only the blank changes. There is nowhere to say
"here the pronoun stands for *I am*".

**2. In a question, English turns the pair round and Arabic does not.**

*I am tired* becomes *am I tired?*; *you are* becomes *are you*. Arabic
keeps the same order and raises the voice: إنت تعبان؟ is *are you tired?*
with nothing moved. So even with the first problem solved, a frame written
as a question would read *you are tired?* in English, which is not the
question anybody is being taught to ask.

Both come down to the same fact: one Arabic word answers to three English
phrasings, and a frame can only ask for one of them.

## The proposal

**Every pronoun carries three English readings, and a frame has three
blanks to ask for them.**

| the blank | reads as | Arabic in it |
|---|---|---|
| `{{pronoun}}` | *I* · *you (m)* · *he* · *she* · *we* … | أنا · إنتَ · هو · هي · إحنا … |
| `{{pronoun-is}}` | *I am* · *you are* · *he is* · *she is* · *we are* … | the same words |
| `{{is-pronoun}}` | *am I* · *are you* · *is he* · *is she* · *are we* … | the same words |

The Arabic and the transliteration are filled with the same word whichever
blank is used. Only the English differs, which is exactly the difference
the teacher needs to express.

So the three frames a teacher actually wants become writable, and each one
reads correctly for all eight pronouns:

| the frame | filled with أنا | filled with هي |
|---|---|---|
| `{{pronoun}} من فلسطين` · `{{pronoun}} from Palestine` | *I from Palestine* — as today, wrong | *she from Palestine* — wrong |
| `{{pronoun-is}} من فلسطين` · `{{pronoun-is}} from Palestine` | أنا من فلسطين · *I am from Palestine* | هي من فلسطين · *she is from Palestine* |
| `{{is-pronoun}} من فلسطين؟` · `{{is-pronoun}} from Palestine?` | أنا من فلسطين؟ · *am I from Palestine?* | هي من فلسطين؟ · *is she from Palestine?* |

The plain `{{pronoun}}` stays for the sentences where the pronoun is just a
pronoun — *I like coffee*, *he ate* — where the verb is its own word and
the blank should not bring an *am* with it. A verb standing in the same
sentence still takes the form that goes with the pronoun, whichever of the
three blanks the pronoun came through.

### Where the English comes from

The Pronouns screen gets two more English boxes on each row, beside the
one it has:

| | Arabic | English | with "to be" | as a question |
|---|---|---|---|---|
| I | أنا | I | I am | am I |
| you (m) | إنتَ | you | you are | are you |
| he | هو | he | he is | is he |
| … | | | | |

They come **already filled in** with the ordinary English, so for most
teachers this is a glance and not sixteen boxes to type. They can be
changed — a teacher who prefers *I'm* to *I am*, or *you're*, writes that
instead, and the frames follow. As with everything else on that screen,
it is written once per language.

Nothing on the pronoun's own card changes for the student: أنا still means
*I*, and is still practised as one word.

### What a teacher does

- Opens Pronouns, checks the two new columns, saves. A language whose
  pronouns are already written needs nothing else: the readings are filled
  in for it.
- In a sentence, the blank sheet offers *pronoun*, *pronoun is* and *is
  pronoun?* as three chips wherever it offered *pronoun* before, with a
  line under each saying what it reads as.
- Sentences already written are untouched. `{{pronoun}}` goes on meaning
  what it meant, and a teacher who wants a frame to read *I am* changes
  its blank, which is one tap.

### What a student notices

Only that the English is right. A question that used to read *I tired* or
*he am tired* reads *I am tired* and *is he tired?*, in the prompt, in the
choices, and on the answer screen. Nothing else about how sentences are
asked, marked or scheduled moves.

## What this does not cover

- **Negatives.** *I am not tired* is أنا مش تعبان, and *not* is its own
  word a frame can already carry: `{{pronoun-is}} مش تعبان` reads *I am
  not tired* once the teacher writes *not* into the English. So it works,
  but through the frame rather than through the pronoun, which is fine.
- **The past.** *I was tired* is كنت تعبان — a verb, with its own card
  and table. Nothing here is about it.
- **An adjective agreeing with *I* or *you*.** A woman saying *I am tired*
  says أنا تعبانة. Today a frame can only make an adjective agree with
  *he*, *she* or *they*, because *I* has no gender written on it. That is
  a real gap, a separate one, and worth its own proposal.
- **Hebrew** gets all of this for free, since it writes its pronouns on
  the same screen and drops *to be* in the same places.

## What it costs, and how it will be checked

Small. Two boxes per row on one screen, two chips in one sheet, and the
rule that fills a blank learning two more names. About a day, and nothing
stored has to be rewritten: a pronoun written before this reads as it does
now until its readings are saved, and the readings are pre-filled so that
save is one visit.

Checked by unit tests on the filling itself — each of the three blanks,
with each pronoun, in all three fields — the smoke harness, and `npm run
check` green before it goes to `beta`. The worked example above, in
Palestinian Arabic, is the one to try by hand.

## An alternative, and why not

The reading could instead be a setting on the blank — tap the `pronoun`
chip in a frame and pick *as itself / with "to be" / as a question* — the
way a verb blank can already be narrowed to a tense. It was passed over
because the frame would then not say what it reads as: two frames with the
same words in them would read differently and look the same in the card
list. A name in braces is what the app already uses for every other
distinction a blank makes — `{{noun}}`, `{{colour-red}}`, `{{word}}` — and
`{{is-pronoun}}` says what it does to anyone reading the card.

## For the build

Kept short, and separate from the above.

- `pronoun-is` and `is-pronoun` are reserved names, in the way `word` is:
  `refClash` refuses them for a card's ID or group tag, and `fillsOf`
  adds them for every card of the Pronoun kind, so the pool that fills
  them is the same eight cards that fill `pronoun`.
- The two readings are stored on the pronoun card's own form, beside its
  `en`, as two more fields — not as sub-forms, for the reason the
  decision on accepted answers gives: *I am* is not a second thing to
  learn. The Pronouns screen writes them; the pack supplies the defaults
  per person (on `SUBJECT_PERSONS`, so Arabic and Hebrew share them).
- `valuesFor` hands the reading the slot asks for: the value lent to
  `pronoun-is` has the *with "to be"* English in `en`, `is-pronoun` the
  question, and both keep the card's `person`, so `personFor` and the
  verb's agreement are untouched. A card whose reading is empty lends its
  plain English, which is what today's cards would do.
- The blank sheet offers the two chips only where `hasPronouns` is true;
  `slotTrouble` needs no change, since a name is a name in all three
  fields.
