# Taleb33

A spaced-repetition app for learning languages, built as a progressive web
app. It started as an Arabic trainer and now also supports Vietnamese (Huế
dialect); adding another language is a matter of describing it in one file.

Teachers publish decks of cards to a course; students join with a code and
the material appears on their devices, along with any recordings. Progress
is tracked per exercise type, not per card, so knowing a word when you read
it and knowing it when you hear it are scheduled separately.

Three rules shape what a session asks, all of them in `src/scheduler.ts`:

- **A card is recognised before it is produced.** Every exercise type stands
  on a level, and a form is asked the next level only once every exercise
  it supports on the levels below has reached that level's bar:

  | level | what it asks | exercises |
  |---|---|---|
  | 1 | what the word means | choose the meaning · {script} → English · listen → English · read a scene |
  | 2 | which word it is | match the pairs · English → choose · choose the missing word |
  | 3 | write it from a cue | {translit} → script · listen → script · listen → tone · choose the reply · put a scene in order |
  | 4 | write it from its meaning | English → script · fill the gap · phrase heard → script |

  Levels 2 and 3 open on *graduated* — through the learning steps and in
  review, at whatever interval. Both are still cued: the word is on the
  screen to be told apart, or its pronunciation is, and neither asks for
  recall from the meaning alone. Level 4 opens on *mastered* — in review,
  with an interval of at least four days — so the strict bar stands where
  writing from memory begins. A level a card has no material for is passed
  straight through. Missing a question below twice running — wrong, seen
  again, wrong again — closes the levels above until it is recovered; a
  single miss is forgiven, and `holding` in the scheduler is the whole of
  that. Each exercise declares its own level in `src/languages.ts`
  and each level its own bar, in `LEVEL_BARS` beside them; `openTypes` in
  the scheduler reads both.

  **A misspelt answer says which letter.** "Not quite" and the word
  underneath is a true thing to say and a poor thing to learn from: on a
  script a learner is still reading letter by letter, finding the one that
  differs is most of the work and the part they are least able to do. So a
  question answered by typing in the language's own script comes back with
  the two spellings lined up — the letters that do not belong marked in
  what they wrote, and the ones they left out marked in the answer, which
  is the only mark there is when a letter is missing rather than wrong.
  `spellRuns` in `src/spelling.ts` does the lining up and knows no
  language: **what counts as a letter is the pack's own fold**, `letter` on
  the language, and it is the same fold the marking measures its skeleton
  on. That is what keeps a mark from contradicting the verdict beside it —
  a word right in its letters and wrong in its harakat has nothing
  highlighted, because the line that already says so is the one that should
  say it. Nothing is marked either when not one letter belongs: that is a
  word nobody knew rather than a word misspelt, and painting all of it adds
  nothing to "wrong".

  A nudge — the pronunciation, or the meaning — is beside every question
  that has one, closed until it is asked for. Two questions ask for the
  word in the script and offer its transliteration: *English → script* and
  *fill the gap*. On those the nudge is the answer said another way, so an
  answer written with it up is marked as a near miss: `hintTells` in
  `src/languages.ts`.

  **The same ladder is what a learner is shown.** `standings` in the
  scheduler reads a card as one row per level it has material on, each
  *not started*, *learning*, *done* or *paused* — paused being a level
  that had opened and has been shut again by a question further down being
  missed twice running, which is the one thing about the ladder nobody
  could otherwise make sense of. A
  level is *done* exactly when `openTypes` opens the one above it, so the
  screen and the scheduler cannot come to disagree; a test walks every
  combination to hold them together. `standing` picks the one row to put
  on a card. The Progress tab counts cards by level, and a card's own
  screen lists them.

  **And it is the first thing the home screen shows.** `Climb`, above Start
  session, draws the same ladder in one line: a ring of how much of the
  collection is learnt — `deckPercent`, shared with the Progress tab so the
  two cannot disagree — and a band beside it of every card filed under the
  level it is on, in the colours Progress gives those levels. It is drawing
  and not a readout: the home screen answers "how far have I got" in a
  picture, and the counts behind it live a tab away.
