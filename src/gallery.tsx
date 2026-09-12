
type Node = React.ReactNode;

/* One place a component is used, as `npm run components` records it. */
interface Use {
  file: string;
  line: number;
  where: string;
}
/*
 * The component gallery.
 *
 * Every reusable piece in shared.tsx, rendered for real and labelled with
 * the name you would type to ask for it. Written against the live
 * components rather than described in prose, so it cannot quietly go out of
 * date the way a written list does: rename a prop and this stops looking
 * right, which is the point.
 *
 * It is a reading tool, not a test. Nothing here talks to the server, and
 * every handler is local, so clicking about in it changes nothing.
 */

import React, { useState } from "react";
import { COMPONENT_USES } from "./component-uses.js";
import { SCREEN_ELEMENTS, NAMING } from "./screen-elements.ts";
import { LANGUAGES } from "./languages.ts";
import {
  Button,
  CardReadout,
  CardTile,
  CheckList,
  ClipList,
  ConfirmModal,
  Empty,
  Field,
  FilterBar,
  FilterMenu,
  Help,
  Icon,
  IconButton,
  ItemList,
  KeysButton,
  LanguageRadio,
  LanguageTag,
  Lede,
  Meta,
  ModeSelector,
  Notice,
  PlayButton,
  Section,
  Segmented,
  Stat,
  Tabs,
  Tile,
  TileNote,
  narrowing,
  plural,
  useSnackbarState,
} from "./shared.tsx";

/* Every icon the set has, so a name can be picked by eye. Kept in step with
   Icon itself: a name missing from here renders as a blank square, which is
   visible rather than silent. */
const ICON_NAMES = [
  "add", "search", "close", "delete", "edit", "tune", "sort", "size", "check",
  "back", "save", "folder", "cards", "person", "group", "key", "download",
  "verify", "play", "pause", "view", "select", "school", "copy", "refresh",
  "mic", "remove", "chevronDown", "chevronUp", "menu", "help", "theme",
  "language", "lock",
];

const SAMPLE_CARD = {
  id: "sample", ar: "كِتَاب", en: "book", lat: "kitaab", note: "",
  lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  tags: ["Lesson 1"], clips: [], subs: [{ ar: "كُتُب", en: "books", lat: "kutub", clips: [] }],
};
/* The real pack, not a hand-written stand-in. A specimen with no font
   stack used to inherit an Arabic one from the stylesheet; nothing
   does now, so a specimen that wants the script has to name a
   language like the app does. */
const SAMPLE_LANG = LANGUAGES["ar-PS"];

/*
 * Where a component is used, in the app's own words.
 *
 * The generator records the file and the function a use sits inside,
 * which is the truth but not an answer to "where would I see this?".
 * This table turns each of those into the screen or section you would
 * open to look at it, grouped by the part of the app it belongs to.
 *
 * A name missing from here still appears — its function name, spaced out
 * and sentence-cased — under the part its file belongs to. That is worse
 * than a real name but better than a gap, and it means adding a screen
 * does not silently drop it from this list.
 */
const LEARN = "Learning — the student's app";
const TEACH = "Teaching";
const ADMIN = "Admin";
const START = "Signing in";
const PARTS = "Inside another component";

