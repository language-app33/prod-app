# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

## 0.230 — 24 September 2026

**The subtype button is lettered like the deck button.**

**Not set** — and whatever subtype is chosen — is now written in the
same size and weight as **Add this card to a deck**, with the same
room around it, so the two read as the same kind of button.

## 0.229 — 24 September 2026

**The subtype button says Not set, and is full height.**

On a card whose subtype hasn't been chosen, the **What subtype** button
now reads **Not set** instead of *Not said yet*. It is also as tall as
the **Add this card to a deck** button, so it is as easy to tap.

## 0.228 — 24 September 2026

**The card's tags, evenly spaced.**

In **The card's tags**, **Default tags** now stands clear of the line
above it, **Custom tags** stands clear of the pills above it instead of
touching them, and each heading's explanation sits close under the
heading with the same step before whatever follows — the pills, or the
box that creates a tag. The default-tag pills are roomier.

## 0.227 — 24 September 2026

**Default tags look like blanks.**

The tags listed under **Default tags** on a card now wear the same
gold pill a blank wears when it is put into a sentence card — without
the cross, since these can't be taken off.

## 0.226 — 24 September 2026

**Blanks is now Filling blanks.**

The section of the card editor that was headed **Blanks** is headed
**Filling blanks**. On a word that doesn't fill any blank yet, the line
beside the heading now reads *How this card can be used to fill blanks
in sentence cards*.

## 0.225 — 24 September 2026

**A card's tags, tidied.**

What was called **group tags** is now just **tags**, everywhere: the
section on the card editor, the card's details, the blank picker and the
questions about renaming a tag or taking one off every card.

Under **Default tags** the editor now shows only the tags this card
actually has — its kind of word, and *word* for any single word —
instead of every one in the language. They are shown as plain labels,
with no tick and no border, because they can't be switched on or off:
they follow from the kind of card.

**Your own tags** is now **Custom tags**, and the box for creating a
new one sits right under that heading instead of at the top of the
section.

## 0.224 — 24 September 2026

**The group tags on a card say what they are, where they are.**

Under **The card’s group tags**, the opening line is now *Tag this
card. Wherever another card has a blank for one of these tags, this
card can fill it.*

Each list of tags is explained right under its own heading rather than
after its rows: **Default tags** says *These follow from the kind of
card this is*, and **Your own tags** says *Apply a custom tag that
already exists, or create a new one in the box above.* The longer notes
these replace, one of which sat at the foot of the section, are gone.

## 0.223 — 24 September 2026

**Plainer words in the Blanks section.**

On a word that fills no blank yet, the line beside the **Blanks**
heading said *a gap this card leaves for another word*, which described
only half of what the section is for. It now reads *gaps in sentences,
and the cards that fill them*.

The line under **The card’s ID** is one sentence now: *Optional. A name
for reaching this one specific card from another card’s blank.*

## 0.222 — 24 September 2026

**No empty Forms section on a verb.**

A verb whose dictionary form is one of the boxes of its table showed a
**Forms** heading under the table with nothing beneath it: its word is
written in the table, so there was nothing left for the section to hold.
The heading is gone on those verbs. A verb that still carries a form of
its own from before its table shows it there, as before.

## 0.221 — 24 September 2026

**A verb card no longer explains what a verb is.**

Creating or editing a verb, the box for its name used to carry a
paragraph about why a verb needs one, and a saved verb ended its first
section with a line about its table and how emptying it makes it a word
again. Both are gone. The padlock on its subtype still says it cannot be
changed while the card carries its table, and a card whose name is
missing still says so under the box.

Adjectives and nouns with a table, and sentences, keep their lines.

## 0.220 — 23 September 2026

**An exercise says which shape of an adjective it wants again.**

Since an adjective's feminine, plural and dual became its own sections,
a question asking for one of them said only what the word means — *big*
— which is exactly what the masculine answers too. Writing the masculine
was marked wrong for knowing the word, and there was no way to tell
which was wanted. Those shapes had stopped carrying a gender or a number
of their own: which one each is, is where it sits on the card, and
nothing that names a question was reading that.

So the question says it again, in the language's own words: **feminine**,
**plural**, **dual** in Palestinian Arabic, **feminine**, **masculine
plural**, **feminine plural** in Hebrew. The word itself says
**masculine** wherever one of its other shapes could answer the same
question, and the match-the-pairs grid tags each shape of one adjective
the same way when two of them are on it. The card list names each shape
by its section rather than calling it *form*.

Nouns, verbs and the pronouns on the end of a word are unchanged: a noun
still says *sg. f.*, and a verb's forms say which they are in their
English.

## 0.219 — 23 September 2026

**Cleared says what a card is waiting for.**

Open **Cleared** on Progress and there is now a line at the top: *It
takes 2 reviews to move a card from Cleared to Learnt.* That was said on a
card's own screen and nowhere in the list.

Each card under Cleared now names the review it is waiting on: *First
review in 3d*, *Second review in 5h*, *First review due now*. First until
a card has made one of its two, second after.

**And the time beside it is that review's.** It used to be whenever the
card was next asked anything at all. A cleared card is still asked its
easier questions now and then, and those can come round sooner, but they
do not move it any nearer Learnt. Only the hardest question it has counts,
answered right when it comes due. So a card whose easy question is due
tomorrow and whose hard one is due on Friday now says Friday.

**Learnt is unchanged.** There is nothing left to count there, so each
card still says when it is next asked: *Next review in 3d*.

Nothing about how cards are scheduled has changed.

## 0.218 — 22 September 2026

**Nothing you can see; the tests the audit asked for.** 0.215 published a
note on the checks that run before every deploy: what they cover, and
whether they would actually go red if the thing they are about broke. This
is the work it proposed, all of it. There are 1,029 automated checks now
where there were 950, and the walk that drives the whole app end to end
makes 744 where it made 703.

What was missing, and now is not:

- **The phone's side of syncing.** Merging two devices' work was tested
  thoroughly; the part that fetches, merges, sends back and tries again
  when another device got there first was tested by nothing, and neither
  was what the app does when the server says no. That is the corner the
  worst bug in this app's history lived in. Every refusal the server can
  give now has a test saying what the app does with it.
- **Ten things the server can be asked** that nothing had ever asked it,
  among them a teacher deleting a deck and a teacher taking one out of a
  course — the two the September audit found destroying students' work.
- **Numbers and times as questions.** The words were checked against a
  table a speaker signed; the questions built from them never were. Now a
  session is dealt from a teacher's number document, the answers are
  marked, and a number is met on screen.
- **Four screens nothing had ever drawn**: the way into the app for
  somebody new, the three settings screens, a number question, and putting
  a conversation back in order.
- **The one check that an answer had been saved.** It was reading the
  shape cards were stored in three versions ago, so it compared nothing
  with nothing and would have passed with saving switched off. It now
  follows the answer to the disk.

Two small things in the app changed along the way: setting a course's
language no longer accepts a blank one made of spaces, and two pieces of
the server that could never run — older copies of closing an account and
of removing somebody, left behind when the two were made to share one
routine — are gone, so the file no longer says two different things about
what either does.

## 0.217 — 22 September 2026

**The forms of a card are one section, and each of them is a panel in it.**

Every form on the card screen was a section of the screen in its own
right: its name set at page-heading size, standing outside the box its
fields were in, with a rule between one form and the next. On a card with
four of them that was the screen announcing four subjects where there is
one word.

There is a **Forms** heading now, at the size the card's other sections
are headed, and under it the forms are panels — the name **inside** the
panel and a size down, the two field names under it (*Arabic*, *English*)
a size down again, and nothing drawn between one panel and the next.

**And the record button moved up.** It sits at the right of the form's own
name, where Duplicate and Remove already were, rather than under the
pronunciation. A form with two accepted answers still keeps one button per
answer, beside the word it is of — there the button has to say which of
the two it records, and a button up in the heading could not.

**One line fewer under a heading.** The rule between *How this card can be
practiced* and the ticks below it was drawing a line between a heading and
the thing it heads; the rule that separates one group of ticks from the
next is still there.

## 0.216 — 22 September 2026

**Every shape of a word is a section of its own, named in the language.**

A word and the shapes it takes beside a noun are the same kind of thing,
and the screen has spent five releases saying otherwise in different
ways: a heading further down the page, full blocks that took three
screens, a short list that made them look like something less than the
word, and then the word folded into that list, which cost it a second
accepted answer.

They are four sections now — in Palestinian Arabic **Masculine**,
**Feminine**, **Plural**, **Dual**; in Hebrew masculine, feminine,
masculine plural and feminine plural — and each is written in exactly the
fields the word is written in. That means each one now has what only the
word had: **a second accepted answer**, and **a recording of its own per
answer**. If the feminine has two acceptable spellings, you can write
both and record each.

What made that affordable is that the boxes got short two releases ago.
Full blocks were right in principle and unusable in practice while each
of them was a screen high; at the size they are now, four sections fit
where two used to.

**And the word is called what it is.** It was *Form 1*, then *The main
form* — the app naming its own layout while the three boxes under it were
named after the language. It is **Masculine**, out of the same place the
other three names come from, so a language that arranges its adjectives
differently says so itself.

**The line under the heading is gone.** It explained where the word's
other shapes were written; the four headings say that, in fewer words and
in the language's own.
## 0.215 — 22 September 2026

**Nothing you can see; an audit of the tests.** `docs/AUDIT-tests.md` asks
two things of the checks that run on every push: does every part of the
app that matters have a test at all, and would the test go red if the
thing it is about broke? The second was answered by breaking the app on
purpose, about five hundred times, one small change at a time, and
counting how often the tests noticed.

Where the app's rules live — the ladder, cleared and learnt, what being
due does, the caps on new words, the typo and the letter-by-letter
marking, blanks, verb tables, the numbers and the clock — they are well
tested and the tests bite. The gaps are at the edges: the phone's side of
sync (fetch, merge, send back, retry) has no test although the merge does;
ten of the server's forty-six actions have none, among them a teacher
deleting or detaching a deck; the number and time questions are never
asked in any test; and several screens have never been rendered by one —
signing up, Settings, the admin space, joining a course, putting a scene
in order. The note ranks them, says what each would cost to close, and
proposes a fix round of about two days. Nothing in the app changed.

## 0.214 — 22 September 2026

**The word is written in the same boxes its other forms are.**

0.213 made the three boxes under the word one height, and picked a height
of its own — taller than the three under each of the shapes beside it. So
a card read as one kind of field up top and a smaller kind below, when it
is one list of forms either way. They are the shorter height now, the one
the other forms have always had, and the two are written from one number
so neither can drift.

**And the record button is a little larger.** It is the one thing on that
line that opens another screen, and at the grammar button's size it read
as the smaller of the two rather than as the one to press.

## 0.213 — 22 September 2026

**Three boxes of one size, a box that says what goes in it, and a
recording that knows which word it is of.**

**The heading over the word is the language now.** It said *Arabic script
and transliteration*, which named two of the boxes under it in a place
meant for one name, and still left the box itself blank. It says
**Arabic** — or Hebrew, or Vietnamese — and the box says the rest, in the
language: **العربية** stands in it while it is empty, and **עברית** and
**Tiếng Việt** in the other two. A heading is not a label, and a box with
nothing in it was saying nothing about what goes in it.

**The three boxes are one height.** The word, how it is said, and what it
means were sized by their own type — twenty-two point, fourteen, eighteen
— and three boxes of three heights read as three kinds of field rather
than as one answer written three ways. The type sizes stay, because that
is what says which of them is the thing being learnt. Only the boxes
agree. A sentence card keeps fields that grow, because its blanks wrap.

**And a recording belongs to the accepted answer it is of.** It was a
field of its own, level with the English, which said a recording was a
third thing a card has beside its word and its meaning. It is not: it is
the word, said out loud. So it sits under the answer, beside that
answer's grammar, and a card that accepts two spellings can record both —
**مبسوط** in one voice and **مبسوطة** in another, which is exactly the
card that had one set of clips over the pair and played the wrong one
half the time. A question about one of them now plays that one's
recording, or none, rather than whatever was there.

**Nothing you have already recorded moves or is lost.** A card written
before this keeps its recordings where they are, every accepted answer on
it reads them, and a card with one answer — which is nearly all of them —
is unchanged in every particular.

## 0.212 — 22 September 2026

**The word gets its fields back.**

0.211 folded a word and the shapes it takes beside a noun into one list,
four rows all written the same way. It read well, and it took two things
off the word that only its own block can hold: the **+** that accepts a
second spelling, and the list of its recordings. A card that accepts two
answers is not a corner case in this app — it is what the whole idea of an
accepted answer is for — and *type them yourself with a slash between* is
not the same offer as a button.

So the word has its block back, exactly as it was, and its feminine,
plural and dual are the short rows under **Its other forms** again.
Nothing is lost on either side of that line.

**One thing is kept from the attempt.** The line under the word now says
which shape of it this is — *the word this card is about — the masculine*
— because three boxes named feminine, plural and dual sitting under a
block called "the main form" was the screen naming its own layout rather
than the language. Each language answers for itself: Arabic and Hebrew
both say masculine.

Making the two blocks read as one thing is still worth doing. It is a
question of how they are drawn, and it will be answered there rather than
by dropping fields to get it.

## 0.211 — 22 September 2026

**A word and its forms, in one list, with the word finally called
something.**

0.209 made an adjective's feminine, plural and dual short again — one line
each, three boxes and a microphone. The word they are shapes of kept the
long format above them: its own block, its own headings, fields with names
across the top. One list written in two hands, with a border between them,
and nothing dividing them except which of the four the card happens to be
*about* — which the title at the top of the screen already says.

It is one section now, **The word and its forms**, and the word is the
first row of it, written exactly like the three under it.

**And it is called masculine**, because that is what it is. It has been
*Form 1* and then *The main form*, and both are the app talking about its
own screen: a row of boxes named nothing, beside three named feminine,
plural and dual, was the odd one out for want of a word that was there to
be said. Which word it is, each language now answers for itself — Arabic
and Hebrew both say masculine, and Hebrew reads down as *masculine,
feminine, masculine plural, feminine plural*, which is how the four are
written anywhere else. A language that does not say is left with *the
word* rather than a guess.

**What it costs.** The word loses two things the three shapes below it
never had: the **+** that adds a second accepted answer, and the list of
its recordings under the microphone. A second spelling is still written
the way it is written everywhere in the app, with a slash between them,
and a card that already has two is unaffected. The microphone opens the
same recording screen the button did.

## 0.210 — 22 September 2026

**The cards at the top of the ladder now say when they come back.**

Open one of the level tiles on Progress and each card carries a bar
saying how far through that level it is. Open **Cleared** or **Learnt**
and there was nothing — just a grid of words, every one of them looking
exactly like the next.

That was deliberate, and it was half an answer. A card under those two
tiles has finished every level it has material for, so the bar would have
been full on all of them: a column of hundreds telling nobody anything.
But it left a real difference invisible. A cleared card is waiting to be
asked again, and one coming back this evening is in a quite different
place from one that will not be seen for a month — and on that screen
they were the same tile.

So each card under Cleared and under Learnt now says when it is next
reviewed: *Next review in 5h*, *Next review in 3d*, *Review due now*. How
long away it is, rather than a date to count forward from, and in hours
while it is still hours.

Nothing about how cards are scheduled has changed. This is the app saying
out loud, in the list, what it already knew.

## 0.209 — 22 September 2026

**The other forms of a word go short again, and the word stops being
numbered.**

0.208 moved an adjective's feminine, plural and dual up beside the word,
which was right, and wrote each of them out in the same full block the
word gets — script, pronunciation, English, a recording button, all under
a heading apiece. That put three shapes of one word across three screens
and made them read as three subjects rather than as a list.

They are short again: **Its other forms**, one line each, a name over the
three boxes this app shows any form in, with the microphone beside them.
That is what they looked like before anybody moved them, and it is the
same set of boxes a verb's table is drawn with — written once now, so the
two places that show a form show the same thing.

And the word itself is no longer **Form 1**. Numbering the first of
something asks where the others are, and on a card like this there are
none to find: its other shapes are the list below. It is called **The
main form**, which is what the app has always called it everywhere else —
including in the practice section two blocks down.

## 0.208 — 22 September 2026

**A word and its other forms, written the same way.**

An adjective is one word and a handful of shapes of it, and the card
screen was saying so twice over in two different hands. The word came
first, in named fields — the script with its pronunciation, the English,
a button to record it. Then, under a heading of its own further down the
page, its feminine and plural appeared as a cramped grid of unlabelled
boxes with a microphone icon. Same card, same kind of thing, two formats,
for no better reason than that the grid began life holding a verb's
twenty-four cells.

**Three cells is not twenty-four.** So on any card that can hold only the
one form — an adjective in Palestinian Arabic and Hebrew — the forms it
takes beside a noun are now written *right after the word*, each in a
block of its own, in exactly the format the word is written in: its
script and pronunciation, its English, its recording. A verb's table and
the pronouns on the end of a word keep the grid, where a grid is the
right shape and a stack of blocks would be a mile of screen.

Each of those blocks says which form it is, and so does every box inside
it — *Arabic script for feminine*, *English for dual*. Three blocks of
identical fields under three headings would otherwise be a dozen boxes
called the same thing to anybody reading the screen aloud, and a heading
is not a label.

**And how a card is practised is now a question about the card.** The
ticks that say whether a form is asked on its own or lent to sentence
cards were tucked at the foot of the word's fields, under the heading
*How this form can be practiced* — which on a card with only one form was
the card, said as though it were another field of the word. They are a
section of their own now, called **How this card can be practiced**, and
where the card's other forms are written there are two answers in it
rather than one lost somewhere further down: one for the word, one for
the shapes beside it. Neither answer has changed; both are simply in the
same place.

## 0.207 — 22 September 2026

**A pair is a number the app can say, and an adjective stops inviting you
to do its table's job.**

**The dual.** Arabic and Hebrew both count in pairs — كتابين, שעתיים — and
until now no card could say so: a form was singular, plural, or not
applicable. **Dual** is now one of the answers wherever number is asked,
so a noun's accepted answer can be marked as a pair. Huế is not offered
it, because Huế is asked about no grammar at all.

**And what stands beside a pair now agrees with it.** In Palestinian
Arabic an adjective gains a third box — the form it takes beside a pair —
sitting beside its feminine and its plural. One box rather than a
masculine and a feminine one: written Arabic tells those apart and this
dialect mostly does not, and a box you leave empty is a question nobody is
asked. An adjective with it empty is simply not offered beside a dual
noun, which is the app withholding rather than guessing. Hebrew gains no
box, because a Hebrew adjective takes the plural beside a pair — its two
plural columns answer for the dual, which is the point: the dual is a fact
about the noun there and never about the adjective. Before this, a dual
noun matched no column at all and the adjective fell back to its
masculine singular — the one wrong answer that looks like an answer.

Nothing already written changes meaning: the new answer is added to the
end of the list rather than shuffled into it, so every form saved as
singular, plural or N/A reads exactly as it did.

**Three things on the card screen that were telling you the wrong story.**

Under the main form of every adjective, the app said *"You can add
additional forms (for different numbers, gender, etc) below"* — pointing
below at nothing, since that button was taken away from these cards long
ago, and offering to add forms for number and gender directly above the
table whose whole job is number and gender. That line now says where the
forms actually are.

It was not only wrong, it was actionable: **Duplicate** sat on the same
line and still worked, so the front door was shut and the side door left
open on every adjective in the app. A form outside the table is one
nothing can ever choose — it is drilled, it counts against the card being
learnt, and no sentence can use it. Duplicate is gone from cards whose
forms are a table. A card that already carries such a form keeps it, and
keeps its Remove: no new way in, and the way out stays.

And **an adjective in Huế** looked identical to *Something else*, because
nothing agrees in that language so there is no table to lay out. That is
true and it was silent, which is indistinguishable from the app having
lost something. It now says so, and says why answering still matters: it
is how a sentence knows what may stand in its blanks.

## 0.206 — 22 September 2026

**Two buttons that were off the side of the screen, and a number that
looked finished when it was not.**

*Try a number* and *Another* sat beside the title of the sample list, and
on a phone the pair of them ran past the right edge — visible in neither
sense: you could not read them and you could not tap them. The row of
buttons beside a heading only ever has room for one, so *Try a number* has
moved to where it belongs: its own full-width button directly under the
list of numbers, which is the thing it is about.

And while looking at that screen on a phone: a number the system cannot
say in full yet was showing whatever it managed as though that were the
answer. With *seven* written and *forty* not, 47 read as the word for
seven — the screen saying, in effect, that this is what your language
calls forty-seven. Those lines are greyed and marked **not yet** now. What
it managed is still shown, because that is what tells you which box to go
and fill.

**Nought is in the list.** The sample is one number per shape a language
can get wrong rather than a count — four and five say nothing three and
seven do not already say — but nought has a path of its own in every
language and had been left out of the very list that would have caught it
going wrong. It is there now, and so is one number that exercises a rule
only Huế has.

## 0.205 — 22 September 2026

**Three things the number screen was missing.**

**How a word sounds, beside the word.** Every box with something written
in it now asks for the transliteration too — a pronunciation note in Huế,
which is already written in Latin letters — on the same condition the
Record button appears on: there is a word here to say. It is not
decoration. What you type goes onto the card that word becomes, under the
script, so a student meets the pronunciation and the question that asks
them to write the word *from* its transliteration opens for it. The
clock's own words, each five-minute expression, each part of the day and
every number you wrote out by hand ask the same thing.

Nothing is joined up: the app will not stitch *forty* and *seven* into one
romanisation, because where the pieces sit against each other is a fact
about the script that it does not know. A number you wrote out yourself
has its own, entire.

**Writing a number out is its own screen now.** It used to unfold in place
under the list you tapped it from, which on a phone put the box you were
typing into below the fold with the whole grid scrolling behind it. Tap a
line and you get a screen: **what the app says now**, so you can see what
you are correcting, then what it should say and how that sounds, and one
button. Emptying the box and keeping it is how a correction goes away. The
numbers you have already written out are tappable the same way, to change
one or put it back.

**And a way to try the thing out.** *Try a number* beside the sample list
opens a screen where you type any number in figures and see exactly what a
student would be asked — the same words, not a preview of something else.
Where a number changes for the gender of the word beside it, both are
shown; every noun you gave it to count is counted with it; and a number it
cannot say yet says what it is waiting for rather than a dash. If it has
it wrong, the button at the bottom takes you straight to writing that one
out.

## 0.204 — 22 September 2026

**Numbers are a system you write once, and the app can now tell the time.**

Numbers used to be fifty-five cards with a number written on each, filled
in on a grid that wrote one card per box. That worked, and it could not
be taught to say *three books*: nothing in the app could hold the form a
numeral takes when it is standing in front of a noun, so nothing could
ask for it.

**For teachers: one screen, and a preview that is the real thing.** The
**#** in the Teaching → Cards toolbar now opens a **Number system** — the
words your language builds its numbers out of, with a box for each face a
word wears. In Palestinian Arabic that is the word you count with, the
two forms that go with a masculine or a feminine word, and the two that
go directly before a noun. Thirty-eight boxes rather than fifty-five,
because *one hundred*, *two hundred* and *the plural* replace nine
separate hundreds.

Under the boxes is a page of numbers said exactly as a student will meet
them, and it moves as you type. **Tap any line and you can write that
number out yourself** — which is the answer to anything the app gets
wrong, including the hundreds this dialect fuses into one word. Whatever
you write is used for that number and wherever it turns up inside a
bigger one.

Nothing has to be finished. A box nobody has filled is a gap, never a
blocker: the list at the top says what each stretch of the number line is
waiting for, and everything that can be built still is.

**If you already filled in the old grid, your words are there.** Opening
the screen the first time reads your number cards into the system —
including the feminine forms — and says which card each box came from.
Nothing is deleted: every card stays where it is, in whatever decks it is
in, with its recordings and every student's progress on it. What the old
screen never asked for was the form before a noun, so those boxes are
empty and marked as gaps rather than guessed at.

**And a Time tab.** The word for *hour*, the words for *past* and *to*,
the word for *minute*, what is said at each five-minute mark and whether
it counts from this hour or the next, and what each part of the day is
called. It waits on one thing and says so: the hour is a feminine noun,
so it cannot be said until the numerals that go with a feminine word are
written.

**For students: numbers and times are now dealt in ordinary sessions.**
They were a button you pressed. They are **skills** now — *Numbers 0 to
10*, *Numbers 11 to 99*, *Counting things*, *Telling the hour*, *Quarters
and half past*, *To the minute*, *Which part of the day* — and each holds
a schedule and climbs the ladder like a card. A skill is only offered
once the whole of it can be said, so a system that stops at ten is a
practice that counts to ten and stops.

Ten ways of asking, including three the app has never had:

> **How would you say this?** · 3 books
>
> **What time does this say?** · *a clock face, with its hands where they go*
>
> **Set the clock to this time** · *the hands are dragged, and are a pair
> of sliders as well*

The number or the time is made up when the question is dealt and thrown
away with the sitting — none of it is ever stored. Get one wrong and the
*same* number comes back later in the session; get it right and the next
one is different. And answering says two things at once: that you are
getting better at counting, and that you read the word for forty and knew
what it meant. Both are filed, so the words keep coming round in your
ordinary sessions without a single extra card being scheduled.

**Every word in the system is a card**, filed under *Palestinian Arabic
numbers* in your list, with the faces it takes laid out under it the way
a verb's persons are. They are the teacher's to write, so they are locked
— and a teacher correcting one does not cost you your progress on it.

Recordings work as they always did: one per word, and a time may play its
hour and its minutes one after the other. Nothing is stitched together
inside a number.

**Hebrew tells the time too.** The same screen, the same skills, with the
two things Hebrew does differently written in the boxes rather than in the
app: a time may be the numeral on its own, and *a quarter to eight* puts
the minutes in front of the hour where Palestinian Arabic puts them after
it. There is a line beside each five-minute mark to say which. Huế still
has numbers and no clock — nobody has written one yet.

**What went.** The old Numbers grid under Teaching → Cards, and the
*Practise numbers* button on Learning: there is one screen and one way of
asking now, and both of them are above. **Number** is no longer one of the
kinds a word can be — a numeral is a box in the system rather than a card
somebody writes — though a card saved while it was offered goes on saying
what it is, keeps its feminine form, and is still practised as the word it
is.

Nobody loses anything in the move. Your number cards stay where they are,
and a student who could already read the word for *forty* off one of them
does not start it again: the schedule they had earned follows the word to
the card that replaces it. A phone still on the previous release keeps
working — it sees ordinary cards, and its Practise numbers button says
there is nothing to build.

## 0.203 — 20 September 2026

**The app now says what your session moved.**

A card takes days to reach the top of its ladder and four more to be
learnt, so a screen that only says where your cards *stand* says almost
the same thing on the evening you work hard as on the day you do nothing.
Four changes, and between them something visible moves in every session.

**"Climbed" is now "Cleared."** The word for a card that has been all the
way up its ladder but not yet come back twice to prove it stuck. The rule
is exactly as it was; the word is better.

**Cleared has its own count in Progress**, between the top level and
Learnt. A card you worked all the way up tonight used to sit in the same
pile as one that had only just reached the last rung, so the number that
moved on the evening you did the work was indistinguishable from the
number that did not. It is the one milestone effort buys on the day it is
spent, and it was invisible.

**The screen at the end of a session says what moved** — the cards that
went up a level, cleared, or were learnt, each saying where it got to:

> **airport** — cleared
> **key** — up to writing it from a cue

Four at most, the biggest news first, and the rest counted. When nothing
moved, nothing is shown: the line above it already says the true thing,
which is that your gaps grew.

**And Progress opens with what today and this week came to** — *Today — 3
cards moved up, 1 cleared*. A line with nothing to say is left out, so a
quiet day shows nothing rather than a row of noughts, and the week is left
out when it would only repeat the day.

Two smaller things that came with it. A day is now **your** day rather
than Greenwich's, so an evening session west of London is no longer filed
under tomorrow — which nothing showed before and everything shows now.
And a card that merely becomes practisable, because a teacher added the
material, is no longer reported as having moved up a level.