- **The shape of a session is the app's to decide, not the learner's.**
  Eighteen questions; each form asked two ways where its data allows; at
  most two forms of any one card; easiest first. Cards are taken in the order they fell due, with chance between
  everything the due list calls equal, and nothing gathers similar words
  together.

  **Being due settles that order and nothing else.** There is always a
  session: a learner who is up to date, or who is holding as many new
  words as the rule below allows, is dealt the cards nearest to coming
  round rather than an empty screen. What makes that safe is in the
  scheduler — **an answer given before a card is due is counted and moves
  nothing**, so the card comes back exactly when it was always going to
  and grows its gap then. Practising more can neither push a card out of
  reach nor hold one short of the bar. Getting it *wrong* early still
  pulls it back, because forgetting is news whenever it arrives. The
  limits on *new* cards are a different rule and still apply: more
  practice is more of what the learner holds, never more than they can
  take on at once.

  **And past the due line, what was just practised gives way.** Once
  nothing is waiting, the order is still nearest-to-due — but a card
  answered in the last couple of hours sorts behind one that was not, so a
  run of sittings works through the collection instead of circling the
  same nine cards. `JUST_PRACTISED` in `src/scheduler.ts`. It touches only
  the reach past the due line: anything genuinely due, and anything the
  learner marked, still comes first.

  The numbers are `SESSION_SIZE`, `PER_UNIT` and `MAX_UNITS_PER_FAMILY` in
  `src/ArabicTrainer.tsx`, beside `buildSession` which is the only thing
  that reads them. How many *new* words a session may open is not among
  them and is not the session's business — see below.

  They were six sliders under an Advanced disclosure, under a sentence
  saying the defaults were sensible — and two of the defaults were why the
  same handful of words kept coming round. Three exercises a form made an
  eighteen-question session six cards; letting a card bring four of its
  forms made a session of verbs two words and eighteen questions about
  them; and grouping similar cards made sure those few were as alike as
  the due list allowed. A setting is not the answer to that, because the
  learner cannot see what it costs them. Marking leniency went the same
  way: what counts as a near miss is a fact about the language, so each
  pack states it in `marking` and nobody is asked to rule on harakat
  before they can read one.

- **What keeps going wrong can be practised on its own.** *Weak skills*,
  under Start session on the home screen, deals nothing but the exercises
  that have been missed — wrong twice running first, because that is the
  app's own definition of a gap rather than a slip and what shuts a level
  (`missedTwice`), then anything missed once in its last two outings. It
  picks per *exercise* and not per card, which is the whole of what the
  name means: a word that keeps failing when it has to be written from its
  meaning is drilled on that and not on the reading it has always got
  right. Everything else a session does still holds — the ladder, the
  quiet window, what a device can play, two forms of a card at most — with
  one exception: it is never refused for want of variety, because the one
  thing you keep failing is a session worth having. `weakness`, `isWeak`
  and `buildWeakSession` in `src/ArabicTrainer.tsx`; the button is live
  exactly when `isWeak` finds something, so pressing it is always a session
  that builds. On the days it finds nothing the button is `off` rather than
  `disabled` — dimmed to the eye and to a screen reader, and still taking
  the press, which answers with a line saying there is no weak skill to fix
  right now. A dimmed button that swallows the press explains nothing; the
  reason is worth saying at the moment it is asked for, and not before.
- **A learner can ask for a card.** Marking one *high priority* on its own
  screen, under Cards, is the one place a learner overrides the schedule:
  the card counts as waiting however far off its next review is, opens the
  next session, and stays in every session until the mark is taken off.
  Nothing underneath it moves — what has been learnt, and when the card
  would have come round anyway, are both still there when the mark goes.
  **Every** card that is marked, not as many as a session has room for: how
  many cards a session takes is worked out from its length and what a card
  costs to ask, and that arithmetic is about the cards the app picks. The
  session is as long as it needs to be to hold the cards the learner picked,
  and exactly the length it always was when they have picked none.
  `priority` on the card, `isUrgent` in `src/ArabicTrainer.tsx`, which the
  count of what is ready and the session builder both read so the two
  cannot come to disagree. It is the learner's and not the teacher's, so it
  is written through a course card's lock rather than refused by it;
  `foldCourses` carries it over a refresh beside the schedule, and `parked`
  keeps it while a card is away, so a card that leaves the material and
  comes back comes back asked for. Carried *cleared* as well as set, with
  the time on it: "no longer wanted, as of then" only beats an older yes on
  another device while it keeps its stamp — see `priorityAt` in
  `src/types.ts`.

