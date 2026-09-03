# Front-end consistency pass — what changed

Verified after every step with `npm run build`, `npm test` (11 unit tests) and
`npm run test:smoke` (23 checks, the real app in jsdom).

## Before you read the list

The tree I started from already contained the primitives — `Button`, `Field`,
`Section`, `Empty`, `Notice`, `Segmented`, `Tabs`, `Stat`, `CardTile`,
`plural`, `useClipPlayer`, `PlayButton`, `IconButton` — along with the CSS
extracted to `index.css` and the spacing/type/z-index tokens. **Nothing
imported any of it.** Every primitive was dead code, `spaces.jsx` still had
its own `CardTile`, and `Screen` had gained a `footer` prop nothing used.
This pass is the wiring: putting the call sites through the components and
deleting what they replaced.

## Measured

| | before | after |
|---|---:|---:|
| inline `style={{}}` | 167 | 35 |
| hand-written pluralisations | 44 | 0 |
| raw `className="at-btn"` | 100 | 12 |
| tab-strip copies | 4 | 1 (the component) |
| `CardTile` definitions | 2 | 1 |
| hand-built screen/sheet shells | 6 | 0 |
| `window.confirm`/`prompt` | 4 | 1 |
| glyph-only buttons | 3 | 0 |
| unreferenced CSS classes | 18 | 10 |
| CSS lines | 1,168 | 1,026 |

CSS 52.8 → 50.1 kB (9.79 → 9.46 kB gz); lazy chunk 64.9 → 59.6 kB.

## Shells

- Both hand-built `at-screen over` shells in TeachSpace (open deck, course
  view) are now `Screen`. They answer Escape and hide the floating chrome,
  which they did not before.
- All three `at-sheet` dialogs — the card editor, the bulk-add sheet and the
  live session builder — are `Screen` with the `footer` slot. `at-sheet`,
  `at-sheethead`, `at-sheetbody`, `at-sheetinner`, `at-sheetfoot` and
  `at-close` are gone from the stylesheet.
- `ItemsTab` had added its own Escape listener and body-scroll lock around a
  `Screen` that already owned both. Removed: one owner for one lock.
- The `Modal` and `LanguagePicker` aliases are deleted; both were thin
  wrappers around `Screen` and `LanguageRadio`.
- A smoke check opens the session builder and asserts it renders through the
  screen shell with its footer.

## Components

- **Tabs** — all three strips. Every one now reports `role="tab"`,
  `aria-selected` and `aria-current`; only one of the three did before.
- **CardTile** — the duplicate in `spaces.jsx` is deleted. Both card lists use
  the shared tile, with deck names supplied by one `deckTitlesFor` helper, so
  form counts are worked out once instead of two different ways.
- **Notice** — every error, warning and "Working…" line. The same failure used
  to read as a red toast on one screen and grey helper text on another.
- **Button / IconButton** — 88 buttons converted; 32 `<Icon>` children folded
  into the `icon` prop; 8 icon-only buttons became `IconButton`, which makes
  the accessible name mandatory. `"sm ghost"` and `"ghost sm"` can no longer
  both exist. The 12 left are `<label className="at-btn">` file inputs, which
  are labels rather than buttons.
- **Section** (7), **Field** (28), **Empty** (2), **Stat** (3), **Segmented**
  (4), **Lede** (4), **plural** (44).

## Spacing

`.at-hint` and `.at-field` carried margins that were wrong at the edges of a
container, which is what the 42 `marginTop: 0` and 13 `marginBottom: 0`
overrides existed to undo. Added `:first-child`/`:last-child` edge rules and
`at-mt1`…`at-mt6` utilities mapped to the existing scale, then removed the
overrides — 132 inline styles gone.

**One deliberate visual change:** the inline margins used nine values (4, 8,
10, 12, 14, 16, 18, 20, 22) for what the token scale expresses in six
(4/6/10/14/18/24). Snapping to the scale moves a few gaps by up to 2px.

## Smaller

- The language preference now has a control in Preferences, reusing
  `LanguageRadio`. It could previously only be set by a course, so someone
  studying two languages had no way to choose.
- `languageName` and `LanguageTag` moved from `spaces.jsx` to `shared.jsx`;
  the trainer had its own "not set" fallback.
- Glyph buttons (`‹ × ▶ ❚❚ ● ■`) now use `Icon`; the `⌫` key gained a label.
- `window.prompt` for bulk tagging and the leave-session `window.confirm` are
  in-app screens now. The one left is the import gate, which genuinely wants
  a blocking browser confirm before it merges a file.
- A second hardcoded "Arabic" string, in the review warning, now uses the
  language's own script label.