## 0.202 — 20 September 2026

**An evening's work now moves a word. Keeping it still takes days.**

A word climbed its four levels at the speed of a calendar and not at the
speed you worked. Each level waited on a gap — a day below, four days
before the app would ask you to write a word from its meaning — so the
fastest anyone could finish a word was about eight days, and a whole
evening spent on one bought nothing a week of idleness would not have
given you anyway. That is the wrong bargain for an app you open when you
have time.

So the ladder is climbed by answering now: **get a question right twice
running and the level above it opens**, whatever the clock says. Sit down
for an evening and a word can go all the way to the top in one sitting.
Getting a question wrong twice running still shuts the levels above it,
exactly as before, and one miss is still forgiven — it is the same
sentence read from the other end.

What the waiting was protecting has not been given up; it has moved to
where it means more. A word that has been all the way up is now
**Climbed**, and it is not **Learnt** until it has come back **twice** of
its own accord and been answered right. Those two returns sit behind the
ordinary gaps, so they take about four days and cannot be hurried:
practising a card again the same evening counts, as it always has, and
makes no return. Effort buys the climb; time buys the keeping.

The card's own screen says which it is and what is left — *Climbed · 2
reviews to go*. A word that slips back down the ladder stops being learnt
until it is recovered, and its returns are waiting for it when it is.

**And one letter out is now treated as a typo.** On a word of four
letters or more, an answer a single letter off — one wrong, one missing,
one too many — is not marked against you. The question is simply asked
again. Two letters out is still a miss, and on a short word one letter is
a different word rather than a slip, so those are unchanged. The second
try does not show you which letter was wrong: that marking is what the
app is for on a script you are still learning, and showing it before the
retry would turn the retry into copying. Get it wrong again and the full
side-by-side marking is there as usual.

Nothing about how much you are asked has changed. Every question keeps
its own timing and comes round on its own; a card working through its two
returns is simply dealt the question those returns depend on first, so
the word is not held back waiting for the right question to come up.

## 0.201 — 19 September 2026

**Fixed: a saved verb stopped saying what kind of word it was.**

*What subtype* is answered once and then read, and on a verb there is
nothing to answer it with a second time: a verb's table is laid out by
that one kind of word, and offering any other kind would be offering to
throw the table away. So the drop-down was not shown — and the answer went
with it, which meant opening a verb you had saved showed no subtype at
all, on the one screen that knows it.

The answer is there now, under its own heading, with a padlock where the
pencil sits on a question that can still be answered again — the same row
the kind of card wears one section above. The line at the foot of the
block still says what a verb is and how it stops being one: empty the
table and it is a word again.

## 0.200 — 19 September 2026

**A verb is listed as what you call it, and no box of its table is
required.**

In Arabic and Hebrew a verb has no one word of its own — it is a table,
and every box in it is a form — so the app used the box a dictionary lists
the verb under, the he-past, as the card itself. Two things followed, and
both were wrong. A deck of verbs read as a column of he-pasts: *he ate*,
*he drank*, *he went*, each naming one form rather than the verb the card
was about. And Save stayed grey until that one box and its English were
filled in, so writing the present tense of a verb whose past you had not
taught yet meant filling in the past anyway.

**What a verb is listed as is now its name** — *to eat* — which is asked
for on the card rather than offered. It is the one thing about a verb that
can stand for the whole of it. Call a word a verb and the meaning you had
already typed becomes that name, so nothing you wrote is lost.

**And the he-past is an ordinary box.** Write the present alone, or the
command alone, or all twenty-four: what a save now asks for is a name and
one form of the verb with its English, and which form is your business.
The line under the table says that when it is true, in those words,
instead of naming a box.

A verb you wrote before this is untouched, and is still listed by its name
where you gave it one. Where you did not, the next time you open it the
editor asks for one — that is the card being given something to be listed
as instead of its he-past.

## 0.199 — 19 September 2026 — withdrawn

This release gave every verb an ordinary word block at the top and took
the dictionary form out altogether. That was the wrong fix: a verb in
Arabic or Hebrew has no single word of its own, which is why its table
stands in for one, and the block asked for a word that would then be
drilled twice. It was reversed the same day, and what it was trying to fix
is fixed in 0.200 instead.

## 0.198 — 19 September 2026

**A sentence can say which tense it wants its verbs in.** Write "yesterday
{{name}} {{verb}}" and the app had to meet it with every form of every
verb you have: *yesterday Raphael eats*, *yesterday Raphael eat!*, and the
one sentence you meant somewhere among them. Nothing was wrong with the
verb card — a verb is all of its tenses — and nothing was wrong with the
sentence either. There was simply nowhere to say when it happened.

There is now. Under *Blanks in this card*, a blank that verbs fill is
offered a tick per tense, in the order your language teaches them. Tick the
past and that sentence is asked with the past forms alone; the examples
underneath show you exactly what it comes out as before you save. Each
blank is asked on its own, so a sentence with two verbs in it can want two
different tenses.

Nothing ticked means any tense, which is what every sentence you have
already written says — none of them change. Unticking the last tense is how
you take it off again. A word in the hole that has no tenses at all — a
name, a noun — stands there whatever you tick: only the verbs are narrowed.
One thing worth knowing: a sentence narrowed to a tense takes the verbs
through their tables, so a verb card you wrote as a bare word, with no
table filled in, has no past to offer and will not appear in a past-only
sentence. The blank says how many words are behind it, so you can see it.

Languages whose verbs have one form are not asked the question.
## 0.197 — 19 September 2026

**A sentence in Arabic or Hebrew stopped reading backwards while you wrote
it.** A blank in a card's field is drawn as a pill with its name on it, and
a blank's name is always written in Latin letters — `name`, `colour-red`.
The field worked out which way to lay itself out from the first letter in
it, counted the name on the pill as one of those letters, and so read an
Arabic sentence that began with a blank from the left. A field holding
nothing but blanks — which every field of a sentence is for the first few
seconds of writing one — did the same, and lined its pills up from the left
on a card whose every other field starts at the right.

It reads what you wrote now, and passes over the blanks, because a blank is
not a word: it stands for whatever is put in it, which is a word in the card's
own language. So a sentence in the script starts at the right whether it
begins with a blank, ends with one, or is still nothing but blanks — and a
phrase pasted in another script still lays itself out by what it is, which
is what reading the field was for. Nothing you have saved changes; what was
stored was always right, and only the writing of it was upside down.

Three things came with it. The words shown under a field while a blank is
being dragged along it now run the way that field runs, so the gap your
thumb is over is the gap it looks like it is over — and the English of an
Arabic card is no longer dragged through back to front in an Arabic face.
The pill itself sits the right way round in a right-to-left sentence, with
the cross that takes it off on the end the sentence ends at. And a blank's
name is left reading left to right wherever it stands, so a name with a
dash or a digit in it cannot come apart in the middle of Arabic.

## 0.196 — 19 September 2026

**What a card is called is asked with the rest of what the card is.** A verb
and a sentence are both saved as something other than what they are about —
a verb as the form a dictionary lists, a sentence as a frame with a hole in
it — so each can be given a name to be listed under instead. That question
had a framed section of its own, standing between the card and its words and
reading as a stage of the form rather than as the label it is.

It is now a field in "This card", directly under what subtype the card is,
and its name is set the same way: both are one fact about the whole card,
settled once and then read. Nothing else changes — the same box, the same
wording about what a card with no name falls back to, and the same nothing
asked about it.

## 0.195 — 19 September 2026

**Arabic verbs have a plural *you* at last.** A verb card laid its forms out
under seven people — I, you (m), you (f), he, she, we, they — and Arabic
marks a verb for eight. The one missing was the *you* you say to a room:
إنتو. So there was nowhere to write بتاكلوا and nowhere to write أكلتوا, and
nowhere at all for كولوا — which, of every command in the language, is the
one a learner hears and says most, because most of the time you are talking
to more than one person.

It was never a decision. The grid in the write-up this feature was built
from was drawn with seven columns, and the plural forms were put in the
*they* column to fit — including the command, which cannot be *they*'s at
all, since you cannot tell *them* to do anything. The table was then built
from the picture. The pronouns that go on the end of a word were written
later and from the pronouns themselves, which is why that table has had all
eight of them the whole time.

The column sits where the paradigm puts it, between *we* and *they*.
Nothing you have already written moves or changes: every verb card you have
gains one more empty box per tense, to fill in when you get to it, and a
card with nothing in the new box is asked exactly what it was asked
yesterday. As with every other person, a sentence never puts a subject in
it — *you* is who is being spoken to, not who a name in the sentence turns
out to be — so what a plural name fills is still *they*.

Hebrew shares the same list of people, and had the gap for the same reason.
It gains the same column.

## 0.194 — 19 September 2026

An audit of how cards, kinds, forms and blanks hold together, and the
repairs it turned up. Nothing on the screen has moved; what has changed is
what the app does with what you have written.

**A name stopped quietly losing its job.** A card set to "not asked on its
own, but lent to sentences" — Raphael, for "my name is {{name}}" — opened
with that second tick switched off. It was not something you did: opening
the card was enough, and the next save, even one that only added a
recording, stored it as lent to nothing. Every sentence that asked for that
name lost it, with nothing said. Cards already saved that way are read
correctly again the moment they are opened.

**A sentence nobody could answer is no longer asked.** Where a sentence
needs a form that agrees with the word beside it — a feminine adjective, the
plural of a verb — and that box was left empty, the app put the sentence up
with its own braces showing, marked it wrong, and asked it again in every
session after that, for ever, because the turn only moves on a right
answer. Such a sentence is now simply not dealt, and comes back by itself
the moment the missing form is written. A sentence that runs out of words
mid-session is withdrawn the same way.

**Students now get the words their sentences need.** A blank can name what
fills it in four ways. Only one of them — the group tags you write by hand —
was actually sent to a student's device. A sentence asking for `{{noun}}`,
or for one card by its ID, arrived with nothing behind it and was never
asked, while your own preview of that card showed it working, because the
preview reads your whole collection and the student's device only holds what
was sent.

**Vietnamese words count as words.** The app worked out whether a card was a
word by counting the spaces in it, which is right for Arabic and wrong for
Vietnamese, where a single word is written as its syllables with spaces
between them. So *cảm ơn* was a phrase, and roughly every Vietnamese word
longer than one syllable was left out of `{{word}}` — the blank that means
"any word in the language" — with nothing on the screen to say so. What
settles it now is what you already said the card is: a card you have called
a noun, a verb or a name is a word, in every language.

**Two people saving at once no longer costs a card.** Saving read a deck's
contents, added to them, and wrote the lot back. Two saves in flight at the
same moment — two tabs, two teachers, a queue of offline edits going up —
each read the same starting point and the second wrote over the first. What
it cost was a card that had been saved, was on the server, and was in no
deck and no collection, so nothing afterwards would find it and nobody was
told. Each save now changes only its own card's place in the list.

**And the server now checks what it is given.** It trusted the app to have
checked already, which is fine until a save arrives from a tab left open
since before a rule existed. A card with a blank in it is stored as a
sentence whatever the sender claims, rather than being turned into a word
with braces in it that the editor then refuses to save. An ID a second card
already answers to is refused outright, which the editor has always done
while you are looking at the screen. And a recording is kept only under a
name a recording can actually have.

**A verb's own sentence no longer blocks its card.** A verb card carrying
the sentence it stands in could not be saved at all — the editor read the
sentence as a stray blank on a word and refused, and the only way out it
offered was to delete the sentence. It is now left alone and saved
untouched. Writing one still needs a screen that does not exist yet.

**And a group can no longer be given a card's name.** The ID box has always
refused a name a group already holds. The group box did not refuse a name a
card's ID holds, so the same collision was one tap away on the other side of
the same screen.

**Faster where it was slow.** Dealing a session on a large collection is
about three times quicker, and the work behind each answer is down by about
a third. Typing an answer no longer re-does the work of filling in the
sentence on every keystroke, and neither does typing in the card editor,
which was building every filled-in example of a card behind a fold that was
shut. Fetching course material no longer re-reads each teacher's whole
collection once per deck.

## 0.193 — 19 September 2026

**Writing a card is one sheet now, not a stack of boxes.** Every section of
the card editor used to be a rounded box sitting on the page's grey, so a
field you were typing in was inside a panel, inside a box, inside the page —
three frames to unpick before you reached the thing you were reading. The
boxes were also charging you about a word's worth of every line for their
own edges and corners, which on a phone is what you notice first.

The sections run the full width of the screen now, and what tells one from
the next is a rule straight across with room either side of it. The one
frame left is the panel around a subsection — a form's own fields, the table
of endings on a word — so a box on this screen now means one thing only:
that what is in it sits inside something else.

**And a section says what it is.** The name of a section is set at the size
of a heading, with what it is for on the line underneath in grey, where the
two used to share a line and compete. A field's name is a size up with it,
and every field on the screen now sits the same distance from its
explanation and from the box you type in.

**What kind of card it is, said rather than implied.** The first section is
called "This card", and it opens with the type — word or phrase, sentence,
conversation — shown the way every answered question on the screen is shown:
the answer, read, with a padlock where a question you can still change wears
a pencil. It was a line of grey beside the heading with two paragraphs under
it explaining that it could not be changed.

**And what a question is for is said before you answer it.** An explanation
used to sit under the box, where it read as a note about what you had just
written; it now sits between the name of the question and the box, which is
where somebody who needs it needs it. What kind of word a card is is asked
as "what subtype", saying what the answer gets you, and the fact that
follows from it — whether a noun is a person or a thing — is asked under the
kind of word it is about, with the reason it is being asked at all.

**Decks are the decks, not a count of them.** "2 decks" told you how many and
never which, and taking a card out of one meant opening a list and hunting
for the tick that was already on. Each deck the card is in is now a pill of
its own, with the cross that takes the card out of that deck on the pill.
While the card is in none — a card no student will ever see — what stands
there is a dashed outline saying "Add this card to a deck", which opens your
decks to pick from.

## 0.192 — 19 September 2026

**Opening a card to look at it now shows everything the card holds.** It was
meant to be the card with the typing taken away and it had fallen a long way
behind: a teacher looking at one of their own cards could not see what kind
of word they had said it was, the ID other cards borrow it by, which blanks
it leaves or what stands in them, which of its forms are asked about and
which are lent to sentences, what a number part is worth, or which tense and
person any cell of a verb's table was. A verb's table was an unnumbered run
of "other forms". And it was the last screen in the app that printed the
braces a blank is stored as, rather than drawing the blank.

All of that is on the screen now. A card opens with what it is — the kind of
word, whether it is a sentence, what it is listed as, what it is worth — then
its forms, each saying whether it is dealt as a question and whether it is
lent out; then any table it lays its forms out in, gathered under the row
each cell is on and labelled with the person, the way the editor lays the
same table out; then the blanks it leaves with the words that will go in
them, and how many sentences it is met as, with the filled-in sentences
behind a fold. A card with none of that reads exactly as it did: anything
with nothing in it is left out.

**And it cannot fall behind again.** What a card can hold is written down in
one place now, and the view-only screen is drawn from that list rather than
from somebody's memory of it. Two things keep it true. A field nothing has
been written about yet is still shown — at the foot of the card, under its
own internal name, with its value as it is stored — so the worst case is a
row that looks unfinished rather than a fact nobody can see. And the build
refuses to finish work that breaks the promise: it fails when a card gains a
field nothing describes, and again when a field is on an example card and not
on the screen.

A card a student opens is the same screen without the teacher's side of it —
which decks carry it, what other cards call it, which forms are lent —
because that is theirs to get right, not the student's.

**Two things a teacher sees on a card whose axis the app no longer asks
about.** A value recorded under a retired grammar axis, and one under an axis
only some languages declare, are both on the card and are both shown now.
What a card holds is what the screen says.

## 0.191 — 19 September 2026

**Whether a word is a person or a thing is now asked once, beside the kind
of word it is.** It is a fact about the card — a book is a thing whether it
is one book or several, and whichever way you spell it — and it was being
asked of every accepted answer of every form, where a card could answer it
one way on its singular and the other way on its plural, and where nobody
would think to look for it.

It sits under *What kind of word*, on the cards that are asked it at all:
in Arabic and Hebrew that is nouns, because the question exists for what
stands beside them — a plural of things takes the feminine adjective and a
plural of people the plural. Opening a card settles it on what the card
already says, so nothing has to be answered again, and a form added later
starts from the card's answer instead of the default.

Number and gender stay where they were, with the answer they are about:
two spellings may be a masculine and a feminine, which is the whole reason
they live there.

## 0.190 — 19 September 2026

**What an accepted answer is grammatically is now one line per question.**
Number on a line, gender on the next, each with its values beside its name
and one of them filled in — radio buttons, which is what "pick one of
these" looks like everywhere else.

They were rows of large buttons, a label above each row, so a word asked
about three things came to six rows of controls under a word of two
syllables, in a panel taller than the fields it belonged to. Nothing about
what a card can say has changed: the same questions, the same answers,
read in a glance instead of a scroll.

**Where the line is too narrow for the words, the values shorten.** On a
phone the choices read *sg. pl. N/A* and *m. f. n.* — the same
abbreviations the card lists have always used to name a form — and go back
to the full words as soon as there is room for them.

**And a gender set by mistake can be taken off again.** Anything the
language does not insist on now starts its line with *not set*, which
there was previously no way back to.

## 0.189 — 19 September 2026

**The card's group tags now show the tags a card wears anyway.** A card
fills `{{noun}}` by saying it is a noun, and `{{word}}` by being a single
word, without anybody ticking anything — and that list used to leave both
out, on the grounds that a tick for either would do nothing. True, and the
wrong conclusion: it meant reading a list of the blanks your card fills
that did not have the commonest two in it.

They are listed now, grouped together above the tags you keep, with the
ones this card actually fills marked and each saying how many words are
behind it. They are flat rather than ticked, because there is nothing on
those rows to answer — what changes them is the kind of word, further up
the screen.

**And a card can no longer be given an ID that a kind of word already
answers to.** A card ID, a group tag, a kind of word and `{{word}}` all go
between braces, so they are one namespace — but only the first two were
checked. Calling a card `noun` left `{{noun}}` pulling that one card *and*
every noun. The editor refuses it now and says why, the same way it
refuses a name another card or group already holds. Cards written before
the rule are untouched.

**One number, counted once.** How many words are behind a blank was worked
out in two places, each reading half the answer — how many cards *say*
they are a noun, and how many *tag* themselves with the word. A name can
be both. They are one count now, taken the way the question itself takes
it.

## 0.188 — 19 September 2026

**A group tag can be taken off every card.** Until now a teacher could name
a group, tick cards into it and rename it, but never get rid of one: a tag
typed in a hurry, or a group that stopped being useful, sat in the list on
every card for good, and the only way to empty it was to open each card in
it and untick.

The bin is beside the pencil on the group's own row while a card is being
edited, which is where the pencil is for the same reason — a group nobody
wants any more is only visible from a card that is in it. It appears only
on a group that cards actually fill; on a name a sentence leaves and
nothing fills there is nothing to take off anybody.

It asks once, and what it asks is what it costs rather than whether you are
sure: how many cards lose the tag, and that they lose nothing else — not
their words, not their recordings, and not a day of anybody's progress. And
the half nobody would think of, which is the half that ticking the group
back onto one card does not undo: the sentences that leave a blank of that
name go on asking for it, with no word to put in the hole until something
fills it again.

Which is why it says *take it off every card* rather than *delete*. A tag
is not a thing the app keeps a list of — it exists exactly while some card
carries it or some sentence asks for it — so taking it off the last card
that filled it makes the name disappear only when no sentence is still
writing it. Nothing rewrites a sentence here: a teacher taking a group off
their words has said nothing about the sentences that use it.


## 0.187 — 19 September 2026

**New card now asks which of the three kinds you are making, before the
editor opens.** Word or phrase, sentence, or conversation — each with a
line saying what it is — and what comes up is a screen for making that
one: named for it, laid out for it, and asking nothing further about it.

It was the first field *inside* the editor, which put you in a screen for
making a card and then asked what sort of card it was going to be. The
three are not variations on one form. A conversation has speakers and
turns where a word has forms; a sentence has blanks and fills nothing;
each is asked, dealt and filled by a different path. The question belongs
before the door.

Nothing else about the flow changes. Which decks it goes in, and which
language it is in where you teach more than one, are asked as they were.
A card that already exists opens as what it is, as it has since 0.180.

**One line changed with it.** A word with braces typed into it is still
refused, and used to offer two ways out — call it a sentence, or take the
braces out. There is no calling it a sentence any more, so it names the
one that is left and says where the other is: start a new card and pick
Sentence.

## 0.186 — 19 September 2026

**The app's text styles are now listed in Admin → App, drawn at the size
they are drawn at in the app.** The components have been shown there for a
while, so that what exists can be seen rather than remembered; the sizes
they are set in could not be, and "make it bigger" has meant a different
paragraph every time it was asked.

Fifty of them, grouped by the job they do — headings and labels, body text,
numbers and small print, controls, a question and an answer, cards and
lists. Each says what it is and where it turns up, and is shown as itself:
the real class on a real element, at the size it would be on that screen,
with the language being taught laid out in its own face and at its own
scale the way the practice screens lay it out.

Beside each one is the size it actually comes out at, measured off the
specimen rather than copied from the stylesheet — so a named size, a
calculation against a script's scale and a verdict sized off the width of
the phone all answer in pixels. Where the stylesheet writes it differently,
its own words are underneath. The six named sizes it declares are listed
above the lot, each drawn at what it is worth.


## 0.185 — 19 September 2026

**Which decks a card goes in is a section of its own,** directly under
what kind of card it is, rather than a button at the foot of that block
where it read as one more thing about the kind.

**A form block says less and lines up better.** The "The word itself"
heading over each form's own fields is gone — the block above it already
says which form it is — and so is the line under it listing what the card
cannot be saved without. The word, how it is said and its grammar now all
start at the same left edge; they were stepped in from each other, which
is the first thing the eye checks on a form.

The **+** that adds another accepted answer is the height of the field it
adds to and starts where that field starts. It was a twelve-pixel sliver
dropped eight pixels down the side of a forty-eight-pixel box: it read as
something that had slipped, and it was a tap target two letters wide.

And *What is drilled* under each form is now **How this form can be
practiced**, with the paragraph under it about what switching a tick off
does taken away. The two ticks say what they do.

## 0.184 — 18 September 2026

**Three lines in the card editor, said where they are wanted.**

*What is drilled* explains itself above its ticks rather than under them:
that switching one off keeps the form on the card, with its recordings and
whatever progress a student has made on it, and only stops it being asked.
That is what somebody about to switch one off needs to know, and under the
ticks it was an answer to a question already asked.

*Recordings* says what a recording gets you between the heading and the
button — "a recording lets this form be practiced by ear as well as by
sight" — instead of under the button, where it read as a note about what
had just been pressed. Which speeds you can record is no longer said here
at all: it is said on the screen where you choose between them.

And the line telling you to choose the kind of card now rather than later
is gone. The block already says what each kind is and that the answer is
settled when the card is made.

## 0.183 — 18 September 2026

**What kind of word a card is, is now a drop-down that shuts on the
answer.** It was a column of radio rows — Noun, Verb, Adjective,
Preposition, Pronoun, Name, Number, Something else — standing open above
the word itself on every card. That is right while somebody is answering
it, and wrong every other time: on most cards it is answered once and then
read, so eight rows of a decision nobody was making sat between the top of
the screen and the fields they came to fill in.

So it is a button that opens the list. Each answer still carries the line
saying what it gets you — a noun takes the pronouns on its end, a verb gets
its persons and tenses — because that is what the list is for and what a
row of segments could not hold.

**And once one is chosen, it locks.** The answer reads back as a row with a
pencil on the right, exactly as the card's ID does; the pencil opens the
list again. A card that has never been asked says "Not said yet" and opens
on a tap.

## 0.182 — 18 September 2026

**A card no longer needs an ID to be saved.** The ID is the name one card
answers to, so that another card's blank can ask for *that* word —
`{{colour-red}}` rather than any colour. Most cards are never pointed at
that way, and the name is usually wanted later, while you are writing the
sentence that points at them.

Every new card was being made to have one first, so the commonest job on
the screen — write a word, save it — waited on a decision about a card that
did not exist yet, behind a Save button that stayed grey with nothing
saying why. The box is still there, first thing in the Blanks section, and
now says it is optional; a card can be given one whenever it needs one.

What has not changed is the part that was doing real work: a name that
something else already answers to — another card's ID, or a group tag —
still stops the save and says which card has it. Two cards answering to one
`{{x}}` is the one thing an ID is there to prevent.

## 0.181 — 18 September 2026

**A blank sits in the sentence now, not under it.**

0.176 made a blank something you put into a card rather than type. What it
left alone was the words themselves, which went on showing `{{name}}` — so
every blank was on the screen twice: a chip under the field, and the braces
in the middle of your own sentence. Only the chip could be touched, and it
could not be moved to where the blank actually goes.

The blank is a pill in the field now, where it stands:

- **Drag it** anywhere in the sentence, with a finger or a mouse. It moves
  through the words as you go, so what the card will read like is on the
  screen while you decide. It is spaced like a word wherever it lands.
- **Tap the cross on its end** to take it off. It goes from the script, the
  pronunciation and the English together, because a blank in one field and
  not the others is the one thing a sentence cannot be saved with.
- **The bar underneath keeps the half the words cannot say**: the blanks
  your card leaves that *this* field has not got, each one a tap from
  agreeing, and the button for a blank nobody has written yet. A field that
  has the blank no longer carries a chip saying so — you are looking at it.
- **The braces are gone from every screen.** They are still how a card is
  stored and nothing about any card has changed, but nothing asks you to
  read or type them: not the fields, not the card lists, not the sheet you
  choose a blank in, not the filter that narrows the list by one. Type them
  out by hand anyway and they turn into the blank they name as you finish.

## 0.180 — 18 September 2026

**A card keeps the kind it was made as.** There are three kinds — word or
phrase, sentence, and conversation — and the editor asks which while the
card is being written, when nothing has been typed and no answer can lose
anything. From the first save it says what the card is instead of offering
to change it.

Two of the three were already like this. A conversation could never stop
being one: a scene with four turns on it has nowhere to put them. Nor could
a word with a table, because the table is the content and calling the card
a sentence would have thrown it away. What stayed open was the pair that
looked harmless — a word with no table could be called a sentence and back
again — and it is not harmless. A card is what a student's whole record is
attached to and what every other card's blanks are written against, and the
three kinds are asked, dealt and filled in three different ways; a card
that changes kind is a card whose past means something it no longer is.

**If you want the other kind, write another card.** That is the cost, and
it is worth saying plainly: a word you decide should have been a sentence
has to be typed again, and the original deleted if you do not want both.
Nothing you have already written changes, and no card in anybody's deck
moves.

The same rule now holds where the editor cannot be reached, so a device
saving from an old copy of the app can no longer turn a sentence into a
word by saying nothing about it — which it could until today.


## 0.179 — 18 September 2026

**Each part of a card now says for itself what it is drilled as.** The
create and edit screen used to ask that once, in a list at the very bottom
called "What is drilled", naming each part in the editor's own words — "The
main form", "Its attached pronouns". So a teacher who had just filled in a
pronoun table had to scroll past everything else, work out which line meant
the table they were looking at, and scroll back. The question is now asked
under the thing it is about: under the word, under the pronouns on its end,
under a verb's conjugations.

**And it is two questions, because it always was two.** Each of them can be
drilled *on its own* — dealt as a question, what it means, how it is
written, how it sounds — and *inside sentence cards*, lent to the sentences
that leave a blank it fills. A word is usually worth both. A name is worth
only the second: "my name is ____" is worth meeting with Raphael in it, and
"what does Raphael mean" is not a question. Until now one tick answered
both, so keeping a form without asking about it also took it out of every
sentence that could have borrowed it.