const PLACES: Record<string, [string, string]> = {
  /* The learner's app */
  ArabicTrainer: [LEARN, "The app around everything else"],
  AccountPanel: [LEARN, "Account settings"],
  AccountSettings: [LEARN, "Account settings"],
  CloseAccount: [LEARN, "Account settings · Closing your account"],
  ClaimAdmin: [LEARN, "Account settings · Becoming the administrator"],
  AppPreferences: [LEARN, "App preferences"],
  SettingsScreen: [LEARN, "App preferences"],
  CornerMenu: [LEARN, "The menu in the top right"],
  SpaceSwitch: [LEARN, "Switching between Learning, Teaching and Admin"],
  Guide: [LEARN, "How it works"],
  AfterAnswer: [LEARN, "A practice session · after answering"],
  AlsoBox: [LEARN, "A practice session · what else is worth knowing"],
  AudioPrompt: [LEARN, "A practice session · playing a recording"],
  Scene: [LEARN, "A practice session · a conversation"],
  SceneOrder: [LEARN, "A practice session · putting a scene in order"],
  ScenePart: [LEARN, "A practice session · playing a part"],
  TextChoices: [LEARN, "A practice session · choosing an answer from a few"],
  ManualSessionSheet: [LEARN, "Building a session by hand"],
  SavedSessionsSheet: [LEARN, "The sessions you kept"],
  SessionLanguages: [LEARN, "Starting a session · which language"],
  ItemsTab: [LEARN, "The Cards tab"],
  ItemSheet: [LEARN, "The Cards tab · one card's details"],
  CardScreen: [LEARN, "Opening a card from a tile"],
  ProgressTab: [LEARN, "The Progress tab"],
  ReviewItem: [LEARN, "The Progress tab · one card"],
  TagSection: [LEARN, "The Progress tab · one deck"],
  StudentCourses: [LEARN, "The Courses tab"],
  ArabicField: [LEARN, "Writing in the language you are learning"],
  RecordingsField: [LEARN, "The recordings on a card"],
  ClipPlayer: [LEARN, "Playing a recording"],
  BulkAddSheet: [LEARN, "Adding several cards at once"],
  ChunkFallback: [LEARN, "While a screen is still loading"],

  /* Teaching */
  TeachSpace: [TEACH, "The Teaching space"],
  CoursesPage: [TEACH, "The Courses tab"],
  CourseSettings: [TEACH, "Course settings"],
  DeckEditor: [TEACH, "Deck settings"],
  DeckPicker: [TEACH, "Choosing which decks"],
  CardEditor: [TEACH, "Editing a card"],
  Alternatives: [TEACH, "Editing a card · several accepted answers"],
  ScriptAnswers: [TEACH, "Editing a card · each answer and how it is said"],
  WordsUsed: [TEACH, "Editing a card · the words a phrase teaches"],
  ScriptInput: [TEACH, "Editing a card · writing in the language"],
  Recordings: [TEACH, "Editing a card · its recordings"],
  RecordingScreen: [TEACH, "Editing a card · making a recording"],
  ContextReport: [TEACH, "A deck · how much of it appears in phrases"],
  InContext: [TEACH, "The In context tab"],
  TryExercises: [TEACH, "A card · trying an exercise on it"],
  SelectionBar: [TEACH, "When several cards are selected"],
  CodeBox: [TEACH, "A code to hand out"],

  /* Admin */
  AdminSpace: [ADMIN, "The Admin space"],
  BackupScreen: [ADMIN, "App · backing up and restoring"],
  ClearScreen: [ADMIN, "App · clearing the site"],

  /* Before you are signed in */
  Onboarding: [START, "Signing in and joining a course"],

  /* Components built out of other components. Where you see them depends
     on where that one is used, which its own entry answers. */
  Button: [PARTS, "A button"],
  IconButton: [PARTS, "An icon button"],
  PlayButton: [PARTS, "A play button"],
  ClipRow: [PARTS, "A recording in a list"],
  CardReadout: [PARTS, "A card's details"],
  ItemList: [PARTS, "A searchable list"],
  FilterBar: [PARTS, "What Sort or Filter opens onto"],
  FilterMenu: [PARTS, "One filter, in the toolbar"],
  Tabs: [PARTS, "A row of tabs"],
  Screen: [PARTS, "A full screen"],
  SpaceFrame: [PARTS, "The Teaching and Admin frame"],
  Snackbar: [PARTS, "The message that appears and goes"],
  useSnackbarState: [PARTS, "The message that appears and goes"],
  Modal: [PARTS, "A box asking you to confirm"],
};

/* Not in the table: say something readable rather than nothing, and put
   it under whichever part of the app its file belongs to. */
const FILE_PART: Record<string, string> = {
  "ArabicTrainer.tsx": LEARN,
  "spaces.tsx": TEACH,
  "shared.tsx": PARTS,
  "gallery.tsx": ADMIN,
};

