# Decisions

Choices that were not obvious, with what they cost. One entry per decision,
newest last. A decision belongs here when someone reading the code a year
from now would reasonably ask "why is it like this?" and the answer is not
in a comment beside it — usually because it is about the shape of the whole
rather than about one function.

What is *not* here: anything a comment already explains where it lives, and
anything that was never really a choice.

---

## Grammar belongs to an accepted answer, not to the form

**11 September 2026** · `src/answers.ts`, `src/languages.ts` (`answerFields`)

A card may accept more than one answer. Gender, number and the rest sat on
the form, one set for the whole card — which is right until two accepted
answers differ in exactly those things. "I'm happy" in Arabic is مبسوط from
a man and مبسوطة from a woman: one thing to know, two right answers, two
genders. A single "masculine" over the pair described one of them and was
wrong about the other, and a learner who wrote the feminine was told they
had written a masculine word.

They now live on the answer. Whatever a language declares — number and
gender in Arabic and Hebrew, a classifier in Vietnamese — is a property of
the word it is about, and a form has no grammar of its own left to
disagree with.

**Why not sub-forms, which already do this.** A card's `subs` are alternate
forms, each with its own grammar, recordings and progress. The difference
is drilling: a sub-form is a separate unit the student practises on its own,
and an accepted answer is another way to answer *one* question. مبسوط and
مبسوطة are not two things to learn. Making them sub-forms would have
doubled the card's schedule to record a fact about one of its answers.

**What it costs.** `ar` and `lat` — the delimited strings — stay beside the
array, because they are what the server, an export and every card list
read, and what a client on an older build still understands. That is two
places holding the words, which is the thing this codebase has spent
several releases removing elsewhere. It is accepted here on one condition,
stated in `answersOf` and tested: **the strings win.** They are what the
rest of the app edits — a CSV import writes them, a card arrives from the
server carrying them — so an array that no longer matches them is treated
as a stale cache and ignored. Falling back loses the per-answer grammar for
that one edit, which is the smaller wrong; the alternative is a card whose
text says one thing and whose grammar describes another.

**Migration.** One-time, at the document boundary (`liftAnswers`, beside the
v2→v3 lift that was already there). A card written before the change has
its form's values copied onto each of its answers — which is what they
meant when there was only one set of them — so nothing is invented and
nothing is dropped. A card with one answer, which is almost all of them,
comes through identical in every particular.

---

## The schema at the storage boundary is hand-written

**11 September 2026** · `readAnswer` in `src/answers.ts`

Asked for as a Valibot schema. It is twenty lines of plain JavaScript
instead.

Three reasons, in order of weight. It runs on every answer of every card of
every document this app opens, including on a phone at the start of a
session. The app carries two runtime dependencies, `react` and
`react-dom`, and this would have been the third and the first that is not
React. And what a schema library is *for* — a good error when the shape is
wrong — is the one thing this boundary must not do: a document is somebody's
cards, and half a card read is worth more to them than an exception. The
narrowing is deliberately total. An unknown grammar value becomes no value,
a field nobody declared is dropped rather than carried forward for ever,
and an answer with no text left is not an answer.

What the language will accept comes from the grammar table via
`answerFields()`, passed in rather than imported, so `languages.ts` can read
`answers.ts` to mark an answer without the two reaching for each other.

Revisit if validation ever needs to report *why* something was rejected —
an import screen that tells a teacher which row is wrong would be a fair
reason to want a real schema.

---

## TypeScript, a module at a time, from the leaves in

**11 September 2026** · `tsconfig.json`, `src/*.ts`

The app was JavaScript with JSDoc types, checked by `tsc --noEmit` in
strict mode. The reason, recorded at the top of `tsconfig.json`, was that
the app is JavaScript and stays JavaScript — tsc as a second reader rather
than a compiler.

The reason underneath that reason has expired. Four modules opened with
some version of *"a plain module, because `node --test` cannot import a
.jsx file"*: pure logic lived in `.js` so tests and the server could import
it with no build step. **Node 22 strips types on the way in** — no flag, no
loader, no `--experimental` — so a `.ts` module is imported by `node
--test` and by `node server/index.js` exactly as a `.js` one was. The
constraint is gone, and with it the argument.

**Order: leaves first.** `chance` imports nothing, so it went first and
proved the whole pipeline — unit tests, the esbuild smoke bundle, the Vite
build, and the server's own test, which starts the real server over a real
socket. Then `answers`, then `dialogs`. Each conversion keeps the project
green; nothing is half-migrated at a commit.

**`allowImportingTsExtensions`.** Node will not guess an extension, so an
import of a converted module names it: `"./chance.ts"`. That is only sound
because nothing here is emitted by tsc — Vite and esbuild resolve the same
specifiers. A mixed tree is the normal state during this and imports say
which kind of file they mean, which is a feature while it lasts.

**Erasable syntax only** — no `enum`, no `namespace`, no parameter
properties. That is what Node strips; anything else would need a build step
and put the constraint back.

**What it is buying.** Not tidiness. Converting `answers` turned eleven
repeated JSDoc shapes into three named types and immediately found two real
defects in a file nobody was editing — `spaces.jsx` passing a
`Record<string, any>` where an `Answer` was wanted, and a grammar value
typed `unknown` handed to a picker that takes a string. Converting
`dialogs` forced `Line` to be stated as what it is (a `Form` with a speaker
on it) and caught a test dereferencing a `cueFor` result that is null at
the first line — which the same test asserts two lines further down.

**Done so far.** Every pure module — `chance`, `answers`, `dialogs`,
`context-index`, `offers`, `context-links`, `scheduler` — which is the
whole layer that decides what a learner is asked, and the layer the tests
drive directly. Then `types`, and then `languages`.

`types` was the cheap one and paid for itself anyway. A JSDoc
`@typedef {object}` is an anonymous object type and gets an implicit index
signature; an `interface` does not. So `Verdicts` stopped being assignable
to `Record<string, string>` the moment it was written out, which was a cast
in `verdictWord()` admitting it did not know its own keys. It takes one of
four named tiers and never an arbitrary string, and now says so.

`languages` is 2,102 lines with 133 JSDoc annotations on it, and moving
those by hand would have been a long afternoon of transcription errors. It
was done by a script that lifted each `@param {T} name` into `name: T` and
kept the prose that followed it as a bare `@param name  …`, with the diff
read through afterwards — which is the right division of labour: a
machine for the mechanical half, a person for the seventeen places the
machine produced something correct and ugly.

Then the rest of the plain modules — `sync`, `storage`, `courses-api`,
`updates`, `screen-elements` — which are the app's edges rather than its
middle: what a request looks like, what a document merges to, what a
recording is stored in. Two of them had a shape written out in a comment
and nowhere else, and those are now declared: `ClipStore` is the three
things syncing a recording has to ask of the device it is on, and
`FlagReport` is the subset of a `Flag` that a learner's report actually
carries.

That conversion also emptied a dozen inert casts. `/** @type {any} */
(it).lines` in a `.ts` file suppresses nothing — JSDoc types are ignored
there — and each one had been standing in for a field that `Item` now
declares, so they went out with the file they were written for.

Then the two small screens, `gallery` and `main`, which were about
proving the `.tsx` half of the pipeline rather than about their own size:
Vite, the esbuild smoke bundle and `index.html`'s entry point all resolve
`.tsx` with nothing added. What they did want was React's own shapes said
out loud — a context's value, an error boundary's props and state, and a
`Node` that a JSDoc alias had been quietly resolving to `React.ReactNode`
where TypeScript reads the DOM's.