- **A new word is earned by learning one.** Two pools decide it and
  nothing else: at most ten words the learner cannot yet recognise, and at
  most sixty in hand altogether. A word leaves the first as soon as it has
  earned a four-day gap on its first rung — the same bar that opens the
  level above it — and goes on climbing against the second without
  blocking a newcomer behind it.

  Nothing is counted in sessions or in days, so ten short sittings in an
  evening and one long one meet the same words. That was the fault of what
  stood here before: three a session made the same work worth ten times as
  much new material depending on how the learner broke up their time, and
  the two ceilings behind it both counted a word as being learnt whenever
  any exercise on it was unfinished — so a word held its place for its
  whole climb and the pool never drained. The measured rate was about one
  new word every four days.

  The numbers are `FRONT_DOOR_CAP` and `IN_HAND_CAP` in
  `src/scheduler.ts`, and they were measured rather than chosen:
  `tests/pace.test.mjs` plays out a simulated learner and reports what a
  course costs in days. Change one and run it.

  A card's phase is still read over the levels it has reached, and the
  Progress screen shows it: *New* is never met, *Learning* is met and not
  yet through the steps somewhere, *Young* is graduated everywhere it is
  open, *Mature* is three weeks out everywhere.
- **One tense of a verb is ever new at a time.** Where a language lays its
  verbs out in a table — Arabic in seven persons and three tenses, Huế in
  one person and four markers — each cell of it is a sub-form, drilled and
  scheduled in its own right by the exercises every other form gets. The
  rows open in the order the language teaches them, one waiting on the one
  above it being mastered, so the past of a verb is not asked until its
  present is known and a lapse closes the rows above. Where a language has
  no infinitive it names the cell a dictionary would list instead — Arabic
  cites the he-past — and that cell stands in for the card's own word
  rather than the two being drilled as one word twice. On those languages
  it stands in for it in the editor as well: the block asking for the
  card's own word is not shown, the cell is what the card is saved as, and
  a word first called a verb moves into that cell rather than being asked
  for twice. Where a language cites nothing — Huế cites the bare verb,
  which is a word and not a cell — the block is the verb and stays. A verb card may also
  carry a sentence with its own place marked in it — `{{name}} {{verb}}
  {{object}}` — and the form that stands there is the one whatever filled
  the subject calls for, read off the number and gender its card already
  carries. See `src/verbs.ts`.
- **A word carries the pronouns its language attaches to it.** Arabic and
  Hebrew write *my book* as one word, and the same endings carry a
  preposition — عند is *at*, عندي is *I have*. Those are forms of the word,
  so they are cells of a table like a verb's: one row, a column per pronoun,
  each drilled and scheduled in its own right. A language declares the
  columns or declares none and no such table exists. The row waits on the
  word itself — it opens once the card's own word has climbed past level
  one, which is the ladder's *recognised before produced* turned sideways,
  because meeting كتابي before كتاب is meeting a word you have not learnt in
  a shape you cannot read. Which table a cell belongs to is read off the row
  it sits in, so one card never lays out both.
- **A language declares the tables it lays a word out in, by name.** A
  verb's persons and tenses, the pronouns on the end of a word, an
  adjective's feminine and plural, a number's feminine — each a table of
  cells over the card's own sub-forms, told apart by the row a cell sits
  in. A table says what its cells wait on (the row above, as a verb's do,
  or the word itself, as pronouns do — which also means one exercise a
  level once the word is known) and whether every form carries one or the
  card does; the trainer reads those two facts and knows no table by name
  except the verb's, which its own sentence and the dictionary form ask for.
  What kind of word a card is decides which table it is offered and which
  grammar axes it is asked about — a preposition has neither number nor
  gender, a noun is asked whether it is a person or a thing — and nothing
  stored is narrowed by that: `dimsFor` is display and editing, `dimValues`
  is storage. See `tablesOf` and `WORD_CATEGORIES` in `src/languages.ts`.
  The teacher answers it in a drop-down (`WordKind` in
  `src/card-editor.tsx`), and an answer shuts to the answer with a pencil
  beside it — the same `.at-shutrow` the card's ID wears, because it is
  the same state: decided once, read often, and changed on purpose rather
  than by a stray tap. Every answer carries a line saying what it gets
  you, which is why the list inside is rows and not a track of segments.