Nothing about any card already written has changed. Everything that was
drilled is still drilled in both ways, and anything switched off is still
switched off in both. The separate "Also ask this card on its own" tick in
the Blanks section is gone — it asked the same question in different words,
somewhere else on the screen — and what it said is now the first tick under
the form itself.

**Subsections are easier to tell apart.** Inside a block — the word, the
reference fields beside it, the table on the end of it; the blanks a
sentence leaves, the examples of it filled in, the card's ID, the groups it
is in — the split between one and the next was a single small coloured line
that read as a label on the field under it. Each is now a panel of its own,
named across the top, inside the block it belongs to.

## 0.178 — 18 September 2026

**The filled examples now fold away, and there are all of them.**

*Examples of this card with filled blanks* opens shut on every card, with
the count on its heading: *24 examples*, and a tap to see them. Shut,
because the list is no longer a handful — it is now every sentence the
card is met as, one per word behind each blank, and a card the whole
collection fills would otherwise push the rest of the screen out of sight
before you had asked it anything.

Open, it is all of them. The question you have in front of a blank — is
the right vocabulary behind this, and does every one of these sentences
say something — is a question about the whole list, and the three
examples it used to print could not answer it. The heading beside the
section says the same number, so a card you never open still tells you
what it is worth.

On a card met as more sentences than one screen will draw, the list stops
at a thousand and says so, and says how many there are.

## 0.177 — 18 September 2026

**A sentence can be given a name to be listed under.**

A sentence is saved as the frame you wrote, hole and all, and that is what
every list showed. So a deck of them read as a column of braces — "{{name}}
is heavy" names the shape of the card rather than what it is for, and
telling two of them apart at a glance meant reading past the blank in each.
Nothing was wrong with the cards. They simply had no name of their own.

**What to call it** is now the first thing on a sentence, exactly as it is
on a verb, and it says the same about itself: how the card is listed and
searched, and that nobody is ever asked it — what is practised is the
sentence with its blanks filled in. Leave it blank and nothing changes; the
card is listed as it was.

A named sentence reads as its name in a list, with the sentence itself
underneath. Its English gives way to the name, as a verb's does: the name is
what the card is about now. It is searched by it too, so a sentence you
called *saying where you live* is found under that.

## 0.176 — 18 September 2026

**A card is a sentence because you said so, and only a sentence can have a
blank in it.**

The editor has always asked what kind of card you are writing — a word, a
sentence, or a conversation — and then thrown the answer away. It worked the
answer out again from your words every time you opened the card: braces in
the text meant a sentence, and nothing else did. So a sentence you had typed
out but not yet put a blank into came back as a word, and a blank typed into
a word turned it into a sentence whether you meant that or not.

Your answer is kept now. A sentence stays a sentence while you write it,
before its first blank and after its last one goes.

And the other half of the same rule: **a blank belongs in a sentence, so a
word carrying one is refused rather than quietly renamed.** The card says
which blanks are the problem and names both ways out — call it a sentence,
or take the braces out — because those are opposite intentions with the same
symptom and only you know which it was.

That matters most on a card with a table. A blank typed into a verb used to
reopen it as a sentence, put its table away, and tell you every box in it
would be dropped the next time you saved. That cannot happen now.

**Nothing you have written changes.** A card with a blank in it was a
sentence before this and is one still; it simply writes the answer down the
next time you save it. Nothing needs converting and nothing needs checking.

**And a blank is put into a sentence rather than typed into it.**

Under each of a sentence's three fields there is now a bar: a chip for every
blank the card has, and a **Blank** button for one it has not. A chip on the
field that already has it reads as a fact; a chip on a field that has not is
one tap from putting it there. That is the whole of keeping the three fields
in step, which the app has been telling you off for getting wrong since
blanks existed.

**Drag a chip and the field opens up underneath it** — your sentence as its
words, with a target in each gap. Drop the blank where it goes, or pick up
one that is already in the sentence and move it. It is spaced like a word
either way: one space each side, none left hanging, and never two.

**The Blank button opens a sheet of every blank your language has** — any
word at all, each kind of word, each group tag, and each card by the ID it
answers to. Each one says what would stand in the hole and how many words
are behind it today, so you can see before you write it whether the blank
has anything to fill it. Type a name nobody has used and it is offered as a
new group tag.

## 0.175 — 18 September 2026

**Every card now has an ID you choose, and a sentence can ask for one card
by it.**

Until now a word was borrowed by a sentence through a name you ticked on
both — "Raphael fills `{{name}}`" — which is the right answer when the hole
takes any of a set of words, and no answer at all when you want that one
word in it. So a card now carries an ID of its own, typed by you when you
write it: put `{{colour-red}}` in a sentence and the card called
`colour-red` is what goes in the hole.

It is asked for in the Blanks section, under *The card's ID*, and it has to
be free: while you type, the app checks it against every other card's ID
and every group tag anybody has written, and says which card has it when
one does. Nothing is said when the name is free — the field simply turns
green — and the tick beside it shuts the box, because an ID is written once
and read a hundred times. The pencil opens it again, which is how a card
you come back to arrives.

A new card is not saved without one. A card written before this release has
none, so opening an old card to fix a recording is not a demand to name it
— but a name that is already taken stops a save whatever the card's age.

**The blanks you tick are now called group tags, which is what they always
were.**

*Using this card to fill a blank* is *The card's group tags*, with the same
list in it: tick the groups this card belongs to, and it fills the blank
each group is named after. Nothing about your cards changed — every tick
you have made still means what it meant.

**And renaming either one asks what should follow it.**

Rename an ID, or a group tag from the pencil on its row, and the app asks
one question: change it everywhere, or only here. *Everywhere* rewrites the
name in every card that writes it — the braces in every field, of every
form, of every turn — and retags every card in the group. *Only here*
leaves them alone, which for an ID means the old sentences go on asking for
a name nothing answers to, and for a tag means this card leaves the group
for one of the new name. Both are real answers, so neither is the default,
and the toast afterwards says how many other cards the new name went into.

## 0.174 — 18 September 2026

**A card with blanks in it now shows five filled examples, under a heading
of their own.**

The Blanks section of the card screen already filled the card in and
showed it — three sentences, sitting at the top of *Blanks in this card*
with nothing saying what they were. They are their own subsection now,
*Examples of this card with filled blanks*, and there are up to five of
them: the card as a student will actually meet it, with every blank
standing as one of the words really behind it.

Each example is the whole card and not a line of it — the sentence in the
script, how it is said, and what it means — in a numbered list, ruled
between its rows, and nothing else on the line. Five rather than three
because the list is for reading down: five askings of one frame is where
you see how much the card varies, and whether the words dropping into it
are the ones you meant.

A card whose blank has no word behind it says so in a line instead, which
is the same answer it always gave.

## 0.173 — 18 September 2026

**"Weak skills" now answers for itself.**

The line beside it is gone. On the days there is nothing going wrong the
button is simply dimmed, and pressing it says so: *There is no weak skill
to fix right now*, at the foot of the screen, gone a moment later.

That is the difference between a caption and an answer. "Nothing slipping
just now" sat there every one of those days, explaining a button nobody
had reached for yet; the same sentence said the instant somebody presses
the button is the one they were actually asking for. And a dimmed button
that does nothing at all when you press it teaches you nothing — you are
left guessing whether the app is broken or you are.

Nothing else about the button has changed: when something is slipping it
is live, and pressing it deals the session it always did.

## 0.172 — 17 September 2026

**The home screen opens on how far you have got.**

It used to open on a number: how many cards were ready, with four more
lines around it explaining how a session is put together, how much was
slipping, how many words were waiting their turn and how many cards were
sitting out for want of a field. All of it was true and none of it was
what you came to the screen for, and on the days it all showed at once
the button you actually wanted was somewhere near the bottom.

All five lines are gone. In their place, above Start session, is your
climb: a ring of how much of your collection is learnt, and a band beside
it showing where your cards are on the ladder — one block per level, in
the same colours the Progress tab uses, so a collection you have just
joined is one flat colour and one you are nearly through is mostly green.
Under it, in words, how many cards are learnt out of how many you hold.

Nothing about what a session deals has changed. The counts that came off
the screen are all still in Progress, which is the tab for them.

*Weak skills* still sits under Start session and still says "nothing
slipping just now" on the days there is nothing to fix — that is the one
day the line is worth reading. On every other day the button is simply
live, and pressing it is the point.

## 0.171 — 17 September 2026

**In "Match the pairs", two forms of the same card now say which is which.**

A card's forms are practised on their own, so two of them can turn up in
one grid — the masculine and the feminine, the singular and its plural.
When that happened there was no way to finish the question honestly: the
two mean the same thing, however differently the two English tiles happen
to be worded, so which meaning went with which word was a coin toss, and
half of a correct answer came back marked wrong.

Those tiles now carry their own grammar — *sg. m.*, *pl.* — in small print
under the word, **and under the meaning**, which is the half that actually
settles it: naming the word without naming its English leaves the pairing
exactly as unguessable as it was.

Only those tiles. A word with nothing in the grid to be confused with stays
bare, because a grid of five labelled words is a reading exercise about
labels rather than a question about the words. Nothing is said either where
saying it would not help: two forms whose tags read alike are not told apart
by them, and a language that declares no grammar — Huế — has nothing to say.
## 0.170 — 17 September 2026

**Practising a lot no longer stops you learning anything new.**

If you sat down many times a day, the app quietly stopped working. The
same handful of words came round every session, no word ever counted as
learnt, and no new word ever arrived — for as long as you kept it up. The
harder you practised, the more firmly it held.

Here is what was happening. Every word carries a gap: the time the app
waits before asking you again, which grows each time you get it right and
is how it decides you have learnt something. Answering a word *before* it
was due used to reset that gap's clock to the moment you answered. So if
you came back every twenty minutes, the wait started again every twenty
minutes and never actually ran. The gap could never grow past about three
days, and a word needs four to count as recognised — so nothing was ever
recognised, and the ten-word queue the app uses to pace new material never
emptied.

Now an early answer is counted, and leaves the word exactly where it was.
It still comes back when it was always going to, and it grows then. Answer
a word early as often as you like: it costs nothing and it no longer
blocks anything.

A simulated learner practising thirty times a day met ten words in a
fortnight before this and never a word more. The same learner now meets
forty-one, with gaps stretching out to three weeks. Somebody sitting down
once or twice a day was never caught by this and will see no change.

**And a session reaches for what you have not just done.** Once nothing is
actually due, the app deals the words nearest to coming round — which, on
your tenth sitting of the day, was the same words as on your ninth. A word
you answered in the last couple of hours now gives way to one you did not,
so a run of sessions works through what you are learning instead of
circling the same nine cards. Anything genuinely due still comes first, and
a card you marked as high priority still leads.

One thing this release does not change: a word you keep getting *wrong*
still goes back to the start each time, however early the attempt. If you
drill one word hundreds of times a day, the occasional slip will still hold
it back. Worth a look on its own if it bites.

## 0.169 — 17 September 2026

**Match the pairs can be started from either column.**

In the matching grid, a pair had to begin with a word on the left: tapping
a meaning on the right did nothing until a word was picked up first.
Nothing on the screen said so, and a learner reading down the meanings —
which is what you do when you are looking for the one you recognise — had
to cross to the other side before their tap counted for anything.

Now a tap on either side picks that tile up, and a tap on the far side
completes the pair. Word then meaning, or meaning then word: the same
pair, made either way round, marked the same. A tile you have picked up is
outlined on whichever side it sits, tapping it again puts it down, and
tapping a meaning that is already spoken for still frees it — only now it
stays in your hand, so it can be given straight to another word.

## 0.168 — 17 September 2026

**Weak skills: a session made only of what you keep getting wrong.**

There is a new button on the home screen, under Start session. Tap it and
you get a session built from nothing but the questions that have been
going wrong, worst first — the ones you have missed twice running lead,
then anything you missed once in its last couple of outings. Beside the
button is how much is slipping, so you can see whether it is worth a
sitting before you open one; on a day when nothing is going wrong it says
so and the button is dim.

The important part is that it picks *questions*, not cards. The app has
always tracked each way of asking a word separately — reading it is not
the same skill as writing it from its meaning — so a word that keeps
failing when you have to write it is drilled on writing it, and not on the
reading you have never once got wrong. That is why the button says skills.

Everything else about a session still holds: nothing is asked above the
level you have reached, nothing needs a recording your device doesn't
have, and no one word is the whole sitting. One rule is deliberately off —
a normal session is refused if the cards in it can only be asked one way,
and this one is not, because the single thing you keep failing is a
session worth having.

This was already possible, in the sense that anyone could open Build a
session, remember which cards had gone badly, tick them by hand and choose
Fix mistakes. Anyone who could do that did not need the feature.

## 0.167 — 17 September 2026

**Open a level on the ladder and each card says how far it has got.**

Learning → Progress → the ladder: tap a level and you get the cards on it,
sorted into paused, learning and not started. That says whether a card has
been begun. It does not say how far it has come — so a word one question
away from moving up and a word that was opened this morning sat side by
side and looked the same.

Each card now carries a small bar with a percentage: how much of what that
level needs is behind it. It fills as you practise and reaches a hundred at
exactly the moment the level opens the one above — the same "3 of 8" the
card's own screen already showed, said as a proportion so a list of them
can be read at a glance.

Two places deliberately have no bar. **Cards** holds every card at once, on
every level, where one card's 40% and another's would be forty per cent of
different climbs. **Learnt** is cards with nothing left to open, where every
bar would be full.

## 0.166 — 17 September 2026

**Cards you mark high priority now actually turn up — all of them.**

A student reported marking several cards and then not seeing them in their
practice. They were right, and there were three separate ways it could
happen.

The first, and the one most people would hit: a session takes a fixed
number of cards, worked out from how long it is and what a card costs to
ask. That is about five cards where each card carries a second form, nine
where it does not. Marking cards did not change that number, so anyone who
marked more than a handful got the first five or so and a different five
each sitting — against a screen that had just promised each one was in
their next session. A session now grows to hold everything you asked for.
Mark three cards and nothing changes; mark twelve and the session is a few
questions longer and has all twelve in it. A session with nothing marked
is exactly the size it always was.

The second: a card can vanish from your material for reasons that are
nobody's decision — a deck detached and reattached, a spell off a course, a
record the server could not read that minute. When that happens the app
sets your work aside and puts it back when the card returns. It was setting
aside the schedules and dropping the mark, so cards you had asked for came
home no longer asked for, silently. The mark now goes in the drawer with
everything else.

The third is the other direction, and would have shown as a card you had
*let go of* stubbornly leading every session: clearing a mark records when
you cleared it, which is what lets your other device know your change of
mind is the newer word. A course refresh — every forty-five seconds — was
throwing that away, so the next sync handed back the old yes and the card
came back marked.

Underneath all of it, the check that was supposed to be watching this only
ever asked whether a session had started, not whether the marked card was
in it. It asks the real question now.

## 0.165 — 17 September 2026

**Three fixes from problems learners reported.**

**A "Match the pairs" question can no longer contain the same thing twice.**
If two cards ended up in one grid reading the same — the same word, or the
same English — the question had no right answer: nobody can tell two
identical tiles apart, so a correct pairing was as likely to be marked
wrong as right. Worse, the grid could not be finished at all, because
pairing a word with one of the look-alike tiles lit up both and tapping the
other undid the pairing you had just made. Both learners who hit it gave up
and pressed "I don't know".

There was a guard against this, and it was in the wrong place: it read
cards as the teacher wrote them, while what reaches a tile has been cut
down to one accepted spelling and one meaning. A card meaning "Everything
is good / All good" and a card meaning "All good" were two different cards
to that guard and one tile twice to a learner. The check now happens last,
where the tiles are final, and a spare takes the place of anything left
out so the question stays the size it was.

The grid also holds its pairings by *where* a tile is rather than by what
it says, so it stays answerable even if a look-alike ever gets through
again.

**Typing some of the harakat correctly is no longer marked wrong.** Type no
harakat at all and your answer was accepted; type one of three correctly
and it was refused — so every step towards the full spelling made your
answer worse until the last one. A mark you type still has to be right; a
mark you leave off is forgiven, whether you left off all of them or some.
This is what the app's own stated rule always said. The same fix applies to
Hebrew niqqud.

## 0.164 — 17 September 2026

**The card list narrows by a blank, from either side of it.**

Teaching → Cards could already show you the words that fill a blank. It
could not show you the cards that *leave* one — so "what is going on with
{{name}}?" had half an answer: here are the names, and you work out for
yourself which sentences ask for one.

The filter is now called **Blanks** and asks which side a card is on: it
leaves one, it fills one, or it fills none. Tick a blank and you get that
side of it; switch sides with the tick still set and you get the other. The
two are never the same card, because a card with a hole in it fills
nothing.

Each blank in the list says what it is worth on both sides — *left by 3
cards · filled by 12 cards* — which is where two problems become visible
before you go looking for them: a blank with sentences and nothing to fill
them is a card that cannot be practised, and a blank with words and no
sentence is vocabulary nobody has written a use for.

The filter used to be called *Variables*, which is the word the code uses
and was the last place in the app still saying it out loud.

## 0.163 — 17 September 2026

**A misspelt answer now shows you which letter.**

Type a word in the language's own script, get one letter wrong, and the app
said "Not quite" and printed the right word underneath. That is true, and it
leaves you to find the difference yourself — which, on a script you are still
reading letter by letter, is most of the work and the part you are least able
to do.

Now the letter is pointed at. What you wrote comes back with the letters that
do not belong marked, and the answer underneath comes back with the letters
you left out marked. Both, because they are not the same thing: write the
wrong letter and it shows on both sides; leave a letter out and there is
nothing wrong with anything you typed — the only place to show it is the
answer.

It is deliberately quiet in two cases:

- **A word that was right in its letters** and marked down for its harakat,
  its tones or its niqqud has nothing highlighted. The line that already says
  so is the one that should say it, and a red letter under it would be the app
  arguing with itself.
- **A word with nothing of the answer in it** is not highlighted either. That
  is a word you did not know rather than one you misspelt, and colouring all
  of it adds nothing.

It works in every language the app teaches, and what counts as a letter is
each language's own rule — the same one its marking uses, so the highlight and
the verdict can never disagree.

## 0.162 — 17 September 2026

**"Blanks in this card" now shows the blanks in this card.**

0.161 made it a tick list of every blank the language knows about, with the
card's own ticked. On a card with one blank in it that was a list of a dozen
rows, eleven of which are not in the card at all — with a checkbox beside
each, under a heading saying these are the blanks in this card. Neither the
heading nor the ticks were true.

It is a readout now. It reads the blanks out of the card's own words and
shows those: the sentences a student will be asked, the holes themselves,
and — when you point at one — the words that will go in it. Nothing in it to
tick, because there is nothing there to decide: a blank is in the card
because it is written in the card.

Putting one in and taking one out is done where it lives, by writing
`{{name}}` into the fields. If a field is short of one the card still will
not save, and the editor still names the field.

The other half, *Using this card to fill a blank*, is unchanged: what a card
fills is nowhere in its words, so it stays the list where you say so.

## 0.161 — 17 September 2026

**Nothing in the Blanks section is behind a button any more.**

0.160 put the blanks a card *fills* on the screen as a list, and left the
blanks a card *leaves* behind a "+ Blank" button that opened a menu of the
same names. Two lists of blank names under two headings, one of them hidden,
read as the same control in two places — and they are not: one writes a hole
into this card's words, the other says this card stands in another card's
hole.

*Blanks in this card* is now a box and a list too, the same shape as the half
below it: type a new blank name at the top, and below it every blank you
could leave, with this card's ticked. The two lists are side by side, so the
headings can do the telling apart.

**And a blank can be taken out again.** Ticking one writes `{{name}}` into
every field at once, which is what it always did. Unticking now takes it out
of every field at once — which you could only do before by deleting the
braces by hand from all three fields, one of which runs the other way, and a
card left with them in two fields and not the third cannot be saved. Putting
a blank in stopped being typing two releases ago; taking one out has now
caught up.

The two lists are deliberately not identical: kinds of word (`{{noun}}`,
`{{verb}}`, `{{word}}`) are offered as holes to leave, because "{{noun}} is
heavy" is a real sentence to write, and are not offered as blanks to fill,
because a card fills `{{noun}}` by saying it is a noun.

## 0.160 — 17 September 2026

**Saying which blanks a card fills is a list you can see.**

0.159 let one card fill several blanks, and put the naming behind a button:
you opened a menu, read a list, and the box for naming a blank nobody had
named yet was at the bottom of it. Naming the first blank of a kind is the
one thing on that screen you cannot do by choosing off a list, so it was the
one thing hardest to reach — and a list you have to open to see is a list you
answer without reading.

*Using this card to fill a blank* is now a box and a list, both on the
screen. Type a new blank name at the top; below it is every blank anybody has
written, with this card's ticked. Tick one to fill it, untick it to stop.

**And kinds of word are no longer on that list.** A card fills `{{noun}}` by
saying it is a noun, and `{{word}}` by being a word — so those ticks never
did anything, and there was a row for every kind of word your language
declares, burying the handful of blanks anybody had actually written. The
list is the blank names somebody wrote, and the card says what it fills by
being what it is in one line underneath.

## 0.159 — 17 September 2026

**A card with a blank in it now shows what a student will really see.**

Writing "My name is {{name}}" meant trusting that the hole would be filled
with the right sort of word. The editor showed three example sentences, and
showed them in English only — which on a card written in Arabic is a preview
of everything except the Arabic. Each example is now three lines: the
sentence in the script, how it is said, and what it means, filled from the
words you actually have.

**And pointing at a blank says which words will go in it.** A blank used to
be a name on a chip and nothing more, so "is the right vocabulary behind
this?" could only be answered by leaving the card and reading the list.
Hover one — or tap it on a phone, or reach it with the keyboard — and it
lists the words that will fill it, each in the script, in how it is said and
in what it means. Eight of them, then a count, because `{{word}}` is filled
by every word you have.

**The Blanks section is now two named halves.** It was doing two opposite
jobs in one block, and showing only the half that applied: *Blanks in this
card* is the holes this card leaves, and *Using this card to fill a blank*
is the names this card answers to when another card leaves one. On a card
that leaves a blank of its own, the second half now says why it fills none
instead of simply not being there.

**A card can fill more than one blank.** A word is a name and a greeting as
soon as you write a second sentence about it, and until now saying so took a
second card carrying the same word — the same word to learn twice, with two
sets of recordings and two schedules. One card can now answer to as many
names as you like: add them one at a time, change any of them by choosing
again, and take one off with the × beside it. Nothing you have already
written changes, and a card that fills one name goes on filling exactly that
one.

## 0.158 — 17 September 2026

**A copied report shows the card again.**

The export in 0.157 was meant to put each report next to the card it is
about. For most of the cards actually on the site it printed the heading, a
revision number, and nothing else — no word, no meaning, no alternates. The
one part of a report that saves you opening the card was blank.

Cards written before the app stored a word and its alternates as one list
are still on the site in the older shape, and the export was the only thing
reading them that did not know about it. It now reads them the way the rest
of the app does. Nothing about the cards changed, and nothing needs
re-exporting beyond pressing Copy again.

**A copied export now opens by asking for a plan, not for fixes.** Pasting
one used to read as a job to start, and what came back was a pile of
changes nobody had agreed to. The first thing in the text is now a short
instruction: read them all, come back with a plain-language list of what
would change and what is not worth doing, and wait to be told to go.

## 0.157 — 16 September 2026

**Reported problems can be copied out of Admin in one go.**

Learners have always been able to flag a question from the answer screen,
and what they send has always landed in Admin. Getting it back out again
was the part that did not exist: you could read the reports one at a time
on screen, and that was all. Anyone who wanted to sit down and work through
them somewhere else had to copy them out by hand.

Admin → Flags now has Copy. It takes every report on the list, or only the
ones you have ticked, or a single one from its own row, and puts them on
the clipboard as plain text — each report with the card it is about, as
that card stands right now. Paste it wherever you like.

Reports also carry more than they used to, because most of what makes one
actionable was being thrown away at the door:

- **What the learner actually typed**, character for character. "It marked
  my answer wrong" cannot be settled without it, and a trailing space is
  exactly the sort of thing nobody thinks to mention.
- **How the app marked it** — right, nearly right, wrong, skipped, or the
  answer shown. A card flagged after being marked *right* is a different
  problem from one flagged after being marked wrong, and the two used to
  read identically.
- **Which course and deck the card came from**, because a bad card is
  usually one of a bad batch.
- **Which build of the app they were on.**

Reports sent before this release carry what they always carried. The export
says so rather than leaving those lines looking empty.

**Backups now include reported problems**, which were the one thing on the
site a backup did not hold. A site rebuilt from a file came back with no
record of anything anyone had reported and not yet fixed, and nothing said
so. Clearing the site offers them as a part of their own: clearing the
cards no longer quietly takes the list of what was wrong with them.

## 0.156 — 16 September 2026

**A session already under way now notices the connection going.**

The app holds back questions that play a recording you have not downloaded,
so you are never handed one you cannot answer. That was true when a session
was built and not while one was running. Start a session on wifi, walk into
a tunnel, and the questions already queued would still ask for recordings
that never arrived — a silent player and a note saying the recording is not
on this device, on a question you could only skip.

Now the rest of the queue is re-checked the moment the connection goes, and
again the moment the app finishes working out which recordings it holds,
which closes a narrow gap where a session started very quickly after
opening the app offline could be built before that answer arrived.

Two things it deliberately does not do. A recording that *is* on your device
is never taken away, so downloading a course before you travel still means
losing nothing. And coming back online does not push questions back into a
session you are halfway through; they come round in the next one.

If nothing in the session can be asked any more, it ends and says so,
rather than running out a queue that was cut short.

## 0.155 — 16 September 2026

**One wrong answer no longer shuts the levels above a word.**

Getting a single question wrong used to close every level above it on that
word. Fail one reading question and the writing practice on that word
disappeared until you had put the reading right — the card said *Paused*,
which was accurate and a very hair trigger. One bad answer, on one
question, on one word.

Now it takes two misses running on the same question: wrong, seen again a
few minutes later, wrong again, with nothing right in between. A single
miss changes nothing about the ladder. Getting it right at the second
attempt clears the slate entirely.

**Nothing about how a miss is scheduled has changed.** The question still
comes back in about ten minutes, the word still loses a little ground, and
the gap before you next see it still halves. The only thing that changed is
whether the levels above shut while you put it right.

One exception, at the top level only. Writing a word from its meaning
alone asks that everything under it still holds a four-day gap, and every
miss halves the gap. So the forgiveness is for the *miss*, not for the
shrinking: keep missing a word and its gap eventually falls under four
days, at which point the top level closes on merit rather than on the
strike count. The lower levels have no such bar and always get the full
two misses.

## 0.154 — 16 September 2026

**New words now arrive about twice as fast, and you learn more of them.**

How many new words you met used to be decided by three rules at once:
three a session, nothing while ten words were mid-learning, and nothing at
all while forty were still settling. Between them they let a diligent
learner meet about one new word every four days. They also meant the same
hour of work was worth wildly different amounts depending on how you broke
it up — ten short sittings in an evening were thirty new words where one
long sitting was three.

One rule replaces all three: **a new word is earned by learning one.** Two
pools decide it. At most ten words you cannot yet recognise, and at most
sixty on the go altogether. A word leaves the first pool as soon as you can
recognise it — not when you have finished with it — and carries on being
practised without holding the door shut behind it.

Nothing is counted in sessions or in days any more, so how long you sit and
how often you sit no longer change how much new material you are given.
What changes it is learning the words you have.

Measured against the old rules over a hundred and eighty simulated days of
one session a day:

| | before | now |
|---|---|---|
| words met | 34 | 65 |
| words learnt properly | 26 | 41 |

**And when nothing new is arriving, the app now says why.** A line on the
home screen names how many words are waiting and explains that they come as
the ones you are learning settle. Before, it simply stopped, which reads as
the app having run out.

Sessions are unchanged: still short, still overdue words first.

## 0.153 — 16 September 2026