export function placeOf(use: Use) {
  const known = PLACES[use.where];
  if (known) return { part: known[0], name: known[1], known: true };
  const spaced = String(use.where || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
  return { part: FILE_PART[use.file] || LEARN, name: spaced || "Somewhere in the app", known: false };
}

/* Every place it is used, gathered by part of the app. Several uses in
   one place become one line with a count, because "six times on the
   preferences screen" is the useful shape, not six identical rows. */
function groupUses(uses: Use[]) {
  const byPart: Map<string, Map<string, number>> = new Map();
  for (const use of uses) {
    const { part, name } = placeOf(use);
    if (!byPart.has(part)) byPart.set(part, new Map());
    const places = byPart.get(part) || new Map();
    places.set(name, (places.get(name) || 0) + 1);
  }
  /* A fixed order, so the list reads the same way every time and the
     student's app comes first. */
  const order = [LEARN, TEACH, ADMIN, START, PARTS];
  return order
    .filter((part) => byPart.has(part))
    .map((part) => ({
      part,
      places: [...(byPart.get(part) || new Map()).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    }));
}

function Uses({ name }: { name: string }) {
  const uses = COMPONENT_USES[name];
  /* Hooks and helpers have a row but no call sites gathered for them. */
  if (!uses) return null;
  if (!uses.length) {
    return <Meta>Nothing uses it yet.</Meta>;
  }

  return (
    <details className="at-galuses">
      <summary>
        Where you'll see it <span className="at-galcount">{uses.length}</span>
      </summary>
      {groupUses(uses).map((group) => (
        <div className="at-galpart" key={group.part}>
          <div className="at-galpartname">{group.part}</div>
          <ul className="at-galwheres">
            {group.places.map((place) => (
              <li key={place.name}>
                <span className="at-galwhere">{place.name}</span>
                {place.count > 1 ? <span className="at-galtimes">{place.count}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

/*
 * Numbers to point at.
 *
 * Every entry gets one, and every specimen inside it gets the entry's
 * number and its own — 12, 12.1, 12.2 — so a change can be asked for by
 * number instead of by describing which of four buttons is meant.
 *
 * Counted during the render rather than written down beside each entry:
 * hand-numbered, inserting one component in the middle would renumber
 * everything below it by hand, which is the kind of edit that gets done
 * wrong once and then trusted. The counter is made fresh at the top of
 * each render, so a second render counts from one again and the numbers
 * are the document order every time.
 */
/* The running numbers for a row and the specimens inside it. */
interface Tally {
  /** Which row, counting from the top of the gallery. */
  row: number;
  /** Which specimen inside that row. */
  n: number;
}

const GalleryCount = React.createContext<Tally | null>(null);

function Row({ name, what, note, children }: { name: string; what?: Node; note?: Node; children?: Node }) {
  const uses = COMPONENT_USES[name];
  const tally = React.useContext(GalleryCount);
  const id = tally ? (tally.row += 1) : 0;
  /* Specimens number within their entry, so the count restarts here — and
     it has to be a new object every render, not a remembered one: kept,
     it carried on counting from wherever the last render left it, and the
     first specimen was numbered 1.3 after two re-renders. */
  const spec = { n: 0, row: id };
  return (
    <div className="at-galrow" id={`c${id}`}>
      <div className="at-galhead">
        <span className="at-galid">{id}</span>
        <code className="at-galname">{name}</code>
        {uses ? <span className="at-galtotal">{plural(uses.length, "use")}</span> : null}
      </div>
      {what ? <Help className="at-mb2">{what}</Help> : null}
      <GalleryCount.Provider value={spec}>
        <div className="at-galdemo">{children}</div>
      </GalleryCount.Provider>
      {note ? <Meta>{note}</Meta> : null}
      <Uses name={name} />
    </div>
  );
}

/* A labelled specimen inside a row, so a variant can be pointed at by
   name rather than by position. */
function V({ label, children, wide }: { label?: Node; children?: Node; wide?: boolean }) {
  const spec = React.useContext(GalleryCount);
  const id = spec && spec.row ? `${spec.row}.${(spec.n += 1)}` : "";
  return (
    <div className={`at-galv${wide ? " wide" : ""}`}>
      <div className="at-galvlabel">
        {id ? <span className="at-galid sub">{id}</span> : null}
        {label}
      </div>
      <div className="at-galvbody">{children}</div>
    </div>
  );
}


export function ScreenElements() {
  return (
    <div className="at-els">
      <Lede>
        Every named piece of a question and an answer. Ask for a change by
        name — “make question-prompt-text bigger” — rather than by
        description.
      </Lede>
      <div className="at-elnaming">
        {NAMING.map(([k, what]) => (
          <p key={k}>
            <code>{k}</code> {what}
          </p>
        ))}
        <p className="at-hint">
          A block holding something other than words names what it holds
          instead: answer-box holds answer-input, never an answer-box-text.
          Names describe the role, not the wording, so rewriting a sentence
          leaves its name alone.
        </p>
      </div>
      {SCREEN_ELEMENTS.map(([screen, rows]) => (
        <section className="at-elgroup" key={screen}>
          <p className="at-elscreen">{screen}</p>
          {rows.map(([name, what, example]) => (
            <div className="at-elrow" key={name}>
              <code className="at-elname">{name}</code>
              <p className="at-elwhat">{what}</p>
              {example ? <p className="at-elexample">{example}</p> : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function ComponentGallery() {
  /* Its own, not the app's: a snackbar raised from here should behave
     exactly like a real one — appear at the foot of the screen, be
     replaced by the next, and go on its own — without any of it being
     mistaken for something the app actually did. */
  const demo = useSnackbarState();
  const [keys, setKeys] = useState(false);
  const [order, setOrder] = useState("added");
  const [only, setOnly] = useState("any");
  const [maker, setMaker] = useState("");
  const [seg, setSeg] = useState("on");
  const [segBig, setSegBig] = useState("b");
  const [checked, setChecked] = useState(["one"]);
  const [tab, setTab] = useState("first");
  const [lang, setLang] = useState("ar-PS");
  const [mode, setMode] = useState("learn");
  const [modalOpen, setModalOpen] = useState(false);
  const [listItems] = useState(() =>
    ["Lesson 1", "Lesson 2", "Lesson 3"].map((t, i) => ({ id: `d${i}`, title: t })),
  );

  /* Fresh every render, so the numbers are always document order. */
  const tally = { row: 0, n: 0 };

  return (
    <GalleryCount.Provider value={tally}>
    <div className="at-gallery">
      {modalOpen && (
        <ConfirmModal
          title="A confirm modal"
          confirmLabel="Do it"
          danger
          body={<p>Nothing happens — this is the gallery.</p>}
          onCancel={() => setModalOpen(false)}
          onConfirm={() => setModalOpen(false)}
        />
      )}

      <Help>
        Every reusable component, rendered live. The name in <code>code</code> is what to
        call it when asking for a change — “put it in a Section with a Help under it” is
        unambiguous in a way that “a heading and some grey text” is not.
      </Help>

      {/* ---- text ---- */}
      <p className="at-eyebrow at-mt5">Text</p>

      <Row name="Lede" what="The intro paragraph under a title.">
        <V label="default"><Lede>Learn a language a card at a time.</Lede></V>
      </Row>

      <Row name="Help" what="Helper text under a control. The workhorse.">
        <V label="default"><Help>Shown once, and never readable again.</Help></V>
      </Row>

      <Row
        name="Meta"
        what="Small print beside content."
        note="Unused in the app. Available rather than established — its API is the most likely to need something adding."
      >
        <V label="default"><Meta>Taken 3 March, 09:41</Meta></V>
      </Row>

      <Row
        name="Notice"
        what="Errors, warnings, success and busy lines."
        note="Renders nothing when its children are empty, so it is safe to leave in the tree unconditionally."
      >
        <V label='kind="info"'><Notice kind="info">Something worth knowing.</Notice></V>
        <V label='kind="error"'><Notice kind="error">That sign-in key isn't recognised.</Notice></V>
        <V label='kind="warn"'><Notice kind="warn">This cannot be undone.</Notice></V>
        <V label='kind="ok"'><Notice kind="ok">Saved.</Notice></V>
        <V label='kind="busy"'><Notice kind="busy">Working…</Notice></V>
      </Row>

      <Row
        name="Snackbar"
        what="A sentence that appears, is read, and goes."
        note="Raised with useSnackbar() from anywhere under a SnackbarProvider, or with useSnackbarState() by whichever component renders it. It never asks for anything and losing it costs nothing — a message that must be acknowledged is a ConfirmModal, and one that must stay is a Notice."
      >
        <V label="press one, and watch the foot of the screen" wide>
          <div className="at-row">
            <Button size="sm" onClick={() => demo.show("Kitaab saved", "good")}>
              good
            </Button>
            <Button size="sm" onClick={() => demo.show("That card is locked", "warn")}>
              warn
            </Button>
            <Button size="sm" onClick={() => demo.show("Nothing new", "info")}>
              info
            </Button>
          </div>
        </V>
      </Row>

      {/* ---- controls ---- */}
      <p className="at-eyebrow at-mt5">Controls</p>

      <Row
        name="Button"
        what="Every button in the app."
        note="Pass icon= rather than an <Icon> child, so the spacing stays consistent."
      >
        <V label='variant="default"'><Button>Default</Button></V>
        <V label='variant="primary"'><Button variant="primary">Primary</Button></V>
        <V label='variant="ghost"'><Button variant="ghost">Ghost</Button></V>
        <V label='variant="danger"'><Button variant="danger">Danger</Button></V>
        <V label='size="sm"'><Button size="sm">Small</Button></V>
        <V label='icon="add"'><Button icon="add">With icon</Button></V>
        <V label="disabled"><Button disabled>Disabled</Button></V>
        <V label="wide" wide><Button wide>Wide</Button></V>
      </Row>

      <Row
        name="IconButton"
        what="An icon on its own."
        note="label is required — it is the only name a screen reader has to go on. ghost is the same outline-without-fill as Button's, for an icon standing in a row beside ghost buttons — the hint button beside “I don't know”."
      >
        <V label="default"><IconButton icon="edit" label="Edit" /></V>
        <V label="danger"><IconButton icon="delete" label="Delete" danger /></V>
        <V label="ghost"><IconButton icon="help" label="Show meaning" ghost /></V>
      </Row>

      <Row
        name="FilterBar"
        what="The panel a list's Sort or Filter button opens onto: how to order it, or what to leave out."
        note="Goes in one of ItemList's menus, as its content — ItemList owns the button and keeps one panel open at a time. Give a group a `quiet` value to say which setting counts as not narrowing, and pass the groups through narrowing() to get the count the button carries. A group with `custom` draws that instead of the buttons, for a choice a few buttons cannot say; `wide` gives it a line of its own."
      >
        <V label="two groups" wide>
          <FilterBar
            note="3 of 12"
            groups={[
              {
                key: "order",
                label: "Sort",
                value: order,
                onChange: setOrder,
                quiet: "added",
                options: [
                  { value: "added", label: "Added" },
                  { value: "changed", label: "Changed" },
                ],
              },
              {
                key: "only",
                label: "Recordings",
                value: only,
                onChange: setOnly,
                quiet: "any",
                options: [
                  { value: "any", label: "Any" },
                  { value: "with", label: "With" },
                  { value: "without", label: "Without" },
                ],
              },
            ]}
          />
        </V>
      </Row>

      <Row
        name="FilterMenu"
        what="One filter, narrow enough to sit beside a search box."
        note="Goes in ItemList's tools slot, where it takes the width of an icon until it is pressed. FilterBar is the answer when a list wants several pickers at once; this is the answer when it wants one and the choices are a list rather than a few — every teacher who has made a deck, say, which Segmented would wrap into four rows. `quiet` is the value that means everything, and the button lights while anything else is picked."
      >
        <V label="press it">
          <FilterMenu
            icon="person"
            label="Filter by who made it"
            value={maker}
            onChange={setMaker}
            options={[
              { value: "", label: "Anyone", note: "12" },
              { value: "sara", label: "Sara", note: "7" },
              { value: "omar", label: "Omar Haddad", note: "5" },
            ]}
          />
        </V>
      </Row>

      <Row
        name="KeysButton"
        what="Opens the on-screen keys, from inside the field it types into."
        note="Positioned by .at-inputwrap, which also reserves the room for it — put it inside one, next to the input. It sits at the end of the line, so add rtl to the wrapper for a right-to-left script and the button moves to the left with the padding."
      >
        <V label="left-to-right — the button takes the right" wide>
          <div className="at-inputwrap">
            <input className="at-input" defaultValue="house" readOnly />
            <KeysButton on={keys} onClick={() => setKeys((v) => !v)} />
          </div>
        </V>
        <V label='right-to-left — add "rtl" to the wrapper' wide>
          <div className="at-inputwrap rtl">
            <input className="at-input" defaultValue="كِتَاب" dir="rtl" readOnly />
            <KeysButton on={keys} onClick={() => setKeys((v) => !v)} />
          </div>
        </V>
      </Row>

      <Row
        name="Segmented"
        what="Pick one of a few."
        note="For picking several this is the wrong component — use CheckList."
      >
        <V label='size="sm" (default)' wide>
          <Segmented
            options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]}
            value={seg}
            onChange={setSeg}
            label="A choice"
          />
        </V>
        <V label="size={null} — full-width" wide>
          <Segmented
            options={[{ value: "a", label: "One" }, { value: "b", label: "Two" }, { value: "c", label: "Three" }]}
            value={segBig}
            onChange={setSegBig}
            size={null}
            label="A bigger choice"
          />
        </V>
        <V label="disabled" wide>
          <Segmented
            options={[{ value: "a", label: "One" }, { value: "b", label: "Two" }]}
            value="a"
            onChange={() => {}}
            disabled
            label="Unavailable"
          />
        </V>
      </Row>

      <Row
        name="Field"
        what="A labelled control."
        note="spaces.tsx imports it as Field; the trainer imports it as FormField, because the trainer has an unrelated Field of its own."
      >
        <V label="label + children" wide>
          <Field label="Their name">
            <input className="at-input" defaultValue="Sara" readOnly />
          </Field>
        </V>
        <V label="hint + optional" wide>
          <Field label="A note" hint="Only you see this." optional>
            <input className="at-input" placeholder="Anything" readOnly />
          </Field>
        </V>
      </Row>

      <Row name="CheckList" what="Pick several.">
        <V label="options + chosen" wide>
          <CheckList
            options={[
              { id: "one", title: "Lesson 1", note: "12 cards" },
              { id: "two", title: "Lesson 2" },
            ]}
            chosen={checked}
            onToggle={(id) =>
              setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.concat([id])))
            }
            empty="Nothing to choose."
          />
        </V>
      </Row>

      <Row name="LanguageRadio" what="A proper radio list of languages.">
        <V label="languages + value" wide>
          <LanguageRadio
            languages={{
              "ar-PS": { id: "ar-PS", name: "Arabic" },
              "vi-Hue": { id: "vi-Hue", name: "Vietnamese (Huế)" },
              "he-IL": { id: "he-IL", name: "Hebrew (Modern)" },
            }}
            value={lang}
            onChange={setLang}
            name="gallery-lang"
          />
        </V>
      </Row>

      <Row name="ModeSelector" what="A drop-down of the spaces." note="Nothing calls it — the app uses the icon strip in the corner instead. Its labels are a fixed map inside shared.tsx, so it only knows learn, teach and admin.">
        <V label="modes" wide>
          <ModeSelector mode={mode} modes={["learn", "teach", "admin"]} onChange={setMode} />
        </V>
      </Row>

      {/* ---- layout ---- */}
      <p className="at-eyebrow at-mt5">Layout and frames</p>

      <Row name="Section" what="A titled block. Replaces a hand-built eyebrow and lede.">
        <V label="title + lede + count + action" wide>
          <Section
            title="People"
            count={3}
            lede="Everyone with an account on this site."
            action={<Button size="sm" icon="add">Add</Button>}
          >
            <Help>Whatever the section holds goes here.</Help>
          </Section>
        </V>
      </Row>

      <Row name="Tabs" what="The tab strip. Handles role, aria-selected and aria-current.">
        <V label="tabs = [key, label, icon]" wide>
          <Tabs
            tabs={[["first", "First", "school"], ["second", "Second", "folder"], ["third", "Third", "tune"]]}
            value={tab}
            onChange={setTab}
            label="A tab strip"
          />
        </V>
      </Row>

      <Row
        name="Screen"
        what="The one full-screen shell: portals to the app root, owns Escape, hides the app chrome while open."
        note="Not shown live — it would cover this page. Props: title, onBack, action, footer, backLabel, children."
      >
        <V label="what it looks like" wide>
          <div className="at-galfake">
            <div className="at-galfakehead">
              <span><Icon name="back" size={16} /> Back</span>
              <strong>Edit card</strong>
              <Button size="sm" variant="primary">Save</Button>
            </div>
            <Help>…the screen's children…</Help>
          </div>
        </V>
      </Row>

      <Row
        name="SpaceFrame"
        what="The Teaching and Admin shells: full-bleed screen, dialog slot, error line, busy line, tabs, contents."
        note="You are inside one right now. Props: tabs, tab, onTab, error, busy, label, dialog, children."
      />

      <Row name="Empty" what="The nothing-here state.">
        <V label="title + children + action" wide>
          <Empty title="No decks yet" action={<Button size="sm" icon="add">New deck</Button>}>
            A deck is a set of cards you hand to a course.
          </Empty>
        </V>
      </Row>

      <Row name="Stat" what="One big number.">
        <V label="default"><Stat value="128" label="Cards" /></V>
        <V label="big"><Stat value="12" label="Due today" big /></V>
      </Row>

      {/* ---- lists and tiles ---- */}
      <p className="at-eyebrow at-mt5">Lists and tiles</p>

      <Row
        name="Tile"
        what="The generic deck and course tile."
        note="Moved into shared.tsx — it used to live in spaces.tsx, so the one library the docs point at did not actually hold it."
      >
        <V label="title + meta + actions + footer" wide>
          <Tile
            title="Lesson 1"
            meta="12 cards"
            onOpen={() => {}}
            actions={<IconButton icon="edit" label="Edit" />}
            footer={<TileNote live>In Arabic 101</TileNote>}
          />
        </V>
      </Row>

      <Row name="TileNote" what="The line under a tile: whether anyone can see it.">
        <V label="live"><TileNote live>In Arabic 101</TileNote></V>
        <V label="not live"><TileNote>Personal — not in a course</TileNote></V>
      </Row>

      <Row name="CardTile" what="One card tile, for the learner's list and the teacher's alike.">
        <V label="card + lang + meta" wide>
          <CardTile card={SAMPLE_CARD} lang={SAMPLE_LANG} meta="Lesson 1" showLat />
        </V>
      </Row>

      <Row name="CardReadout" what="A card and its forms, read-only. Falls back to the default language pack when lang is left off.">
        <V label="card + lang" wide>
          <CardReadout card={{ ...SAMPLE_CARD, decks: ["d1"] }} decks={[{ id: "d1", title: "Lesson 1" }]} />
        </V>
      </Row>

      <Row
        name="ItemList"
        what="The standard list frame: New button, search and tile size on one row; Select and the menus on the next; bulk actions, empty state, paging at 120."
        note="match is (item, lowercasedQuery) => boolean. bulkActions is [{ label, danger, onClick(ids) }]. menus is [{ key, label, icon, busy, content }] — one open at a time, drawn under the row. resizable adds the size button, which only a grid of tiles has anything to do with."
      >
        <V label="items + renderItem" wide>
          <ItemList
            noun="deck"
            plural="decks"
            items={listItems}
            itemKey={(d) => d.id}
            match={(d, q) => d.title.toLowerCase().includes(q)}
            size="small"
            resizable
            menus={[
              {
                key: "sort",
                label: "Sort",
                icon: "sort",
                busy: narrowing([{ key: "order", value: order, quiet: "added" }]),
                content: (
                  <FilterBar
                    groups={[
                      {
                        key: "order",
                        label: "Sort",
                        value: order,
                        onChange: setOrder,
                        quiet: "added",
                        options: [
                          { value: "added", label: "Added" },
                          { value: "changed", label: "Changed" },
                        ],
                      },
                    ]}
                  />
                ),
              },
            ]}
            renderItem={(d) => <Tile title={d.title} meta="12 cards" />}
            empty={<Empty title="No decks">Nothing here yet.</Empty>}
          />
        </V>
      </Row>

      {/* ---- dialogs and audio ---- */}
      <p className="at-eyebrow at-mt5">Dialogs and audio</p>

      <Row
        name="ConfirmModal"
        what="Asking before something irreversible."
        note="confirmWord makes the person type a word before the button enables. Prefer this over window.confirm."
      >
        <V label="open it"><Button onClick={() => setModalOpen(true)}>Show the modal</Button></V>
      </Row>

      <Row
        name="PlayButton"
        what="Playback control for one recording."
        note="No direct uses — it is what ClipList renders inside. States: idle, loading, playing, missing."
      >
        <V label='state="idle"'><PlayButton state="idle" onClick={() => {}} /></V>
        <V label='state="loading"'><PlayButton state="loading" onClick={() => {}} /></V>
        <V label='state="playing"'><PlayButton state="playing" onClick={() => {}} /></V>
      </Row>

      <Row
        name="ClipList"
        what="A list of recordings with playback."
        note="Uses useClipPlayer, which owns the Audio element and revokes its object URL — build one of these rather than a new Audio()."
      >
        <V label="one clip — its audio is not in this gallery" wide>
          <ClipList clips={["a".repeat(64)]} onChange={() => {}} load={async () => null} />
        </V>
        <V label="no clips"><Meta>Renders nothing at all when the list is empty.</Meta></V>
      </Row>

      {/* ---- odds and ends ---- */}
      <p className="at-eyebrow at-mt5">Odds and ends</p>

      <Row
        name="Icon"
        what="Every icon in the set. Use these rather than glyph characters."
        note={`${ICON_NAMES.length} names. Pass name and an optional size (20 by default).`}
      >
        <V label="all names" wide>
          <div className="at-galicons">
            {ICON_NAMES.map((n) => (
              <div key={n} className="at-galicon">
                <Icon name={n} />
                <code>{n}</code>
              </div>
            ))}
          </div>
        </V>
      </Row>

      <Row name="LanguageTag" what="Naming a language, including the case where there isn't one.">
        <V label="a language">
          <LanguageTag languages={{ "ar-PS": { name: "Arabic" } }} id="ar-PS" />
        </V>
        <V label="not set"><LanguageTag languages={{}} id="" /></V>
      </Row>

      <Row
        name="plural(n, noun)"
        what="Counting, in one place."
        /* Quoted on purpose: the note shows the code this helper replaces. */
        // eslint-disable-next-line no-template-curly-in-string
        note="Use it instead of writing ${n} card${n === 1 ? '' : 's'}."
      >
        <V label="0 / 1 / 3">
          <Help>
            {plural(0, "card")} · {plural(1, "card")} · {plural(3, "card")}
          </Help>
        </V>
      </Row>

      <Row
        name="useSnackbar()"
        what="The way anything under a SnackbarProvider raises one: show(message, kind)."
        note='A hook. Outside a provider it is a no-op rather than a crash — which is why the buttons above use useSnackbarState() instead, so they work wherever this gallery is read.'
      />

      <Row
        name="useSnackbarState({ dwell })"
        what="The state behind the pill, for whichever component hosts it: { show, dismiss, node, current }."
        note="A hook. Render node once, near the end of the tree; the trainer does, and passes show down through SnackbarProvider."
      />

      <Row
        name="useLiveRefresh(fn, everyMs)"
        what="Refresh on focus, on visibility change, and on an interval."
        note="A hook, so nothing to show. Default interval is 45 seconds."
      />

      <Row
        name="useClipPlayer(load)"
        what="Owns the Audio element, the object URL, and the loading and playing states."
        note="A hook. Revokes its URL on unmount — the leak it exists to prevent is one object URL per clip."
      />

      {demo.node}
    </div>
    </GalleryCount.Provider>
  );
}
