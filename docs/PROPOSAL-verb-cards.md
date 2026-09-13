# Proposal: verb cards

A card today is one thing to know: a word, its meaning, how it sounds. A
verb is not one thing. *To eat* in Arabic is a dozen words depending on who
is eating and when; in Vietnamese it is one word with a marker beside it;
in Spanish it is fifty. What a learner needs is not the dictionary form but
the form that fits the sentence they are about to say — and no exercise in
the app asks for that.

This proposes a **verb card**: one card that holds a verb's forms in a
table, and exercises that ask for a cell of that table rather than the
whole. Nothing about it assumes what a language's table looks like.

## The idea in one picture

A teacher writing *to eat* fills in a grid instead of a line:

|              | I      | you (m) | you (f) | he     | she    | we     | they   |
|--------------|--------|---------|---------|--------|--------|--------|--------|
| **present**  | باكل   | بتاكل   | بتاكلي  | بياكل  | بتاكل  | بناكل  | بياكلو |
| **past**     | أكلت   | أكلت    | أكلتي   | أكل    | أكلت   | أكلنا  | أكلو   |
| **command**  |        | كول     | كولي    |        |        |        | كولو   |

The rows and columns are the language's, not the app's. Vietnamese would
have one column and a row per marker (*đã ăn*, *đang ăn*, *sẽ ăn*).
Spanish would have six columns and as many rows as the teacher wants to
teach. A cell can be blank — no command for *I* — and that is simply a
form the language does not have.

Every cell has its own English, but the teacher does not write it
seventeen times. A row gets its English once, and a cell says otherwise
only where English differs:

|             | English                   |
|-------------|---------------------------|
| **present** | eat · *he, she:* eats     |
| **past**    | ate                       |
| **command** | eat!                      |

The pronoun is the column's. What the learner is asked is the two put
together — *she eats*, *you (f) ate*, *you (m): eat!* — and never *to
eat · she · past*. Keeping the pronoun out of the cell is what lets a
frame supply its own subject, below.

## What the learner sees

Two kinds of question come out of the table.

**Give the form.** The learner is shown a cell's English and writes the
form:

> **she ate**
> ______

Or, in the other direction, a form is shown and the learner picks its
meaning from among the verb's other cells:

> **أكلتي**
> ○ she ate · ○ you (f) ate · ○ you (f) eat · ○ they ate

**Use it in a sentence.** The existing fill-the-gap exercise already shows a
phrase with a word missing. A verb card lets the gap ask for the *right*
form: a teacher writes "Yesterday she ___ an apple" with the gap pointing
at *to eat*, and the learner is marked right only for *she · past*. This is
the exercise that makes the table worth learning, because it is the one
that happens in conversation. With holes in it, one such sentence becomes
many — see *Verbs and variables* below.

Each cell is asked and scheduled on its own, the way each word in a matching
grid already is. A learner solid on the present and shaky on the past sees
the past more often, without the present being dragged along.

## How it stays language-agnostic

Every language already declares its own grammar in one place: Arabic
says its words carry number and gender, Vietnamese says nothing declines.
A verb table is described the same way. Each language names its **person**
choices and its **tense or aspect** choices, with whatever labels it uses
and in the order it teaches them, and the app builds the grid from those
names and asks about them by those names. A language with no persons has a one-column table. A language that
distinguishes formal and informal *you* has more columns. The app never
needs to know what a tense is; it needs to know that the table has rows
and columns, and that a cell is one thing to learn.

Teachers who prefer to think in words can still write "you (f) · past" as a
plain sub-form of the card, as they do today. The table is a tidier way to
write the same forms and the only way to get the *which form?* questions.

## Verbs and variables

A card may already leave a hole in itself — *My name is {{name}}* — and
other cards fill it, a different one each time. A verb card carries a
sentence of its own in the same way, with the verb's place marked and
holes around it:

> *{{name}} [verb] {{object}}*
> → Sarah ate an apple · Ahmad ate bread · the children ate fish

The verb is the card. The holes are filled from other cards, as today,
and **the verb's form follows what fills them.** Sarah is singular and
feminine, so the verb is *she*: أكلت. Ahmad makes it *he*: أكل. The
children make it *they*: أكلوا. Nothing has to be added to a name for
this to work — its number and gender are already recorded on it, because
the app records them on every answer. The object changes the sentence and
not the form.