- **A form can be kept without being asked about, and lent without being
  asked.** A card is a word and a pile of forms of it — other spellings,
  the pronouns on its end, every person and tense of a verb — and a
  teacher may want some of that written down for a student to read rather
  than drilled. Each of those is a part with two answers on it, ticked in
  the editor under the very fields it is about:

  | | what it means | stored |
  |---|---|---|
  | on its own | dealt as a question — what it means, how it is written, how it sounds | `ask` |
  | inside sentence cards | lent to the frames that leave a blank it fills | `lend` |

  A word is usually worth both. A name is worth the second alone —
  *what does Raphael mean* is not a question — and a table written out for
  reading is worth neither. Switched off either way it stays on the card,
  keeps its recordings and keeps whatever progress a student has made on
  it. Absent means yes for `ask`, and for `lend` it means whatever `ask`
  says, which is what one tick for both could only have meant — so a card
  written before the split is read exactly as it was written. `askParts`
  in `src/card-editor.tsx` is what a teacher is shown, `isAsked` in
  `src/scheduler.ts` and `isLent` in `src/variables.ts` are what every
  reader goes through, and a card's own `drill` — which keeps a value out
  of the grids and the wrong answers as well as out of the deal — is read
  off the ticks rather than asked for a second time. A form's own table
  follows the form off *as asked* — the pronouns on the end of a word wait
  on that word being known, so under a form nobody is asked they could
  never open — and never off as lent, because lending waits on nothing.