- 42 dead CSS rules removed across two sweeps.

## Not done

- ~12 chip groups are still hand-rolled `at-btn` toggles: the uniform ones
  converted to `Segmented`, the rest have per-site shapes (grammar dimensions,
  the multi-select of exercise types, the answer-choice control) and want
  reading rather than a regex.
- `at-hint` is down from 110 to 98 but still covers helper text and a few
  count lines; `Help`/`Meta` are exported and only lightly used.
- 20 `at-field` blocks remain where the label is not the first child.
- `SpaceFrame` and `Chrome` are not built: the Admin and Teach shells still
  repeat their tab-strip-plus-error-plus-busy header, and the three fixed
  overlays still have three separate `body.at-screening` hide rules.
- 35 inline styles remain, nearly all genuinely dynamic (computed colours,
  a conditional margin, `fontFamily` from the language pack).

---

# Second pass — the remaining items

Everything listed as "not done" above, except where noted at the end.

| | audit | after pass 1 | now |
|---|---:|---:|---:|
| inline `style={{}}` | 167 | 35 | 32 |
| `at-hint` uses | 110 | 98 | 13 |
| raw `at-chips` groups | 21 | 12 | 4 |
| raw `at-field` blocks | 50 | 20 | 8 |
| hand-built space/screen shells | 8 | 2 | 1 (the component) |
| `body.at-screening` hide rules | 8 | 5 | 1 |
| unreferenced CSS classes | 18 | 10 | 0 |
| CSS lines | 1,168 | 1,026 | 1,018 |

## Selection controls

The last 12 chip groups are converted. They needed reading rather than a
regex, and two needed `Segmented` to grow: a `disabled` prop (the answer
control greys out once an answer is checked) and `size={null}` for full-size
buttons.

- The answer-choice control, the card-kind picker, and the grammar-dimension
  pickers on the main form, on sub-forms, and in the teacher's editor —
  the last three keep their "tap again to clear an optional value" behaviour
  through `onChange`.
- Session length and duration, which are two `Segmented` sharing one
  `limitKind`: whichever is not chosen passes `value={null}`, so neither
  shows a selection it does not own.
- Cohesion, harakat, hamza, sounds, hints, the course language and the
  new-user role.
- Exercise types stay a multi-select — several can be on at once, so it is
  `Button`s with `aria-pressed` in a `at-segmented` group, not `Segmented`.

The four `at-chips` left are genuine button rows (record/upload, a list of
people to assign), not single-selects.

## Text

`at-hint` is down from 110 to 13, and the three that remain are a keyed list
item, a button class, and a prop. Everything else is `Help` (81), `Lede` (6)
or `Notice`. Helper text can now be restyled without touching every empty
state.

## Frames

- **SpaceFrame** — the Teaching and Admin shells were the same frame built
  twice: full-bleed screen, pending dialog, error line, busy line, tab strip,
  contents. One of the two did not show the busy line. Both now use it.
- **Chrome** — the brand, space switcher and corner menu are decided in one
  `{!inExercise && (...)}` block instead of three, and the three separate
  `body.at-screening` hide rules are one rule. There were six of these rules
  in total: three scattered ones and a consolidated block that duplicated
  them, so a change to one had no visible effect.
- 12 more `at-field` blocks converted, including every one whose label spans
  several lines. The 8 left have no label at all — they are spacing wrappers,
  which is a fair use of the class.

## Two things I broke and fixed

Both were caught by the build, but they are worth knowing about since the
same shape could recur:

- Converting the sounds toggle, my search for the end of a `at-chips` block
  ran past it and swallowed the Sounds control, its Test button and the whole
  Hints section. Rebuilt from the surrounding code; all 12 preference keys
  verified present afterwards.
- The `</p>` → `</Lede>` close-matching loop ran over `<Lede>` tags that
  already existed from the earlier onboarding conversion and re-closed two
  unrelated paragraphs. Repaired.

A third was subtler: a dead-rule sweep removed
`.at-cline:hover, .at-citem:hover { background: … }` because `at-citem` was
dead — taking a live `.at-cline` hover with it. Restored. Worth remembering
that a multi-selector rule is only dead if *every* selector is.

## Still not done

- 32 inline styles remain. They are dynamic: computed colours, a conditional
  margin, `fontFamily` from the language pack, a `minHeight`.
- 12 `at-btn` strings remain on `<label>` elements wrapping file inputs.
  These are labels, not buttons, so `Button` is the wrong component; they
  want a small `FileButton` if it is worth one.
- `Meta` is exported and still unused — the count lines it was meant for
  mostly became `plural()` inside other components.