A sentence can be tied to a row — *Yesterday {{name}} [verb] {{object}}*
wants the past — or left free, and a free sentence is asked in whichever
rows are open. Either way the learner is asked in English, *Yesterday
Sarah ate an apple*, *The children eat fish*, and the English agrees too,
because each cell carries its own.

Which hole decides which axis is the language's to say, the same way it
names its rows and columns. Arabic says the subject's number and gender
pick the column. Vietnamese says nothing does. A language whose verb
changes with its object — Hungarian, where *I see a house* and *I see the
house* end differently — says the object's hole picks that axis. The app
knows only that a filler has properties, a table has axes, and the
language has said which reads which.

It is asked with the exercises the app has: fill the gap, with the
sentence up and the verb's place empty — *مبارح سارة ___ تفاحة* — or
English → script, writing the whole sentence. The fillers rotate as
variables do today, so the same sentence comes round as *she*, then *he*,
then *they*, and cannot be answered by shape. Each turn asks one cell and
credits that cell. A filler is dealt only when the cell it would call for
is open, so a plural name waits until *they* has been met.

## Where it fits on the ladder

The verb card's dictionary form climbs the four levels like any word, so a
learner meets *to eat* and knows what it means before any cell is asked.
Once it is graduated, cells open on the same ladder: picking a form's
meaning from the verb's other cells is recognition and sits at level 2;
writing the form from its English is production and sits at level 3;
producing it inside a phrase is level 4. A lapse on the base word closes the cells above it, as a lapse
does everywhere.

## Tenses open one after another

The rows are not all as hard as each other, and they should not arrive
together. A learner who can say what they *do* has something to build the
past on; one handed present, past and future in the same week has three
tables to confuse.

So a verb's rows open in turn. The first row is dealt as soon as the base
word is known. The next is dealt only once the row before it is
**mastered** — every cell in review and a good way out, the same bar a
level asks of the level below it. The past of *to eat* is not asked until
the present of *to eat* is known well, and the future waits on the past. A
lapse in the present closes the rows above it until it is recovered, as a
lapse does on the ladder.

Which row comes first is the language's call, not the app's. Each
language lists its tenses in the order it teaches them — present, past,
future for Arabic; the bare verb, then its markers, for Vietnamese — and
the app knows only that there is a first row and a next one. A teacher who
wants a row held back longer leaves it blank and fills it in later.

Within a row, cells are dealt in the order the language lists its persons,
so *I* and *you* are met before *they*. That order is not a gate; the row
is. Only one tense of a verb is ever new at a time.

## What a first version would leave out

- **Compound forms** (*would have eaten*): a cell holds a string, and a
  teacher who wants to teach these types them in. The app does not build
  them.
- **Deriving forms from a pattern** ("regular verbs go like this"): every
  cell is written by hand. Generating tables is a later, separate step and
  should not decide the shape of the card.
- **Recordings per cell**: a card has recordings today; a cell would use
  the card's until per-cell recording is worth the work of recording it.

## Open questions

- Should a cell be told apart from a spelling slip? Writing *he ate* when
  *she ate* was asked is a different mistake from a missing vowel mark,
  and probably deserves its own verdict ("Right verb, wrong person").
- How many cells is too many to introduce at once? A row at a time keeps
  the tenses apart, but seven persons in one session would still swamp it;
  a cap of two or three new cells per verb per session seems right to
  start.
- Is a pronoun a word to learn? A learner asked *she ate* is never shown
  the language's own word for *she*. Showing it beside the English, once
  the pronoun card is known, would join the two.
- Where English does not tell two cells apart — *you (m) eat* and *you (f)
  eat* — the column label does the work. Is that enough on a small screen,
  or should the cue say *to a man* and *to a woman* in words?
- Could one sentence serve several verbs? *{{name}} [verb] {{object}}*
  fits *eat*, *drink* and *buy* alike. A sentence a deck shares, with the
  verb as one more thing slotted in, would be the same rule again. Left
  out of a first version so that the card stays what carries its
  sentence.
- What fills a hole when no filler has the right properties? A sentence
  whose only names are women's can never ask *he*. The editor could say
  so when the sentence is saved, as it already does when the fields'
  holes disagree.