- **A sentence is a card made of blanks, and the vocabulary fills them.** A
  card may leave a hole in itself — `اسمي {{name}}` — and the question fills
  it before anybody reads the card, with a different word next time round.
  A blank is filled four ways, in rising order of how much filing it
  costs the teacher. `{{word}}` takes any word in the language, with
  nothing written on any of them. A blank named after a **kind of word** —
  `{{noun}}`, `{{verb}}`, whichever its pack declares — takes the cards
  that say they are one, which they already did when they said what they
  were. A blank with a name of the teacher's own takes the cards that name
  it back, in `fills` — the card's **group tags**, which is a **list**,
  because a word stands in more than one kind of hole as soon as somebody
  writes a second frame about it, and saying so used to take a second card
  carrying the same word. A card written when it was one name reads as the
  list of one it always meant; `fillNames` in `src/variables.ts` is the one
  answer to what a card fills, and the server reads it through the same
  function. And a blank named after **one card's ID** takes that card and
  no other: `{{colour-red}}` asks for that word where `{{colour}}` asks for
  any of a group. The ID is the teacher's, optional, given whenever they
  want one and stored in `ref`; `cardRef` reads it and narrows it the way every
  other name that goes between braces is narrowed, so what the editor
  checked and what the server stored cannot come apart. Both kinds of name
  are one namespace, because both are what a sentence writes between
  braces: `refClash` refuses a name another card's ID or anybody's group
  tag already answers to, while the teacher is still looking at it.
  Every form of a filler lends itself, not only its
  own word: a plural stands in a sentence its singular does not, gated on
  what that form itself has climbed. A card with a blank in it never fills
  one — a sentence dropped into somebody else's hole is a sentence with a
  gap where the point was — and `{{verb}}` on a verb card's own sentence
  means its own place in it rather than any verb, which `ownSlot` in
  `src/verbs.ts` is the one answer to. A word whose forms agree with what
  they stand beside — an adjective, a number — lends its own word only,
  and the sentence goes back to its card for the form the first other
  blank calls for (`agreedValue` in `src/verbs.ts`, `agreeTook` in the
  trainer): the cell a column picks, the word where none does, and nothing
  where the cell is blank.

  **Only a sentence may have a blank in it, and a sentence is one because
  the teacher said so.** The editor asks which kind of card it is — a word,
  a sentence, or a conversation — and that answer is now kept, in
  `sentence` on the card, which `isSentence` in `src/variables.ts` is the
  one answer to. It used to be read off the braces instead, so the question
  was thrown away the moment it was answered and worked out again from the
  words each time the card was opened: a sentence typed out before its
  first blank came back as a word, and a blank typed into a word made it a
  sentence whether or not anybody meant that — on a word with a table under
  it, hiding the table and offering to drop every box in it on the next
  save. A card written before this carries no answer and is read the way it
  always was, which is the whole of the migration and leaves nothing to
  rewrite: a card with a hole in it was a sentence then and is one now, and
  pins the answer the next time it is saved. The other half of the rule is
  a refusal — `strayHoles` in `src/card-editor.tsx` stops a save of any
  card that is not a sentence and has braces in one of its own forms, and
  names the one way out, which is to take them out. To have the sentence
  you start one, which is the rule below.

  **And what kind of card it is, is settled before the editor opens.**
  New card asks which of the three — `NewCardKind` in
  `src/card-editor.tsx`, over `shapeChoices`, which is the one list of
  what the three are and what each means — and what comes up is a screen
  for making that one, named for it and asking nothing further about it.
  The editor says what the card is and never offers to change it; a card
  that exists answers for itself through `shapeOf`. A card is what a
  student's whole record hangs on, what every other card's blanks are
  written against, and the three kinds are asked, dealt and filled in
  three different ways, so a card changing kind is a card whose past means
  something it no longer is. It was the first field inside the editor
  until 0.186, which put a teacher in a screen for making a card before
  asking what sort of card it was going to be — and before 0.180 a word
  with no table could be called a sentence and back again. Whoever wants
  the other kind wants another card. The same rule holds where the editor
  cannot be reached — `keptKind` in `server/api/courses.js` takes a saved
  card's kind from the card as stored, through the same `isDialog` and
  `isSentence` the app reads it through, so a stale build or a queued save
  cannot change one.

  **The editor's Blanks section is four named subsections, and they are
  not the same shape, because they are not the same question.**

  *Blanks in this card* is a **readout**, and has nothing to decide. What
  a card leaves is written in its own words — the braces are in the text —
  so the holes are a fact about the card and this subsection's whole job
  is to say what that fact is worth: each hole, and, when one is pointed
  at, the words that will go in it. That last is the only place a teacher
  can see whether the right vocabulary is behind a blank without leaving
  the card. A blank lives in the fields, so that is where it is put in and
  taken out; every field with words in it must leave the same blanks, and
  `slotTrouble` refuses the save and names the field that is short of one.

  **And it is put in rather than typed.** Under each of a sentence's three
  fields is a **bar**: a chip for every blank the card knows, and a button
  for one it does not. A chip the field already has reads as a fact about
  it; one it has not is a tap from being in it, at the caret — which is the
  whole of keeping the three fields in step, a rule the save has always
  enforced and never once helped anybody keep. Dragging a chip instead puts
  the blank exactly where it goes, and moves one already there: while a
  chip is held, a **rail** appears under the field showing the sentence as
  its words with a target in each gap. **The gap and not the character is
  the unit**, for two reasons — nobody puts a hole in the middle of a word,
  so word-sized targets ask for the accuracy a thumb has; and asking the
  browser which of its own elements a finger is on has one answer in every
  script, where measuring laid-out text a second way does not. `dropRail`,
  `withSlotAt`, `withoutSlot` and `movedSlot` in `src/variables.ts` are the
  string rules, spacing a blank like the word it stands in for and never
  letting one land inside another; `BlankBar` in `src/card-editor.tsx`
  draws them. The **sheet** behind the button lists every name that means
  something in this language — any word, each kind of word, each group tag,
  each card's own ID — with what would stand in the hole and how many words
  are behind it today, counted through `fillsOf` so it is the number the
  question will actually find. A name nobody has written yet is offered as
  what it would be: a new group tag, waiting for the cards that say they
  are in it.

  *Examples of this card with filled blanks* is the card as a student will
  actually meet it, and **all of it**: every word behind one blank, every
  pair of words behind two, each in the script, in how it is said and in
  what it means, filled from the words that exist today. It is a list to
  be read down — whether the right vocabulary is behind a blank, and
  whether every one of those sentences says something — and that question
  is asked of the whole list or not at all, which is why it stopped being
  the three examples it printed as a preface to the holes.

  **It is folded away until it is asked for**, on every card, because what
  a frame the whole collection fills is met as is hundreds of sentences,
  and a section that opened on them would put the rest of the card below
  them. Its heading says how many are in there, which is the answer a
  teacher wants oftener than the sentences, and so does the section's own
  line — `combos` in `src/card-editor.tsx`, counted rather than built, so
  it is there while the list is still folded. `EXAMPLES_CEILING` is the
  only thing that shortens the list, and only on a card met as more
  sentences than a screen will draw at once, where the foot of the list
  says so and says how many there are. Empty where a blank has nothing
  behind it, which is its own answer, and said in a line.

  **And the card list narrows by a blank, from either side of it.** Teaching
  → Cards has a *Blanks* filter: which side a card is on — it leaves one,
  it fills one, or it fills none — and, for the first two, a list of every
  blank anybody has written, each saying how many cards leave it and how
  many fill it. The two sides are never the same card, because a card with
  a hole in it fills nothing; ticking `{{name}}` and switching sides is
  therefore how "what is going on with this blank" is answered — the
  sentences that ask for a name, and the names. `filterCards` and
  `blanksInUse` in `src/spaces.tsx`, both read off the cards in hand, so a
  blank appears the moment a card writes it and goes when the last one
  stops.

  *The card's ID* is the name this one card answers to, and it is
  **optional** — a card is its words, and a name for pointing at it is a
  thing a teacher wants while writing the sentence that points, which is
  usually another day. It is offered on every card and demanded of none;
  what a save does refuse is a name something else already answers to,
  whatever the card's age, because two cards answering to one `{{x}}` is
  the one thing an ID is for preventing (`refOk` in
  `src/card-editor.tsx`). What it says back is as short as it can be: a
  name that is free gets a green rim and no sentence, and the only line
  here is for a name something else answers to, which names what
  has it. It is typed once and then **shut** — the tick beside the box,
  which lights only on a free name — because an ID is written once and read
  a hundred times, and a box you can type in is a box you can type in by
  accident. The pencil opens it again, which is the state a saved card
  arrives in.

  *The card's group tags* is the opposite job, and there a list is right:
  what a card fills is nowhere in its words and nothing can be read off, so
  it is the teacher's answer and this is where they give it — a box that
  names a new group, above the groups somebody has written, with this
  card's ticked. A kind of word is not among them, because a
  card fills `{{noun}}` by saying it is a noun and `{{word}}` by being a
  word: a tick for either would change nothing. What is offered is what
  somebody *wrote* rather than what is not built in, because a language
  may declare a kind of word whose name a teacher also uses by hand —
  Arabic declares `name`, and `{{name}}` is the oldest frame in the app. A
  card that leaves a blank of its own fills none, so on one of those this
  subsection says that rather than offering a control there is no answer
  to. Every row carries the pencil that renames the tag, because a tag is a
  name several cards share and the only place a misspelt one is visible is
  a card that has it.

  **Renaming either asks one question: does the name follow, or does this
  card alone move?** A name lives in two sorts of place — on the card that
  answers to it, and in every card that asks for it — so changing it here
  and nowhere else is a real answer and so is changing it everywhere.
  *Everywhere* rewrites the braces in every field of every form and every
  turn of every card that writes the old name, and swaps the tag on every
  card that carries it (`renamedIn` in `src/variables.ts`, which comes back
  null for a card nothing moved in, which is almost all of them). *Only
  here* leaves them: an ID renamed alone is a card with a new name while
  the old sentences go on asking for the old one, and a tag renamed alone
  is this card leaving the group for one of the new name. Neither is safe
  to assume, so neither is the default and both buttons say what they will
  do. The editor holds one card and saves one card, so it carries the
  answer out with the card being saved and the Cards screen does the
  walking — the same `sendOrKeep` every card goes through, in a loop, so a
  rename made on a train is kept and sent like anything else.

  **The braces are how a card is stored and not how one is written.** A
  sentence's fields draw each blank where it stands, as a pill: dragged
  along the words to move it, crossed off to take it off the form's three
  fields together. `BlankText` in `src/card-editor.tsx` is that field — a
  contenteditable box the app draws, which is why nothing in it is
  repainted while anybody types — and `dropBlank` beside it is what a
  cross means. The bar under each field keeps what the words cannot say:
  the blanks the card leaves that this field has not got, and the button
  for one nobody has written yet. Every gesture ends in the same string
  rules, `withSlotAt`, `movedSlot` and `withoutSlot` in
  `src/variables.ts`, which is where a blank's spacing is decided. No
  screen shows the braces: a card listed anywhere draws its blanks the
  same way, through `splitSlots`.

  **Answering a sentence credits the words that stood in it**, on the form
  that was actually shown — the feminine an adjective agreed into, not the
  word it came from. Three limits, in `fillerMarks` in `src/grade.ts`: only
  a right answer counts, because a sentence cannot say which part of it was
  wrong where a grid can; a word's own schedule moves only if it was
  already due, as a word dealt into a grid to fill it out does; and a
  sentence keeps a review up to date without opening a rung the word has
  never been asked on its own, because the top of the ladder is writing a
  word with nothing on the screen to go on. A card that is not practised in
  its own right — a name — is left to the frame's own `met` record, and a
  verb's own place in its own sentence to its table's gate.
