/*
 * The component gallery.
 *
 * Every reusable piece in shared.jsx, rendered for real and labelled with
 * the name you would type to ask for it. Written against the live
 * components rather than described in prose, so it cannot quietly go out of
 * date the way a written list does: rename a prop and this stops looking
 * right, which is the point.
 *
 * It is a reading tool, not a test. Nothing here talks to the server, and
 * every handler is local, so clicking about in it changes nothing.
 */

import React, { useState } from "react";
import {
  Button,
  CardReadout,
  CardTile,
  CheckList,
  ClipList,
  ConfirmModal,
  Empty,
  Field,
  Help,
  Icon,
  IconButton,
  ItemList,
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
  plural,
} from "./shared.jsx";

/* Every icon the set has, so a name can be picked by eye. Kept in step with
   Icon itself: a name missing from here renders as a blank square, which is
   visible rather than silent. */
const ICON_NAMES = [
  "add", "search", "close", "delete", "edit", "tune", "check", "back", "save",
  "folder", "cards", "person", "group", "key", "download", "verify", "play",
  "pause", "view", "select", "school", "copy", "refresh", "mic", "remove",
  "chevronDown", "chevronUp", "menu", "help", "theme", "language", "lock",
];

const SAMPLE_CARD = {
  id: "sample", ar: "كِتَاب", en: "book", lat: "kitaab", note: "",
  lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  tags: ["Lesson 1"], clips: [], subs: [{ ar: "كُتُب", en: "books", lat: "kutub", clips: [] }],
};
const SAMPLE_LANG = { id: "ar-PS", name: "Arabic", direction: "rtl", fontStack: undefined };

/* One entry per component: what it is called, what it is for, and the
   variants worth seeing side by side. `note` carries the thing you would
   otherwise learn by reading the source. */
function Row({ name, uses, what, note, children }) {
  return (
    <div className="at-galrow">
      <div className="at-galhead">
        <code className="at-galname">{name}</code>
        {typeof uses === "number" ? (
          <span className="at-galuses">{plural(uses, "use")}</span>
        ) : null}
      </div>
      {what ? <Help className="at-mb2">{what}</Help> : null}
      <div className="at-galdemo">{children}</div>
      {note ? <Meta>{note}</Meta> : null}
    </div>
  );
}

/* A labelled specimen inside a row, so a variant can be pointed at by
   name rather than by position. */
function V({ label, children, wide }) {
  return (
    <div className={`at-galv${wide ? " wide" : ""}`}>
      <div className="at-galvlabel">{label}</div>
      <div className="at-galvbody">{children}</div>
    </div>
  );
}

