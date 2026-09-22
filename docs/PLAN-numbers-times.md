# Plan: numbers and times

A teacher writes down a language's number words and time words once, and
the app can then say, explain and quiz any whole number up to 9,999,999 and
any time on the clock, agreeing correctly with a counted noun. Palestinian
Arabic first. Ordinals, fractions, dates, currency and a teacher-authored
rule language are out of scope for the first version.

This document is the plan, written before any of it is built. It was
written after reading the repository, and the first section says where
the repository already disagrees with the brief and how the plan adapts.
Everything after that is the technical plan the owner asked for: the data
model, the composer contracts, the learner and teacher sides, storage and
sync, testing, migration, and six phases with the files each touches, the
risks each carries and the questions each waits on. Proposed entries for
`DECISIONS.md` and `BACKLOG.md` are at the end.

**What changes for people using the app.** A teacher stops filling in
fifty-five boxes of number *cards* and instead edits one *number system*
for the language, with a *Time* tab beside it; both show the numbers and
times a student will actually see, and any one of them can be corrected by
tapping it. A student meets the parts of the system as ordinary cards, and
meets *ranges* of numbers and times as things the scheduler deals like
cards: read this number, write that one, count these books, read this
clock face, set that one. Nothing a student has already learnt about a
number word is thrown away by the change.

**What it costs.** Six phases, each a release, roughly three working weeks
in all, of which the first — the Arabic composer against a native
speaker's golden tables — is the one that decides whether the rest is
worth building. Two of the six wait on answers listed under *Open
questions*; the first phase waits on none of them.

**How it is checked.** Golden tables written first and verified by a
native speaker; property tests over the whole range; the existing test
suite, smoke harness and typecheck, extended and never duplicated; and
every release merged to `beta` only when `npm run check` is green.

---

## 1. Where the repository contradicts the brief, and what the plan does about it

Read this section first. Each item names an assumption in the brief, what
the code actually does, and the adaptation the rest of the plan is built
on.

### 1.1 Numbers are already built, not memorised — in three languages