**The Numbers screen has moved, to Teaching → Cards.** It was behind a
button on a deck; it is now the **#** in the toolbar at the top of the card
list, beside the search box. Last release put it on a deck because that is
where the cards went, and that had it backwards: the words a language
builds its numbers out of are a fact about the language, not about one
deck, and the same eleven Vietnamese words serve every deck you ever write
in it. Filling them in twice for two decks was work nobody should have
been asked to do.

So the screen now shows every number card you have in that language,
whatever deck each one is in, and saving writes them to your collection
rather than into a deck. Putting them in front of students is the step
every other new card takes: select them in the card list and add them to a
deck. If you teach more than one language that builds its numbers, the
button asks which first.

Nothing about the numbers themselves changed — the same boxes, the same
reach, the same sample of what a student will be asked. Cards written by
the old screen are exactly where they were, decks included.

**A fix on the way past: the button was invisible.** It asked for an icon
the set had never had, and an icon nothing knows how to draw is drawn as
nothing — so the control was there, worked, and could not be seen. There
is now a test that fails if any screen asks for an icon that does not
exist.

## 0.152 — 16 September 2026

**Numbers are now built rather than memorised.** A student who knows
*forty* and *seven* should be able to be asked *forty-seven*, and until now
that was a third card somebody had to write. It is now something the app
makes up.

**For teachers: one screen instead of fifty-five cards.** Open a deck and
there is a Numbers section with a *Fill these in* button. Behind it is a
grid of the words your language builds its numbers out of, in groups —
nought to ten, the teens, the tens, the hundreds, the thousands, the
millions. Fill in as many as you want and save.

How many boxes there are is the language's answer, not ours. Palestinian
Arabic and Hebrew ask for fifty-five, because their hundreds and thousands
fuse with the unit in front of them and cannot be built — خمسمية is not
خمسة and مية said one after the other. Huế Vietnamese asks for fourteen,
because it is regular: *năm trăm* really is *five* and *hundred*, so the
only extra boxes are the words that change in company — *năm* is five and
*mười lăm* is fifteen, *một* is one and *hai mươi mốt* is twenty-one.

Above the grid is how far the deck reaches: *numbers up to 9,999 can be
made*, which stretch of the number line is ready and which is still
waiting, and which words are in the way. Under that is a dozen numbers
written out exactly as a student will see them, so you can check the
wording before anybody is asked. It moves as you type.

Every word is yours. The app supplies only the rule for joining them, so
the dialect is the one you teach. Anything the rule gets wrong you can
override by writing that number out as a card of its own — a card for a
whole number always beats one the app built. Each box is an ordinary
number card underneath, so you can record it, edit it and see a student's
progress on it like any other. **Clearing a box does not delete anything**:
the card keeps its recordings and everybody's progress, and deleting it
from the deck's card list is how you get rid of it.

**For students: a Practise numbers button, on the home screen.** It says
how far it can go, and it asks three ways — read the number and write the
figures, see the figures and write it out, see the figures and pick it from
four. The wrong answers are numbers worth confusing with the right one, so
74 stands beside 47 rather than a book and a house.

It ramps. It opens where you left off and widens as answers come back
right, from single digits up to seven figures over a few sittings, and
steps back a notch when one goes wrong. It never asks for a number your
deck cannot build, so a deck with only the units is a practice that counts
to ten and stops.

The numbers themselves are not cards and never become any — they are made
up for the sitting and thrown away. What a right answer moves is the
*words* that stood in the number: reading 1,525 correctly counts as reading
the words for one thousand, five hundred, five and twenty, on the same
terms a sentence has credited the words in it since 0.142. So numbers keep
coming round in your ordinary sessions without a single extra card being
scheduled.

Hebrew counts in the feminine, which is what reading a number aloud
actually uses, and keeps the masculine on the card for standing beside a
noun — except in front of *thousand*, where the masculine is correct and is
what you get.

One thing supplied rather than asked for: Huế's *lẻ*, the word that marks
an empty place in *một trăm lẻ năm*, is a box beside zero, so it is your
typing like everything else.

## 0.151 — 16 September 2026

**There is always something to practise.**

Until now a card had to be *due* before you could practise it, and that
turned the app's own pacing into silence. Ten cards in four minutes, then
seven minutes with nothing on offer while they came back round, four times
over — and then, after about forty-five minutes on a new course, nothing at
all until the next day, with twenty cards of your course still untouched and
out of reach. Someone who had caught up got the same silence for the
opposite reason.

Being due now decides what a session *leads with*, not whether you are
allowed one. Open the app whenever you like and there is a session waiting:
overdue cards first, then whatever is nearest to coming round.

**Practising early counts, in proportion to how long you actually waited.**
This is what makes the above safe rather than merely generous. Before, the
app pushed a card further out by multiplying its existing gap without
looking at when you last saw it — so drilling a month-long card ten minutes
after the last time would have thrown it a month and a half into the future
on the strength of a ten-minute memory. Now:

- Answer on the day it asks for, or later — exactly as before. Nothing
  about a normal session changes.
- Answer halfway through the gap — it still grows, by less.
- Answer minutes after the last time — it stays where it is, and your
  answer is still counted.
- Get it wrong — counts in full, whenever you were. Forgetting is news.

So an evening of extra practice can no longer empty your next month.

**New cards still arrive at the same pace.** Three a session, and none at
all while you already have a lot on the go. Extra practice means more of
what you hold, not more new words — that limit is there so you do not bury
yourself, and it has not moved.

**The home screen stops contradicting itself.** At the wall it used to say
"20 cards ready to practice" above a button that answered "nothing ready to
practice yet", and the line written to explain the wait could never appear.
The number now means what the next session will actually deal, the button
always works, and when nothing is due it says so and tells you when the next
card is due.

**And the summary at the end says which kind of session it was** — whether
you got through work that was waiting, or practised ahead and moved very
little. Practising ahead is welcome; it is not the same as making headway,
and the app should not imply that it is.

**Offline, the app now tells you about recordings you haven't got.** They
are the reason a journey can be a quieter session than you expected:
questions that play a sound you have not downloaded are held back. The home
screen says how many, while you are offline, and points at the button that
fetches them.

## 0.150 — 16 September 2026

**A fix to 0.149's own fix.** Last release said you would no longer be
asked to listen to a recording your phone hasn't got. Half of that was
true: the app knew the card wasn't fully practisable, and then went ahead
and asked the silent question anyway. It is now held back in both kinds of
session — the one the app deals you and the one you build yourself — and
there are tests that fail if it comes back.

## 0.149 — 16 September 2026

This one is about the app working when your phone has no signal — which is
what it was built to do, and did, right up to the edges. An audit of every
place a connection is involved found the middle sound and the edges
online-only, with nothing on screen telling you which was which.

**The app now knows when it is offline, and says so.** Before, everything
that went wrong looked the same: the dot in the corner turned red and the
line beside it said "Offline — will retry" whether the network was gone,
your passphrase had been refused, or your collection had grown too big to
send. Two of those never fix themselves, and you were being told once a
minute that they would. The line now says which it is — and being offline
says where your work is, because that is the actual question: it is on this
device, and it is safe.

**Your courses are still there when you open the app offline.** Your cards
always were, but the courses they came from were fetched afresh every
launch — so with no connection you got an error where your course list
should be, the deck tiles you practise from were missing, and a teacher
opening the app was shown an empty screen. All of it is kept on the device
now. As a side effect the app also stops re-downloading every deck and
every card on every launch: it asks what has changed, and usually the
answer is nothing.

**The app stops calling home while there is nothing to call.** It used to
retry every forty-five seconds for as long as it was open, which achieved
nothing and cost battery. It now waits for the connection to come back,
which it is told about, and picks up from there.

**You are no longer asked to listen to a recording you don't have.** A
listening question whose sound had never been downloaded was still put to
you offline, with a silent player and a note saying the clip wasn't on this
device — a question you could only skip. Those questions are now held back
until the recording is here or you are back online, and the rest of the
card is drilled as usual. Account settings says how many recordings are
still to download, and the button there fetches them.

**A problem you report offline actually gets reported.** It used to be sent
once and, if that failed, quietly dropped — while the app told you it had
been noted. It is now kept and sent when you are back online.

**And a card a teacher writes offline is no longer lost.** Writing a card
with no connection meant losing it at the moment you pressed Save. The
editor now says you are offline before you start typing, the card is kept
on the device, and it goes up when the connection returns. Recordings still
need a connection, and the editor says so.

**Smaller things.** Setting up for the first time genuinely needs a
connection, and the first screen used to say the opposite; it now says what
it means, and the error you get there is written for someone who has not
started yet. The app warns you as your collection approaches the limit of
what this device can hold, not only the limit of what can be sent. A list
of already-uploaded recordings that only ever grew is now kept to the ones
still in use. And on a phone, the app offers once to be added to your home
screen — on iPhones that is what stops the browser clearing everything
after a week away.

## 0.148 — 16 September 2026

Everything in this release is about one thing: your progress being kept.
An audit of every path it travels — from pressing Continue to the copy on
the server and back to a second device — found fifteen ways it could be
lost or quietly undone. All fifteen are dealt with, and each now has a test
that fails if it comes back.

The common fault behind most of them: the app read *"nothing here"* as
*"nothing to keep"*. A refresh that listed fewer cards, a copy the server
could not read, a schedule with nothing in it — each was taken as an
instruction rather than as something unknown.

**Sync can no longer be locked out for good.** If the stored copy on the
server was ever damaged — a machine losing power mid-write was enough — the
server reported it as "never synced", every device's next upload was
refused, and it stayed refused for ever behind a bare "Sync failed". From
that moment nothing you did was backed up and nothing said so. Now: every
write is flushed to disk and the copy behind it is kept, so a damaged copy
is recovered from the one before it; if nothing is readable the app says
what happened and offers to send what it has, rather than failing in a
loop.

**A course that lists fewer cards no longer destroys your work on the
ones missing.** Cards do go missing for reasons nobody decided — a deck
detached to be reorganised, a student taken off a course by mistake, one
record the server could not read. Any of those used to wipe your progress
on every card in question, on every device, permanently. Now the card goes
but its work is set aside, and the moment the card comes back the work
comes back with it. Work nobody claims ages out on the same two-week
schedule as deleted cards.

**Reset scheduling sticks.** Resetting a card sent it back to the
beginning and the next sync, seconds later, put it back exactly where it
had been — with or without a second device. A reset is now dated, the date
travels, and nothing older than it is treated as progress.

**A card you asked for stays asked for.** Marking a card for next session
was dropped as soon as another device merely answered a question about it.

**Turns in a conversation are named.** Deleting one turn used to hand every
turn below it the schedule of the turn above — on every device.

**The last thing you did before closing the app is saved.** Saves are
batched a fraction of a second apart, and nothing wrote them out when you
closed the tab, backgrounded the app, or when the app reloaded itself to
install an update. That last answer can no longer slip through the gap.

**Two tabs no longer overwrite each other.** Each held its own copy of
everything and wrote it whole, so whichever saved last won and the other
tab's answers were gone. They now read each other's writes.

**A device that cannot save says so, and keeps trying.** When storage is
full or blocked it used to show one message and then fail silently for the
rest of the session, with the screen showing progress that was going
nowhere. It now retries, and the warning stays up until a save succeeds.

**The size limit is honest, and arrives early.** Over the limit, sync used
to fail with "Sync failed" and no way back. The limit is now measured the
way the server measures it, a warning arrives well before you reach it, and
the refusal says what it is.

**And the server will no longer let anything wipe your collection.** A
request that would replace everything with nothing is refused unless it is
plainly meant — deleting your cards yourself still works.

## 0.147 — 16 September 2026

- **The words in a sentence now get credit for answering it.** A sentence
  card is a frame with blanks that your own vocabulary fills — "the
  {{noun}} is {{adjective}}" — and until now only the sentence was marked.
  The noun and the adjective standing in it got nothing, so you could write
  a word correctly a dozen times inside sentences and the app went on
  believing you had never produced it.

  Answer a sentence correctly and every word that stood in it is credited,
  on the exact form that was shown: where an adjective agreed with the noun
  beside it, it is the feminine or the plural that gets the credit, not the
  word it came from.

  Three limits, so this does not quietly run ahead of what you have shown:

  - **Only a right answer counts.** A wrong one says something in the
    sentence was wrong without saying which part, so it counts against
    none of the words in it. A matching grid knows which word you
    mismatched; a sentence does not.
  - **A word's own schedule moves only if it was already due.** Being
    mentioned in a sentence is not a reason to push a word further out
    than it had earned, which is the same rule a word dealt into a grid to
    fill it out has always followed.
  - **A sentence keeps a review up to date; it cannot open a new rung.**
    An exercise a word has never been asked on its own is left alone. The
    top of the ladder is writing a word from its meaning with nothing on
    the screen to go on, and inside a sentence there is a whole sentence on
    the screen.

  Names and other cards you marked as not practised on their own are
  unaffected: they have no schedule to credit, and the sentence has always
  kept its own record of which of them it has been asked with.

## 0.146 — 16 September 2026

Nothing on any screen changes in this release. It is the last item of the
audit: the two parts of the app that decide what you practise and what you
have learnt are now testable, and are tested.

- **No change to how anything works.** The marking of an answer and the
  dealing of a session do exactly what they did yesterday, on purpose —
  every rule was moved as it stood and the whole check suite ran green at
  each step. What is different is that both can now be asked what they do
  without opening the app, and 48 new tests ask them.

- **Why it was worth a release of its own.** The bugs the audit found were
  in exactly these two places, and every one of them was green. Marking an
  answer was a function tangled up with the buttons on the screen, so the
  only thing watching the one path that writes your progress was a single
  answered question in a browser test. A mark filed against the wrong form
  — the wrong spelling of a card that accepts two, the wrong turn of a
  conversation — would have passed every check the project had.

## 0.145 — 16 September 2026

An audit of cards, scheduling and progress found work being lost in five
places. Every one of them is fixed here, and none of them was anybody's
fault twice: the way a card is stored changed a release ago, five readers
were still reading the old way, and every test was written in the old shape
so the whole suite agreed with them.

- **Editing a card no longer empties it.** Opening a card saved since the
  last release showed an empty first box where its word should be, with
  Save greyed out; opening an older one showed the word it had *before* its
  last edit, and saving put that back — losing the word's recordings, its
  number and gender, and whether it was switched off. Cards opened since
  the last release and re-saved may have lost their word that way; the word
  a student has is the one to go by.

  Two spellings of one thing keep their own number and gender through an
  edit now as well. مبسوط from a man and مبسوطة from a woman are one card
  with two right answers, and opening it used to give both of them whatever
  the first one said.

- **A teacher saving anything no longer resets their students.** New
  material is checked for every forty-five seconds, and each check was
  wiping two things the student had earned: their progress on **every turn
  of every conversation**, and each sentence card's record of which words it
  has already been filled with. Both are kept now. Progress on the forms of
  a word was always kept; this is the rest of it.

- **A word with two accepted spellings keeps its second schedule.** Each
  spelling is practised in its own right, and the second one's schedule was
  thrown away every time the app opened, after every sync and on every
  import — so an evening's work on it was gone by morning and the card read
  as never asked.

- **Fixing a typo in a verb's table no longer shuffles progress between
  its boxes.** A box of a table was the one part of a card with no name of
  its own, so on a student's device it was known by its position — and
  editing one box moved it to the end of the list, handing every box below
  it the schedule of its neighbour. Every box has a name now. Nothing a
  student has done is lost in the change: an unfamiliar name is matched back
  by position, which is the same way forms were named a few releases ago.

- **"This was too easy" now moves the level it says it does.** On a card
  with a blank in it, or one accepting two spellings, it read the ladder off
  the question rather than off the card — so it marked an exercise the card
  can never be asked, and the level the learner was actually on stayed shut
  while the message said it had opened.

Smaller things in the same area:

- **Build a session now follows the same rules a dealt session does.** A
  form the teacher keeps on a card for a student to read rather than be
  drilled on was asked there, and a verb's later tenses were dealt before
  its present was known. Both are as they should be. It also judged a card
  by the wrong language for anyone studying two.

- **"Reset scheduling" now resets scheduling.** It reported success and
  changed nothing at all.

- **A backup now contains a conversation's recordings.** They were never
  in one, and nothing said so — the count in the backup agreed with itself.

- **A card that does not fit says what was left out.** A thirteenth turn, a
  fifth speaker, a thirteenth recording: all of these were quietly dropped
  and the save said "Saved". It now names what did not fit.

- **Words, phrases, sentences and conversations are all practised again.**
  A setting from a removed screen could still be hiding one of the four
  entirely, on a device that had switched it off long ago, with nothing
  anywhere to say so. It is dropped like the other retired settings.

- **A noun and a preposition can be told apart after saving.** Prepositions
  written before the app asked what kind of word a card is opened as nouns
  and could not be corrected, which from two releases ago meant they filled
  blanks meant for nouns.

- **Two under-the-floor ones.** New cards were let in slightly too freely
  during the fifteen minutes after you say you cannot play sound. And a box
  of a table left pointing at a form that has been deleted is dropped when
  the card is saved, as it always was, but the warning above the table now
  counts it.

## 0.144 — 16 September 2026

- **You can ask for a card.** Open any card under Cards and there is a
  *Mark as high priority* button at the foot of it. A card you mark counts
  as waiting however far off its next review was: it is in the number on the
  home screen straight away, it opens your very next session, and it stays
  in every session until you tap the button again to clear it. The card list
  shows a star on the ones you have marked, so you can see at a glance which
  they are.

  Nothing underneath it moves. What you have learnt about the card, and when
  it would have come round on its own, are both still there when you take
  the mark off. It works on the cards your teacher sent you as well as your
  own — what you want to practise is your business, not theirs — and it
  survives your teacher editing the card.

- **A question you get wrong no longer comes back beside itself.** It still
  comes back, and it is still the same question, because the point of asking
  again is to test the thing that went wrong. What has changed is where it
  goes: it now goes through the same spacing rule the rest of the session
  was built with, so it never lands next to another question about the same
  card. Miss both questions about one word and you used to finish the
  session being asked about that word twice in a row; now the two are spread
  out like everything else.

- **And the same card no longer turns up twice running.** When the session
  could not both change the word and change the kind of question, it used to
  keep the word and change the question — so you got the same card twice in
  a row, asked two ways. It keeps the question and changes the word instead.
  Two words in a row asked the same way is barely noticeable; the same word
  twice running is the thing everybody notices.

## 0.143 — 15 September 2026

- **Settings no longer asks how practice should work.** The Advanced panel
  is gone, and with it the six controls over how a session is built —
  exercises per form, exercise types in play, exercises per session, new
  cards per session, grouping similar cards, order within a session — the
  row of marking leniencies beside them, and the hints switch above them.
  The app decides all of it now. Anything you had set is dropped rather
  than quietly kept, so every device is on the same footing.

  Settings keeps what is genuinely yours: which language you are learning,
  theme, the on-screen keys, and how loud the answer sounds are.

- **Fewer repeats of the same word in a session.** Two of the old defaults
  were the reason the same handful of cards kept coming round, and neither
  is a default any more. Each form is asked two ways in a sitting rather
  than three, so an ordinary session is nine words instead of six; and a
  card may bring two of its forms rather than four, so a session of verbs
  is five words rather than two words asked eighteen times between them.
  Similar cards are no longer gathered into the same session, which used to
  reach past what was actually due to find a shared root or a shared tag.

  Nothing about the scheduling changed — what is due is still what is due,
  and every form is still learnt in its own right. A session simply spends
  its eighteen questions on more of them.

- **A hint stays closed until you ask for it.** It always could be opened
  by hand, and there was a setting that opened it on every question
  instead. That setting was a way to learn less without being told: on the
  two questions where the nudge spells out the answer another way, having
  it up by default meant climbing to the top of the ladder without once
  writing the word from its meaning alone.

- **Two settings that could not show you their own value.** "Exercises per
  session" and "New cards per session" printed the words
  `{settings.sessionSize}` and `{settings.newPerSession}` where the number
  should have been. Both controls are gone, which is one way to fix it.

## 0.142 — 16 September 2026

- **A fourth flag: "This was too easy".** The flag menu on a question now
  offers it third, with the line *By flagging this exercise as too easy,
  we'll automatically graduate this card to the next level* — and it does.
  Choosing it and pressing Send moves the form that was asked — the word,
  or the one cell of a table the question was about — up one level of its
  ladder on the spot: every exercise on the level it is standing on is
  counted as learnt, so the next level opens from the next session. Its
  other forms keep their own places. A form already on the top level is
  counted as mastered instead, and the message under the button says which
  happened.

  The answer you gave to that question is not marked against you: if you
  got it wrong and then said it was too easy, the too-easy wins. Nothing is
  sent to the teacher — this one is your own shortcut, not a report — so it
  needs no account and does not appear in the teacher's list of flags. In
  a trial of a teacher's own card it does nothing, like everything else
  there.

## 0.141 — 16 September 2026

- **In a sentence, an adjective agrees with the noun beside it.** A blank
  filled by an adjective now picks the form its noun calls for: كتاب كبير,
  سيارة كبيرة, معلمين كبار — and كتب كبيرة, because a plural of things
  takes the feminine singular, which is what the person-or-thing question
  on nouns (added last release) is for. A number does the same by gender:
  ثلاثة كتب, ثلاث سيارات. The form is read off the adjective's own table,
  so a card with an empty cell is simply not asked in a sentence that needs
  that cell, rather than being asked with the wrong form.

  Which noun it agrees with is the first other blank in the sentence — the
  same rule a verb's own sentence has always followed — so "{{noun}}
  {{adjective}}" needs nothing said.

  One consequence: an adjective or number card lends only its own word
  into a blank, and its other forms are reached by agreement rather than
  by turn. So which sentence a given asking lands on will move for those
  cards. Nothing is lost by that; it is written down because it looks like
  a change the first time somebody notices.

  A verb standing in a sentence card still cannot agree: nothing on a
  sentence card says which tense, so its forms go on taking turns as they
  did. A verb's own sentence, written on the verb card, goes on working.

## 0.140 — 16 September 2026

- **Each kind of word gets the editor its grammar wants.** The editor asks
  what kind of word a card is, and until now only three answers changed
  anything. In Palestinian Arabic every answer now does something:

  - **Noun** — as before, plus one new question: **a person or a thing**
    (animals count as things). It is there because the next release needs
    it: a plural of things takes the feminine singular adjective, a plural
    of people the plural.
  - **Verb** — as before. Any extra form the card carries is no longer
    asked its number and gender.
  - **Adjective** — a one-row table of its own: **feminine** and
    **plural**, each practised in its own right once the word is known. No
    number or gender on the word, because the table is its number and
    gender. No *Add a form*: a second spelling is an accepted answer, as
    on a verb.
  - **Preposition** — the pronouns on its end, as before, minus number and
    gender.
  - **Pronoun** — the word with number and gender. No table.
  - **Name** — the word with gender **and number**. Number stays because
    the verb beside it in a sentence reads both to choose between *he* and
    *she*.
  - **Number** — the word (the masculine form), then one cell:
    **feminine**. You type whichever form the noun's gender calls for —
    ثلاثة in the word, ثلاث in the cell — and the app only ever picks by
    the noun's gender, so the reversed agreement of three to ten is your
    typing, not a rule it has to know.
  - **Something else** — the word only. No grammar, no table.

  Hebrew gets the same, except an adjective's table has three cells
  (feminine, masculine plural, feminine plural). Huế changes nothing: it
  lays out neither table, so an adjective there stays a plain word, as a
  noun does.

  A card written before this keeps everything it has. Hiding a field does
  not erase what was typed into it; a preposition saved earlier with a
  gender still shows it in lists. A saved card with a table opens on that
  table, whichever it is.

