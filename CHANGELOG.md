# Changelog

What changed in each release, in plain language. The number shown at the
foot of the top-right menu is the one to look up here.

Releases count: 0.1, 0.2, 0.3 … 0.9, 0.10, 0.11. The second digit is a
counter, not a decimal, and 1.0 is reserved for whenever the app is
considered launched. The release lives in `package.json`'s `version` field
and moves once per batch of work you would notice, not once per commit.

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