Then `shared`, the component library, where what was bought is props. A
JSDoc `@param {{...}} props` on a component is a comment beside a
destructuring pattern; in a `.tsx` file the pattern is the signature, so
every optional prop had to say it was optional and every caller was
checked against it. Three shapes came out of that with names — `Node`
(what React will render, and emphatically not the DOM's `Node`),
`Confirmation` (what `askConfirm` returns, which four screens hold in
state) and `CoursesPulled` — and two generics, `ItemList<T>` and
`Segmented<T>`, that had been `@template` tags doing nothing.

Then `spaces`, the teaching and admin screens. Its 519 errors were three
things repeated: `useState(/** @type {X | null} */ (null))`, of which
there were thirty-four; components whose props were a `@param {{...}}`
above a multi-line destructuring; and `new Set()` in a `useState`
initialiser, which infers `Set<unknown>` and was being handed to
`ItemList`'s `Set<string>` — a mismatch that only exists because
`shared` now says what it takes.

Last, `ArabicTrainer`, alone: 9k lines and 399 annotations is not a slice
of anything. It went the same way as the two before it, which is the point
— by the time it came round there was nothing left in it that had not
already been met somewhere smaller. `Session`, `ParsedRow`, `ZipEntry` and
`SoftKeyboard` were `@typedef`s the file's own signatures referred to; the
card editor's draft carries a conversation's fields only when the card is
a conversation, and now says so, with `|| []` at the twenty places that
read them.

**Done.** Every file under `src` is TypeScript. The server stays
JavaScript with JSDoc: it runs the same modules and has nothing to gain
from the move.

**On the filename-keyed guards.** `scripts/component-uses.mjs` and
`tests/component-uses.test.mjs` both named the three app files with their
extensions. They resolve a file by its stem now, and match either
extension. Fixing them first rather than after was the difference between
a green run and a wrong one: a scan pinned to `.jsx` does not fail when the
file moves — it finds nothing, writes a valid file, and reports that no
component is used anywhere. `tests/smoke.mjs` has the opposite case a few
lines apart, an esbuild *output* path that stays `.js` however the entry
point is spelt, and it is commented where it sits.

**What an audit of the finished conversion found.** Read for problems
the rewrite itself created, which is a different question from whether
the checks were green — they were, at every commit, and three of the
findings are things a green check could not have said.

*The linter had stopped reading the app.* Its glob was
`src/**/*.{js,jsx}`, so once `src` was `.ts` and `.tsx` it matched one
generated file and passed in silence. The two rules the config calls the
ones that matter most — a hook called conditionally, a dependency array
that lies — were off for every screen. `typescript-eslint` was the
obvious repair and cannot be used: it reads the TypeScript compiler's JS
API, and the compiler this project checks with (7, the native one, which
checks the whole tree in under two seconds) no longer has the parts it
reads. Babel's parser is already in the tree under Vite's React plugin
and reads both syntaxes when told to, so `@babel/eslint-parser` is the
one addition. Two of the recommended rules cannot follow a type through
that parser and are handed to tsc, which does the same job exactly:
`no-undef` to TS2304, and `no-unused-vars` to `noUnusedLocals` — which,
turned on, found six imports the conversion had left dead that the lint
rule reported forty false positives around.

*Two things Node's stripping needs, nothing was enforcing.* A type
imported without `import type` compiles under Vite, which elides it, and
crashes under Node, which does not; `verbatimModuleSyntax` makes tsc
refuse it. An `enum` would be the same story; `erasableSyntaxOnly`. Both
on, both clean.

*The Node floor was wrong.* `engines` said `>=22`, and README said "22 or
newer". Unflagged type stripping arrived in 22.18, so a host on 22.12
would fail at boot importing `languages.ts` from the server. Now `>=22.18`.

*One cast was hiding a real hole.* `fromSpaces(name)` took any export of
`spaces.tsx` by name, tables included, and a cast on the way out made it
typecheck; it now takes only the component-valued keys, and the cast is
gone. The other casts the conversion introduced were audited by count:
`any`-shaped sites went from 91 to 95, the forty-two `@type {any}` JSDoc
casts having become eleven `as any` and the rest `Record<string, any>`
written inline. A wash, not a gain, and worth saying so.

*And what it did not find.* Every positionally attached `@param` named
its parameters in the order the function declares them — checked against
the pre-conversion source, all eight files, no mismatch. No comment was
reached by the type-literal reformatter. `sideOf` already coerced an
absent speaker to 0, so the `|| 0` added at its callers changed nothing.
Node prints no warning when the server imports a `.ts` file.

**On doing this with a script.** Every conversion past `answers` was
driven by one: lift `@param {T} name` into `name: T`, keep the prose that
followed, then read the diff. It is worth saying what the script got
wrong, because the same two will come up again. It treated `>` as closing
a generic, so it split `(id: string) => void` down the middle of its own
arrow — which parsed, as a type literal accepts commas, and read as
nonsense. And it reached inside value literals as well as type literals,
because `{ body: { hash, data } }` and `{ hash?: string }` look alike a
character at a time. Both were caught by reading the output rather than by
the checker. A machine for the transcription, a person for the diff.

**A file that moves takes its name with it.** An import names the file it
means, so every specifier pointing at a converted module changes with it,
and so does every comment that named one. `dialogs.js` in a sentence about
cycles is a wrong reference the moment the file is `dialogs.ts`, and prose
is where a rename rots quietest: nothing fails.

The exception, which a blanket rename gets wrong every time: a path that
names a *build output* rather than a source file. `tests/smoke.mjs` imports
`tests/.smoke-build/storage.js`, and it stays `.js` however the entry point
is spelt, because esbuild writes JavaScript. That one is commented where it
sits.

**One thing to watch.** Guards keyed by filename rot as files move.
`tests/language-isolation.test.mjs` listed `scheduler.js` and keyed its
allowlist by `"ArabicTrainer.jsx"`; it now names files without an extension
and resolves whichever exists. Anything else that hardcodes a source path
needs the same treatment before the file it names is converted.

---

## A variable is a hole in one card, filled by another

**12 September 2026** · `src/variables.ts`, `server/api/courses.js`
(`my-material`), `src/ArabicTrainer.tsx` (`castFill`)

A card may leave a word open — "My name is `{{name}}`", in every field it is
written in — and a separate card, Raphael, says it fills `name`. Each
question fills the hole before anything reads the card. The point is that a
frame learnt as one lump is a sentence somebody can say once; met as
Raphael, then Victor, then Sarah, it is a sentence they can say about
anyone, which is the thing actually being taught.

**Values are cards, not a list on the variable.** They have to carry three
fields — the script, the meaning and the transliteration — because the hole
is in all three and one question fills all three from the same value. A list
of strings could fill one. Being cards also means they are written in the
editor everybody already knows, sync like everything else, and can be turned
into something drilled later by one checkbox.

**Which is why every card now says whether it is practised on its own.**
"What does Raphael mean" is not a question, so `drill: false` keeps a value
out of every session and every count. It is a field on all cards rather than
a property of filling something, because the two are genuinely separate: a
teacher may want a name drilled as well as borrowed, and a card that fills
nothing may still be reference material. Absent means yes, which is what
every card written before this meant.

**The server sends the values with the deck that needs them.** A value
belongs to no deck — filing "Raphael" under Lesson 3 files it where nobody
would look for it — so `my-material` reads the slots a deck's cards name and
bundles the matching values from the deck's owner and the course's teachers,
in the deck's language. This is the only material that crosses a deck
boundary, and it costs a per-owner revision (`K.fillsRev`) folded into the
material version: nothing else about a value moves when it is written, so
without that stamp a name added today would reach nobody until something
unrelated changed.

**Rotated, not drawn**, like the phrase a word is shown in and the accepted
answer a pronunciation question is about — and for the same reason: `turn` is
a count, so the same count is the same sentence and a re-render cannot swap
the name under somebody halfway through typing. Two variables turn like an
odometer, so a card with two holes of three values reaches all nine
sentences rather than three of them.

**What it costs, and what was left out.** A card whose words change cannot be
the one on a recording, so every listening exercise is refused on a card with
a hole in it — reported through `unmetNeeds` as a thing the card is waiting
for, rather than quietly dropped, because a teacher who writes a variable
into a card with four recordings on it should be told where they went.
Agreement is not handled: "{{name}} is tall" is طويل or طويلة depending on
who is being described, and nothing here knows that. The frame is the
teacher's to write so that the hole is safe, and the editor says so. If it
is wanted, the pieces are in place — values are cards and cards carry
gender — but it is a second feature, not a flag on this one.

**Every field with words in it leaves the same holes**, refused at save time
rather than found in a session: a frame whose English has a hole and whose
script has not is a question that asks for a name and marks an answer that
never contained one.

---

## A verb's table is its sub-forms, seen through two axes

**13 September 2026** · `src/verbs.ts`, `src/languages.ts` (`verb`), `types.ts`
(`row`, `col`)

A verb is not one thing to know. *To eat* in Palestinian Arabic is a dozen
words depending on who is eating and when, and a learner needs the one that
fits the sentence they are about to say — which no exercise asked for.

The obvious build is a new kind of card carrying a grid of strings. This is
not that. **A cell is a sub-form with two extra fields saying where it
sits**, `row` and `col`, and the table is a view over `subs`:

    subs: [
      { id, ar: "أكلت", en: "she ate", lat: "akalat", row: "past", col: "she" },
    ]

A sub-form is already an alternate form drilled on its own, with its own
recordings and its own progress. That is exactly what a cell is, so
everything downstream was already right: `unitsOf` enumerates cells,
`resolveUnit` finds them, `applyGrade` writes their marks back, sync merges
them per form and per type, the editor preserves their state by id, and the
existing exercises ask them — a cell has `ar` and `en`, so *{script} →
English* and *English → {script}* work on it the day it is written. **No new
exercise type was added, and no third collection.** The alternative was a
parallel walk beside `subs` and `lines` in five files, each of which would
have had to learn what a verb is, and one of which — the write-back in
`applyGrade` — would have dropped a grade silently rather than failing.

**The axes are the language's, as `grammar` and `lexical` already are.** A
pack declares its persons and its tenses, in the order it teaches them, and
nothing outside the pack knows what a tense is. Arabic declares seven and
three; Huế declares one unlabelled person and four markers; a pack that
declares none renders no table and every function in `verbs.ts` comes back
empty. The Vietnamese table is the whole language-agnostic claim in one
place: the same editor and the same exercises, over a table one column wide.

**Agreement is the thing the variables entry above said was left out.** The
pieces really were in place: a value is a card, a card carries number and
gender, so a column can name the values a subject must have —
`{ id: "she", picks: { number: "singular", gender: "feminine" } }` — and a
sentence with the card's own place marked in it, `{{name}} {{verb}}
{{object}}`, takes the cell whatever filled the subject calls for. Sarah
makes it *she ate*, the children *they ate*. Nothing is inferred and nothing
was added to Sarah: her card already said what she is. `{{verb}}` is a slot
like any other, so the editor's check that every field leaves the same holes
goes on working untold; it is simply the one slot no card fills, because the
card fills it from its own table.

Only the third person carries `picks`, and that is the rule rather than an
omission: no noun dropped into a subject is ever *I* or *you*. The most
specific match wins, so a pack can declare a broad column and a narrow one
without ranking them by hand.

**The rows open one at a time**, which is the same ladder turned ninety
degrees: a row opens once every cell of the row above it is mastered. It is
enforced in one place — `openTypes` returns nothing for a cell behind its
gate — and that one place is why it also throttles correctly: a closed cell
contributes no open types, so `familyMaturity` does not count it, and a
verb's twenty-four cells therefore cannot make its card read *new* for ever
and starve the whole language of room for new cards. A row the teacher left
blank is passed straight through, the way a level with no material is.

**What it costs.** Two flat fields on a form where the app otherwise avoids
storing positions, and a server that now has to carry them through its
sub-form whitelist. The sub-form cap went from twelve to sixty-four: twelve
is half of Arabic's smallest useful table, so a teacher would have filled in
twenty-four forms, saved, and got back the first twelve with no error
anywhere.

**A cell's English is typed, and briefly was not.** There was a box per row
that wrote every cell in it from one word, composing "she" and "ate" into
"she ate", so a teacher wrote three words instead of nineteen. It shipped,
and it was wrong in the place a learner meets first: English inflects the
present and nothing else, so "eat" composed across a row gave "he eat" and
"she eat" beside "I eat" and "we eat", and a command composed across every
column offered "I: eat!". The fix each time was the teacher correcting the
app's own output on every regular verb they would ever write.

The tempting repair is a rule — mark the third person singular, skip the
command outside the second person. Both are facts about English, and this
is a file whose whole point is that it knows no language: the same rule
would be wrong for the next pack, and right only by accident for this one.
A pack could declare its own exceptions, and that remains open. What is
here now is the plain answer: each cell keeps the words it was given.
Seventeen boxes is more typing than three, and it is typing that produces
something true.

---

## An accepted answer carries its own progress, keyed beside the exercise

**13 September 2026** · `keyFor`/`typeOf`/`answerOf`/`keysFor` in
`src/languages.ts`

The first entry in this file says the opposite, and the reversal is the
point of writing this one down. It argued that مبسوط and مبسوطة are "one
thing to know, two right answers", and that making them sub-forms "would
have doubled the card's schedule to record a fact about one of its
answers".

What changed is the verb table. Once every person and tense of a verb is
scheduled on its own — because knowing *she ate* is not knowing *they ate*
— the same argument plainly applies one step over: knowing one accepted
spelling is not knowing the one beside it. The card owner asked for it in
those words, and they are right. A second accepted answer that is never
asked in its own right is a word the learner has been shown and never
tested on.

**What it is not.** The obvious build is the one the first entry refused:
split the answers into sub-forms. That was offered and turned down, and
the reason holds — it restructures every card that already has two, and it
narrows what is marked correct, so a learner who writes the other spelling
starts being told they are wrong.

**What it is.** A schedule key: the exercise, plus which answer it is
about.

    "ar2en"     the first accepted answer, or the only one
    "ar2en@1"   the second

The first answer keeps the bare exercise name, and that one choice is what
makes the whole thing safe to turn on. Every schedule ever written reads
back exactly as it did. Sync goes on merging state name by name without
being told anything, because a key is just another name in the same map.
`compactItem` still drops what was never answered. A card with one answer —
almost all of them — has no suffix anywhere in its document, and a card
with two gains one fresh schedule, which is honest: that answer has never
been practised on its own.

**Which questions split, and which do not**, is `showsOneAnswer` and not a
list: a question that *shows* one answer splits, because showing each is a
different question; a question that asks for the word to be *typed* does
not, because either spelling answers it and marking the second one wrong is
the bug a second accepted answer exists to prevent. Listening does not
split either — a recording belongs to the form rather than to one of its
spellings, so nothing knows which was said.

**What it costs.** Every reader of a schedule now holds a key where it held
a type, and everything that looks an exercise up — the ladder, the wording,
the grader, the quiet window — goes through `typeOf` first. That is a
handful of call sites and one rule to remember when adding another. The
alternative was the restructure, and the suffix is the cheaper of the two
by a long way.

---

## The editor's three kinds are not the four stored kinds

**14 September 2026** · `shapeOf`/`shapeChoices` in `src/spaces.tsx`,
`isVerb` in `src/verbs.ts`

There is no `verb` in `CARD_KINDS`, and there is a **Verb** button in the card
editor. That is deliberate, and this entry is here because the reasoning for
the opposite is on the record — the release before this one shipped the verb
question as a tick beside the kind of card, arguing that "a verb is not a
third kind of card: it is a word, with a table as well."

**The storage claim is true and is not what changed.** A card is a verb
exactly when one of its forms carries a `row` and a `col`; `isVerb` reads the
cells and nothing stores a flag. That is still the whole of it. The entry
above on verb tables is the reason, and none of it moved.

**The claim built on top of it did not follow.** What a teacher picks in that
block is not the stored kind and never was: `CARD_KINDS` has four and the
selector offers two, because word, phrase and sentence are read off the text
rather than chosen. So there was no correspondence for a third button to
break. The question the block asks is *what are you writing*, and the answer
to that is three things, not two and a footnote underneath.

**What the tick bought had to be kept.** It outlived the choice above it — a
verb is usually written as a plain word and given its tenses weeks later, when
the course reaches them — and the selector beside it was read-only once a card
existed. So the selector is now rendered on a saved card too, with the answers
still open to it. `Segmented` has no per-option disable, only a whole-control
one, so an answer that is closed is absent rather than greyed; `shapeChoices`
is the one place that decides which, and is a plain function so the rule can
be tested without rendering a form.

**Which closed one hole.** A conversation has never been allowed to stop being
one: the turns are the card. A verb's table is the card in exactly that way,
and the tick let it be dropped anyway — untick, save, and `subs` went up
without the cells, which the server writes wholesale. Twenty-one cells, their
recordings and the students' progress on them, with nothing on screen having
said so. A saved verb is not offered the change now. The way out is to empty
the table, which is the same act said honestly, and the editor says so.

The asymmetry is the point: a saved *word* can still be called a verb, because
that direction loses nothing. A card still being written is not held to
anything either — nothing is saved to lose, and locking someone into a verb
because they filled one box to see what it did is the opposite of what this
change is for. That case gets a line counting what is at stake instead.

**What it costs.** The block no longer maps onto `card.kind` at all, and
anybody adding a kind has to know that verb-ness is derived from `subs` and
lives only in the editor's own vocabulary — two flags underneath, three
answers on screen, `shapeOf` and `shapeMeans` the whole of the translation.
That vocabulary is a second way of saying what a card is, which is the kind of
thing this codebase usually spends releases removing. It is accepted here on
the condition that it stays in one file and never reaches storage: the save
path still knows nothing about verbs, and `isVerb` is still the only answer to
whether a card is one.

---

## A value stands in a hole only as far up as it has climbed itself

**14 September 2026** · `valuesAt`/`noteMet` in `src/variables.ts`,
`reachedLevel` in `src/scheduler.ts`, `fillsAt`/`askableTypes` in
`src/ArabicTrainer.tsx`

The variables entry above says a frame met as Raphael, then Victor, then
Sarah is a sentence somebody can say about anyone. It was filled from every
card that could fill it, in the order they were written, and nothing asked
whether the learner had met any of them. With `{{word}}` — the built-in hole
that every word in the language fills — that is the whole vocabulary, and new
cards arrive ten at a time. So *English → script* on a frame asked for a
sentence containing a word that had never been dealt. There is no answer to
that question, and the card it taught nothing about was the frame.

**The rule is the ladder, read about somebody else's card.** A value may fill
a hole in a question at level N only where it has itself reached level N.
`reachedLevel` is `openTypes`' own test asked about one level instead of
returned as a list — including that a level a form has no material for is
passed straight through — with one addition `openTypes` has no use for: **a
form nobody has answered has reached nothing.** Level one is open on every
card from the day it arrives, which is a fact about the ladder rather than
about the learner, and reading it as knowledge is exactly how an unmet word
got into a sentence somebody was told to write.

**The two kinds of value answer differently, because only one has a ladder.**
A drilled word is read off its own progress. A value the teacher marked as
not practised on its own — Raphael — is never dealt, so it can never climb
anything, and gating it on a ladder would have removed the named-variable
feature altogether. The frame remembers instead: `met` on the form maps
`slot:value` to the highest level it has been asked at, and a value may stand
one level above that. It enters at the bottom, where nothing is below it to
have been seen at, and climbs with the card that teaches it.

**Only for those.** A frame on `{{word}}` would otherwise write a line per
word in the language; everything with a ladder is gated on that and needs
nothing stored. It is a high-water mark, so sync merges it by taking the
further of the two — the same answer whichever device arrives first, and
again if it arrives twice, which is all `mergeData` asks of anything.

**What it costs.** *Rotated, not drawn* is weakened: the list a turn counts
against now grows as the learner does, so the same turn on the same card can
be a different name a month apart. Within a question nothing moves — the
count only changes on a right answer — and a card with three values it can
reach still meets all three before any twice. It was the smaller loss: the
alternative is the question with no answer.

And a frame can wait. Where nothing clears the bar the key is withheld rather
than asked with something unmet, which is why `askableTypes` exists beside
`openTypes` — the ladder, the standing a screen shows and how mature a card
counts as all still read `openTypes`, because a level withheld for want of a
value is not a level the card has failed to reach. Only what a session may
*deal* reads the narrower one. It is also read where a session picks its
candidates, so a frame that can be asked nothing does not spend one of the
places kept for new cards while it waits.

**The teacher's trial is exempt**, and has to be: a teacher trying an
exercise out is not somebody learning, their own material carries no progress
to read, and gating it would show them `{{name}}` and call it a preview.

---

## A table is a table, and a card has at most one

**14 September 2026** · `cellsIn`/`hasCells`/`rowIdsOf` in `src/verbs.ts`,
`ATTACHED_TABLE` in `src/languages.ts`, `formsOffered` in `src/spaces.tsx`

Arabic and Hebrew attach a pronoun to the end of a word: كتابي is *my book*,
and the same endings carry a preposition — عند is *at*, عندي is *I have*.
Those are forms of the word and things to learn, and there was nowhere to put
them. The verb table has an axis for who is doing it and one for when, and
none for who it is about.

**They are a table, and the table already existed.** The entry above says a
verb's table is its sub-forms seen through two axes, and that everything
downstream was already right because a cell is a sub-form. That holds a
second time: an attached-pronoun table is one row, a column per pronoun, and
`VerbTable`, `unitsOf`, `applyGrade`, sync, the recordings screen and the
exercises took it without being told. What it cost was one honest
generalisation — a cell belongs to whichever table declares its row — and
`isVerb`, which read "has any cell", becoming `hasCells(card, spec)`. That
question was the same question while there was one table; with two it gated
each by the other's rows and would have closed one for ever.

**Columns name the pronoun, not what it does.** -ي on كتاب is *my* and on عند
is *I*. Each cell's English is typed, as every cell's is since the composing
was reverted, and that is where the difference is said. No `picks` either:
agreement is a rule about the subject of a sentence, and nothing here is a
subject — a frame does not choose between كتابي and كتابك by looking at who
is in it.

**The row waits on the word.** Rows of a verb open one at a time because the
tenses are not as hard as each other. This one waits on something else: the
card's own word, past level one. Meeting كتابي before كتاب is meeting a word
you have not learnt in a shape you cannot read — *recognised before produced*
turned sideways. It is the one rule here that is not the verb table's.

**And the selector went back to two.** 0.120 made Verb a third answer beside
*Word or phrase* and *Conversation*, and that entry is above. The reasoning
was that a teacher deciding what to write is choosing between three things —
true then, and it stopped being true the moment there was a second table: a
fourth answer, on a track that already ran off a phone at three, in a list
mixing *a different shape of card* with *a word with more said about it*.

So it is two questions. The kind is a word or a conversation; what a word
lays its forms out in is a radio underneath, offered only where the language
lays out anything and only while the card's table is empty. A radio because
each answer needs a line saying what it gets you, which a segment cannot
hold — `RadioGroup` is that control, and `LanguageRadio` now goes through it
rather than being a second copy of the same markup.

What survives from 0.120 unchanged: neither is stored, both are read off the
cells, and a saved card whose table has anything in it is told what it is
rather than offered a change that would throw the table away.

**What is left out.** A verb's *object* pronouns — شافني, بحبك — are a third
axis, and 7 × 3 × 8 is not a table anybody fills in. Those belong in a phrase
that teaches the verb, which is what `AR_ENCLITICS` and *Words this teaches*
are already for.

---

## A sub-form has a name, and a table belongs to a form

**15 September 2026** · `ownerOf`/`cellsIn`/`cellAt` in `src/verbs.ts`,
`cardToItem`/`foldForms` in `src/shared.tsx`, the `subs` whitelist in
`server/api/courses.js`, `laddered`/`easedUnits` in `src/ArabicTrainer.tsx`

The entry above put a word's attached pronouns in a table hanging off **the
card**, and said the row waits on the card's own word. Both halves were a
place short. The plural takes the same endings — *my books*, *your books* —
so it has eight of its own, and one table for the card said the plural's
were the singular's. 0.130 removed *Add a form* for want of anywhere to put
them; the conclusion should have been to give them one.

So a table belongs to a **form**: the card's own word with its table under
it, each further form with its own, and *Add a form* adding the whole unit.

**Which needed something to point at, and there was nothing.** A sub-form
had no identity in this app. The server's whitelist stored no `id`,
`cardToItem` made one up from the form's place in the list, and
`foldCourses` matched a student's progress to the teacher's forms by index.
That last is why this is worth its own entry: it was also a live bug. A
teacher who inserted a form above an existing one handed the second's
schedule to the first, on every device holding the card, with nothing said.

**So a form carries a name.** Minted by the editor, stored, never shown; a
cell names its owner in `of`, and absent means the card's own word — which
is what every cell written before this says, so nothing stored had to be
rewritten. The fold matches by name first, then by any place no name has
already claimed. That second half is what carries the release in which every
form is named for the first time: no name matches, every place is free, and
the card folds as it always did. It does not bring the old bug back with it,
because a form inserted among named ones finds its place taken and starts
fresh — which is what it is.

**Why not let the order of `subs` carry ownership.** It needs no new field,
and the editor already splits `subs` into forms and cells and rejoins them
on save — so the relationship would live in an array order that one careless
edit re-points invisibly. A second source of truth for the thing the first
one is about.

**A known word's cells climb a narrower ladder.** Sixteen cells over two
forms, each asked every exercise its material supports, is a fortnight of
questions about a word plus an ending learnt once. So a cell whose form has
reached the top of its own ladder is asked **one exercise per level** rather
than all of them: the same four rungs, one question each. It is applied in
`laddered`, which is the single list every reader downstream goes through —
what a session deals, where the progress screen says the card stands, when
it counts as learnt. The alternative, a second bar inside the scheduler,
would have had to be threaded through `openTypes`, `reachedLevel`,
`standings` and `maturity` separately, and four copies of one rule is four
places for it to drift.

**What it cost, and what it fixed on the way.** Two new fields on the wire,
and the editor minting names for forms that had none. And `cardToItem` never
carried `row` or `col` at all, which is every part of a table: a verb's rows
reached a student as a heap of alternate forms, no row opening before
another, the cited form drilled twice over, and no sentence ever agreeing
with what filled it. Nothing reported it, because everything that reads a
table read nothing.

---

## One card, four editors

**15 September 2026** · `src/card-editor.tsx` — `useWordDraft`,
`useSceneDraft`, the blocks, `WordEditor` / `VerbEditor` /
`AttachedEditor` / `SceneEditor`, and the `CardEditor` shell

The stored card is one thing, and that is the right shape: a verb, a word
with pronouns on its end, a value and a conversation all reached sync,
marking, recordings, the scheduler and the progress screen without any of
those learning a new kind. The editing screen was where the same bet was
being paid against. One ~1,300-line component held all four kinds with
booleans — `scene`, `verbMode`, `attachedMode`, `standsIn` — and 0.131's
four editor bugs were one bug: the recording overlay found the wrong cell,
the save dropped whichever table was off screen, *Add a form*'s condition
was flipped for the third release running, and an overlay was titled off
the verb's spec on a pronoun card.

**So the editor is four editors over one draft.** Each is a list of blocks
in an order, over the draft it is handed, and asks nothing about what kind
of card it is drawing; the shell chooses which of the four to draw, and
that choice is the one place the kinds are told apart. The blocks —
`KindBlock`, `FormBlock`, `BlanksBlock`, `TurnBlock` and the rest — are the
framed sections a teacher already saw, cut at the seams they already had.

**The draft lives above the editors, in two hooks called unconditionally.**
A new card can be turned from a word into a conversation and back, or from
a word into a verb and back, and what was typed the first time must still
be there the second — the "put aside — N boxes" warning depends on the
off-screen table still being held. When all of this was one component's
`useState`s that was free. Letting each editor own its state would have
meant escrowing it on unmount, which is exactly the kind of cleverness the
bugs came from; so the shell calls `useWordDraft` and `useSceneDraft`
whichever editor is showing, and the editors draw. What is *not* kept
across a switch is transient widget state — an open keypad, an open grammar
panel, an answer row added and left empty — because the blocks now remount.
Accepted, and said in a comment: the old fixed layout kept those open only
by keeping every kind's blocks on one screen at once.

**Three word editors, not one with a switch.** The attached-pronoun editor
differs from the word editor by a table inside each form block and one line
of microcopy, and a `table?` render-prop on `WordEditor` would have been
the boolean back under another name. It is its own short component that
lists the same blocks, so the shell's choice stays the only switch and the
name is something a test, the gallery and a grep can point at.

**What moved, and what it fixed on the way.** The editor family — the
editor, accepted answers, a form's recordings, the verb table, the deck and
blank pickers, `shapeOf` and `formsOffered` (which the entries at
*The editor's three kinds* and *A table is a table* name as living in
`spaces.tsx`) — is in `card-editor.tsx`, byte for byte first and cut up
after, each step checked against a DOM snapshot of the editor at seven
points. Cutting it exposed that any card with a cell was being seeded with
a verb's dictionary form, which opened a saved attached-pronoun card on the
verb table and dropped its pronouns on save; that shipped as 0.132 on its
own, before the split.

---

## A form kept without being asked about

**15 September 2026** · `ask` in `src/types.ts`, `isAsked` in
`src/scheduler.ts`, `askParts`/`AskBlock` in `src/card-editor.tsx`

A card is a word and a pile of forms of it, and every one of them was
drilled. The only way to stop any of it being drilled was to delete it —
which took its recordings, and every student's progress on it, with it. The
entry on verb tables above says as much in passing: a saved verb is not
offered the change that would drop its table, and "the way out is to empty
the table, which is the same act said honestly". It is honest, and it is
also the only way out of a want that has nothing to do with deleting
anything. A teacher writing a conjugation table out for a class to read is
not asking for twenty-one more questions a day.

**So a form says whether it is asked about, and absent means yes.** One
boolean, on the forms themselves — where a cell is a form, so a table is
covered by writing it on the cells. Nothing had to be rewritten: a card
saved before this carries none, and anything added to a card after it
carries none, so both are asked. It is what `langsOff` does one floor up —
store what is switched *off*, and a thing that arrives later is in play.

**Read in one place, and that place is the ladder.** `laddered` already
says which keys a form climbs with, and already returns nothing for a cell
of a row nobody has reached. A form switched off returns nothing there for
the same reason, which buys the whole of the rest for free: no question
dealt, no level outstanding on the progress screen, nothing counted
towards how mature the card is, and every state it had still sitting there
for the day it is switched back on. The alternative — a second gate inside
the session builder — would have had the screen and the scheduler
disagreeing about what was left to do, which is the bug that ladder was
built to make impossible.

**The teacher is asked about parts, and the parts are not stored.** What
the section lists is the card's word, each further form, the pronouns on
the end of each of them, the conjugations — which is what a teacher can
see on screen, and is a grouping of forms and nothing more. Storing the
grouping as well would be a second answer to what a card is made of, which
is the thing this codebase keeps having to remove. So `askParts` derives
the lines from the draft and `setAskPart` writes the answer onto the forms
each line covers.

Two of them cover more than they look like. Where a language cites a cell
as the dictionary form, the card's own word *is* that cell — one word in
two places — so the line about the word writes both and they cannot come
apart. And a form's table of pronouns follows the form off: those wait on
the word they are on the end of being known, so under a form nobody is
asked about they could never open, and a tick that does nothing is worse
than no tick. Not back on with it, though. What is asked about is the
teacher's to say, and a table that switched itself on would be the app
answering for them.

**What it cost.** A field on the wire, and a third thing in the
neighbourhood of `drill` — which is about the whole card being a value
rather than something to learn, and stays exactly what it was. The line
between them is that `drill` is a fact about the card and `ask` is a fact
about one form of it; a card with every form switched off is not a value,
it is a card with nothing to ask, and the section says so in those words
rather than pretending the two are the same. And `isDrillable` had to stop
asking the card's own word alone — a verb whose table is the lesson and
whose dictionary form is there to be read would otherwise have vanished
from the list of what can be practised while its forms were being
practised. It qualifies through its units now, the way a conversation
always has.

**What is left out.** Switching an *exercise* off on a card. Which
exercises a form is asked is answered twice already — by the ladder, which
opens them in order, and by the learner's own settings — and a third
answer on the card would be somewhere for the three to disagree. The
parts are forms, which is what the card is made of.

---

## What a word is, the teacher says

**15 September 2026** · `WORD_CATEGORIES` and `categoriesOf` in
`src/languages.ts`, `categoryChoices`/`tableFor`/`initialCategory` in
`src/card-editor.tsx`, `category` on the card

Two entries above rest on the same claim: nothing stored says "verb". *The
editor's three kinds are not the four stored kinds* and *A table is a table*
both say a card's shape is derived — a verb card is one whose forms carry
cells in the verb's rows, and the editor reads that off the rows rather than
off a label.

Deriving it was right about the table and wrong about the card. The rows a
cell sits in say which table it is; they do not say what the word is, and
the editor needed that second answer to know what to offer. So it guessed,
and the guess was "has it got cells, and in whose rows" — which is how a
saved word with pronouns on its end opened as a verb, had its pronouns put
aside, and lost them on the next save (0.132). A card carrying nothing yet
could not be guessed at all, so the teacher was asked a question in the
app's own vocabulary instead: *Just this word · A verb · Attached
pronouns*, which is a question about machinery.

**So a card says what kind of word it is, and the table follows.** Noun,
verb, adjective, preposition, pronoun, name, number, or something else —
the language pack's own list, because parts of speech are a language's
answer and not this app's. A noun and a preposition take the pronouns on
their end; a verb has its persons and tenses; the rest are the word and
whatever forms the teacher writes.

**What is still derived, and deliberately.** The table. `verbs.ts` is
untouched: a cell belongs to whichever table declares its row, `hasCells`
reads that, and nothing in the scheduler, the session or the server has
learnt a new word. The category decides only what the *editor* offers. That
line matters — it is what keeps this one field from becoming a second
source of truth about content that already says what it is.

**And nothing about drilling reads it.** It would have been easy to make a
name un-drilled by category, or to let the category pick which blank a card
fills. Both are real and both are later: `drill` and `fills` are the
teacher's answers today, and changing what they mean in the same release
that introduces the field would be two changes wearing one coat.

**Why one noun rather than two.** "A noun with pronouns" and "a noun
without" is one part of speech asked as two, and the difference is already
visible: the table is either filled in or it is not. A noun in a language
that attaches nothing — Huế — is a noun with no table under it, which is
what a category naming a table its pack has not got means.

**It sits beside `kind`, which is a different question.** Word, phrase and
sentence are read off the text and always were: how long a card's words
are is not something a teacher should have to declare, and it decides
things about exercises that a part of speech does not. The category is the
one thing about a card no amount of reading the script will tell you.

**What it costs.** A card written before the question carries no answer.
The editor works one out from what the card holds — a verb's table makes it
a verb, pronouns make it a noun — and shows it *selected* rather than
storing it quietly, so a teacher opening an old card sees what it looks
like and can say otherwise. Nothing is written until they save. A card
whose table already has something in it is still told what it is rather
than offered the change, which is 0.120's rule unchanged: the table is the
content, and offering to swap it is offering to throw it away.

---

## A card is its forms

**15 September 2026** · `src/cards.ts`, `Item`/`Card` in `src/types.ts`,
`liftItem` in `src/ArabicTrainer.tsx`, `forms` on the stored card and on the
wire

A card was a form with a list of other forms beside it: its own word lived
on the card, and its alternates in `subs`. Two shapes for one kind of
thing, and the seam between them was written out by hand wherever anybody
wanted the whole list — `[card, ...subs]` in one place, a push then a loop
in another, a filter over `subs` in a third. 0.136 put one door in front of
that (`formsOf`); this moves the stored shape to what every reader already
believed.

**Why it was worth moving rather than leaving the door in place.** The
duplication was not in the walking, it was in the *describing*. Every fact
that belongs to a form had to be declared twice — once as a field of the
card, once inside `subs` — and the two drifted every time: a sub-form had
no id until 0.131, `ask` needed a card-level answer beside the per-form
one, and a cell of a pronoun table had to invent `of` to say "I belong to
the card's own word". One list means one description, so the next per-form
field is written once.

**Lift on read, not a migration.** `formsOf` reads a card written the old
way as the list it always meant, and `liftItem` writes the new shape back
the first time a document is loaded. A card from a course, a card synced
from a device on an older build and a card in an exported file all come
through the same door. Nothing is rewritten on the server: the whitelist
stores one `forms` list, and a client too old to read it is not supported —
the app updates itself, and holding a second shape on disk for builds
nobody is running is the cost this whole change exists to remove.

**What had to be decided rather than translated.** Three questions used to
be answered by the card and the form being the same object:

- *Which language is this form in?* The card carries it. Every builder of
  an item — the course reader, the editor, the document lift — stamps it
  onto each form, which is what `Form.lang` always said and was only true
  of the lead one by accident. A sub-form of a Vietnamese card used to be
  read in whichever language the app happened to be set to.
- *Is this card a conversation?* `isDialog` reads the turns, and a form
  carries none. The whole-scene questions — read it through, put it back in
  order — are asked of the scene's own word, and the dialog index says so:
  it places that word at `WHOLE_SCENE`, beside the turns it places at their
  own numbers. One question ("where does this unit stand in its scene"),
  one answer shape.
- *Has this card a hole in it?* `slotsOf` and `valueOf` read the card's own
  word, so "is this a frame" and "what does this card lend a blank" are
  answered the same whether a card or a form is handed in. A plain form is
  its own lead, which is what makes that work.

**What it costs.** `leadOf` allocates on a card written the old way, and
`slotsOf` and `valueOf` now ask it on every call — measured against the
smoke harness and lost in the noise, and the alternative was a second
argument on a dozen functions. The bigger cost is the one above: three
facts that used to be free now have to be carried deliberately, and a
fourth of its kind will too. That is the honest price of the card and the
form being different things, which they are.

---

## What a card says it is, is what it fills

**15 September 2026** · `fillsOf` and `lentBy` in `src/variables.ts`,
`ownSlot` in `src/verbs.ts`, the `valueIndex` and `valueReach` memos in
`src/ArabicTrainer.tsx`, `SentenceEditor` in `src/card-editor.tsx`

A blank used to be named on both sides: a card wrote `{{name}}` in its
words, and every card that could fill it carried the word "name" in
`fills`. That is right for a hole with a particular sort of thing in it and
wrong for nearly everything else, and it is the reason `{{word}}` exists at
all — naming every word in a deck one at a time is filing rather than
teaching. 0.137 had the teacher say what kind of word each card is. This
release reads that answer as the second half of the same sentence: **a
blank named after a kind of word is filled by the cards that say they are
one.**

**Why the category and not a new field.** The alternative was a "what can
this fill" list on every card, which is the `fills` field again with more
boxes. The category is already the teacher's answer to a question they were
already asked, and 0.137's own entry named this as the change it was
deliberately not making yet ("it would have been easy to let the category
pick which blank a card fills — that is real and it is later"). Later is
here, and nothing about `fills` or `drill` has changed meaning: a card that
exists only to fill a hole still says so, and still belongs to no deck.

**variables.ts still knows no language.** It matches a slot name against the
card's `category` string and never asks what categories exist. A pack that
declares none fills none; a teacher whose pack has no `noun` may still name
a blank `noun` and write the cards that fill it, exactly as before. Which
names a language has is the pack's business, here as everywhere.

**Every form lends, each under its own name.** A card is its forms (0.138),
and every one of them is a word a sentence could be about — the plural, one
cell of a verb's table. They lend under the *form's* id rather than the
card's, which is what makes the gating right: how far a learner has climbed
is a fact about a form, and so is a frame's record of having met one. The
card's own word keeps the card's id where the form carries none, so every
record already written still points at the same thing and nothing had to be
migrated. A form the teacher keeps without asking about lends nothing: it
has no ladder to read, so a hole filled with it would hold a word nobody is
ever taught.

**`{{verb}}` means two things, and the form says which.** On a verb card's
own sentence — a row and no column — it is the card's own place, filled
from the table below it by whatever fills the subject. Anywhere else it is
an ordinary blank named after a kind of word. That was decided by `ownSlot`
rather than by a flag because the two readings differ by a fact the form
already carries, and the alternative was a sentence card that could name
every kind of word its language has except the one a sentence most needs.

**A sentence is read off the card, not stored.** The braces are in the text,
so "has this card a blank in it" is a reading rather than a guess — which is
what separates it from the table, where two tables that look alike had to be
asked about (0.137). Nothing is stored saying "sentence"; a card that loses
its last blank is a phrase again. The editor's third answer is a choice
about which editor you get, and a sentence saves no category, because a
sentence is not a part of speech and a card claiming to be one would be
offering to fill a hole.

**What it costs.**

- **Pools got bigger.** A blank now draws on every form of every card of
  that kind, so which value a given asking lands on has moved. The rotation
  is still an odometer over a list in the order the cards were written, so
  it is still the same sentence for the same count — but it is not the same
  sentence it was before this release. Nothing is lost by that; it is
  written down because it looks like a bug the first time somebody notices.
- **A blank is filled from what the student already has.** The server sends
  a teacher's `fills` cards with any deck whose phrases leave a hole of
  that name, and that was deliberately *not* extended to categories. A noun
  is a card in its own right and belongs to a deck; bundling a teacher's
  whole noun library onto a student because one sentence says `{{noun}}`
  would make a deck mean nothing. The cost is a sentence that cannot be
  asked until the words reach the student, which the editor reports as the
  blank having nothing to fill it.
- **A card with a blank fills nothing at all now,** where before a frame
  carrying `fills` still stood in other cards' holes. That was the
  documented intent and the undocumented exception; the exception is gone.

---

## A language declares its tables by name

**16 September 2026** · `tables` on the pack and `gate`/`perForm`/`label`
on `VerbSpec` in `src/types.ts`; `tablesOf`/`specOf`/`dimsFor`/`agreementOf`
in `src/languages.ts`; `quietUnits`/`easedUnits` in `src/ArabicTrainer.tsx`;
`tableFor`/`storedFormsOf`/`initialCategory`/`askParts` and `TableEditor`
in `src/card-editor.tsx`; `GRAMMAR.human`

*A table is a table* said a verb's table is sub-forms seen through two
axes, and everything downstream took a second table without being told.
What stayed named was the **registry**: two fields on the pack, a closed
union on the category, two accessors, and fourteen places in the editor
that asked *which accessor* a spec came from. A third table would have been
a third field, a third accessor and a third branch at each — and the owner
had just pointed out that six of the eight kinds of word bought nothing.

**So the pack declares its tables by name**, and a table says the two
things about itself that are not its rows and columns: what its cells wait
on (the row above, or the word) and whether every form carries one or the
card does. The gating rules did not change a line; which rule applies is
read off the table, and the loop over them is one loop. `verbOf` and
`attachedOf` stay, because two callers genuinely want *the verb table by
name* — a verb's own sentence, and the dictionary form — and a name is what
they were asking for all along.

**Editors stay separate.** The fourth is a list of blocks like the other
three, chosen by two facts on the spec, and the choice still lives in the
shell. `VerbBlock` became `TableBlock` because it draws any table the card
carries; the verb's editor differs from the new one by a name to list it
under, which is the citation's business and nobody else's.

**Number's table is not the adjective's with a cell left blank.** The
reason is the picks, not the blank: the noun a number counts is plural, so
an agreement table's plural column would fire on every counted noun and
select a cell nobody fills. A number's column picks on gender alone. And
Hebrew's agreement table is not Arabic's — feminine, masculine plural and
feminine plural — which is itself the argument for a registry where each
pack declares its own columns.

**Fields per kind are display only.** Each category lists the axes it is
asked about, within the pack's own list, so the shared category list can
name an axis and Huế, which has none, is untouched. Storage stays wide:
`dimValues`, `grammarFields` and the server whitelist walk every axis, so
nothing saved changes meaning and a value written before the kinds narrowed
is kept. A name keeps its number as well as its gender because the verb
beside it reads both to choose *he* or *she*; a name with no number would
silently stop agreeing.

**Person or thing is an axis that never labels anything.** It exists for
one rule — a plural of things takes the feminine singular adjective — and
is asked only of nouns. It would have printed "thing" on every noun's tag,
so an axis may now carry its own short forms, and this one's are empty.

**What it costs.** One more question on every noun card. One checklist
label reworded ("Its attached pronouns"). And the reason the next release
exists: an adjective's cells now lend themselves into `{{adjective}}` by
turn like any other form, so a sentence can put كبيرة beside كتاب until
agreement is built on the table this release declared.

---

## An agreeing card lends its word, and the sentence picks the form

**16 September 2026** · `agreedValue`/`agreeWith`/`picksOf` in
`src/verbs.ts`, `lendsForm` in `src/languages.ts`, the `lends` predicate on
`lentBy`/`valuesFor` in `src/variables.ts`, `VALUE_OWNER` and `agreeTook`
in `src/ArabicTrainer.tsx`

0.139 had every form of a card lend itself into a blank, by turn. For a
plural beside its singular that is right: both are words a sentence could
be about. For an adjective it is wrong twice over — كبيرة is not a word
"{{adjective}}" could be about, it is what كبير becomes beside a feminine
noun — and a table declared in 0.140 for exactly that purpose was being
read as three unrelated words.

**So a card whose forms agree lends its own word only, and the sentence
goes back to the card for the form.** Which cards those are is
`agreementOf`: a kind of word whose table has one row and a column that
picks. The pool stays language-blind — `lentBy` takes a predicate and
never asks why — and the one predicate, `lendsForm`, is read by the
session, the teacher's preview and the teaching space, so the three cannot
disagree about which words are in a hole.

**The rule is the verb's, with two additions.** A column picks on the
filler's grammar, most specific wins, as `personFor` has always done. A
column may now be called for by more than one kind of filler, because
Arabic's feminine adjective is called for by a feminine singular noun *and*
by a plural of things, which no single set of values names — so `picks` is
one record or several, each matched on its own. And "no column picks" is
the word itself: a masculine singular noun wants كبير, which is the word,
where a verb's own sentence had no such case because its own word is a
cell.

**What it agrees with is the first other blank.** The same rule as the
verb's subject, and for the same reason: the teacher who wrote the sentence
already said which came first. "{{noun}} {{adjective}}" needs nothing more
said.

**A blank cell asks nobody.** A column that picks a cell the teacher left
empty leaves the sentence unfilled, the way a verb's own sentence is left
when its table has no such form — and for the same reason: nothing to ask
and nothing to invent, and an unfilled hole on screen is a bug somebody
notices rather than a wrong form somebody learns.

**A verb from the pool still cannot agree.** Only a one-row table supplies
its own row; a verb's three rows need a sentence to say which, and a
sentence card has nowhere to say it. Its forms go on taking turns into
`{{verb}}`, and the changelog says so rather than letting it look fixed.
The honest fix is a later "a sentence says when", which is a fact on the
sentence card and a different entry.

**What it costs.** The owner index is a second map filled in the walk that
already fills `VALUE_REACH`, keyed the same way. Which sentence a given
count lands on moved for adjective and number cards, once, because their
pools shrank to the word. And `fillableAt` cannot foresee a blank cell, so
a sentence may be dealt and then left unfilled — the gap the verb's own
sentence already has, now shared.

---

## "Too easy" writes the ladder directly, once, on the form that was asked

**16 September 2026** · `liftLevel`/`hasLevelAbove` in `src/scheduler.ts`,
`liftCurrent` and `easedFor` in `src/ArabicTrainer.tsx`, the `lifts` mark
on `FLAG_KINDS` in `src/shared.tsx`

A learner who already knows a word had no way past the days of exercises
the ladder deals them. The fourth flag is that way, and three choices
about it were not obvious.

**It is not a report.** The other three flags are sent to the teacher, and
this one is not: it is the learner's own shortcut, it needs no account, and
the server never sees the kind. Putting it in the flag menu is a choice
about where a learner looks for "this question was wrong for me", not about
what happens next. The owner chose this over reporting it.

**It moves the form that was asked, not the card.** A card's ladder is
climbed form by form — the plural and each cell of a table have their own —
and a learner who finds the singular easy has said nothing about a plural
they have not met. The whole-card reading would have skipped it.

**It writes the states directly, not through the grader.** The grader's
"easy" would have done for a new form, but it pushes a form already in
review far past where it was, and it moves the count of right answers —
which is what rotates a card's spellings and blanks — for questions never
answered. The rule instead: the bar of the *next* level, applied to every
key below it (which is how a level opens, and why climbing from three
re-raises one and two), the smallest interval that meets it, and nothing
touched that is already there. At the top there is no next level, so the
form is counted as mastered throughout.

**Done on Send, and the grading on Continue then skips that form.** The
message under the button says it has happened, so it has to have. The
grading remembers *which question* was lifted — the question object, not a
yes — because a session left without pressing Continue would otherwise
carry a yes into the next session and swallow its first answer, which it
did, in the smoke walk, before it was a question.

**What it costs.** A learner who flags a hard card as easy has skipped a
level of it and meets it again at the next; the flag is deliberately not
behind a confirmation. And a trial records nothing, as before.

---

## The shape of a session is fixed, and Advanced is gone

**15 September 2026** · `SESSION_SIZE`, `PER_UNIT`, `MAX_UNITS_PER_FAMILY`,
`NEW_PER_SESSION` and `RETIRED_SETTINGS` in `src/ArabicTrainer.tsx`,
`marking` in `src/languages.ts`

The owner asked why the same cards kept coming round in practice. Most of
the answer was not a bug: an eighteen-question session was six cards asked
three ways each, the similar-cards grouping picked those six to be as alike
as the due list allowed, and a card that lays out forms — a verb, a word
with pronouns on the end — brought four of them, which made a session of
verbs two words and eighteen questions about them. All three were settings,
all three were on by default, and the answer was to remove the settings.

**A control over how well the app teaches is not a setting.** The Advanced
disclosure said "the defaults are sensible — open this only if you want to
change them", which is the panel admitting what it was. If the defaults are
sensible they are the app; if they are not, the fix is a better default.
What made it worth deleting rather than tidying is that a learner cannot
evaluate these: nothing on the screen connects "Exercises per form — 3" to
"you will see nine words tonight rather than six", so the slider asks a
question its reader has no way to answer. The same reasoning took the
marking leniencies — whether a missing haraka is a mistake is a fact about
Arabic, and the packs now state it in `marking` — and the hints switch,
which was a way to learn less without being told.

**The values are not the old defaults.** Freezing them would have shipped
the complaint permanently and taken away the one workaround. Two ways per
form instead of three, two forms per card instead of four, no grouping. An
ordinary session is nine words rather than six; a session of verbs is five
rather than two.

**Stored values are dropped, not honoured.** `RETIRED_SETTINGS` strips them
on load and on import. Keeping them would have been the cheaper change and
would have meant a learner who once set harakat to "must be typed" carrying
that for ever with nothing on any screen to say so — a hidden setting is
worse than either answer to it.

**What it costs.** Three things are no longer possible: a longer or shorter
session, practising with an exercise type switched off, and stricter
marking. The first two have a partial answer already in Build a session,
which chooses cards, a mode and a length by hand. The third has none, and
if a teacher ever needs it the place for it is the course rather than the
learner's own settings — it is a judgement about the material.

Not done here, and still true: a question answered wrong is re-asked as the
identical question appended to the end of the session, outside the pass
that spaces a session out, so two misses on one card land back to back.

---

## A learner can ask for a card, and the mark is theirs

**16 September 2026** · `priority` on the card in `src/types.ts`, `isUrgent`
and `setPriority` in `src/ArabicTrainer.tsx`, `foldCourses` in
`src/shared.tsx`

The schedule decides what a learner practises, which is the point of the
app and is also occasionally wrong about them: the word they need for
Tuesday, the one they keep fumbling in conversation, the one the lesson was
about. High priority is the one override, and three things about it were
not obvious.

**It is a flag the learner clears, not one that clears itself.** The
alternatives were "until it has been practised", which makes it a bump
rather than a priority, and "until it has been got right", which is tidier
and quietly decides on the learner's behalf when they are done with a word.
The owner chose the standing mark. The cost is real and is the reason this
is written down: mark thirty cards and every session is those thirty until
they are unmarked. What makes that acceptable is that it is visible — the
star is on every tile in the card list — and one tap to undo.

**It outranks the rules that hold new cards back.** A card nobody has met
is normally rationed, by the three-a-session limit and by the pause when
ten cards are already being fought. Both of those are the app protecting
somebody from more than they can hold, and neither is worth saying to a
learner who has just pointed at a card. One card, chosen on purpose.

**A course card's lock does not apply to it.** Cards come from courses and
a course card is locked, which is the app saying the wording belongs to the
teacher. What a learner wants to practise is not the wording, so this is
written straight rather than through the editor's patch — and `foldCourses`
has to carry it over a refresh by name, because that takes the teacher's
card whole and would otherwise wipe every mark on the device every
forty-five seconds.

**What it costs.** A marked card is in every session, so the rest of the
deck waits. There is no list of what is marked other than the card list
itself, and no way to clear them all at once; if that turns out to be
wanted, the card list is where it goes.

---

## A missed question rejoins the queue rather than being pushed onto it

**16 September 2026** · `requeueMissed` and `varyTypes` in
`src/ArabicTrainer.tsx`, `tests/session.test.mjs`

A session is spaced out when it is built — no two questions running about
the same card — and a question answered wrong was appended to the end of it
afterwards, which skipped that pass. Miss both questions about one word and
the session finished by asking about that word twice in a row.

**The fix is the pass, not the place.** The retry still goes to the back of
what is left, and that was always right: the gap is then the size of the
rest of the sitting, which is a retest rather than a copy of an answer
still on the screen, and it scales by itself — fifteen questions in a long
session, three in a short one. It now looks for a slot clear of the card's
own questions on both sides, forward from the back.

An intermediate version put it a fixed three questions ahead and doubled
that on each further miss. It was written, tested and thrown away: with
every answer wrong it took three times as many questions to meet the
material once, which the smoke walk caught by running out of turns before
it had been asked half the exercises in the deck. A learner who is
struggling is exactly who should not be made to grind the first three cards
before seeing the fourth.

**Where there is nothing to stand between, it stands next to itself.** The
last question of a session, missed, is asked again immediately. Dropping it
was tried and is worse: a session of one question would end the moment it
was got wrong, having taught nothing, and Ultimate promises in as many
words to repeat what you miss until you have it right.

**The spacing pass now changes the word before the question.** Where it
could not have both, it used to keep the card and change the exercise type.
Two words in a row asked the same way is barely a texture; the same word
twice running is what a learner writes in to complain about.

**What it costs.** Both functions are exported solely so they can be
tested, which is how the second of these was found — the first attempt
passed every test that was written before it and failed one written after.

---

## A reader that agrees with its fixtures and not with the disk

**16 September 2026** · `initialForms`/`initialCells` in
`src/card-editor.tsx`, `foldForms`/`foldCourses` in `src/shared.tsx`,
`liftStates` in `src/ArabicTrainer.tsx`, `RETIRED_CARD_FIELDS` and
`clipsOfCard` in `server/api/courses.js`

*A card is its forms* moved the stored shape to one list and said the lift
on read was what made that safe: `formsOf` reads a card written the old
way as the list it always meant, so "nothing else in the app knows there
were ever two shapes." That was true of everything that asked `formsOf`.
Five readers did not ask, and the entry's own confidence is why nobody
looked: they went on reading fields that nothing had written since.

**The editor was the worst of them.** `initialForms` built its first block
from `card.ar`, `card.clips`, `card.ask` — the card's own word, where it
lived until 0.138. The server had stopped writing there, so a card saved
since opened blank; and because a save spread the stored record under the
new fields without clearing the old ones, a card written *before* 0.138 kept
a stale copy of its word for ever and opened on that. Either way the next
save wrote the wrong thing back over the right one.

**What made all five invisible is the same thing.** Every fixture in the
suite was written in the pre-0.138 shape — `{ ar, en, subs }` — and every
reader of a card reads that shape as the new one without complaint. So the
readers agreed with the fixtures and the fixtures disagreed with the disk,
and 514 tests passed. Tolerance at the boundary is right (a card is
somebody's work, and half of it read is worth more than an exception), and
it is exactly what turns a wrong reading into a silent one. **A tolerant
reader needs a round trip, not more fixtures.** There is one now, in
`tests/cards.test.mjs`: a card in the shape the server stores goes to a
device, through the fold a refresh makes, into the editor and out again,
and every field is checked at the far end. It fails on four of the five.

**The old shape is cleared on save rather than left underneath.**
`RETIRED_CARD_FIELDS` is a written-out list, not a derived one: these are
the fields that stopped belonging to a card, and the next field to stop
belonging to one belongs beside them. Keeping both shapes was never
decided — it was what spreading `existing` did — and the cost was a stale
copy of every old card's word on disk and on every wire payload, with a
reader free to pick the wrong half.

**The fold has to name what it keeps, and that is a bad shape.**
`foldCourses` takes the teacher's card whole and copies the learner's own
facts back onto it one at a time — the schedules, the priority mark, and
now the conversation's turns and each frame's record of the words it has
met. Anything not named is wiped, on a poll that runs every forty-five
seconds. Two of the four were missing and it took an audit to see, because
nothing fails: the card is still there and still correct, and only the
progress is gone. The honest fix is the other way round — start from what
the learner has and take the teacher's *wording* — and it is not this
release: the wording is spread across a dozen fields and the card-level
facts are three. Written down so the next person to add a per-learner
field knows it has to be named, and that the shape is upside down.

**`met` merges rather than being taken.** It is a high-water mark, so `max`
is the answer whichever side is asked and asking twice changes nothing —
the same rule sync already merges it by. A fold is not a merge, but making
it behave like one costs nothing and removes a question.

**A cell of a table finally has a name.** 0.131 gave forms names because
matching a student's progress to a teacher's forms by position handed
schedules to the wrong words when a form was inserted. A cell is a form,
and it was left out: cells were minted with no `id`, and the editor
rewrote an edited cell onto the *end* of the list on every keystroke — so
correcting one box of a verb's table shifted every box below it by one on
every device holding the card. The fix is a name and an in-place write. The
positional fallback in `foldForms` is what carries the tables that already
exist: an unrecognised name matches by position, which is what it was
written for.

**What a document drops on the way in, it drops for ever.** `liftStates`
walked `TYPES` and the v2 map, which is every key that existed when it was
written. A card accepting two spellings schedules the second under
`ar2en@1`, and that key was not in either list — so it was dropped on load,
after every sync and on every import. The suffix was chosen in 0.99
precisely so that nothing else had to be told about it ("sync goes on
merging state name by name without being told anything"), and the one place
that *does* enumerate keys was missed. Anything that lists what a form may
carry is a second answer to a question the keys already answer, and this
one now filters by `typeOf` instead of listing.

**The ladder belongs to the card, not to the question.** "Too easy" read
`laddered` off the unit being displayed, and a displayed unit has had its
blanks filled in — so a sentence card looked like an ordinary phrase,
claimed the exercises a card with a blank can never be asked, and had a
review state written for one of them while the level it was really on
stayed shut. Everything else that reads a ladder reads the stored form;
this now does too. The general rule is worth stating: **a cast form is for
showing, never for deciding.** It is narrowed to one spelling, one meaning
and no holes, and every one of those is a fact the schedule depends on.

**One gate, two callers.** `askedUnits` is the two gates every reader of a
card's forms shares — a cell behind its row, a form kept without being
asked about — and `drillableUnits` is that plus the two-exercise minimum a
dealt session wants. The manual builder needed the gates without the
minimum and so walked `unitsOf` itself, which is how it came to ask a table
the teacher had switched off. Splitting the function was cheaper than
threading a number through it.

**What the caps cut is now reported rather than inferred.** The server's
whitelist caps everything, and each cap worked in silence: a thirteenth
turn was dropped and the answer said "Saved". `trimmed` is counted by
comparing what arrived against what is stored rather than by repeating the
numbers, so a cap added to the whitelist is reported without being told
about — the numbers stay in one place, which is the condition on which
this is worth having at all.

**And the harness rolls a seeded die.** The smoke walk ran on real
randomness, so it answered a slightly different app on every run; its own
comments record a check that "failed about one run in seven" and was
loosened until it passed. It is seeded now — still varied within a run,
which is a thing the walk checks, and the same sequence on the next one, so
a failure can be reproduced and a flake cannot be mistaken for a fix.
`SMOKE_SEED` takes another. The clock is left real: ids, `created` stamps
and the save debounce all read it, and a frozen one is a different kind of
unreal.

**What is left out.** The structural item the audit put last: dealing,
marking and the load-time lift still live inside the screen file, and
`applyGrade` is still a closure over ten pieces of component state, so the
write path that files a mark against a form has no unit test. Four small
seams were opened here instead — `laddered`, `liftStates`, `merge` and the
two module-level indexes a frame's behaviour depends on — which is enough
to assert the rules this release changed and not enough to call the
question closed.

---

## Marking an answer comes out of the screen

**16 September 2026** · `src/grade.ts`, `contextIndexOf`/`valueIndexOf`/
`valueReachOf`/`installIndexes` and the exported `buildSession` in
`src/ArabicTrainer.tsx`, `tests/grade.test.mjs`, the dealing half of
`tests/session.test.mjs`

The audit above ends with an item it did not do: dealing, marking and the
load-time lift all lived inside the screen file, so the part of the app
that decides what you practise and what you have learnt could not be
tested. This is that item.

**It is the move the scheduler already made.** `scheduler.ts` opens by
saying the spaced-repetition maths lived inside the screen and therefore
had no tests at all — "it could not have any: it was unreachable from a
test, and every function read the clock and the random number generator
straight out of the global scope." Marking was in the same position for the
same reason, one floor up, and the fix is the same: a plain module, no
React, nothing imported from the screen, and the impure things passed in.

**What moved, and what the line is.** `grade.ts` answers three questions —
what an answer counts as (`verdictOf`), what that writes onto one schedule
(`markedState`), and where it goes on the card (`gradeInto`, through
`withMark`). What stayed behind is what is genuinely the screen's: which
of its pieces were on when Continue was pressed, and which words a grid
put up. The component now gathers, asks and applies, and the `persist`
callback is four lines.

`gradeInto` answers **null** where it wrote nothing — every card named
withdrawn, or the one mark being the question a lift already moved — so the
caller leaves the document untouched rather than saving a copy that differs
in nothing. That was a `let any = false` inside the old loop; it is the
return value now, which is the same fact said where a caller can read it.

**Dealing needed a seam, not a move.** `buildSession` was already a plain
function of its arguments. What made it unreachable was the half-dozen
module-level maps it reads — where each word turns up, what fills each
blank and how far the learner has got with it, which cells are behind a
gate — each of which only a render knew how to fill, because each was
worked out inline in a `useMemo`. So the working-out is named
(`contextIndexOf`, `valueIndexOf`, `valueReachOf`, beside the builders that
already had names) and `installIndexes` calls all of them in the order they
depend on each other.

**The memos stay separate.** Collapsing them into one would have been
tidier and is wrong: the context index walks every phrase against every
word it claims to teach, and its dependency list deliberately reads
`settings.language` rather than `settings` so that typing in a box does not
rebuild it. `installIndexes` is a test seam and says so; the render still
installs each map on its own terms, from the same functions.

**What the new tests found.** Two things, both in the tests rather than the
code, which is the honest answer for a move that changed no behaviour.
Asserting that a session of twelve new cards spreads over four of them
fails, because it opens three: that is the room kept for new cards doing
its job, and the assertion was wrong about the app rather than the other
way round. And a frame with a value in the deck is only dealt reliably when
it is the one *new* card among cards that are due — otherwise it competes
for those three places and the test is a coin toss. Both are now written as
what the rules actually say.

**What is still not covered.** The load-time lift is reachable
(`liftStates` and `merge` were exported a release ago) and the two builders
are, but the *wiring* between them is not: nothing asserts that the screen
hands `applyGrade`'s marks the key that was dealt, because that is the
component. A jsdom walk is the only thing that can say it, and one does —
loosely. The gap is narrower than it was and it has not closed.

---

## A sentence credits the words that stood in it

**16 September 2026** · `fillerMarks` and `filled` on `Mark` in
`src/grade.ts`, `fillersIn` and the owner index in
`src/ArabicTrainer.tsx`

*A sentence is a card made of blanks, and the vocabulary fills them* built
the frame and gated which words may stand in it. It never said what
answering one does to those words, and the answer was nothing: the frame
was marked and its fillers were not. So a learner could write a noun
correctly a dozen times inside sentences while the app went on believing
they had never produced it — and the sentence's own record, `met`, is a
high-water mark of *which values it has been asked with*, which is a fact
about the frame rather than progress on the word.

**The grid is the precedent, and two of its three rules carry over.** A
matching grid is the other exercise where one answer is about several
words, and it already says that every word in it is marked in its own
right and that one dealt in to fill it out is credited without its
schedule moving. Both hold here.

**What does not carry over is blame.** A grid knows which pair was
mismatched. A sentence does not: something in "the book is big" was wrong
and nothing says which part, so a wrong answer counts against none of the
words in it. A right answer is unambiguous about every one of them. The
asymmetry is the whole of why this is not simply "mark the fillers too".

**And a sentence cannot open a rung.** The tempting version credits the
filler exactly as the frame was credited, which would let a word graduate
*write it from its meaning* — the strictest question in the app, defined as
having nothing on the screen to go on — on the strength of an answer given
with a whole sentence on the screen. So the schedule moves only where that
word's own was already under way and due. "Under way" is `phase !== "new"`
rather than "has a state": in memory every type carries one, so the
question is whether the word has ever been asked this on its own.

**It is credited on the form that was shown, which is not always the one
that was lent.** An agreeing card lends its own word and the sentence goes
back to the table for the form that agrees, so what stood in the blank is
a cell nothing lent — and the cell has its own schedule. Which meant the
owner index had to answer for every form of a filling card rather than
only the lent ones. The reach map is deliberately untouched by that: which
values a hole may take is read off the pool, and the pool is what a card
lends, so a further key there would be an answer nobody asks for.

**Two things are left out on purpose.** A card the teacher marked as not
practised on its own — a name — is skipped: it has no ladder, so a
schedule written on it is one nothing reads, and `met` on the frame is
exactly the record for that case. And a verb card's own place in its own
sentence is skipped, because that slot is filled from the card's own table
rather than from the deck: the cell's ladder is the table's gate to open,
not something the sentence above it has earned.

**What it cost.** `filled` moved from the question onto the mark. It had
been read once and applied to every mark, which was harmless while the
only multi-mark question was a grid — a grid never contains a frame — and
would have written the sentence's record onto each word it borrowed the
moment this shipped, saying each had been met with itself. One answer
marks several forms and only one of them is the sentence; the mark is
where that belongs.

**Where the gate and the credit meet.** A cell behind its table's gate has
no keys at all, so it is credited for nothing — which is right, and is not
a second rule: `laddered` is the one list every reader goes through. In
practice the two agree, because an adjective whose own word is unmet
cannot fill a blank either. A test holds them together rather than leaving
it to be rediscovered.

---

## An absence is not an instruction

**16 September 2026** · `server/store.js`, `server/api/sync.js`, `src/sync.ts`,
`src/shared.tsx` (`progressOf`, `withProgress`, `foldCourses`)

Fifteen ways a learner's work could be lost, found by an audit of every
path progress travels, came down mostly to one reading. Three places in
the app treated an emptiness as a decision:

- A course refresh that listed fewer cards meant *the teacher withdrew
  them* — so the cards were dropped, tombstoned, and their progress
  destroyed on every device the learner owns. It equally meant *the read
  failed*, *the deck was detached to be reorganised*, or *the enrolment was
  removed by mistake*, and in each of those the loss was total and
  irreversible.
- A stored document the server could not parse meant *nothing has ever
  been synced* — so the device pushed as a first write, was refused because
  a file existed, re-pulled, pushed again, and gave up. Permanently, for
  every device sharing the passphrase.
- A blank schedule meant *nothing to say* — which is true of a card never
  answered and false of a card just reset, and they are written
  identically. The sparse wire that exists to keep documents small left
  both off, so the other side's old schedules survived a reset by seconds.

**The rule now: where the app cannot tell "nothing" from "not known", it
must not act on it.**

**On the server, a failed read fails the request.** The course endpoints
used to swallow an unreadable record and answer with what they could read,
which is the shape of a complete answer with cards missing — and the device
could only read that as a withdrawal. A read that fails is now a 500, and
the device holds what it has.

**Writes are flushed, and one copy back is kept.** The temp-file-and-rename
was right for a process dying and wrong for a host dying: nothing reached
the disk. Each write now fsyncs the file and the directory, and hard-links
the outgoing version aside first. A document that cannot be parsed is
answered from that copy, and if neither is readable the response says so —
`lost: "unreadable"` — which is what lets the device offer to overwrite it
instead of looping.

**On the device, withdrawn work is parked rather than destroyed.** The
schedules and high-water marks of a card that has gone live beside the
document under the card's id, are restored the moment it comes back, and
are pruned on the same two-week schedule as tombstones. The tombstone still
removes the card; it no longer removes the work.

**A reset is dated, and so is a mark.** Three of the facts on a card are
the learner's rather than the teacher's — its schedules, whether they asked
for it, and whether they sent it back to the beginning — and the last two
now carry their own stamps rather than riding on the card's. The merge
reads schedules against the later reset and drops anything older, and takes
the mark from whichever side spoke about it last. Before this the card's own
`updated` decided, and every graded answer stamps it, so the device that
merely *answered* a card was almost always the later writer and dropped
what the other one had just said.

**What it cost.**

- **Two files per document on the server rather than one**, and an fsync
  per write. The write was never on a hot path — it is one request every
  few minutes per learner — and the previous copy is the only thing
  standing between a bad write and total loss.
- **The drawer of parked work grows the document.** Only forms with real
  progress go in, and only for cards that have actually gone, so in
  ordinary use it is empty; a course detached for a fortnight is the case
  it exists for, and it ages out on its own.
- **A reset now sends something rather than nothing.** The stamp is one
  number on the card, which is the cheap half of the alternative: sending
  every blank schedule stamped "now" would be correct too, and would cost
  the document size the sparse wire exists to save.
- **`allowEmpty` is a flag the client sets**, which is a protocol asking a
  client to say it means it. The server refuses a write that drops a
  populated collection to nothing without it. A learner deleting their own
  cards is the one case that legitimately empties a document, and it says
  so by sending the tombstones that prove it.

**What was left alone, deliberately.** Every merge is still last-writer-wins
on the device's own clock, so a device whose clock is badly wrong still
loses: fixing it means a logical clock per device, which is a different
design, and the failure is rare and visible in a way silent deletion is
not. And the server's write lock is still in memory — correct for the one
process on one volume that runs today, and the honest boundary to note
rather than to build a distributed lock nothing yet needs.

---

## Offline is a state the app is in, not a request that failed

**16 September 2026** · `src/net.ts`, `src/outbox.ts`, `src/shared.tsx`
(`useLiveRefresh`, `rememberSpace`, `useInstallOffer`), `src/ArabicTrainer.tsx`
(`typeAllowedNow`, `loadMaterial`), `src/sync.ts` (`docSize`)

An audit of the app against its own objective — offline-first — found the
learner's loop genuinely sound and the edges online-only. The shell is
precached whole, the document is on the device, practice is pure and
local, and sync merges rather than overwrites. What was missing was one
fact: *the app never knew it was offline*.

Everything followed from that. `navigator.onLine` was read in exactly one
place, to word one error message. So a failed request was the only
vocabulary the app had, and every offline moment had to borrow it: the
corner dot went red, the line beside it said "Offline — will retry" for
causes that would never clear, the polls went on firing every forty-five
seconds into nothing, and a listening question was dealt with a recording
that could not be fetched.

**The state is held in one place and read two ways.** `net.ts` is the whole
of it: a plain function for the module-level helpers that decide what a
session may ask, and a subscription for the components that show it. It
says *offline* with confidence and never promises that a request will
succeed — `navigator.onLine` is famously generous, so false means "do not
bother" and true means "worth trying", which is all any caller needs.

**What follows from knowing:** the polls stop and resume on the event
rather than on a timer; a sync is not attempted and does not report a
failure it did not have; a form whose recordings are elsewhere is treated
exactly as one whose listening exercises are paused, which is a mechanism
that already existed; and the menu line says which failure it was, from a
reason that was already being recorded and read by nobody.

**An absence is still not an instruction** — the rule from the last audit
applies here too, and twice. A course refresh that *fails* no longer counts
as having been told there are no courses, so an enrolled student is no
longer invited to join one. And "which recordings are on this device" is
null until somebody looks, because reading "not asked yet" as "none here"
would silence a card that is in fact ready.

**One queue for work that could not be sent.** `outbox.ts` is a small
durable list, used by reported problems and by a teacher's unsent cards.
Deliberately one rather than two: a second copy of "keep it, try again
later" is a second set of bugs about when to stop trying. The rule that
makes replay safe is that only a request which *never reached the server*
is kept — the server cannot have half-done something it never heard about
— so a refusal is dropped rather than asked again for ever, and the caller
decides which it was, because only the caller knows what its own errors
mean.

**What it cost.**

- **A third thing kept on the device**, beside the document and the
  recordings: the courses, the spaces, and the queue. All of it shares one
  small store with the document, which is why `docSize` now measures
  against that ceiling too — in UTF-16 units, because that is what the
  store counts, where the server counts bytes. The same Arabic document
  sits nearer one limit and further from the other, so both have to be
  asked.
- **A stored version is a claim about the document.** Handing the last
  material version to the launch check is what makes that check cheap, and
  it is only true while the cards it describes are still here. An import or
  a reset makes a liar of it, and the answer would be a student whose
  material never arrives — so the seeding asks the document first.
- **A replayed card save could duplicate**, if a request that threw had in
  fact reached the server. It cannot today: the client throws `offline`
  only when the fetch itself failed. Client-minted card ids would close it
  for good, and are the price of a fuller outbox — which is why the outbox
  is scoped to the one thing that loses a teacher's typing rather than to
  everything the teaching space does.

**What was left alone, deliberately.** Setting up still needs a connection.
Both ways in are requests, and a local-only start is a product decision
about what an account is for rather than a gap in the code; what changed is
that the first screen now says so instead of promising the opposite. And
the teaching space still writes straight to the server for everything but
a card save: a general replay of every teacher action needs ids the client
mints, and nothing yet asks for it.

---

## Being due orders a session; it does not gate one

**16 September 2026** · `src/scheduler.ts` (`reschedule`),
`src/ArabicTrainer.tsx` (`buildSession`, `countReady`)

The question that started this was how much an offline student can practise.
The answer was: about twenty minutes out of an hour, in bursts, and then
nothing until tomorrow. Traced through, a fresh sixty-card course gives four
minutes of work, seven minutes of silence while those cards come back round,
four times over, and then a wall — no new cards until the ones in hand have
settled, with twenty cards of the course unreachable for the rest of the day.

None of it was caused by being offline. Offline was only where it hurt,
because there is nothing else to do and no way to see why the app has gone
quiet.

**The fault was that `due` did two jobs.** One is ordering: of everything
that could be shown, what matters most. That is the valuable one and it
caused none of the trouble. The other is permission: whether you may
practise at all. That produced every symptom above.

Permission is very hard to justify for an app people open on their own time.
Practising a little early is cheap. An empty screen is not — it costs the
learner who was willing, which is the only kind there is. And it turned away
exactly the wrong person: someone returning after a fortnight meets a pile of
overdue cards and never sees the gate, while the new student working through
a course, and the keen one who has caught up, hit it every time.

**So the due filter is gone and the due *sort* stays**, which it already was
a few lines above it in the same function. A session takes the front of the
list whether that is forty overdue cards or the nearest thing to due.

**What makes that safe is in the scheduler, not the session builder.** A
review interval used to grow by multiplying the interval the card already
had, with no reference to when it was last answered — so a card answered ten
minutes after a month-long gap was set would be pushed out six weeks on the
evidence of a ten-minute memory. Remove the gate without fixing that and a
keen evening empties the next two months.

Now a gap grows from the time actually waited — `min(interval, elapsed)`,
where elapsed is read off the card's own `due` and `interval` and so needs
nothing new stored. Two caps make the whole of the behaviour:

- **Capped above at the interval**, so answering late is worth what
  answering on time is. A collection left for a month is not evidence of a
  month's retention of every card in it. This is also what makes every
  on-time and overdue answer identical to what it was before — the
  regression that mattered most, and the thing the first new test asserts.
- **Floored at the current interval**, so an early answer can never take a
  card backwards. Otherwise drilling something you know well would be
  punished by having it thrown at you all week.

A wrong answer is untouched by any of this: it lapses in full, whenever it
arrives, because forgetting is news wherever it happens.

**The limits on new cards were deliberately left where they are.** Three a
session, none at all once forty are still settling. They answer a different
question — how much can somebody take on — and the project has already
decided once that this is the app's call and not a setting. So extra practice
is more of what a learner holds, never more new words. At the old wall they
can now drill the ten cards in their hands and still get no new ones.

**What it cost.**

- **One test changed rather than added.** A near-miss test drilled the same
  card four times in the same instant and expected four advances. Under the
  new rule that is one second of evidence and rightly moves the card once,
  so it now answers on each due date instead. Its intent — that being nearly
  right over and over still reaches the bar — is unchanged and still
  asserted.
- **`readyCount` had to stop lying.** Every never-seen card reads as ready to
  the scheduler, correctly, since nothing is known about it — so a course of
  sixty new cards reported sixty waiting while the new-card rule would admit
  three, and at the wall the screen said "20 ready" over a button that
  answered "nothing ready". It now counts what is genuinely due plus as many
  new cards as would actually be admitted, which is the promise the number
  was always making.
- **A session reports how much of it was waiting** (`due` on the session), so
  the screen at the end can tell a learner they practised ahead rather than
  implying they got through their schedule. Practising ahead is welcome; it
  is not headway, and the app should not suggest otherwise.

**What was left alone, deliberately.** The hand-built session still sets its
own limits and still advances the schedule, which is now simply consistent
with everything else rather than the one exception. And the `practice: true`
mode — which leaves the schedule completely untouched — stays unused by the
learner's path: it was the obvious lever to reach for here and it is the
wrong one, because work that counts for nothing is not what somebody with a
free hour is asking for.

---

## A new word is earned by learning one

**16 September 2026** · `src/scheduler.ts` (`FRONT_DOOR_CAP`, `IN_HAND_CAP`,
`recognised`, `roomForNew`), `src/ArabicTrainer.tsx` (`handCounts`,
`buildSession`), `tests/pace.test.mjs`

Three rules decided how many new words a learner met, and none of them knew
about the others: three a session, nothing while ten cards were mid-learning,
nothing at all while forty were still settling, and a scan of every exercise on
every card to hold new ones back while a pile was going badly. Measured, they
let a learner who never got anything wrong meet about one new word every four
days. A course of any size was a matter of years.

**Two faults, and the second is the interesting one.**

The first is that an allowance counted in sessions is not an allowance at all.
Ten short sittings in an evening were thirty new words where one long sitting
was three, for the same work. Whatever the right amount of new material is, it
cannot depend on how somebody happened to break up their time.

The second is that a word counted as *being learnt* whenever any exercise on it
was unfinished — including one that opened that morning and had never been
asked. A word climbing its ladder kept falling back into the pool, so it held a
place for its whole climb, the pool never drained, and the cap on it was a wall
rather than a queue.

**So: two pools, and a word enters when one leaves.** The front door is words
the learner cannot yet recognise, which is a four-day gap on the first rung —
the same bar that already opens the level above, so *learnt* means one thing in
this app rather than two. In hand is everything not yet fully settled, at any
height. A word leaves the front door early and goes on climbing against the
second cap without blocking a newcomer behind it. That early release is the
whole difference between this and what it replaces.

Nothing counts sessions and nothing counts days. A day-based allowance was
considered and rejected: it needs a notion of "a day" that survives timezones
and two devices, and it answers a question nobody asked. What a learner has
standing is already the right measure.

**The struggling case falls out rather than needing a rule.** A learner who
keeps forgetting has words that never reach a four-day gap, so those words hold
their places and nothing new arrives. That is what the backlog scan existed
for, and it is now a consequence of the caps instead of a fourth thing to keep
in step.

**The numbers were measured.** The note that used to stand over `phaseCounts`
recorded a simulation, concluded that loosening the caps admitted five more
cards and mastered three fewer, and asked the next reader to measure before
changing anything — and there was nothing left to run. `tests/pace.test.mjs` is
that harness, rebuilt so it survives: it plays out a learner day by day against
the real scheduler and session builder, both of which are pure with the clock
passed in.

Over a hundred and eighty simulated days of one session a day, against the
design this replaces: 64-66 words met against 34-35, and 39-43 learnt properly
against 25-28. Three runs each, because the session shuffle is not seeded.

That earlier finding was right about its own design and does not carry to this
one. Loosening a cap whose release is full maturity piles words up and spreads
a fixed session thinner, which is exactly what it measured. Releasing at
recognition lets them flow instead. The sweep also found where *this* design
turns: past about sixteen at the front door, words mastered in ninety days
starts to fall, and with no cap at all it collapses. Ten and sixty sit below
that, and are worth re-running rather than reasoning about.

**What it cost.**

- **A test changed rather than added.** Three session tests pinned "three a
  session" and two fixtures modelled a full hand with ten-day gaps — which
  under the new reading are words already through the front door. They assert
  the pools now. The intent of each is unchanged.
- **The session no longer decides anything about new words**, which means one
  fewer knob in `buildSession` and one more concept in the scheduler. That is
  the right side for it to live on: how much a learner can take on is a fact
  about the learner, not about the sitting.
- **Sixty in hand is a bigger review load than forty young ever was.** The
  simulation says it is carried, because words leave it faster than they used
  to. It is the number to watch if anything about session size changes.

---

## One slip is a wobble; two is a gap

**16 September 2026** · `src/scheduler.ts` (`holding`, `missedTwice`,
`openTypes`, `reachedLevel`, `standings`)

A single wrong answer used to shut every level above that question on the
word. The screen called it *paused* and explained itself well, but it was a
hair trigger, and the most common way to meet it was a lapse of attention
rather than a gap in knowing.

**Pausing was never a rule.** Nothing in the app decided to pause anything. A
miss moves a question out of review into relearning; a level only opens when
everything below it is in review; so the pause fell out of the two. That is
what made raising the bar delicate. The obvious lever — make a miss less
severe — would have changed how every card in the app is rescheduled, to fix
something that is not about scheduling at all.

**So the softening went into the gate, not the schedule.** `holding` sits
beside `graduated` and `mastered` and is asked only by the three readers that
decide whether a level is open: what may be asked, what the screen shows, and
whether a level has been reached. A miss still returns the question in ten
minutes, still costs the word its ease, still halves the gap. None of that
moved.

**Two running, not two ever.** `hist` — the last six outings, 1 right and 0
wrong — is the only record with an order to it, so two zeros on the end of it
is exactly "wrong, seen again, wrong again". A right answer anywhere in those
two slots clears it. Two misses a month apart are two wobbles, and the rule
should not punish them as a gap.

**The length guard is load bearing.** A document written before `hist` existed
carries an empty one, and `[].every()` is true — so without it every old card
would have read as having just missed twice and paused on the spot. The
trainer's `hasRecentMistake` meets the same case and answers it the same way.

**Grace must forgive without promoting.** This is the part that took the
thinking. Read naively, the rule would let a word that had only ever scraped
into review have its first miss hold open a level it was never good enough
for. So `holding` asks the bar what it makes of the state *but for the lapse*.
At the lower levels, being in relearning proves the question had graduated, so
the grace always applies. At the top, where the bar is a four-day gap and a
miss halves it, a word that has only just got there falls under the bar on its
own merits and still shuts the level.

That is a real limit on "always exactly twice", and it is wider than it first
looks: every miss halves the gap, so a word missed repeatedly — even with
recoveries in between — walks its gap down under four days and then shuts the
top level on a miss that the strike count would have forgiven. Checked by
running it, not by reading it: a ten-day word missed, recovered and missed
again sits at three days and closes the top level.

Taken deliberately all the same. The forgiveness is for the miss, not for the
shrinking, and the alternative — holding a level open for a word that does not
currently hold the gap that level asks for — is worse than the inconsistency.
The lower levels have no such bar and always get the full two.

**What it cost.**

- **Three tests rewritten**, each of which encoded one strike in its fixture.
  Their intent is unchanged; they now miss twice.
- **The lockstep test passed untouched**, which is the evidence that mattered
  most. What the app asks and what the screen shows are the same judgement in
  two places, and a change applied to one and not the other would have shown
  up there across three hundred and seventy-five combinations.
- **A near miss counts as a miss** for this, because `hist` records it as one,
  as every other count in the app does. Near miss then miss is two.
- **`graduated` and `mastered` were left exactly as they were.** `recognised`
  — the front-door cap from 0.154 — and `quietRows` call `mastered` directly
  and need the strict reading. A word you have just missed should still cost a
  place at the front door: that is work in hand.

---

## A card fills a list of blanks, not one

**17 September 2026** · `src/variables.ts` (`fillNames`), `src/card-editor.tsx`,
`server/api/courses.js`

`fills` was one name. That is the right shape for what a value usually is —
Raphael fills `name` and nothing else — and it stops being the right shape the
moment a teacher writes a second frame about the same word. *Marhaba* is a
greeting and a name; a city is a place and a name; a colour is a colour and a
thing that describes. The only way to say so was a second card carrying the
same word, which is the same word learnt twice, with two schedules and two
sets of recordings for it.

It is a list. Every card ever stored carries the one name as a plain string
and is read as the list of one it always meant, so nothing is migrated and no
release has to be taken in order.

**One reader, and the server uses it too.** `fillNames` is the only thing that
answers "what does this card say it fills": it takes either shape, lowers each
name, narrows it to the characters a slot may be named with, drops the
duplicates and caps the count. The server imports it rather than keeping its
own copy of those rules, which is what makes "what the editor draws is what
the server stores" a fact rather than an intention — the old copy lived in the
save handler and had already drifted apart from the client's idea of a name
being lowered.

**Absent when it fills none, not stored empty.** A stored card is built by
spreading a field object over the card as it stood, so a key left out keeps
whatever it used to hold — which would make taking the last name off do
nothing. And an empty array is truthy, so storing one would quietly turn
`if (card.fills)` true on every ordinary card in the app; there are a dozen
such readers and they all mean "is this a value". So the field is written as
`undefined` when the list is empty: JSON drops it on the way to disk, every
reader goes on testing what it always tested, and taking the last name off
still reaches the card.

**What it costs.** `Card.fills` is `string | string[]`, which is a union at
the storage boundary and one more thing a reader could get wrong by reading
the field instead of calling the function. The alternative — migrating every
card on the site in one pass — is a worse trade for a field this small: it
would need a release nobody could roll back past.

---

## The editor's Blanks section is two named halves

**17 September 2026** · `src/card-editor.tsx` (`BlanksBlock`, `BlankChip`)

The section does two opposite jobs: a card that leaves a blank, and a card
that fills somebody else's. They were one block, and only the half that
applied was drawn — so a teacher looking for where a word is offered to other
cards found either an unlabelled button or nothing at all, with no way to tell
which of the two they were looking at.

Both halves are now named and both are always on screen. On a card that leaves
a blank of its own, the second half says why it fills none — a sentence
dropped into somebody else's hole is a sentence with a gap where the point was
— rather than offering a control there is no answer to. A heading became
necessary rather than merely nice the moment a card could fill more than one
blank, because the second half then has a list of its own and two unlabelled
lists in one block is a puzzle.

**Showing beats explaining, and the examples are all three fields.** The
preview of what a student will be asked showed the English alone, which is the
one line of the question a learner is never asked to produce: a preview of an
Arabic frame that shows only "My name is Raphael" is a preview of everything
except the Arabic. Each example is now the sentence in the script, in how it
is said, and in what it means. A field the card does not use is not drawn; a
field whose filler has nothing to put in it keeps the braces standing, exactly
as the question would, which is the teacher's answer about the card they have
written rather than a gap to wonder about.

**One half is a readout and the other is a list, and making them match was
the mistake.** Which blanks a word is offered to, and which holes a card
leaves, look like the same question and are not. What a card fills is nowhere
in its words: it is the teacher's answer, nothing can be read off, and a list
is where they give it. What a card leaves is *written in its own words* — the
braces are in the text — so it is a fact about the card, already decided by
the time the section is drawn.

Two releases went into learning that. 0.160 made the fills half a list on the
screen and left the holes half behind a "+ Blank" menu; the two then read as
the same control in two places, and the first thing asked was whether the
button belonged under the other heading — the right question about two things
that look identical, and the wrong answer, since they do opposite jobs. 0.161
answered it by making both tick lists, which is where the shape broke: the
holes half became every blank in the language with the card's two ticked, so
a checkbox sat beside `{{verb}}` on a card with no verb in it, under a heading
saying *these are the blanks in this card*. Neither the heading nor the tick
was true. Symmetry between the halves was never the goal; what the section had
to do was make the two jobs impossible to confuse, and a readout beside a list
does that better than two lists ever did.

**What it costs.** Putting a blank into a card is typing braces again, and
typing braces into three fields that must agree is exactly the thing a teacher
gets wrong — which is what the button was for in 0.139. The guard that
remains is `slotTrouble`: a card whose English has a hole and whose script has
not cannot be saved, and the editor names the field that is short of one. That
is a worse place to catch it than not being able to make the mistake, and it
is the price of a heading that is true. A control that writes a blank into the
fields can come back, but it belongs beside the fields it writes into, not
under a heading that says what the card already has.

**What is offered is what somebody wrote, not what is not built in.** A card
fills `{{noun}}` by saying it is a noun and `{{word}}` by being a word — see
`fillsOf` — so offering every kind of word the language declares made the
commonest action on this screen a tick that did nothing. Dropping every
category id would have been wrong in the other direction, and this is the part
that took the thinking: Arabic declares `name` as a kind of word *and*
`{{name}}` is the oldest frame in the app, so the one blank everybody actually
uses is a category id. So a blank is offered when some card leaves it or some
card says it fills it, which is what "a blank that exists" has always meant
here — a blank being a name two cards happen to agree on rather than a thing
declared. `{{word}}` is never offered, and a card's own kind is said in one
line beneath the list instead, which is also where "why is `noun` not here?"
gets answered.

**And a blank says what is behind it.** The chip was the blank's name and
nothing else, which is the least of what a teacher wants to know about it:
whether the right words are behind it was answerable only by leaving the card
and reading the whole list. Pointing at one now lists the words that will fill
it, each in the same three fields. It opens on hover, on keyboard focus and on
a tap, because a chip on a phone has no hover and one reached by keyboard has
no pointer; nothing in it can be chosen, so it closes on the way out and takes
nothing with it. Eight words, then a count — `{{word}}` is filled by the whole
vocabulary and a panel that printed all of it would cover the card.

---

## A misspelling is marked in letters the language agrees are letters

**17 September 2026** · `src/spelling.ts`, `letter` on each pack

A wrong answer came back as "Not quite" and the right word underneath. That is
true and nearly useless: on a script a learner is still reading letter by
letter, spotting which of four characters differs is most of the work, and the
part they are least equipped for. One letter is wrong. Saying which is the
difference between a correction and a verdict.

The lining-up is an ordinary edit distance kept as a table so the path can be
walked back out of it — the distance says a word is one letter out, and what
is wanted is *which* letter. The walk prefers the diagonal, so a letter
written in place of another reads as that rather than as one missing and one
too many: the same number of edits, and the first is what happened.

**What counts as a letter is the pack's answer, not the module's.** The
caller hands in `letter`, a fold of one character, and two characters are the
same letter when they fold the same. It is the same fold the pack's own check
measures its skeleton on, and that is the whole design: a mark on the screen
can never contradict the verdict beside it. A word right in its letters and
wrong in its harakat folds identically and gets no highlight — the verdict
already has a sentence for it, and a red letter under that sentence would be
the app arguing with itself. The same holds for a Vietnamese tone, a Hebrew
niqqud, an Arabic space, and a hamza the learner has said they are not being
tested on.

**Two sides, because one of them is often empty.** A letter written in place
of another is marked in both words. A letter *left out* is marked in nothing
the learner wrote — every character of their answer is in the word — so
without the answer's side, the commonest misspelling of all would come back
with no mark at all.

**Nothing is marked when nothing of the answer is there.** Every letter wrong
is a word they did not know rather than a word they misspelt, and painting all
of it says nothing "wrong" has not said. That rule lives in the module and not
in the screen, because it is a fact about the marking and a test can reach it
there.

**What it costs.** The fold is applied one character at a time, which is not
the same thing as normalising the whole string — a normaliser that reorders
marks or collapses a run of spaces does something per-character folding cannot
see. It is used only to decide *which characters are the same letter*, never
to reproduce the comparison, and the verdict stays the pack's; but a pack
whose normalisation is not per-character would need its own `letter` written
deliberately rather than derived from its normaliser, and the field is
optional so that one can decline. The marked answer replaces the read-only
box the learner typed into rather than appearing beneath it: an input cannot
hold a highlighted letter, and the same word twice with only one of them
worth reading is worse than either.

---

## An early answer is counted and moves nothing

**17 September 2026** · `src/scheduler.ts` (`reschedule`), `tests/pace.test.mjs`

Practice is not gated on a card being due, so a learner may answer a card
minutes after they last saw it. What that answer should do to the card's
schedule has now been decided twice, and this entry is here because the
first answer looked right and was wrong in a way nothing caught for several
releases.

**What it was.** A gap grew from the time actually waited. Answer a card
halfway through its gap and it grew by half as much; answer it straight
away and it grew by nothing. The reasoning was that half a wait is half the
evidence, which is true, and it read well.

**What was wrong with it.** The half it did not say out loud was that an
early answer also re-dated the card — the next review was set to *now* plus
the gap. So the wait already banked was not merely discounted, it was
thrown away and started again. A learner coming back every twenty minutes
re-dated every card every twenty minutes, and no card ever fell due. The
wait the growth was computed from was therefore always about nought, and it
had a floor of one day, so every card was credited with a day's retention it
had not earned and grew to roughly two and a half days and stopped. The bar
that says a word is recognised is four days. Nothing ever reached it, the
front door never emptied, and no new word was ever released — permanently,
for as long as the learner kept practising. The measured case: thirty
sittings a day, every answer correct, ten words met in a fortnight and never
an eleventh.

It is worth naming the shape of this, because it is the second time the same
shape has bitten. Both of the rules that ration new words have now had a
version under which *practising harder made a learner learn less*. A rule
about pacing should be checked against the learner who does far too much,
not only against the one the design imagines.

**What it is now.** An answer given before a card is due is counted — the
reps, the right and wrong, the history, the difficulty reading, everything
the progress screen is made of — and moves neither the gap nor the date.
The card comes back when it was always going to, and grows then, from a
wait it genuinely served. A miss is untouched by this and still lapses the
card in full, above the early return, because forgetting is news whenever it
arrives.

**What it costs.** Two things. An early answer now earns nothing at all
towards the schedule, where before it earned a little when the card was
nearly due; a card answered an hour before it asks comes back in an hour
rather than growing then and there. That is a real loss and a small one,
and it buys a rule that can be stated in one sentence and cannot rot in the
way the last one did.

The second is the one to watch. Early *successes* now move nothing while
early *misses* still move everything, so for somebody drilling one card
hundreds of times a day the schedule only ratchets downward: at thirty
sittings a day a simulated learner who is right nine times in ten still
never masters a word, because the tenth answer lapses it. Whether a miss on
a card nobody asked about should count in full is a genuine question and it
is deliberately not settled here — "a miss is a miss wherever it happens" is
a rule with its own good reasons, and trading it away wants its own
decision rather than being smuggled in beside this one.

**Where it is measured.** `tests/pace.test.mjs` plays out a simulated
learner and reports what a course costs in days. It did not catch this,
because every case in it sat down once or twice a day. It now has one that
sits down thirty times.

---

## A card's ID is a second name, not the id it is stored under

**18 September 2026** · `src/variables.ts` (`cardRef`, `refClash`,
`renamedIn`), `src/card-editor.tsx`, `server/api/courses.js`

A teacher can now name a card and have a sentence ask for it: write
`{{colour-red}}` in a frame and that one card fills the hole. The obvious
implementation is to let the teacher type the card's `id` — the app already
mints one, the server already takes whatever id the client sends, and a
document key is unique by construction.

**Why it is a separate field.** Because the name has to be *changeable*, and
the id cannot be. A card's id is written into the decks that hold it, into
the `uses` of every phrase that teaches it, and into every student's
schedule on every device they own — none of which the server can rewrite
and the last of which it cannot even read. Renaming a stored document would
therefore either lose a learner's progress or need a migration reaching into
private documents the server has no key for. `ref` is a field like any
other: renaming it costs one save, and the only thing pointing at it is the
braces in other teachers' cards, which are the teacher's own text and can be
rewritten with their consent.

The cost is two identifiers for one card, and the confusion that invites.
It is held down by nobody ever seeing the first: the id appears in no
screen, and `cardRef` is the one answer to "what does this card answer to".

**Why uniqueness is checked in the editor and not enforced by the server.**
The check the teacher needs is the one made while they are still looking at
the name, and that is a client check — the editor already holds every card
they can see. A server check would mean reading the whole collection on
every card save, and the failure it prevents is mild: two cards answering
to one name is two cards filling one blank, which is what a group tag
already is. So the server narrows the string and stores it, and the editor
is where a name is refused.

**Why an ID and a group tag share one namespace.** Both are what a sentence
writes between braces, so `{{x}}` has to have one answer. `refClash` refuses
a name that either an ID or a tag already answers to — which means the
editor can say *which* card has it, rather than "taken".

**Why a rename asks rather than deciding.** Changing a name in one place and
not the other is a real intention — a card leaving a group, or a card being
given a new name while the old sentences are meant to break loudly — and so
is changing it everywhere. Guessing either way silently edits cards the
teacher was not looking at, or silently leaves sentences pointing at
nothing. So both answers are offered in words, on the modal, and neither is
the default. `renamedIn` does the rewriting, returns null for a card nothing
moved in, and is a plain function so a test can ask it without a screen; the
editor carries the answer out with the card being saved, because an editor
that could save other people's cards is an editor with the whole collection
in scope.

**What it costs.** A rename of a common tag is one save per card that
carries it, in a loop, through the same offline-safe path a single save
takes — so a rename made on a train is dozens of kept requests. That is
accepted: the alternative is a bulk endpoint, which is a second way to write
a card and a second place for the rules about what a card may contain to
live.

---

## What kind of card it is, is the teacher's answer

**18 September 2026** · `sentence` on `Card` in `src/types.ts`; `isSentence`
in `src/variables.ts`; `shapeOf`, `strayHoles` and `writtenCard` in
`src/card-editor.tsx`; `save-card` in `server/api/courses.js`

The editor asked which kind of card this was, offered three answers, and
stored none of them. The kind was worked out again from the card's own words
each time it was opened: braces in the text meant a sentence, and nothing
else did.

That reads as economy — nothing stored, nothing to keep in step — and the
comment defending it said the braces were unambiguous where two tables that
look alike had to be asked about (0.137). Both halves of that are true and
neither is the point. **Reading a card is not the same as being told.** A
question a person answers, which is then discarded and re-derived, is not a
question: it is an animation of a fact the app had already decided.

What it actually cost, in the order somebody would meet it:

- **A sentence written before its first blank was a word.** That is the
  state every sentence passes through — you type the sentence, then you put
  the hole in — and for the length of it the card was vocabulary: dealt in a
  matching grid, offered as a wrong answer beside real words, and lent out
  to fill somebody else's hole. `fillsOf` refused a card with braces in it,
  which is not the same rule as refusing a sentence, and the gap between
  those two rules was exactly that window.
- **A blank typed into a word made it a sentence.** On a plain word that is
  merely presumptuous. On a word with a table under it — a verb — the card
  reopened in the sentence editor, the table was not drawn, and the line
  under the kind said every box in it would be dropped on the next save. A
  verb's whole conjugation and every student's progress on it, one save away,
  because of two braces.
- **And the way back was not offered either.** A card that lost its last
  blank stopped being a sentence, whatever it had been called.

**So it is stored, and only `true` is stored.** A word may not carry a
blank, so a card with no holes and nothing stored has already said it is a
word; a stored `false` would be a second way of saying the same thing, and
this codebase keeps having to remove those. Absent means read it the old
way, which is the whole of the migration: every card ever written reads as
it always did, a half-migrated collection reads like one that is not, and a
card pins its answer the next time somebody saves it. Nothing is rewritten
and no pass over the collection is needed.

**The rule that makes it safe to store is the refusal.** Only a sentence
may have a blank, and `strayHoles` stops the save of any other card with
braces in one of its own forms. Without that, a stored kind and the braces
in the text are two facts that can disagree, and something would have to
decide which wins — which is the problem the derived reading was avoiding,
moved rather than solved. With it, they cannot disagree on anything that
saves, and the two readings agree everywhere else by construction.

The refusal names both ways out rather than picking one. "I meant to write
a sentence" and "I typed braces into a word" are opposite intentions with
the same symptom, the fix for one destroys the other's work, and the app has
no way to tell them apart. It had been guessing, and it had been guessing
the more destructive way.

**The card's own forms, not its cells.** A sentence a card asks *itself* in
is written on a cell — a row and no column — and `{{verb}}` there is the
card's own place, filled from its own table. That is a blank on a word card
and it is the one that belongs there, so the refusal looks at `ownForms`
and leaves the table alone.

**What it costs.**

- **A conversation is not covered.** A turn with braces in it is neither
  offered nor refused, exactly as before. Enforcing it there would make an
  existing scene with braces unsaveable, with no way to answer the
  complaint, because a scene cannot be called a sentence. Whether a turn
  should be able to carry a blank is a real question and a separate one.
- **The kind travels to the student.** `fillsOf` now asks the card rather
  than its braces, so a device has to know: `cardToItem` carries `sentence`
  and the server stores it as a boolean either way, for the reason `drill`
  is stored that way — a card turned back into a word must come back as one,
  and an absent field would leave every reader falling back to the braces
  for ever.

---

## A blank is put into a sentence, not typed into it

**18 September 2026** · `dropRail`, `withSlotAt`, `withoutSlot` and
`movedSlot` in `src/variables.ts`; `BlankField`, `BlankBar` and `BlankSheet`
in `src/card-editor.tsx`; `Overlay` in `src/shared.tsx`

Writing a blank meant typing it: the braces, the name, the spelling, and
then the same name again in each of the other two fields. A name half a
letter out from what the other cards call it matched nothing, for ever, and
looked exactly like a name that matched. Every other silent failure on this
screen has been closed; this was the last one, and it was the one the
feature is actually made of.

**The bar under each field.** A chip per blank the card knows, and a button
for one it does not. Two states, because there are two facts: this field has
it, or it does not and one tap puts it there. That is the whole of keeping
the three fields in step — the rule `slotTrouble` has enforced since blanks
existed, and which until now the editor would only ever tell you off for
breaking.

**Why the drop target is a gap between words.** A blank is dragged to where
it belongs, and the obvious reading of that is a character offset: work out
which character of the field the finger is over, and put it there. That
means measuring text the browser has already laid out — building a mirror
element with the same font, padding and direction, and asking it where each
character landed — which for a script that runs right to left and joins its
letters is measuring it a *second* way and getting a second answer. Handing
the browser real elements and asking `elementFromPoint` which one the finger
is on has one answer, and it is the right one in every script.

It is also the better target. Nobody puts a hole in the middle of a word, so
the gaps between words are the places a teacher is actually aiming at, and
they are thumb-sized rather than glyph-sized. `dropRail` cuts a field into
its words and the points between them; a blank already standing is one
piece and not the six characters of its braces, so there is no place inside
one.

**The tap is a click; the drag reads the pointer.** These are split, and the
reason is not tidiness: a chip is a button, and Enter or the space bar raise
a click and no pointer event at all. A chip that acted on `pointerup` would
have been a control nobody could reach without a mouse. `dropped` stops a
completed drag counting twice, because a pointer released over the chip it
started on raises a click afterwards.

**The string rules are pure and tested.** A blank is spaced like the word it
stands in for — a space on each side in the middle of a sentence, none
hanging off either end, one space and not two where it is taken out. That is
not cosmetic: the script is what a student's answer is marked against, so a
doubled space is a sentence nobody can type. And an offset inside an
existing blank snaps to whichever end is nearer, because `{{na{{me}}me}}` is
not something any reader here could make sense of.

**What it costs.**

- **The sheet counts through `fillsOf`.** The rows the editor already had
  keep the two halves of a name apart — how many cards *say* they are a
  noun, and how many *tag* themselves with the word — and a name can be
  both: Arabic declares `name` as a kind of word and `{{name}}` is the
  oldest frame in the app, filled by the names a teacher has tagged.
  Counting one half told a teacher that the blank they were about to write
  had nothing behind it while two cards stood ready to fill it.
- **Moving a blank between two fields is not a drag.** A chip drags onto its
  own field only. Tapping is how a blank reaches another field, which is the
  gesture that matters — the fields are meant to agree, not to trade.

---

## Being asked and being lent are two answers, and `drill` is read off them

**18 September 2026** · `src/types.ts` (`lend`), `src/variables.ts`
(`isLent`), `src/card-editor.tsx` (`askParts`, `setPartFlags`,
`writtenCard`)

A form on a card can be worth two different things, and until now one tick
answered both. `ask: false` meant "keep this, do not ask about it" — and
`lentBy` read the same field, so a form kept without being asked also
stopped standing in every sentence card that could have borrowed it. That
is the only thing one tick could have meant, and it is wrong for the
commonest case of all: a name is worth meeting inside *my name is ____* and
is no question at all on its own.

So a form carries `lend` beside `ask`, and the editor asks both under the
fields they are about rather than in a list at the foot of the screen.

**Absent `lend` means whatever `ask` says.** Not "yes", which is what every
other absent flag in this codebase means. A card written before the split
carries neither field, and reading an absent `lend` as yes would have
started lending every form a teacher had deliberately switched off — a
silent change to material already in students' hands. The fallback is the
old single answer, exactly, so nothing stored moves; the editor writes the
field out only where the two answers differ, which is why `setPartFlags`
writes both at once and is the only place either is set.

**`drill` is derived rather than asked for.** The card-wide "this is a
value, not a question" flag stays — it reaches further than the per-form
ticks, keeping a value out of the matching grids and out of the wrong
answers a learner is asked to tell apart, not merely out of the deal. But
it had a tick of its own in the Blanks block, asking the same question as
the per-form ticks in different words and in a different place, and a card
where the two disagreed was a card nobody could reason about. It is now
read off them: a card is a question exactly while something on it is asked
on its own, and a card stored with it off opens with nothing asked and
everything still lent.

**What it costs.** The "a new card that joins a group is not drilled by
default" rule was a third state of that toggle — `null`, meaning "whatever
this card looks like" — and a hidden state cannot survive being spread over
one tick per part. It is written into the ticks instead: joining a first
group on a card nobody has saved unticks "on its own" everywhere, and
leaving the last one ticks it back, so the guess is as reversible as it was
while it was derived. What stops it is the teacher touching any tick, which
is them answering; from there the app stops answering for them. The default
is unchanged. What changed is that it happens in front of them, which is
the point: a card-wide toggle nobody was shown could hold a state nobody
could see.

---

## What kind of card it is, is settled when the card is made

**18 September 2026** · `src/card-editor.tsx` (`shapeChoices`),
`server/api/courses.js` (`keptKind`)

There are three kinds of card — a word or phrase, a sentence, a
conversation — and until now two of them were fixed by accident rather
than on purpose. A conversation could not stop being one because a scene
with four turns on it has nowhere to put them. A word with a table could
not become a sentence because the table is content and the change would
have dropped it. Both were argued from what would be *lost*, so the pair
where nothing visible is lost stayed open: a saved word with no table
could be called a sentence, and back again, as often as anybody liked.

**The thing that is lost there is not visible on the screen.** A card is
the anchor for a student's whole record of it — a schedule per form per
exercise, on devices this server never hears from until they sync. It is
also what every other card's blanks are written against: a group tag and an
ID both name cards, and a sentence is the one kind that fills nothing. And
the three kinds are asked, dealt and filled by three different paths. So a
card that changes kind is a card whose past means something it no longer
is, and the damage shows up later, somewhere else, as a schedule against a
question that is not asked any more or a frame whose filler has become a
frame.

So the question is asked once, while the card is being written — the one
moment when nothing has been typed and no answer can cost anything — and
never again. `shapeChoices` answers nothing at all to a saved card, and the
block that asked says what the card is instead.

**Why not migrate instead.** A "change the kind and carry the record
across" would have to say what a word's forms become when it is a scene
with two speakers, and what a sentence's blanks become when it is a word.
There is no answer to either that is not a guess, and a guess here is
silent. Writing a new card is explicit, takes a minute, and leaves the old
one where it is until its author says otherwise.

**And it is enforced where the editor is not.** The editor is not the only
thing that can reach `save-card`: a device can queue a save from a build
that has not caught up, and a card can be pasted in. `keptKind` takes an
existing card's kind from the card as stored rather than from the request,
through the same `isDialog` and `isSentence` the app reads it through.

Kept rather than refused. A refusal would lock an older client out of cards
it can otherwise edit perfectly well, and the failure being replaced was
silent in the other direction: a client that said nothing about `sentence`
— every build before 0.176 — turned each sentence it saved into a word.
Writing the answer out also pins the kind of a card written before there
was anything to pin, which until then was recognised by the braces in its
words and stopped being a sentence when they came out.

---

## A card's own fields are not `<input>`s

**18 September 2026** · `BlankText` and `dropBlank` in `src/card-editor.tsx`

0.176 made a blank something you put into a sentence rather than type:
a bar under each field, a chip per blank the card knows, a rail of word-gaps
to drop one on. What it left alone was the field itself, which went on
showing `{{name}}` — so the blank existed twice over. The chip under the
field could be dragged and could not be moved *in the sentence*; the thing
in the sentence was six characters of Latin punctuation a teacher had to
select through their own words, and delete a brace at a time.

The blank is now a pill inside the field, where it stands. An `<input>`
holds characters and nothing else, so a sentence's three fields are
contenteditable boxes the app draws the contents of.

**What that costs, and why it was still the cheaper side.** A box the app
draws is a box the app has to keep from fighting the caret. The rule that
makes it tractable is that *nothing is repainted while anybody types*: what
is read back off the box is compared with what was last painted into it,
and on a keystroke they agree, so the caret is never moved out from under
the person typing. A repaint happens only where the app itself changed the
words — a blank put in from the bar, moved, taken off, or braces typed out
by hand becoming the pill they name — and each of those puts the caret back
by offset, counted in the same terms as everything else: `{{name}}` is
eight characters wherever it is drawn as a pill. There is one zero-width
space behind every pill, because a box you type in cannot put the caret
after something it may not edit unless there is somewhere for the caret to
be, and a blank put in at the end of a sentence is the commonest there is.

**Dragging a pill reads the caret; dragging a chip still reads the rail.**
0.176 chose word-sized drop targets over character offsets, and the reason
was that finding the character under a finger inside an `<input>` means
measuring text the browser has already laid out — a mirror element, a
second answer, and a wrong one in a script that runs the other way. That
argument is about an input. A pill is in a box the browser lays out for
real, so `caretRangeFromPoint` is the browser's own answer about its own
text, in any script, and the pill can move through the words as the finger
goes rather than hopping between gaps on a rail beneath them. Both are
drops of a blank at an offset, and both go through `withSlotAt` and
`movedSlot`, so there is one set of string rules under the two gestures.

**The bar stopped saying what the field now says.** It carried a chip for
every blank the card knew, marked as in this field or not. The half that
was "in" is the field's job now — it is in the field, it says its own name,
it is dragged by its own pill and taken off by its own cross — so the bar
keeps only the half the field cannot say: the blanks the rest of the card
leaves and this one has not got, each a tap from agreeing, and the button
for a blank nobody has written yet.

**A cross takes the blank out of the form, not out of the field.** Putting
one in is per field because a teacher may want it in a different place in
each of them; taking one off is not, because there is no such thing as
taking a blank off *somewhere*. A cross that emptied the English alone
would put the card straight into the disagreement the bar exists to keep it
out of, and leave two more crosses to find.

**The braces did not change.** They are what is stored, what the server
holds, what every other reader of a card understands, and what an older
build still reads. What changed is that no screen shows them: not the
field, not the tiles a card is listed on, not the sheet a blank is chosen
in, not the filter that narrows a list by one, and not the lines that name
a blank in passing. One picture of a blank in the app instead of two.

---

## What a card holds is a list, and reading one is drawn from it

**19 September 2026** · `src/card-facts.ts`, `src/shared.tsx` (`CardReadout`),
`tests/card-facts.test.mjs`, `tests/card-readout.test.mjs`

A card in the teaching space can be opened to change it or to look at it,
and the second is meant to be the first with the typing taken away. It was
not. The view-only screen was a second, hand-written description of a card
— the rows somebody thought worth showing on the day they wrote it — and
every feature since had to be added to it again by somebody remembering to.
Nobody did. By 0.191 a teacher looking at a card could not see what kind of
word it was, what its ID was, which blanks it left, what stood in them,
which of its forms were asked about or lent out, what a number part was
worth, or which cell of a verb's table any of its forms sat in; and it was
the one screen left in the app that printed the braces a blank is stored as.

Nine missing rows was not the problem. The problem was that two
descriptions of a card existed and only one of them was kept up to date, so
fixing the nine would have got us to that day and left the next one exactly
as fragile.

**The rule adopted instead: the saved card is the contract between the two
screens.** Everything the editor does ends as a card being saved — that is
what the editor is — so a read-out that says everything a *saved card* can
hold cannot fall behind it, whatever is added later. A feature that stores
nothing has changed nothing to show. That turns a promise about discipline
into a question about data, and a question about data is one the build can
ask.

So `card-facts.ts` describes every field a card, a form, a turn or an
accepted answer can carry: its heading, who it is worth showing to, and
what the screen says for a given value. `CardReadout` draws that, panel by
panel, in the order the editor asks for the same things.

**A field nothing describes yet is shown anyway.** The screen walks the card
in front of it rather than a fixed run of fields, and whatever the list does
not name is drawn at the foot under its own internal name with its value as
it is stored. Deliberately plain: it reads as a thing nobody has got round
to, which is what it is. This is the half that makes the guarantee hold
before anybody notices — the default for a new field is *shown, badly*
rather than silence, and the only way for something to be invisible is for
a person to put it in `NOT_SHOWN` with a line saying why.

**Two tests, failing in the right order.** The first takes the keys
`writtenCard` actually emits and the fields `types.ts` documents, and fails
when one of them is described nowhere or carried by no example card. The
second renders the read-out over those cards and fails when a value on one
is not on the screen, naming the field and the card. Add a field: *no
example card carries this*. Add it to the corpus: *the read-out does not
show this*. Write its heading: green. At no point can the work look finished
while the parity is quietly broken.

**Why not one screen with the inputs switched off**, which is what "one
implementation of a thing" would suggest. The editor is not a list of
fields: it is drag rails, pills pulled along a sentence, contenteditable
boxes, recording overlays, a grid that mints cells. Locked down it reads as
a form somebody took the buttons off, and it is not what a student should
ever be shown. One description of a card and two drawings of it is the
convergence that was available; what did converge is everything underneath
— the blanks a card leaves, the words behind them, the filled-in examples,
whether a form is asked or lent, and the two speeds a word is recorded at
are each one function now, read by the editor and the read-out alike.

**What it does not cover.** Some of what the editor shows is not on the card
— how many words are behind a blank, the sentences it comes out as, the
warning that a name is taken. Those are worked out while a teacher looks,
so no walk of a stored card can find them, and the guarantee above says
nothing about them. They are on the read-out because they were written
there, not because anything makes them stay; what keeps them honest is that
both screens now compute them with the same functions.

**A reader, not a flag.** The student's card screen is the same component
with `reader="both"`, and each field says whether it is the teacher's
business or everybody's. It replaced `whereItLives`, which was one panel's
worth of the same question. Nothing is a student's alone: there is no fact
about a card its teacher may not see.

---

## A sentence says which tenses its blanks want, and it says it per blank

**19 September 2026** · `src/verbs.ts` (`slotRows`, `standsInRows`),
`src/languages.ts` (`tensedOf`, `blankAdmits`), `CardForm.tenses`

Every form a card carries lends itself to somebody else's blank, and for a
verb that means every cell of its table. So "Yesterday {{name}} {{verb}} an
apple" was met as the present, then the past, then the command, and two of
those three say something nobody means. Nothing about the verb card was
wrong — a verb *is* all of its tenses — and nothing about the blank could
be read off the words either: when the sentence happened is a fact about
the sentence, and the sentence was the one thing with no way to say it.

So a frame may narrow a blank to some rows of the table, and the answer
lives on the form beside the blank it is about.

**Per blank rather than per card.** A sentence with two verbs in it can
want two different tenses — "while" is a whole class of sentence — and the
subsection that asks this already lists one chip per blank, so the question
lands beside the thing it is about. One answer for the whole card would
have been fewer ticks and a sentence nobody could write.

**Nothing ticked is every tense.** There is no "any" to choose, because an
empty list and an absent answer are the same answer: a card written before
this is read exactly as it was, nothing has to be migrated, and unticking
the last tense is how a teacher takes the narrowing off. The alternative —
storing "all" explicitly — buys nothing and needs a migration to mean it.

**A narrowed blank reaches a word through its table and nowhere else.** A
verb's dictionary form sits in no row: Huế cites the bare verb, and Arabic
cites a cell the table already lends. Letting it stand in a blank asking
for the past would put the headword in "Yesterday …" on every language and
print Arabic's past-he twice, so it does not. The cost is a verb card
somebody wrote with no table at all: it has no past to offer and drops out
of a past-only blank, which is true and is visible — the blank's own chip
says how many words are behind it, and the examples below say what they
make.

**And only words that have tenses are narrowed.** A name standing in the
same hole is in no tense; dropping it would answer a question nobody asked.
Which kinds of word have tenses is the pack's answer, not a name this code
knows — `tensedOf` is "a table with more than one row", which is the exact
mirror of `agreementOf`'s "one row and a column that picks". A pack whose
verbs take one form declares no such table and is asked nothing, which is
the whole of "for languages that have different forms for different
tenses" in code.

**Offered by what is behind the blank, not by what it is called.** A
teacher who gathers their verbs under a tag of their own has a hole full of
verbs and a name that says nothing about it, so the ticks follow the words
(`tensedBlanks`). It costs a walk of the collection per card opened, which
the same screen already does twice over to count what is behind each name.

**What it cost elsewhere.** `valuesFor` grew a second predicate. It already
took "which of a card's forms does it lend", which is a fact about the
card; this is "which of them will this hole have", which is a fact about
the hole, and the two are asked at different moments — so they are two
arguments rather than one with more parameters. The session reads it in a
third place, because its pool of values is indexed once for the whole
collection by the blank's name: what the *index* holds is what fills
`{{verb}}` for anybody, and what *this frame* wants is asked as the frame
is filled.

---

## A verb is listed as its name, and no cell of its table is required

**19 September 2026** · `src/card-editor.tsx` (`canSaveVerb`), `src/verbs.ts`

Where a pack names a cell as the form a dictionary lists — Arabic's and
Hebrew's he-past — that cell stands in for the card's own word: the editor
does not ask for the word a second time, and the card is saved carrying
what the cell holds. That much is right and stays. What came with it was
not: the cell was the card's *face*, so the editor refused a verb until
that one box and its English were filled in, and a deck of verbs read as a
column of he-pasts.

Both fall to the same answer. **The card's `name` is what a verb is listed
as** — the field a sentence has had since 0.177, and the only thing on a
verb that can stand for the whole of it. So it is asked for rather than
offered on a verb whose table stands in for its word, and the cell a
dictionary lists is an ordinary cell that may be left blank.

**What a save is held to instead**: a name, and one form of the verb
written with its English. The second is the old rule about inert cards —
a form carrying only the script supports one exercise nobody could
practise — asked of the table as a whole rather than of one named box.
Which box it is, is the teacher's, which is the whole point: a course that
has reached the present tense and not the past writes the present tense.

**Why not drop the citation instead**, which was tried and reversed within
the hour as 0.199. Taking it out gives a verb an ordinary word block at the
top on every language, which asks a teacher for a word Arabic does not
have, and then drills whatever they type beside the very cell that says the
same thing. The citation is a true fact about those languages. What was
wrong was never that a cell stood in for the word; it was that standing in
for the word had been allowed to mean *required* and *listed as*.

**What it costs.** A card whose teacher leaves the cited cell blank is
saved with an empty word of its own — it is its name and its table. Two
readers had to learn that. `isDrillable` asked the card's own word whether
there was anything to practise, and now falls through to the card's forms
where that word has nothing to ask, the way it already does for a scene
and for a word nobody is asked about; without it the whole verb would have
been dropped from every session while its table sat there full. And a
teacher opening a verb written before this is asked for a name before they
can save it again, which is that card being given something to be listed
as instead of its he-past.

---

## The ladder is climbed by answering, and kept by coming back

**20 September 2026** · `src/scheduler.ts` (`solid`, `climbed`, `passesMade`,
`learnt`, `cameRound`), `src/grade.ts` (`markedState`), `src/languages.ts`,
`tests/pace.test.mjs`

A level used to open on a *gap*: through the learning steps for the three
cued levels, four days of interval before the app would ask a word to be
written from its meaning alone. It is now two right answers in a row, on
every exercise below, for all four levels alike — and the gap is asked
afterwards, as two returns a card makes before it counts as learnt.

**Why.** The gap made the ladder a clock. The four-day bar under the
writing and the four-day bar on the writing ran end to end, so the fastest
anybody could finish a word was about eight days however hard they worked,
and an evening spent on one word bought nothing that a week of doing
nothing would not have given them anyway. For an app people open when they
happen to have an hour, that is the wrong bargain: effort has to show on
the day it is spent, or there is no reason to spend it.

**What was kept.** Everything the gap was actually protecting. A word is
still not *learnt* until it has come back twice of its own accord and been
right, and a pass is counted only on an answer given when the question was
genuinely due — `cameRound`, which is the same test `reschedule` already
made before growing an interval. So the climb can be crammed and the
keeping cannot, which is the whole shape of it: **effort buys the climb,
time buys the keeping.** What lets a new word out of the front door was not
touched at all and still asks four days of the bottom level (`recognised`),
so no amount of practice empties the front door faster than it ever did.

**Passes are counted on the top of the ladder alone.** The alternative was
every question the card has, and it makes the badge hostage to the deal: a
session hands a card two of its eight questions, so "learnt" would arrive
whenever the last straggler happened to come up rather than when anything
was proved. Writing a word from its meaning is the question that subsumes
the others. What makes it safe rather than merely shorter is that the rest
of the ladder is still asked and still counted — missing one of those
twice running un-climbs the card and takes the badge back, and the passes
are still on it for when it recovers.

**What it cost.** Three things, and the third is the one to watch.

The rule is looser than what it replaced. "Learnt" used to mean every
exercise on the card had matured; it now means the card is up its ladder
and its top question has been kept twice. A card can be learnt with a
listening question that has only ever been answered twice. That is a
deliberate trade for a badge that arrives when the learner has done
something rather than when the shuffle gets round to them, and it is
guarded by the lapse rule above rather than by the badge itself.

Easing moved with it. A word's grammatical cells are thinned to one
question a level once the word is known, and "known" used to be read as
the top of the ladder being open — the same thing, while the ladder itself
waited four days. It is read as `learnt` now. Left alone it would have
started thinning the questioning of eight endings on a word met that
morning.

And the pace file is noisier than it looks. `buildSession` shuffles what
its ranking calls equal using the real random rather than the clock handed
in, so every number that file prints moves between runs — two identical
runs of the ninety-day case differed by eight on "mastered" and by two days
on the median. The measurements added for this release are therefore
directional: that a keen learner climbs faster than a steady one, and that
nobody's passes take less than two days. Reading any single figure it
prints as a result is a mistake, and was nearly made while writing this.

---

## One letter out is a typo, and gets a second try

**20 September 2026** · `src/spelling.ts` (`typoed`, `spellDistance`),
`src/ArabicTrainer.tsx` (`submit`)

An answer one letter off a word of four letters or more is not marked at
all. The question is asked again, once, and the second try is what counts.

It exists because of what a miss now costs. A wrong answer puts a card's
passes back to nought, which is four days of a learner's progress — and a
mistyped letter on a script keyboard is not forgetting a word. The three
shapes a slip takes are all of them: one letter wrong, one missing, one too
many, which is an edit distance of one and not a count of marks, since a
letter written in place of another marks both sides and is still one
mistake.

**Where the doubt runs out.** Four letters, measured in the language's own
fold and on the *answer* rather than on what was typed — a letter left out
of a four-letter word leaves three on the screen, and asking the typed word
to be long enough would throw out the very case this is most for. Under
four it is off: this is a script full of three-letter words a letter apart
that mean different things, and forgiving those would be forgiving somebody
for writing a word they did not mean. Judged against the accepted spelling
the learner came closest to, and against *that* spelling's length, so a card
taking a long word and a short one cannot lend the long one's length to a
slip on the short one.

**The retry does not say which letter.** The side-by-side marking is the
best thing this app does for somebody still reading a script letter by
letter, and putting it up before the second try would turn the second try
into copying out a correction. So the retry gets four words and no more,
and the full marking is there under the answer if the second try is wrong
too. It is also off where the answer was shown or the question skipped: a
learner who has been handed the word and copied it one letter wrong has not
made a typo.

**What it cost.** A learner who genuinely half-knows a word gets one free
look at their own attempt, which is a small amount of information — they
learn it was nearly right — for no mark. Bounded at one retry per question,
cleared with everything else the question carries, and it only applies where
the answer is typed in the script, which is where spelling is the thing
being asked.

---

## What changed, not only where things stand

**20 September 2026** · `src/scheduler.ts` (`movedTo`, `recentDays`,
`dayKey`), `src/ArabicTrainer.tsx` (`movesAmong`, `WhatMoved`, `Lately`),
`src/sync.ts`, `src/types.ts` (`moves`)

Every screen in this app was a stock-take: where each card stands, how far
the deck has got, how many are learnt. There was nothing anywhere that
said what *changed*.

That was survivable while the ladder moved quickly and fatal once it did
not. A card now takes days to reach the top and four more to be kept, so
the tiles say nearly the same thing on the evening somebody works hard as
on the day they do nothing — and the one number that does move, *learnt*,
moves about once a fortnight for a new learner. Somebody who has just
spent an hour is told, accurately and uselessly, that nothing has been
learnt.

**So the app now records movement.** One card, across one answer, judged
from the same standing every screen reads: up a level, cleared, learnt, or
nothing. It feeds the screen at the end of a session and a count per day
on the document, and those two are the same comparison rather than two
readings that could drift.

**It has to be recorded, which nothing else here does.** Everything else
in the document can be worked out again from the cards; this cannot. A
card's standing says where it is and never that it arrived there tonight,
so the comparison exists for one instant — inside the write that changed
it — and is gone. That is why `moves` sits beside the activity log as
stored state rather than being derived, and it is the only thing in this
release that adds to what a device keeps and carries between devices.

**What is deliberately not reported.** Going backwards. A card missed
twice running loses the levels above it, and that is on the card's own
screen, said as *paused*, where somebody looking for the reason will find
it. Putting it here would answer an evening's work with a loss, on the one
screen whose job is to say what the evening came to. The owner and I
settled this explicitly; it is not an oversight.

And nothing at all when nothing moved. For an established learner that is
most sittings, and a heading with nothing under it lands as a reminder
that nothing happened — which is precisely the complaint this was built
to answer. The line already there is true and better: the gaps grew.

**Two faults that only the running app showed**, both found by driving it
in a browser rather than by any test:

The level names are headings — two of them questions, two instructions —
and the summary borrowed them for prose. The screen read *"airport — you
can now which word it is"*. They now have a second form written for a
sentence (`LEVEL_REACHED`), and the sentence says what a card is *up to*
rather than what the learner can now do: reaching a level means the app
has started asking it, not that it has been answered.

And *Today* and *This week* said the same sentence twice, which is every
first day and every week whose work all happened this evening. The week is
left out when it would only repeat the day.

**A note that came due.** `dayKey` was UTC, and the comment over it asked
whoever first read the log back to fix it. This is that release: under UTC
an evening session west of Greenwich was filed under tomorrow, so "Today"
would have been wrong for a large share of learners. It is the local day
now, built from the local parts so a daylight-saving change cannot shift
it. Keys written before this are UTC; it affects counts already recorded
and never the cards, and no screen ever showed either number until now.

**What it cost.** One new thing stored and synced, merged by taking the
larger of two days rather than the sum — adding them would double an
evening every time a device synced twice. And the summary is fed from a
value captured beside a write rather than from a re-read afterwards, which
is sound only because `persist` runs its function there and then; a queued
updater would have made it a lie.

---

## A number system is a document, and its parts are not cards

**22 September 2026** · `src/numbers/schema.ts`, `server/api/courses.js`
(`numsys`, `timesys`, `my-material`), `src/numbers/generate.ts`,
`src/shared.tsx` (`pullCourses`)

Numbers were built from parts since 0.152, and the parts were cards: one
card per box, findable by a `value` on it, put in front of students by
being added to a deck. That made a language's lexicon fifty-five cards with
a number on each, written on two screens that agreed about nothing, and it
meant a form a numeral takes only in company — the one before a noun, the
feminine for an hour — had to be a cell of a `counted` table that only one
of the three languages read. It also meant the app could not say *three
books*, because nothing in the model could hold the form that stands in
front of a noun.

A number system is one document per teacher per language: the words, each
with the faces its language's composer asks for, and the numbers the
teacher wrote out by hand. It is teacher material, stored and delivered the
way a value card is — in no deck, bundled with every course of its
language, its revision folded into the material version so a change reaches
a student without anything else moving. The student's device generates a
card per word from it, with an id derived from the system and the box, so
the fold that refreshes course cards refreshes these too and a student's
year on *forty* survives every regeneration.

**Why not the learner document.** It has exactly one whole-object
last-writer-wins field, `settings`, and a lexicon is not a learner's
preference. A new top-level field would have needed the wire whitelist, the
merge, the size measure and the would-empty guard each told about it, and a
teacher whose document held nothing but a system would have been refused as
empty — silently, which is how `fillsrev` went wrong before it.

**What it costs.** Whole-document last-write-wins: two teachers saving the
same system across a sync lose the earlier save whole, and a save built on
a copy that has since moved is refused rather than merged. The refusal
keys on the revision the saver loaded, never on a clock, so a slow device
is refused once and not for ever. The editor says what happened and hands
back what is there.

---

## Composers live beside the pack, and hold no words

**22 September 2026** · `src/numbers/<langId>.ts`, `src/languages.ts`
(`composer`, `times`), `tests/language-isolation.test.mjs`

*Anything language-specific lives in `languages.ts`* was the rule, and how
a language builds its numbers is as language-specific as anything gets. It
is also two hundred lines a language, and the pack was already three and a
half thousand. So each language's composer is a module of its own under
`src/numbers/`, imported by `languages.ts` and by nothing else: the pack is
still the one door, and an app file that wants a number asks the pack.

The narrowing that makes this safe is checkable, and checked: **no file
under `src/numbers/` may contain a word of any language.** The lexicon is
data in the system a teacher wrote, or a golden table a speaker signed; a
composer knows box names, an order and how the joining word attaches. The
isolation test walks the directory and fails on the first Arabic or Hebrew
letter — which it did, twice, on examples written into comments.

**What it costs.** The first subdirectory under `src/`, and four guards
that resolved source files by a flat stem — the isolation test, the
component scan, the icon check and the sub-forms door — each taught to walk
it. A guard that skips a directory passes in silence, which is the failure
this codebase has already written down once.

---

## The boundary reader for a system is hand-written, as the answer reader is

**22 September 2026** · `readNumberSystem`, `readTimeSystem` in
`src/numbers/schema.ts`

The brief for this feature asked for Valibot schemas at the storage and
sync boundaries. The decision of 11 September stands, for the same three
reasons: the reader runs on every material refresh on a phone; the app has
two runtime dependencies and both are React; and the boundary has to be
*total* — a system with one bad word is a system with one gap, not a
document that fails to open. What the editor shows a teacher about an empty
box is the composer's warning and not the schema's, so the *revisit if*
clause on that entry — validation needing to report why something was
rejected — is still not triggered.

**Revisit if** a teacher ever imports a system from a file and has to be
told which line of it is wrong.

---

## A range is scheduled like a card, and what it asks is decided when the queue is built

**22 September 2026** · `src/numbers/range.ts`, `src/ArabicTrainer.tsx`
(`buildSession`, `drawRange`), `src/languages.ts` (`TYPES`)

A made-up number climbed no ladder. The practice was a button, its only
memory one integer in `settings`, and its three question types were kept
out of `TYPES` on purpose — which kept the schedule honest and left numbers
outside it, so a learner who never pressed the button never met one.

A range — 0 to 10, 11 to 99, counting things, telling the hour — is an item
with one form and a schedule per exercise, dealt by the ordinary session
builder like anything else. Which number or time is asked is drawn from a
seed of the range, the exercise and the count of right answers, which is
the rule that already rotates a sentence's fillers: a missed question comes
back as the same number, a right answer moves on to a different one. It is
drawn when the queue is built and rendered there, so the question cannot
change under the learner, and none of it is ever stored.

**What was kept.** A right answer still credits the component cards that
stood in the number, under the ordinary exercise the question was evidence
for — through `Mark.under`, because no card climbs a ladder called
"num2fig" and writing one would be a schedule nothing ever reads. What is
new is that the range climbs too, on its own key.

**What it costs.** Thirty-odd cards and up to ten ranges per language enter
the pools a session is dealt from, where before they were behind a button.
A range is offered only once the whole of it can be said, which is what
keeps a half-written system from putting an unanswerable question up.

---

## A time is a number with a feminine noun

**22 September 2026** · `src/numbers/compose.ts` (`renderClock`),
`src/numbers/ar-PS.time.ts`, `src/numbers/he-IL.time.ts`

The hour is the number composer asked for a feminine referent, because the
word for *hour* is feminine in both languages that have a clock here. The
minutes, in the exact style, are the number composer asked to count the
word for *minute*. What is left over — choosing the expression for a
five-minute mark, shifting the hour where the expression counts back,
reading the part of the day off the hour the clock actually showed — is
arithmetic, and it is shared.

**So there is no agreement in a clock at all**, which is the point: a fault
in *two minutes* is a fault in the number composer and is fixed once, for
books and minutes together. A test in each language asserts that the
minutes in a time are the number composer's own string, character for
character, and that breaking the numbers breaks the clock.

**What it costs.** A time may play two recordings back to back — the hour
and the minutes — which is the one place in the app where two clips are
joined, and the player had to learn it. Nothing inside a number is ever
stitched: the joins are where a dialect's sandhi lives, and a stitched clip
teaches a sound nobody makes.

---

## Shared helpers are extracted after the second language, not before

**22 September 2026** · `src/numbers/compose.ts`

The module this replaced carried a warning in its header about three
languages wearing one coat. So the two Semitic composers were written
twice — once each, each against a golden table of its own — and only then
pulled together, with both tables unchanged across the move. What went into
the shared file is only what both were already doing character for
character: chunking into millions, thousands and the rest; which face a
gender asks for; the counted noun and what to do when the teacher has not
written the face it needs; and the whole of a clock.

What stayed out is the interesting half — the order of the pieces, the
joining word's habits, polarity, the bound form, which faces a box even
offers. Those are the languages, and they live in the language files where
somebody looking for them will be standing.

**Why the order matters.** A helper invented before the second language
exists is a guess about that language dressed up as a rule, and the guess
becomes invisible the moment the second pack is written to fit the helper
rather than the other way round. The two differences the Hebrew clock
actually has — that the word opening a time is optional, and that counting
back puts the minutes in front of the hour — are declared by the pack and
written in the teacher's own system, not decided in shared code.

---

## A word keeps its block, however well the list would read without it

**22 September 2026** · `src/card-editor.tsx` (`AgreementFields`,
`TableEditor`), `src/types.ts` (`VerbSpec.base`)

An adjective is one word and a handful of shapes of it. The editor draws
the word in a block of named fields — its accepted answers, its English,
its recordings — and the shapes in a second block of short one-line rows.
One list in two hands, with a border between them, and nothing dividing
them except which of the four the card is *about*, which the card's own
title already says.

So for one release they were merged: four rows of the same thing, a name
and three boxes each. It read better, and it was wrong. A row cannot hold
what a block holds, and the two things it dropped were the button that
accepts a second spelling and the list of the word's recordings. A card
accepting two answers is not an edge case here — it is the case this app's
answer model was built around, and *write them yourself with a slash
between* is not the same offer as a button.

**So the rule.** Fields are not dropped to make a layout read as one
thing. If the word and its shapes should look like one list, that is a
question of how the two blocks are drawn — spacing, borders, headings —
and it is answered there.

**What survives from the attempt.** `base` on the table: what the card's
own word is where the cells are shapes of it. Arabic and Hebrew both say
*masculine*, and it is what the word's own section is headed, because
three boxes named feminine, plural and dual over a block called "the main
form" was the screen naming its own layout instead of the language. A
table that says nothing keeps the app's own name rather than guessing,
which is the rule the dual column follows too.

**And the way it was settled, a release later.** The revisit this entry
asked for — give the shapes the fields the word has, and the two really
are the same kind of thing — is what happened. Every shape is a section
of its own now, written by the same component, with its own accepted
answers and a recording per answer. The four are drawn alike because they
*are* alike, rather than by taking the word down to the smallest of them.

What made that affordable was the boxes getting short first. The reason
full blocks failed in 0.208 was that three shapes took three screens; at
43 pixels a box they do not. Every attempt in between was trying to buy
that with something else.

**The rule stands either way.** Fields are not dropped to make a layout
read as one thing. When two things should look alike, the answer is to
give the lesser one what the greater has, or to make both smaller — never
to take the greater one's away.

---

## A recording belongs to an accepted answer

**22 September 2026** · `src/answers.ts`, `src/card-editor.tsx`
(`ScriptAnswers`), `server/api/courses.js`

Gender and number moved onto the answer in September because two accepted
answers are two words: مبسوط from a man and مبسوطة from a woman, one thing
to know and two right answers. The recordings stayed on the form, which is
the same mistake one field later — a card with both spellings had one set
of clips over the pair, so the question that asked for the feminine played
whichever voice happened to be there, and there was nowhere to put the
other.

They are on the answer now, beside its grammar, and the button that makes
one is under the answer it is of rather than in a field of its own level
with the English. A recording is not a third thing a card has beside its
word and its meaning; it is the word, said out loud.

**How it stays compatible.** The form keeps `clips` and `slowClips`, and
they are now every answer's put together — the same rule `ar` and `lat`
follow, and for the same reason: the form is what the server, an export
and every card list read, and it is what says which recordings a card
still points at, which is what decides whether a stored blob is deleted. A
card written before this has its clips on the form and none on its
answers, and every answer reads the form's, which is what they meant when
there was one set of them. A card with one answer is unchanged in every
particular.

**What it costs.** `withAnswer` — which narrows a card to the answer a
question is about — now narrows `recs`, the shape a device keeps audio in,
by matching clip names. That is a second place that has to know the two
are the same thing, and it is guarded: a card whose answers name no
recordings keeps the ones it had, so no existing card goes quiet. The
server sieves an answer's clip names the way it always sieved a form's,
and reads them when collecting what a card points at — the form's list is
derived, and answering "is this blob still wanted?" off a derived field
loses audio the day something writes a card without deriving it.

**Revisit if** a third thing turns out to belong to an answer and not to
the form. The pattern is now established twice, and the third time it is
worth asking whether the form should hold anything about the words at all.

## A sentence is shown once a teacher has read it

**24 September 2026** · `src/review.ts`, `src/review-sheet.tsx`,
`server/api/courses.js` (`review-card`, `my-reports`, `dismiss-reports`,
`sign-system`), `fillFor` in `src/ArabicTrainer.tsx`

Sentence cards are filled by rule from the rest of the collection, and a
rule that is right in general is wrong in a language's exceptions. The
owner asked for every card a student practises to be read by a teacher
first, whatever combination of frame, filler and form made it.

**Approval is kept as fingerprints of the words shown, not as a flag or a
list of combinations.** A flag on the card would have to be cleared by
every edit to the card *and* every edit to any word that fills it, which
is edits to other cards, and missing one shows a student a sentence nobody
read. A list of which cards filled which blank survives a filler being
retyped, which is the edit most likely to introduce the error. A
fingerprint of the script, pronunciation and meaning a student sees has
neither problem: what changed is different text, so it is simply not on
the list. It also fails shut — a sentence made from a word the teacher's
screen did not know about is not approved — and it means the device needs
no rule of its own beyond "is this on the list".

**The teacher's list is built by the device's own walk.** The editor's
preview filled blanks without the agreement step, so it showed the word as
lent where a student saw the agreeing form. `agreeTook` moved out of the
trainer into `review.ts` so both sides take it, and `reviewPool` builds the
fillers with their grammar and oldest first, the way `valueIndexOf` does.
One test approves a sentence from the teacher's list, carries the card
through `cardToItem`, and checks the device asks exactly that sentence.
Tense narrowing on a blank never reached devices before this (`cardToItem`
dropped `tenses`); it does now, because the two lists have to agree.

**A turn is where the walk starts.** A reviewed frame walks forward from
its turn to the next approved sentence, so the same count is still the
same question and a few waiting sentences do not stop a frame being asked.

**What was live stays live.** Every card written before this carries no
review and is asked as before; it is on the teacher's list, and the first
edit to its words, or the first saved review, turns the gate on. Shipping
the gate shut on every existing card would have emptied every course the
day it deployed.

**A ceiling, and narrowing instead of approving.** Approval means *I read
these*. Above `REVIEW_CEILING` (300) the screen offers no approval and
offers to narrow a blank to a group of words the teacher ticks.

**Numbers are signed off, not reviewed sentence by sentence.** A number
system renders up to 9,999,999 in several forms each. The numbers screen
already shows one number of every shape a language gets wrong; a teacher
signs that off, and students get the signed version whole until the next
sign-off. The first edit of a system since this shipped records the
version before it as signed, so nobody loses the numbers they had.

---

## A pronoun reads three ways, chosen after the pronoun

**26 September 2026** · `READING_SLOTS`, `beReadings` and `readingsOf` in
`src/variables.ts`; `BlankScreen` and `PRONOUN_READINGS` in
`src/card-editor.tsx`; `src/pronouns-editor.tsx`

Arabic and Hebrew drop *to be* in the present and ask a question without
moving anything, so one pronoun answers to *I*, *I am* and *am I*. 0.250
made those three blanks — `{{pronoun}}`, `{{pronoun-is}}`,
`{{is-pronoun}}` — filled by the same cards and differing in the English
alone.

**Names in braces, not a setting on the blank.** A blank can already be
narrowed to some tenses by a setting stored beside it, and the reading
could have been one more. It was not, because the frame would then not say
what it reads as: two frames with the same words would read differently
and look the same in every list. A name is how every other distinction a
blank makes is written, and the pill in the field says which reading it is.

**Worked out, and stored only where changed.** Which verb *to be* takes
after *I*, *he* or *you* is a fact about English, the language every card
is explained in, so the readings are worked out from the pronoun's own
English. A teacher's own wording goes on the card as `enIs` and `enAsk`,
beside `person`, only where it differs; a pronoun written before 0.250
therefore reads correctly without anyone opening it.

**One pronoun on the list, then how it reads (0.251).** 0.250 listed the
three as three rows among the kinds of word, where a teacher had to tell
them apart before knowing why there were three. The list has one pronoun
again, and choosing it turns to the three readings; typing a reading's name
in the box puts it straight in. That second step is what moved the picker
from a bottom sheet to a screen rising over the card: a sheet would have
needed a back button of its own, the list had grown past what a sheet
shows on a phone, and a screen brings Back, Escape and the full height
with it.

**A noun's pronoun endings, narrowed like a tense (0.253).** The same
second step asks, of a blank some word in which has its attached pronouns
written out, whether the sentence uses the word or those forms. Unlike a
pronoun's reading this is *not* a name in braces: the words differ, not
only their English, and a blank can be any name — `{{noun}}`, a group
tag, one card's ID — so a second name per reading would have doubled
every name there is. It is stored as the narrowing a verb blank already
had, in the same list as its tenses: the attached table's row for "with",
and `BARE_ROW` for "without". That list already reaches the server, the
student's device and the review list, and `blankAdmits` is already the one
rule all three fill a blank through, so nothing new travels. The cost is a
list named `tenses` holding two things that are not tenses, which
`blankAdmits` and the editor keep apart by asking which rows are the
attached table's.

---

## Arabic's *I* is two columns, and the old one keeps its name

**26 September 2026** · `AR_SUBJECT_PERSONS` in `src/languages.ts`

The verb table had one column for *I*, shared with Hebrew through
`SUBJECT_PERSONS`. Palestinian Arabic's finite verb does not mark the
speaker's gender, but the participles it uses for much of its present do
— رايح and رايحة, عارف and عارفة — and to a learner those are the verb.
One box meant the teacher wrote the masculine and a woman learnt the wrong
word about herself.

**Two columns, not a flag on the cell.** A cell is a sub-form carrying
where it sits and nothing more, and everything downstream — scheduling,
recordings, sync, the pronoun that names a column — reads it that way. A
second column is one more place to sit; a "feminine variant" on the *I*
cell would have been a second kind of thing for every reader to learn.
The cost is that a verb whose two forms coincide is typed twice, which is
already what بتاكل costs under *you (m)* and *she*: a cell carries the
words it was given, and the app does not know which forms coincide.

**The masculine keeps the id `i`.** Renaming both would have orphaned
every *I* cell ever written and every pronoun card the Pronouns screen
saved as `"i"`; keeping the id and changing the label to *I (m)* moves
nothing. The feminine is `i-f`, declared right after it, so a teacher
reading down the table meets them together and the Pronouns screen gets
its row in the same place. That row is the one visible cost: أنا is the
same word for both, so a teacher who fills it in has two pronoun cards
that read alike. They need not fill it in — a row left empty makes no
card — and filling it in is what lets `{{pronoun}} {{verb}}` produce
أنا رايحة.

**Arabic's own list, not the shared one.** Hebrew's present tense varies
by gender in every person, singular and plural, which is not one extra
column but a different table, and deciding it here would have been
deciding it by accident. So Arabic spreads its own nine and Hebrew stays
on the eight until that is looked at.

---

## What a question cannot tell apart, it does not ask a learner to

**26 September 2026** · `twinsOf` in `src/ArabicTrainer.tsx`; `familyOf`
on `matchGroups` and `matchSet` in `src/chance.ts`

A card's forms are asked on their own, and two of them can answer one
question: a phrase and its feminine both mean *Not good*. 0.171 and 0.220
answered that by naming the form, as a tag. That works where the card says
what each form is, through an adjective's table or the grammar written on
an answer. A phrase says neither, so there was no tag to show and the
masculine was marked wrong for knowing it.

**Accept, rather than invent a label.** Inferring *masculine* from a
phrase's letters would be guessing about a dialect. What the screen
actually shows is known exactly: the prompt reads the same for both forms,
and no tag is up. In that case, and only then, every such form is a right
answer, and none is offered as a wrong one. Where a tag is up, the form
named stays the only answer, because that is what the tag promises.

**In a grid, keep them apart rather than tag them.** A tag on only the two
tiles that needed one showed the learner which two went together. So
`matchGroups` never deals two forms of one card into a grid, and `matchSet`
draws no spare meaning from one. `kinTags` stays as a backstop for a grid
that reaches the screen some other way. The cost is that a card's two forms
are never asked against each other in a grid. The typed and *choose*
questions ask that wherever a tag can say which is wanted.

**The gap shows the phrase's meaning.** Showing the missing word's own
meaning was chosen because *close the ___ please* read with the phrase's
English has more than one defensible answer. In practice the Arabic around
the gap settles which word it is. The word's own meaning repeated what
that word's own questions already ask, and a learner found the exercise
pointless for it. The owner decided to show the phrase's meaning. The
heard version keeps the word's meaning, because it has no gap on the
screen.


---

## A scene is one kind with two subtypes, and its blanks are cast

**26 September 2026** · `src/cast.ts`; `sceneKindOf`, `pickedLine` in
`src/dialogs.ts`; `lineGate` in `src/review.ts`; `sceneFill` in
`src/ArabicTrainer.tsx`

A teacher wanted a *text*: several sentences read together, built out of
sentence cards so each keeps the variety its blanks give it. Three choices
made it one feature rather than three.

**A text is a scene, not a fourth kind of card.** A conversation was
already lines in order, read through and drilled a line at a time; a text
is that with nobody speaking. The two things a text needed — lines picked
from sentence cards, and blanks that agree across lines — a conversation
needed just as much, so building them for a separate kind would have been
building them twice or leaving conversations behind. So `sceneKind: "text"`
is a subtype, asked the way a word's is and changeable the way a word's is:
it moves which questions the scene is asked (a text is read as a whole and
nothing else, `dialogNeedMet`) and leaves every line's progress where it
was. Absent means conversation, so every scene written before is unchanged.

**A picked line keeps a copy, refreshed wherever the sentence can be
read.** Pointing at the sentence alone would leave a scene with holes in it
for any reader that cannot see the sentence card — a student whose decks do
not hold it. Copying alone would leave the scene stale the moment the
sentence was edited. So the line carries `from` and the sentence's words,
and three places read the sentence afresh through `pickedLine`: the editor
on opening, the server on every save of the scene, and the server on every
material download. A sentence saved or reviewed moves its teacher's
revision (`bumpFills`), because the scenes it is in are in other decks. A
sentence that has gone leaves the line as typed words, reviewed with the
scene.

**Blanks are cast, not matched by name.** Filling each line alone made a
conversation greet one person and answer another. Matching by blank name
alone fails the other way: a reusable sentence cannot know whether its
`{{person}}` is this story's first character or its second. So each blank
of each line *plays a member* (`roles` on the line), defaulting to the
member named after the blank — which is what most scenes want and costs
nothing — and a member draws one **card**, from which each line takes the
form its own blank admits (`blankAdmits`, as within one sentence). Two
members never draw the same card. The walk is an odometer over members,
like `valuesForTurn` over blanks, forward from the turn to the first
casting every line's review allows.

**Review is reused, not repeated.** A member draws only what each of its
blanks would have taken alone, so every filled line is a sentence its own
review already covers. A typed line answers to the scene's review; a picked
line to its sentence card's (`lineGate`), which the server hands the device
on the line. `holedParts` therefore leaves picked lines off the scene's own
list.

**What it costs.** A scene's blanks are filled at the bottom level whatever
is asked (`SCENE_KEY`): every scene question is reading, and holding a
choice question to words the learner can write left names, which have no
ladder, out of every turn. And the casting is fixed by the scene's own
read-through count rather than the question's, so it changes only when the
scene is read through again — the price of never introducing Sami and then
answering Rami in one session.

---

## A verb drawn into a blank agrees, once per tense

**26 September 2026** · `agreeTook` in `src/review.ts`; `partnerOf`,
`drawnOf`, `rowLead` in `src/verbs.ts`; `blankAdmits` in
`src/languages.ts`; `examplesOf` in `src/card-facts.ts`

The 0.141 entry above left a verb from the pool unable to agree, because
"nothing on a sentence card says which tense". Since 0.192 a sentence card
does say — a blank is narrowed to the tenses it wants — so the reason had
gone while the gap stayed: "{{pronoun}} {{verb}}" was met as every cell of
the verb beside every pronoun, and twelve sentences in sixteen were forms
nobody says. The owner noticed it on exactly that card.

**The rule is the verb card's own, moved to where the cell came from.** A
verb card's own sentence has always read its subject: the row is the
frame's, the column is what filled the subject (`personFor`). A verb drawn
into an ordinary blank now does the same in `agreeTook`, beside the
adjective's swap: the row is the *drawn cell's* — which is what the blank's
narrowing already chose — and the column is the first other blank's, a
pronoun naming it by `person` and a noun or name picking it by number and
gender. The same two refusals as the frame: a partner that names no column,
or a column whose cell is blank, is a sentence not asked. Nothing is
inferred, and no card had to be touched.

**Why "the first other blank" and not a menu.** The rule an adjective and a
verb's own place already follow, and for the same reason: the teacher who
wrote the sentence said which came first. It is wrong for a sentence whose
subject is typed out and whose first blank is an object — "هو {{verb}}
{{noun}}" agrees with the noun — and it was wrong before as well, seven
times in eight. The way to write that sentence is with the subject as a
blank, which is what the Pronouns screen exists for.

**Once per tense, or the count lies.** With every cell lent, four pronouns
by eight persons made thirty-two combinations of four sentences: the odometer
asked each four times over, the card said "met as 32 sentences" and the
review sheet reached its ceiling eight times sooner. So a blank that agrees
with another admits one cell per row — `rowLead`, the first filled cell the
card lends, in the pack's person order — through the same `blankAdmits`
every reader already goes through, which now takes "does this blank have a
partner" beside "which rows does it want". A blank with no partner takes
every cell in turn, which is every sentence written before this and every
"{{verb}}!" since. The card's own word stands aside there too where the
language cites a cell for it: Arabic's *to eat* is the he-past, already lent
by its row, and beside *she* it read as *she he-ate*.

**The preview walks the same list.** `examplesOf` filled the drawn words in
as lent, so a card's own example list showed "سيارة كبير" while the review
sheet and the session showed "سيارة كبيرة" — the pre-existing gap the owner
saw the verb through. It is now `sentencesOf`, the review walk, and can
show nothing the student is not asked.

**What it costs.** A hole is gated on the lead cell's climb rather than on
the cell shown, as an adjective is gated on its word: the swapped cell may
be one the learner has not met on its own. It is credited on the cell
shown, as before, because the owner index knows every form. Which sentence
a given count lands on moved for every card with a verb beside another
blank, once. And a language whose verb table has one column — Huế — is
left out on purpose: its subject has nothing to pick, and running it
through the rule would have dropped every one of its sentences as
"nobody named a person".

---

## Demonstratives are a subtype of their own, not adjectives

**27 September 2026** · `src/languages.ts` (`WORD_CATEGORIES`)

هاد, هاي, هدول change with the noun beside them exactly as an adjective
does, and the adjective's agreement table already chooses between them. So
the obvious move was to file them as adjectives. The cost was the blank: a
card fills the blank its subtype is named after, so هاد went into every
`{{adjective}}` hole — "the house is هاد". A way for one card to opt out of
its subtype's blank was weighed and dropped: it would be a rule a teacher
has to remember, and the card would still say Adjective.

So Demonstrative is its own subtype pointing at the same `agreement` table.
Nothing new happens in the trainer. `agreementOf` reads the table off
whatever subtype names it. A saved adjective can be moved across because
both lay out the same table, as a noun and a preposition can.

One change outside the subtype was needed. A word agrees with the first
other blank in the sentence. In "{{demonstrative}} {{noun}} {{adjective}}"
that blank is هاد, which has no gender of its own to give, and verbs have
read the same way since 0.262. So the blank an agreeing word or a verb
reads now skips blanks filled by words that themselves agree (`leadsOf` in
`src/review.ts`), and falls back to the first other blank where nothing is
left.

**What it costs.** It inherits the adjective's rule that a plural of things
takes the feminine. Palestinian speech often says هدول الكتب instead. A
teacher who wants that marks the noun as a person. If that becomes common,
demonstratives want a table of their own.

---

## A locked deck fixes its membership, not its cards

**27 September 2026** · `server/api/courses.js` (`lock-deck`, `save-card`, `delete-deck`), `src/spaces.tsx`

A teacher can lock a deck so that which cards it holds cannot change. The
lock is a flag on the deck (`locked: true`, absent when unlocked), set by
anyone who may already edit the deck.

**Enforced in `save-card`, not only hidden on screen.** Every way a card
joins or leaves a deck — the editor's deck list, the bulk add and remove
screens, a new card from inside a deck — ends in one `save-card` with the
card's full list of decks. So the server compares that list against a
locked deck's and leaves the locked deck as it was, the same way it treats
a deck the person may not edit. The save itself still lands: a card's words
are not locked, and a save queued offline before the lock would otherwise
be thrown away whole. The answer carries `locked: [{ id, title }]`, and the
client says which deck kept its cards.

**Deleting a card is allowed; deleting the deck is not.** Deleting a card
takes it out of every deck, locked or not — the owner chose a warning in
the confirmation over a refusal, because a card that has to go should not
need every deck unlocked first. Deleting a locked deck is refused
(`deck-locked`, 409) until it is unlocked.

**Deleting an account now takes its cards out of other people's decks.**
`wipeAccount` deleted the account's old-style cards (`owncards:`) and left
any deck holding them pointing at nothing. Those ids are now pulled from
every remaining deck, locked or not, as a card deletion would. Library
cards (`mycards:`) were never deleted with an account and still are not.

---

## A word leaves the front door recognised or cleared, and a card just asked rests

**28 September 2026** · `src/scheduler.ts` (`throughDoor`, `restingNow`),
`src/ArabicTrainer.tsx` (`handCounts`, `buildSession`)

The complaint was the same cards in every practice session. Two things
made it, and they compounded.

**The front door drained on a clock.** A word held one of its ten places
until its first level stood at a four-day gap, however many times it was
answered right tonight. A learner who cleared ten words in an evening
was holding exactly ten words for the next four days, and every session
in between was dealt from them.

**The rule meant to rotate them never reached them.** A card answered in
the last two hours already went behind one that was not — but only among
cards that were not due, and a card being learnt is almost never that: its
learning steps bring it back in a minute and in ten, a miss in minutes,
and every level it opens is a row of questions due the moment they exist.

**What changed.** A word is now through the front door when it is
cleared *or* recognised, whichever comes first. Cleared alone was built
first and measured: it doubled what a keen learner met (26 to about 45
words in ten days of thirty sittings) and *halved* what a once-a-day
learner met in ninety days (44 to 22), because at two questions a card a
sitting the top of the ladder comes long after the four-day gap on the
first level. Either route lets a word through, so no pace got slower: the
once-a-day learner in `tests/pace.test.mjs` now meets about 46 in ninety
days and masters more of them sooner.

And a card asked in the last half hour rests — dealt after everything
else, not refused — when nothing on it was already due before that
asking. That qualifier is what keeps backlog first: a question due since
yesterday stays due however recently another question on the same card
was answered, which an existing test already held the builder to.

**What it costs.** A ten-minute learning step effectively becomes "ten
minutes, or when you run out of other cards" for anyone holding more than
one session's worth. That is the point, and a missed question is still
retested inside the session it was missed in. The home screen's count of
cards ready is unchanged: a resting card is still ready, only later in
the order.


---

## An exercise names grammar in whole words, and only what tells a form apart

**28 September 2026** · `src/languages.ts` (`askLabel`, `answerLabel`, `spelledGrammar`)

Exercises named a form three ways, by where the grammar was stored:
`labelFor`'s abbreviations on a noun ("sg. f."), an agreement table's
column on an adjective ("feminine"), a person label on a verb ("you (f)").
The learner is the reader least able to decode shorthand, and the screen
has room, so exercises now go through one function, `askLabel`, and
`labelFor` is left to the editor, whose rows are narrow and whose reader
is a teacher.

**Fewest words that tell it apart.** The label names the smallest set of
axes that separates the form from every other form and answer on its card
(`fewestTelling`), gender before number. A plural beside two singulars is
"plural"; only a card holding all four is "feminine plural". That is what
drops "singular" and "masculine" wherever nothing on the card needs them,
without a list of default values to maintain.

**What it costs.** The tag now depends on the card's other forms, so the
same form can read "plural" on one card and "feminine plural" on another.
That is the point — it is the answer to "which of these is wanted?" — but
it means a label cannot be computed from a form alone.

---

## Words in hand grow with how much the learner practises

**29 September 2026** · `src/scheduler.ts` (`inHandCap`, `typicalDay`,
`roomForNew`, `IN_HAND_MAX`, `PRACTICE_WINDOW_DAYS`), `src/ArabicTrainer.tsx`
(`inHandFor`, `buildSession`, `countReady`), `tests/pace.test.mjs`

The owner practises ten to twenty times a day and kept seeing the same
cards. The session builder was not the cause. The ceiling of sixty words
in hand was: a word leaves it only on reaching a three-week gap, a gap
grows only when a card is answered on the day it falls due, and an early
answer is counted and moves nothing — deliberately. So the pool drains at
calendar speed however much anybody practises, and a day of fifteen
sittings, which deals about 135 cards, dealt them out of the same sixty.
The pace simulation, run at fifteen sittings a day on a 400-word course,
showed each card dealt 2.2 times a day once the pool had filled, and
eleven days in a row with no new word.

**The pool is sized to what a day of this learner's reaches.** Questions
answered on a typical day — the last seven days of the activity log, idle
days as nought, days before the first one logged not counted — over
`PER_UNIT`, the two ways a form is asked in a sitting. One word in hand for
each, never under the sixty that was measured for a once-a-day learner and
never over `IN_HAND_MAX`, two hundred. The log was already written on every
answer and already merged across devices, so nothing new is stored.

**Measured, days 31 to 60 of fifteen sittings a day:** each card dealt 2.2
times a day became 1.9 to 2.0; the longest run with nothing new went from
eleven days to two; words met in sixty days went from 86 to about 103. A
once-a-day learner's allowance is exactly sixty, as before, and every
existing pace test passes unchanged.

**What it does not fix.** Most of what a keen learner's day still repeats
is the front door — the ten words still being got to know — which stays
full for them and lets a newcomer in only as each one clears. About 85% of
their deals are cards asked before they are due. Scaling the front door in
the same proportion was tried: 1.6 a card a day and 138 words in sixty
days. It is left out because it changes how many *strangers* a learner
holds at once, which is a teaching decision rather than a load one.

**The simulation now builds sessions at the simulated moment.** It used to
build them against the real clock while dating the cards to its own
calendar, so every card looked overdue and the resting rules never
applied. Every figure it prints is now what a learner at that moment would
be dealt; the existing tests' figures moved a little and all still pass.

**What it costs.** A keen learner holds more half-learnt words, so each is
met a little less often and takes a little longer to feel solid. The log
is one count over every language, so somebody splitting their time between
two is read slightly generously in each.


---

## A keen learner's climbing words go first, and their pool doubles

**30 September 2026** · `src/ArabicTrainer.tsx` (`KEEN_DAY`, `KEEN_POOL`,
`inHandFor`, `buildSession`), `src/scheduler.ts` (`IN_HAND_MAX`),
`tests/pace.test.mjs`, `tests/session.test.mjs`

0.280 let the pool of words in hand grow with practice, and the owner found
what it bought too little: about 110 words met in two months at fifteen
sittings a day. The pool was no longer what held it. The front door was,
and not because it is ten wide: because a word took six days to get
through it. Everything waiting ranks together and is shuffled, so the ten
words still climbing drew lots for nine places a sitting with twenty-odd
reviews that had come due, and a new word was dealt in about a third of
the sittings of somebody sitting down fifteen times a day.

**The climbing words go first among what is waiting — for the keen.** A
word then clears in about a day, and the front door turns over five or six
times as fast without holding more than ten strangers at once. Widening the
front door was measured as the alternative and was worse on both counts:
twenty or thirty wide met about 140 words and cost a once-a-day learner
most of what they learnt, because they were holding strangers they could
not get round to.

**Only past `KEEN_DAY`, two full sittings' worth of questions on a typical
day.** Applied to everybody, the rule took a once-a-day learner's nine
places for the climbing words every day, and the reviews that turn a
cleared word into a learnt one were never reached: in sixty days they
learnt none, against about a dozen. The keen learner's reviews passed over
now are reached later the same day. Alternating climbers and reviews was
tried and failed the once-a-day learner the same way. A rule read off
whether reviews are keeping up would be better founded than one read off
volume; the one tried — a day's practice against the reviews waiting —
barely switched on for anybody, because a word answered right comes back a
day later and so there is always more waiting than a day covers. Volume is
what was asked for, and it is what the simulation bears out.

**The pool doubles with it (`KEEN_POOL`).** At one word in hand per word a
day reaches, a word clearing in a day meant the pool filled at about 130
and stopped the front door instead. At two, fifteen sittings a day meet
about 255 words in sixty days and learn nearly all of them. Nothing changes
under about three sittings a day, where the pool was already the floor of
sixty; `IN_HAND_MAX` went from 200 to 400 so the doubled figure is not cut
off.

**The simulation now marks every word in a grid**, as the app does. It
marked only the first, so every other word in a grid climbed as if unasked;
0.280's figures re-measured this way read about 110 met rather than 103.

**What it costs, and what is still true.** A keen learner's reviews wait
behind their climbing words, so a review may be answered a few hours later
than it fell due; the simulation shows no cost to what is learnt. And the
larger pool fills too: about eight new words a day for the first month,
then around day thirty-two new words slow to a trickle until the earliest
words stand at three-week gaps everywhere. A word counting against the pool
until it is that settled is the next thing to question if new words matter
more.

---

## An English near miss has to be the same words, and a lent word is named only where its English is shared

**30 September 2026** · `src/languages.ts` (`checkEn`, `lentLabel`), `src/ArabicTrainer.tsx` (`lentTags`)

A learner reported "Their name is Zatar" marked *nearly right — the right
word, not quite spelt* for "Your name is Zaʿtar". The English near-miss band
is a quarter of the whole answer's letters, and in a sentence the words that
are right pay for the one that is not. So where the answer and the expected
English have the same number of words, each differing word must now be
close to its counterpart (one letter up to three letters, two up to six, a
third beyond). The cost: a short function word swapped for another — *he*
for *it* — is now wrong rather than near, which is the point, and an answer
with a word dropped or added is still judged on the whole-answer measure,
because there is nothing to line up.

The same report asked which *your* the sentence meant. The frame's own
grammar says nothing about that; the word lent into the blank does. It is
named — through the same whole-word grammar as `askLabel` — only when
another form of its card reads the same in English, so that "My name is
Shams" carries no tag and "Your name is Shams" says *plural*. It depends on
the teacher having marked the forms; forms marked alike get no tag rather
than a guess.
---

## A deck's forecast is the rules played forward, and the simulation's clock moves

**30 September 2026** · `src/ArabicTrainer.tsx` (`deckForecast`,
`earliestForecast`, `DeckScreen`, `buildSession`'s `elsewhere`),
`src/scheduler.ts` (`REAL_CLOCK`), `tests/forecast.test.mjs`,
`tests/pace.test.mjs`

The owner asked for each deck to say how soon it could all be learnt — at
their own pace, named in sittings, and at the fastest possible — and then
asked that the two dates stay right whatever the scheduling comes to do.

**Played forward, not worked out.** A formula would have to restate the
ladder, the front door, the pool, the keen ordering and the passes, and
would be wrong the day any of them changed. The forecast instead sits the
learner down at a pace, deals with `buildSession`, and asks the Progress
screen's own `standing` when every card is learnt. There is nothing in it
that knows a rule.

**What an answer marks is decided in one place.** It used to be written
inside the question screen's answer handler — the grid's other words, the
words standing in a sentence's blanks, the words a number is made of, and
the options handed to `gradeInto` — where a forecast could only have
copied it. It is now four functions both of them call: `resolveQuestion`
(the question as shown), `gridFor` (the words a grid puts up),
`marksForAnswer` and `gradingFor`. A change to any of them reaches the
answer and the forecast together, and a test holds the forecast to
`marksForAnswer`. Its own assumptions are only about the learner: every
answer right, practising this deck alone, sittings spread over a sixteen-
hour day.

**The earliest date is searched for.** No pace is written down as "the
most anybody could do": the deck is played at 16 sittings a day, then 32,
64, up to 256, until doubling stops bringing the day closer. Whatever the
rules come to allow, the search finds where practice stops helping.

**Only the deck is played, and the rest is counted once.** Practising one
deck is the fastest way to finish it, and every other card then stands
still, so what they hold in the front door and the pool is counted once
and handed to `buildSession` as `elsewhere`. That made a forecast about ten
times cheaper without changing what it deals.

**The indexes are the app's, every simulated day.** What a question may
ask depends partly on progress — a sentence's blanks, a verb's rows — so
each simulated day installs the full indexes (`installIndexes`) over the
simulated cards and the rest of the collection. A narrower refresh would
be faster and would silently go wrong the first time somebody adds a
progress-dependent index. After every slice of work the real indexes are
put back, and a test holds that.

**The clock could not be moved, and the pace figures were off.** The
scheduler's default clock captured `Date.now` when the module loaded, so
setting the time for a simulated sitting reached the session builder's own
readings but not the scheduler's — what is due, what rests. Every figure
the pace simulation printed since it began stubbing the clock was measured
with half the app reading today's date. `REAL_CLOCK` now reads `Date.now`
at each call. Re-measured at fifteen sittings a day over sixty days: 120
words learnt under 0.279, 248 under 0.280, about 275 under 0.281, and a
card dealt 5.4, 3.8 and 2.5 times a day. Those are larger gains than first
reported. But three sittings a day, just past the keen line, learns about
60 under 0.281 against 78 before: the climbers-first rule admits words
faster than the pool of sixty can settle them, and new words then stop for
about a month. That is reported to the owner rather than changed here,
because where the keen line sits is theirs to decide. The 0.281 figures in
the entry above were measured under the old clock.

**What it costs.** A forecast takes about a second for a small deck on a
laptop and several on a phone, most of it the daily index refresh. It is
done in slices of a tenth of a second, the pace date first, and kept until
the cards change.

---

## The earliest date names the practice that reaches it

**30 September 2026** · `src/ArabicTrainer.tsx` (`earliestForecast`,
`deckForecast`'s `giveUpAfter`, `seededDice`, `leastWords`)

"No amount of practice gets it learnt sooner", printed above a date, read
to the owner as a mistake: a dead end followed by an answer. They asked
for the line to say how much practice the date takes instead.

**Found, as the date is.** Doubling from sixteen sittings a day finds the
day and brackets the practice: one pace that reaches it and one that
falls short. The gap is then halved until it is under a sitting a day (a
tenth of one below two a day), and the least pace that got there is what
is said, rounded up so the pace named really does. A run that is only
asking whether a pace gets there by that day gives up once it is past it
(`giveUpAfter`), so the search costs little more than the doubling did.

**A forecast rolls its own dice.** The session builder shuffles what its
ranking calls equal, and two runs of the same pace could finish a day
apart on the shuffle alone — which would make "the least pace that gets
there" a matter of luck, and a deck's date move each time it was opened.
Each forecast now sets `Math.random` to a seeded roll for the length of
each sitting, as it sets the clock, and puts it back.

---

## Prep mode: decks to have learnt by a date

**30 September 2026** · `src/ArabicTrainer.tsx` (`Prep`, `prepOf`,
`prepStatus`, `readyForecast`, `PrepScreen`, `PrepLine`, `begin`'s `only`)

The owner asked for a way to prepare for a set date — a name, a day, the
decks that must be fully learnt by then — with a home-screen button that
opens a session to prepare, and for the prep to be editable.

**One prep, in the settings.** Several at once would compete for the same
practice, and "about six sessions a day gets you ready" would stop
meaning anything. The settings already sync across devices, last change
winning, which is the right rule for something the learner edits; a
malformed or half-written prep reads as none (`prepOf`).

**Ready means before the day starts.** An exam at nine is not something to
be learning for on its morning, so the deadline is midnight at the start
of the prep's day, and the screen says "before".

**A prep session is an ordinary session over fewer cards.** `begin` takes
the prep's decks in place of the deck chosen on the home screen, so the
front door, the pool, the keen ordering and the spacing all hold — the
prep chooses which cards, never how learning works. Practising only those
decks is also exactly what the forecast assumes.

**The advice is the rules played forward.** `readyForecast` finds the
earliest the decks could be learnt (`earliestForecast`); if that is after
the day, that date is the answer, and otherwise the least pace that
finishes before the day is found by halving, each run giving up once past
the deadline. The home screen's "on track" line is one run at the
learner's own pace, stopped at the day.

**What it costs.** Working out the advice takes a few seconds on a phone,
done a slice at a time; the prep screen waits a moment after each change
before starting, so a date being typed does not start one per keystroke.


**And a smoke check that failed on the shuffle.** The walk through
pictured words tapped a tile by position and then expected the answer
screen to show the picture that was wanted, which it only does after a
wrong answer. Whether any tapped tile was wrong depended on the order the
session dealt its cards in, so the check failed about one run in three
while prep mode was being tested, on this change and the one before it.
The first picture question is now answered "I don't know", which is wrong
whatever the order.

---

## Deck dates and prep advice by arithmetic, not simulation

**1 October 2026** · `src/ArabicTrainer.tsx` (`workloadOf`, `LEARN_DAYS`,
`PROGRESS_SHARE`, `learntAtPace`, `earliestOf`, `readyFor`); removed
`deckForecast`, `earliestForecast`, `readyForecast` and their slicing,
caching and index swapping; `tests/forecast.test.mjs`

**Why.** Prep mode said "Working out how much practice it takes…" for
about forty seconds on a laptop for a 50-card deck, and a phone is two to
four times slower. An audit found two causes: every simulated grid ranked
the learner's whole vocabulary for spare meanings marking never reads
(over half the time), and the search played the deck forward twelve times
to produce one sentence. Fixes for both brought it to about five seconds.
The owner judged the machinery too complicated for what it says and asked
for simple arithmetic instead, and for all of the simulation to go.

**What it is.** Per card not yet learnt, per question on its ladder: no
right answers owed if it is already right twice running, one if its last
answer was right, two if not; plus the passes still owed at the top of
the ladder. Sessions are those questions over a session's eighteen,
halved (`PROGRESS_SHARE`) because about half of a session goes on cards
asked ahead of time and on reviews. The fewest days is a floor: four
(`LEARN_DAYS`) for a card not yet learnt, the wait for its next pass and
two days for each after for a cleared one, and cards never met coming in
ten at a time (`FRONT_DOOR_CAP`), a day apart.

**How close.** Against the simulation it replaces, on synthetic decks:
twelve cards at one sitting a day, 19 days against 21; at three, 7 against
9; earliest, 5 against about 4½. Fifty cards to be ready in thirty days,
about 2.6 sittings a day against 2.9 (both said "About 3"); in ten days,
7.8 against 8.6 ("About 8" against "About 9"). Close, and a little
hopeful, which is why the screens now call them estimates.

**What it costs.** This reverses the owner's earlier requirement that the
estimates follow any change to the rules by themselves. They now restate
the rules in three places — what a card owes, the four-day floor and the
half-a-session share — and nothing fails when the rules move and they do
not. The note over `workloadOf` says so to whoever changes the rules, and
so does the README. The owner asked for no simulation at all, so there is
no test comparing the arithmetic with the rules; the two constants were
taken from the pace simulation's measurements before the forecasts were
retired.

**Kept.** The shared answer marking (`marksForAnswer`, `resolveQuestion`,
`gridFor`, `gradingFor`) stays: the question screen uses it and nothing
about it was a simulation. So do the scheduler clock that reads
`Date.now` at each call, and `tests/pace.test.mjs`, which measures the
scheduling rules themselves rather than any estimate the app shows.


## A form is named in the question only where the question needs it

A learner reported three times in one sitting that the question was
telling them the answer: "you · masculine" under عندَك, "feminine" under a
noun shown in the script, and "Your name: plural" under اسمكم شمس — the
last being, word for word, the English they were asked to write.

**Before.** The prompt's form tag was shown on every sub-form whatever
the question (`isSub || tellForm`), because "the plural of" seemed worth
knowing on its own; and a kin form among the tiles counted as ambiguity
even under a prompt showing the word in the script. The sentence-blank
tags (`lentTags`, 0.282) were shown under every prompt and again beside
the answer.

**Now.** `formTagsAt` decides both places. Under the prompt: the form tag
only where `formIsAmbiguous` holds, and that no longer counts tiles when
the prompt shows the form itself (`PROMPT_SHOWS_FORM`: script,
transliteration, recording) — there only two forms reading the same in
that field leave it open. The blank tags likewise only under a prompt
that does not show the form. Beside the answer: the form tag on every
question about a card with more than one form (`answer-form-tag`), and
the blank tags as before.

**Kept, deliberately.** The owner's caveat: some questions cannot be
answered without the tag — English → script, where cells share their
English — and those keep it. `twinsOf` is unchanged: where a tag could be
shown it is, under exactly the prompts where twins could arise.

The report that "Their name is…" was marked nearly right (0.273) was
already fixed in 0.282 (`sameWords`).

## Forms that share one meaning answer the same prompt

A learner asked "I am hot / I feel hot" (k59562641e79c, شَوْبان) wrote the
feminine شَوْبانة, "I am hot", and reported — the second time for a missing
tag — that nothing had said the masculine was wanted. `formIsAmbiguous` and
`twinsOf` compared the prompt field as whole lines, so two forms whose
English differed only by an extra meaning were treated as told apart.

**Now.** Both go through `readAlike`: in English, forms read alike when
any one meaning is shared, split on a slash or semicolon and compared by
`normEn`, as `lentLabel` already did for sentence blanks. Not on a comma,
which sits inside a phrase as often as between meanings. The script and
transliteration are still compared as whole lines.

## An adjective said about a person is one sentence per form, not per person

The owner asked for adjective cards to carry *I am tired* as well as
*tired*, so a sentence could say تعبان اليوم — *I am tired today* — with no
pronoun. `{{pronoun-is}} {{adjective}}` already made أنا تعبان اليوم; what
was missing was the sentence with nothing in it saying who.

**Not written on the card.** Nine *I am tired*, *you are tired*… on every
adjective would be typing the same English rule into every card. The
English is worked out instead, from the person's label and the adjective's
own English — the same `beReadings` the pronoun's readings use — and the
form from the agreement table, so nothing on an adjective changes.

**One value per form, with every person it fits as alternatives**, rather
than one value per person. Without the pronoun, تعبان is *I (m)*, *you
(m)* and *he* at once; nine values would have made three Arabic sentences
three times each, listed three times for the teacher to approve and
marked as wrong whenever a learner gave a different person from the one
drawn. The owner chose "accept any person that fits". As alternatives,
the existing machinery does the rest: `checkEn` accepts any of them,
`castMeaning` shows one at a time where English is the prompt, and a
review sees three sentences, which is what there are. The cost is that a
verb in the same sentence cannot follow `{{adjective-is}}` — it carries no
single person, so a verb beside it finds no column and that sentence is
not asked, as beside a plain `{{adjective}}` before. The blank itself is
asked nothing about agreement. A sentence that needs a verb too writes
the pronoun.

**A person note may be left off in English.** "I am (m) tired today" is
how English → script says which form to write, and nobody types "(m)"
going the other way. `checkEn` accepts the expected English with a gender
or number note removed, and only such a note: "close (the door)" still
wants the door.

## A Person is one person unless it says more, and always a person

A Person card is asked its number and gender, and agreement needs both:
the feminine adjective picks *feminine singular*, the verb's *she* the
same. A teacher who answered the gender of ليلى and left the number blank
got ليلى تعبان and no verb sentence at all, with nothing to say why. And a
Person card is never asked whether it is a person or a thing — the answer
is obvious — so one marked plural matched neither the plural adjective,
which wants a plural of people, nor the feminine, which wants a plural of
things, and fell to the masculine singular.

**Now.** A kind of word may declare what it implies (`implies` on a
category); Person implies *singular* and *a person*. Filled in where the
card says nothing, when the word is lent to a sentence — `lendsInto`,
which the session, the review list and the preview all go through — and
never written to the card, so what a teacher answered always wins.
Gender is not implied: a name says nothing reliable about it, and a
sentence not asked is better than one asked wrong. Place is left alone
for now; the owner asked about people.

---

## New cards are mixed by kind, evenly rather than in proportion

**2 October 2026** · `src/scheduler.ts` (`byVariety`), `src/ArabicTrainer.tsx` (`varietyOf`)

Which new cards a learner meets used to be the front of the due list,
where every never-met card ranks the same and chance decides. That is a
draw in proportion to the material: eighty nouns and twenty sentences
meant roughly four nouns to every sentence, and nothing stopped a dozen
strangers held at once being all one kind.

Now each place at the front door goes to whichever kind is least
represented among what is already there, which is an even mix rather
than a proportional one.

**Why even.** A proportional draw is what chance already gave on average;
the complaint was that it gave nothing better than average, and on a deck
that is mostly one kind the average is the problem. Even is what "mixed"
means to a learner looking at a session.

**What it costs.** A kind with few cards is used up early: five sentences
in a deck of a hundred all arrive in the first day or two, and the deck's
last weeks are whatever it held most of. A proportional rule would have
avoided that and given the learner much less of what they asked for.

**What counts as a kind** is what the teacher says a word is — noun,
verb, name — and otherwise the card's own kind: phrase, sentence,
conversation, text, number skill. A word nobody gave a part of speech is
one kind of its own. Nothing finer: tags were considered and left out,
because they are a teacher's filing, not a kind of thing to learn.

---

## Numbers reach a learner only through a deck

**2 October 2026** · `src/numbers/generate.ts` (`fileIntoDecks`), `server/api/courses.js` (`set-deck-parts`)

A teacher's numbers used to go to every student of the language, outside
any deck. That meant they could not be handed out a part at a time, and a
student could not prep for them, since prep is by deck.

A deck now names the parts it holds, and a part in no deck is sent to
nobody. The other choice was to keep sending parts in no deck to everyone
and file the rest under their decks. That would have changed nothing for
anyone on the day it shipped, which was its appeal; it was turned down
because it leaves two ways for numbers to arrive, and a teacher who put
0 to 10 in Week 1 would still find 11 to 99 on every student's device
before Week 2.

**What it costs.** On the day it ships, students of a teacher who has
not put numbers in a deck stop being asked them. Their progress is set
aside, not deleted, and comes back with the part.

**Why parts, not words.** A deck names ranges — 0 to 10, telling the
hour — rather than the words for *forty* and *seven*, because a number
is built out of words, and a teacher picking words would have to know
which ones each number needs. The words come along with the part.

---

## A reading belongs to any name an adjective or pronoun answers to

**2 October 2026** · `readingNames`, `readingOf`, `readAs` in `src/variables.ts`; `aboutPersons` and `lendsInto` in `src/languages.ts`; `BlankScreen` offers in `src/card-editor.tsx`

The owner asked why "I am tired" was offered only on the general adjective
blank. There was no reason in the language: `{{adjective-is}}`,
`{{pronoun-is}}` and `{{is-pronoun}}` had been added as three names of
their own, reached only through the kind of word, so a blank built from a
group tag or a card's ID had nowhere to say it.

**Now the reading is an affix on any name.** `{{feelings-is}}` is the
adjectives tagged *feelings* said about each person; `{{tired-is}}` is the
one card with that ID; `{{is-ana}}` asks with one pronoun. `fillsOf`
adds the readings for every name that reaches an adjective or a pronoun,
so the three old names are this rule applied to the kind and read exactly
as before. A value carries its reading under the blank's own name
(`readAs`, and `aboutPersons` given the slot), which is the key `fillText`
already read, so nothing downstream had to learn about it.

**A tag with more than adjectives in it** lends only its adjectives to the
reading. The owner chose that over offering the choice only when every
card in the tag is an adjective. It falls out of the rule: only an
adjective or a pronoun fills a reading.

**What it costs.** A name ending in `-is` or starting `is-` could be a tag
of its own. Where somebody has tagged a card with it, it stays that tag
(`readingOf` asks the card's own names first), and the editor refuses a
new tag or ID that an adjective or pronoun would already read that way.
A reading may run three characters past the 24 a name is cut to, so an ID
of full length can still be read. A tag with both pronouns and adjectives
is offered the adjective's question; each card still reads its own way.

## What a language has is the language pack's to say

**2 October 2026** · `grammarOptions` on a pack and `dimsOf` in `src/languages.ts`; `HE_SUBJECT_PERSONS`; `aboutPersons`; `tests/language-isolation.test.mjs`

An audit of what the packs hold against what the app holds, asked for by
the owner after two weeks of sentence, verb and number work, found the
packs already carried every question's wording, every hint and the
marking — and found grammar still half outside them. The owner asked for
all of it to be fixed.

**The values of an axis are the pack's.** GRAMMAR was one list for every
language, and a pack only chose which axes it used, so Arabic and Hebrew
teachers were offered a *neutral* gender neither language has. A pack now
declares the values each axis offers and what each is called
(`grammarOptions`); GRAMMAR stays the superset a stored card is checked
against, so a value outside a pack's list is still kept and still read.
The second copy of the abbreviations (`NUMBER_SHORT`, `GENDER_SHORT`)
went: a tag reads the axis's own `brief`, with `short` for what stays
silent.

**Huế names who a form is said to.** The addressee axis was retired in
the first weeks because addressee is not a property of a word — *chó* is
*chó* whoever is listening — and greetings that do vary became plain,
unlabelled forms of one card. Unlabelled was the cost: asked for *hello*,
a learner had no way to know which of three was wanted, and a grid could
pair them only by chance. It is back, asked only where the old objection
does not reach: every kind of word declares the axes it is asked about
and none declares this one, so it is offered on phrases and sentences and
never on a noun. Its labels are Huế's own, in its address terms.

**Hebrew has a feminine for every person.** Its present tense varies by
gender in every person, and the table had one box each for *I*, *we*, the
plural *you* and *they* — the same fault 0.261 fixed for Arabic's *I*, in
four places. Twelve columns, the masculine keeping each old id so nothing
written moves; cells that do not differ are typed twice, as Arabic's
already are. *They (f)* picks a plural of women, and wins over *they (m)*
by being the more specific.

**A person is named beside a sentence, not inside it.** `{{adjective-is}}`
read *I am (m) tired*, the one place left where an exercise put grammar as
shorthand into the middle of English, against the rule that exercises say
it in whole words. The English is now *I am tired* and the value carries
which form it is — *masculine*, *feminine*, *plural* — by the name its
agreement table gives that column. It is shown where the words in a
sentence's blanks are already named (`lentTags`), and in the teacher's
sentence review. Marking accepts the note typed as well as left off.

**The guard reads the whole app.** The test that keeps a language's words
out of app code listed twelve files, and none of the sentence, verb,
pronoun or number modules written since was among them. It reads the
directory now, ignores comments (an explanation that أنا is *I* is not a
rule), and looks for Vietnamese as well as Arabic and Hebrew. Two strings
it had allowed went: the card sheet's placeholder comes from the pack, and
the first screen's wordmark is the app's name, Taleb33, rather than an
Arabic word every learner met whatever they were learning. Sentence-ending
punctuation is read off Unicode's classes rather than a list naming one
script's question mark.

**What it costs.** Hebrew's verb table is half as wide again for a
teacher to fill. The addressee tag on a Huế form is long beside a word
in the card list. Feedback lines that name a form are whole sentences with
gaps (`src/wording.ts`), which changes nothing on screen today and is
there for the day the app's own wording is translated.

## Counting reads the noun cards, and a number lends itself like a name

**3 October 2026** · `src/numbers/nouns.ts`; `countable` in `src/numbers/range.ts`; `homesOf` and `fillerCards` in `src/numbers/generate.ts`; `PartScreen` in `src/number-system-editor.tsx`

Three choices made together, because the number screen was rebuilt around
the parts of the numbers (0 to 10, 11 to 99, counting things…) and each
part needed somewhere to stand.

**The nouns a counting question counts are the teacher's noun cards.** A
system used to carry its own short list, because no card could say a word
was a pair; one can since 0.207. The stored list is no longer read and is
dropped on the next save. A system's `nouns` is filled in wherever it is
rendered — from the teacher's cards on their screen, and from the course
cards a learner holds on theirs, so a learner is only asked to count words
they are being taught. The cost: a teacher whose nouns lack a plural, a
pair form or a gender has counting parts that stay shut until those cards
are finished, and the part's screen says which. A noun is judged per part
by rendering it (`countable`), so a noun without a pair form still counts
from three; judging the whole list at once, as before, would have let one
unfinished card hold every counting part shut for good.

**Which part a box sits on is worked out, not declared.** Each part's
numbers are built from a stand-in system with every box filled in with its
own slot name, and a box goes to the first part whose numbers use it. A
composer that changes how it builds a number moves its boxes with it, and
Huế's 11 to 99, built only out of the words for one to ten, ends up with no
boxes of its own — which is the truth, and its screen says so.

**A part fills a sentence's blank the way a name does.** A part answers
to fixed tags (`partTags`: its own, like `0-10`, and `number` or `count`) —
chosen names on the system were tried in 0.316 and replaced in 0.317,
since a tag a teacher has to invent is one more thing to get wrong and
the same tags in every language can be written into any sentence without
setting anything up. A sentence with one of them is filled with
a number from that part, written out by the composer, and a counting part
fills it with a number and a noun in agreement. The numbers are made into
cards that are borrowed and never asked (`drill: false`), so they climb
with the sentence through the frame's own record of having met them — the
rule `valuesAt` already had for names — rather than through the part's own
schedule. Reading the part's schedule instead was considered and turned
down: a sentence answered right would then have had to credit a skill whose
questions it did not ask. Each part lends at most `FILLERS_PER_PART`
numbers, spread over it and the same on every device, so the sentences a
teacher reviews are the ones a learner is asked.

---

## A noun is laid out in boxes, and a person or an animal has two sides

**3 October 2026** · `nounLayoutOf`, `nounBoxes`, `placeNounForms`,
`stampNounForms`, `leadFirst` and `NounEditor` in `src/card-editor.tsx`;
`GRAMMAR.human` in `src/languages.ts`; `genderUnsaid` in `src/verbs.ts`;
`readNounCard` in `src/numbers/nouns.ts`

The owner asked why a noun card was not preset the way an adjective is.
Not with an adjective's boxes: an adjective changes with the noun beside
it, and a noun does not change gender — كتاب has no feminine. What a noun
changes is its number, so a noun card is one box per number the language
offers (singular, plural, dual), already marked. A person or an animal is
the exception the owner raised next: معلم and معلمة, قط and قطة. Those
get the same boxes twice, a masculine side and a feminine one.

**The question that decides it was already on the card.** Person or thing
was asked of every noun in Arabic, for agreement. It gained a third answer,
an animal, which agrees as a thing does (a plural of animals takes the
feminine singular) and is laid out as a person is. Hebrew is asked it too
now; nothing in Hebrew agrees with it, so there it only chooses the layout.

**Nothing new is stored.** A box is read off the number and gender a form
already carries, on every render, so a stored card opens with its marked
forms in their boxes and a form marked plural moves into the plural box
the moment it says so. What a box adds is written onto the form on save
(`stampNounForms`), and taken off its answers, where an answer's own
grammar would otherwise win. A form whose answers disagree with each other
is left exactly as it was, in a box or not: marking it would be saying one
thing about two words. A form that fits no free box is shown under the
boxes with its grammar still asked, so nothing a card carries is hidden.

**An empty box is not a form.** It is drawn from a blank and becomes a form
on the first keystroke (`fillBox`). Six empty forms on every person, each
with a table of pronouns, would have been six things for the save to drop
and for every list of the card's parts to step over. The block is keyed by
its box rather than by where its form sits, so it is not redrawn under the
teacher's fingers when it becomes real.

**Either side alone is a card.** The card's own word is the first form and
has to be written. Where it is empty and a box further down is not, the two
change places (`leadFirst`), pronouns and all; the empty one stays in its
box and is not saved. On an existing card this only happens if the teacher
empties the card's own word, which moves that word's progress to the form
that takes its place — the one case where this can shift a schedule, and
an unusual thing to do to a card that is in use.

**"Add a form" went, for the reason an adjective never had it**: the boxes
are the forms, and a second spelling is a second accepted answer. A
one-of-them word (تفاحة beside تفاح) is better as its own card, and the
form a noun takes after the numbers three to ten belongs to counting.

**A gender nobody said is not guessed.** An adjective beside a singular
noun with no gender took the word itself — the masculine — so an
unfinished feminine noun was met beside the wrong form. Now, where saying
either gender would have picked a different form, the sentence is not
asked with that word (`genderUnsaid`), which is what a verb beside it
already did. Where the gender changes nothing — a dual, a plural of things
— nothing waits. This reaches a Person card with no gender as well: رامي
with none used to take تعبان and now takes nothing until he is given one.

**Counting reads the right side.** A card holding both plurals was counted
with the first plural written, which could be the other side's;
`readNounCard` now takes the plural and pair of the singular's own gender.
Counting the feminine side as nouns of its own was left for later.

**Revisit if** a language turns up whose nouns change for something the
boxes do not cover, or if teachers start writing unit nouns (تفاحة) on the
same card as their collective — that would be a case for a box of its own.

---

## Palestinian three to nineteen have one word before a noun

**3 October 2026** · `src/numbers/ar-PS.ts`, `src/numbers/nouns.ts`, `src/languages.ts` (`optionRules`), `src/number-system-editor.tsx` (`TwoWordsBlock`)

The number screen asked for three to nineteen twice before a noun: once
before a masculine noun and once before a feminine one, and picked between
them by the noun's gender. That is the written language's rule — ثلاثة
كتب, ثلاث بنات — and not the dialect's, which says خمس ولاد and خمس بنات
with the same word. A teacher writing the dialect typed it twice and their
students saw it twice, under two labels that suggested a difference; a
teacher writing the written forms had the written language's agreement
taught as the dialect.

**One box.** Three to nineteen take `standalone` and `construct.m`, and
`construct.m` is labelled *before a noun* through `SlotSpec.faceLabels`, so
Hebrew — whose three to ten do change with the noun's gender, and which
shares the face — keeps its own labels. The word stays stored where it
was, so a learner's progress on that face of a number card carries over.

**What was written in two is not guessed between.** Most systems hold the
same word in both boxes, or one box only, and read as one word with no
question asked (`beforeNoun`). One that holds two different words is not
settled by the app: under the written rule the box before a *feminine*
noun held the dialect's word, so keeping the masculine one by default
would usually keep the wrong one. The teacher is shown both and taps
theirs (`twoWordsBeforeNoun`, `keepOneWord`), and until they do, their
students are asked exactly what they were asked before. A correction
written for one gender (`3|construct.f`) is the same question about a
whole number. The number screen opens on the system with everything that
is not a question folded into the one box (`tidyBeforeNoun`), so a word
kept only in the old feminine box shows where it is used, and a stale copy
cannot turn into a question when the box it copied is changed later.
Nothing is migrated on the server; a system nobody opens keeps its old
behaviour indefinitely, which is the cost.

**The t of days and months is the noun's.** A few nouns take a t after
three to ten that they have nowhere else — خمس تيام beside أيام, تشهر,
تلاف. Historically it was the numeral's feminine ending; in the Levant it
is heard as the start of a special plural, and where it is written in
Arabic script it is written on the noun. Some textbooks transcribe it on
the numeral in Latin letters (*ḫamest‿iyyām*), which is the same sound. So
it is a box on the noun's card, *Plural after 3 to 10*, Arabic only and
offered on nouns only (`GrammarDim.optionRules`), read by counting as
`CountedNoun.plCounted` and used for three to ten alone. A form in it
starts out of practice and out of sentences: it is said inside a counted
phrase and nowhere else. Thousands were already handled: the thousands box
is only used after three to ten. This replaces 0.320's note that such a
form "belongs to counting".

**Not done.** A counting question still expects one answer — the first
spelling in each box — so a second accepted spelling of the plural or of
this box is not accepted in a counted phrase. That was true of the plural
before and is unchanged. And the t can only be written on the noun; a
teacher who wants it on the numeral in Arabic script would need a second
box, which was weighed and left out until someone asks.

**Revisit if** a teacher asks for خمست أيام spelt that way, or for a
counted phrase to accept more than one spelling.
