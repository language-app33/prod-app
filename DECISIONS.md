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
verb's twenty-one cells therefore cannot make its card read *new* for ever
and starve the whole language of room for new cards. A row the teacher left
blank is passed straight through, the way a level with no material is.

**What it costs.** Two flat fields on a form where the app otherwise avoids
storing positions, and a server that now has to carry them through its
sub-form whitelist. The sub-form cap went from twelve to sixty-four: twelve
is three fewer than Arabic's smallest useful table, so a teacher would have
filled in twenty-one forms, saved, and got back the first twelve with no
error anywhere.

**A cell's English is typed, and briefly was not.** There was a box per row
that wrote every cell in it from one word, composing "she" and "ate" into
"she ate", so a teacher wrote three words instead of seventeen. It shipped,
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