export function ComponentGallery() {
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

  return (
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

      <Row name="Lede" uses={6} what="The intro paragraph under a title.">
        <V label="default"><Lede>Learn a language a card at a time.</Lede></V>
      </Row>

      <Row name="Help" uses={83} what="Helper text under a control. The workhorse.">
        <V label="default"><Help>Shown once, and never readable again.</Help></V>
      </Row>

      <Row
        name="Meta"
        uses={0}
        what="Small print beside content."
        note="Unused in the app. Available rather than established — its API is the most likely to need something adding."
      >
        <V label="default"><Meta>Taken 3 March, 09:41</Meta></V>
      </Row>

      <Row
        name="Notice"
        uses={12}
        what="Errors, warnings, success and busy lines."
        note="Renders nothing when its children are empty, so it is safe to leave in the tree unconditionally."
      >
        <V label='kind="info"'><Notice kind="info">Something worth knowing.</Notice></V>
        <V label='kind="error"'><Notice kind="error">That sign-in key isn't recognised.</Notice></V>
        <V label='kind="warn"'><Notice kind="warn">This cannot be undone.</Notice></V>
        <V label='kind="ok"'><Notice kind="ok">Saved.</Notice></V>
        <V label='kind="busy"'><Notice kind="busy">Working…</Notice></V>
      </Row>

      {/* ---- controls ---- */}
      <p className="at-eyebrow at-mt5">Controls</p>

      <Row
        name="Button"
        uses={90}
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
        uses={12}
        what="An icon on its own."
        note="label is required — it is the only name a screen reader has to go on."
      >
        <V label="default"><IconButton icon="edit" label="Edit" /></V>
        <V label="danger"><IconButton icon="delete" label="Delete" danger /></V>
      </Row>

      <Row
        name="Segmented"
        uses={17}
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
        <V label="size={null} — full size" wide>
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
        uses={48}
        what="A labelled control."
        note="spaces.jsx imports it as Field; the trainer imports it as FormField, because the trainer has an unrelated Field of its own."
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

      <Row name="CheckList" uses={4} what="Pick several.">
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

      <Row name="LanguageRadio" uses={4} what="A proper radio list of languages.">
        <V label="languages + value" wide>
          <LanguageRadio
            languages={{
              "ar-PS": { id: "ar-PS", name: "Arabic" },
              "vi-Hue": { id: "vi-Hue", name: "Vietnamese (Huế)" },
            }}
            value={lang}
            onChange={setLang}
            name="gallery-lang"
          />
        </V>
      </Row>

      <Row name="ModeSelector" uses={0} what="A drop-down of the spaces." note="Nothing calls it — the app uses the icon strip in the corner instead. Its labels are a fixed map inside shared.jsx, so it only knows learn, teach and admin.">
        <V label="modes" wide>
          <ModeSelector mode={mode} modes={["learn", "teach", "admin"]} onChange={setMode} />
        </V>
      </Row>

      {/* ---- layout ---- */}
      <p className="at-eyebrow at-mt5">Layout and frames</p>

      <Row name="Section" uses={7} what="A titled block. Replaces a hand-built eyebrow and lede.">
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

      <Row name="Tabs" uses={2} what="The tab strip. Handles role, aria-selected and aria-current.">
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
        uses={21}
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
        uses={2}
        what="The Teaching and Admin shells: full-bleed screen, dialog slot, error line, busy line, tabs, contents."
        note="You are inside one right now. Props: tabs, tab, onTab, error, busy, label, dialog, children."
      />

      <Row name="Empty" uses={5} what="The nothing-here state.">
        <V label="title + children + action" wide>
          <Empty title="No decks yet" action={<Button size="sm" icon="add">New deck</Button>}>
            A deck is a set of cards you hand to a course.
          </Empty>
        </V>
      </Row>

      <Row name="Stat" uses={6} what="One big number.">
        <V label="default"><Stat value="128" label="Cards" /></V>
        <V label="big"><Stat value="12" label="Due today" big /></V>
      </Row>

      {/* ---- lists and tiles ---- */}
      <p className="at-eyebrow at-mt5">Lists and tiles</p>

      <Row
        name="Tile"
        uses={6}
        what="The generic deck and course tile."
        note="Moved into shared.jsx — it used to live in spaces.jsx, so the one library the docs point at did not actually hold it."
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

      <Row name="TileNote" uses={4} what="The line under a tile: whether anyone can see it.">
        <V label="live"><TileNote live>In Arabic 101</TileNote></V>
        <V label="not live"><TileNote>Personal — not in a course</TileNote></V>
      </Row>

      <Row name="CardTile" uses={2} what="One card tile, for the learner's list and the teacher's alike.">
        <V label="card + lang + deckTitles" wide>
          <CardTile card={SAMPLE_CARD} lang={SAMPLE_LANG} deckTitles={["Lesson 1"]} showLat />
        </V>
      </Row>

      <Row name="CardReadout" uses={3} what="A card and its forms, read-only. Falls back to the default language pack when lang is left off.">
        <V label="card + lang" wide>
          <CardReadout card={{ ...SAMPLE_CARD, decks: ["d1"] }} decks={[{ id: "d1", title: "Lesson 1" }]} />
        </V>
      </Row>

      <Row
        name="ItemList"
        uses={8}
        what="The standard list frame: New button, search, Select mode, bulk actions, empty state, paging at 120."
        note="match is (item, lowercasedQuery) => boolean. bulkActions is [{ label, danger, onClick(ids) }]."
      >
        <V label="items + renderItem" wide>
          <ItemList
            noun="deck"
            plural="decks"
            items={listItems}
            itemKey={(d) => d.id}
            match={(d, q) => d.title.toLowerCase().includes(q)}
            size="small"
            renderItem={(d) => <Tile title={d.title} meta="12 cards" />}
            empty={<Empty title="No decks">Nothing here yet.</Empty>}
          />
        </V>
      </Row>

      {/* ---- dialogs and audio ---- */}
      <p className="at-eyebrow at-mt5">Dialogs and audio</p>

      <Row
        name="ConfirmModal"
        uses={10}
        what="Asking before something irreversible."
        note="confirmWord makes the person type a word before the button enables. Prefer this over window.confirm."
      >
        <V label="open it"><Button onClick={() => setModalOpen(true)}>Show the modal</Button></V>
      </Row>

      <Row
        name="PlayButton"
        uses={0}
        what="Playback control for one recording."
        note="No direct uses — it is what ClipList renders inside. States: idle, loading, playing, missing."
      >
        <V label='state="idle"'><PlayButton state="idle" onClick={() => {}} /></V>
        <V label='state="loading"'><PlayButton state="loading" onClick={() => {}} /></V>
        <V label='state="playing"'><PlayButton state="playing" onClick={() => {}} /></V>
      </Row>

      <Row
        name="ClipList"
        uses={2}
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
        uses={22}
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

      <Row name="LanguageTag" uses={4} what="Naming a language, including the case where there isn't one.">
        <V label="a language">
          <LanguageTag languages={{ "ar-PS": { name: "Arabic" } }} id="ar-PS" />
        </V>
        <V label="not set"><LanguageTag languages={{}} id="" /></V>
      </Row>

      <Row
        name="plural(n, noun)"
        what="Counting, in one place."
        note="Use it instead of writing ${n} card${n === 1 ? '' : 's'}."
      >
        <V label="0 / 1 / 3">
          <Help>
            {plural(0, "card")} · {plural(1, "card")} · {plural(3, "card")}
          </Help>
        </V>
      </Row>

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
    </div>
  );
}