- **A number is built, not memorised.** A learner who knows *forty* and
  *seven* knows *forty-seven*, so numbers are not cards one at a time: a
  language declares how its numbers go together, the teacher fills in the
  handful of **parts** on one screen, and the app makes up as many numbers
  as it likes out of them. A card is a part by carrying a `value` — two
  teachers write *forty* and أربعين and neither string says what it is
  worth — and `spell` on the pack turns a number into words or refuses,
  which is how a deck that stops at ten is never asked for a hundred.

  Everything that differs between languages is in that one function.
  Arabic puts the unit before the ten and a و in front of every chunk;
  Hebrew puts the ten before the unit, one ו in the whole number, and
  counts in the feminine except in front of *thousand*; Huế is regular
  enough to need eleven boxes against the other two's fifty-five, and puts
  its irregularity in the forms a word takes in company — *năm* is five and
  *mười lăm* is fifteen, which is a cell of a table like an adjective's
  feminine. `src/numbers.ts` knows none of it: it finds the card a part is
  written on, works out which stretches of the number line can be built,
  and chooses what to ask.

  The teacher fills the parts in from **Teaching → Cards**, the `#` in the
  list's toolbar: one screen for the language, over every number card they
  have in it, saving to their collection the way any new card does. A
  language and not a deck, because the parts are the language's.

  The practice is started by the learner, not dealt. It ramps: it opens in
  the lowest **band** the deck can build — 0–10, 11–20, 21–99, and so on to
  millions — widens as answers come back right, and remembers where it got
  to in `settings.numbersReach`. The numbers themselves are never cards and
  are thrown away with the sitting; a right answer credits the *parts* that
  stood in the number, under the ordinary exercise the question was
  evidence for, by exactly the rule a sentence credits its fillers with.