- **Housekeeping underneath: a language declares its tables by name.** Two
  tables used to be built into the app by name, and a third would have been
  a third special case everywhere the two were told apart. A language now
  declares as many as it has, and each table says what its cells wait on
  (the row above, as a verb's do; or the word itself, as pronouns do) and
  whether every form carries one or the card does. The drilling rules did
  not change — which rule applies is read off the table.

  One small wording change on the way: in *What is drilled*, the line for a
  word's pronouns is now "Its attached pronouns".

## 0.139 — 15 September 2026

- **A sentence is now a kind of card you can make, and the words you have
  already written fill it in.** Write "the {{noun}} is {{adjective}}" once
  and it is asked as every noun and adjective you have, a different pair
  each time, rather than being one sentence somebody learns whole.

  The card editor asks what kind of card it is — a word, a sentence, or a
  conversation — and a sentence gets its own editor: the sentence, the
  blanks in it, and what each blank will be filled with. Nothing about
  parts of speech or tables, because a sentence is not a word.

  A card with a blank in it already opens as one, so the sentences you have
  written are already there. Nothing is stored saying "sentence": the
  blanks are in the words themselves, so a card that has one is a sentence
  and a card that loses its last one is a phrase again.

- **A blank named after a kind of word is filled by the words of that
  kind.** `{{noun}}` takes every card you have called a noun, `{{verb}}`
  every verb, and so on through whatever the language declares. Nothing has
  to be written on those cards: they answered the question when you said
  what they were.

  Until now a blank had to be named on both sides — a blank called `name`,
  and every card that fills it carrying the word "name" — which is filing
  rather than teaching. That still works and is still the way to make a
  narrow blank of your own. It is no longer the only way.

- **Every form of a word can fill a blank, not only the word itself.** A
  plural stands in a sentence, and so does one cell of a verb's table. Each
  stands on its own progress: a form only turns up in a sentence a student
  is far enough along to answer, exactly as the word itself always did.

- **A sentence can ask for a verb.** `{{verb}}` used to mean one thing only
  — a verb card's own place in its own sentence — so a sentence card could
  name every kind of word its language has except the one a sentence most
  needs. It still means the card's own place on a verb card's own sentence,
  and means "any verb" everywhere else.

  One limit worth stating: a blank is filled from the words the student
  already has. A sentence in a lesson whose nouns the student has not been
  given yet is not asked until they have been, and the editor says so
  rather than leaving you to find out.

- **A card with a blank in it no longer fills anybody else's.** That was
  always the stated rule and there was one way round it: a card that both
  had a blank and named one it filled went on standing in other cards'
  sentences, which puts a sentence inside a sentence. If you have a card
  doing that, it stops.

## 0.138 — 15 September 2026

- **Housekeeping: a card is now simply the list of forms it holds.** Nothing
  looks or behaves differently, and nothing you have written changes.

  A card has always been one word together with the alternates it carries —
  a plural, a feminine, a cell of a verb's table, a word with a pronoun on
  its end — and every one of those is a thing to learn in its own right,
  with its own recordings, its own pronunciation and its own place on the
  ladder. Until now the card's own word was kept apart from the rest: the
  word was the card, and the alternates sat in a list beside it. That is two
  shapes for one kind of thing, so every fact about a form had to be
  written twice, and the two kept drifting apart. An alternate had no name
  of its own for three releases. A form kept without being asked about
  needed a second, separate answer for the card's own word. A cell of a
  pronoun table had to invent a way of saying "I belong to the card's own
  word".

  One list now, the card's own word first. Every form is the same kind of
  thing, so anything added to forms from here on is added once. Your cards
  are read into the new shape the moment the app opens them, and each keeps
  its recordings, its progress and everything the teacher wrote.

  This is the last of the groundwork. Sentence cards come next, and after
  them blanks that can be filled by any form of a word.

- **A conversation's read-through and put-it-in-order questions are asked of
  the scene's own title.** Part of the same change, and worth saying because
  it is the one place where the new shape had to answer a question the old
  one answered by accident. Nothing about practising a conversation changes.

## 0.137 — 15 September 2026

- **A card now says what kind of word it is, and the teacher is the one who
  says it.** Noun, verb, adjective, preposition, pronoun, name, number, or
  something else — asked once, in the block at the top of the editor, from a
  list the language itself declares.

  It replaces a question about the app's own machinery. The editor used to
  ask which *table* a word laid its forms out in — *Just this word*, *A
  verb*, *Attached pronouns* — and then work out what the card was by
  looking at which table happened to have something in it. That guess is
  what let a saved word with pronouns on its end open as a verb and lose
  them on the next save.

  What follows from the answer is the table: a verb is offered its persons
  and tenses, a noun and a preposition the pronouns that go on their end,
  and everything else is the word and whatever forms you write. A card
  written before this is shown what it looks like — a card with a verb's
  table reads as a verb — and you can say otherwise before saving.

  Nothing about how a card is drilled changes. This is the first of three
  steps: sentence cards come next, and after them blanks that can be filled
  by any form of a word.

## 0.136 — 15 September 2026

- **Housekeeping: there is now one way to ask what forms a card has.**
  Nothing looks or behaves differently. A card is its own word plus the
  alternates it carries — a plural, a feminine, a cell of a verb's table —
  and until now the code joined those two together by hand in around thirty
  places, each written slightly differently. They are all one question now,
  asked in one place.

  This is the groundwork for the work planned next: teachers naming what a
  card is, sentence cards, and blanks that can be filled by any form of a
  word. Each of those has to walk a card's forms, and it is far safer to do
  that through one door than thirty.

## 0.135 — 15 September 2026

- **Fixed: the *What is drilled* section was missing from every card that
  needed no decision.** It was hidden on any card with only one part —
  which is every ordinary word, and every card at the moment it is
  created. So the section shipped in 0.134 appeared on none of the cards a
  teacher opens first, and looked as though it had never arrived.

  It is now on every card. On a plain word it is one line saying the word
  is asked about, which is worth saying and is the only place anybody
  would look to change it.

## 0.134 — 15 September 2026

- **A card can now keep a form without being asked about it.** The editor
  has a *What is drilled* section listing the parts of the card — its word,
  each further form, the pronouns on the end of each of them, the
  conjugations — all ticked, and any of them can be unticked.

  An unticked part stays on the card and is still shown. Its recordings are
  kept, and so is whatever progress a student has already made on it: it is
  simply never asked about, and ticking it again takes up where it left
  off. Until now the only way to stop a form being drilled was to delete
  it, which threw all of that away — so a conjugation table written out for
  a class to read cost twenty-one questions a day or nothing at all.

  The section is not shown on a card with only one part, which is the
  ordinary word: there is nothing there to choose between.

  Two of the ticks take something with them, because the app would
  otherwise be offering a choice that does nothing. A verb whose word is
  one of the boxes in its own table is one thing, so the two go together;
  and the pronouns on the end of a form go off with that form, since they
  are only ever asked once the form itself is known.

## 0.133 — 15 September 2026

- **The card editor is four editors underneath — word, verb, attached
  pronouns, conversation — over one shared draft.** Nothing looks or
  behaves differently: the screen is the same screen, checked against a
  snapshot of it at every step. It was one large screen handling all four
  kinds at once, and the four editor bugs fixed in 0.131 were all the same
  bug — one screen keeping four shapes in its head. Each editor now shows
  only the parts that belong to it.

  One small change, accepted on purpose: when a *new* card is switched
  between word, verb and attached pronouns, anything typed stays, but an
  open pop-up — the keypad, a grammar panel — closes.

## 0.132 — 15 September 2026

- **Fixed: a saved word with attached pronouns opened as a verb, and saving
  it dropped the pronouns.** On Arabic and Hebrew the editor put the
  dictionary form into any card that had a box in a table — and a pronoun
  box is a box in a table. So the card opened on the verb table with its
  pronouns "put aside", the choice of table was hidden because the card was
  already an attached-pronoun card, and Save wrote the verb table and threw
  the pronouns away. Only a verb is treated as one now, and the app's own
  checks reopen a saved attached-pronoun card so this cannot come back.

## 0.131 — 15 September 2026

- **Every form of a word now carries its own table of attached pronouns.**
  The table used to hang off the card: one row of *my*, *your*, *his* for
  the whole thing. But the plural takes the same endings — *my books*,
  *your books* — so a single table said the plural's pronouns were the
  singular's, and 0.130 took **Add a form** away for want of anywhere to
  put them.

  A form is now a word plus its own table underneath it. **Add a form** is
  back, and what it adds is the whole thing: another word, and the eight
  pronouns on the end of that word. Removing a form takes its table with
  it. The two kinds of grammar then sit at visibly different levels — what
  the word is, on the form; whose it is, in the columns.

- **A word's pronouns wait on that word, rather than on the card.** *My
  book* is a form of *book*, and meeting the two together is meeting a word
  you have not learnt in a shape you cannot read — so each table opens once
  the form it hangs off has been read a few times. Its own form: the
  plural's eight wait for the plural.

- **And once a word can be written from its meaning, its pronouns are asked
  one exercise a level** instead of every exercise they support. Eight
  boxes per form, each differing from the word by an ending learnt once,
  was a fortnight of questions about something already known. The ladder is
  unchanged and nothing is skipped — every rung is still climbed, once
  rather than two or three times. A lapse on the word puts its pronouns
  back on the full ladder, and no progress is lost either way.

- **Fixed: a verb's table reached a student as a heap of loose forms.**
  Where each cell sat — which tense, which person — was dropped on the way
  from the teacher's card to the learner's device, which is what every part
  of a table is read from. So no row opened before another, the form a
  dictionary lists was drilled twice over, and a sentence with a verb in it
  never agreed with what filled it. Tables now arrive intact.

- **Fixed: inserting a form shifted everyone's progress down a place.** A
  student's work on a card's forms was matched to the teacher's by
  position, so a form added above an existing one handed the second's
  schedule to the first — silently, on every device holding the card. Forms
  now carry a name of their own and keep their work wherever they are moved
  to.

## 0.130 — 15 September 2026

- **A word that takes a pronoun on its end is no longer offered a loose
  form beside its table**, the way a verb already was not.

  The plural looked like the reason to keep it — *book*, *books* — but the
  plural takes the same endings, *my books*, *your books*. So it is not one
  more form: it is a second table, and dropping it in here would have given
  you a plural stripped of the endings that made the card worth having.
  There was nothing else a loose form could have been.

  That also takes the redundancy with it. Every loose form asks for its own
  gender and number, which is how one is told from another — but the boxes
  in the table are told apart by the column they sit in, and already say so.
  With nothing loose left, there is nothing left asking twice.

  A form the card already carries stays on screen, because it is saved
  either way and hiding it would read as having lost it. **Duplicate**, on a
  block already there, is untouched: it is a way out for somebody who has
  one rather than an invitation to everybody who has not.

## 0.129 — 14 September 2026

- **"Learn more" now has something in it whatever was asked.** The box
  showed whichever field the exercise offers as a hint *during* the
  question — a different thing, and the exercises that offer none were left
  with no box at all. **Choose the meaning** is the plainest case: it puts
  up the word and then its meaning, and ended with nothing to add, though
  how it is pronounced was exactly the thing nobody had said.

  Where an exercise names a hint, that is still what is shown. Where it
  names none, the box shows the field neither the question nor the answer
  used — which is the one thing left worth knowing. **Choose the word**,
  **Which word is missing?**, **Match each word to its meaning** and the
  listening questions all gain one the same way.

- **Two lines in Progress say what they mean more plainly.** The ladder is
  *"Where your cards are on the learning ladder. A card moves up a level
  when the previous level is mastered."*, and the decks are *"How you're
  doing on each deck you're studying."*

## 0.128 — 14 September 2026

- **A question two forms of one card could answer now says which it
  wants.** A card's forms are drilled on their own, and two of them can
  mean the same thing: a masculine teacher and a feminine one are both
  *teacher*. Asked to write it in the script, there was no way to know
  which was wanted — and writing the other one was marked wrong for
  knowing the word.

  The instruction carries the form's own grammar in the two cases where the
  question does not already settle it: when **another form of the same card
  is on screen** among the tiles or in the grid, and when **another form
  answers the same prompt**, which is the typed case and the worse one,
  because nothing is up to compare and you find out by being marked wrong.

  It reads *Write in Arabic script · sg. m.*, in whatever the language
  declares — number and gender in Arabic and Hebrew, and nothing at all in
  Huế, which declares neither.

- **And it is said about the card's own form too, not only its others.**
  The tag was shown on sub-forms alone, so of the two forms standing side
  by side the one that got told apart was never the main one — which is as
  easily confused with its feminine as the other way round.

- **A card whose language declares no grammar no longer gets a bare
  separator.** The tag drew its dot and its spacing before asking whether
  there was anything to put after them.

## 0.127 — 14 September 2026

- **A deck's figure counts the levels you have finished, not just the cards
  you have finished.** It was the cards with nothing left to open over all
  of them — so a deck whose every card was three levels up and being asked
  to be written read as **0%**, and stayed there for weeks while the work
  went on. That is the one number on the screen somebody watches to see
  themselves moving, and it was the one that moved last.

  A card contributes its own share of itself now: the levels it has
  finished, over the levels it has material for. A level a card has nothing
  on is not a level it is short of — the ladder passes those straight
  through, so the figure does too. Every card counts the same whatever it
  carries, because a deck of thirty cards is thirty things to learn however
  much each happens to hold.

  What has not changed: it is still rounded down and still held at 99 until
  the last card is in, because a tile reading 100% over a card still to
  learn is the one number here nobody would trust again.

- **And the line under it says "fully learnt".** How many of a deck's cards
  are finished outright is a different fact from how far the deck has got,
  and worth both — but the two were the same number until now, and the word
  that told them apart was missing.

## 0.126 — 14 September 2026

- **"It takes a pronoun on the end" is just "Attached pronouns".** The long
  way round was a sentence where the other two answers are a phrase, and it
  read as the odd one out; the grammar's own name for them is shorter and
  no harder. The table's own heading says the same thing, so a box in it is
  now *English for attached pronouns · me* rather than a line of prose.

- **And a table of one row no longer says it is "taught first".** That line
  says which row opens when, which is worth saying where a verb has three
  of them and names an order a single row is not in. What that one waits on
  is the word itself, and the line under it already says so.

## 0.125 — 14 September 2026

- **A word can carry the pronouns its language attaches to it.** Arabic and
  Hebrew write *my book* as one word, and the same endings carry a
  preposition — عند is *at*, عندي is *I have*. Those are forms of the word
  and things to learn, and there was nowhere to put them: a verb's table
  says who is doing it and when, never who it is about.

  They get a table of their own now — one row, a box per pronoun, each
  practised and scheduled in its own right by the exercises every other form
  gets. It is the same table a verb has, one row deep, which is why nothing
  else had to change to hold it.

- **And the row waits on the word it is built on.** A verb's rows open one
  at a time because the tenses are not as hard as each other. This one opens
  once the card's own word is past the first level, because meeting *my
  book* before *book* is meeting a word you have not learnt in a shape you
  cannot read.

- **What a word lays out is now its own question.** *Verb* was a third
  answer beside *Word or phrase* and *Conversation* for a release, and it
  stopped working the moment there was a second table to offer: four answers
  on a row that already ran off a phone at three, in a list mixing "a
  different shape of card" with "a word with more said about it".

  So the kind of card is a word or a conversation, and underneath it a word
  is asked what its forms are — **just this word**, **a verb**, or **it
  takes a pronoun on the end** — with a line under each saying what it gets
  you. Only where the language lays those out: Huế lays out verbs and
  attaches nothing, and a pack that lays out neither is asked nothing at
  all.

  Nothing about a stored card changed, and nothing new is stored. Which
  table a card has is still read off the boxes it carries, and a saved card
  whose table has anything in it is still told what it is rather than
  offered a change that would throw the table away.

- **A verb's object pronouns are deliberately left out.** *He saw me*, *I
  love you* — those are a third axis, and seven persons across three tenses
  across eight objects is not a table anybody fills in. They belong in a
  phrase that teaches the verb, which is what ticking **Words this teaches**
  is for.

## 0.124 — 14 September 2026

- **A card in two decks is in both of them again.** The deck tiles in
  Progress counted every card under whichever deck happened to carry it
  first, and reported the rest as short of it — so a card you had filed in
  Lesson 1 and again in Review showed up in one of them and was missing from
  the other, with the percentages drawn off the wrong totals.

  A deck reaches the learner's side of the app as a tag on a card, and the
  material arrives deck by deck, so the same card comes down more than once.
  It is built from the first deck that carries it, as it was; what was
  thrown away was every deck after that. They are added now, so a card
  carries every deck that lists it — which the deck tiles, the tag picker
  and what a hand-built session is drawn from all read.

- **And a name borrowed by a deck is no longer counted as one of its
  cards.** A card that fills a blank is in no deck: the server sends it with
  whichever deck's phrase leaves a hole of its name, which is not the same
  as being filed there. Those arrived carrying the borrowing deck's name, so
  a deck of one phrase read as a deck of three. A deck's own list is what
  decides now.

## 0.123 — 14 September 2026

- **A verb can be given a name to be listed under.** Arabic and Hebrew have
  no infinitive, so a verb card is saved as the form a dictionary lists it
  under — the he-past — and that is what every list showed: the script of
  one cell of its table, over that cell's own meaning, *he ate*. Nothing was
  wrong with the card. It simply had no name of its own, so it was listed
  under one of its twenty-one boxes.

  **What to call it** is a field at the top of the verb editor, above the
  first tense, and it says what it is for: how the card is listed and
  searched, and that nobody is ever asked it — the table is what is
  practised. Leave it blank and nothing changes; the card is listed as it
  was, and the field names the box it would otherwise be listed under.

  In a list a named card reads as its name, with the script it is built on
  underneath and the pronunciation under that. The dictionary form's own
  meaning goes, because *he ate* under *to eat* reads as a correction of it.
  The name is drawn in the interface face rather than the taught script's: it
  is whatever was typed, and every size in the app is tuned by eye against
  the script, so Latin left at a script size reads as the louder of the two.

  It is searched, too — a verb listed as *to eat* is found under that.

  Only where the table stands in for the card's own word. Huế cites the bare
  verb, which is a word and not a box, so there the card is named by it and
  no field is offered.

## 0.122 — 14 September 2026

- **The kind of card ran off the side of the screen.** Adding *Verb* beside
  *Word or phrase* and *Conversation* put three options on a track that
  sizes every one of them to the longest label and never wraps — so it came
  to three times the width of *Word or phrase*, which is wider than any
  phone. Two of them fitted; the third is what pushed it over the edge.

  It is on the full-width track now, the one the language picker in a course
  already uses for exactly this reason: the options share the width there
  is, the type steps down with them, and where even that will not fit the
  last one keeps its label whole and takes the next line down, with the
  track wrapping around both so it still reads as one control rather than
  as buttons that came apart.

## 0.121 — 14 September 2026

- **A blank is now filled with a word you have got as far with as the
  question is asking.** A card with a gap in it — *My name is ___*, *I like
  ___* — was filled from every card that could fill it, in the order they
  were written, whatever the learner had met. So *English → script* on a
  frame could ask somebody to write a sentence containing a word they had
  never been shown. That is not a hard question, it is one with no answer,
  and the only thing it taught was that the card was impossible.

  The rule is the plain one: to stand in a question, a word has to be as far
  up its own ladder as the question is. To fill a gap in *what does this
  mean*, it has to be a word that has been met at all; to fill one in *write
  it from its meaning*, it has to be a word that can already be written from
  its meaning. The same sentence twice, which is the point of it.

- **A name that is never practised on its own is read off the card that
  teaches it.** Raphael is in the deck to be borrowed, not to be asked
  about, so it has no progress anywhere to look at and never will. For those
  the card itself remembers: a name may stand one level above the highest it
  has already been seen at, so it comes in at the bottom of the ladder and
  climbs with the sentence that introduces it. Remembered on any answer,
  right or wrong — the question is whether you have seen the word.

- **And a question that cannot be filled is not asked at all.** A frame
  whose every value is still ahead of you waits, rather than being asked
  with something you have never seen. It comes back by itself the moment one
  of them catches up, and it no longer takes up one of the places a session
  keeps for new cards while it waits.

- **A fix underneath it.** A session built by hand drilled the names that
  fill a frame as though they were cards in their own right — pick the deck
  a frame lives in and you were asked what Raphael means, which is the one
  question "practised on its own" is switched off to prevent. A dealt
  session has always known better; the hand-built one never asked.

- **Nothing about the teacher's trial changes.** Trying an exercise out on
  your own card fills it from everything, as it did: a teacher is not
  somebody learning, and their material carries no progress to read.

## 0.120 — 14 September 2026

- **A card is a word or phrase, a verb, or a conversation — three answers to
  one question.** *This is a verb* was a tick sitting under the kind of card,
  so the one question about what a card is was asked in two controls stacked
  on each other: pick a kind, then answer a footnote underneath it. It is the
  third answer now.

  The reasoning it replaces was that a verb is not a third kind of card but a
  word with a table as well. That is true of what is stored, and it is still
  true — nothing saved knows the word *verb*, and a card is one exactly when
  its forms carry a table. It was never true of the question a teacher is
  answering, which is what to write.

- **And it is still asked of a card you wrote weeks ago.** What the tick had
  over the selector above it was that it outlived the choice: a verb is
  usually written as a plain word and given its tenses when the course
  reaches them. So a written card is asked the same question and offered the
  answers still open to it — *Word or phrase* and *Verb*, without the
  *Conversation* it can no longer become. Calling a word a verb still moves
  it into the box a dictionary lists it under, with its recordings, and a
  form the card already had stays on screen either way.

- **A verb with a table is now told what it is, rather than offered a change
  that threw the table away.** Untick *This is a verb* on a saved verb, press
  Save, and every box of it went — the words, their recordings, and whatever
  your students had learnt of them — with nothing on screen having said so.
  A conversation has never been allowed to stop being one, for the same
  reason: the turns are the card. A verb's table is the card in just that
  way, so it is not offered either, and the editor says what it is and how to
  undo it — empty the table and it is a word again.

  On a card you are still writing the table can be put aside, because nothing
  has been saved to lose. There the editor counts what is at stake instead:
  *Its table is put aside — 3 boxes filled in.*

- **And a verb can no longer become a conversation with its table still on
  it.** Choosing one answer now clears the other, so a scene can't be saved
  carrying cells that nothing would ever show again.

## 0.119 — 14 September 2026

- **Three ladder tiles to a row, and never more.** They were sized to wrap
  at whatever a screen allowed, which on a phone is two and on anything
  wider spreads six back into one long line. Six tiles are two tidy rows of
  three, so that is what they are, at the size three of them fit — two only
  on a screen narrower than any phone worth designing for.

- **A level's cards open on a screen of their own.** They used to appear as
  a strip underneath the tiles, which put a list of any length between the
  tiles and everything below them: reading it meant scrolling past the
  tiles, and getting back meant scrolling up to find the one that was open
  and pressing it again. The list is what you pressed the tile for, so it
  gets the window, and Back is the way out — the same way out as every
  other screen in the app.

## 0.118 — 14 September 2026

- **Progress has two sections now: the ladder, and your decks.** What was
  there is the first of them; the second is new.

- **The ladder's tiles say what a level asks, not what number it is.** Six
  of them shared one row, which on a phone is three columns of eight-point
  capitals — a row of numbers with captions too small to read, on the
  screen whose whole job is saying where you are. They are twice the size,
  they wrap rather than squeeze, and each one is named: **What it means**,
  **Which word it is**, **Write it from a cue**, **Write it from its
  meaning** — the same words a card's own screen uses — with the level
  number underneath where it is still worth knowing.

  Each carries a drawing of what it asks: a question mark for what a word
  means, a magnifier for picking it out, a copy for writing what is already
  in front of you, a pen for writing it with nothing to copy. **Learnt**
  gets a badge, a larger mark and a tile of its own colour, because it is
  the one the other five are climbing towards.

- **And a Decks section, one tile per deck you are studying.** A large
  percentage of how much of it is learnt outright — every card in it with
  nothing left to open — with a bar beside it and the count it came from.
  A deck of thirty and a deck of three hundred are not comparable by how
  many cards are left, which is why it is a proportion.

  The figure is rounded down and held at 99% until the last card is in: a
  tile reading 100% over a card still to learn is the one number here
  nobody would trust again. A finished deck reads in the same colour as
  Learnt. What the language switch is showing decides which decks appear,
  like everything else in Learning.

## 0.117 — 14 September 2026

**Variables are now Blanks, and you no longer type them.**

- **A button writes the blank, into every field at once.** A card with a
  gap in it — *My name is ___* — needed <code>{{name}}</code> typed by hand
  into the script, the English and the pronunciation, and getting one of
  them wrong was the error the section spent its longest sentence
  explaining. **+ Blank** writes all three together, so they cannot
  disagree. Everything else here follows from that.

- **Blanks are chosen from a list, never spelled.** The old box was free
  text, and it held the editor's only silent failure: typing *names* where
  every other card says *name* was accepted, saved, and filled nothing for
  ever, with nothing on screen to notice. The list shows the blanks this
  language already uses and what each is worth — how many words fill it,
  how many cards leave it — so a near miss is visible before it is made.
  Naming a new one is still there, for the first of its kind.

- **The section shows the sentences a student will actually be asked.**
  Three of them, filled with the words that exist today. Two paragraphs
  explaining what a variable is have gone: the sentences do it better, and
  a blank with nothing to fill it shows as an empty preview and says so.

- **One job at a time.** A card that leaves a blank and a card that fills
  somebody else's are opposite jobs, and both were shown to everybody. Now
  only the one that applies is on screen.

- **<code>{{word}}</code> is a row in the list, not a paragraph.** It is
  the blank every word in the language fills without being told to, which
  is worth knowing exactly when you are choosing a blank and nowhere else.

- **"Practised on its own" is a tick, under the blank it belongs to.** It
  was a third field standing on its own, asked of every card; it is only
  ever a question for a card that fills a blank.

- **A fix underneath all of it.** The accepted-answer rows read the card
  once when the editor opened and never again — invisible while typing was
  the only thing that ever changed them. It is not any more, so they now
  follow a change made anywhere else; without it the button would have
  written to the card and changed nothing on screen.

## 0.116 — 14 September 2026

- **Which decks a card is in is now a button at the top of the editor.** It
  was the last section on the screen — a heading, a paragraph and a tick
  per deck — so the answer to "where does this card go?" sat several
  hundred pixels below the question, under everything about the card's
  words, and a teacher with twenty decks scrolled past twenty rows to reach
  anything after it. It sits beside what kind of card this is now, because
  both are facts about the card rather than about its words, and this one
  decides whether a student ever sees it.

  The button says where the card is — the deck's own name when it is in
  one, how many when it is in several, **In no deck** when it is in none —
  and opens the same list of ticks, the way the language switch in Learning
  works. Nothing about what is saved changes.

- **A verb's table no longer labels one of its boxes.** The box a
  dictionary lists the verb under carried a gold *· the dictionary form*
  beside its pronoun, which made one row a different width and colour from
  the others and asked a teacher to hold a piece of grammar theory in mind
  while typing. The table is a table. Where it matters — a verb cannot be
  saved without that box — the editor now says **Fill in past · he, plus
  its English**, and only while it is true.

## 0.115 — 14 September 2026

- **A verb is no longer offered a form outside its table.** The verb editor
  carried a quietly-worded **Another way to say it** button where an
  ordinary card is offered "Add a form" — on the grounds that a verb might
  genuinely have a second spelling. Two things were wrong with it. A
  spelling is an accepted answer, written beside the one it is an
  alternative to, and never a form of its own; and a form added here is one
  nothing knows the person or tense of, so it is never gated by its row and
  never agrees with a sentence — exactly the mistake the quieter wording
  was meant to head off. The button is gone. A verb's forms are its table.

- **And pressing it did nothing.** It revealed a section rather than making
  one, and it could only ever be on screen while there was nothing to
  reveal — so the first press changed nothing at all and simply turned the
  button into the "Add a form" it was standing in for.

- **A form a card already has is no longer hidden when it is called a
  verb.** Give a word a second form, then tick "This is a verb", and the
  form vanished from the screen while still being saved with the card — so
  the card carried something its own editor would not show. Everything the
  card holds is on screen, whichever kind of card it is called.

## 0.114 — 14 September 2026

- **Writing an Arabic or Hebrew verb no longer asks for the same word
  twice.** Neither language has an infinitive: a dictionary lists the
  he-past, which is one of the boxes in the verb's own table. The app has
  known that for a while — it is why that box is labelled *the dictionary
  form*, and why the card's own word stops being drilled once the box is
  filled — but the card editor went on showing a separate **The verb**
  block above the table asking for the script, the pronunciation, the
  English and the recordings all over again. Two places holding one word,
  for the teacher to keep in step by hand. Worse, that block was headed
  "Drilled in exercises", which by then was not true.

  On those two languages the block is gone. The dictionary form's box is
  the card: what every list shows, what a search matches, what a tile is
  labelled, and what can be heard. The editor says so under the table, and
  will not save a verb whose dictionary form is blank — naming the box it
  is waiting for rather than leaving Save grey with no reason.

- **A word you later call a verb moves into that box.** Tick "This is a
  verb" on a card written weeks ago and its word lands under *he · past*,
  with its recordings, rather than being left behind in a block that has
  just disappeared — which is also the plainest way to learn what the
  dictionary form is. Untick it and the word is still there. A verb
  written before this opens the same way.

- **Vietnamese is unchanged.** Huế cites the bare verb, which is a word and
  not a box in the table, so there **The verb** is the verb and stays
  exactly where it was.

- **And every box in the table is named.** The English and the
  pronunciation in each cell have always said which row and column they
  belong to; the script box beside them never did, which left the field the
  whole card is now identified by unnamed to a screen reader.

## 0.113 — 14 September 2026

- **A hole in a card no longer shouts over the card.** A card with a gap in
  it — *ismi {{name}}* — is listed the way it was written, braces and all,
  because that is what the card is. But the braces are Latin sitting in the
  middle of the taught script, and every size in the app was set by eye
  against Arabic, which leaves room above its letters for the marks and
  below them for the tails. Latin fills far more of that space, so
  `{{name}}` came out bigger and heavier than the Arabic word beside it. On
  a card with two gaps it took both lines of the tile and pushed the Arabic
  off the end.

  A gap is now sized as the Latin it is — the same correction the meaning
  and the pronunciation under it have always had — and set in the quieter
  grey, because it is the shape of the card rather than a word to read. The
  card's own words are untouched.

  In a language whose script is Latin anyway, the gap is left exactly the
  size of the words either side of it. Nothing about this changes what a
  card says or how it is asked: a gap is still filled in before anybody is
  asked the question.

## 0.112 — 14 September 2026

- **Writing الحمدلله as one word is no longer a mistake.** Where one word
  ends and the next begins is a matter of convention in Arabic rather than
  something you either know or don't: الحمد لله is written joined about as
  often as it is written apart, and so are عبد الله and إن شاء الله. Typed
  joined against a card stored apart, the answer came out one character
  short, which was enough to land it in the near-miss band — "Very close",
  marked wrong, and the word sent round again, with every letter of it
  correct.

  Arabic answers are now compared with the spaces taken out of both sides.
  Nothing else about the marking changes: the same answer gets the same
  verdict it would have got typed with its spaces in, a wrong vowel is
  still a wrong vowel, and letters that are not the word's are still not
  the word's. A near miss is now measured on the letters alone, so a gap
  can neither hide a slip nor be counted as one.

  The rule is one the app already applied to transliteration, where it has
  always held that where the spaces fall is a matter of scheme and not of
  knowing the word. It now says the same about the script that scheme
  transliterates.

- **Vietnamese is deliberately left alone.** Every syllable there is its
  own word, so *cảm ơn* run together is not the same kind of slip and is
  still marked as one.

## 0.111 — 14 September 2026

- **"Restore this backup?" was being asked behind the screen that asked
  it.** Upload a backup file, press Restore, and nothing appeared to
  happen: the question was there, underneath the backup screen, and only
  came into view once you had left that screen — by which point it was a
  question about nothing you could still see. Anyone who pressed Restore
  twice, thinking the first press had missed, met it twice.

  The app draws things in layers, and a confirmation is meant to be the
  top one. It was, within the panel it was drawn in — but that panel is
  itself a layer, and the backup screen opens above the whole panel, so
  the confirmation could never climb past it. The confirmation is now
  drawn at the top of the app rather than inside whichever panel asked,
  which is where the screens themselves are drawn. It sits above
  everything, from every part of the app, as it was always meant to.

- **And Escape now answers the confirmation without also closing the
  screen underneath.** One key used to do both.

## 0.110 — 14 September 2026

- **The language menu opened off the side of the screen on a phone.** It
  hung off the switch that opens it, growing leftwards — and the switch
  sits left of the space tabs, which sit left of the menu button in the
  corner. Between them those take about 184 points off the right-hand side,
  so the menu needed a window 444 points wide before it fitted, and every
  phone in portrait is narrower than that. Somebody learning two languages
  who also teaches had it worst, the third tab pushing it further left
  again.

  It now hangs off the right of the window, where the menu in the corner
  already does, so the two line up. It narrows on a small screen rather
  than running off it, and a long list of languages scrolls inside the
  menu rather than off the bottom.

- **And it closes when you open the menu next to it.** The two sat over
  each other in the corner, because each was waiting for a click to reach
  the window and the other was stopping it.

## 0.109 — 14 September 2026

- **Get a card wrong and you get that same card again, not a different
  one.** A card with a hole in it — *My name is {{name}}* — shows a
  different name each time it comes round, so that all of them are met.
  Which name it showed was decided by how many times the card had been
  asked, and a wrong answer counts as an asking. So missing *My name is
  Sarah* got you *My name is Youssef* a moment later: a sentence nobody
  had taught you, turned up by your own mistake. Miss that and the next
  was a third name. You could learn the word on the card long before you
  could ever finish the card.

  It now turns on getting it right. Miss a question and the same question
  comes back until you answer it, which is what asking again is for.
  Answer them all right and you see exactly the variety you did before.

- **The same fix reaches everything that varies between askings**: which
  phrase a word is shown in, which of a card's accepted spellings it asks
  for, and which of its meanings. All of them moved on when you got the
  card wrong, and none of them does now.

## 0.108 — 14 September 2026

- **Learning two languages? Say which you are working on.** A switch at the
  top of Learning, next to the space tabs, lists the languages you have
  cards in with a tick against each. Everything switched on is what the app
  shows you: your cards, your progress, what is ready to practise, and what
  a session is dealt from. Everything starts ticked.

  It is only there if you are learning more than one. One language is not a
  choice, and a switch offering it would be a question with a single
  answer.

  The button itself is an icon and one word, because it lives in the chrome
  where there is room for nothing more — and that word is the state:
  **All** when every language is on, the language's own mark (**AR**,
  **VI**) when only one is, and how many when it is some of them. The rest
  is in the tooltip.

