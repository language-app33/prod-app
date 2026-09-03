# UI components

Everything reusable lives in `src/shared.jsx`. Usage counts are from the app
files (`ArabicTrainer.jsx` + `spaces.jsx`) at the time of writing — they show
how established each piece is, not how important it is.

**When asking for UI changes, the useful shorthand is the component name.**
"Put it in a Section with a Help under it" is unambiguous; "add a heading and
some grey text" is not.

**Rule of thumb: if something here fits, use it rather than raw markup.** Two
implementations of one thing is the failure mode this library exists to
prevent — it is how the student's card tile and the teacher's came to show
different information from the same data.

---

## Layout and frames

### `Screen` — 21 uses
The one full-screen shell. Portals into `.at`, owns Escape (only the topmost
open screen responds), and locks body scroll while open. Every full-screen
flow goes through this: there is no second way to make one.

```jsx
<Screen title="Edit card" onBack={close} action={<Button>Save</Button>} footer={<>…</>}>
```
`title, onBack, action, footer, backLabel="Back", children`

`footer` is a sticky bar at the bottom — use it for the primary action of a
form rather than putting buttons in the flow.

### `SpaceFrame` — 2 uses
The Teaching and Admin shells. Full-bleed screen, pending dialog, error line,
busy line, tab strip, contents.

`tabs, tab, onTab, error, busy, label="Section", dialog, children`

### `Section` — 7 uses
A titled block. Replaces the hand-built eyebrow-plus-lede opener.

`title, count, lede, action, children, className`

### `Tabs` — 1 use (inside `SpaceFrame`; the trainer uses it directly too)
`tabs` is an array of `[key, label, iconName]`. Handles `role="tab"`,
`aria-selected` and `aria-current` so you don't have to.

`tabs, value, onChange, label="Section"`

---

## Text

Each has one job. Reaching for the wrong one is how `at-hint` ended up doing
eight jobs and became impossible to restyle.

| Component | Use for | Uses |
|---|---|---|
| `Lede` | the intro paragraph under a title | 6 |
| `Help` | helper text under a control | 83 |
| `Meta` | small print beside content | 0 |
| `Notice` | errors, warnings, success, busy | 12 |

`Notice` takes `kind="info" | "error" | "warn" | "ok" | "busy"` and renders
nothing when its children are empty — so `<Notice kind="error">{error}</Notice>`
is safe to leave in the tree unconditionally.

`Meta` is unused. It exists for count lines that mostly became `plural()`
instead; treat it as available rather than established.

---

## Controls

### `Button` — 90 uses
`variant="default" | "primary" | "ghost" | "danger"`, `size="sm"`, `wide`,
`icon="add"`, `iconSize`, plus anything a `<button>` takes.

Pass `icon` rather than an `<Icon>` child — that way the spacing is consistent.

### `IconButton` — 12 uses
An icon-only button. `label` is **required** and becomes the accessible name.

`icon, label, danger, className, ...rest`

### `Segmented` — 17 uses
Pick one from a few. Reports `aria-pressed`.

```jsx
<Segmented
  options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]}
  value={current} onChange={set} label="Grouping"
/>
```
`options, value, onChange, size="sm", label, disabled`

Options may be `{value, label}` or bare values. `size={null}` gives full-size
buttons. For **multi-select**, this is the wrong component — use `CheckList`,
or `Button`s with `aria-pressed` in a `.at-segmented` wrapper.

### `Field` / `FormField` — 20 + 28 uses
A labelled control. Same component: `spaces.jsx` imports it as `Field`, the
trainer as `FormField` (it has its own unrelated `Field`).

`label, hint, optional, htmlFor, children, className`

### `CheckList` — 4 uses
Pick several. `options, chosen, onToggle, empty`

### `LanguageRadio` — 4 uses
A proper radio list of languages. `languages, value, onChange, label, name`

---

## Lists and tiles

### `ItemList` — 8 uses
The standard list frame: New button, search, Select mode, bulk-action tray,
empty state, and paging at 120 items.

`noun, plural, items, itemKey, match, size="large"|"small", onNew, renderItem,
selected, onSelectedChange, bulkActions, filters, count, empty, busy`

`match` is `(item, lowercasedQuery) => boolean`. `bulkActions` is
`[{ label, danger, onClick(ids) }]`.

### `CardTile` — 2 uses
One card tile for both the learner's and the teacher's lists.

`card, lang, deckTitles, showLat, meta, actions, onClick`

### `Tile` — 6 uses
The generic deck/course tile. `title, meta, onOpen, actions, footer`

### `CardReadout` — 3 uses
Read-only view of a card and its forms. `card, lang, decks`

---

## Dialogs

### `ConfirmModal` — 10 uses
`title, body, confirmLabel, confirmWord, busy, danger=true, onCancel, onConfirm`

`confirmWord` makes the person type a word before the button enables — for
things that can't be undone.

Prefer this over `window.confirm`. The one remaining `window.confirm` is the
import gate, which genuinely wants a blocking browser dialog.

---

## Audio

### `useClipPlayer(load)` — the hook
Owns the `Audio` element, the object URL, and the loading/playing/missing
states. Revokes its URL on unmount. Use this rather than a new `Audio()`:
leaking one object URL per clip is a bug this hook exists to prevent.

### `PlayButton` — 0 direct uses (used inside `ClipList`)
`state, onClick, className, label`

### `ClipList` — 2 uses
A list of recordings with playback. `clips, onChange, load`

---

## Odds and ends

- **`Icon`** — 22 uses. `name, size=20`. Available names: `add, search, close,
  delete, edit, tune, check, back, save, folder, cards, person, group, key,
  download, verify, play, pause, view, select, school, copy, refresh, mic,
  remove, chevronDown, chevronUp, menu, help, theme, language, lock`.
  Use these rather than glyph characters.
- **`plural(n, noun)`** — `plural(3, "card")` → `"3 cards"`. Use it instead of
  writing `${n} card${n === 1 ? "" : "s"}`.
- **`languageName(languages, id)`** / **`LanguageTag`** — one place that knows
  how to name a language, including the "not set" case.
- **`useLiveRefresh(fn, everyMs = 45000)`** — refresh on focus, on visibility
  change, and on an interval.
- **`ModeSelector`** — 0 uses. Present and working, but nothing calls it.
- **`SpaceFrame`, `Empty`, `Stat`** are established but lightly used, so
  their APIs are the most likely to need a prop adding.

---

## Styling

`src/index.css` holds everything, with design tokens at the top.

- **Spacing:** `--s1: 4px` · `--s2: 6` · `--s3: 10` · `--s4: 14` · `--s5: 18` ·
  `--s6: 24`. Utilities `at-mt1`…`at-mt6`, `at-mb2`, `at-mb3`.
- **Don't write inline margins.** Containers already zero the margins of their
  first and last children, so `marginTop: 0` is almost never needed. The 32
  inline styles that remain are dynamic values (computed colours, a font stack
  from the language pack).
- Type scale is `--fs-xs` … `--fs-xl`; z-index layers are `--z-*`.
- Every `at-` class in the stylesheet is currently referenced by something. If
  you delete markup, delete its CSS — and note that a multi-selector rule is
  only dead if *every* selector in it is.

---

## Keeping this accurate

This file drifts the moment components change. When we add, rename or remove
one, update it in the same change — and if it's in the Project knowledge,
re-upload it. A stale list is worse than none, because it will confidently
point at something that no longer exists.