- **A learner studying more than one language says which are in play.** A
  switch at the top of Learning, beside the space tabs, lists the languages
  they have cards in and holds the ones switched off in
  `settings.langsOff` — the ones *off*, so a language that arrives later is
  in play by default. Everything the learner is shown reads the cards it
  leaves: the card list, Progress, what is ready, and what a session is
  dealt from. It appears only where there is a choice to make, and the last
  language on cannot be switched off.
- **What varies between askings turns on a right answer.** Which values
  fill a card's holes, which phrase it is shown in, which of its accepted
  spellings is put up and which of its meanings is asked about are all
  rotated rather than drawn, so a card with three of something is met as
  all three before any of them twice. The count is of right answers —
  `turnOf` in the scheduler — so a question that was missed is the one
  asked again, rather than the miss itself turning up a sentence nobody
  has been taught.
- **A question answered wrong is asked again before the session ends.** The
  same question, at the back of whatever is left — so the gap is the size of
  the rest of the sitting, which makes it a retest rather than a copy of an
  answer still on the screen. It goes through the same spacing rule the
  queue was built with, so it never lands beside another question about the
  same card: `requeueMissed` beside `varyTypes`. Where nothing is left but
  the card's own questions it is asked next, which is what keeps a session
  of one question from ending the moment it is missed, and is Ultimate's
  promise to repeat what you miss until you have it right.

