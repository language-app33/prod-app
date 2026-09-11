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

**11 September 2026** · `src/answers.js`, `src/languages.js` (`answerFields`)

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

**11 September 2026** · `readAnswer` in `src/answers.js`

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
`answerFields()`, passed in rather than imported, so `languages.js` can read
`answers.js` to mark an answer without the two reaching for each other.

Revisit if validation ever needs to report *why* something was rejected —
an import screen that tells a teacher which row is wrong would be a fair
reason to want a real schema.