The brief describes a new architecture. Most of it shipped in 0.152 and
0.153 (`CHANGELOG.md:1448-1539`, README *"A number is built, not
memorised"*, `README.md:626-657`). Today:

- A language pack declares `numbers: NumberSpec` (`src/types.ts:316-323`,
  `Lang.numbers` at `:575`) with `groups` (the boxes a teacher is asked
  for), `bands` (the ramp 0–10 … 1,000,000–9,999,999), optional `cells`
  (a part's alternate forms) and `spell(value, ctx)`, the composer.
- Three packs have one: `AR_NUMBERS` (`src/languages.ts:1555-1621`),
  `HE_NUMBERS` (`:1638-1710`) and `VI_NUMBERS` (`:1731-1858`). Arabic
  and Hebrew ask for 55 parts each, Huế Vietnamese for 14.
- The lexicon is cards: a card is a part by carrying `value`
  (`src/types.ts:784`), and `partCards` (`src/numbers.ts:109-122`) finds
  them. A card written for a *whole* number is the override: it beats
  building one (`src/languages.ts:1560-1564`, tested at
  `tests/numbers.test.mjs:266-273`).
- `NUMBER_CEILING = 9999999` (`src/numbers.ts:169`) is exactly the brief's
  range.
- A made-up number is never stored (`Item.used`, `src/types.ts:1112-1123`;
  `numberItem`, `src/ArabicTrainer.tsx:3607-3644`) and a right answer
  credits the parts that stood in it through the same rule a sentence
  credits its fillers (`numberFillers`, `:1002-1040`; `fillerMarks` in
  `src/grade.ts:204-228`).
- Three exercises exist — `num2fig`, `fig2num`, `fig2pick`
  (`src/languages.ts:351-391`) — with a digits answer mode that is exact
  or wrong (`:3238-3257`) and accepts Arabic-Indic and Persian digits.
- The golden cases for all three languages are already in
  `tests/numbers.test.mjs` (Arabic at `:161-190`, Hebrew `:192-231`, Huế
  `:233-264`).

**Adaptation.** Decision 1 (lexicon is data, composition is code) is not a
change of architecture but of *where the lexicon lives* and *what the
composer can say*: a system document instead of fifty-five cards, and a
composer that returns tokens, agreement and warnings instead of a string
and a list of values. The plan reuses the bands, the deterministic probe
(`probeOf`, `src/numbers.ts:226-248`), the confusables (`:331-355`), the
digits answer mode and the crediting rule as they stand, and moves them
under `src/numbers/` when the old module is retired.

**Consequence for the phases.** Phase 5 in the brief is *"Hebrew
composer"*. Hebrew and Huế Vietnamese already compose numbers. If Phase 4
removes both old entry points before Phase 5, two languages lose numbers
for a release or more. So **Phase 1 ports the three existing `spell`
rule-sets onto the new composer contract** — Arabic gains agreement in
Phase 0, Hebrew and Huế are straight ports with identical output, proved
by lifting their existing test cases into golden tables — and Phase 5
becomes *Hebrew agreement and times*, after which the shared helpers are
extracted, as the brief intends.

### 1.2 There is no Valibot, and the repository decided against it

`DECISIONS.md:59-83` (*"The schema at the storage boundary is
hand-written"*, 11 September 2026) declined a Valibot schema for the answer
reader on three grounds: it runs on every card of every document on every
load, including on a phone; the app has two runtime dependencies, both
React, and this would be the third; and the boundary must be *total* —
narrow what it can and drop what it cannot — rather than report why
something is wrong. The entry ends: *"Revisit if validation ever needs to
report why something was rejected."*

**Adaptation.** The boundary readers for a number system and a time system
are hand-written total narrowers in the style of `readAnswer`
(`src/answers.ts`): `unknown` in, a typed document out, unknown fields
dropped, bad values read as absent, never an exception. The brief's
*"Valibot rejection tests"* become *narrowing tests*: malformed input and
what comes out of it, and the assertion that nothing throws. The editor's
*"missing cells are warnings, not blockers"* is a composer-level warning
about an incomplete lexicon, not a schema-level rejection, so the
*"revisit if"* clause is not triggered. Whether to reopen the decision
anyway is **open question Q1**; the plan assumes not.

### 1.3 Everything under `src/` is already strict TypeScript

The brief says *"new code in `src/numbers/` is strict TypeScript from the
start; existing JSDoc modules consume it."* Every file under `src/` is
`.ts`/`.tsx` under `strict: true` (`tsconfig.json`; `DECISIONS.md:87-287`).
Only `server/` is JavaScript with JSDoc, and it imports `.ts` modules
directly because Node 22 strips types (`server/api/courses.js` already
imports `src/languages.ts` and `src/cards.ts`).

**Adaptation.** The constraint is the house rules, not a conversion:
`erasableSyntaxOnly` (so string unions, never `enum`),
`verbatimModuleSyntax` (`import type`), every import naming its `.ts`
extension, `noUnusedLocals`. The one JavaScript consumer is the server,
which will import the boundary reader and, for the migration, the slot map.

### 1.4 `src/numbers.ts` exists, `src/` is flat, and several guards are keyed by flat filenames

`src/numbers.ts` (425 lines) is the existing module. `src/` has no
subdirectory at all. Five guards resolve source files by stem in a flat
`src/`, and a file under `src/numbers/` would be **silently skipped** by
each: `tests/language-isolation.test.mjs` (`APP_FILES` at `:38`, `src()`
at `:28-34`), `scripts/component-uses.mjs` (`:28-39`),
`tests/component-uses.test.mjs` (the icon check, `:89`), and the *subs*
door guard in `tests/cards.test.mjs:2187-2210`, which reads `src/`
non-recursively. `DECISIONS.md:281-285` names exactly this failure mode.
Everything else — tsconfig `include`, ESLint's `src/**`, Vite, the esbuild
smoke bundle — handles a subdirectory without change.

**Adaptation.** Keep the brief's `src/numbers/`, and make Phase 1 extend
each stem-keyed guard to walk it (four small edits, each a test that
would otherwise pass in silence). `src/numbers.ts` stays untouched beside
the directory until Phase 4 deletes it; its reusable pieces move into
`src/numbers/range.ts` in Phase 3. An explicit `.ts` extension in every
import means the file and the directory never resolve to each other.

### 1.5 "The number subtype" is a category, a table and one field — and only one screen writes the field

There is no `subtype` field. The teacher's *What subtype* is `category`
(`WORD_CATEGORIES`, `src/languages.ts:1897-1955`; `number` at
`:1942-1948`, which names the `counted` table, `COUNTED_TABLE` at
`:1432-1437`). A card is a *part* only by carrying `value`. The card editor
never writes `value` — `writtenCard` (`src/card-editor.tsx:6231-6295`)
emits no such key; it survives an edit only because the server spreads
`value` conditionally over the stored card (`server/api/courses.js:
1016-1022`, `:1453-1461`). The comment at `src/numbers.ts:88` claiming the
editor writes it is stale. Only `saveNumbers` (`src/spaces.tsx:4857-4911`)
writes `value`.

**Adaptation.** The two entry points share one storage shape: ordinary
cards with `category: "number"`, sometimes `value`, sometimes cells in the
`counted` row. The migration therefore parses one shape, not two. Removal
(Phase 4) means retiring the `number` category the way `register` was
retired (`src/languages.ts:1209-1225` keeps the definition so stored cards
still read), retiring the `counted` tables, and removing `value` from the
card model with the parity tests (`tests/card-facts.test.mjs`,
`tests/card-readout.test.mjs`) enforcing the order.

### 1.6 There are no time cards, no clock, no drawing, no TTS

No time-of-day handling exists anywhere; the only inline SVG is a
progress ring (`src/ArabicTrainer.tsx:10527`); there is no text-to-speech.

**Adaptation.** The migration has nothing to parse for times; a time
system starts empty. The clock face, the set-the-clock input and the
time answer mode are new UI (Phase 3), and are the largest unfamiliar
piece of the whole plan.

### 1.7 The brief schedules ranges; the code deliberately does not

`src/languages.ts:59-73` and `tests/numbers.test.mjs:473-490` state and
assert that the number exercises are *never* in `TYPES`, never scheduled,
never stored: *"a number is not a card and climbs no ladder."* The
practice is learner-started from a home-screen button and its only
persistent state is one integer, `settings.numbersReach`
(`src/ArabicTrainer.tsx:7975-7988`), described there as *"a convenience
about where to start, not progress on a card."*

**Adaptation.** The brief's decision stands: range skills are scheduled
by the existing SRS. The plan says exactly what that overturns (§5.2), and
keeps what the old design got right: a right answer to a range question
still credits the component cards that stood in it, and the value asked
is decided when the queue is built and never changes under the learner.

### 1.8 Migrations here are shape-keyed lifts on read, and `Doc.version` is dead

The brief asks for a migration *"keyed on schema version like existing
migrations."* The existing ones are lifts applied on read, keyed on the
shape they find, idempotent by construction (`liftItem`, `liftAnswers`,
`liftStates` in `src/ArabicTrainer.tsx:4186-4335`; `deckCardIds` on the
server, `server/api/courses.js:909-940`; `DECISIONS.md:959`, *"Lift on
read, not a migration"*). `Doc.version` is written as `3` and read
nowhere.

**Adaptation.** The number migration is a server-side lift in the
`deckCardIds` mould: on a teacher's first read of the number system for a
language, if no system exists and part cards do, build the system from
them and write it once. `composerVersion` on the system is the version
key the brief wants, and it versions the *composer*, not the storage
shape: a bump marks every override as *possibly stale* for the teacher to
re-check. On the learner side the only migration is dropping
`settings.numbersReach` through `RETIRED_SETTINGS` (`:4352-4368`).

### 1.9 The brief's slot list has no millions

The range is 0–9,999,999 and the slots are `unit`, `teen`, `ten`,
`hundred`, `thousand`, `connector`. Seven-figure numbers need million
words; today's packs ask for nine of them (1,000,000 … 9,000,000).

**Adaptation.** Add `million.1`, `million.2`, `million.n` on the same
pattern as thousands.

### 1.10 Nouns have no dual, and no card carries a construct state

`GRAMMAR.number` offers `singular`, `plural`, `na` (`src/languages.ts:
1150-1172`). No `dual`, no construct, no definiteness anywhere in `src/`.
The brief's counted-noun context `{ sg, dual?, pl, gender }` cannot be
read off a noun card.

**Adaptation.** For the first version the *digits + noun → phrase*
exercise draws its nouns from a small list the teacher writes inside the
number system (`nouns`, §3.1), each with singular, dual, plural and
gender. That keeps the agreement exercise self-contained and testable
without touching the card model. Reading real noun cards, and a `dual`
value on the number axis, go to the backlog (**Q8**).

### 1.11 "languages.js" is `languages.ts`, and the registry keyed by language already exists

`LANGUAGES: Record<LangId, Lang>` (`src/languages.ts:2418`) is the
registry, `lang.numbers` the slot, `teachesNumbers()` the gate. The README
rule *"anything language-specific lives in `languages.ts`"*
(`README.md:853-854`) and the isolation test (`tests/
language-isolation.test.mjs`) both cut against a per-language module
elsewhere.

**Adaptation.** The pack stays the one door: `lang.numbers` becomes the
new `Composer` and `lang.times` the `TimeComposer`, each *imported* by
`languages.ts` from `src/numbers/<langId>.ts` and imported by nothing
else. The isolation test is extended so that **no file under
`src/numbers/` may contain Arabic or Hebrew script at all** — the lexicon
is data in the system document or in a test fixture, never in code — and
so that app files may import only the neutral registry. That is a
narrowing of the README rule rather than an exception to it, and it is
recorded as a decision (§9).

### 1.12 Proposal documents ship without a release

`CLAUDE.md` asks for a release bump and a changelog entry before any push
to `beta`. The four most recent plan-only commits (`b10f1f7`, `c9cfce2`,
`e21bc83`, `1e4967f`, September 16–19, all on `origin/beta`) carry no bump
and no changelog line, and say *"Docs only: nothing in the app changes
yet."* This document follows that precedent. Each phase below is a
release and bumps.

---

## 2. The decisions kept, and how each lands here

| # | Decision in the brief | How it lands in this codebase |
|---|---|---|
| 1 | Lexicon is data, composition is code; no rule DSL; overrides | Already the architecture (§1.1). Lexicon moves from cards to a system document; overrides move from *a card for the whole number* to `overrides` on the system, consulted per chunk as well as per whole (§4.1). |
| 2 | One *Number system* editor with a *Time* tab; numbers stop being a card subtype | Replaces `NumbersScreen`/`NumberReach` behind the same `#` toolbar button in Teaching → Cards; retires the `number` category, the `counted` tables and `value` (§6, Phase 4). |
| 3 | Generated numbers and times never persisted | Already the rule for numbers (`Item.used`). Kept: a rendered value lives on a cast form for one asking, decided at deal time (§5.2). |
| 4 | Times layer on numbers; the time module has no agreement code | `renderTime` calls the number composer with gender `f` for the hour and with the minute noun for the exact style (§4.2). |
| 5 | `src/numbers/` is strict TypeScript; existing modules consume it | House rules apply (§1.3). Guards extended to see the subdirectory (§1.4). |
| 6 | NumberSystem and TimeSystem are synced documents, not cards, whole-document LWW | Two homes are possible and they are not interchangeable (§7). The plan recommends one and **asks before assuming**. |
| 7 | Audio: components only; a time may concatenate two clips; TTS to backlog | Clips stay per form on component cards, so every existing clip walker keeps working; one new walker on the server for clips a system references; one player change for the two-clip time (§5.5). |

---

## 3. Data model

Shapes are given as TypeScript for precision. `FormKey`, `Slot` and the
like are string unions, never enums (`erasableSyntaxOnly`).

### 3.1 NumberSystem

```ts
type FormKey = "standalone" | "m" | "f" | "construct.m" | "construct.f";

interface Lexeme {
  slot: string;                          // "unit.7", "ten.40", "hundred.n", "connector"
  forms: Partial<Record<FormKey, string>>;
  audio?: Partial<Record<FormKey, string[]>>;   // clip hashes, as a card form holds them
  lat?: Partial<Record<FormKey, string>>;       // optional transliteration per form
}

interface CountedNoun {                  // §1.10: the agreement exercise's nouns, v1
  id: string;
  sg: string; dual?: string; pl: string;
  gender: "m" | "f";
  en: string;
}

interface NumberSystem {
  id: string;                            // server-minted, "n" + hex, like cards' "k" + hex
  owner: string;                         // teacher's handle
  languageId: LangId;                    // one system per (owner, language)
  composerVersion: number;               // the composer this was last checked against
  lexemes: Record<string, Lexeme>;       // keyed by slot
  overrides: Record<string, Partial<Record<FormKey | "text", string>>>;
                                         // "300" -> { text }, "3|construct.f" -> { text }
  nouns?: CountedNoun[];
  audioPolicy: "components";            // the one value in v1; a field so it can grow
  curatedAudio?: Record<string, string[]>;  // "47" -> clip hashes, an override's own recording
  rev: number;                           // moves on every save; folded into materialVersion
  updated: Millis;
  created: Millis;
}
```

Slots for ar-PS, driven by `requiredSlots()`: `unit.0`–`unit.10`,
`teen.11`–`teen.19`, `ten.20`–`ten.90`, `hundred.1`, `hundred.2`,
`hundred.n`, `thousand.1`, `thousand.2`, `thousand.n`, `million.1`,
`million.2`, `million.n`, `connector`. Which form keys a slot wants is
also the composer's answer (`unit.1` and `unit.2` want `m`/`f`; `unit.3`
to `unit.10` want `standalone`/`m`/`f`/`construct.m`/`construct.f`; teens
want `standalone` and an optional `construct.m`; tens, hundreds,
thousands, millions and the connector want `standalone` only).

Overrides are keyed `"n"` or `"n|formKey"` as the brief says; a form-keyed
override is used when the composer would have chosen that form (three
books, feminine hour), the bare one when it would have chosen any. A
`text` value is the whole rendering for that chunk.

### 3.2 TimeSystem

```ts
interface MinuteExpr {
  text: string;                          // "وربع", "إلا ربع"
  refHour: "same" | "next";
  en?: string;                           // "quarter past"; defaults to "15 past" / "15 to"
  audio?: string[];
}

interface Period { slot: string; text: string; en?: string; fromHour: number; toHour: number; audio?: string[] }

interface TimeSystem {
  id: string;
  owner: string;
  languageId: LangId;
  numberSystemId: string;
  lexemes: {
    "hour.word": Lexeme;                 // ساعة
    "minute.noun": Lexeme & { gender: "m" | "f" }; // forms: sg, dual, pl — the counted noun
    "connector.past": Lexeme;            // و
    "connector.to": Lexeme;              // إلا
  };
  minuteExprs: Partial<Record<0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55, MinuteExpr>>;
  periods: Period[];                     // الصبح 5–11, الظهر 12–14 …, in 24h hours
  clock: "12h" | "24h";
  overrides: Record<string, string>;     // "07:45" or "07:45|exact" -> whole text
  audioPolicy: "components";
  curatedAudio?: Record<string, string[]>;
  rev: number; updated: Millis; created: Millis;
}
```

`minute.noun` reuses `Lexeme` with form keys `sg`, `dual`, `pl`, so the
exact style renders minutes through the number composer's counted-noun
path and nothing else (decision 4).

### 3.3 What a student's device holds

Nothing new at the top level of the learner document. Two kinds of
generated `Item` ride in `items` like course cards do:

- **Component card**, one per lexeme, override, minute expression and
  period label: id `sys:<systemId>:<slot>` (or `sys:<id>:override:<n>`,
  `sys:<id>:min:<m>`, `sys:<id>:period:<slot>`); `source: { systemId,
  slot }`; `locked: true`; `tags: ["Numbers · Palestinian Arabic"]` so
  the card list can filter it like a deck. Its lead form is the
  standalone (or `m`) form; its other forms are sub-forms with `row:
  "number"` and `col: <formKey>`, laid out by a table the composer
  declares, so they are drilled and gated exactly as a verb's cells are.
  Form ids are `sys:<id>:<slot>-f~<formKey>`, mirroring `srv<id>-f~<name>`
  (`src/shared.tsx:3647-3648`), which is what lets `foldForms` keep
  review states across regeneration.
- **Range skill**, one per range the system can build: id
  `sys:<systemId>:range:<rangeId>`; `range: { kind: "numbers" | "time",
  id, from, to, ctx? }`; one form whose `s` holds the scheduler's states
  per exercise key; `name: "Numbers 11–99"`; `en` and `ar` empty (they are
  filled by casting at deal time, §5.2). `range` is a new `Item` field and
  must be described in `CARD_FACTS` or the parity tests fail.

Both are regenerated from the system on every material refresh through
the same fold course cards use (`foldCourses`, `src/shared.tsx:4071`),
which starts from the teacher's wording and copies back the learner's
named facts.

### 3.4 What stays out of the model

No generated number or time is ever stored (decision 3). No
transliteration is composed in v1 (a lexeme may carry `lat` per form; the
composer does not join them — backlog). No per-course selection of
systems in v1 (§7, S3).

---

## 4. Composer contracts

All in `src/numbers/`, pure, total, no React, no storage, no clock, and
no script in any file (§1.11).

### 4.1 Composer

```ts
interface RenderCtx {
  gender?: "m" | "f";                    // agreement with an unnamed referent (the hour)
  noun?: { sg: string; dual?: string; pl: string; gender: "m" | "f" };
}
interface Token { text: string; slot?: string; formKey?: FormKey; override?: string }
interface Warning { code: "missing-slot" | "missing-form" | "rounded" | "out-of-range" | "no-dual"; slot?: string; formKey?: FormKey; detail?: string }
interface Rendering { text: string; tokens: Token[]; nounForm?: "sg" | "dual" | "pl"; warnings: Warning[] }

interface Composer {
  version: number;                       // composerVersion
  requiredSlots(): { slot: string; formKeys: FormKey[]; label: string; hint?: string; group: string }[];
  tables(): Record<string, VerbSpec>;    // how a lexeme's form keys lay out as a card's cells
  bands(): NumberBand[];                 // the ranges — today's NUMBER_BANDS, per language
  render(n: number, sys: NumberSystem, ctx?: RenderCtx): Rendering;
}
```

Rules every composer keeps:

- **Total.** Out of range, not an integer, an empty system: a `Rendering`
  with a warning and the best text it can make, never a throw. A missing
  slot renders as `⟨unit.7⟩` (angle brackets, because braces are what a
  blank looks like in this app) with a `missing-slot` warning. Nothing on
  the learner side deals a range whose probe renders with any warning.
- **Overrides first**, at every chunk: `n|formKey`, then `n`, checked for
  the whole number and again for each chunk the composer would otherwise
  build (300 inside 1,300, as today's `ctx.word(count * unit)` does).
- **Fallback chain for forms is explicit and warns.** `construct.f` falls
  back to `construct.m`, `f` to `m`, `m` to `standalone`; each fallback
  is a `missing-form` warning so the editor can show it as a soft gap.
- **Every token names its lexeme** (`slot`, `formKey`) or its override,
  which is what crediting reads (§5.3) and what the property tests check.
- **Deterministic**: same inputs, same output, no randomness inside.
- **Registry**: `LANGUAGES[id].numbers` is the composer, `teachesNumbers`
  the gate, as now. No app file imports a language-named module.

### 4.2 TimeComposer

```ts
interface TimeCtx { style: "colloquial" | "exact"; period?: boolean }
interface TimeRendering extends Rendering { hour12: number; minuteExpr?: number; period?: string; clips?: string[][] }

interface TimeComposer {
  version: number;
  requiredSlots(): ...;                  // hour.word, minute.noun, connectors, the minute-expression table, periods
  renderTime(h: number, m: number, t: TimeSystem, n: NumberSystem, ctx: TimeCtx): TimeRendering;
}
```

- **Colloquial**: round `m` to the nearest five (warning `rounded` if it
  moved); look up `minuteExprs[m]`; if `refHour` is `next`, the hour is
  `h + 1`; the hour numeral is `render(hour12, n, { gender: "f" })`; the
  period is chosen from the **original** 24-hour `h`, so the shift never
  changes the period; `hour12 = ((h + 11) % 12) + 1`.
- **Exact**: hour numeral as above, then `connector.past`, then
  `render(m, n, { noun: minute.noun })`, so one minute is *daqīqa*, two is
  the dual with the numeral dropped, three to ten is the plural after a
  construct numeral, eleven up is the singular after the numeral — with
  no agreement code in the time module.
- Overrides `HH:MM|style` then `HH:MM`, on the 24-hour key.
- `clips` is the ordered pair `[hourClips, minuteExprClips]` when both
  exist, which is the one place two recordings are played in sequence
  (decision 7).

### 4.3 ar-PS behaviours, as hypotheses for the golden tables

Written down so the native speaker can strike any of them out. None is
assumed correct until the table says so.

Numbers: 1 and 2 agree with the noun; with a noun, 2 uses the noun's dual
and drops the numeral (`nounForm: "dual"`). 3–10 use the construct form
before a noun and the noun's plural; whether the *reversed polarity* of
the standard language survives in the dialect (three girls with the
masculine-looking form, three boys with the feminine-looking one) is the
first thing to check, and the data model does not care which way it goes
— the teacher types what goes in each box. 11–19 are single lexemes, noun
singular, optional construct variant before a noun. 20–99: unit, then
connector, then ten; noun singular. Hundreds: `hundred.1` for 100,
`hundred.2` for 200, and `construct.m + hundred.n` for 300–900 — **this
is the one most likely to fail**, because the dialect fuses them
(*tlat-miyye* written as one word, as the existing test data has it:
تلتمية), and if the composed spelling is rejected the answer is an
override per hundred, which the model already carries, and the golden
table records that choice. Thousands: `thousand.1`, dual `thousand.2`,
`construct.m + thousand.n` (plural) for 3–10 thousand, and `thousand.1`
after a rendered count from 11 thousand (حداعش ألف, خمسة وأربعين ألف,
مية ألف). Millions the same way. The connector is a prefix with no space
after it and a space before (سبعة وأربعين), which is code, while the
connector word is data.

Times: feminine hour forms (1 → واحدة, 2 → تنتين), fraction words for
:15, :20, :30, "to" forms with the next hour for :40, :45, :50, :55, half
plus or minus five for :25 and :35, twelve for noon and midnight, periods
by 24-hour ranges.

---

## 5. The learner side

### 5.1 Component cards

Generated on the device from the system (§3.3), locked like course cards,
regenerated by the fold on every material refresh. Progress survives
because ids are derived from `(systemId, slot)` and `foldForms` matches
forms by id. A card the teacher deletes from the system is *gone* to the
fold, and its progress is parked (`Doc.parked`) exactly as a withdrawn
course card's is, and restored if the slot returns.

### 5.2 Range skills, and the value that is asked

A range skill is an `Item` so the scheduler can hold its `s` states and
`buildSession` can deal it (`src/ArabicTrainer.tsx:2748-3079`). What this
overturns, named plainly:

- The number and time exercise keys join `TYPES` (`src/languages.ts:75-86`)
  with levels, so `openTypes` and the ladder apply to a range as to a
  form. The assertion at `tests/numbers.test.mjs:473-490` is reversed.
- `NUMBER_EQUIVALENT` stays, but now says which *ordinary* key a range
  question credits a component card under (a right *read this number*
  credits *forty* under `ar2en`), rather than being the only key.
- `settings.numbersReach`, `buildNumberSession`, `numberItem`,
  `isMadeUpNumber` and the home-screen *Practise numbers* button go
  (Phase 4). Whether a manual *practise numbers* sitting survives as a
  mode over the range skills, the way *Weak skills* is a mode, is **Q9**.

**Which value is asked**, and when it is decided. The repository has two
rules that settle this: a question is decided when the queue is built,
never at the moment of asking (`src/ArabicTrainer.tsx:3018`, on `ctx`),
and *what varies between askings turns on a right answer*
(`turnOf`, `src/scheduler.ts:438-464`), so a missed question comes back as
the *same* question. So the value is `sample(range, seed)` where the seed
is `hash(\`${item.id} ${key} ${turnOf(state)}\`)` through the FNV-1a hash
in `src/chance.ts` driving a small LCG — deterministic per (skill,
exercise, right-count), different on every right answer. It is decided in
`buildSession`, rendered there through the composer, and carried on a
**cast form** (`withLead`, `src/cards.ts:104-105`; *"a cast form is for
showing, never for deciding"*, `DECISIONS.md:1465-1467`) whose `ar` is the
rendering, `en` the digits (or `HH:MM`), and `tokens` the credit list.
Nothing of it is stored.

**Which ranges open.** As today's `openBands`: a range is offered only
when its deterministic probe (`probeOf`) renders with no warnings, and
ranges open as a prefix, so a lexicon missing *seventy* offers 0–20 and
nothing above. Time ranges wait on the feminine hour forms 1–12 and on
the minute expressions each range needs (hours; quarters and halves;
fives; exact minutes; periods).

**The pools.** A range skill counts as one card against
`FRONT_DOOR_CAP`/`IN_HAND_CAP` (`src/scheduler.ts:867-872`). Component
cards count like any course card, which is the same cost as today's part
cards in a deck. The pace harness (`tests/pace.test.mjs`) is run before
and after Phase 3 and the numbers recorded.

### 5.3 Crediting

A right answer to a range question credits every component card whose
slot appears in the rendering's tokens, under `NUMBER_EQUIVALENT[type]`,
through `fillerMarks` and its three limits (`src/grade.ts:204-228`) — the
rule `numberFillers` already applies to `used`. Tokens replace `used`.

### 5.4 Exercises

Existing answer modes: `fig` (digits, exact or wrong), `ar` (script),
`choice`. New: `clock` (a typed time — accepts `7:05`, `07:05`, `7.05`,
`٧:٠٥`, and `19:05` where the system is 24-hour or a period was shown)
and `dial` (an analog clock the learner sets; hour and minute hands, minute
snapped to five in colloquial ranges). New prompt field `clock` renders an
inline SVG face. Proposed inventory, levels chosen on the ladder's own
terms (recognise → tell apart → produce from a cue → produce from meaning):

| key | range | prompt → answer | mode | level | needs |
|---|---|---|---|---|---|
| `num2fig` | numbers | text → digits | `fig` | 1 | — (exists) |
| `fig2pick` | numbers | digits → choose the text | `choice` | 2 | mates (exists) |
| `fig2num` | numbers | digits → text | `ar` | 4 | — (exists) |
| `count2phrase` | agreement | digits + noun → phrase | `ar` | 4 | `nouns` |
| `rec2fig` | numbers | listen → digits | `fig` | 3 | a single recorded token, or a curated clip |
| `time2fig` | time | text → `HH:MM` | `clock` | 1 | — |
| `time2dial` | time | text → set the clock | `dial` | 2 | — |
| `fig2time` | time | `HH:MM` → text | `ar` | 4 | — |
| `clock2time` | time | clock face → text | `ar` | 4 | — |
| `rec2dial` | time | listen → set the clock | `dial` | 3 | hour clip and minute-expression clip |

The exact level of each is a routine call the owner may want to change
(**Q10**). All are ordinary `EX` entries so the one question screen asks
them (`src/languages.ts:346-350` says why that matters).

### 5.5 Audio

Clips stay on forms. A component card's forms carry the lexeme's clip
hashes, so `clipsOf`, `recsOf`, the listening gate (`needs: ["recs"]`,
`src/offers.ts:107`) and the offline rule all work unchanged. Components
only: a range's listening exercise is available only when the sampled
value renders to one recorded token or has a curated clip; the sampler
for a listening key restricts itself to such values and reports
`needs` unmet when there are none. A time may play two clips in
sequence: the cast form carries `recSeq: string[][]` and the audio player
plays the groups in order — the single player change, and the only place
two recordings are ever joined. No stitching within a number. TTS goes to
the backlog.

---

## 6. The teacher side

The `#` button in the Teaching → Cards toolbar (`src/spaces.tsx:6088-6100`),
which today opens `NumbersScreen`, opens the **Number system** editor for
the language (the language chooser at `:5853-5880` stays for teachers of
more than one number-capable language). Two tabs, *Numbers* and *Time*.

**Numbers tab.** A lexicon grid generated from `requiredSlots()`: one row
per slot, one `ScriptInput` per form key the slot wants, grouped as the
composer groups them, with the composer's hint under each row. A missing
cell is a soft gap (the row shows which ranges it holds back, as
`missingFor` does today), never a blocker to saving. Above the grid, the
reach (*numbers up to 9,999 can be made*) and the ranges, as
`NumberReach` shows them. Below, a **preview**: a fixed sample set (the
awkward shapes: 1, 2, 3, 11, 20, 21, 100, 101, 200, 300, 1,000, 1,001,
2,000, 3,000, 11,000, 100,000, 1,000,000, 2,000,000, 3,000,000, 1,525,
9,999,999) plus a *random* button, each rendered live, each showing its
warnings, and each row with a noun beside it where the composer took one.
**Tap a preview** to open an override for that number (and, where a noun
was involved, for that form key). Overrides list below with a *remove*
on each. A `composerVersion` older than the composer's marks every
override *worth re-checking*. Per-lexeme recording uses the existing
recorder and `put-clip`, writing the hash onto the lexeme's `audio`.
A small **nouns** section for the agreement exercise (§1.10).

**Time tab**, unlocked once feminine forms for 1–12 exist in the number
system (the composer answers that question; the tab says what is
missing otherwise): the hour word and the minute noun with its
singular, dual and plural and gender; the two connectors; a twelve-row
minute-expression table with a *same / next hour* toggle and an English
gloss defaulting to *15 past* / *15 to*; periods with hour ranges on a
24-hour scale; the 12/24-hour switch; a preview grid (every hour at
:00, :15, :30, :45, plus a random button, in both styles, with and
without period); overrides by tapping.

**Saving.** One whole document, through the outbox as a queued kind
(`"system"`) beside `"card"` and `"flag"`, so a train edit is kept and
sent. What the server does with two saves that cross is §7.

**Gallery.** Every new component is registered in `src/gallery.tsx` and
the component-uses scan (extended to the new files, §1.4) counts it.

---

## 7. Storage and sync — what is there, what is proposed, what needs an answer

The brief says *ask before assuming anything about the sync layer*. Here
is what was found, the proposal, and the questions Phase 1 is blocked on.

### 7.1 Two systems, not one

**The learner document** is one blob per person, keyed by a token derived
from the sign-in key, held whole in localStorage under
`arabic-trainer:arabic-trainer-v3` and synced through `/api/sync`
(`src/sync.ts`, `server/api/sync.js`). The server never parses it beyond
an emptiness guard. Merging is per field family (`mergeData`,
`src/sync.ts:188-275`): items by id, per-form and per-exercise states by
`updated`, tombstones and logs by max, and **`settings` is the one
whole-object last-write-wins in the codebase** (`:259-273`). What goes on
the wire is a **closed whitelist** (`forWire`, `:383-394`); a new
top-level field is silently dropped from every push and from the
*changed* comparison. A push with no items and no tombstones is refused
as *would-empty* (`:318-327`; server `sync.js:159-173`). Two size ceilings,
4 MB on the wire and 5 MB of UTF-16 locally, both whole-document.

**Course material** is server-owned records in the `arabic-courses` store
(`server/api/courses.js`, key map at `:173-207`): `card:<id>`,
`deck:<id>`, `course:<id>`, `mycards:<owner>`, `clip:<hash>`, plus
`fillsrev:<owner>`, a bare revision counter for the one kind of material
that belongs to no deck — the value cards that fill blanks. Students pull
everything in one `my-material` call (`:1773-1945`) whose answer is cached
in localStorage (`arabic-trainer:material`, never synced) and whose
`version` is a hash of the courses, decks and each teacher's `fillsrev`
(`materialVersion`, `:482-493`). **Anything a student must receive has
to be folded into that hash or it never reaches them** — which is exactly
the bug `fillsrev` exists to fix (`:190-198`). Records are whole-record
overwrites, or read-modify-write with an ETag through `updateJson`
(`:332-354`) where a list must not lose a concurrent change.

### 7.2 Proposal

A number system and a time system are **teacher material**, so they live
where material lives, and reach students the way values do:

- New records `numsys:<id>`, `timesys:<id>`, plus `mysystems:<owner>`
  listing a teacher's system ids; one number system and one time system
  per (owner, language), minted on first save with a random id.
- New actions on `/api/courses`: `my-systems` (the teacher's own),
  `save-system` (whole document), `delete-system`; each guarded by the
  owner or `admin`. Client wrappers in `src/courses-api.ts` with their
  error strings added to `explain`.
- **Whole-document last-write-wins by `updated`**: the server keeps the
  save whose `updated` is later than what it holds and refuses an older
  one (the same rule `mergeItem` uses for a card's text, `src/sync.ts:99`),
  answering with the record it holds either way so the editor can show
  what is there. A queued save that arrives after a co-teacher's later
  one is refused, which the outbox treats as *decided* and drops — the
  cost the brief accepts by choosing LWW, and it is said in the editor
  when it happens.
- `my-material` bundles `systems: [...]` — every system of every teacher
  whose material reaches the student, in the language of a course they
  are in — and each system's `rev` goes into `materialVersion` beside
  `fillsAt`.
- The student's copy lives in the material cache. Component cards and
  range skills are generated into the learner document by the fold, so
  their review states sync through the ordinary per-form merge, the
  wire whitelist is untouched, and *would-empty* is untouched.
- Clips a system references are walked by a new `clipsOfSystem` beside
  `clipsOfCard` (`:128-137`) so backup, clear and the admin overview see
  them; teacher clips are fetched by hash on the device as course cards'
  are.
- Touchpoints that would otherwise fail in silence, all named so none is
  missed: the backup manifest's batch list (`:2186-2193`) and counts, the
  restore allowlist regex (`:2252`, which `continue`s on an unknown
  prefix), `admin-clear` (`:2288-2380`), `wipeAccount` (`:499-542`),
  `delete-account` (`:718-754`), the client's `buildBackup` parts list
  (`src/spaces.tsx:695-726`), and `tests/server.test.mjs` backup/restore
  assertions (`:2084-2141`).

**Why not the learner document.** A field on `Doc` would need `forWire`,
`mergeData`, `EMPTY`, `docSize`, the smoke harness's seeded documents
and two test fixtures changed, would put teacher material inside a
student's personal document, and would make the *would-empty* guard
wrong for a teacher whose only content is a system. `settings` is a
whole-object LWW precedent but it is the learner's own preferences, and a
teacher's lexicon is not one of those.

### 7.3 Questions that block Phase 1

- **S1.** Material path (proposed) or a field on the learner document?
- **S2.** One system per (teacher, language), reaching every course of
  that language the teacher teaches — proposed, mirroring values — or
  attached to a course by the teacher?
- **S3.** A student in two courses of one language from two teachers
  receives two systems and therefore two sets of component cards and
  range skills. Proposed: accept it, as two teachers' cards are two
  cards today. The alternative, one system per language per device
  chosen by latest `updated`, needs a picking rule and a way to explain
  it.
- **S4.** Last-write-wins by `updated` with a refusal of older saves
  (proposed), or blind overwrite with `rev++`? The first is what the
  brief says and what the outbox's *decided* rule expects; the second
  never refuses and can resurrect a stale queued save.
- **S5.** Is a teacher who is not a student of their own course expected
  to *practise* their own numbers? Today they do not see their own cards
  as a learner unless they join a course. Proposed: the same rule.
- **S6.** May Phase 1 add the outbox kind `"system"` with the same
  50-per-kind, 14-day cap as cards (`src/outbox.ts:46-47`)?

---

## 8. Testing

Extends the existing suite; no second runner. Test files stay **flat in
`tests/`** as `tests/<name>.test.mjs`, because `npm test` runs the
non-recursive glob `tests/*.test.mjs` and a subdirectory would be linted
and typechecked and never run. Fixtures may live in `tests/golden/`.

- **Golden tables**, JSON so a native speaker can read and edit them
  without touching code: `tests/golden/ar-PS.numbers.json` (~120 numbers
  with contexts — bare, with a masculine noun, with a feminine noun, with
  gender only) and `tests/golden/ar-PS.times.json` (~60 times in both
  styles, with and without period, including the rounding and
  next-hour cases). Each file carries the complete lexicon it was checked
  against and a `reviewedBy`/`reviewedOn` line. Loaded with
  `readFileSync` + `JSON.parse`, the one JSON-reading idiom already in
  the repo (`tests/version.test.mjs:12`). The existing Arabic, Hebrew and
  Huế cases in `tests/numbers.test.mjs` are lifted into
  `tests/golden/<lang>.numbers.json` so the Phase 1 ports are proved
  identical.
- **Property tests**, hand-rolled seeded LCG loops as in
  `tests/numbers.test.mjs:416-429`: over every value 0–2,000 and a seeded
  sample of 5,000 across the whole range, with a complete lexicon: no
  warnings; every token maps to a lexeme slot, a connector or an override;
  rendering twice is equal; an override set for the sampled value wins
  at whole and at chunk level; an incomplete lexicon warns with the slot
  name and never throws; `probeOf` for a range never lands outside it.
- **Narrowing tests** for the boundary readers (§1.2): malformed,
  truncated, over-long and unknown-field documents in, what comes out,
  and no exception.
- **Server round trip**: save a system, refuse an older save, bundle it
  in `my-material`, change the `version` when its `rev` moves, back it up
  and restore it, clear it — in `tests/server.test.mjs`, which starts the
  real server over a socket.
- **Idempotent regeneration**: fold the same system twice and get the
  same items; fold after a review state was written and keep it; drop a
  slot and find its progress parked; restore it and find it back.
- **Scheduler**: a range skill is dealt, its value is the same on a
  retry after a miss and different after a right answer, its ranges open
  as a prefix, a listening key is not offered where no single-token
  value exists.
- **Parity**: `tests/card-facts.test.mjs` and `tests/card-readout.test.mjs`
  over new corpus cards (a component card, a range skill) — they fail
  first, by design, until the new fields are described.
- **Isolation**: the extended `tests/language-isolation.test.mjs` walks
  `src/numbers/` and finds no script and no language-named import in an
  app file.
- **Smoke**: one walk that opens the editor, types a lexeme, sees the
  preview move, taps a preview into an override, saves, and reloads to
  find it.
- **Types**: `tests/types.test-d.js` gains `@ts-expect-error` lines for
  an `enum`-free, `import type`-only `src/numbers/`.

---

## 9. Migration

One shape to migrate (§1.5), on the server, once, idempotent, in the
`deckCardIds` mould:

1. When a teacher first opens the number system for a language (or on
   `my-systems` finding none for that language), read the teacher's cards
   with `category: "number"` in that language.
2. For each card with a `value` that maps to a slot (0–10 → `unit.n`,
   11–19 → `teen.n`, 20–90 by tens → `ten.n`, 100 → `hundred.1`, 200 →
   `hundred.2`, 1,000 → `thousand.1`, 2,000 → `thousand.2`, 1,000,000 →
   `million.1`, 2,000,000 → `million.2`), seed the lexeme's `standalone`
   from the lead form, `f` from the `counted`/`feminine` cell where one
   exists, and `audio` from the form's clips. `hundred.n`, `thousand.n`
   and `million.n` cannot be read off a fused card and stay empty, which
   the editor shows as gaps.
3. Every other valued card (300–900, 3,000–9,000, 3,000,000–9,000,000, and
   any whole number a teacher wrote as an override) becomes an
   `overrides["n"]` with the card's lead form as `text` and its clips as
   `curatedAudio`.
4. Record `migratedFrom: Record<slot | "override:n", cardId>` on the
   system, and mark each source card `derived: true` (a new card field the
   parity tests will demand a description for). Derived cards stay in
   their decks, keep their recordings and everybody's progress, and are
   deleted in a later release (backlog).
5. Write the system once. A system that exists is never rebuilt; a
   second open finds it and does nothing. A teacher with no number cards
   gets an empty system and no record until they save.

On the device, when a component card is generated for a slot whose
`migratedFrom` names a card the learner holds as `srv<cardId>`, the fold
copies that card's review states and mark onto the component card the
first time, so a student's year of progress on *forty* is not reset by
the teacher's screen changing. Time cards do not exist; nothing to
migrate.

`settings.numbersReach` joins `RETIRED_SETTINGS`. `Doc.version` stays as
it is; nothing here reads it.

---

## 10. Phases

Each phase is a release, checked green and merged to `beta`. Phases 2 and
3 ship together (see Phase 2, *why*). Effort is a rough count of working
days and excludes the native speaker's time.

### Phase 0 — spike: the ar-PS composers against golden tables (2–3 days)

**Goal.** Prove the Arabic number composer, with agreement, against a
native speaker's table before any storage or UI exists; then the time
composer once feminine hour forms and noun agreement pass.

**Create.**
- `src/numbers/types.ts` — the shapes in §3 and §4.
- `src/numbers/ar-PS.ts` — `Composer` for Palestinian Arabic. No script
  in the file: slot names and join rules only.
- `src/numbers/ar-PS.time.ts` — `TimeComposer` (second half of the phase).
- `tests/golden/ar-PS.numbers.json`, `tests/golden/ar-PS.times.json` —
  written first, with the lexicon they were checked against.
- `tests/numbers-ar-PS.test.mjs`, `tests/times-ar-PS.test.mjs` — golden
  and property tests.

**Touch.** Nothing else. `src/numbers.ts`, `languages.ts` and the app are
untouched; the new modules are imported by their tests only.

**Risks in this codebase.**
- `tests/language-isolation.test.mjs` does not see `src/numbers/` yet;
  a stray Arabic literal in a composer would pass. Mitigation: a temporary
  assertion in the new test file that the composer sources contain no
  `[֐-ۿ]`, replaced by the real extension in Phase 1.
- The fused hundreds (§4.3) may turn a clean composition into nine
  overrides; that is a finding, not a failure, and the golden table
  records it.
- ESLint's ignore list is missing two build dirs already
  (`tests/.facts-build`, `tests/.readout-build`); harmless here, noted so
  nobody adds a third gap.

**Open questions before starting.** None that block. Q2 (who the native
speaker is and how the table comes back) decides the calendar, not the
code.

**Exit.** Both golden tables green; property tests green; the speaker
has signed the tables.

### Phase 1 — data model, boundary readers, storage, sync, registry (2–3 days)

**Goal.** A number system and a time system can be saved by a teacher,
reach a student, be backed up and restored, and be read totally at every
boundary. Hebrew and Huế are ported so nothing regresses later.

**Create.**
- `src/numbers/schema.ts` — `readNumberSystem`, `readTimeSystem`, hand-
  written total narrowers (§1.2); `emptyNumberSystem(languageId)`.
- `src/numbers/he-IL.ts`, `src/numbers/vi-Hue.ts` — straight ports of
  `HE_NUMBERS` and `VI_NUMBERS` onto `Composer`, identical output.
- `src/numbers/index.ts` — `composerFor(langId)` and `timeComposerFor`,
  the neutral names an app file may import.
- `tests/golden/he-IL.numbers.json`, `tests/golden/vi-Hue.numbers.json`
  — lifted from `tests/numbers.test.mjs`.
- `tests/numbers-schema.test.mjs`, `tests/numbers-he-IL.test.mjs`,
  `tests/numbers-vi-Hue.test.mjs`.

**Touch.**
- `src/types.ts` — `Lang.numbers` typed as the new `Composer`, `Lang.times`
  added; `NumberSpec` and friends kept until Phase 4 for `src/numbers.ts`.
- `src/languages.ts` — each pack's `numbers:` points at its composer (the
  three `spell` functions and `SEMITIC_NUMBER_GROUPS` are deleted once
  `src/numbers.ts` no longer reads them — Phase 4; until then both shapes
  are exported side by side, which is the transitional cost).
- `server/api/courses.js` — key map, three actions, `clipsOfSystem`,
  `my-material` bundling and `materialVersion`, backup manifest, restore
  allowlist, `admin-clear`, `wipeAccount`, `delete-account`.
- `src/courses-api.ts` — wrappers and `explain` strings.
- `src/outbox.ts` and its two drain sites — the `"system"` kind (S6).
- `src/ArabicTrainer.tsx` — the material cache carries `systems`.
- `tests/server.test.mjs`, `tests/courses-api.test.mjs`,
  `tests/outbox.test.mjs`.
- The stem-keyed guards (§1.4): `tests/language-isolation.test.mjs`
  (walk `src/numbers/`, no script anywhere in it, app files import only
  `src/numbers/index.ts` names), `scripts/component-uses.mjs` and
  `tests/component-uses.test.mjs` (recurse; regenerate
  `src/component-uses.js`), `tests/cards.test.mjs:2187-2210` (recurse).
- `README.md` — the module map gains a `numbers/` stanza; the
  language-specific rule gains its narrowing.
- `DECISIONS.md` — entries D1 and D2 (§11).

**Risks in this codebase.**
- Anything left out of `materialVersion` never reaches a student, with
  no error. The server test asserts the version moves when a system's
  `rev` moves.
- The restore allowlist `continue`s on an unknown prefix, so a backup
  taken after Phase 1 and restored by a build without the prefix would
  drop systems silently. The prefix is added in the same release as the
  records.
- `readJson` throws on an unreadable record on purpose (an absence is a
  withdrawal on the device); the new read paths must keep that
  distinction or a disk hiccup reads as a deleted system.
- `updateJson` has an in-process lock only; fine for one process on one
  volume, as `DECISIONS.md:1729-1732` records.
- Exporting both the old `NumberSpec` shape and the new composer from
  `languages.ts` for two releases is two shapes for one thing; it ends in
  Phase 4 and the plan says so.

**Open questions before starting.** S1–S6 (§7.3). Q1 (Valibot). Q3
(should the migration in Phase 2 also run on `my-material` for a teacher
who never opens the editor, so students of an inactive teacher still get
component cards, or only on the editor's first open?).

**Exit.** A system saved on one device is read on another; the server
tests for save, refuse, bundle, version, backup, restore and clear are
green; Hebrew and Huế golden tables identical to the old cases.

### Phase 2 — the teacher editor, with the migration seeding it (3–4 days)

**Goal.** The `#` button opens the Number system editor; a teacher who
already filled in parts finds them there.

**Create.**
- `src/number-system-editor.tsx` — the editor, in the family of
  `card-editor.tsx` (a flat `.tsx` beside it, so the component and icon
  scans, which are keyed by filename, find it without a fifth stem —
  add it to their lists), with `LexiconGrid`, `RangeReach`, `Preview`,
  `OverrideSheet`, `NounList`, `TimeTab`, `MinuteExprTable`, `PeriodList`.
- `tests/number-system-editor.test.mjs` — pure pieces (which slots are
  gaps, what a tap on a preview proposes, what the Time tab is waiting
  on), and the smoke walk in `tests/smoke.mjs`.

**Touch.**
- `src/spaces.tsx` — the `#` button and the language chooser open the new
  editor; `NumbersScreen`, `NumberReach`, `saveNumbers` stay until Phase 4
  but are unreachable from the UI.
- `src/gallery.tsx` — register the new components.
- `server/api/courses.js` — the migration (§9) on first open; `derived`
  on cards, whitelisted.
- `src/card-facts.ts`, `tests/card-corpus.mjs` — describe `derived`.
- `docs/UI-COMPONENTS.md`.
- `CHANGELOG.md`, `README.md` (the *"A number is built"* section is
  rewritten to describe the system), `DECISIONS.md` (D3).

**Why Phases 2 and 3 ship together.** Once the editor writes to a system,
the old learner practice (which reads part cards) shows stale words after
any lexeme edit, and writing through to the derived cards as well would be
the dual-write the repository keeps refusing. The atomic switch is:
teachers edit systems, learners practise from systems, in one release.
Phase 2 is developed and reviewed as its own branch and merged with
Phase 3.

**Risks in this codebase.**
- The editor is the first teacher screen that is not a card, so the
  outbox, the *saved / kept on this device* wording, and the offline
  state all need one more kind. The `"card"` drain at
  `src/spaces.tsx:4934-4958` is the template.
- A `ScriptInput` per form key for 60 slots is a long screen on a phone;
  groups collapse, as `NumbersScreen`'s do, and the Time tab is separate
  for the same reason.
- The `combos`-style count pattern (count before building) applies to
  the preview: render on tap and on a debounce, never on every keystroke
  for the whole sample set.

**Open questions before starting.** Q4 (should overrides be offered for
form-keyed cases in the first version, or bare only?). Q5 (the *nouns*
list — inside the system, as proposed, or nowhere until noun cards carry
a dual?).

**Exit.** A teacher with old part cards opens the editor and sees them as
lexemes and overrides; edits, records, overrides and saves; a co-teacher's
crossing save is refused and explained; the smoke walk is green.

### Phase 3 — learner cards, range skills, exercises, scheduler hooks (4–5 days)

**Goal.** Component cards and range skills appear on a student's device,
are dealt by the ordinary session, and are asked the exercises in §5.4.

**Create.**
- `src/numbers/range.ts` — bands, `probeOf`, `confusablesOf`, the seeded
  sampler, `openRanges` (moved from `src/numbers.ts`, which then keeps
  only what the old practice still needs until Phase 4).
- `src/numbers/generate.ts` — pure: a system in, component `Item`s and
  range `Item`s out, ids derived; the fold calls it.
- `src/clock.tsx` — `ClockFace` (inline SVG prompt) and `ClockDial` (the
  set-the-clock input); flat `.tsx` so the scans see it.
- `tests/numbers-generate.test.mjs`, `tests/numbers-range.test.mjs`,
  `tests/clock.test.mjs`, additions to `tests/scheduler.test.mjs`,
  `tests/session.test.mjs`, `tests/grade.test.mjs`,
  `tests/offline.test.mjs` (a listening range key is not offered without
  the clip), `tests/card-facts.test.mjs` corpus cards, `tests/pace.test.mjs`
  (run before and after; numbers recorded in the changelog).

**Touch.**
- `src/languages.ts` — the new `EX` entries and their keys in `TYPES`;
  `NUMBER_EQUIVALENT` extended; `checkAnswer` gains the `clock` mode;
  `isListening` already derives from `promptField`.
- `src/scheduler.ts` — `unitsOf` unchanged (a range skill has one form);
  `keysFor` unchanged; a note on `turnOf` as the seed.
- `src/ArabicTrainer.tsx` — `buildSession` casts a range unit's form at
  deal time (§5.2); `resolveUnit`/`castFill` hand the cast form to the
  question screen; the question screen learns the `clock` prompt field
  and the `dial` answer mode; the audio player learns `recSeq`;
  `numberFillers` reads tokens; the material refresh calls `generate`
  before `foldCourses`.
- `src/shared.tsx` — `foldCourses` accepts generated items; `cardToItem`
  untouched.
- `src/offers.ts` — `unmetNeeds` for `nouns`, and for a listening range
  key with no single-token value.
- `src/card-facts.ts`, `src/flag-export.ts` — `range`, `source.systemId`,
  `slot` described; a flagged range question reports the value asked.
- `src/types.ts` — `Item.range`, `Item.source` widened, `Form.recSeq`.
- `src/index.css` — the clock face and dial.
- `docs/UI-COMPONENTS.md`, `README.md` (the session rules gain the range
  paragraph; *"never scheduled"* is rewritten), `DECISIONS.md` (D4, D5).

**Risks in this codebase.**
- The question screen is one component with one input; the dial is a
  new input kind in it. `src/ArabicTrainer.tsx:2200-2205` already refuses
  to swap a listening exercise mid-session; the dial must fail the same
  way when the system changes under it.
- `foldCourses` names what it keeps and wipes the rest on every refresh
  (`DECISIONS.md:1419-1430`); generated items must go through the same
  named-fields fold, and a range skill's `s` is the only thing on it that
  is the learner's.
- `card-facts` and `card-readout` tests fail first on every new field,
  by design; budget for describing each.
- The `subs` door guard and the isolation test now walk `src/numbers/`;
  a helper that reads `card.forms` directly fails the guard, which is the
  point.
- Pace: eighty new cards per language enter the pools; the harness says
  what that costs a new learner, and the number goes in the changelog.
- The `LANGUAGE_SPECIFIC` regex flags any app-file import beginning
  `ar`/`he`/`vi` + capital; the registry's exports are language-neutral
  names for that reason.

**Open questions before starting.** Q6 (how many range skills for time:
the five in the brief, or fewer to start?). Q7 (do component cards appear
in the student's card list under a pseudo-deck tag, as proposed, or
hidden?). Q9, Q10.

**Exit.** A student meets *Numbers 0–10* and *forty* in an ordinary
session; a miss brings the same number back; a right answer credits the
parts; the clock face renders on a phone; the smoke walk answers a range
question; pace numbers recorded.

### Phase 4 — migration completed, both old entry points removed (2 days)

**Goal.** One implementation. The old Numbers screen, the old learner
practice, the `number` category, the `counted` tables and `value` are
gone; derived cards remain, marked, for one more release.

**Delete.** `src/numbers.ts`, `tests/numbers.test.mjs` (its cases already
live in the golden tables), `NumbersScreen`, `NumberReach`, `saveNumbers`
(`src/spaces.tsx:4171-4391`, `:4857-4911`), `numberItem`,
`buildNumberSession`, `isMadeUpNumber`, `NUMBER_TYPES`, the *Practise
numbers* button and `settings.numbersReach` (`src/ArabicTrainer.tsx:3590-
3740`, `:7975-7988`, `:9506-9511`), `AR_NUMBERS`/`HE_NUMBERS`/`VI_NUMBERS`/
`SEMITIC_NUMBER_GROUPS`/`semiticNumberCells`/`NUMBER_BANDS` in
`src/languages.ts`, `NumberSpec`/`NumberPart`/`NumberGroup`/`NumberCell`/
`NumberCtx`/`Spelling` in `src/types.ts`, `Item.used`, `Card.value` and
`Item.value`.

**Touch.**
- `src/languages.ts` — `number` category retired the way `register` is
  (definition kept, `retired: true`, not offered); `COUNTED_TABLE` and
  Huế's `counted` removed from the packs' `tables` (a card carrying a
  `counted` cell keeps it as an ordinary sub-form).
- `server/api/courses.js` — `value` joins `RETIRED_CARD_FIELDS`
  (`:160-168`); the migration is now also run on `my-material` for any
  teacher with number cards and no system (Q3), so no student is left
  with derived cards and no system.
- `src/card-facts.ts`, `src/flag-export.ts`, `src/shared.tsx`
  (`ReadKind`'s *Worth*), `tests/card-corpus.mjs`, `tests/session.test.mjs`
  (`part()` helper), `tests/layers.test.mjs` if a style went.
- `src/ArabicTrainer.tsx` — `RETIRED_SETTINGS` gains `numbersReach`.
- `README.md` (module map, session rules), `CHANGELOG.md`,
  `DECISIONS.md` (the *what was removed and why* paragraph on D1).

**Risks in this codebase.**
- A student on an older build who receives a `my-material` answer with
  systems and no `value` on cards simply sees ordinary cards; nothing
  breaks, and the old practice on that build says *no parts*. Say so in
  the changelog.
- Deleting `tests/numbers.test.mjs` removes 500 lines of assertions; the
  golden tables and property tests must cover the same rules, and the
  Phase 1 diff is where that is proved, not here.
- `RETIRED_CARD_FIELDS` is spread on every save; adding `value` there
  strips it from derived cards on their next save, which is intended,
  and from any card a teacher wrote by hand with a value, which nobody
  can have done since the editor never wrote it.

**Open questions before starting.** Q3. Q11 (how long derived cards stay:
one release, as proposed, or until the teacher deletes them?).

**Exit.** `grep -rn "value" src/types.ts` finds no card field; both old
screens gone; check green; students' progress on *forty* intact after the
release (the fold copy in §9, asserted in `tests/cards.test.mjs`).

### Phase 5 — Hebrew agreement and times, then the shared helpers (3 days)

**Goal.** The Hebrew composer gains gender agreement (counting in the
feminine, the masculine before a scale word — already in the port —
plus a counted noun's gender and dual, and the construct forms the
existing test data shows: שלושת אלפים), a Hebrew time composer, and golden
tables from a native speaker. Only then are the helpers the two composers
share — dual, polarity, construct forms, chunking, the connector join —
extracted into `src/numbers/compose.ts`, with both golden suites
unchanged across the extraction.

**Create.** `src/numbers/he-IL.time.ts`, `src/numbers/compose.ts`,
`tests/golden/he-IL.times.json`, `tests/times-he-IL.test.mjs`.

**Touch.** `src/numbers/ar-PS.ts`, `src/numbers/he-IL.ts` (refactor onto
the helpers), `src/numbers/vi-Hue.ts` (only if a helper fits; Huế's
in-company forms are not agreement), `DECISIONS.md` (D6).

**Risks.** Extracting a helper that fits Arabic and not Hebrew is the
*three languages in one coat* the old module's header warns about; the
rule is that a helper is extracted only where both golden suites exercise
it.

**Open questions.** Q12 (Hebrew native speaker). Q13 (is a Huế time
system wanted, and if so what does *quarter past* look like there —
outside this plan).

---

## 11. Open questions, consolidated

Each with the plan's assumption, so nothing waits on an answer that
would not change the work.

| # | Question | Blocks | Assumed |
|---|---|---|---|
| S1 | Systems as teacher material on `/api/courses` (§7.2), not a field on the learner document? | Phase 1 | Material |
| S2 | One system per (teacher, language), reaching every course of that language, not attached per course? | Phase 1 | Per teacher × language |
| S3 | Two teachers, one language, one student: two systems, two sets of cards and ranges? | Phase 1 | Yes, as with two decks |
| S4 | LWW by `updated`, refusing an older save, not blind overwrite? | Phase 1 | Refuse older |
| S5 | A teacher practises their own numbers only as a student of a course, as with cards? | Phase 1 | Same rule |
| S6 | Outbox kind `"system"` with the card cap and age? | Phase 1 | Yes |
| Q1 | Keep the hand-written boundary reader (the recorded decision), or add Valibot as a third runtime dependency? | Phase 1 | Hand-written |
| Q2 | Who verifies the ar-PS golden tables, and in what form do they come back? | Phase 0 calendar | A JSON file with notes |
| Q3 | Run the migration on `my-material` for teachers who never open the editor, from Phase 2 or only from Phase 4? | Phases 2, 4 | From Phase 4 |
| Q4 | Form-keyed overrides (`3|construct.f`) in v1, or bare only? | Phase 2 | Both |
| Q5 | Counted nouns as a list inside the system (§1.10), rather than nothing until noun cards carry a dual? | Phase 2 | Inside the system |
| Q6 | All five time ranges in v1 (hours, quarters-halves, fives, exact-minutes, periods)? | Phase 3 | All five |
| Q7 | Component cards visible in the student's card list under a pseudo-deck tag? | Phase 3 | Visible |
| Q8 | Later: read real noun cards and add `dual` to the number axis? | Backlog | Backlog |
| Q9 | Keep a manual *practise numbers / times* sitting as a mode over the range skills? | Phase 3 | Keep, as a mode |
| Q10 | The levels in §5.4? | Phase 3 | As tabled |
| Q11 | Derived cards deleted one release after Phase 4? | Phase 4 | One release |
| Q12 | Who verifies Hebrew? | Phase 5 | — |
| Q13 | A Huế time system at all? | Out of plan | No |

---

## 12. Proposed `DECISIONS.md` entries

Drafts in the file's own shape — a declarative heading, a date line with
file references, and *what it costs*. Dates are the release dates.

### D1 — A number system is a document, and its parts are not cards

**[Phase 1 release date]** · `src/numbers/schema.ts`, `server/api/courses.js`
(`numsys`, `timesys`, `my-material`), `src/shared.tsx` (`foldCourses`)

Numbers were built from parts since 0.152, and the parts were cards: one
card per box, findable by a `value` on it, put in front of students by
being added to a deck. That made the lexicon fifty-five cards with a
number on each, editable in two screens that agreed about nothing, and
it meant a form a number takes only in company — the construct before a
noun, the feminine for an hour — had to be a cell of a `counted` table
that only one of the three languages read.

A number system is one document per teacher per language: the lexemes,
each with the forms its language's composer asks for, and the overrides.
It is teacher material, stored and delivered as values are — in no deck,
bundled with every course of its language, its revision folded into the
material version so a change reaches a student without anything else
moving. The student's device generates a card per lexeme from it, with an
id derived from the system and the slot, so the fold that refreshes
course cards refreshes these, and a student's progress on *forty*
survives every regeneration.

**Why not the learner document.** It has one whole-object last-writer-wins
field already, `settings`, and a lexicon is not a learner's preference. A
new top-level field would have needed the wire whitelist, the merge, the
size measure and the emptiness guard all told about it, and a teacher
whose document held nothing but a system would have been refused as
empty.

**What it costs.** Whole-document last-write-wins: two teachers saving
the same system across a sync lose the earlier save whole, and a save
queued offline can be refused when it finally lands. Said in the editor
when it happens. And for one release, two shapes of the same thing in
`languages.ts`, until the old module went.

### D2 — Composers live beside the pack, and hold no words

**[Phase 1 release date]** · `src/numbers/<langId>.ts`, `src/languages.ts`
(`numbers`, `times`), `tests/language-isolation.test.mjs`

*Anything language-specific lives in `languages.ts`* was the rule, and a
number composer is language-specific. It is also two hundred lines a
language, and the file was three and a half thousand. So each language's
composer is a module of its own under `src/numbers/`, imported by
`languages.ts` and by nothing else: the pack is still the one door, and an
app file that wants a number asks the pack.

The narrowing that makes this safe is checkable: **no file under
`src/numbers/` may contain a word of any language.** The lexicon is data
in the system a teacher wrote or in a golden table a native speaker
signed; the composer knows slot names and join rules. The isolation test
walks the directory and fails on the first Arabic or Hebrew letter.

**What it costs.** The first subdirectory under `src/`, and four guards
that resolved files by a flat stem — the isolation test, the component
scan, the icon check and the sub-forms door — each taught to recurse,
because a guard that skips a directory passes in silence.

### D3 — The boundary reader for a system is hand-written, as the answer reader is

**[Phase 1 release date]** · `readNumberSystem`, `readTimeSystem` in
`src/numbers/schema.ts`

The brief asked for Valibot. The decision of 11 September stands, for the
same three reasons: the reader runs on every material refresh on a phone;
the app has two runtime dependencies and both are React; and the boundary
must be total — a system with one bad lexeme is a system with one gap,
not a document that fails to open. The editor's warnings about missing
cells are the composer's, not the schema's.

**Revisit if** a teacher ever imports a system from a file and needs to
be told which line is wrong.

### D4 — A range is scheduled like a card, and the number asked is decided when the queue is built

**[Phase 3 release date]** · `src/numbers/range.ts`, `src/ArabicTrainer.tsx`
(`buildSession`), `src/languages.ts` (`TYPES`)

A made-up number climbed no ladder: the practice was a button, its only
memory one integer, and the three number questions were kept out of
`TYPES` on purpose. That kept the schedule honest and left numbers
outside it — a learner who never pressed the button never met one.

A range — 0–10, 11–99, quarters and halves — is now an item with one form
and a schedule per exercise, dealt by the ordinary session. Which number
is asked is drawn from a seed of the range, the exercise and the count of
right answers, the same rule that rotates a sentence's fillers: a missed
question comes back as the same number, and a right answer moves on. It
is drawn when the queue is built and rendered then, so the question never
changes under the learner, and nothing about it is stored.

**What was kept.** A right answer still credits the component cards that
stood in the number, under the ordinary exercise it was evidence for.

**What it costs.** Eighty-odd cards and a handful of ranges per language
enter the new-word pools, at the rate the pace harness measured and the
changelog records.

### D5 — A time is a number with a feminine noun

**[Phase 3 release date]** · `src/numbers/ar-PS.time.ts`

The hour is the number composer asked for a feminine referent; the
minutes, in the exact style, are the number composer asked to count the
minute noun. The time module chooses a minute expression, shifts the hour
when the expression says *to*, and picks the period from the hour the
clock actually showed. It contains no agreement, which is why a fault in
*two minutes* is a fault in the number composer and is fixed once.

**What it costs.** A time can play two recordings back to back — the hour
and the minute expression — which is the one place two clips are joined,
and the player had to learn it.

### D6 — Shared helpers are extracted after the second language, not before

**[Phase 5 release date]** · `src/numbers/compose.ts`

The old module's header warned against *three languages wearing one
coat*. Dual, polarity, construct forms and chunking were written twice —
once for Arabic, once for Hebrew, each against its own golden table — and
only then pulled into a helper, with both suites unchanged across the
move. A helper is extracted where both suites exercise it and nowhere
else.

---

## 13. Proposed `BACKLOG.md`

There is no `BACKLOG.md`. *Later* items live today in a proposal's *Open
questions* or *What a first version would leave out*, an audit's *What to
do, in order*, or a *Revisit if* line in `DECISIONS.md`. A backlog file
with a preamble in the style of `DECISIONS.md` would give them one place.
Proposed opening and entries:

> # Backlog
>
> Work that is wanted and not started, each with why it waits. One entry
> per item, newest last. An entry leaves when it ships or when a decision
> says it never will.

- **Text-to-speech for numbers and times.** A rendered number with no
  recording could be spoken by the device. Waits on a decision about
  voices per dialect and on whether a synthetic voice is something this
  app wants a learner to imitate. Audio policy stays *components only*
  until then.
- **Delete derived number cards.** Phase 4 marks the old part cards
  `derived`; one release later they are deleted from decks and
  collections, their recordings kept as clips the system references.
- **Read noun cards for the agreement exercise.** Needs a `dual` value on
  the number axis (append-only, so stored values keep their meaning) and
  a way to read a noun's dual off its card; then the curated `nouns` list
  in a number system becomes a fallback.
- **Composed transliteration.** A lexeme may carry a transliteration per
  form; the composer does not join them. Would give ranges the level-3
  *transliteration → script* exercise.
- **Per-course selection of a system.** A teacher of two courses in one
  language who wants different words in each. No known ask; the
  per-teacher rule stands until there is one.
- **Ordinals, fractions, dates, currency.** Out of scope for v1 by
  decision; each is a composer of its own over the same lexicon.
- **Hebrew and Huế time systems.** Hebrew after Phase 5's golden tables;
  Huế if anyone teaches it.
- **Stitched audio within a number.** Playing *forty* then *seven* as one
  clip. Declined for v1 because the joins are where a dialect's sandhi
  lives and a stitched clip teaches the wrong sound.
- **`Doc.version` is written and never read.** Either give it a meaning or
  drop it; the lifts key on shape, not on it.
- **ESLint ignore list is missing two build directories.**
  `tests/.facts-build` and `tests/.readout-build` are in `.gitignore` and
  `tsconfig.json` and not in `eslint.config.js`.