- **A matching grid is five questions.** Every word in it is asked, marked
  and scheduled in its own right. Which words stand together is decided
  when the session is built: the grid is filled out from cards already
  met, the most alike first, and a word dealt in to fill it that was not
  due is credited for a right answer without its schedule moving.

  **No word and no meaning stands in one twice**, and `matchSet` in
  `src/chance.ts` is the gate that decides it — after the narrowing, where
  the meanings are final. `matchGroups` asks the same question when it
  chooses who stands together and cannot be the last word on it: it reads
  a card as the teacher wrote it, and what reaches a tile has been cut
  down to one accepted spelling and one meaning, so two cards that differ
  to that guard can be one tile twice to a learner. An answer that cannot
  stand is left out and a spare takes its place, so the grid keeps its
  size; it is simply not asked this time. Two tiles reading alike is not a
  hard question but an unanswerable one, and the grid holds its pairings
  by *where* a tile is rather than by what it says, so that it stays
  answerable even if one ever gets through.

  **A pair is begun from either column.** Tap a word then its meaning, or a
  meaning then its word: whichever side the learner is reading is where
  they start, and the pair that comes of it is the same pair either way.
  `MatchGrid` holds the tile picked up as a side and a place on it, so the
  two columns are one gesture written twice and cannot drift apart.

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
                   and forms that fill it. Pure, like the two above.
  cards.ts         what a card is made of: its own word and the forms it
                   carries, as one list. The single door everything that
                   walks a card's forms goes through. Pure, imports nothing.
  numbers.ts       numbers built out of a teacher's parts: finding the card
                   a part is written on, how far a deck reaches, and what
                   to ask next. How a language puts its numbers together is
                   `spell` on the pack, never here. Pure, imports nothing
                   but the pack.
  verbs.ts         a word's forms as a table over the card's own sub-forms —
                   a verb's persons and tenses, or the pronouns a language
                   attaches to the end of a word:
                   where the rows and columns come from, what a cell means,
                   which cell a subject calls for, and which rows are open
                   yet. Pure, and imports nothing.
  grade.ts         marking an answer: what it counts as, what that does to
                   the schedule of the form it was about, and where it is
                   written back. Pure, no React, the clock passed in.
  spelling.ts      where a misspelt answer went wrong: the two spellings
                   lined up letter by letter, as runs a screen can mark.
                   Knows no language — what counts as a letter is a fold
                   the pack hands in. Pure, imports nothing.
  flag-export.ts   reported problems written out as text to paste elsewhere,
                   each with the card it is about. Pure: the clock, the
                   locale and every name it cannot work out are passed in.
  ArabicTrainer.tsx  the learner's app: scheduler, session builder, screens
  spaces.tsx       the teaching and admin spaces, loaded lazily so a student
                   never downloads them
  card-editor.tsx  editing a card: the editor and the pieces it is built
                   from, apart from the spaces so each reads as itself
  shared.tsx       the component library both sides use
  sync.ts          merging two devices' documents, and clip sync
  index.css        one stylesheet, with the design tokens at the top
server/
  index.js         the process: routes /api, serves dist/, nothing else
  store.js         documents on disk, with the conditional writes sync needs.
                   Flushed, and one version back kept beside each document,
                   so a host dying mid-write costs nothing
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
- **An absence is not an instruction.** A read that failed, a list that came
  back short, a schedule with nothing in it — none of them may be acted on
  as though the learner had asked for something. A request whose read failed
  fails; a card that has gone leaves its progress behind in case it comes
  back; anything the learner said and can be undone by silence carries a
  stamp of its own. DECISIONS.md has the whole of it.

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
sync does not hand it back — and the progress that was on it is set aside
beside the document rather than destroyed, restored if the card returns and
aged out on the same schedule as the tombstones. A card can go missing for
reasons nobody decided, and the device cannot tell those from a withdrawal.

A card that fills a variable (`fills: "name"`) belongs to no deck: the server
sends it with every deck whose phrases leave a hole of that name. It is the
one thing in the material that crosses a deck boundary, which is why a
teacher's values carry a revision of their own — see DECISIONS.md.