- **The last language on stays on.** An app with no languages in it is a
  blank screen with no way of telling why, so the row holds and says "the
  only one on" rather than refusing without a word.

- **A language you join later is on from the start.** What is stored is
  which languages are switched *off*, so a course in a third language
  arrives in play rather than hidden by a setting written before it
  existed.

- **Starting a session no longer asks which language.** It used to put a
  screen in the way every single time — this one, both, or not now — and
  the answer held for that session only. The switch is the same question
  asked once and kept, and it answers it for the card list and progress
  as well.

## 0.107 — 14 September 2026

- **Progress is the tiles and the cards behind them, and nothing else.**
  Under them stood every deck as a collapsible section, each with its own
  bar, its own "n of m learnt" and its own copy of every card in it — so a
  card appeared once for each deck it was in, and again under whichever
  tile was open. Three views of the same cards on one screen, and the
  tiles are the one that answers what the screen is for.

  The deck sections are gone. What is left is the six tiles and, when you
  press one, its cards grouped by how they are going.

- **A card's tile says which level it is on** when the list is every card
  at once. Under a level it does not: every card there is on that level,
  and the headings say how each is going.

- **The per-card bars have gone with them**, and so has the fraction they
  drew. It was a mean over every exercise of its interval against three
  weeks, which is not something a learner can act on.

- **The Practice button each deck section carried is gone too.** Building
  a session from chosen cards is what the session builder is for, and it
  can pick a deck along with everything else.

- **A card tile can be reached with a keyboard.** They open a card when
  tapped and had no way in from a keyboard at all; the one tile on this
  screen that did was in the deck sections. They now take focus and open
  on Enter or Space, here and in the Cards tab and the teaching space.

## 0.106 — 14 September 2026

- **Open a level in Progress and its cards come out grouped by how they are
  going.** Every card under a level tile is on that level, so what tells
  them apart is the status: **Paused**, then **Learning**, then **Not
  started**, each headed with how many are in it.

  Paused leads because it is the one that means something slipped, and it
  is usually the shortest run — put it last and a learner with a hundred
  cards waiting on a level would never scroll to the two that had gone
  backwards. The list is sorted into that order before it is paged, so a
  run is never half off the end of a page.

  "Cards" is left ungrouped: those are spread over every level, and a run
  of them would mean nothing. "Learnt" is too, because they are all in the
  same state — a heading naming the whole list says nothing.

## 0.105 — 14 September 2026

- **Progress is the ladder now, and says so in words.** A card climbs four
  levels — what it means, which word it is, writing it from a cue, then
  writing it from its meaning alone — and until now no screen showed that
  anywhere. The Progress tab counted cards as New, Learning, Young and
  Mature, which are facts about how long their intervals happen to be, and
  each card carried a percentage that was the average of those intervals
  against three weeks. A card the app had two levels up and was asking to
  be written could read as a third learnt, because eight of its eleven
  exercises had only just opened.

  Both are gone. The tiles at the top of Progress are now one per level,
  plus the cards with nothing left to open, and each card says which level
  it is on and how it is going there:

  - **Not started** — the level has opened and nothing on it has been
    answered yet.
  - **Learning** — some of it has, and not all of it is solid.
  - **Done** — everything under the next level is solid enough to open it.
  - **Paused** — the level had opened and a slip further down has shut it
    again. Nothing is lost, and the card says what has to come back.

- **A card's own screen lists its levels.** Open a card from Progress or
  from Cards and there is a row per level, with the one being worked on
  marked and a count of how much of what has to hold for the next level
  does. It is the answer to "why am I not being asked to write this yet?",
  which the app had never given anywhere.

- **A level a card has no material for is not shown at all.** A
  conversation has nothing on the second or fourth level; a word with no
  recording and no phrase may have nothing on the third. The ladder passes
  those straight through, so listing them would be pointing at work that
  does not exist.

- **One vocabulary, checked against itself.** A level reads *done* exactly
  when the scheduler opens the one above it — the same test, asked once —
  so what a learner is told and what the app deals from are the same
  answer rather than two that can drift. The young-and-mature counting
  stays where it always was, out of sight, because the limit on new cards
  needs a finer distinction than a person does.

## 0.104 — 14 September 2026

Three more changes to how hard the app makes things, from the same audit
of the levels that 0.103 came out of. The numbers quoted are from
simulations run against the app's own scheduler, one session a day with
three exercises per form.

- **A near miss always moves the interval now.** Nearly right — the right
  letters with the wrong tone, the wrong haraka, one letter out —
  stretched the gap before the next review by a fifth, and a fifth of one
  day rounds back to one day. So did a fifth of two. A learner whose
  mistake was always that same small one answered the same word that way
  every day for ever: the interval never grew, so the exercise was never
  mastered, so the level above it never opened, and nothing on the screen
  said why the writing never arrived. A near miss is now worth at least a
  day more than last time. It still costs the card its ease and is still
  counted as wrong; what it cannot do any more is stand still.

- **New cards keep the places they are given.** Everything due ranks
  together and is shuffled, so a new card admitted by "New cards per
  session" was left to take its chance against every card waiting for
  review, and on any day with a queue behind it fell off the end of the
  session. It now goes to the front. Which cards join it, and the order
  they are asked in, are unchanged.

- **A hint no longer counts as knowing the word.** *English → script* and
  *fill the gap* offer the transliteration as a nudge, which on those two
  questions is the answer spelled out another way: reading it turns the
  hardest question in the app into the one a level below. With Hints set
  to On it was opened on every question by itself, and nothing recorded
  that it had been — so a learner with hints on could climb to the top of
  the ladder having never once written a word from its meaning alone.

  On those two questions the nudge now stays closed until you ask for it,
  and an answer written with it open is marked as a near miss and comes
  round again before the session ends. The screen says so rather than
  doing it quietly. Every other hint is unchanged, and how often each
  exercise was answered with its hint up is now kept.

- **The bar each level asks is written down once.** 0.103 put it on every
  exercise — nine copies of one fact, held in step by a test — and it is
  now a four-line table beside them, read off the level an exercise stands
  on. Nothing behaves differently, and there is no longer anything for two
  exercises on a level to disagree about.

- **What was measured and not changed.** A card counts as *learning* while
  any exercise open to it is unanswered, which includes a level that
  opened this morning — and that is what keeps the ten-card limit full and
  holds a learner to about a card every three days. Passing those over was
  tried and measured: it admitted about five more cards over a hundred and
  twenty days and mastered three fewer, because the session budget does
  not grow with them. The limit is doing its job; a longer session is what
  buys more new cards.

## 0.103 — 14 September 2026

- **Writing a word from a cue now opens as soon as you have recognised it,
  not four days later.** Level 3 — {translit} → script, listen → script,
  listen → tone, choose the reply, put a scene in order — asked that every
  recognition exercise below it first reach a four-day interval. That is
  four right answers each, on the app's fastest possible schedule three
  days, and in practice a week or more per card of nothing but choosing
  between four. New cards kept arriving at the bottom while none of them
  climbed, so the deck grew sideways: a lot of words recognised, none of
  them written.

  It now opens on *graduated* — through the learning steps and in review,
  at whatever interval — which is the bar the matching grid has always
  asked. The reasoning is the grid's, too: level 3 is still cued. The
  pronunciation is on the screen, or the word is in your ear. It asks you
  to spell what you have just been given, which is not the same as
  producing it from memory.

- **Writing it from its meaning alone is unchanged.** Level 4 — English →
  script, fill the gap, phrase heard → script — still waits for every
  exercise below it to be mastered, four days of interval and in review. The
  strict bar now stands in one place: where the screen stops telling you
  what the word is.

- **A slip still closes what is above it.** Graduated is false while a card
  is being relearnt, so getting a word wrong takes the writing away until
  the reading is back — as it always did.

- **Every exercise on a level now names that level's bar.** The bar belongs
  to the level, and the app takes the loosest one any exercise on it
  declares — so the matching grid alone had been setting level 2's rule
  while the two beside it said something stricter and were quietly ignored.
  Nothing behaved differently; it simply read as though it did. A test now
  holds every level to one answer.

## 0.102 — 14 September 2026

- **Start session works again on a deck whose cards accept two spellings.**
  Pressing it did nothing whatever: the screen was right, the count of what
  was ready was right, and the button was dead. Which deck you were
  studying decided it, so the same build was fine on one account and unusable
  on another — and there was nothing on screen to say why.

  A second accepted answer has been practised in its own right since 0.99,
  under a schedule of its own that is written the first time it is answered
  and not before. Everything that reads one already allowed for its not
  being there yet; the part that builds a session did not, and stopped on
  the first card that had one. Nothing was wrong with the cards, and nothing
  about them has been changed to fix it.

## 0.101 — 13 September 2026

- **A language with no infinitive now says which form a dictionary lists,
  and that form is no longer learnt twice.** Arabic has no *to eat*: a
  dictionary lists أكل, which is the he-past and so one of the card's own
  cells. The card's word and that cell were the same word asked, marked
  and scheduled as if they were two things to learn.

  Arabic and Hebrew cite the he-past. The card keeps its word — it is what
  the card shows in every list and what carries the meaning *to eat* — and
  the cell is what is practised. Vietnamese cites nothing, because there
  the bare verb is the card's own word and there is nothing to reconcile;
  nothing about it changes.

- **The cited form is met the day the card is.** It sits in the past,
  which is the second row, so it would otherwise have waited behind the
  whole present tense — leaving a learner holding a card that says *to
  eat* and never showing them the word. The rest of its row still waits
  its turn, and the row still has to be mastered in full before the
  command opens.

- **Left blank, nothing is assumed.** A teacher who has not filled the
  cited cell in has a verb whose word is all there is of it, and it goes
  on being practised as itself.

## 0.100 — 13 September 2026

- **`{{word}}` is filled by every word you teach, with nothing written on
  them.** Every other variable is a name you invent and then write on each
  card that stands in it, which is right for a hole with a particular sort
  of thing in it and wrong for the commonest frame there is. Write *I like
  {{word}}* once and it is met with the whole vocabulary, and a word added
  next month joins in without the frame being touched.

  Only words fill it — not a phrase, not a conversation, and never a card
  with a hole of its own, which dropped into another hole would be a
  sentence with a gap where the point was. A card that already fills a
  variable of yours fills both.

- **The counts at the top of Progress open.** New, Learning, Young and
  Mature, and the total beside them, were plain text, so the only way to
  find out which cards were still new was to read down every deck. Press
  one and its cards appear underneath at the smallest size they come in,
  searchable, each opening the card. Press it again to put them away. A
  count with nothing behind it is dimmed rather than hidden, because the
  number is still the answer to how many there are.

## 0.99 — 13 September 2026

- **A second accepted answer is now practised in its own right.** A card
  accepting two words for one meaning was showing them turn about but
  keeping a single record of how they were going, so knowing one counted
  as knowing both. Each now carries its own progress, comes up on its own
  schedule, and holds the card back until it too is known — the same rule
  a verb's table already follows, where every person and tense stands
  alone.

  It applies to the questions that put one word on the screen: reading it,
  telling it apart, hearing it. Writing the word from its meaning stays one
  question with one record, because either spelling answers it, and
  listening does too, since a recording belongs to the card rather than to
  one of its spellings.

- **Nothing already learnt was disturbed.** The first accepted answer keeps
  the record it had, so every card reads back exactly as it did and two
  devices go on agreeing without being told anything new. A card with one
  answer — almost all of them — is untouched in every particular. A second
  answer simply starts fresh, which is the truth about it: it has never
  been practised on its own before now.

## 0.98 — 13 September 2026

- **A question shows one accepted answer, never all of them.** A card that
  accepts two spellings was putting both up, joined by a slash, wherever
  the word itself was on screen. The matching grid was the worst of it —
  both spellings on one tile and both meanings on another, so the longest
  tile in the grid was the answer, given away by its shape rather than by
  what it meant.

  Now every question that shows the word shows one, rotated so that both
  are met, one at a time. That covers the grid's two columns, the word
  above a question, and the four words or meanings a question offers to
  choose between, including the three wrong ones drawn from other cards.

- **What is accepted has not moved.** Asked to write the word in the
  script, every accepted spelling is still right — that is what a second
  accepted answer is for. The rule now has a name in the language table
  and a test that holds it against every exercise there is, so a type
  added later cannot quietly pick the wrong side of it.

## 0.97 — 13 September 2026

- **"English for this row" is gone. Each form's meaning is typed on the
  form.** The box wrote a whole row from one word — *ate* giving *I ate*,
  *she ate* — which saved typing and produced wrong English where it
  mattered most. The present tense came out as *he eat* and *she eat*
  beside *I eat*, and the command offered *I: eat!* for every person it
  does not apply to. Correcting it was work on every regular verb a
  teacher would ever write.

  Knowing better would mean the app knowing that English marks the third
  person, which is exactly the kind of thing the language packs exist to
  keep out of it. So each box says what somebody typed in it, and nothing
  is derived.

## 0.96 — 13 September 2026

- **Every form of a verb can now carry its pronunciation and its own
  recordings.** Each cell of the table has a box for how it is said and a
  microphone beside it, so *she ate* can be heard as well as read — and
  with a recording on it, a cell is asked by ear too, like any other form.

  The pronunciation box appears only where the language writes one that is
  drilled. Huế calls it a note and never asks it, so its table stays at two
  boxes a cell and the note sits on the verb itself, where it always did.

- **The table stayed the same height doing it.** A cell is one line: the
  person, the form, how it is said, what it means, and one microphone that
  lights up once something is recorded. The recordings list and its
  explanation, which every ordinary form gets, would have doubled the
  height of a twenty-one cell table, so a cell gets the button alone and
  the same recording screen behind it. On a phone the boxes fall into two
  short lines rather than three stacked ones.

## 0.95 — 13 September 2026

- **"This is a verb" is now a tick inside The kind of card**, instead of a
  block of its own further down with a button and two paragraphs
  explaining itself. Both questions about what a card is are answered in
  one place, in two lines.

  A tick rather than a third option beside *Word or phrase* and
  *Conversation*, because a verb is not a third kind of card: it is a
  word, with a table as well. It also stays offered on a card that is
  already saved, which the selector beside it is not.

- **The verb copy is gone.** What was explained in sentences is read off
  the screen instead: an empty box in the table is plainly an empty box,
  and each tense says in its own heading when it opens.

## 0.94 — 13 September 2026

- **A verb card's editor now reads as a verb's.** The main form is called
  *The verb* rather than *Form 1*, and says the conjugations are in the
  table above — a block numbered as the first of many, sitting under a
  table of twenty-one forms, read as though the table were forms two
  onwards.

- **"Add a form" is put away on a verb**, behind *Another way to say it*.
  It was the one place the screen invited a mistake: a teacher wanting the
  past tense would reach for it and write a conjugation outside the table,
  where nothing knows its person or tense — so it would never wait for its
  row to open and never agree with a sentence. The door stays open for what
  it is actually for, a second spelling or another dialect, and a card that
  already carries one opens showing it.

## 0.93 — 13 September 2026

- **"Is this a verb?" now sits directly under the kind of card**, instead
  of below the forms where a teacher could write a whole verb without ever
  scrolling to it. Both questions about what a card is are now in one
  place, at the top.

  It stays a control of its own rather than a third option beside *Word or
  phrase* and *Conversation*, because the two questions have different
  lifetimes. What shape a card is settles when it is written — a word
  cannot become a conversation — and that selector is read-only once the
  card exists. Whether a word conjugates is not like that: a verb is often
  written as a plain word and given its table weeks later, when the course
  reaches tenses. Folded into the selector it would inherit the lock, and
  the only way to add a table would be to delete the card, losing its
  recordings and every student's progress on it.

## 0.92 — 13 September 2026

- **Verb cards.** A verb is not one thing to know, and this is the first
  release that says so. Where a language lays its verbs out in a table,
  the card editor offers one: write each form under the person and tense
  it belongs to, and leave a box empty where the language has no such form
  — there is no command for *I* — and it is never asked.

  Each form is drilled in its own right, by the exercises every other form
  already gets, and each keeps its own schedule. A shaky past no longer
  drags the present along with it.

  The rows and columns belong to the language, not the app. Palestinian
  Arabic and Hebrew declare seven persons; Huế declares one, because
  nothing about a Vietnamese verb changes for who is doing it, and its rows
  are the markers in front — *đã*, *đang*, *sẽ*. A language that lays out
  no verbs shows no table at all.

- **One tense of a verb is ever new at a time.** The rows open in the order
  the language teaches them, each waiting until every form in the row above
  it is mastered. The past of a verb is not asked until its present is
  known well, and a lapse in the present closes the rows above it until it
  is recovered — the ladder the app already climbs, turned on its side. A
  row a teacher left blank is passed straight through.

- **A verb agrees with what fills the sentence around it.** A card may
  carry a sentence with its own place marked — `{{name}} {{verb}}
  {{object}}` — and the form that stands there follows whatever fills the
  holes: Sarah makes it *she ate*, Ahmad *he ate*, the children *they ate*.
  Nothing has to be added to a name for this. Its number and gender are
  already on its card, which is what the note on variables in
  `DECISIONS.md` said would make this possible one day.

- **A card may now carry sixty-four forms, up from twelve.** Twelve is
  three fewer than the smallest useful Arabic table, so a teacher would
  have filled in twenty-one forms, saved, and got back the first twelve
  with nothing anywhere saying so.

## 0.91 — 13 September 2026

- **In the verb-card proposal, a verb's sentence agrees with what fills
  it.** A verb card carries a sentence of its own — *{{name}} [verb]
  {{object}}* — and the verb's form follows the number and gender of
  whatever fills the holes, which the app already records on every
  answer: Sarah makes it *she ate*, the children *they ate*. Each
  language says which hole decides which axis; Vietnamese says none does.
  Still a proposal; nothing in the app changes.

## 0.90 — 13 September 2026

- **A simpler plan for verbs and variables in the proposal.** Every cell
  of a verb card fills a hole named for it — *{{she-past}}* takes the
  she · past cell of every verb the learner has met — and that is the
  whole mechanism. A frame with a name hole beside it is kept agreeing
  by the teacher's choice of fillers, not by the app reading a name's
  gender; wanting both *he* and *she* is two frames. Nothing is inferred.
  Still a proposal; nothing in the app changes.

## 0.89 — 13 September 2026

- **The verb-card proposal asks in English, and meets variables.** A
  learner is asked *she ate*, not *to eat · she · past*: a row gets its
  English once and a cell overrides it only where English differs, with
  the pronoun coming from the column. A new section says how a verb fits
  a hole in a card — as the thing in the hole, or following whatever is
  (Sarah makes it *she ate*), with who from the subject and when from the
  frame. Still a proposal; nothing in the app changes.

## 0.88 — 13 September 2026

- **The verb-card proposal now opens tenses one after another.** A verb's
  first row is dealt as soon as the base word is known, and each next row
  waits until the one before it is mastered — so the past of a verb is not
  asked until its present is known well, and the future waits on the past.
  Which row comes first is listed by the language, not decided by the app.
  Still a proposal; nothing in the app changes.

## 0.87 — 13 September 2026

- **A proposal for verb cards**, in `docs/PROPOSAL-verb-cards.md`: one card
  holding a verb's forms in a table whose rows and columns each language
  names for itself, with exercises that ask for a single cell — write the
  form for *she · past*, say who and when a form is, or fill a gap in a
  sentence with the form that fits. Nothing in the app changes yet; this is
  the shape of the thing, for discussion.

## 0.86 — 13 September 2026

- **Two new exercises, both answered by tapping one of four.**
  **Choose the meaning** puts the word up with four meanings under it, and
  **English → choose** gives the meaning and offers four words. Between them
  they are the two halves of knowing a word before you can write it, and
  neither asks you to write anything.

  Choose the meaning is now the first thing a card is ever asked: nothing is
  produced, the answer is on the screen, and all it asks is that the word be
  told from three others. It sits below writing the meaning out. English →
  choose is a level up, beside the matching grid, because it asks for the
  word rather than for what it means — so a card is not asked it until its
  meaning is known.

  Like the grid, both draw their wrong answers from the learner's other
  cards in the same language, and neither is offered on a card with a
  variable in it: a filled-in sentence standing among three bare words is
  the answer given away by its length.

- **Choosing the missing word moved up a level too.** It asks for the word,
  out of four, which is the same thing English → choose asks — so it now
  waits for the meaning to be known rather than being one of the first
  things a card is asked.

- **The ladder is now four levels**, and the word for one of its steps is
  **level** throughout — in the app, in the settings, and in what the
  exercises are called:

  1. What the word means — choose the meaning, {script} → English, listen →
     English, read a scene through.
  2. Which word it is — match the pairs, English → choose, choose the
     missing word.
  3. Write it from a cue — {translit} → script, listen → script, listen →
     tone, choose the reply, put a scene in order.
  4. Write it from its meaning — English → script, fill the gap, phrase
     heard → script.

- **Home counts what is actually waiting.** "Cards ready to practice" now
  counts a card only where something is due on a level it has reached. A
  card whose next review is tomorrow used to be counted because an exercise
  it has not unlocked yet had never been asked.

## 0.85 — 12 September 2026

- **A word is met alone before it is met among others.** Match the pairs
  now has a level of its own on the ladder, above reading a word on its own
  and below producing it: a card joins a grid only once its single-word
  recognition exercises — script → English, listen → English, choose the
  missing word — are through the learning steps and in review. That is the
  graduation bar rather than the four-day one the rest of the ladder asks,
  because the grid is still recognition and a first week without any grid
  would have been the wrong week. The level above the grid — writing from
  the transliteration, from sound — opens only once the grid, too, is
  mastered.

  So a card you have never seen is never dealt into a matching grid, as a
  question or as company. A learner's very first session has no grid at
  all; the second usually does.

## 0.84 — 12 September 2026

- **A card is recognised before it is produced.** Every exercise type now
  stands on a level: recognition (match the pairs, script → English, listen →
  English, choose the missing word, read a scene through), then producing
  the word from a cue (transliteration → script, listen → script, listen →
  tone, choose the reply, put a scene in order), then producing it from its
  meaning alone (English → script, fill the gap, phrase heard → script). A
  card is asked the next level only once every exercise it supports on the
  levels below is mastered — in review, four days of interval or more. Slip
  on the reading and the writing closes again until you have it back.

  Before this, every exercise a card supported was on the table from the
  day it was written, softened only by a preference for recognition on the
  very first outing: a word you had read once could be asked to be written
  from memory the next day.

- **New cards are introduced only while there is room.** On top of "New
  cards per session", nothing new is dealt while ten cards are already
  being learnt, or forty are young and still coming back for review. The
  settings say so under the slider. Sessions built by hand are not
  limited, since you chose the cards.

- **Match the pairs is five questions, not one.** Every word in the grid is
  now asked, marked and scheduled in its own right — a word paired wrong
  shows the meaning it wanted, under it, and comes back the way any missed
  word does. The grid's company is dealt when the session is built: the
  words the session was going to ask anyway, filled out from cards you have
  already met, the most alike first. A word dealt in to fill the grid that
  was not due is credited for a right answer without its schedule moving.
  Nothing you have never met is dealt into a grid, so a grid cannot bring in
  a card the new-card rules did not admit. A grid can be as small as three
  words when fewer have been met — a first session's three new words is
  still a question — and one that cannot be filled to three is not dealt:
  those words are asked something else instead.

- **Progress reads "Learning" for a card met and not done.** A card with
  one exercise answered and another not yet — a level just opened, a plural
  not yet asked — used to count as New, beside a card written this morning.
  New now means never met.

## 0.83 — 12 September 2026

- **Teaching · a filter for the values.** Cards → Filter now has a
  **Variables** group: *Any card*, *Fills one*, or *Fills none*. Pick "fills
  one" and the variables your cards stand in for are listed — `{{name}}`,
  `{{colour}}` — with how many cards fill each, to tick as many as you want.
- It is the filter for both halves of the job. Forty names make a card list
  hard to read, so "fills none" gives you back the material a student is
  actually asked about; "fills one" with `{{name}}` ticked is every name you
  have written, in one screen, to check them over.
- The variables in the list are read off the cards themselves, so one
  appears the moment a card says it fills it and goes when the last card
  filling it does.

## 0.82 — 12 September 2026

- **Match the pairs reads across rather than down.** The words in the
  language you are learning are a column on the left and their meanings a
  column on the right, side by side at every width. They were laid out that
  way already on a wide screen, and stacked into one column under 420px —
  which is most phones, so the shape nearly everybody met was the stacked
  one: five words above seven meanings, with the pair you were considering
  at opposite ends of a scroll.
- What the stacking was protecting against — two columns of script at the
  size a word is held up at — is handled where it belongs: inside a tile the
  script is set smaller than a word asked on its own, smaller again on a
  phone, and a word too long for its column wraps rather than pushing the
  other column off the screen.

## 0.81 — 12 September 2026

