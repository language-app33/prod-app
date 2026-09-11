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

**What is left.** `spaces.jsx`, then `ArabicTrainer.jsx` last and alone —
9k lines and 399 annotations is not a slice of anything. Both are named by
`scripts/component-uses.mjs` and asserted about by
`tests/component-uses.test.mjs`; both now resolve a file by its stem and
match either extension, which was the fix to make before the rename rather
than after — a scan pinned to `.jsx` that stops matching does not fail, it
reports that nothing uses anything.

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