- **A new exercise: Match the pairs.** Five words down one side, their
  meanings down the other, tapped together. It is dealt in ordinary practice
  sessions alongside everything else, and it is one of the gentle exercises,
  so "Get started" offers it too.

  It is here because of what it asks of a card, which is nothing. Every other
  exercise needs something extra before it can be set — a recording, a phrase
  the word turns up in, a second accepted answer — and a card that is only a
  word and its meaning could be asked one gentle question, over and over. This
  one works on every card you own, from the first day.

  Two things keep it an exercise rather than a game. There are seven meanings
  against five words, so eliminating never completes and the last pair is
  never free. And the four words standing beside the one being asked are not
  drawn at random: they are the ones most like it, by the same reading of
  "alike" the session builder uses to bring related cards into one sitting —
  telling apart things that resemble each other is the skill a
  one-word-at-a-time question cannot train. The company is redrawn as a card
  comes round again, so a word is not always met beside the same four.

  Only the card being asked is marked. The others are the company that made it
  a question, and a pass that quietly advanced six cards at once would be
  inflating six schedules on the weakest evidence any exercise produces.

  A card is offered it once its language has a few others to stand beside it;
  until then the teaching space says so, in the same place it says which cards
  are waiting for a recording.
- Not offered on a card with a variable in it, and such a card never stands
  in somebody else's grid: only the card being asked has its hole filled, so
  a frame among the five would show the `{{name}}` it left open. The Try
  list says so, in the same place it says why a listening exercise is out.

## 0.80 — 12 September 2026

- **Teaching · a card can leave a word open.** Write `{{name}}` anywhere in
  a card — in every field that has words in it — and make separate cards
  for Raphael, Victor and Sarah, each saying it fills `name`. The question
  a student is asked is then "My name is Raphael", and "My name is Victor"
  the next time it comes round. A frame learnt as one lump is a sentence
  somebody can say once; met as all three it is a sentence they can say
  about anyone.
- Which name comes up turns over as the card comes round again, the way the
  phrase a word is shown in does — nothing is drawn at random, so the
  sentence never changes under you mid-answer, and a card with two holes
  reaches every combination before it repeats one.
- **Every card now says whether it is practised on its own.** A value —
  "Raphael" — is turned off by default: it is there to fill a hole in
  somebody else's sentence, and "what does Raphael mean" is not a question.
  It is a choice on every card, so a name can be drilled as well as
  borrowed if that is what you want.
- Values reach students with every deck whose phrases need them, whatever
  deck they are filed in, and a name added today arrives today.
- Two things a variable costs, both said out loud rather than left to be
  discovered. Listening exercises are not offered on a card with a hole in
  it — the recording says one of the names and the next question wants
  another — and the card can't be practised at all until something fills
  the hole. Both appear under "Try an exercise" with the reason.
- A card whose fields disagree about their holes can't be saved: a frame
  whose English has a hole and whose script has not would ask for a name
  and mark an answer that never contained one.

## 0.79 — 12 September 2026

- **The language's own name is a name again, wherever it is written.** The
  app said "Write in arabic script", "English → arabic script", "No arabic
  script — this form can't be practiced": the pack's label was lowered
  whenever it fell in the middle of a line, which is right for "the
  transliteration" and wrong for Arabic, Vietnamese and Hebrew. Every
  exercise name, instruction, question and "Needs …" line now reads Arabic
  script, in every language.
- The one place it stays lowercase is the importer's example row —
  `english | arabic script | …` — because those are cells to copy, and a
  capital there would read as part of what to type.

## 0.78 — 12 September 2026

- **Learning · the line above a question** no longer says "this card". It is
  "Write in English", "Write in Arabic script", where it was "Write this
  card in English" — the card is the thing on the screen underneath, and
  naming it was two words of furniture on the one line a learner reads at
  every single question.

## 0.77 — 12 September 2026

- **Teaching · one set of controls over every card list.** The Cards tab and
  an open deck showed the same material through two different screens: the
  tab could be sorted and narrowed, a deck could do neither, and its cards
  came in whatever order they arrived. Both now carry the same two rows —
  New card, the search box and a size button on the first; Select, Sort and
  Filter on the second — and the same settings, so a deck opened while the
  list is narrowed opens narrowed the same way.
- Select is a button with its name on it rather than an unlabelled icon
  beside the search box, where it read as another way of finding something.
  Sort and Filter are two buttons rather than one called "Sort and filter",
  each opening its own panel, and only one is open at a time.
- **The size button draws the cards bigger** — three steps, each with fewer
  cards to a row and the word, the meaning and the date all set larger. It
  is remembered on the device, so the size you work at is the size the next
  screen opens at.
- **A new filter: which decks a card is in, or is not in.** Tick any number
  of decks and see the cards in them, or the cards in none of them — which
  is how to find what a deck is missing, and what is in no deck at all and
  so reaches nobody. A mode with nothing ticked narrows nothing.

## 0.76 — 12 September 2026

- **Learning · writing a card from its meaning.** A card may mean more than
  one thing — "office / desk" — and both are still right when the question
  is what the word means. Asked the other way round, the question now shows
  one meaning instead of the pair: before this the prompt read as a single
  English phrase with a slash through the middle of it, and a card that
  meant two things gave away more of itself than the question meant to.
- Which one it shows turns over as the card comes round again, the way the
  phrase a word is shown in does, so a card that means two things is asked
  from both — one at a time. What the app accepts has not changed: the
  answer is the word, and every spelling of it still counts.

## 0.75 — 12 September 2026

- Nothing you can see. The comment above the list of exercise types
  described five conversation exercises "in the order a learner meets
  them" — reading a line, choosing a reply, writing your own turn,
  rebuilding the scene, playing a whole part. Three of those were retired
  releases ago and the list beside it names three, so the comment counted
  exercises no session can ask. It is gone rather than rewritten: each
  exercise's own entry already says what it needs and how it is marked.

## 0.74 — 11 September 2026

- **Teaching · adding cards to a deck.** The deck list now has a New deck
  button, so somewhere to put them can be made on the spot. Before this, a
  teacher who had selected thirty cards and found no deck for them had to
  leave and make one — which threw the selection away, so the way out of
  the screen was to lose the work that got you there. The new deck is
  ticked as soon as it is made, and takes its language from the cards going
  into it.
- **Learning · keeping a session you built.** The last step of Build a
  session is now called Finish, and besides the length it offers to keep
  what you just built. Kept sessions are under a new Saved sessions button,
  beside Build a session.
- What is kept is the description — which cards, which mode, how long — not
  a snapshot, so a card edited since is practised as it now reads. A card
  deleted since simply drops out, and the list says so before you start
  rather than after.

## 0.73 — 11 September 2026

- Selecting cards in Teaching no longer hides the last ones. The bulk
  actions tray floats at the foot of the window, and the list carried on
  underneath it — so the cards you were reaching for were behind the
  buttons acting on them. The list now leaves exactly the tray's own room,
  measured, so it stays right whatever the buttons say and however narrow
  the phone is.

## 0.72 — 11 September 2026

- Nothing you can see; an audit of 0.71. The linter had quietly stopped
  reading the app the moment its files were renamed — its file pattern
  named the old extensions — so the checks it exists for (a hook called
  conditionally, a dependency list that lies) were off for every screen.
  It reads them again, through a parser already in the tree.
- Six imports the conversion left dead are gone, and a cast that let one
  screen name a lookup table where a component was wanted is replaced by
  a type that refuses it.
- An Arabic answer typed in "presentation forms" — the same letters, in
  the encoding some keyboards and most clipboards use, which looks
  identical on screen — was marked wrong in every letter: a flat
  "Incorrect" with no "Very close", for a word that was right or one
  hamza off. The checker now folds those shapes back to letters before
  comparing, in every language.
- The "Hamza and final letters" setting now says everything it does:
  lenient also takes و for ؤ and ي for ئ, which it always did and never
  said — so an answer marked wrong on exactly that letter could not be
  checked against the setting's own description.
- **Hosting: Node 22.18 or newer is now the stated floor** (it was "22").
  The server imports a TypeScript file, and stripping types unflagged
  began at 22.18. Earlier 22s fail at startup. If you deploy this, check
  which 22 you are on.

## 0.71 — 11 September 2026

- Nothing you can see. The migration 0.70 started is finished: every file
  the app is built from is TypeScript now, screens included, rather than
  JavaScript with its types written beside it in comments. It is checked
  the same way it was, by the same command, and still builds and runs with
  no step added.
- What it found, all of it in code nobody was editing. `Verdicts` was being
  read as though it had any number of keys when it has four. `verdictWord`
  took an arbitrary string and had a word for none of them. Several
  components declared props as required that every caller was already
  leaving out, and several more said `Set` where the list they were handed
  to wanted `Set<string>`. Two generics — the item list and the segmented
  picker — had been declared generic in a comment the checker was ignoring,
  so what went in and what came out were unrelated.
- Two shapes the card editor relied on and nothing stated: what a
  confirmation is, and that a draft carries a conversation's speakers and
  lines only when the card is a conversation.
- The reasoning, and what the conversion script got wrong, is in
  DECISIONS.md.

## 0.70 — 11 September 2026

- Nothing you can see. The modules that decide what a learner is asked —
  the scheduler, the exercise table's rules, conversations, accepted
  answers — are written in TypeScript now rather than in JavaScript with
  types in comments. They were checked before and are checked the same way;
  what changed is that the types are in the code rather than beside it.
- It is being done a module at a time from the outside in, with everything
  green at each step. Seven of twenty-one so far, and the reasoning is in
  DECISIONS.md.
- Three real defects fell out of it on the way, all in files nobody was
  editing: two places passing the wrong shape into the card editor, a test
  reading a value that is null on the first line of a conversation, and a
  guard that would have stopped checking a file the moment it was
  converted.

## 0.69 — 11 September 2026

- Gender, number and whatever else a language names now belong to an
  accepted answer rather than to the card over all of them. A card may
  accept two answers that differ in exactly those things — "I'm happy" said
  by a man and by a woman is one thing to know with two right answers — and
  a single "masculine" over the pair described one of them and was wrong
  about the other.
- They are written where they apply: one row per accepted answer holding
  the answer, how it is said, and what it is. The grammar is folded away
  behind its own name, so a card with one answer and the usual values looks
  no busier than before.
- Answering such a card now says which one you wrote. "Correct" was true
  and unhelpful when the card took both the masculine and the feminine.
- Cards you have already written convert themselves the first time they are
  opened. Each answer keeps the values the card carried, which is what they
  meant when there was only one set of them, and a card with one answer —
  almost all of them — comes through unchanged.
- Why it is built this way, and what it cost, is written down in
  DECISIONS.md.

## 0.68 — 11 September 2026

- A conversation is now a run of chat bubbles: the words in a box only as
  wide as it needs to be, with whoever said them named above it.
- Which is also the fix for the bug. A turn was a block the width of the
  page, and a block that wide puts its text at whichever end the text
  itself starts from — so an Arabic line sat hard against the right of its
  column whichever side of the page that column was on, and both speakers
  came out down the right with only their names on opposite sides.
- The same fault was there for a language written left to right, mirrored
  and quieter: the far speaker's words started at the left of their column
  too, so they were nudged over by the indent but never reached the other
  side. Both are gone. A box that hugs its words cannot do it: where the
  words sit is where the box is.
- Each side is tinted the colour of the name above it, so a scene still
  reads as two people at arm's length. Three or four speakers keep one
  column of bubbles, like a group chat — there is still no third side of a
  page.

## 0.67 — 11 September 2026

- Three conversation exercises are gone. Translating one line was the word
  question with a speaker's name over it — what makes a line worth having
  is the turn before it and the turn after. Writing your own next turn
  asked for one particular sentence out of the several that would do and
  marked the rest wrong. Playing a whole part was the longest answer in the
  app and the least forgiving: one missed mark in the third line made the
  whole conversation wrong.
- In their place, the one that asks what a conversation is actually for.
  The whole scene in the language, laid out the way a teacher sees it on
  the card, with how it sounds and what it means each a tap away — taken
  when you need them rather than given. Then it asks whether you could
  follow all of it, and takes your word for it. Nobody else was in the
  room; an app that pretended to check would be marking something it never
  saw.
- What a conversation is asked now: read it through, choose what comes
  next, put it back in order.
- Conversations you have written are untouched. The part a scene names is
  the one thing left with nothing reading it — the picker and the line on
  the card still say whose it is, but no exercise asks for it any more.

## 0.66 — 11 September 2026

- A conversation between two people now reads with one of them down each
  side, everywhere it appears: read through at the start of a session,
  played a part in, put back in order, read on the card, and written in the
  editor. Whose turn it is is something you see rather than something you
  read off a name — which is what made a scene of six turns a thing to
  parse rather than scan.
- The one who opens takes the leading side. Not the student's own part: a
  card may leave that unset and the question then picks a different one
  each sitting, so a scene would reflect itself between them.
- A scene of three or four keeps its list. There is no third side of a
  page, and the names are already doing that work there.
- In the editor each turn also carries its speaker's name in its heading
  and a rule in their colour down its own edge — the block keeps most of
  its width, because a form is fields and half a phone is not enough for
  one.
- It follows the script rather than the screen, so an Arabic or Hebrew
  scene puts its opener where an Arabic or Hebrew reader starts.

## 0.65 — 11 September 2026

- Each accepted answer now carries its own transliteration. A card that
  accepts two spellings is a card with two words on it, each said its own
  way — one transliteration under the pair belonged to one of them and lied
  about the other, and a question built from it could show one
  pronunciation and mark the other spelling right.
- They are written together: one row per accepted answer, holding the
  answer and how that one is said. Adding an answer adds both cells,
  removing one removes both, so the two can never drift apart.
- A question about pronunciation is now a question about one answer. Asked
  how a card sounds, or asked to write it from its sound, you get one
  spelling and one pronunciation — and a card with two is drilled on both,
  one at a time. Asked what a card means, every accepted answer is still
  accepted.
- Nothing to migrate. The pairing is by position in the two lists a card
  already stores, so every card written so far — one answer, one
  transliteration — already reads correctly.

## 0.64 — 11 September 2026

- The bar at the foot of a question reaches both edges of the window. It
  was a 700px column, so on a desktop the painted strip stopped mid-screen
  with the page showing past each end — a card that failed to stretch
  rather than the foot of the screen. The buttons stay in their column,
  centred, and are sized by it rather than by the window.
- Trying an exercise in Teaching no longer counts you through it. One
  question has no "1 / 1" and no bar that can only be empty or full; the
  way out is still there.
- And answering it puts you back on the card you were reading, rather than
  on a screen congratulating you for having looked at your own material.
  Closing it unanswered lands in the same place.
- A conversation is a kind of card, and now says so. It had a button of
  its own for making one — which made it read as a separate sort of thing,
  and meant the Cards tab, with only the one New button, could not make one
  at all. There is one New card, and the first field asks what kind. An
  existing card shows its kind instead of offering it: a word does not
  become a conversation by being edited.
- The editor is called "New card" and "Edit card" whichever kind it holds,
  a conversation is marked as one in the card lists, and the two save paths
  that used to build two different objects are one.

## 0.63 — 11 September 2026

- In context could not see conversations. A scene keeps its words in its
  turns and has no text of its own, so the report read an empty string off
  every one and skipped it: a word taught only through dialogue showed as
  turning up nowhere, the turns using it never came up to confirm, and a
  deck taught entirely through conversation measured at nothing. The
  exercises had been drilling those words inside those turns the whole
  time — the two halves of the app disagreed about what the material
  contained. They agree now.
- A turn is offered as a turn: it says who speaks it, and confirming the
  link writes it onto that line rather than onto the scene, which is where
  the session builder reads it from.
- Words a conversation keeps using and nothing teaches are offered as cards
  worth writing, alongside the ones your phrases use.
- The same blindness in a deck's own In context section is gone too. It
  counts a conversation as the one card it is and matches it as the several
  turns it holds, so the tally now reads "3 words · 1 conversation" rather
  than silently filing a scene under phrases.

## 0.62 — 11 September 2026

- Opening a conversation to edit it put the word editor up: one script box,
  one meaning, and the whole scene out of reach behind it. A stored card
  carries its turns but nothing labelling it a conversation, and every
  teacher's screen was asking for the label rather than looking at the
  turns. The turns are the conversation now, which is how the student's
  copy has always read it. The same fix puts a scene's readout right —
  who spoke and what they said, instead of an empty word card.
- A conversation no longer makes you name whose part the student takes.
  Most scenes are worth holding up from either end, and being asked to pick
  a side before the second line is written is a question with no reason to
  have an answer. "Either" is how a new one starts; name a part where only
  that side is worth producing.
- Left open, the exercise picks — and takes the parts in turn, so a scene
  met twice has been played from both ends. Conversations you have already
  written keep the part they were saved with.

## 0.61 — 11 September 2026

- A card opened in Cards no longer ends with "Where it lives". Which decks
  a card sits in, and which language pack it belongs to, are a teacher's
  questions about their own material; a student opened the card to look at
  the card. The panel is untouched in Teaching and Admin, where it is the
  thing people came for.
- The card's note used to be a row inside that panel, so dropping it would
  have dropped the note with it — and the note is the one line in there
  written for the student to read. It stands on its own now, on both sides.

## 0.60 — 11 September 2026

- In context reads as four tiles rather than one long page, and the
  language it is about is asked at the top instead of underneath the
  numbers it decides. Each of the three lists is one job — a tap, a card to
  write, a phrase to write — so each gets a tile of its own.
- Those lists had quietly inherited the indent and the left rule belonging
  to a deck's context report, because the two screens were sharing a class
  name. They have their own now.

## 0.59 — 11 September 2026

- Trying an exercise now lives where the cards are written. Open one of
  your own cards in Teaching and every exercise it could be asked is listed
  at the foot, one button each; press one and that question runs for real,
  through the screen a student is asked on, using the card you are looking
  at. It was on the student's card screen, which was the wrong side of the
  app: a student is practising, not checking their material.
- Nothing is recorded. The card is your teaching material rather than
  something this device is learning, so no progress is kept, nothing is
  scheduled, and the day's count does not move.
- And leaving asks nothing. A session asks before you abandon it because
  there is work to lose; a trial has none, so the way out is the way out.
- The exercises a card cannot do yet are listed too, out of reach and
  saying what they are waiting for — a recording, the meaning, a phrase
  that uses the word.

## 0.58 — 11 September 2026

- Opening a card now lists every exercise it could be asked, one button
  each, at the foot of the screen. Press one and that single question runs
  on that card — marked, so you see how it is judged, but not scheduled,
  because trying a question out should not move where the card sits in your
  review.
- The exercises the card cannot do yet are listed too, out of reach and
  saying what they are waiting for: a recording, the meaning, a phrase that
  uses the word. A card one field short of two more exercises had nothing
  anywhere that said so.
- Exercises that are not about this shape of card, or that the language
  never drills, are left out rather than shown as impossible — a word card
  is not waiting for a conversation.

## 0.57 — 11 September 2026

- A word is now met inside a phrase before it has to be written into one.
  The gap-fill used to start at the hard half — type the missing word — so
  a learner's first meeting with a word in context was also their first
  chance to get it wrong. There is a gentler question in front of it now:
  the phrase with the word missing and four words offered, one of them
  right, drawn from words the learner has actually met.
- The phrase a word turns up in is shown after any question about that
  word, not only the two questions built out of it. Answer the word on its
  own and the sentence it lives in is there under Learn more, a different
  one each time where there is more than one. Every link a teacher has
  made now pays out on every question about that word.
- Arabic finds a word under what is stuck to the end of it as well as the
  front: كتابك is كتاب. A phrase using a word in the most ordinary way
  there is — with somebody owning it — used to teach that word to nobody.
- A word of more than one syllable can be the word inside a sentence, which
  is most of the Vietnamese vocabulary. The gap covers the whole of it
  rather than half.
- Teaching has a new tab, In context: the phrases that contain a word you
  teach and do not say so, one tap each; the words your phrases keep using
  that no card covers, most used first, each opening a half-written card;
  and the words you teach that turn up in nothing at all. Saving a word
  card now says when phrases you have already written contain it.
- A word and the phrase it appears in are now the most closely related two
  cards the app knows of, so a session that reaches for one brings the
  other with it — the word on its own first, then the word in use.

## 0.56 — 11 September 2026

- Sessions are no longer the same session every time. Leaving one half way
  through and starting another gave back the same questions in the same
  order — and would have gone on doing so, because nothing in the building
  of a session ever rolled a die: it was built out of orderings, and what
  those left equal stayed in the order the cards happened to be added in.
- The orderings still stand; what they call equal is now shuffled. A lower
  rank always comes first — what is due before what is not, the easiest
  first while you are warming up, recognition before production on a card
  you have just met — and chance settles the rest.
- Everything already due now ranks together. A card due last week is not
  more urgent than one due this morning, and ordering by the exact minute
  each fell due was ordering by nothing: it is what made two sessions built
  a minute apart identical down to the last question. With a backlog, a
  session now takes a fair draw from what is due rather than the same
  oldest few every time.
- Which new cards a session opens with, and which exercises a card is
  drilled in, vary the same way — so a card met twice in a week is not met
  the same way twice.

## 0.55 — 11 September 2026

- A card can hold a whole conversation. A teacher writes the scene — what
  it is called, who is in it, and the turns in order — and it reaches a
  student the way every other card does. Each line is practised in its own
  right, keeps its own progress, and counts towards the card being learnt.
- Five things get asked of a scene, and none of them needs a recording:
  what a line means, which reply comes next, writing your own turn, putting
  the lines back in the order they were said, and playing your whole part
  from the first turn to the last. Where a line does have a recording it
  can be heard as well as read; where it has none, nothing is missing.
- A conversation is never opened with a blank. The first time you meet one
  it is simply shown to you, lines and meanings together, with nothing
  marked — and a scene you have already met is not introduced again.
- A scene offers a line or two a session rather than all of itself, so a
  six-line conversation is learnt across a few evenings instead of taking
  an evening over.
- Where a line uses words you are already learning, those words are now
  practised inside it: the gap-fill has real exchanges to put them in,
  which it can only otherwise do with a phrase somebody recorded.
- Both halves of a question are now coloured the way they are read: the
  instruction is grey and the word being asked about carries the ink.

## 0.54 — 10 September 2026

- A right answer typed in full has nothing shown under the verdict — the
  answer is already in the box you typed it into, and repeating it says
  nothing. The praise is then the whole of what the screen came back with,
  so it is now set large enough to be that: about half again the size of a
  verdict that is introducing an answer below it. Everything else about it
  is unchanged, and a verdict with an answer under it is the size it was.
- On a question, the line telling you what to do is grey and the word being
  asked about is in full ink. It was the other way round, which put the
  weight on the sentence that reads the same on every exercise of a kind
  rather than on the one thing that changes from card to card.

## 0.53 — 10 September 2026

- Every deploy reported a crash, and every deploy cut off whatever request
  was in flight. Neither was the deploy failing: the host was starting the
  server through npm, so the signal that says "stop now" reached npm and
  stopped there. The server never heard it, and npm's own death by signal
  is a non-zero exit, which is what the crash notice was reporting.
- The deploy now starts the server directly, which is a one-line file in the
  repository rather than a setting in a dashboard, and the shutdown the
  server has always been careful about actually runs.

## 0.52 — 10 September 2026

- Backing up and restoring are screens of their own now, and both ask what
  the file should hold: people, courses, decks, cards, recordings. All of it
  is the backup to keep; less of it is for the times you want the wording of
  every card without a gigabyte of audio behind it, or one part of a site
  put back without touching the rest.
- A restore offers only the parts the file actually holds, and a file that
  was made without a part is no longer reported as a broken file for not
  having it.
- "Check a file" and "Restore a file" are now "Verify a backup" and "Restore
  a backup", and verifying says what it is for: a download cut short or a
  file half-copied off a laptop looks perfectly good sitting on disk, and
  this is how you find out on a quiet afternoon rather than during a
  recovery.
- Admin → App has a danger zone: clear the site of the same parts a backup
  is made of. It asks for the deploy's admin key as well as an
  administrator's account, and keeps the account of whoever runs it — a site
  nobody can sign in to is not a site anyone can put right.

## 0.51 — 10 September 2026

- Getting onto a newly deployed version took a press of Reload and two
  refreshes. It now takes one refresh, or none: the app puts itself onto
  the new build as soon as the new version has arrived, and Reload does it
  in a single press.
- What was happening: the app's offline copy is kept by a worker that hands
  over as soon as a new one is installed, and installing it is something a
  page load does. So the load that fetched the new version was still
  showing the old one, and only the load after that showed the new — while
  pressing Reload part way through the handover started it again.
- It waits for a moment that isn't in the way: never in the middle of a
  question, and an app left open takes the new version the next time it is
  put away, so coming back to it is coming back to the current one.

## 0.50 — 10 September 2026

- The two recordings on a listening question now split the row two thirds
  to one: the one the card is asking for takes the wider share, the other
  the narrower. Both are the same height and both still say what they are —
  the difference is how much room each has, which holds the same on a small
  phone as on a large one.

## 0.49 — 10 September 2026

- The recording the card is asking for now sits on the left, whichever
  speed it is, and the other one to the right of it. The quieter one is the
  same height as its neighbour again — a short button beside a tall one
  read as a lesser kind of control — and gives up width instead: the
  padding either side goes, so it takes only the room its icon and label
  need.

## 0.48 — 10 September 2026

- Pressing the button while a recording is playing now stops it. It had
  said Pause since the icons went in and started the clip over instead,
  which is the one thing pause cannot mean. Pressing the other recording
  still switches straight to it.
- The recording a card's progress did not ask for is now smaller as well as
  quieter, so which of the two the question is about can be seen without
  reading either label. It is still a full-sized thing to press.

## 0.47 — 10 September 2026

- Which recording a listening question opens with now follows how far along
  the card is. While a word is new, being learnt, or has just been missed,
  the slow one plays and the ordinary one waits quietly beside it; from the
  point the card is being reviewed it is the other way round, because
  hearing the word at the speed it is really said is the thing being
  learnt.
- Both are always there and either can be pressed — the one the card did
  not ask for simply gives up its fill and the colour on its icon, and takes
  them back when you reach for it. Nothing about this changes how an answer
  is marked or when the card comes round again.

## 0.46 — 10 September 2026

- A listening question now offers at most two buttons: the word, and the
  word said slowly. Where a card holds both they sit side by side, told
  apart by their icons — a solid play triangle, and the same triangle in a
  broken circle. The ordinary one is what plays by itself.
- The numbered row of voices under the button is gone with the thing it
  picked. A teacher who recorded a word three times to get it right left
  three takes on the card; ranking them was never a question a learner
  wanted put to them. All of them are still on the card, and the teacher's
  screen still lists every one.

## 0.45 — 10 September 2026

- If you're studying more than one language, Start session now asks which
  one — or offers all of them in a single mixed session. With one language
  it starts straight away, as before. Whichever you pick is what "Keep
  going" carries on with.
- Underneath that, a card now says which language it is in and is treated
  accordingly: how its answer is marked, which exercises it supports, which
  way its script runs, and which keys the answer box offers. Before, all of
  that came from the one language the app was set to, so somebody in two
  courses had half their cards read by the other language's rules.
- Cards already on a device are taken to be in the language the app is set
  to, which is what they were made under; course material says for itself
  from the next time it arrives.

## 0.44 — 10 September 2026

- A card can now hold two kinds of recording: the word at regular speed,
  and the word said slowly. Either, both or neither — a teacher decides per
  form, and each recording says on it which it is.
- Making them has moved off the card editor and onto a screen of its own,
  which comes up from the foot of the window and goes again. The editor
  still lists what a form has and plays it, which is the part you want
  while you are looking at the words.
- On that screen each speed has its own section saying in a line what it is
  for, and each can be recorded on the spot or uploaded from a file.
- A slow recording reaches a learner named as such, beside the ordinary one
  rather than in place of it: a listening exercise still plays the word as
  it is really said.

## 0.43 — 10 September 2026

- On a long report in Admin → Flags, the words now sit directly under the
  title they carry on from, rather than between the question and the small
  facts under it, where they read as a caption on the wrong thing. The
  title takes a shorter run at them — about two lines — so the head of the
  report does not become the report.

## 0.42 — 10 September 2026

- A report in Admin → Flags no longer says the same words twice. Since the
  title took them over, the block underneath only holds what the title
  could not — a long report, or one written over several lines — and a
  short one is said once.

## 0.41 — 10 September 2026

- The flag panel's heading is centred, and under it a line says why it is
  worth the half minute: any issue or feedback you report helps us improve
  the app.
- The box for "Something else" is drawn as the lower half of that option
  rather than as a fourth thing sitting under three — one outline around
  both, and it lights with the option when that is the one chosen.
- Sending one now says "Thank you for the feedback 🫶".
- Admin → Flags heads each report with the words that were typed —
  "Something else: I don't understand how this app works" — so a screen of
  them can be read down rather than opened one at a time. The whole of what
  was written is still set out on the report itself.

## 0.40 — 9 September 2026

- Reporting a problem with a question is one panel now, and it stands on
  top of the bar at the foot rather than floating above it — so Continue is
  no longer live an inch below Send while you are part way through saying
  what was wrong.
- The panel says "Flag a problem" at its top, which is what the button it
  covers said.
- Everything in it is there from the moment it opens: the box for
  "Something else", and Back and Send under the three options. Picking one
  now only picks it — nothing is sent until you press Send, and Send waits
  until something is chosen. Before, picking one of the first two sent the
  report there and then, and the only way to reach a button was to pick
  "Something else".

## 0.39 — 9 September 2026

- Learning → Courses no longer shows a "My courses" heading over nothing
  before you have joined one. Until there is a first course, the screen is
  the line saying what to do and the box to enter the code in.
- The Play button in a listening exercise has a much larger icon and
  slightly larger label. It is the one thing you press on that screen and it
  was the size of a full stop.
- A deck's line in Teaching and in Admin now says "Available to students in
  the course *Arabic 101*" — naming one course or several — instead of
  "Students see it in".
- Teacher join codes are gone from the Teaching space; a course there shows
  its student code only. A teacher code hands over control of the material,
  so who holds one is the administrator's decision, and Admin is where it is
  handed out.

## 0.38 — 9 September 2026

- Saving a card could fail if somebody deleted one of its decks at the same
  moment. The save re-read the deck to pick up the change and got nothing
  back, then tried to use it anyway. It now keeps the copy it already had.
  Rare, and the sort of rare that happens on the one afternoon two people
  are tidying decks together.
- Everything else in this release is under the floor: the code is now read
  by a type checker as well as by the linter and the tests, a file at a
  time, starting with the ones where the app and the server hand things to
  each other. It found the bug above. `README.md` says how it works, for
  anyone working on the code.

## 0.37 — 9 September 2026

- Reports in Admin → Flags named the wrong card, which showed up in two
  ways. Some were marked "the learner's own card" — about course material
  the learner did not make and cannot change, and in a version of the app
  where making your own cards is switched off, so there is no such thing.
  Others offered **Open card** and then said the card no longer existed,
  about cards sitting untouched in a deck.
- One cause behind both: course material reaches a device under its own
  local name, and the report carried that rather than the card's name on
  the site, so nothing could ever be found under it. The app now reports
  the card's own id, and the server recognises the local form as well, so
  the reports already sent are readable rather than lost.
- A report about a card the site genuinely does not hold now says "No card
  on the site" rather than claiming it belongs to the learner — and it is
  kept apart from "Card deleted", which means the card was there when the
  report was sent and has gone since.
- A report made before this recorded what it needed no longer guesses. It
  says nothing about whether the card has been edited, because it cannot
  know, and its Open card button works.

## 0.36 — 9 September 2026

- Admin → Flags gives each report the full width of the screen. They were
  laid out in the grid the card list uses, which is right for a word and
  its meaning and wrong for four lines of somebody's own words: every
  report wrapped into a narrow column and none of them could be skimmed.
- Each one says **Submitted by** in front of the name. A bare name beside a
  date, on a screen full of other people's cards, reads as easily as whose
  card it was as who reported it.
- **Open card** on a report shows the card as it stands now — the word,
  every other form, the recordings, the decks it is in. Admin lists decks
  rather than cards, so until now a report was something you had to go
  hunting for in the teaching space.
- And a report says what has become of its card since it was sent: *Card
  edited since* when it has been saved at least once — it may already be
  fixed — or *Card deleted* when there is nothing left to open. A card the
  learner made for themselves is marked as theirs, because it lives on
  their device and the site does not hold it.

## 0.35 — 9 September 2026

- Flagging a bad question now asks what was wrong in a way that can be
  answered. The four one-line options are three cards, each with a title
  and a line saying when to pick it: "My answer should have been
  accepted", "The card's data is incorrect", and "Something else" — which
  opens a box to say what happened in your own words. Two of the old
  labels described the machinery rather than the complaint, and the
  reports that came back were guesses as often as not.
- What you send now reaches somebody who can act on it. Admin has a Flags
  tab listing every report — what was wrong, the question it was about,
  the words the person added, who sent it and when — newest first,
  searchable, and cleared once the card is fixed. Until now a flag was
  only a private mark on your own copy of the card, which nobody else
  could ever see.
- A flag carries a copy of the question rather than a pointer to the card,
  so it still reads months later, after the card has been edited or
  withdrawn. Nothing else about your practice is sent.
- The hint button on a question is drawn like the "I don't know" beside
  it — an outline rather than a filled block. The two are the same sort of
  thing, and the filled one read as the louder of the pair.

## 0.34 — 8 September 2026

- Sync now brings every space you belong to up to date, not just your own
  cards and the courses you study. An administrator pressing it gets the
  latest of everything in Admin — who has signed in, who has practiced,
  what has been made — and a teacher gets their courses, decks and cards.
  Before, sync knew nothing about those screens: they refreshed
  themselves every forty-five seconds and when the window came back, and
  there was no way to ask for them now short of reloading the whole app.
- It reaches the spaces you are not looking at as well, so the one you
  switch to next is already current rather than fetching on arrival. If
  the space is on screen, it updates in place — no second request.
- The dot in the corner covers all of it: it stays amber until every part
  has finished, and turns red if any part failed. "Up to date" now means
  everything, not just the part sync used to cover.

## 0.33 — 8 September 2026

- Switching between Learning, Teaching and Admin no longer flashes
  "Working…". Two things caused it. The app threw away everything it knew
  about a space the moment you left it, so coming back meant fetching the
  whole site again from nothing; and it announced that wait the instant it
  began, however short it turned out to be. Now each space keeps what it
  was last showing and puts it straight back on screen, checking for
  changes quietly behind it — the same check that already runs every
  minute or so. Switching is instant after the first visit.
- When there is a real wait — a slow connection, a first visit — the app
  says so only after about half a second, and says it in the same place
  confirmations appear, floating clear of the page. Nothing on screen
  moves for it. Before, the message was a line above the tabs that shoved
  the whole page down and pulled it back a moment later.

## 0.32 — 8 September 2026

- Tapping anything on a phone no longer flashes a grey square. The flash
  was the browser's own, drawn as a rectangle over the whole button
  whatever shape the button actually was, so a round icon button, a pill
  and a rounded card all lit up as blocks. The app now draws the press
  itself: a light tint that takes the shape it is pressing, on buttons,
  pills, tabs, cards and the rows that open something. Text-only buttons
  like "Report this" get a rounded press area of their own, and holding a
  button no longer selects its label.
- A filled button no longer stays brightened after being tapped. On a
  touchscreen the hover look sticks to the last thing you touched, and
  this one had been left out of the rule that turns hover off there, so a
  Create or Save button looked busy long after it had finished.

## 0.31 — 8 September 2026

- A person's courses in Admin > People are grouped by what they do in
  them. "Teacher in" once, then the courses they teach; "Student in"
  once, then the courses they study. They used to be a run of badges with
  the role repeated in front of every course, so somebody in six courses
  meant reading the word "Student" six times to reach the six names —
  which are the part that differs. Each course now says what it teaches
  underneath its title, the way it does in the list you pick a course
  from, and somebody in none of them says "In no course" rather than
  showing nothing. Admin stays a badge: it is something a person is, not
  a course they are in.

## 0.30 — 8 September 2026

- Admin > Decks has a filter beside the search box: one button, which
  opens a list of everyone who has made a deck, with how many each of
  them made. Picking a name shows their decks and nothing else. Search
  already matched the maker's name, but only if you knew whose name to
  type, which is the thing you don't know when you are looking at decks
  made by six different people. Anything selected is dropped when the
  filter changes, so a bulk delete can never reach a deck the filter has
  taken off the screen.
- A person's card in Admin > People now says when they were last seen,
  when they last practiced, and when they last made or changed a card or
  a deck — each with the date and the time. They are three different
  questions: somebody who opens the app every morning and never practices
  looks exactly like a diligent student under one "last active" line, and
  a teacher whose course has gone quiet looks like a teacher who is still
  writing cards.
- Practising is recorded on the server the way nothing else about it is:
  the app says "some learning happened" and the server keeps the moment.
  What was practiced and how it went stay in the document on the device,
  which the server cannot read. The app says so at most once a quarter of
  an hour, so a long session is one small message rather than one per
  answer.
- The "Hasn't signed in yet" pill has gone from a person's card. The line
  underneath it says the same thing, beside the two questions it belongs
  with.

## 0.29 — 8 September 2026

- When you type a word correctly but without its vowel marks, the app
  says well done and adds "The harakat are above — worth a look." The
  marks were not above: because the answer was right, the app did not
  show the word, so the only thing on screen was the unmarked spelling
  you had just typed and the nudge pointed at nothing. The properly
  marked spelling is now shown, with the nudge directly under it. The
  same fix reaches the tone marks in Vietnamese and the niqqud in Hebrew,
  which say the same thing.
- Nothing about marking changes: typed marks still have to be right, and
  a course that requires them still marks a bare answer wrong.

## 0.28 — 8 September 2026

The people in a course are now one list rather than two.

- **Everyone appears once.** Teaching and studying are separate things
  someone can hold, and the old screen showed one list of teachers and
  one of students end to end — so a person doing both was listed twice,
  with two identical rows.
- **Each person's roles are two switches** rather than two badges you can
  only read. Switching one off drops just that role. Switching off the
  last one is the way out of the course, and it is the only thing that
  asks first.
- **Fixed: removing someone from one role removed them from both.** Both
  of those duplicate rows had a remove button, and both took the person
  out of the course entirely — so dropping a teacher silently unenrolled
  them as a student, with nothing in the confirmation to say so.
- **One way in.** "Assign a teacher" and "Enrol a student" were two
  buttons opening two pickers, neither showing what the person already
  was. There is one "Add someone" now, offering only people who are not
  in the course, and the role you switch on is the one they arrive with.
- **A new person can be created as both at once**, instead of being made
  with one role and then edited to add the other.
- Making someone a teacher does not quietly enrol them as a student. If
  they want the course's cards in their own practice, that is the second
  switch.

## 0.27 — 8 September 2026

- A course can be renamed. In Admin, open a course and its name now sits
  at the top with a Rename beside it. Only the name changes: the join
  codes, the people in it and the decks attached to it are all held
  against the course itself, not its title, so nothing has to be handed
  out again and nobody loses access.

## 0.26 — 8 September 2026

Nothing here changes what the app does. All three are about making the
next change less likely to break it, which an audit said was the weakest
thing about the code.

- **The tests now run themselves.** Every push and every pull request
  runs the linter, the tests, the harness that renders the app, and the
  build. Before this nothing ran unless someone remembered — and the one
  check that opens a session and answers a question was not even part of
  the test command, so it could go a week without running.
- **A linter, and the 130 things it found.** Among them: a key defined
  twice in the server, so one of the two had never done anything; a whole
  CSV export nothing offered; a deck filter left reading as though it
  still worked when nothing could set it; and a card-selection feature
  wired to nothing. All removed. Twenty-one hooks were reading values
  they had not declared — every one turned out to be deliberate, and each
  now says why in a sentence, so the next one that isn't will stand out.
- **The scheduling maths can be tested.** The part that decides when a
  card comes back had no tests and could not have any: it lived inside
  the screen file and read the clock as it went. It is now its own piece
  with the clock passed in, and thirty tests hold it to exact numbers —
  a good answer on a ten-day card gives twenty-five days, ease never
  falls below 1.3, a forgotten card is halved and comes back in ten
  minutes. Each was checked by breaking the maths on purpose and
  confirming the tests noticed.
- **What happens when two devices disagree.** The sync tests only ever
  merged things that did not conflict. There are now tests for a phone
  and a laptop editing the same card: which edit wins, what is kept, and
  — written down plainly rather than glossed — what is lost. The list of
  exercise types those tests ran against had been copied by hand and had
  been wrong by two for months; it is taken from the real list now.

## 0.25 — 8 September 2026

- In the menu in the top right, "Sync now" is a button with a stroke, and
  it is the only part of that row you can tap. The whole row used to
  start a sync, so reading how sync was getting on — which is what the
  row is there for — meant risking the thing it was reporting.
- The app's name in the top left no longer looks like a button. It sat
  between two real buttons wearing the same pill, the same stroke and the
  same shadow, so it read as the third control in the row. It keeps a
  soft ground behind it, because a fixed name over a scrolling page is
  unreadable without one, but nothing else.

## 0.24 — 8 September 2026

- The English meaning and the romanisation are now sized as the Latin
  they are, rather than at sizes meant for Arabic. Every size in the app
  was chosen by eye against Arabic, which spends part of its height on
  the harakat above and the tails below; Latin puts nearly all of its
  height on the line, so the same number came out looking bigger. The
  meaning was reading louder than the word being learnt, which is
  backwards. It now takes the same reduction Vietnamese already takes —
  Vietnamese being Latin — so in a Vietnamese course the word and its
  meaning come out at one size again, as they should.
- The word being taught does not move by a pixel, in any language.
- The question still sits exactly as far below its instruction as it did,
  whichever field fills it. A smaller line has less space above it, so a
  smaller meaning would have crept upward; it is given that space back.

## 0.23 — 8 September 2026

- The stylesheet no longer knows what Arabic is. Where a piece of the
  taught script was drawn, the stylesheet used to name an Arabic typeface
  and right-to-left as what to use if the language had not reached it.
  Arabic was the only language for a long time, so that read as a
  sensible safety net; with three languages it means anything the
  language fails to reach still looks finished, and looks Arabic. It now
  falls back to the interface typeface reading left to right, so a
  language that goes missing looks like the fault it is. A test refuses
  any new fallback, so the old shape cannot come back quietly.
- Fixed: the app's own name at the top of the sign-in screen — مُفْرَدات
  — was being drawn in the typeface of whatever language you were
  learning, so a Vietnamese learner saw an Arabic word rendered in a
  Latin face, and it changed size with the language too. It is the
  product's name rather than anything you are studying, so it now keeps
  its own face at its own size whatever you are learning.
- Fixed: the box you type your answer into was aligned to the right,
  which is where Arabic and Hebrew begin but where Vietnamese ends — so
  Vietnamese was typed into a right-aligned field. It now aligns to
  wherever the language you are learning begins, which leaves Arabic and
  Hebrew exactly as they were.
- Fixed: the internal component gallery drew its sample card with no
  typeface of its own and relied on that same Arabic safety net. It uses
  the real Arabic language description now, like the app does.

## 0.22 — 8 September 2026

- Each language now renders at a size tuned to its script. A font size
  sets the box a letter sits in, not the height of the letter, and how
  much of that box a script fills differs — Arabic leaves room above for
  harakat and below for the tails of ب and ج. Every size in the app was
  tuned by eye against Arabic and then shared with every language, so
  Vietnamese came out oversized. Each language now says how much to
  multiply by: Arabic is 1, so nothing about it moves by a single pixel,
  and Vietnamese is 0.78. Hebrew says nothing and so renders unchanged,
  which is also the proof that adding a language never means touching the
  stylesheet.
- Fixed: in the learner's own card editor, the preview of the word was
  drawn in the interface typeface at the size of a statistic, instead of
  in the script's own face at its own size.

## 0.21 — 7 September 2026

- In a practice session, the question and the verdict are now grey rather
  than full-strength text — the same grey the app already uses for
  secondary writing. The verdict's green and red are gone with it: the
  words say which it was, and a wrong answer no longer meets a wall of red
  at the moment it is least wanted.
- The question sits closer under its instruction, and the answer sits
  further below the box you typed in.
- The on-screen keyboards keep their layout at any width. A row of letters
  never folds in half now — the keys share the row and the type steps down
  to fit, so the top row of an Arabic or Hebrew keyboard is where anyone
  who has used one would look for it. The row of word-labelled keys —
  space, clear, hide — still wraps, because "space" cannot shrink to the
  width of a letter.
- Admin → App has a new section, "A question and an answer": every named
  piece of the two practice screens, with what it is and an example of
  what it holds. Naming the piece is the quickest way to ask for a change
  to either screen. A test keeps the list and the screens in step, in both
  directions.

## 0.20 — 7 September 2026

- "Israeli Hebrew" is now called "Modern Hebrew" wherever the language is
  named.
- The selected tab — Home, Progress, Cards, Courses, and the tabs in the
  Teaching and Admin spaces — carries a dark grey outline, so which one
  is current reads at a glance rather than by shade alone. The stylesheet
  had asked for this outline all along, but in a colour that was never
  defined, and a border in a colour that does not exist is quietly thrown
  away. That is why it kept not appearing. The colour exists now.
- The same mistake had also taken the highlight off the select-mode button
  and picked tiles, and left fifteen other rules naming an "ink" colour
  that inherited whatever was around them. All three colours are defined
  now, and a check fails the build if any colour the stylesheet uses is
  ever left undefined again.

## 0.19 — 7 September 2026

- Tapping "I don't know" no longer says "Incorrect. The correct answer
  is:" — nothing was offered to be incorrect. It says "The answer is:",
  in the ordinary text colour rather than the red of a miss.
- The verdict always fits on one line. "Incorrect. The correct answer
  is:" is 496px wide at full size and a phone's column is 288px, so the
  verdict now takes its size from the screen — about 16px on the narrowest
  phone, 20px at 390px, the full 28px from 540px up — and every verdict on
  a given screen is that one size.
- The box you type an answer into is one height whichever language you
  are typing: 64px, a little over what the English box was, and well under
  the 102px the script box was. Each script keeps its own type size.
- Editing a card: the taught-language field and the English field each
  have a + at the end to add another accepted answer, and a − to take one
  away. Several answers are still stored the way they always were — with
  a slash between them — so the checker and every existing card are
  untouched; the slash is simply no longer something a teacher types.

## 0.18 — 7 September 2026

- **Hebrew.** The app now teaches Modern Hebrew alongside Palestinian
  Arabic and Huế Vietnamese. A teacher can make a Hebrew course, deck and
  cards; a student who joins one is switched to Hebrew and sees it right
  to left in a Hebrew typeface, with the standard Israeli keyboard and a
  separate row of niqqud. Marking works the way Arabic's does: type the
  bare letters or the fully pointed spelling and either is accepted, but
  niqqud you do type have to be right. A beginner who types כ at the end
  of a word is not marked wrong for ך — that's a leniency a teacher can
  tighten. After an answer, "Built on the same root" gathers the family:
  כָּתַב shows כּוֹתֵב, מִכְתָּב and כְּתִיבָה.
- The Marking settings in App preferences now belong to the language you
  are learning. They were Arabic's two, written out by hand and shown to
  everyone — a Vietnamese learner was asked about harakat, and Vietnamese's
  own tone-marks setting had no control at all. Each language now shows
  its own; Hebrew's are niqqud and final letters.
- Importing cards: a table headed with a language's own column names
  ("Hebrew", "Pronunciation note") is read as a table — only "Arabic" used
  to be recognised — and the worked example and placeholder are in the
  language you are learning. The importer also asks the language which
  cell holds the word, rather than checking for Arabic letters.
- The card editor and the bulk-import screens no longer say "Arabic"
  where they meant whichever language you are learning.
- The course-language picker in course settings fits a third name on a
  phone: it now wraps onto a second row instead of running off the
  screen.

## 0.17 — 7 September 2026

- The foot of an exercise screen no longer has a line across its middle:
  "Can't listen right now" and "Flag a problem" sit on the same ground as
  the buttons below them, with one edge at the top of the whole foot. Both
  now carry an icon — a crossed-out speaker and a flag — and both sit
  centred between that edge and the buttons.
- New wording after an answer. A miss says "Incorrect. The correct answer
  is:" and hands over to the answer below it. A hit rotates through
  "Correct!", "Good job!", "Nicely done!" and "Great!" in order, so a long
  session does not say the same word twenty times.
- The verdict is large again — 28px — and the same size in every exercise.
- What else is worth knowing about a card now opens on a tap. Under the
  answer there is a small "Learn more" with a chevron; the box was open by
  default and put five blocks of context between you and the Continue
  button. It opens closed on every new question.

## 0.16 — 7 September 2026

- "Can't listen right now" is now plain text with no outline or fill, like
  "Flag a problem", and sits pinned just above the buttons at the foot of
  the question screen. It used to be a bordered button in the middle of
  the page, which read as a fourth thing to do with the question rather
  than a way past it.
- "Flag a problem" moves to that same place on the answer screen: pinned
  above the Continue bar instead of trailing below the answer, where a
  long answer meant scrolling to reach it. Its menu now opens upward.
- The verdict — "That's right", "Not quite — here it is" — is smaller, and
  is now always smaller than the answer it introduces. At its old size it
  was bigger than the answer in four of the five shapes an answer takes.

## 0.15 — 7 September 2026

- In a practice session, the question is now asked at the same size and
  the same distance below the instruction whatever the exercise is. It
  used to be sized by whichever field the exercise happened to put there:
  the same card was asked at 44px as a word to translate, 25px as a
  meaning to write out, and 19px in grey as a romanisation — the size and
  colour of a hint, for the one thing on the screen that is the question.
  The gap under the instruction moved with it, between 18px and 33px.
- A listening question's Play button now starts exactly where a written
  question's first letter does, so switching between the two no longer
  shifts the screen.
- The size still gets smaller on a narrow screen and smaller again with
  the phone keyboard up. Those are about the room available, not about
  the exercise.

## 0.14 — 7 September 2026

- Card tiles on the Progress tab now open the card when you tap one — the
  same full-screen card the Cards tab shows. They were the one place in
  the app where a small card told you how well you knew it and then had
  nothing to say when you asked to see it. The tiles in Learning → Cards,
  Teaching → Cards and inside a deck already opened, and still do.
- Those progress tiles are also reachable with a keyboard now: Tab to one,
  press Enter.

## 0.13 — 7 September 2026

- The Cards tab, in both Learning and Teaching, now shows the same small
  tile the progress screen uses: the word, its meaning, and the date it was
  added — nothing else. The deck names, the number of forms, the number of
  recordings and the language are gone from the tile; they are all still on
  the card itself when you open it. Three tiles fit on a row on an ordinary
  phone, two on a very narrow one, where one and a half used to.

## 0.12 — 7 September 2026

- In Admin → App → the components, "where it's used" now names screens
  instead of files: "App preferences", "Editing a card", "The menu in the
  top right", grouped under Learning, Teaching and Admin. The file names
  and line numbers are gone, and a place that turns up several times on
  one screen is one line with a count.

## 0.11 — 7 September 2026

- Reload works on the first press. It used to reload the page while the
  old copy of the app was still in charge, so the old version came back
  and only a second press got you the new one. It now waits for the new
  version to take over — and says "Reloading…" while it does, so the
  press does not look like it did nothing.

## 0.10 — 7 September 2026

- A picker now comes in two widths that mean different things. The
  compact one takes only the width its labels need, with every option as
  wide as the longest — it is what Appearance, Sounds and the rest of the
  settings use. The full-width one fills the space it is given, for a
  picker in a narrow column or a menu.
- The chosen option is a flat fill. Its translucent green edge read as a
  glow around it rather than as an edge.

## 0.9 — 7 September 2026

- Picking between two or three options now looks like one control: a
  track holding the options side by side with the chosen one filled in,
  rather than three separate buttons of which one happened to be green.
  Everywhere one is used — Appearance, Sounds, Hints, on-screen keys, the
  sort-and-filter bar, the teaching screens.
- The sort-and-filter bar puts each label above its picker instead of
  beside it, so the options have room to sit in one row.

## 0.8 — 7 September 2026

- Loud is louder, and the four sounds you hear in a session — right,
  wrong, "I don't know", and moving to the next question — are longer and
  easier to notice. The next-question tick was a 45ms blip at the top of
  the register and was inaudible over almost anything; it is now a short
  two-note turn.
- The Test button in App preferences is a normal-sized button with a play
  icon, and it plays a right answer followed by a wrong one — the two you
  actually hear — rather than ending on the end-of-session fanfare.
- Appearance in the top-right menu is now three options side by side with
  the current one lit, instead of one button that cycled through them and
  made you tap twice to go back one.
- Every component in Admin → App → the components carries a number, and
  each specimen under it carries that number and its own — 12, 12.1, 12.2
  — so a change can be asked for by number.
- "Hide the components" now sits exactly where "Show the components" was,
  rather than at the far end of fifty components.
- A row of buttons that cannot fit on one line now puts the last one on a
  second row instead of running off the edge of the screen, with each
  button's own label still on a single line. The bar in a practice
  session is the exception: it shrinks its type as before, because it is
  pinned to the foot of the screen with a measured amount of room
  underneath it.

## 0.7 — 6 September 2026

- "Practice" is spelled the same way everywhere in the app.
- In Teaching → Decks, editing a deck: ticking a course now updates the
  tick straight away instead of waiting until you leave the screen and
  come back, and nothing is shared with a course until you press Save. The
  screen says how many courses are waiting to be added or removed.

## 0.6 — 6 September 2026

- Opening a tab or a screen now starts at the top of it. Reading halfway
  down a list and then moving somewhere else used to hand you the new
  place already scrolled into its middle, past whatever it opens with.

## 0.5 — 6 September 2026

- A student who is in a course that has no cards is no longer told to join
  a course. All three screens that can be empty — Home, Progress and Cards
  — now say *"You're in 1 course, but there are no cards in it yet"*,
  counting the courses they are actually in, and the Join a course button
  appears only for someone who is not in one.

## 0.4 — 6 September 2026

- The version line in the top-right menu has a **Check** button. It asks
  the server there and then, so after a merge you can sit on the menu and
  press it rather than closing and reopening the menu, which was the only
  way to re-check before. If a newer build turns up, the line says so and
  the button becomes Reload; if not, it tells you you're on the latest.

## 0.3 — 6 September 2026

- On the answer screen, everything that is not the answer — where the word
  turned up, how it's written, how it's pronounced or what it means, how it
  sounds, and the words built on the same root — now sits together in one
  inset box instead of trailing down the page. "This is how it sounds" used
  to be three blocks below its own siblings; it has joined them.
- Nothing animates when the answer appears. The question and the answer box
  used to shrink and fade over a quarter of a second; they now stay exactly
  as they were.

## 0.2 — 6 September 2026

- In a practice session, Continue moved to the bar pinned to the foot of
  the screen — the same one that carried the hint, "I don't know" and
  Check a moment earlier. A long answer can no longer push the way on out
  of reach.
- The three buttons in that bar sit closer together and closer to the
  edges, and the room that buys goes into the buttons themselves, which
  are now a size or so larger on every phone.

## 0.1 — 6 September 2026

The first numbered release. Everything before it was identified only by its
commit, which is still shown underneath the number.

- The version line in the top-right menu now leads with a release number
  instead of a commit hash. The hash stays beneath it, because it is the
  only thing that can tell you whether a deploy has actually reached your
  device — and the menu still offers Reload when it has not.
- A practice session lost its card: the question and answer sit directly on
  the page, and the answer bar is pinned to the bottom of the screen, above
  the device keyboard.
- The hint button stays put after it is tapped, so a hint can be hidden
  again.
- Feedback sounds are louder, and preferences now offer loud, soft or off.
- Buttons never wrap onto a second line: a crowded row shrinks to fit.
- Words are taught in the phrases you recorded — fill the gap, and hear it
  in a phrase — and Arabic words built on the same root are shown together
  after an answer.
- Cards can be sorted and filtered by recordings, number of forms, when
  they were added and when they were last changed.
- Saving a card, deck or course says so.
