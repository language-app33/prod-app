/** @import { Card, Course, Deck, Flag, Item, Lang, LangId, User } from "./types.js" */
/** @typedef {React.ReactNode} Node */
/**
 * Whatever is waiting on a yes: the confirmation to show, and what to do
 * if the answer is yes. Assembled at the call site rather than declared as
 * a component's props, because only one of these can be on screen at a
 * time and every screen builds its own.
 * @typedef {{
 *   title?: Node,
 *   body?: Node,
 *   confirmLabel?: string,
 *   confirmWord?: string,
 *   closeAfter?: boolean,
 *   kind?: string,
 *   ids?: string[],
 *   card?: Card,
 *   action: () => any,
 * }} Pending
 */
/** How a backup or a restore is going. */
/**
 * @typedef {{
 *   state: string,
 *   done?: number,
 *   total?: number,
 *   note?: string,
 *   counts?: Record<string, number>,
 *   file?: any,
 *   manifest?: any,
 *   takenAt?: number,
 * }} Progress
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as API from "./courses-api.js";

/* Loaded only when the gallery is opened: it is a reference an
   administrator reads occasionally, not part of running the site. */
const ComponentGallery = React.lazy(() =>
  import("./gallery.jsx").then((m) => ({ default: m.ComponentGallery })),
);
const ScreenElements = React.lazy(() =>
  import("./gallery.jsx").then((m) => ({ default: m.ScreenElements })),
);
import {
  contextCoverage,
  dimsOf,
  dimValues,
  exOf,
  findWordSlot,
  guessKind,
  supportsContext,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  scriptVars,
} from "./languages.js";
import {
  Button,
  CardReadout,
  CardTile,
  splitAlternatives,
  joinAlternatives,
  CheckList,
  ClipList,
  ConfirmModal,
  Field,
  FilterBar,
  FilterMenu,
  flagTitle,
  Help,
  Icon,
  IconButton,
  ItemList,
  KeysButton,
  LanguageRadio,
  Lede,
  Notice,
  Screen,
  Section,
  Segmented,
  SpaceFrame,
  Tile,
  TileNote,
  cardToItem,
  dateTime,
  languageName,
  localIdFor,
  plural,
  shortDate,
  pullAdmin,
  pullTeaching,
  recallSpace,
  rememberSpace,
  useFreshSpace,
  useLiveRefresh,
  useSnackbar,
} from "./shared.jsx";
export { Icon, CheckList, Screen, LanguageRadio, ClipList, ItemList, CardReadout };
export { LanguageTag, languageName } from "./shared.jsx";
export { ConfirmModal, useLiveRefresh, cardToItem, localIdFor };

/*
 * Getting started, and the administrator's screens.
 *
 * Nothing here asks anyone to run a command. Making an account, becoming
 * the administrator, creating a course, assigning a teacher and handing
 * out a join code all happen on screen.
 */

/* ------------------------------------------------------------------
   First run
   ------------------------------------------------------------------ */

/** @param {{ onDone: (account?: User & { key: string }) => void }} props */
export function Onboarding({ onDone }) {
  const [step, setStep] = useState("choose"); // choose | new | existing | key
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState(/** @type {User & { key: string } | null} */ (null));
  const [showKey, setShowKey] = useState(false);
  /* Asked for only once the server has said it wants one, so a site that
     lets anyone sign up never shows the field. */
  const [codeNeeded, setCodeNeeded] = useState(false);
  const [signupCode, setSignupCode] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await API.signUp(name.trim(), signupCode.trim());
      const account = { ...r.user, key: r.key };
      API.saveAccount(account);
      setMade(account);
      setStep("key");
    } catch (e) {
      if (String(e && /** @type {any} */ (e).message) === "signup-code-required") {
        setCodeNeeded(true);
        setError(signupCode.trim() ? "That invitation code isn't right." : "");
      } else {
        setError(API.explain(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const r = await API.whoAmI(key.trim());
      const account = { ...r.user, key: key.trim() };
      API.saveAccount(account);
      onDone(account);
    } catch (e) {
      setError(API.explain(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob">
      <div className="ob-box">
        {step === "choose" && (
          <>
            <h1>مُفْرَدات</h1>
            <Lede>
              Learn a language a card at a time. Everything stays on your device; an account only
              matters if you join a course or use more than one device.
            </Lede>
            <Button variant="primary" wide onClick={() => setStep("new")}>
              Set up
            </Button>
            <Button variant="ghost" wide
              className="at-mt3"
              onClick={() => setStep("existing")}
            >
              I already have a sign-in key
            </Button>
          </>
        )}

        {step === "new" && (
          <>
            <h2>What should people call you?</h2>
            <Lede>
              Your teachers and classmates see this. You can change it later.
            </Lede>
            <input
              className="at-input"
              placeholder="Sara"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
            />
            {codeNeeded && (
              <>
                <Help className="at-mb2">
                  This site asks for an invitation code from your teacher.
                </Help>
                <input
                  className="at-input"
                  placeholder="Invitation code"
                  value={signupCode}
                  autoFocus
                  onChange={(e) => {
                    setSignupCode(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" && name.trim() && signupCode.trim() && create()
                  }
                />
              </>
            )}
            <Notice kind="error">{error}</Notice>
            <Button variant="primary" wide
              className="at-mt4"
              disabled={!name.trim() || busy || (codeNeeded && !signupCode.trim())}
              onClick={create}
            >
              {busy ? "Setting up…" : "Continue"}
            </Button>
            <Button variant="ghost" wide className="at-mt3" onClick={() => setStep("choose")}>
              Back
            </Button>
          </>
        )}

        {step === "existing" && (
          <>
            <h2>Your sign-in key</h2>
            <Lede>
              The five words you were given when you set up. They bring your cards and courses to
              this device.
            </Lede>
            {/* A password manager only offers to fill something it recognises as
                a sign-in: a real form, a password field, and a username field to
                hang the entry on. The handle isn't known yet, so the site itself
                stands in for it. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (key.trim() && !busy) signIn();
              }}
            >
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="mufradat"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="at-hiddenuser"
              />
              <div className="at-inputwrap">
                <input
                  className="at-input"
                  type={showKey ? "text" : "password"}
                  name="password"
                  id="signin-key"
                  autoComplete="current-password"
                  placeholder="cedar-harbour-quartz-ember-4f2a"
                  value={key}
                  autoFocus
                  onChange={(e) => {
                    setKey(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  className="at-showkey"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <Notice kind="error">{error}</Notice>
              <Button variant="primary" wide
                className="at-mt4"
                type="submit"
                disabled={!key.trim() || busy}
              >
                {busy ? "Checking…" : "Sign in"}
              </Button>
            </form>
            <Button variant="ghost" wide className="at-mt3" onClick={() => setStep("choose")}>
              Back
            </Button>
          </>
        )}

        {step === "key" && made && (
          <>
            <h2>Keep this somewhere safe</h2>
            <Lede>
              This is your sign-in key. It brings your cards to another device, and it is the only
              way back into your account. Nobody can recover it for you except your administrator.
            </Lede>
            <p className="at-key">{made.key}</p>
            <div className="at-row at-mt3">
              <Button variant="ghost"
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(made.key)}
              >
                Copy
              </Button>
            </div>
            <Help>
              You are <strong>{made.displayName}</strong> · <span className="at-handle">{made.handle}</span>
              . Share the handle freely; never the key.
            </Help>
            {/* Submitting a form that holds the key is what prompts a password
                manager to offer to remember it, which is much the best place
                for it to live. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onDone(made);
              }}
            >
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="mufradat"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="at-hiddenuser"
              />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={made.key}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="at-hiddenuser"
              />
              <Button variant="primary" wide className="at-mt4" type="submit">
                I've saved it
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Confirming something that can't be undone

   A dialog that has to be read rather than dismissed. Where the action
   destroys something, the thing's own name has to be typed out: it is the
   one prompt that can't be answered by reflex.
   ------------------------------------------------------------------ */


/* ------------------------------------------------------------------
   Shared pieces
   ------------------------------------------------------------------ */


/* A name in a roster, marked when it is the person reading it. */
/** @param {{ name?: string, handle?: string, me?: string }} props `me` is the handle to compare against, so the row can say "(me)". */
export function PersonName({ name, handle, me }) {
  return (
    <>
      {name || handle}
      {handle && handle === me ? <span className="at-me"> (me)</span> : null}
    </>
  );
}

/* One "when this last happened" line on a person's card. The date carries
   the time with it: an administrator checking whether somebody has opened
   the app since being asked to wants the hour, not the day. Never having
   happened is said in words rather than left as a dash, because a dash and
   a value that failed to load look the same. */
/** @param {{ label?: Node, at?: number, never?: Node }} props */
function WhenRow({ label, at, never }) {
  return (
    <div className="at-whenrow">
      <span className="at-whenlabel">{label}</span>
      <span className={`at-whenvalue${at ? "" : " never"}`}>{dateTime(at) || never}</span>
    </div>
  );
}

/* Where a person belongs, one role at a time: "Teacher in" and the courses
   under it, then "Student in" and the courses under that. It used to be a run
   of badges, each repeating the role in front of the course — someone in six
   courses meant reading the word "Student" six times to reach the six names,
   which are the part that differs. The role is said once, and the courses are
   a list you scan.

   A fragment rather than a row of its own, so both labels and every course
   sit in the one grid the block declares and line up down two columns.

   Courses arrive as `{ title, language }`; older payloads sent bare titles,
   so a plain string is still read as one. The language rides along because a
   course name doesn't say what is being taught, which is what an
   administrator looking for somebody to cover a class actually wants. A
   course with none set says nothing here rather than "Language not set" —
   the course's own tile is where that gets fixed. */
/**
 * @param {{
 *   label?: Node,
 *   tone?: string,
 *   courses?: { title: string, language?: LangId }[],
 *   languages: Record<LangId, Lang>,
 * }} props
 */
function BelongRow({ label, tone, courses, languages }) {
  const list = (courses || []).map((c) => (typeof c === "string" ? { title: c } : c));
  if (!list.length) return null;
  return (
    <>
      <span className={`at-belonglabel ${tone}`}>{label}</span>
      <span className="at-belonglist">
        {list.map((c) => (
          <span className="at-belong" key={c.title}>
            {c.title}
            {c.language ? <i>{languageName(languages, c.language)}</i> : null}
          </span>
        ))}
      </span>
    </>
  );
}

/* A "modal" is now a screen. Kept under this name so nothing that opens one
   has to change; what it opens is the standard full-screen shell. */
/** @param {{ title?: Node, children?: Node, onClose: () => void }} props */
export function Modal({ title, children, onClose }) {
  return (
    <Screen title={title} onBack={onClose}>
      {children}
    </Screen>
  );
}

/* Pick the language a new deck or card belongs to. Shown only when the person
   teaches more than one, since otherwise there is nothing to decide. */
/* ------------------------------------------------------------------
   One list, everywhere

   Courses, decks, people and cards are different things, but looking
   through a list of them is the same act every time. So the frame is
   shared and only the tile inside it differs: a "New …" button and a
   search box on one row, a select toggle under them, tiles that open on
   tap and carry their own edit and delete, and a bar that rises from the
   bottom once something is ticked.

   Anything not passed simply doesn't appear — a list with no bulk
   actions omits the select toggle rather than showing a dead one.
   ------------------------------------------------------------------ */



/**
 * @param {{
 *   label?: Node, code?: string, hint?: Node,
 *   onNew?: () => void, busy?: boolean,
 * }} props
 */
export function CodeBox({ label, code, hint, onNew, busy }) {
  return (
    <div className="at-codeblock">
      <div className="at-codehead">{label}</div>
      <div className="at-codebox">
        <b>{code || "—"}</b>
        <Button variant="ghost" size="sm"
          disabled={!code}
          onClick={() => navigator.clipboard && navigator.clipboard.writeText(code || "")}
          icon="copy"
        >
          Copy
        </Button>
        {onNew && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onNew} icon="refresh">{code ? "Replace" : "Create"}</Button>
        )}
      </div>
      {hint && <Help>{hint}</Help>}
    </div>
  );
}


/* The bar that appears once something is ticked. */
/**
 * @param {{ count: number, noun: string, onClear?: () => void, children?: Node }} props
 */
export function SelectionBar({ count, noun, onClear, children }) {
  if (!count) return null;
  return (
    <div className="at-bulkbar at-mb3">
      <div className="at-bulkhead">
        <strong>
          {plural(count, noun)} selected
        </strong>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="at-chips">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Backup

   Assembling the file happens here rather than on the server, because the
   server can neither hold a whole site in one response nor keep a request
   open long enough to build it. The browser fetches the manifest, then the
   chunks, and writes one file.

   Verifying re-reads a finished file and checks it against the manifest it
   carries — so a bad backup is discovered on a quiet afternoon rather than
   during a recovery.
   ------------------------------------------------------------------ */

const BACKUP_CONCURRENCY = 4;
const RESTORE_BYTES = 3 * 1024 * 1024; // per request, under the function's own limit

/*
 * Builds the file as a Blob, chunk by chunk, in the order the manifest
 * lists them. Each chunk's JSON goes into the Blob as soon as its turn
 * comes and is not kept: the old version collected every record into one
 * object and then stringified the lot, which held two or three copies of a
 * course's recordings in memory at once and could sink a phone's browser.
 *
 * The checks that used to run over the finished object run here instead,
 * over each chunk as it passes: counts per kind, and whether every deck
 * and recording that is referred to is actually in the file.
 */
/** @param {(done: number, total: number) => void} onProgress */
async function buildBackup(onProgress) {
  const { manifest } = await API.backupManifest();
  const plan = manifest.plan || [];
  const { plan: _drop, ...kept } = manifest;

  /** @type {Record<string, any>} */
  /** @type {Record<string, string>} */
  const digests = {};
  const seen = new Set();
  const refs = { decks: new Set(), clips: new Set() };
  /** @type {Record<string, number>} */
  const counts = { "user:": 0, "course:": 0, "deck:": 0, "card:": 0, "clip:": 0 };

  let blob = new Blob(
    [`{"format":"language-app-backup","manifest":${JSON.stringify(kept)},"records":{`],
    { type: "application/json" }
  );
  let wroteAny = false;
  let done = 0;

  /* Chunks are fetched a few at a time but appended in plan order, so the
     file is the same however the network reorders the answers. */
  const ready = new Map();
  let nextToWrite = 0;
  const flush = () => {
    while (ready.has(nextToWrite)) {
      const fragment = ready.get(nextToWrite);
      ready.delete(nextToWrite);
      if (fragment) {
        blob = new Blob([blob, wroteAny ? "," : "", fragment], { type: "application/json" });
        wroteAny = true;
      }
      nextToWrite += 1;
    }
  };

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= plan.length) return;
      const chunk = plan[i];
      const r = await API.backupChunk(chunk.keys);
      const records = r.records || {};
      digests[chunk.id] = r.digest;
      for (const [key, value] of Object.entries(records)) {
        seen.add(key);
        for (const prefix of Object.keys(counts)) if (key.startsWith(prefix)) counts[prefix] += 1;
        if (key.startsWith("course:")) for (const id of value.decks || []) refs.decks.add(id);
        if (key.startsWith("card:")) {
          for (const h of value.clips || []) refs.clips.add(h);
          for (const sb of value.subs || []) for (const h of sb.clips || []) refs.clips.add(h);
        }
      }
      const json = JSON.stringify(records);
      ready.set(i, json.length > 2 ? json.slice(1, -1) : "");
      flush();
      done += 1;
      onProgress(done, plan.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(BACKUP_CONCURRENCY, plan.length || 1) }, worker));
  flush();

  blob = new Blob([blob, `},"digests":${JSON.stringify(digests)}}`], { type: "application/json" });

  const problems = [];
  const expect = [
    ["users", "user:", manifest.counts && manifest.counts.users],
    ["courses", "course:", manifest.counts && manifest.counts.courses],
    ["decks", "deck:", manifest.counts && manifest.counts.decks],
    ["cards", "card:", manifest.counts && manifest.counts.cards],
    ["clips", "clip:", manifest.counts && manifest.counts.clips],
  ];
  for (const [label, prefix, want] of expect) {
    if (want !== undefined && counts[prefix] !== want) {
      problems.push(`${label}: manifest says ${want}, file holds ${counts[prefix]}.`);
    }
  }
  let danglingDecks = 0;
  for (const id of refs.decks) if (!seen.has(`deck:${id}`)) danglingDecks += 1;
  let danglingClips = 0;
  for (const h of refs.clips) if (!seen.has(`clip:${h}`)) danglingClips += 1;
  if (danglingDecks) problems.push(`${danglingDecks} deck reference(s) point outside the file.`);
  if (danglingClips) problems.push(`${danglingClips} recording(s) are referenced but missing.`);

  return { blob, manifest: kept, problems };
}

/*
 * Puts a checked file back. Records go up in requests kept under a few
 * megabytes; the three indexes go last, and the server folds them into
 * whatever is there rather than replacing it. Restoring is additive: a
 * record in the file overwrites the one on the site with the same key,
 * and nothing else is touched.
 */
/**
 * @param {any} file
 * @param {(done: number, total: number) => void} onProgress
 */
async function restoreBackup(file, onProgress) {
  const records = file.records || {};
  const keys = Object.keys(records).filter((k) => !k.startsWith("index:"));
  /** @type {Record<string, any>[]} */
  const batches = [];
  /** @type {Record<string, any>} */
  let batch = {};
  let size = 0;
  let n = 0;
  for (const k of keys) {
    const v = records[k];
    const len = typeof v === "string" ? v.length : JSON.stringify(v).length;
    if (n && (size + len > RESTORE_BYTES || n >= 200)) {
      batches.push(batch);
      batch = {};
      size = 0;
      n = 0;
    }
    batch[k] = v;
    size += len;
    n += 1;
  }
  if (n) batches.push(batch);

  const indexes = (file.manifest && file.manifest.indexes) || {};
  /** @type {Record<string, any>} */
  /** @type {Record<string, any>} */
  /** @type {Record<string, any>} */
  const last = {};
  for (const [what, list] of Object.entries(indexes)) {
    if (Array.isArray(list)) last[`index:${what}`] = list;
  }
  if (Object.keys(last).length) batches.push(last);

  let written = 0;
  for (let i = 0; i < batches.length; i++) {
    const r = await API.restoreChunk(batches[i]);
    written += r.written || 0;
    onProgress(i + 1, batches.length);
  }
  return written;
}

/* What a finished file says about itself, checked against what it holds. */
/** @param {any} file */
function verifyBackup(file) {
  const problems = [];
  if (!file || file.format !== "language-app-backup") return ["Not a backup file."];
  const m = file.manifest || {};
  const rec = file.records || {};
  if (m.version !== 1) problems.push(`Made by a different version (${m.version}).`);

  /** @type {(prefix: string) => number} */
  const count = (prefix) => Object.keys(rec).filter((k) => k.startsWith(prefix)).length;
  const expect = [
    ["users", "user:", m.counts && m.counts.users],
    ["courses", "course:", m.counts && m.counts.courses],
    ["decks", "deck:", m.counts && m.counts.decks],
    ["cards", "card:", m.counts && m.counts.cards],
    ["clips", "clip:", m.counts && m.counts.clips],
  ];
  for (const [label, prefix, want] of expect) {
    const got = count(prefix);
    if (want !== undefined && got !== want) {
      problems.push(`${label}: manifest says ${want}, file holds ${got}.`);
    }
  }

  /* References that would dangle on restore. Reported, not repaired — this
     tells you whether the backup is whole, which is the question. */
  let danglingDecks = 0;
  let danglingClips = 0;
  for (const [key, value] of Object.entries(rec)) {
    if (key.startsWith("course:")) {
      for (const id of value.decks || []) if (!rec[`deck:${id}`]) danglingDecks += 1;
    }
    if (key.startsWith("card:")) {
      const all = [...(value.clips || []), ...(value.subs || []).flatMap((/** @type {any} */ sb) => sb.clips || [])];
      for (const h of all) if (!rec[`clip:${h}`]) danglingClips += 1;
    }
  }
  if (danglingDecks) problems.push(`${danglingDecks} deck reference(s) point outside the file.`);
  if (danglingClips) problems.push(`${danglingClips} recording(s) are referenced but missing.`);
  return problems;
}

/* ------------------------------------------------------------------
   The courses page

   The same page on both sides of the app: the courses you are in, then a
   clearly separate box for joining another. Only the words differ — a
   student joins a course, a teacher joins one to teach — so the wording
   is passed in rather than the page being written twice.
   ------------------------------------------------------------------ */

/**
 * @param {{
 *   courses: Course[],
 *   languages: Record<LangId, Lang>,
 *   busy?: boolean,
 *   error?: Node,
 *   lead?: Node,
 *   emptyLead?: Node,
 *   joinTitle?: Node,
 *   joinHint?: Node,
 *   joinPlaceholder?: string,
 *   joinNote?: Node,
 *   onJoin: (code: string) => any,
 *   renderCourse: (course: Course) => Node,
 *   footer?: Node,
 * }} props
 */
export function CoursesPage({
  courses,
  languages,
  busy,
  error,
  lead,
  emptyLead,
  joinTitle,
  joinHint,
  joinPlaceholder,
  joinNote,
  onJoin,
  renderCourse,
  footer,
}) {
  const [code, setCode] = useState("");

  return (
    <>
      <Help>
        {courses.length ? lead : emptyLead}
      </Help>

      <Notice kind="error">{error}</Notice>

      <section className="at-section">
        <h3 className="at-sectionhead">My courses</h3>
        <ItemList
          noun="course"
          items={courses}
          size="large"
          busy={busy}
          empty=""
          match={(c, q) => c.title.toLowerCase().includes(q)}
          renderItem={renderCourse}
        />
      </section>

      {/* The heading names the section; the box holds only the doing. */}
      <section className="at-section">
        <h3 className="at-sectionhead">{joinTitle}</h3>
        <div className="at-joinbox">
          <Help>
            {joinHint}
          </Help>
        <div className="at-toolbar">
          <input
            className="at-input at-search"
            placeholder={joinPlaceholder}
            value={code}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
          />
          <Button variant="primary"
            disabled={!code.trim() || busy}
            onClick={() => {
              onJoin(code.trim());
              setCode("");
            }}
          >
            <Icon name="school" />
            Join
          </Button>
        </div>
          {joinNote && (
            <Help>
              {joinNote}
            </Help>
          )}
        </div>
      </section>

      {footer}
    </>
  );
}

/* ------------------------------------------------------------------
   Course settings

   Everything about one course, on its own screen — the same shape as deck
   settings and the card editor. It used to be an inline panel that pushed
   the rest of the list down, which meant the admin screen behaved unlike
   every other list in the app.
   ------------------------------------------------------------------ */

/*
 * One person in a course, and what they are there to do.
 *
 * The two roles are independent, so they are two switches rather than one
 * picker: a person can teach and study the same course, and a teacher only
 * gets its cards in their own practice if they are enrolled as a student
 * too. Nothing is switched on for them — being made a teacher does not
 * quietly enrol them — because guessing is what filled this list with
 * duplicates in the first place.
 */
/**
 * @param {{
 *   handle: string, name?: string,
 *   me?: string, teaching: boolean, studying: boolean, busy?: boolean,
 *   onSetRole: (role: "teacher" | "student", on: boolean) => void,
 * }} props The caller knows whose row this is, so only the answer comes back.
 */
function RosterRow({ handle, name, me, teaching, studying, busy, onSetRole }) {
  /** @type {(key: "teacher" | "student", cls: string, label: string, on: boolean) => Node} */
  const role = (key, cls, label, on) => (
    <button
      type="button"
      className={`at-role ${cls}${on ? " on" : ""}`}
      aria-pressed={on}
      disabled={busy}
      onClick={() => onSetRole(key, !on)}
    >
      {label}
    </button>
  );
  return (
    <div className="at-item at-rosterrow">
      <div className="grow">
        <div className="en">
          <PersonName name={name} handle={handle} me={me} />
        </div>
        <div className="at-handle">{handle}</div>
      </div>
      <span className="at-roles">
        {role("teacher", "teach", "Teacher", teaching)}
        {role("student", "study", "Student", studying)}
      </span>
    </div>
  );
}

/**
 * @param {{
 *   course: Course,
 *   users: User[],
 *   languages: Record<LangId, Lang>,
 *   account: User,
 *   busy?: boolean,
 *   onRename: (title: string) => void,
 *   onSetLanguage: (id: LangId) => void,
 *   onNewCode: (which: "teacher" | "student") => void,
 *   onSetRole: (handle: string, name: string, role: "teacher" | "student", on: boolean) => void,
 *   onDelete: () => void,
 *   onClose: () => void,
 * }} props
 */
function CourseSettings({
  course,
  users,
  languages,
  account,
  busy,
  onRename,
  onSetLanguage,
  onNewCode,
  onSetRole,
  onDelete,
  onClose,
}) {
  const [adding, setAdding] = useState(false);
  const [unlockLang, setUnlockLang] = useState(false);
  const c = course;
  /* The title being edited, or null when it is not. Started from the course
     rather than kept in step with it, so a rename in flight is not
     overwritten by the refresh that follows the last one. */
  const [renaming, setRenaming] = useState(/** @type {string | null} */ (null));

  /*
   * One row per person, not one per membership. Teaching and studying are
   * separate memberships and someone may hold both — which used to put them
   * in this list twice, with two identical rows and two remove buttons that
   * each took away both.
   */
  const people = [...new Set([...c.teachers, ...c.students])];
  /** @type {(h: string) => string} */
  const nameOf = (h) => {
    const u = users.find((x) => x.handle === h);
    return u ? u.displayName : h;
  };
  const outsiders = users.filter((u) => !people.includes(u.handle));

  return (
    <Screen
      title={c.title}
      onBack={onClose}
      action={
        <Button variant="danger" size="sm" onClick={onDelete} icon="delete">Delete</Button>
      }
    >
          {/* A title is a label and nothing hangs off it — decks, people and
              join codes are all keyed by the course's id — so unlike the
              language below, renaming is an ordinary edit and needs no
              warning and no unlocking. */}
          <Field label="Name">
            {renaming === null ? (
              <div className="at-lockrow">
                <span className="at-lockname">
                  <Icon name="school" />
                  {c.title}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRenaming(c.title)}>
                  Rename
                </Button>
              </div>
            ) : (
              <>
                <input
                  className="at-input"
                  value={renaming}
                  autoFocus
                  maxLength={80}
                  aria-label="Course name"
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenaming(null);
                    if (e.key === "Enter" && renaming.trim() && renaming.trim() !== c.title) {
                      onRename(renaming.trim());
                      setRenaming(null);
                    }
                  }}
                />
                <div className="at-row at-mt3">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    disabled={busy || !renaming.trim() || renaming.trim() === c.title}
                    onClick={() => {
                      onRename(renaming.trim());
                      setRenaming(null);
                    }}
                  >
                    {busy ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </Field>

          <Field label={<>Language taught {!c.language && <span className="req">not set</span>}</>}>
            {/* Set once, then behind a deliberate act. Changing it later
                converts nothing — it just relabels every existing card. */}
            {c.language && !unlockLang ? (
              <div className="at-lockrow">
                <span className="at-lockname">
                  <Icon name="language" />
                  {languageName(languages, c.language)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setUnlockLang(true)}>
                  <Icon name="lock" />
                  Change
                </Button>
              </div>
            ) : (
              <>
                {/* The full-width picker, not the compact one. Compact sizes
                    every option to the longest label and never wraps, which
                    with three language names comes to 552px — wider than any
                    phone. Full-width lets a third name take a second row. */}
                <Segmented
                  size={null}
                  label="Language this course teaches"
                  disabled={busy}
                  options={Object.values(languages).map((Lx) => ({ value: Lx.id, label: Lx.name }))}
                  value={c.language}
                  onChange={(id) => {
                    if (id !== c.language) onSetLanguage(id);
                    setUnlockLang(false);
                  }}
                />
                <Help>
                  {c.language
                    ? "Changing this converts nothing. Cards already written stay as they are and will be treated as the new language, which is usually wrong."
                    : "Until this is set, decks and cards made for this course fall back to the first language on the list, which is rarely the right one."}
                </Help>
              </>
            )}
          </Field>

          <p className="at-eyebrow at-mt5">
            Join codes
          </p>
          <Help>
            Two codes: one lets people study, the other lets them teach.
          </Help>
          <CodeBox
            label="Student code"
            code={c.code}
            busy={busy}
            onNew={() => onNewCode("student")}
            hint="Hand this round a class. It lets someone study the material."
          />
          <CodeBox
            label="Teacher code"
            code={c.teacherCode}
            busy={busy}
            onNew={() => onNewCode("teacher")}
            hint="Send this privately. It lets someone add and change the material."
          />

          <p className="at-eyebrow at-mt5">
            Who is in it
          </p>
          <Help>
            Someone can do both. Switch a role off to drop it; switch off the
            last one and they leave the course.
          </Help>
          <div className="at-list">
            {people.map((h) => (
              <RosterRow
                key={h}
                handle={h}
                name={nameOf(h)}
                me={account.handle}
                teaching={c.teachers.includes(h)}
                studying={c.students.includes(h)}
                busy={busy}
                onSetRole={(role, on) => onSetRole(h, nameOf(h), role, on)}
              />
            ))}
            {!people.length && (
              <Help>
                Nobody in this course yet. Share a join code, or add someone below.
              </Help>
            )}
          </div>

          {/* Adding someone is the same control again: a row per person who
              is not in the course yet, and the role you switch on is the one
              they arrive with. It used to be two buttons opening two pickers,
              neither of which showed what the person already was. */}
          {adding ? (
            <Field label="Add someone" className="at-mt3">
              {outsiders.length ? (
                <div className="at-list">
                  {outsiders.map((u) => (
                    <RosterRow
                      key={u.handle}
                      handle={u.handle}
                      name={u.displayName}
                      me={account.handle}
                      teaching={false}
                      studying={false}
                      busy={busy}
                      onSetRole={(role) => onSetRole(u.handle, u.displayName, role, true)}
                    />
                  ))}
                </div>
              ) : (
                <Help>Everyone with an account is already in this course.</Help>
              )}
              <Button variant="ghost" size="sm" className="at-mt3" onClick={() => setAdding(false)}>
                Done
              </Button>
            </Field>
          ) : (
            <div className="at-row at-mt3">
              <Button size="sm" onClick={() => setAdding(true)} icon="person">
                Add someone
              </Button>
            </div>
          )}
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Administrator
   ------------------------------------------------------------------ */

/*
 * Which question a flag was about, in the words the app itself uses for it.
 *
 * An exercise's label is written per language — "Arabic script → English",
 * "Listen → tone" — so naming one needs the pack it was asked in. A flag
 * sent from a language this build no longer carries falls back to the bare
 * type, which is less to read but still says which of eight it was.
 */
/**
 * @param {Record<LangId, Lang>} languages
 * @param {LangId} [langId]
 * @param {string} [type]
 */
function exerciseLabel(languages, langId, type) {
  if (!type) return "";
  const lang = languages[langId || ""];
  const spec = lang ? exOf(type, lang) : null;
  return spec && spec.label ? spec.label : type;
}

/*
 * What became of the card a report is about, said on the report itself.
 *
 * A report is only worth acting on while the thing it describes is still
 * there to act on, and each of these says it is not — or not quite. The
 * server works out which by comparing the card's revision now against the
 * one it stood at when the flag was sent.
 *
 * "here" is the ordinary case and has no entry: a card that is exactly as
 * it was needs nothing said about it, and a chip on every tile would be a
 * chip nobody reads. It is also what a report says when the comparison
 * cannot be made — nothing, rather than a guess.
 */
/** @type {Record<string, { label: string, tone: string, what: string, openable: boolean }>} */
const CARD_STATES = {
  edited: {
    label: "Card edited since",
    tone: "stale",
    what: "The card has been saved at least once since this was reported. It may already be fixed.",
    openable: true,
  },
  gone: {
    label: "Card deleted",
    tone: "flagged",
    what: "The card has been deleted since this was reported. There is nothing left to open.",
    openable: false,
  },
  /* Not the same as deleted, and worth telling apart: the card was already
     not on the site when the report arrived, so nothing was lost between
     then and now. A deck withdrawn before the student's device caught up
     is the way it happens. */
  absent: {
    label: "No card on the site",
    tone: "flagged",
    what: "The site did not hold this card even when the report was sent. There is nothing to open.",
    openable: false,
  },
};

/* And how to set it: the same direction and script the app writes that
   language in everywhere else. Both are undefined for a language this
   build does not carry, which leaves the browser's own defaults — the
   right answer when there is nothing better to say. */
/** @type {(languages: Record<LangId, Lang>, langId?: LangId) => string | undefined} */
const dirOf = (languages, langId) =>
  (languages[langId || ""] && languages[langId || ""].direction) || undefined;
/**
 * @param {Record<LangId, Lang>} languages
 * @param {LangId} [langId]
 */
function scriptStyle(languages, langId) {
  const lang = languages[langId || ""];
  if (!lang) return undefined;
  return { ...(lang.fontStack ? { fontFamily: lang.fontStack } : null), ...scriptVars(lang) };
}

/** @param {{ account: User, languages: Record<LangId, Lang>, onClose: () => void }} props */
export function AdminSpace({ account, languages, onClose }) {
  const [tab, setTab] = useState("courses");
  const [data, setData] = useState(
    /** @type {import("./types.js").AdminOverview | null} */ (recallSpace("admin", account.handle))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState(Object.keys(languages)[0]);
  const [newKey, setNewKey] = useState(/** @type {Record<string, any> | null} */ (null));
  const [makingCourse, setMakingCourse] = useState(false);
  const [makingUser, setMakingUser] = useState(/** @type {{ name: string, courseId: string, roles: string[] } | null} */ (null)); // the form, while open
  const [openCourse2, setOpenCourse2] = useState(/** @type {string | null} */ (null)); // a course being settled
  const [selPeople, setSelPeople] = useState(() => new Set());
  const [backup, setBackup] = useState(/** @type {Progress | null} */ (null)); // { state, done, total, note }
  /* Off until asked for: the gallery renders a specimen of every component,
     which is a lot of markup to carry on a tab that is mostly about backups. */
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [elementsOpen, setElementsOpen] = useState(false);
  const [selDecks, setSelDecks] = useState(() => new Set());
  const [selFlags, setSelFlags] = useState(() => new Set());
  /* The flagged card being looked at: { flag, card, error }. The card
     arrives after the flag does, so the screen is up while it is fetched
     rather than after — a blank second on a tap is what a spinner is
     for. */
  const [openCard, setOpenCard] = useState(/** @type {{ flag: Flag, card: Card | null, error: string } | null} */ (null));
  const [deckAction, setDeckAction] = useState(/** @type {"add" | "remove" | null} */ (null)); // "add" | "remove"
  /* Whose decks to show: a handle, or "" for everyone's. Search already
     matches the maker's name, but only if you know whose name to type —
     which is the thing an administrator looking at decks made by six
     different people does not know yet. */
  const [deckOwner, setDeckOwner] = useState("");
  /* One slot for whatever is waiting to be confirmed, so only one of these
     can ever be on screen at a time. */
  const [confirm, setConfirm] = useState(/** @type {Pending | null} */ (null));

  const refresh = useCallback(async (/** @type {boolean} */ background = false) => {
    /* A background poll must not flash "Working" or grey the buttons out
       from under someone mid-click; only a deliberate refresh does that. */
    if (!background) setBusy(true);
    try {
      setData(await pullAdmin(account.handle));
      setError("");
    } catch (e) {
      if (!background) setError(API.explain(e));
    } finally {
      if (!background) setBusy(false);
    }
  }, [account.handle]);

  /* Whether this mount had something to show before it asked. Read once,
     at the first render: what matters is how the space arrived, not what
     it holds by the time the answer comes back. */
  const arrivedWithSomething = useRef(data !== null);
  useEffect(() => {
    /* Quietly when there is already a screen to look at — the check is
       then the same background one the poll makes, and says nothing. */
    refresh(arrivedWithSomething.current);
  }, [refresh]);

  /* Off the state rather than out of the fetch, so anything that changes
     what is on screen is remembered, not just what arrived from a
     refresh. */
  useEffect(() => {
    if (data) rememberSpace("admin", account.handle, data);
  }, [data, account.handle]);

  /* Sync now fetches this space whether or not it is the one on screen.
     When it is, what it fetched arrives here — the screen updates under
     the corner menu that asked for it, without a second request. */
  useFreshSpace("admin", account.handle, (shown) => {
    setData(shown);
    setError("");
  });

  const backgroundRefresh = useCallback(() => refresh(true), [refresh]);
  useLiveRefresh(backgroundRefresh);

  const snack = useSnackbar();

  /* `done` is what to say once it worked. A string, or a function of
     whatever the call returned when the message wants to name the thing —
     "Beginner Arabic created" rather than "Saved". Said after the refresh,
     so the lists are already showing what it is confirming. */
  /**
   * @param {() => Promise<any>} fn
   * @param {string | ((out: any) => string)} [done]
   */
  async function run(fn, done) {
    setBusy(true);
    try {
      const out = await fn();
      await refresh();
      setError("");
      if (done) snack(typeof done === "function" ? done(out) : done, "good");
    } catch (e) {
      setError(API.explain(e));
      setBusy(false);
    }
  }

  /* The card a report is about, fetched when the report is opened rather
     than carried by the overview: Admin holds decks, not cards, and a site
     with five hundred reports would otherwise be sending five hundred
     cards to a screen showing one. */
  /** @param {Flag} flag */
  async function openFlaggedCard(flag) {
    setOpenCard({ flag, card: null, error: "" });
    try {
      const got = await API.adminCard(flag.cardId);
      /* Only if it is still the one being waited for: two taps in a row
         must not leave the second screen showing the first card. */
      setOpenCard((cur) => (cur && cur.flag.id === flag.id ? { ...cur, card: got.card } : cur));
    } catch (e) {
      const said = API.explain(e);
      setOpenCard((cur) => (cur && cur.flag.id === flag.id ? { ...cur, error: said } : cur));
    }
  }

  const users = (data && data.users) || [];
  const courses = (data && data.courses) || [];
  const decks = (data && data.decks) || [];
  /* Newest first, as the server sends them. */
  const flags = (data && data.flags) || [];

  /* Everyone who has actually made a deck, with how many — read off the
     decks rather than off the people, so the menu never offers a name that
     would narrow the list to nothing. */
  /** @type {{ value: string, label: string, count: number }[]} */
  const deckMakers = [];
  for (const d of decks) {
    const found = deckMakers.find((m) => m.value === d.owner);
    if (found) found.count += 1;
    else deckMakers.push({ value: d.owner, label: d.ownerName || d.owner, count: 1 });
  }
  deckMakers.sort((a, b) => a.label.localeCompare(b.label));
  const deckOwnerOptions = [
    { value: "", label: "Anyone", note: String(decks.length) },
    ...deckMakers.map((m) => ({ value: m.value, label: m.label, note: String(m.count) })),
  ];
  /* Filtered before the list sees them, so the count line, "select all" and
     every bulk action work on what is on screen rather than on what a
     narrowed list is hiding. */
  const shownDecks = deckOwner ? decks.filter((d) => d.owner === deckOwner) : decks;

  /* One course, on its own screen — the same shape as deck settings. */
  if (openCourse2) {
    const c = courses.find((x) => x.id === openCourse2);
    if (!c) {
      setOpenCourse2(null);
      return null;
    }
    return (
      <>
        {confirm && (
          <ConfirmModal
            {...confirm}
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() =>
              run(async () => {
                await confirm.action();
                if (confirm.closeAfter) setOpenCourse2(null);
                setConfirm(null);
              })
            }
          />
        )}
        <CourseSettings
          course={c}
          users={users}
          languages={languages}
          account={account}
          busy={busy}
          onClose={() => setOpenCourse2(null)}
          onRename={(title) => run(() => API.renameCourse(c.id, title), () => `Renamed to ${title}`)}
          onSetLanguage={(id) =>
            run(() => API.setCourseLanguage(c.id, id), () => `Now teaching ${languageName(languages, id)}`)
          }
          onNewCode={(which) =>
            run(() => API.newCourseCode(c.id, which), `New ${which} code — the old one no longer works`)
          }
          /*
           * Every change to who is in the course, and what they are here to
           * do, comes through here. Switching a role on, or off while the
           * other still stands, is an ordinary edit and one tap undoes it.
           * Switching off the last one is the only way out of the course, so
           * that is the only thing that asks.
           */
          onSetRole={(h, name, role, on) => {
            const holdsOther = role === "teacher" ? c.students.includes(h) : c.teachers.includes(h);
            if (on) {
              const add = role === "teacher" ? API.assignTeacher : API.assignStudent;
              const doing = role === "teacher" ? "teaching" : "studying";
              return run(() => add(c.id, h), `${name} is now ${doing} ${c.title}`);
            }
            if (holdsOther) {
              const dropped = role === "teacher" ? "no longer teaching" : "no longer studying";
              return run(() => API.removeMember(c.id, h, role), `${name} is ${dropped} ${c.title}`);
            }
            return setConfirm({
              title: `Remove ${name} from ${c.title}?`,
              confirmLabel: "Remove them",
              body: (
                <p>
                  That was their only role here, so this takes them out of the course. They lose
                  access to every deck in it. Their account, their own cards and their progress
                  are untouched, and they can rejoin with the code.
                </p>
              ),
              action: () => API.removeMember(c.id, h, role),
            });
          }}
          onDelete={() =>
            setConfirm({
              title: `Delete ${c.title}?`,
              confirmLabel: "Delete the course",
              confirmWord: c.title,
              closeAfter: true,
              body: (
                <>
                  <p>
                    The course, its join codes and its roster go.{" "}
                    <strong>
                      {c.teachers.length + c.students.length}{" "}
                      {c.teachers.length + c.students.length === 1 ? "person" : "people"}
                    </strong>{" "}
                    lose access to the {plural(c.decks.length, "deck")} in
                    it, and the cards disappear from their apps at the next check.
                  </p>
                  <p>
                    The decks themselves are kept and go back to the teachers who made them, so
                    no one's work is destroyed. There is no undoing the course itself.
                  </p>
                </>
              ),
              action: () => API.deleteCourse(c.id),
            })
          }
        />
      </>
    );
  }

  return (
    <SpaceFrame
      tabs={[
        ["courses", "Courses", "school"],
        ["people", "People", "group"],
        ["decks", "Decks", "folder"],
        ["flags", "Flags", "flag"],
        ["app", "App", "tune"],
      ]}
      tab={tab}
      onTab={setTab}
      error={error}
      busy={busy}
      dialog={
        confirm ? (
          <ConfirmModal
            {...confirm}
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() =>
              run(async () => {
                await confirm.action();
                setConfirm(null);
              })
            }
          />
        ) : null
      }
    >

          {tab === "courses" && (
            <>
              <Button variant="primary"
                style={{ marginBottom: 14 }}
                onClick={() => {
                  setTitle("");
                  setMakingCourse(true);
                }}
          icon="add"
        >
          New course
        </Button>

              {makingCourse && (
                <Screen
                  title="New course"
                  onBack={() => setMakingCourse(false)}
                  action={
                    <Button variant="primary" size="sm"
                      disabled={!title.trim() || busy}
                      onClick={() =>
                        run(async () => {
                          const made = title.trim();
                          await API.createCourse(made, lang);
                          setTitle("");
                          setMakingCourse(false);
                          return made;
                        }, (made) => `${made} created`)
                      }
          icon="check"
        >
          {busy ? "Saving…" : "Create"}
        </Button>
                  }
                >
                  <Field label={<>Title <span className="req">required</span></>}>
                    <input
                      className="at-input"
                      placeholder="Beginner Arabic"
                      value={title}
                      autoFocus
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Field>
                  <LanguageRadio
                    languages={languages}
                    value={lang}
                    onChange={setLang}
                    label="Language taught"
                  />
                  <Help>
                    Pick carefully — this sets the script, the keyboard and how answers are marked
                    for everything in the course, and changing it later doesn't convert what's
                    already written.
                  </Help>
                </Screen>
              )}

              <ItemList
                noun="course"
                items={courses}
                size="large"
                busy={busy}
                empty="No courses yet. Make the first one — a course is what carries decks to students."
                match={(c, q) => c.title.toLowerCase().includes(q)}
                renderItem={(c) => (
                  <Tile
                    title={c.title}
                    meta={`${languageName(languages, c.language)} · ${
                      c.teachers.length
                    } teaching · ${c.students.length} studying · ${plural(c.decks.length, "deck")}`}
                    onOpen={() => setOpenCourse2(c.id)}
                    actions={
                      <IconButton icon="edit" label="Course settings" onClick={(/** @type {React.MouseEvent} */ e) => {
                          e.stopPropagation();
                          setOpenCourse2(c.id);
                        }} />
                    }
                    footer={
                      !c.language ? (
                        <div className="at-flags">
                          <span className="at-flag flagged">Language not set</span>
                        </div>
                      ) : null
                    }
                  />
                )}
              />
            </>
          )}

          {tab === "people" && (
            <>
              {newKey && (
                <div className="at-sub">
                  <p className="at-eyebrow">
                    {newKey.fresh ? "Sign-in key for" : "New sign-in key for"} {newKey.name}
                  </p>
                  <p className="at-key">{newKey.key}</p>
                  {newKey.handle && (
                    <Help>
                      Their handle is <strong>{newKey.handle}</strong>.
                    </Help>
                  )}
                  <div className="at-row" style={{ marginTop: 0, marginBottom: 10 }}>
                    <Button size="sm"
                      onClick={() =>
                        navigator.clipboard && navigator.clipboard.writeText(newKey.key)
                      }
          icon="copy"
        >
          Copy the key
        </Button>
                    <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
                      Done
                    </Button>
                  </div>
                  <Help>
                    {newKey.fresh
                      ? "Send it to them through something private — the key is the whole credential, and anyone holding it is them. "
                      : "Give it to them directly. Their old key stopped working the moment you made this one; their handle, courses and progress are unchanged. "}
                    You won't see it again, but you can issue another.
                  </Help>
                </div>
              )}

              {makingUser && (
                <Screen
                  title="Add a person"
                  onBack={() => setMakingUser(null)}
                  action={
                    <Button variant="primary" size="sm"
                      disabled={!makingUser.name.trim() || busy}
                      onClick={() =>
                        run(
                          async () => {
                            const r = await API.createUser(
                              makingUser.name.trim(),
                              makingUser.courseId || "",
                              /** @type {("teacher" | "student")[]} */ (makingUser.roles)
                            );
                            setNewKey({
                              name: r.user.displayName,
                              handle: r.user.handle,
                              key: r.key,
                              fresh: true,
                            });
                            setMakingUser(null);
                            return r;
                          },
                          (r) => `${r.user.displayName} added as ${r.user.handle}`
                        )
                      }
          icon="check"
        >
          {busy ? "Working…" : "Create"}
        </Button>
                  }
                >
<Field label={<>Their name <span className="req">required</span></>}>
                    <input
                      className="at-input"
                      placeholder="Sara Haddad"
                      value={makingUser.name}
                      autoFocus
                      onChange={(e) =>
                        setMakingUser((/** @type {any} */ u) => ({ ...u, name: e.target.value }))
                      }
                    />
</Field>

                  <Field label={<>Put them in a course <span className="at-optional">optional</span></>}>
                    <div className="at-cklist">
                      {courses.map((c) => (
                        <button
                          key={c.id}
                          className={`at-ck${makingUser.courseId === c.id ? " on" : ""}`}
                          onClick={() =>
                            setMakingUser((/** @type {any} */ u) => ({
                              ...u,
                              courseId: u.courseId === c.id ? "" : c.id,
                            }))
                          }
                        >
                          <span className="at-ckbox">
                            {makingUser.courseId === c.id ? "✓" : ""}
                          </span>
                          <span className="at-cktext">
                            <b>{c.title}</b>
                            <i>{languageName(languages, c.language)}</i>
                          </span>
                        </button>
                      ))}
                      {!courses.length && (
                        <Help>
                          No courses yet. You can add them to one later.
                        </Help>
                      )}
                    </div>
                  </Field>

                  {makingUser.courseId && (
                    /* Both, if they are both — the same two switches the
                       course's own roster uses, rather than a choice between
                       them. Someone teaching a course usually wants its cards
                       in their own practice, which needs the student role too. */
                    <Field label="In that course they are">
                      <div className="at-roles at-rolesown">
                        {[
                          ["teacher", "teach", "Teacher"],
                          ["student", "study", "Student"],
                        ].map(([value, cls, label]) => {
                          const on = makingUser.roles.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`at-role ${cls}${on ? " on" : ""}`}
                              aria-pressed={on}
                              onClick={() =>
                                setMakingUser((/** @type {any} */ u) => ({
                                  ...u,
                                  roles: on
                                    ? u.roles.filter((/** @type {string} */ r) => r !== value)
                                    : u.roles.concat([value]),
                                }))
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {!makingUser.roles.length && (
                        <Help>
                          With neither switched on they are made an account but put in no course.
                        </Help>
                      )}
                    </Field>
                  )}

                  <Help>
                    You'll get their sign-in key once, to pass on privately. They don't need to
                    do anything first — the key signs them in on any device.
                  </Help>

                                </Screen>
              )}

              <ItemList
                noun="person"
                plural="people"
                items={users}
                size="large"
                busy={busy}
                empty="Nobody here yet. Add a person, then share their key with them."
                match={(u, q) =>
                  u.displayName.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)
                }
                onNew={() => setMakingUser({ name: "", courseId: "", roles: ["teacher"] })}
                selected={selPeople}
                onSelectedChange={setSelPeople}
                bulkActions={[
                  {
                    label: "Delete",
                    danger: true,
                    onClick: (handles) => {
                      const them = users.filter(
                        (u) => handles.includes(u.handle) && u.handle !== account.handle
                      );
                      setConfirm({
                        title: `Delete ${them.length} ${them.length === 1 ? "person" : "people"}?`,
                        confirmLabel: "Delete for good",
                        confirmWord: "delete",
                        body: (
                          <p>
                            Their accounts, their keys and their place in every course go. The
                            decks and cards they made go with them. There is no undoing this.
                          </p>
                        ),
                        action: async () => {
                          for (const u of them) await API.deleteUser(u.handle);
                          setSelPeople(new Set());
                        },
                      });
                    },
                  },
                ]}
                itemKey={(u) => u.handle}
                renderItem={(u) => (
                  <div className="at-deckcard">
                    <div className="at-deckrow2">
                      <div className="at-deckmain">
                        <div className="at-decktitle">
                          <PersonName
                            name={u.displayName}
                            handle={u.handle}
                            me={account.handle}
                          />
                        </div>
                        <div className="at-deckmeta">{u.handle}</div>
                      </div>
                      <div className="at-deckacts">
                        <IconButton icon="key" label="Issue a new sign-in key" onClick={() =>
                            setConfirm({
                              title: `New sign-in key for ${u.displayName}?`,
                              confirmLabel: "Issue a new key",
                              body: (
                                <p>
                                  Their current key stops working the moment you do this, on
                                  every device they use. Their handle, courses and progress are
                                  untouched. You'll see the new key once.
                                </p>
                              ),
                              action: async () => {
                                const r = await API.reissueKey(u.handle);
                                setNewKey({
                                  name: u.displayName,
                                  handle: u.handle,
                                  key: r.key,
                                });
                              },
                            })
                          } />
                        {u.handle !== account.handle && (
                          <IconButton icon="delete" label="Delete person" danger onClick={() =>
                              setConfirm({
                                title: `Delete ${u.displayName}?`,
                                confirmLabel: "Delete for good",
                                confirmWord: u.handle,
                                body: (
                                  <p>
                                    Their account, their sign-in key and their place in every
                                    course go. The decks and cards they made go with them. There
                                    is no undoing this and no way to get the handle back.
                                  </p>
                                ),
                                action: () => API.deleteUser(u.handle),
                              })
                            } />
                        )}
                      </div>
                    </div>
                    {/* Admin is a flag on the person, not a course they are
                        in, so it stays a badge and keeps the row to itself. */}
                    {u.admin && (
                      <div className="at-flags">
                        <span className="at-flag flagged">Admin</span>
                      </div>
                    )}
                    {/* "Hasn't signed in yet" was a pill up here. The lines
                        below say it, in the same place as the two questions
                        it sits beside, so the pill was the same fact
                        twice. */}
                    <div className="at-belongs">
                      <BelongRow
                        label="Teacher in"
                        tone="teach"
                        courses={u.teaching}
                        languages={languages}
                      />
                      <BelongRow
                        label="Student in"
                        tone="study"
                        courses={u.studying}
                        languages={languages}
                      />
                      {!u.teaching.length && !u.studying.length && (
                        <>
                          <span className="at-belonglabel">Courses</span>
                          <span className="at-belonglist">
                            <span className="at-belong none">In no course</span>
                          </span>
                        </>
                      )}
                    </div>
                    {/* Three moments, kept apart because they answer three
                        different questions. Somebody who opens the app every
                        morning and never practices looks exactly like a
                        diligent student under one "last active" line, and a
                        teacher whose course has gone quiet looks like a
                        teacher who is still writing cards. */}
                    <div className="at-when">
                      <WhenRow label="Last seen" at={u.lastSeen} never="Never signed in" />
                      <WhenRow label="Last practiced" at={u.lastLearned} never="Never practiced" />
                      <WhenRow
                        label="Last changed material"
                        at={u.lastTaught}
                        never="Never made a card or a deck"
                      />
                    </div>
                  </div>
                )}
              />
            </>
          )}

          {tab === "decks" && (
            <>
              {deckAction && (
                <Screen
                  title={
                    deckAction === "add"
                      ? "Add the selected decks to…"
                      : "Take the selected decks out of…"
                  }
                  onBack={() => setDeckAction(null)}
                >
                  <div className="at-cklist">
                    {courses.map((c) => (
                      <button
                        key={c.id}
                        className="at-ck"
                        disabled={busy}
                        onClick={() =>
                          run(
                            async () => {
                              const n = selDecks.size;
                              for (const id of selDecks) {
                                if (deckAction === "add") await API.attachDeck(id, c.id);
                                else await API.detachDeck(id, c.id);
                              }
                              setDeckAction(null);
                              setSelDecks(new Set());
                              return n;
                            },
                            (n) =>
                              `${plural(n, "deck")} ${deckAction === "add" ? "added to" : "removed from"} ${c.title}`
                          )
                        }
                      >
                        <span className="at-cktext">
                          <b>{c.title}</b>
                          <i>{languageName(languages, c.language)}</i>
                        </span>
                      </button>
                    ))}
                    {!courses.length && (
                      <Help>
                        There are no courses yet.
                      </Help>
                    )}
                  </div>
                  <div className="at-row at-mt5">
                    <Button variant="ghost" onClick={() => setDeckAction(null)}>
                      Cancel
                    </Button>
                  </div>
                </Screen>
              )}

              <ItemList
                noun="deck"
                items={shownDecks}
                size="large"
                busy={busy}
                empty={
                  deckOwner
                    ? "Nothing by them. Choose Anyone to see every deck again."
                    : "No decks yet. Make one, then add it to a course so students can see it."
                }
                match={(d, q) =>
                  d.title.toLowerCase().includes(q) ||
                  (d.ownerName || "").toLowerCase().includes(q)
                }
                tools={
                  <FilterMenu
                    icon="person"
                    label="Filter by who made it"
                    options={deckOwnerOptions}
                    value={deckOwner}
                    /* Anything picked before the list was narrowed is
                       dropped: a bulk delete must never reach decks the
                       filter has taken off the screen. */
                    onChange={(v) => {
                      setDeckOwner(v);
                      setSelDecks(new Set());
                    }}
                  />
                }
                selected={selDecks}
                onSelectedChange={setSelDecks}
                bulkActions={[
                  { label: "Add to a course", onClick: () => setDeckAction("add") },
                  { label: "Remove from a course", onClick: () => setDeckAction("remove") },
                  {
                    label: "Delete",
                    danger: true,
                    onClick: (ids) => {
                      const picked = decks.filter((d) => ids.includes(d.id));
                      const n = picked.reduce((t, d) => t + (d.cardCount || 0), 0);
                      setConfirm({
                        title: `Delete ${plural(picked.length, "deck")}?`,
                        confirmLabel: "Delete them",
                        confirmWord: "delete",
                        body: (
                          <p>
                            {plural(n, "card")} go with them, out of every course they
                            are in and out of the apps of everyone studying them. There is no
                            undoing this.
                          </p>
                        ),
                        action: async () => {
                          for (const d of picked) await API.deleteDeck(d.id);
                          setSelDecks(new Set());
                        },
                      });
                    },
                  },
                ]}
                renderItem={(d) => (
                  <Tile
                    title={d.title}
                    meta={`${d.ownerName} · ${plural(d.cardCount || 0, "card")}`}
                    actions={
                        <IconButton icon="delete" label="Delete deck" danger onClick={(/** @type {React.MouseEvent} */ e) => {
                            e.stopPropagation();
                            setConfirm({
                              title: `Delete ${d.title}?`,
                              confirmLabel: "Delete the deck",
                              confirmWord: d.title,
                              body: (
                                <p>
                                  Its {plural(d.cardCount || 0, "card")} go with it,
                                  out of every course it is in and out of the apps of everyone
                                  studying it. {d.ownerName} loses the work.
                                </p>
                              ),
                              action: () => API.deleteDeck(d.id),
                            });
                          }} />
                    }
                    footer={
                      <TileNote live={d.courseTitles.length > 0}>
                        {d.courseTitles.length
                          ? `In ${d.courseTitles.join(", ")}`
                          : "Personal — not in a course"}
                      </TileNote>
                    }
                  />
                )}
              />

            </>
          )}

          {/*
            * What learners said was wrong, newest first.
            *
            * Sent from the answer screen, where the problem was met. This is
            * the only place they are read: a teacher can see a card, but a
            * report is about the site rather than about one deck, and half
            * of them are about the marking rather than the material.
            *
            * A report is the whole record — there is no reply and no
            * resolved state. What answers a flag is the card being fixed,
            * and once it is, the report is done with and deleted.
            */}
          {tab === "flags" && (
            <>
              <Lede>
                Problems learners reported from the answer screen — what was wrong, on which
                question, and who said so. Fix the card, then clear the report.
              </Lede>
              {/* Read-only: what to change about a card is a teacher's
                  judgement and the teaching space is where it is made. This
                  is the shortest way from "somebody said this is wrong" to
                  seeing what they were actually asked. */}
              {openCard && (
                <Screen
                  title={
                    (openCard.card && (openCard.card.en || openCard.card.ar)) ||
                    openCard.flag.meaning ||
                    openCard.flag.prompt ||
                    "The flagged card"
                  }
                  onBack={() => setOpenCard(null)}
                >
                  <Notice kind="error">{openCard.error}</Notice>
                  {!openCard.card && !openCard.error && (
                    <Notice kind="busy">Fetching the card…</Notice>
                  )}
                  {openCard.card && (
                    <CardReadout
                      card={openCard.card}
                      lang={languages[openCard.card.lang]}
                      decks={decks}
                    />
                  )}
                </Screen>
              )}

              <ItemList
                noun="flag"
                items={flags}
                /* Full width, one to a row. A report is three or four lines
                   of somebody's words and a word in a script you may not
                   read quickly; in a grid of narrow tiles every one of them
                   wraps to a column and none of them can be skimmed. */
                size="large"
                busy={busy}
                empty="Nothing reported. Learners flag a question from the answer screen, and what they send lands here."
                match={(f, q) =>
                  flagTitle(f.kind).toLowerCase().includes(q) ||
                  (f.handleName || "").toLowerCase().includes(q) ||
                  (f.note || "").toLowerCase().includes(q) ||
                  (f.prompt || "").toLowerCase().includes(q) ||
                  (f.meaning || "").toLowerCase().includes(q)
                }
                selected={selFlags}
                onSelectedChange={setSelFlags}
                bulkActions={[
                  {
                    label: "Clear",
                    danger: true,
                    onClick: (ids) =>
                      setConfirm({
                        title: `Clear ${plural(ids.length, "flag")}?`,
                        confirmLabel: "Clear them",
                        body: (
                          <p>
                            They go for good. Nothing about the cards changes — clearing a report
                            says it has been dealt with, not that it was right.
                          </p>
                        ),
                        action: async () => {
                          await API.deleteFlags([...ids]);
                          setSelFlags(new Set());
                        },
                      }),
                  },
                ]}
                renderItem={(f) => {
                  const state = CARD_STATES[f.cardState || ""] || null;
                  return (
                    <Tile
                      title={flagTitle(f.kind)}
                      /* Spelled out rather than left as a name beside a
                         date: on a screen of reports about other people's
                         cards, a bare name reads as easily as whose card it
                         was as who complained about it. */
                      meta={`Submitted by ${f.handleName || f.handle} · ${dateTime(f.at)}`}
                      actions={
                        <>
                          {(!state || state.openable) && f.cardId && (
                            <Button
                              size="sm"
                              icon="view"
                              onClick={(/** @type {React.MouseEvent} */ e) => {
                                e.stopPropagation();
                                openFlaggedCard(f);
                              }}
                            >
                              Open card
                            </Button>
                          )}
                          <IconButton
                            icon="delete"
                            label="Clear this report"
                            danger
                            onClick={(/** @type {React.MouseEvent} */ e) => {
                              e.stopPropagation();
                              setConfirm({
                                title: "Clear this report?",
                                confirmLabel: "Clear it",
                                body: <p>It goes for good. Nothing about the card changes.</p>,
                                action: () => API.deleteFlags([f.id]),
                              });
                            }}
                          />
                        </>
                      }
                      footer={
                        <div className="at-flagreport">
                          {/* The question as it was asked, copied into the
                              report when it was sent: the card may have been
                              edited or withdrawn since, and an id on its own
                              would say nothing. Set in its own script and
                              direction, like every other place the app shows
                              a word — a right-to-left word laid out
                              left-to-right is the thing an administrator
                              would misread first. */}
                          {f.prompt && (
                            <p className="at-flagreport-q" lang={f.language} dir={dirOf(languages, f.language)}
                              style={scriptStyle(languages, f.language)}>
                              {f.prompt}
                            </p>
                          )}
                          {f.meaning && <p className="at-flagreport-en">{f.meaning}</p>}
                          {f.note && <p className="at-flagreport-note">{f.note}</p>}
                          <div className="at-flagfoot">
                            <Help>{exerciseLabel(languages, f.language, f.exercise)}</Help>
                            {/* What became of the card since. Said on the
                                tile rather than found on opening it: it is
                                what decides whether the report is still
                                worth acting on. */}
                            {state && (
                              <span
                                className={`at-flag${state.tone ? " " + state.tone : ""}`}
                                title={state.what}
                              >
                                {state.label}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                    />
                  );
                }}
              />
            </>
          )}

          {tab === "app" && (
            <>
              <p className="at-eyebrow">
                Backup
              </p>
              <Help>
                Everything on the site in one file: people and their courses, the decks, the
                cards and their recordings. Sign-in keys are held only as fingerprints, so the
                file cannot reveal anyone's key — but restoring it leaves every existing key
                working.
              </Help>
              <Help>
                Students' own progress isn't in here. It lives on their devices and syncs back by
                itself.
              </Help>

              <div className="at-row at-mt1">
                <Button variant="primary"
                  disabled={!!backup && backup.state === "running"}
                  onClick={async () => {
                    setBackup({ state: "running", done: 0, total: 0, note: "" });
                    try {
                      const { blob, manifest, problems } = await buildBackup((done, total) =>
                        setBackup({ state: "running", done, total, note: "" })
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const stamp = new Date(manifest.takenAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace(/[:T]/g, "-");
                      a.href = url;
                      a.download = `backup-${stamp}.json`;
                      a.click();
                      /* Revoking straight away can cancel the download in
                         some browsers; a moment later is soon enough. */
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                      setBackup({
                        state: "done",
                        counts: manifest.counts,
                        takenAt: manifest.takenAt,
                        note: problems.join(" "),
                      });
                    } catch (e) {
                      setBackup({ state: "failed", note: API.explain(e) });
                    }
                  }}
                >
                  {backup && backup.state === "running" ? "Working…" : "Download a backup"}
                </Button>

                <label className="at-btn ghost" style={{ cursor: "pointer" }}>
                  <Icon name="verify" />
                  Check a file
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="at-hidden"
                    onChange={async (e) => {
                      const f = e.target.files && e.target.files[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        const parsed = JSON.parse(await f.text());
                        const problems = verifyBackup(parsed);
                        setBackup({
                          state: problems.length ? "bad" : "good",
                          counts: parsed.manifest && parsed.manifest.counts,
                          takenAt: parsed.manifest && parsed.manifest.takenAt,
                          note: problems.join(" "),
                        });
                      } catch (err) {
                        setBackup({ state: "bad", note: "That file isn't readable as JSON." });
                      }
                    }}
                  />
                </label>

                <label className="at-btn ghost" style={{ cursor: "pointer" }}>
                  <Icon name="refresh" />
                  Restore a file
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="at-hidden"
                    onChange={async (e) => {
                      const f = e.target.files && e.target.files[0];
                      e.target.value = "";
                      if (!f) return;
                      let parsed;
                      try {
                        parsed = JSON.parse(await f.text());
                      } catch (err) {
                        setBackup({ state: "bad", note: "That file isn't readable as JSON." });
                        return;
                      }
                      const problems = verifyBackup(parsed);
                      const counts = (parsed.manifest && parsed.manifest.counts) || {};
                      setConfirm({
                        title: "Restore this backup?",
                        confirmLabel: "Restore",
                        confirmWord: "restore",
                        body: (
                          <>
                            <p>
                              {counts.users || 0} people, {counts.courses || 0} courses,{" "}
                              {counts.decks || 0} decks, {counts.cards || 0} cards and{" "}
                              {counts.clips || 0} recordings, taken{" "}
                              {parsed.manifest && parsed.manifest.takenAt
                                ? new Date(parsed.manifest.takenAt).toLocaleString()
                                : "at an unknown time"}
                              .
                            </p>
                            <p>
                              Everything in the file is written back over whatever has the same
                              name on the site. Anything made since the backup is left alone.
                            </p>
                            {problems.length ? (
                              <p style={{ marginBottom: 0, color: "var(--rose)" }}>
                                {problems.join(" ")}
                              </p>
                            ) : null}
                          </>
                        ),
                        action: async () => {
                          setBackup({ state: "restoring", done: 0, total: 0, note: "" });
                          const written = await restoreBackup(parsed, (done, total) =>
                            setBackup({ state: "restoring", done, total, note: "" })
                          );
                          setBackup({
                            state: "restored",
                            counts,
                            takenAt: parsed.manifest && parsed.manifest.takenAt,
                            note: `${written} records written.`,
                          });
                        },
                      });
                    }}
                  />
                </label>
              </div>

              {backup && backup.state === "restoring" && (backup.total || 0) > 0 && (
                <Help>
                  Writing {backup.done} of {backup.total} parts…
                </Help>
              )}

              {backup && backup.state === "running" && (backup.total || 0) > 0 && (
                <Help>
                  Fetching {backup.done} of {backup.total} parts…
                </Help>
              )}

              {backup && backup.counts && (
                <div className="at-sub at-mt4">
                  <p className="at-eyebrow">
                    {backup.state === "done"
                      ? "Saved"
                      : backup.state === "restored"
                      ? "Restored"
                      : backup.state === "good"
                      ? "This file looks complete"
                      : "This file has problems"}
                  </p>
                  {backup.takenAt ? (
                    <Help>
                      Taken {new Date(backup.takenAt).toLocaleString()}
                    </Help>
                  ) : null}
                  <div className="at-flags">
                    <span className="at-flag">{backup.counts.users} people</span>
                    <span className="at-flag">{backup.counts.courses} courses</span>
                    <span className="at-flag">{backup.counts.decks} decks</span>
                    <span className="at-flag">{backup.counts.cards} cards</span>
                    <span className="at-flag audio">{backup.counts.clips} recordings</span>
                  </div>
                  {backup.note ? (
                    <p
                      className="at-hint"
                      style={{
                        marginBottom: 0,
                        color: backup.state === "restored" ? undefined : "var(--rose)",
                      }}
                    >
                      {backup.note}
                    </p>
                  ) : null}
                </div>
              )}

              {backup && !backup.counts && backup.note ? (
                <p className="at-toast at-mt4">
                  {backup.note}
                </p>
              ) : null}

              <Help className="at-mt5">
                Keep the file somewhere private. It holds every name and handle on the site, and
                anyone able to restore it can change who has access.
              </Help>

              <p className="at-eyebrow at-mt6">Components</p>
              <Help>
                Every reusable component, rendered live with its variants. Worth a look before
                building anything new: if something here fits, use it rather than raw markup —
                two implementations of one thing is the failure mode this library exists to
                prevent.
              </Help>
              {/* The same button in the same place either way, so closing
                  the gallery is where opening it was rather than a scroll
                  to the far end of fifty components. */}
              <Button
                className="at-mt3"
                icon={galleryOpen ? "close" : "view"}
                onClick={() => setGalleryOpen((v) => !v)}
              >
                {galleryOpen ? "Hide the components" : "Show the components"}
              </Button>
              {galleryOpen && (
                <React.Suspense fallback={<Notice kind="busy">Loading…</Notice>}>
                  <ComponentGallery />
                </React.Suspense>
              )}

              <p className="at-eyebrow at-mt6">A question and an answer</p>
              <Help>
                Every named piece of the two practice screens, with an example of
                what it holds. Worth opening before asking for a change to either:
                naming the piece — “make question-prompt-text bigger” — says in
                three words what a description takes a paragraph to miss.
              </Help>
              <Button
                className="at-mt3"
                icon={elementsOpen ? "close" : "view"}
                onClick={() => setElementsOpen((v) => !v)}
              >
                {elementsOpen ? "Hide the elements" : "Show the elements"}
              </Button>
              {elementsOpen && (
                <React.Suspense fallback={<Notice kind="busy">Loading…</Notice>}>
                  <ScreenElements />
                </React.Suspense>
              )}
            </>
          )}
    </SpaceFrame>
  );
}

/* ------------------------------------------------------------------
   Becoming the administrator — once, from Account settings
   ------------------------------------------------------------------ */

/** @param {{ onDone: (claimed?: boolean) => void }} props */
export function ClaimAdmin({ onDone }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        I have an administrator key
      </Button>
    );

  return (
    <Field label="Administrator key">
      <input
        className="at-input"
        value={key}
        autoFocus
        onChange={(e) => {
          setKey(e.target.value);
          setError("");
        }}
      />
      <Notice kind="error">{error}</Notice>
      <div className="at-row at-mt3">
        <Button variant="primary" size="sm"
          disabled={!key.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await API.claimAdmin(key.trim());
              setOpen(false);
              onDone();
            } catch (e) {
              setError(API.explain(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Continue"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Help>
        The long string set on the server when the site was deployed. Needed once, to make this
        account the administrator.
      </Help>
    </Field>
  );
}

/* ------------------------------------------------------------------
   Mode selector

   Teaching and studying are different jobs, so they get different
   screens. Anyone with only one role never sees this.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   Teaching

   Courses, the decks in them, and the cards in those. Nothing about
   practice or progress: that is the learning side's job.
   ------------------------------------------------------------------ */

/* A blank form carries every grammatical value any language might use, so a
   card written in one language is not quietly stripped when opened in
   another. Which of them the editor actually shows is the language's call. */
const blankForm = () => ({ ar: "", en: "", lat: "", clips: [], ...dimValues({}) });

/* One answer, or several: a field per accepted answer, a + after the last
   to add another and a − on every extra. What is stored is still one
   string with " / " between the answers, so the checker and every card
   already saved are untouched; the slash a teacher used to type by hand is
   now a button. The list is local state seeded from the stored string —
   deriving it on every render would drop an added field the moment it was
   added, because an empty answer joins to nothing. */
/**
 * @param {{
 *   value?: string,
 *   onChange: (value: string) => void,
 *   render: (value: string, onChange: (v: string) => void) => Node,
 *   addLabel?: string,
 * }} props
 */
function Alternatives({ value, onChange, render, addLabel = "Add another accepted answer" }) {
  const [list, setList] = useState(() => splitAlternatives(value || ""));
  /** @param {string[]} next */
  const commit = (next) => {
    setList(next);
    onChange(joinAlternatives(next));
  };
  return (
    <div className="at-alts">
      {list.map((v, i) => (
        <div className="at-altrow" key={i}>
          <div className="at-altfield">
            {render(v, (nv) => commit(list.map((x, j) => (j === i ? nv : x))))}
          </div>
          {list.length > 1 && (
            <IconButton icon="remove" label="Remove this answer" onClick={() => commit(list.filter((_, j) => j !== i))} />
          )}
          {i === list.length - 1 && (
            <IconButton icon="add" label={addLabel} onClick={() => commit(list.concat([""]))} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ lang: Lang, value?: string, onChange: (value: string) => void }} props
 */
function ScriptInput({ lang, value, onChange }) {
  const [keys, setKeys] = useState(false);
  /** @type {React.MutableRefObject<HTMLInputElement | null>} */
  const ref = useRef(null);

  return (
    <>
      {/* The button belongs at the end of the line, which the deck's
          language decides — not the field's own dir, which is "auto" and
          would send the button across the field as soon as an English word
          was typed into an Arabic deck. */}
      <div className={`at-inputwrap${lang.direction === "rtl" ? " rtl" : ""}`}>
        <input
          ref={ref}
          className="at-input"
          lang={lang.id}
          /* The text decides, once there is any: dir="auto" lays the field out
             by its own first strong character, so a pasted Arabic phrase reads
             right-to-left even if the deck is labelled with another language.
             Trusting the deck's direction is what put pasted words in the
             wrong order. While the field is empty there is nothing to go on,
             so the language's own direction places the caret. */
          dir={value ? "auto" : lang.direction}
          /* The room for the keys button is reserved by .at-inputwrap in the
             stylesheet — physical right, not logical, because the button is
             at right:8px whichever way the text runs. */
          style={{ fontFamily: lang.fontStack, fontSize: 22, textAlign: "start", ...scriptVars(lang) }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <KeysButton on={keys} onClick={() => setKeys((v) => !v)} />
      </div>
      {keys && (
        <div className="at-keypad" dir={lang.direction}>
          {lang.keys.rows
            .flat()
            .concat(lang.keys.extras)
            .map((k, i) => (
              <button
                key={i}
                className="at-key"
                style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}
                onClick={() => {
                  onChange(value + k);
                  if (ref.current) ref.current.focus();
                }}
              >
                {k}
              </button>
            ))}
          {lang.keys.marks.map((m, i) => (
            <button
              key={"m" + i}
              className="at-key mark"
              onClick={() => {
                onChange(value + m);
                if (ref.current) ref.current.focus();
              }}
            >
              {"\u25CC" + m}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** @param {Blob} blob */
async function hashOf(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** @param {Blob} blob */
function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read-failed"));
    r.readAsDataURL(blob);
  });
}

/* Clips are addressed by the hash of their contents, so the same
   recording published twice is stored once. */
/* ------------------------------------------------------------------
   A card at a glance

   The same tile wherever cards are listed — the Cards tab, and inside an
   open deck — so the two cannot drift into looking like different things.
   ------------------------------------------------------------------ */

/* One thing, as a tile: a deck, a course, a person. Title, a line of facts,
   optional actions, and a slot under the rule for whatever matters where it
   is being shown. Six near-identical copies of this used to exist. */
/* ------------------------------------------------------------------
   Choosing which decks a course carries

   Membership is a property of the deck, and deck settings is still where a
   single deck says which courses it belongs to. But when the question comes
   from the other direction — "what should this course teach?" — sending
   someone off to visit each deck in turn is the wrong shape. Same data,
   same two calls underneath; this just asks the question the other way
   round, and only writes what actually changed.
   ------------------------------------------------------------------ */

/**
 * @param {{
 *   course: Course,
 *   decks: Deck[],
 *   langOfDeck: (deck: Deck) => string,
 *   busy?: boolean,
 *   onSave: (added: string[], removed: string[]) => void,
 *   onClose: () => void,
 * }} props
 */
function DeckPicker({ course, decks, langOfDeck, busy, onSave, onClose }) {
  /** @type {(d: Deck) => boolean} */
  const inCourse = (d) => (d.courses || []).some((l) => l.courseId === course.id);
  const [chosen, setChosen] = useState(() => new Set(decks.filter(inCourse).map((d) => d.id)));
  const [query, setQuery] = useState("");

  const was = new Set(decks.filter(inCourse).map((d) => d.id));
  const added = [...chosen].filter((id) => !was.has(id));
  const removed = [...was].filter((id) => !chosen.has(id));
  const dirty = added.length + removed.length > 0;

  const q = query.trim().toLowerCase();
  const shown = q ? decks.filter((d) => d.title.toLowerCase().includes(q)) : decks;

  return (
    <Screen
      title={"Decks in this course"}
      onBack={onClose}
      action={
        <Button variant="primary" size="sm"
          disabled={!dirty || busy}
          onClick={() => onSave(added, removed)}
        >
          <Icon name="save" />
          {busy ? "Saving…" : "Save"}
        </Button>
      }
    >
          <Help>
            Tick the decks {course.title} should teach. Students see them at their next check.
          </Help>

          <div className="at-toolbar at-toolbar-top">
            <input
              className="at-input at-search"
              type="search"
              placeholder="Search decks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <CheckList
            options={shown.map((d) => ({
              id: d.id,
              title: d.title,
              note: `${langOfDeck(d)} · ${plural(d.cardCount || 0, "card")}`,
            }))}
            chosen={[...chosen]}
            onToggle={(id) =>
              setChosen((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            empty={query ? `No decks match "${query}".` : "You have no decks yet."}
          />

          {dirty && (
            <Help>
              {added.length ? `${added.length} to add. ` : ""}
              {removed.length ? `${removed.length} to remove. ` : ""}
              Nothing changes until you save.
            </Help>
          )}
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Naming a deck

   Same shape as the card editor — full screen, back at the top left, save
   at the top right — so the two feel like one app rather than two.
   ------------------------------------------------------------------ */

/**
 * @param {{
 *   deck: Deck | null,
 *   choices: Record<LangId, Lang>,
 *   mustAsk?: boolean,
 *   initialLang?: LangId,
 *   busy?: boolean,
 *   courses?: Course[],
 *   languages: Record<LangId, Lang>,
 *   onSave: (title: string, lang: LangId, picked: string[]) => void,
 *   onClose: () => void,
 * }} props
 */
function DeckEditor({
  deck,
  choices,
  mustAsk,
  initialLang,
  busy,
  courses,
  languages,
  onSave,
  onClose,
}) {
  const [title, setTitle] = useState((deck && deck.title) || "");
  const [lang, setLang] = useState((deck && deck.lang) || initialLang || "");
  /* Which courses are ticked, held here rather than read off the deck.
     Read off the deck it could not change: the deck handed in is the copy
     taken when the screen opened, so a tick saved to the server left the
     box exactly as it was until you closed the screen and came back. */
  const wasIn = (deck && deck.courses ? deck.courses : []).map((l) => l.courseId);
  const [picked, setPicked] = useState(() => new Set(wasIn));
  const added = [...picked].filter((id) => !wasIn.includes(id));
  const removed = wasIn.filter((id) => !picked.has(id));
  const dirty = added.length > 0 || removed.length > 0;
  const asking = !deck && mustAsk;
  const canSave = title.trim() && (!asking || lang);

  return (
    <Screen
      title={deck ? "Deck settings" : "New deck"}
      onBack={onClose}
      action={
        <Button variant="primary" size="sm"
          disabled={!canSave || busy}
          onClick={() => onSave(title.trim(), lang, [...picked])}
          icon="save"
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      }
    >
          <Field label={<>Title <span className="req">required</span></>}>
            <input
              className="at-input"
              placeholder="e.g. Week 3 · Verbs"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          {asking && (
            <>
              <LanguageRadio languages={choices} value={lang} onChange={setLang} label="Language" />
              <Help>
                A deck holds cards in one language, and this sets the script and keyboard its
                cards are written with.
              </Help>
            </>
          )}

          {!canSave && (
            <Help>
              {!title.trim() ? "A deck needs a title." : "Choose the language it holds."}
            </Help>
          )}

          {/* Which courses carry it. Ticking one used to reach the server on
              the tap and announce itself as done, which made Save mean two
              different things on one screen — and gave a student a deck
              before the teacher had finished deciding. Now it is a choice
              like the title, and the screen saves once. */}
          {deck && (
            <>
              <p className="at-eyebrow at-mt6">
                Courses using it
              </p>
              <Help>
                Tick a course to share this deck with its students. Untick to take it back.
              </Help>
              <div className="at-cklist">
                {(courses || []).map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <button
                      key={c.id}
                      className={`at-ck${on ? " on" : ""}`}
                      disabled={busy}
                      onClick={() =>
                        setPicked((was) => {
                          const next = new Set(was);
                          if (on) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    >
                      <span className="at-ckbox">{on ? "✓" : ""}</span>
                      <span className="at-cktext">
                        <b>{c.title}</b>
                        <i>
                          {languageName(languages, c.language)} · {plural(c.students.length, "student")}
                        </i>
                      </span>
                    </button>
                  );
                })}
                {!(courses || []).length && (
                  <Help>
                    You aren't teaching a course yet.
                  </Help>
                )}
              </div>
              <Help>
                A deck in no course is yours alone — nobody studying can see it.
              </Help>
              {/* The same sentence the other screen that defers its writes
                  uses, in the same words, so the two teach one rule. */}
              {dirty && (
                <Help>
                  {added.length ? `${plural(added.length, "course")} to add. ` : ""}
                  {removed.length ? `${plural(removed.length, "course")} to remove. ` : ""}
                  Nothing changes until you save.
                </Help>
              )}
            </>
          )}
    </Screen>
  );
}

/**
 * @param {{ clips?: string[], onChange: (clips: string[]) => void }} props
 */
function Recordings({ clips, onChange }) {

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  /** @type {React.MutableRefObject<MediaRecorder | null>} */
  const rec = useRef(null);
  /** @type {React.MutableRefObject<ReturnType<typeof setInterval> | null>} */
  const tick = useRef(null);
  const list = clips || [];

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
  }, []);

  /** @param {Blob} blob */
  async function store(blob) {
    setBusy("Saving…");
    try {
      const hash = await hashOf(blob);
      await API.putClip(hash, await blobToDataUrl(blob));
      onChange(list.concat([hash]));
    } catch (e) {
      setError(API.explain(e));
    } finally {
      setBusy("");
    }
  }

  async function begin() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("This browser won't let the app use the microphone");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      /** @type {Blob[]} */
    const chunks = [];
      mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        store(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      rec.current = mr;
      setElapsed(0);
      setRecording(true);
      const from = Date.now();
      tick.current = setInterval(() => setElapsed(Date.now() - from), 100);
      mr.start();
      setTimeout(() => mr.state !== "inactive" && end(), 15000);
    } catch (e) {
      setError(
        String(e && /** @type {any} */ (e).name) === "NotAllowedError"
          ? "Microphone permission was refused"
          : "Couldn't reach the microphone"
      );
    }
  }

  function end() {
    if (tick.current) clearInterval(tick.current);
    setRecording(false);
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }

  return (
    <Field label="Recordings">

      <ClipList clips={list} onChange={(next) => onChange(/** @type {any} */ (next))} />

      <div className="at-chips" style={{ marginTop: list.length ? 10 : 0 }}>
        {recording ? (
          <Button variant="danger" size="sm" onClick={end} icon="pause">Stop — {(elapsed / 1000).toFixed(1)}s</Button>
        ) : (
          <Button size="sm" onClick={begin} disabled={!!busy} icon="mic">{busy || "Record"}</Button>
        )}
        <label className="at-btn sm ghost">
          <Icon name="download" />
          Upload a file
          <input
            type="file"
            accept="audio/*"
            className="at-hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) store(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <Notice kind="error">{error}</Notice>
      {!error && !list.length && (
        <Help>
          A recording lets this form be practiced by ear as well as by sight.
        </Help>
      )}
    </Field>
  );
}

/*
 * Which words a phrase teaches.
 *
 * Shown only on a card that is a phrase or a sentence, because a single
 * word does not contain anything. The app proposes — every word card whose
 * text it can find inside this one — and the teacher accepts. It is
 * deliberately not automatic: finding a word inside another is done by
 * peeling prefixes, and in Arabic that occasionally lands on a different
 * real word. A wrong pairing would reach a learner as a question with no
 * right answer.
 *
 * A pairing already accepted stays whichever way the matcher later votes,
 * so improving the matcher can never silently drop a teacher's decision.
 */
/**
 * @param {{
 *   lang: Lang,
 *   text: string,
 *   cards: Card[],
 *   selfId?: string,
 *   chosen: string[],
 *   onChange: (ids: string[]) => void,
 * }} props
 */
function WordsUsed({ lang, text, cards, selfId, chosen, onChange }) {
  const kind = guessKind(text, lang);
  const suggestions = useMemo(() => {
    if (!supportsContext(lang) || kind === "word" || !text.trim()) return [];
    return (cards || [])
      .filter((c) => c.id && c.id !== selfId && c.ar)
      .filter((c) => guessKind(c.ar, lang) === "word")
      .filter((c) => findWordSlot(text, c.ar, lang) >= 0)
      .slice(0, 24);
  }, [cards, lang, text, selfId, kind]);

  /* Anything ticked that the matcher no longer proposes — the phrase was
     edited, or it was ticked when the wording was different. It has to stay
     listed or there would be no way to untick it. */
  const kept = (chosen || []).filter((id) => !suggestions.some((c) => c.id === id));
  const keptCards = (cards || []).filter((c) => kept.includes(c.id));

  if (!supportsContext(lang) || kind === "word") return null;
  if (!suggestions.length && !keptCards.length) {
    return (
      <div className="at-formblock at-mt5">
        <p className="at-eyebrow">Words this teaches</p>
        <Help>
          None of your single-word cards appear in this one. Add the word on its own card and it
          will be offered here.
        </Help>
      </div>
    );
  }

  const options = suggestions.concat(keptCards).map((c) => ({
    id: c.id,
    title: c.ar,
    note: c.en || "",
  }));

  return (
    <div className="at-formblock at-mt5">
      <p className="at-eyebrow">Words this teaches</p>
      <Help>
        Tick the words this phrase is a good example of. Each one gets practiced inside this phrase
        as well as on its own — which is how a word is met in more than one place without anything
        being invented.
      </Help>
      <CheckList
        options={options}
        chosen={chosen || []}
        onToggle={(id, on) => onChange(on ? chosen.filter((x) => x !== id) : chosen.concat([id]))}
      />
    </div>
  );
}

/**
 * @param {{
 *   card: Card | null,
 *   lang: Lang,
 *   decks: Deck[],
 *   inDecks?: string[],
 *   allCards: Card[],
 *   onSave: (forms: any, note: string, decks: string[], uses: string[]) => void,
 *   onDelete?: () => void,
 *   onClose: () => void,
 *   busy?: boolean,
 *   confirming?: Node,
 * }} props
 */
function CardEditor({ card, lang, decks, inDecks, allCards, onSave, onDelete, onClose, busy, confirming }) {
  /* The axes this language uses, straight from its declaration. Arabic gets
     number and gender; Huế gets the addressee and no gender at all. */
  const dims = dimsOf(lang || LANGUAGES[DEFAULT_LANGUAGE]);
  const drillsTranslit = (lang || {}).translitDrilled !== false;
  const [forms, setForms] = useState(() =>
    card
      ? [
          {
            ar: card.ar || "",
            en: card.en || "",
            lat: card.lat || "",
            ...dimValues(card),
            clips: card.clips || [],
          },
          ...(card.subs || []).map((s) => ({ ...blankForm(), ...s })),
        ]
      : [blankForm()]
  );
  const [note] = useState((card && card.note) || "");
  const [chosen, setChosen] = useState(inDecks || []);
  /* Which words this phrase teaches. Confirmed, never assumed: the matcher
     below proposes and the teacher decides, because peeling prefixes off an
     Arabic word occasionally lands on a different real one. */
  const [uses, setUses] = useState((card && card.uses) || []);

  const main = forms[0];
  /* English, not "English or a transliteration": with typing the
     transliteration retired, a card carrying only the script and a
     romanisation supports one exercise type, and no student could ever
     practice it. Better to say so here than to save something inert. */
  const canSave = main.ar.trim() && main.en.trim();
  /** @type {(i: number, next: any) => void} */
  const setForm = (i, next) => setForms((f) => f.map((x, j) => (j === i ? next : x)));

  return (
    /* "over" puts this above the mode selector and the corner menu, so
       editing a card is the only thing on screen. */
    <>
      {confirming}
      <Screen
        title={card ? "Edit card" : "New card"}
        onBack={onClose}
        action={
          <Button variant="primary" size="sm"
            disabled={!canSave || busy}
            onClick={() => onSave(forms, note, chosen, uses)}
          >
            <Icon name="save" />
            {busy ? "Saving…" : "Save"}
          </Button>
        }
      >
          {forms.map((f, i) => (
            <div className={`at-formblock${i === 0 ? " main" : ""}`} key={i}>
              <div className="at-formhead">
                <span className="at-formnum">Form {i + 1}</span>
                <span className="at-formrole">
                  {i === 0 ? "the main form" : "another form of the same card"}
                </span>
                {/* Kept together so the pair stays whole and the role text
                    beside them shortens instead of collapsing into a column. */}
                <span className="at-formacts">
                  {/* A second form usually differs from the first in a field
                      or two, so start it from the one in hand rather than
                      empty. The copy lands directly beneath its source, where
                      the eye already is. Recordings are not carried over: the
                      copy is a different word, so the original's audio would
                      be wrong for it, and a wrong recording is worse than a
                      missing one. */}
                  <Button variant="ghost" size="sm"
                    onClick={() =>
                      setForms((x) =>
                        x
                          .slice(0, i + 1)
                          .concat([{ ...x[i], clips: [] }])
                          .concat(x.slice(i + 1))
                      )
                    }
                  >
                    Duplicate
                  </Button>
                  {i > 0 && (
                    <Button variant="ghost" size="sm"
                      onClick={() => setForms((x) => x.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </div>

              <p className="at-groupline">Drilled in exercises</p>

              {/* What this form needs, next to the fields it's about. */}
              {i === 0 && (
                <p className={`at-formneed${canSave ? "" : " unmet"}`}>
                  {lang.scriptLabel} plus English.
                </p>
              )}

              <Field label={lang.scriptLabel}>
                <Alternatives
                  value={f.ar}
                  onChange={(v) => setForm(i, { ...f, ar: v })}
                  render={(v, set) => <ScriptInput lang={lang} value={v} onChange={set} />}
                />
              </Field>

              <Field label="English">
                <Alternatives
                  value={f.en}
                  onChange={(v) => setForm(i, { ...f, en: v })}
                  render={(v, set) => (
                    <input className="at-input" value={v} onChange={(e) => set(e.target.value)} />
                  )}
                />
              </Field>

              {/* Only where the language drills it. Vietnamese is already in
                  the Latin alphabet, so its note is reference, not an
                  exercise — it sits below with the rest. */}
              {drillsTranslit && (
                <Field label={lang.translitLabel}>
                  <input
                    className="at-input"
                    value={f.lat}
                    onChange={(e) => setForm(i, { ...f, lat: e.target.value })}
                  />
                </Field>
              )}

              <div className="at-field">
                <Recordings clips={f.clips} onChange={(v) => setForm(i, { ...f, clips: v })} />
              </div>

              {(!drillsTranslit || dims.length || (i === 0 && lang.lexical)) && (
                <>
                  <p className="at-groupline">Reference — not drilled</p>

                  {!drillsTranslit && (
                    <Field label={lang.translitLabel}>
                      <input
                        className="at-input"
                        value={f.lat}
                        onChange={(e) => setForm(i, { ...f, lat: e.target.value })}
                      />
                    </Field>
                  )}

                  {/* Number and gender name which form this is; nothing asks
                      the student for them. */}
                  {dims.map((dim) => (
                    <Field label={dim.label} key={dim.field}>
                      <Segmented
                        label={dim.label}
                        options={dim.options.map(([value, label]) => ({ value, label }))}
                        value={/** @type {any} */ (f)[dim.field]}
                        onChange={(v) =>
                          setForm(i, {
                            ...f,
                            [dim.field]: !dim.required && /** @type {any} */ (f)[dim.field] === v ? "" : v,
                          })
                        }
                      />
                    </Field>
                  ))}

                  {i === 0 && lang && lang.lexical && (
                    <Field label={lang.lexical.label}>
                      <input
                        className="at-input"
                        value={/** @type {any} */ (f)[lang.lexical.key] || ""}
                        placeholder={lang.lexical.help || ""}
                        onChange={(e) => setForm(i, { ...f, [lang.lexical ? lang.lexical.key : ""]: e.target.value })}
                      />
                    </Field>
                  )}
                </>
              )}
            </div>
          ))}

          <Button variant="ghost" size="sm"
            /* No number override: blankForm takes the language's declared
               default, so what a new form starts as is settled in one place. */
            onClick={() => setForms((f) => f.concat([blankForm()]))}
          icon="add"
        >
          Add a form
        </Button>

          <div className="at-formblock at-mt5">
            <div className="at-formhead">
              <span className="at-formnum">Decks</span>
            </div>
            {/* The note is hidden rather than removed: cards that already
                carry one keep it, and it still saves, so nothing is lost if
                the field comes back. */}
            <div className="at-field">
              <Help>
                {(decks || []).length
                  ? "Tick every deck this card should belong in. Students only see the card if it's in a deck used in their course."
                  : "You have no decks yet. Make one under Decks, then this card can go in it."}
              </Help>
              <CheckList
                options={(decks || []).map((d) => ({
                  id: d.id,
                  title: d.title,
                  note: plural(d.cardCount || 0, "card"),
                }))}
                chosen={chosen}
                onToggle={(id, on) =>
                  setChosen((x) => (on ? x.filter((y) => y !== id) : x.concat([id])))
                }
              />
            </div>
          </div>

          <WordsUsed
            lang={lang}
            text={main.ar}
            cards={allCards}
            selfId={(card && card.id) || ""}
            chosen={uses}
            onChange={setUses}
          />

          {card && onDelete && (
            <Button variant="danger" className="at-mt5" onClick={onDelete}>
              Delete this card
            </Button>
          )}
      </Screen>
    </>
  );
}

/*
 * How much of a deck can already be practiced in context.
 *
 * A phrase the teacher recorded that contains a word the teacher also
 * teaches is a context for that word — the one kind of variety this app can
 * offer without inventing content. This counts how much of that is sitting
 * in a deck already, so the question "is it worth building the exercises
 * that would use it?" is answered from real material instead of a guess.
 *
 * Read-only. It writes nothing and suggests nothing; the whole job is the
 * number at the top.
 */
/*
 * `lang` is as much of a pack as there is, not a whole one: the first
 * thing this does is say so when the language describes no way to find a
 * word inside a phrase, and a prop typed `Lang` would make that branch
 * unreachable — which is the opposite of the point.
 */
/** @param {{ cards: Card[], lang: Partial<Lang> }} props */
function ContextReport({ cards, lang }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => contextCoverage(cards, lang), [cards, lang]);

  if (!supportsContext(lang)) {
    return (
      <Help>
        {(lang || {}).name || "This language"} does not describe how to find a word inside a
        phrase, so nothing here can be measured yet.
      </Help>
    );
  }

  const { counts, covered, links, words } = report;
  const total = words.length;
  const withContext = words.filter((w) => w.contexts.length > 0);
  const bare = words.filter((w) => w.contexts.length === 0);

  return (
    <>
      <Lede>
        {total === 0
          ? "No single-word cards in this deck yet."
          : `${covered} of ${plural(total, "word")} appear in at least one phrase you have recorded.`}
      </Lede>
      <Help>
        {plural(counts.word, "word")} · {plural(counts.phrase, "phrase")} ·{" "}
        {plural(counts.sentence, "sentence")}
        {links ? ` · ${plural(links, "pairing")} in all` : ""}
      </Help>

      {total > 0 && (
        <>
          <Button
            className="at-mt3"
            size="sm"
            icon={open ? "chevronUp" : "chevronDown"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide the pairings" : "Show the pairings"}
          </Button>
          {open && (
            <div className="at-mt3">
              {withContext.map((w) => (
                <div className="at-ctxrow" key={w.id}>
                  <p className="at-ctxword">
                    <b lang={lang.id} dir={lang.direction} style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}>
                      {w.ar}
                    </b>
                    <i>{w.en}</i>
                  </p>
                  <ul className="at-ctxlist">
                    {w.contexts.map((c) => (
                      <li key={c.id}>
                        <span lang={lang.id} dir={lang.direction} style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}>
                          {c.ar}
                        </span>
                        <em>{c.en}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {open && bare.length > 0 && (
        /* The actionable half. "3 of 4" says how rich the deck is; this says
           which word to record a phrase for next. */
        <div className="at-mt4">
          <p className="at-eyebrow">Not in any phrase yet</p>
          <div className="at-ctxbare">
            {bare.map((w) => (
              <span key={w.id}>
                <b lang={lang.id} dir={lang.direction} style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}>
                  {w.ar}
                </b>
                <i>{w.en}</i>
              </span>
            ))}
          </div>
        </div>
      )}

      {total > 0 && covered === 0 && (
        <Help className="at-mt3">
          Nothing to pair yet. It grows on its own as you add phrases that use words already in the
          deck — each phrase becomes a context for every word inside it.
        </Help>
      )}
    </>
  );
}

/* ------------------------------------------------------------------
   Ordering and narrowing a list of cards

   Kept as plain functions of a card so they can be tested without a
   browser, and so the two card lists — the Cards tab and an open deck —
   can share one answer to "does this card have a recording".
   ------------------------------------------------------------------ */

/* Recordings live on each form, not on the card, so a card counts as having
   one if any of its forms does. */
/** @type {(c: Card) => boolean} */
export const cardHasAudio = (c) =>
  ((c.clips || []).length > 0) || (c.subs || []).some((sb) => (sb.clips || []).length > 0);

/* The main form is a form. A card with two subs has three. */
/** @type {(c: Card) => number} */
export const cardFormCount = (c) => 1 + (c.subs || []).length;

/*
 * When a card was added.
 *
 * Cards made before the server stamped `created` have none, and falling
 * back to `updated` is the closest true thing available: for a card never
 * edited it is exactly when it was made, and for one that has been it is an
 * upper bound. Backfilling would have been worse — it would have written
 * today's date over the answer.
 */
/** @type {(c: Card) => number} */
export const cardAdded = (c) => c.created || c.updated || 0;
/** @type {(c: Card) => number} */
export const cardChanged = (c) => c.updated || c.created || 0;

/** @type {Record<string, { label: string, of: (c: Card) => any, numeric?: boolean, then?: (c: Card) => any }>} */
export const CARD_SORTS = {
  added: { label: "Added", of: cardAdded, numeric: true },
  changed: { label: "Changed", of: cardChanged, numeric: true },
  /* Ordering by a yes/no puts one group first and leaves the other
     untouched behind it, so a second key decides within each group —
     otherwise the order inside a group would be whatever the server
     happened to return. */
  audio: { label: "Recordings", of: (/** @type {Card} */ c) => (cardHasAudio(c) ? 1 : 0), then: cardChanged },
  forms: { label: "Forms", of: cardFormCount, then: cardChanged },
};

/**
 * @param {Card[]} cards
 * @param {string} key
 * @param {boolean} [newestFirst]
 */
export function sortCards(cards, key, newestFirst = true) {
  const sort = CARD_SORTS[key || ""];
  if (!sort) return cards;
  const dir = newestFirst ? -1 : 1;
  return [...cards].sort((a, b) => {
    const d = (sort.of(a) - sort.of(b)) * dir;
    if (d) return d;
    if (!sort.then) return 0;
    return (sort.then(a) - sort.then(b)) * -1;
  });
}

/**
 * @param {Card[]} cards
 * @param {{ audio?: string, forms?: string }} [filters]
 */
export function filterCards(cards, { audio = "any", forms = "any" } = {}) {
  return cards.filter((c) => {
    if (audio === "with" && !cardHasAudio(c)) return false;
    if (audio === "without" && cardHasAudio(c)) return false;
    if (forms === "one" && cardFormCount(c) !== 1) return false;
    if (forms === "several" && cardFormCount(c) < 2) return false;
    return true;
  });
}

/** @param {{ account: User, languages: Record<LangId, Lang>, onClose: () => void }} props */
export function TeachSpace({ account, languages, onClose }) {
  /* What this space was showing when it was last left — see lastShown.
     Asked once, at the first render: recall forgets another person's
     contents when it is asked for them, which is not something to do
     again on every keystroke. */
  /** @type {React.MutableRefObject<{ courses: Course[], decks: Deck[], cards: Card[] } | null>} */
  const held = useRef(null);
  if (held.current === null) held.current = recallSpace("teach", account.handle) || false;
  /** @type {{ courses: Course[], decks: Deck[], cards: Card[] } | null} */
  const last = held.current || null;
  const [tab, setTab] = useState("courses");
  const [courses, setCourses] = useState(/** @type {Course[]} */ (last ? last.courses : []));
  const [decks, setDecks] = useState(/** @type {Deck[]} */ (last ? last.decks : []));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [courseView, setCourseView] = useState(/** @type {any | null} */ (null));
  const [openDeck, setOpenDeck] = useState(/** @type {any | null} */ (null));
  const [cards, setCards] = useState(/** @type {Card[]} */ (last ? last.cards : []));
  const [editing, setEditing] = useState(
    /** @type {{ card: Card | null, decks: string[], lang?: LangId } | null} */ (null)
  ); // {card|null, decks:[], lang}
  const [naming, setNaming] = useState(/** @type {any | null} */ (null)); // "new" | deck
  const [confirm, setConfirm] = useState(/** @type {Pending | null} */ (null)); // whatever is awaiting a yes
  const [viewing, setViewing] = useState(/** @type {any} */ (null)); // a card being read, not edited
  const [selCards, setSelCards] = useState(() => new Set());
  const [cardAction, setCardAction] = useState(/** @type {"add" | "remove" | null} */ (null)); // "add" | "remove"
  const [newCardLang, setNewCardLang] = useState(/** @type {LangId | null} */ (null));
  const [managingDecks, setManagingDecks] = useState(/** @type {string | null} */ (null)); // a course id
  /* Already teaching something? Then this is a rare errand, folded away. */
  const [joinNote, setJoinNote] = useState("");
  const [selDecks, setSelDecks] = useState(() => new Set());
  const [deckAction, setDeckAction] = useState(/** @type {"add" | "remove" | null} */ (null)); // "add" | "remove"
  const [pickedDecks, setPickedDecks] = useState(/** @type {string[]} */ ([]));
  const [pickedCourses, setPickedCourses] = useState(/** @type {string[]} */ ([]));

  const refresh = useCallback(async (/** @type {boolean} */ background = false) => {
    if (!background) setBusy(true);
    try {
      /* pullTeaching takes what arrives and says what didn't, so a failing
         call leaves the rest of the screen standing. It is the same fetch
         Sync now makes for this space when it is not the one open. */
      const fresh = await pullTeaching(account.handle);
      setCourses(fresh.courses);
      setDecks(fresh.decks);
      setCards(fresh.cards);
      if (!background || !fresh.failed) setError(fresh.failed ? API.explain(fresh.failed) : "");
    } catch (e) {
      if (!background) setError(API.explain(e));
    } finally {
      if (!background) setBusy(false);
    }
  }, [account.handle]);

  /* See AdminSpace: how this mount arrived, read once. Arriving with the
     last contents means the check for what has changed runs quietly. */
  const arrivedWithSomething = useRef(Boolean(last));
  useEffect(() => {
    refresh(arrivedWithSomething.current);
  }, [refresh]);

  /* Fed from the state, so a card saved or a deck renamed is what comes
     back next time, not what the last fetch happened to return. */
  useEffect(() => {
    rememberSpace("teach", account.handle, { courses, decks, cards });
  }, [account.handle, courses, decks, cards]);

  /* What Sync now fetched for this space, when this space is the one being
     looked at. See AdminSpace. */
  useFreshSpace("teach", account.handle, (shown) => {
    setCourses(shown.courses);
    setDecks(shown.decks);
    setCards(shown.cards);
    setError("");
  });

  /* Courses are changed by the administrator elsewhere. Without this, a course
     that has been deleted — and the decks and cards that went with it — stays
     on screen until the app is reloaded. */
  const backgroundRefresh = useCallback(() => refresh(true), [refresh]);
  useLiveRefresh(backgroundRefresh);

  /* The languages this person actually teaches. One means nothing to ask
     about; several mean every new deck and card has to say which it is. */
  const teachingLangs = useMemo(() => {
    /** @type {string[]} */
  const ids = [];
    for (const c of courses) {
      if (c.language && languages[c.language] && !ids.includes(c.language)) ids.push(c.language);
    }
    return ids;
  }, [courses, languages]);
  /* If the courses say nothing, the decks already made may still say it.
     Falling back here means a teacher with one course is never asked, even
     while that course's language is still being sorted out. */
  const knownLangs = useMemo(() => {
    if (teachingLangs.length) return teachingLangs;
    /** @type {string[]} */
  const ids = [];
    for (const d of decks) {
      if (d.lang && languages[d.lang] && !ids.includes(d.lang)) ids.push(d.lang);
    }
    return ids;
  }, [teachingLangs, decks, languages]);

  const multiLang = knownLangs.length > 1;
  /* Exactly one known language is the only case where there is nothing to
     ask. None is not the same as one: it means nothing has said yet, and
     guessing silently is how every card ended up in the wrong script. */
  const mustAsk = knownLangs.length !== 1;
  const soleLang = knownLangs[0] || Object.keys(languages)[0];
  const taught = useMemo(
    () =>
      knownLangs.length
        ? Object.fromEntries(knownLangs.map((id) => [id, languages[id]]))
        : languages,
    [knownLangs, languages]
  );

  const snack = useSnackbar();
  /* How the card list is ordered and what it leaves out. Newest first by
     default, because the card just made is the one most likely wanted. */
  const [sortKey, setSortKey] = useState("changed");
  const [newestFirst, setNewestFirst] = useState(true);
  const [cardFilter, setCardFilter] = useState({ audio: "any", forms: "any" });
  /* Narrowed then ordered. ItemList's own search runs after this, over what
     is left, so a search inside a filter behaves the way it reads. */
  const shownCards = useMemo(
    () => sortCards(filterCards(cards, cardFilter), sortKey, newestFirst),
    [cards, cardFilter, sortKey, newestFirst]
  );

  /* See the note on AdminSpace's run: `done` is the confirmation, and may
     be a function of what the call returned. */
  /**
   * @param {() => Promise<any>} fn
   * @param {string | ((out: any) => string)} [done]
   */
  async function run(fn, done) {
    setBusy(true);
    try {
      const out = await fn();
      setError("");
      if (done) snack(typeof done === "function" ? done(out) : done, "good");
    } catch (e) {
      setError(API.explain(e));
    } finally {
      setBusy(false);
    }
  }

  /* What the server answers to a save or a delete is enough to bring the
     lists up to date here, so nothing needs fetching again. A save used to
     be followed by three more requests, each reading every deck and course
     on the site; the background check still runs, so the lists cannot drift
     for long even if something here is missed. */
  /** @param {any} r */
  function absorbSaved(r) {
    const card = r && r.card;
    if (!card) return;
    setCards((prev) => {
      const i = prev.findIndex((c) => c.id === card.id);
      const next = { ...card, decks: card.decks || [] };
      if (i < 0) return prev.concat([next]);
      const out = prev.slice();
      out[i] = next;
      return out;
    });
    absorbDecks(r.decks);
  }

  /** @param {Deck[]} records */
  function absorbDecks(records) {
    if (!Array.isArray(records) || !records.length) return;
    setDecks((prev) =>
      prev.map((d) => {
        const fresh = records.find((x) => x.id === d.id);
        return fresh ? { ...d, ...fresh, cardCount: (fresh.cardIds || []).length } : d;
      })
    );
  }

  /** @param {string[]} ids */
  function absorbDeleted(ids) {
    const gone = new Set(ids);
    if (!gone.size) return;
    setCards((prev) => prev.filter((c) => !gone.has(c.id)));
    setDecks((prev) =>
      prev.map((d) => {
        const ids2 = (d.cardIds || []).filter((x) => !gone.has(x));
        return ids2.length === (d.cardIds || []).length
          ? d
          : { ...d, cardIds: ids2, cardCount: ids2.length };
      })
    );
  }

  /** @type {(deck: Deck) => Lang | undefined} */
  const langOfDeck = (deck) => {
    if (deck && deck.lang && languages[deck.lang]) return languages[deck.lang];
    for (const link of (deck && deck.courses) || []) {
      const c = courses.find((x) => x.id === link.courseId);
      if (c && languages[c.language]) return languages[c.language];
    }
    return languages[soleLang] || languages[Object.keys(languages)[0]];
  };

  /** @type {(card: Card) => Lang | undefined} */
  const langOfCard = (card) =>
    (card && card.lang && languages[card.lang]) ||
    langOfDeck(decks.find((d) => ((card && card.decks) || []).includes(d.id)) || /** @type {any} */ ({}));

  /* ---- naming a deck takes over the screen, like a card ---- */
  if (naming) {
    const existing = naming === "new" ? null : naming;
    return (
      <DeckEditor
        deck={existing}
        choices={taught}
        mustAsk={mustAsk}
        initialLang={knownLangs.length === 1 ? soleLang : ""}
        busy={busy}
        courses={courses}
        languages={languages}
        onClose={() => setNaming(null)}
        /* Everything the screen holds, written in one go. The courses used
           to be written on the tap, which is why the screen had both a Save
           button and changes that ignored it. */
        onSave={(title, lang, picked) =>
          run(
            async () => {
              if (!existing) {
                await API.createDeck(title, "", lang || soleLang);
              } else {
                if (title !== existing.title) await API.renameDeck(existing.id, title);
                const was = (existing.courses || []).map((/** @type {any} */ l) => l.courseId);
                for (const id of picked) if (!was.includes(id)) await API.attachDeck(existing.id, id);
                for (const id of was) if (!picked.includes(id)) await API.detachDeck(existing.id, id);
              }
              setNaming(null);
              await refresh();
            },
            `${title} ${existing ? "saved" : "created"}`
          )
        }
      />
    );
  }

  /* ---- the card editor takes over the screen ---- */
  if (editing) {
    const forDeck = editing.decks[0]
      ? decks.find((d) => d.id === editing.decks[0])
      : decks[0] || { courses: [] };
    /* An explicit choice wins, then the card's own language, then the deck it
       is going into. With one language taught there is never a choice. */
    const editLang =
      (editing.lang && languages[editing.lang]) ||
      (editing.card ? langOfCard(editing.card) : langOfDeck(forDeck || /** @type {any} */ ({ courses: [] })));
    return (
      <CardEditor
        card={editing.card}
        lang={editLang || LANGUAGES[DEFAULT_LANGUAGE]}
        decks={decks}
        inDecks={editing.decks}
        busy={busy}
        onClose={() => setEditing(null)}
        allCards={cards}
        onSave={(forms, note, inDecks, uses) =>
          run(
            async () => {
              const [main, ...subs] = forms;
              const r = await API.saveCard(
                {
                  id: editing.card ? editing.card.id : "",
                  ar: main.ar.trim(),
                  en: main.en.trim(),
                  lat: main.lat.trim(),
                  ...dimValues(main),
                  clips: main.clips || [],
                  note: note.trim(),
                  lang: (editLang || {}).id || "",
                  uses,
                  subs: subs.filter((/** @type {any} */ f) => f.ar.trim() || f.en.trim()),
                },
                inDecks
              );
              absorbSaved(r);
              setEditing(null);
              return main;
            },
            /* Named, because the editor closes on save: without the word
               back there is nothing left on screen to confirm which card
               it was. English first — it is the one field a teacher can
               always read at a glance. */
            (main) => `${main.en.trim() || main.ar.trim() || "Card"} saved`
          )
        }
        onDelete={
          editing.card
            ? (() => {
                const doomed = editing.card;
                return () => setConfirm({ kind: "card", card: doomed, action: () => {} });
              })()
            : undefined
        }
        confirming={
          confirm && confirm.kind === "card" && confirm.card ? (
            <ConfirmModal
              title={`Delete "${confirm.card.en || confirm.card.ar}"?`}
              confirmLabel="Delete the card"
              confirmWord={confirm.card.en || confirm.card.ar}
              busy={busy}
              body={
                <p>
                  Gone from every deck, and from your students' apps. Recordings go too. This
                  can't be undone.
                </p>
              }
              onCancel={() => setConfirm(null)}
              onConfirm={() =>
                run(async () => {
                  const gone = confirm.card;
                  if (!gone) return;
                  await API.deleteCard(gone.id);
                  absorbDeleted([gone.id]);
                  setConfirm(null);
                  setEditing(null);
                })
              }
            />
          ) : null
        }
      />
    );
  }

  /* ---- an open deck takes over the screen, showing its cards the same
         way the Cards tab does ---- */
  if (openDeck) {
    const d = decks.find((x) => x.id === openDeck);
    if (!d) {
      setOpenDeck(null);
      return null;
    }
    const mine = cards.filter((c) => (c.decks || []).includes(d.id));
    return (
      <Screen title={d.title} onBack={() => setOpenDeck(null)}>
            <Notice kind="error">{error}</Notice>
            <Help>
              {(langOfDeck(d) || {}).name} · {plural(mine.length, "card")}
            </Help>

            <Help>
              Tap a card to see it. Tap Select to move or delete several at once.
            </Help>

            <Section title="In context" className="at-mt5">
              <ContextReport cards={mine} lang={langOfDeck(d) || LANGUAGES[DEFAULT_LANGUAGE]} />
            </Section>

            <ItemList
              noun="card"
              items={mine}
              size="small"
              busy={busy}
              empty="No cards in this deck yet. Make one, or add existing cards from the Cards tab."
              match={(c, q) =>
                (c.ar || "").toLowerCase().includes(q) || (c.en || "").toLowerCase().includes(q)
              }
              onNew={() =>
                setEditing({ card: null, decks: [d.id], lang: (langOfDeck(d) || {}).id })
              }
              selected={selCards}
              onSelectedChange={setSelCards}
              bulkActions={[
                {
                  label: "Remove from this deck",
                  onClick: (ids) =>
                    run(
                      async () => {
                        for (const id of ids) {
                          const card = cards.find((c) => c.id === id);
                          if (!card) continue;
                          absorbSaved(
                            await API.saveCard(card, (card.decks || []).filter((x) => x !== d.id))
                          );
                        }
                        setSelCards(new Set());
                      },
                      `${plural(ids.length, "card")} removed from ${d.title}`
                    ),
                },
                {
                  label: "Delete",
                  danger: true,
                  onClick: (ids) => setConfirm({ kind: "cards", ids, action: () => {} }),
                },
              ]}
              renderItem={(c) => (
                <CardTile
                  card={c}
                  lang={langOfCard(c)}
                  meta={shortDate(cardAdded(c))}
                  onClick={() => setViewing(c)}
                  actions={
                    <>
                      <IconButton
                        icon="edit"
                        label="Edit"
                        onClick={(/** @type {React.MouseEvent} */ e) => {
                          e.stopPropagation();
                          setEditing({ card: c, decks: c.decks || [] });
                        }}
                      />
                      <IconButton
                        icon="delete"
                        label="Delete"
                        danger
                        onClick={(/** @type {React.MouseEvent} */ e) => {
                          e.stopPropagation();
                          setConfirm({ kind: "cards", ids: [c.id], action: () => {} });
                        }}
                      />
                    </>
                  }
                />
              )}
            />

        {viewing && (
          <Screen
            title={viewing.en || viewing.ar}
            onBack={() => setViewing(null)}
            action={
              <Button variant="primary" size="sm"
                onClick={() => {
                  setEditing({ card: viewing, decks: viewing.decks || [] });
                  setViewing(null);
                }}
              >
                <Icon name="edit" />
                Edit
              </Button>
            }
          >
            <CardReadout card={viewing} lang={langOfCard(viewing)} decks={decks} />
          </Screen>
        )}

        {confirm && confirm.kind === "cards" && (
          <ConfirmModal
            title={`Delete ${plural((confirm.ids || []).length, "card")}?`}
            confirmLabel="Delete them"
            busy={busy}
            body={
              <p>
                Removed from every deck, and from the apps of everyone studying them. This can't
                be undone.
              </p>
            }
            onCancel={() => setConfirm(null)}
            onConfirm={() =>
              run(async () => {
                const r = await API.deleteCards(confirm.ids || []);
                absorbDeleted(r.deleted || confirm.ids);
                setConfirm(null);
                setSelCards(new Set());
                if (r.refused && r.refused.length) {
                  setError(`${plural(r.refused.length, "card")} belong to someone else and stayed.`);
                }
              })
            }
          />
        )}
      </Screen>
    );
  }

  /* ---- one course, full screen ---- */
  /* Sits before the course view so that closing it lands back on the course
     rather than the course list. */
  if (managingDecks) {
    const c = courses.find((x) => x.id === managingDecks);
    if (!c) {
      setManagingDecks(null);
      return null;
    }
    return (
      <DeckPicker
        course={c}
        decks={decks}
        langOfDeck={(d) => (langOfDeck(d) || {}).name || ""}
        busy={busy}
        onClose={() => setManagingDecks(null)}
        onSave={(added, removed) =>
          run(
            async () => {
              for (const id of added) await API.attachDeck(id, c.id);
              for (const id of removed) await API.detachDeck(id, c.id);
              setManagingDecks(null);
              await refresh();
            },
            /* Both halves happen in one save, so say what changed rather
               than "saved" and leave someone counting rows to check. */
            [added.length && `${plural(added.length, "deck")} added`,
             removed.length && `${plural(removed.length, "deck")} removed`]
              .filter(Boolean)
              .join(", ") || "Nothing to change"
          )
        }
      />
    );
  }

  if (courseView) {
    const c = courses.find((x) => x.id === courseView);
    if (!c) {
      setCourseView(null);
      return null;
    }
    const mine = decks.filter((d) => (d.courses || []).some((l) => l.courseId === c.id));
    /** @type {(d: Deck) => any} */
  const addedOn = (d) => {
      const link = (d.courses || []).find((/** @type {any} */ l) => l.courseId === c.id);
      return link && link.addedAt ? new Date(link.addedAt).toLocaleDateString() : null;
    };
    return (
      <Screen title={c.title} onBack={() => setCourseView(null)}>
            <Notice kind="error">{error}</Notice>

            <p className="at-coursemeta">
              {languageName(languages, c.language)}
              <span> · </span>
              {plural(c.students.length, "student")}
              <span> · </span>
              {plural(mine.length, "deck")}
            </p>

            {/* --- what the course teaches --- */}
            <section className="at-panel">
              <p className="at-eyebrow">Decks in this course</p>
              <Help>
                {mine.length
                  ? "Tap one to open it. Manage decks changes which are in this course."
                  : "This course has no decks yet, so students see nothing. Add some with Manage decks."}
              </Help>
              <Button size="sm"
                style={{ marginBottom: 12 }}
                onClick={() => setManagingDecks(c.id)}
          icon="folder"
        >
          Manage decks
        </Button>
              <div className="at-decklist2">
                {mine.map((d) => (
                  <Tile
                    key={d.id}
                    title={d.title}
                    meta={`${(langOfDeck(d) || { name: "" }).name} · ${plural(d.cardCount || 0, "card")}`}
                    onOpen={() => setOpenDeck(d.id)}
                    actions={
                      <IconButton icon="edit" label="Deck settings" onClick={(/** @type {React.MouseEvent} */ e) => {
                          e.stopPropagation();
                          setNaming(d);
                        }} />
                    }
                    footer={
                      /* Here the useful fact is when it joined this course,
                         not which courses hold it. */
                      <TileNote live>
                        {addedOn(d) ? <>Added <b>{addedOn(d)}</b></> : <>In this course</>}
                      </TileNote>
                    }
                  />
                ))}
                {!mine.length && (
                  <Help>
                    No decks yet. Make one under Decks, then add it to this course.
                  </Help>
                )}
              </div>
            </section>

            {/* --- who is in it --- */}
            <section className="at-panel">
              <p className="at-eyebrow">People</p>
              <Help>
                Your administrator adds and removes people.
              </Help>

              <p className="at-subhead">
                Teachers · {c.teachers.length}
              </p>
              {c.teachers.length ? (
                c.teachers.map((h) => (
                  <div className="at-person" key={h}>
                    <span className="at-avatar">{h.slice(0, 2).toUpperCase()}</span>
                    <span className="at-personname">
                      <PersonName handle={h} me={account.handle} />
                    </span>
                  </div>
                ))
              ) : (
                <Help>
                  Nobody yet.
                </Help>
              )}

              <p className="at-subhead">
                Students · {c.students.length}
              </p>
              {c.students.length ? (
                c.students.map((h) => (
                  <div className="at-person" key={h}>
                    <span className="at-avatar">{h.slice(0, 2).toUpperCase()}</span>
                    <span className="at-personname">
                      <PersonName handle={h} me={account.handle} />
                    </span>
                  </div>
                ))
              ) : (
                <Help>
                  Nobody has joined yet. Share the student code below.
                </Help>
              )}
            </section>

            {/* --- how people get in --- */}
            <section className="at-panel">
              <p className="at-eyebrow">Join codes</p>
              <Help>
                One code lets people study, the other lets them teach.
              </Help>
              <CodeBox
                label="Student code"
                code={c.code}
                hint="Share this with a class so they can join and study."
              />
              {c.teacherCode && (
                <CodeBox
                  label="Teacher code"
                  code={c.teacherCode}
                  hint="Only for another teacher — it gives them control of the material."
                />
              )}
            </section>
      </Screen>
    );
  }

  return (
    <SpaceFrame
      tabs={[
        ["courses", "Courses", "school"],
        ["decks", "Decks", "folder"],
        ["cards", "Cards", "cards"],
      ]}
      tab={tab}
      onTab={setTab}
      error={error}
      busy={busy}
    >

          {tab === "courses" && (
            <CoursesPage
              courses={courses}
              languages={languages}
              busy={busy}
              error={error}
              lead="Open a course to see its decks, its people and its codes."
              emptyLead="You aren't teaching a course yet. Ask your administrator to add you, or join with a teacher code below."
              joinTitle="Join a course as a teacher"
              joinHint="Paste a teacher code another teacher or your administrator gave you."
              joinPlaceholder="Teacher code"
              joinNote={joinNote}
              onJoin={(code) =>
                run(async () => {
                  const r = await API.joinCourse(code);
                  /* The server decides the role from the code used, so a
                     student code pasted here has already enrolled them as a
                     student. Say so rather than let it look like nothing
                     happened. */
                  setJoinNote(
                    r.role === "teacher"
                      ? `You're now teaching ${r.course.title}.`
                      : `That was a student code — you've joined ${r.course.title} as a student, not a teacher.`
                  );
                  await refresh();
                })
              }
              renderCourse={(c) => (
                <Tile
                  title={c.title}
                  meta={`${languageName(languages, c.language)} · ${plural(
                    c.students.length
                  , "student")} · ${plural(c.decks.length, "deck")}`}
                  onOpen={() => setCourseView(c.id)}
                />
              )}
            />

          )}

          {tab === "cards" && (
            <>
              {newCardLang !== null && (
                <Screen title="New card" onBack={() => setNewCardLang(null)}>
                  <LanguageRadio
                    languages={taught}
                    value={newCardLang}
                    onChange={setNewCardLang}
                    label="Which language is this card in?"
                  />
                  <Help>
                    {multiLang
                      ? "You teach more than one, so the card has to say which it belongs to."
                      : "None of your courses says which language it teaches, so this can't be worked out. Ask the administrator to set it, and you won't be asked again."}{" "}
                    It sets the script, the keyboard and how answers are marked.
                  </Help>
                  <div className="at-row at-mt5">
                    <Button variant="ghost" onClick={() => setNewCardLang(null)}>
                      Cancel
                    </Button>
                    <Button variant="primary"
                      disabled={!newCardLang}
                      onClick={() => {
                        setEditing({ card: null, decks: [], lang: newCardLang });
                        setNewCardLang(null);
                      }}
                    >
                      Start the card
                    </Button>
                  </div>
                </Screen>
              )}

              {confirm && confirm.kind === "cards" && (
                <ConfirmModal
                  title={`Delete ${plural((confirm.ids || []).length, "card")}?`}
                  confirmLabel="Delete them"
                  busy={busy}
                  body={
                    <p>
                      Removed from every deck, and from the apps of everyone studying them.
                      Recordings go too. This can't be undone.
                    </p>
                  }
                  onCancel={() => setConfirm(null)}
                  onConfirm={() =>
                    run(async () => {
                      const r = await API.deleteCards(confirm.ids || []);
                      absorbDeleted(r.deleted || confirm.ids);
                      setConfirm(null);
                      setSelCards(new Set());
                      if (r.refused && r.refused.length) {
                        setError(`${plural(r.refused.length, "card")} belong to someone else and stayed.`);
                      }
                    })
                  }
                />
              )}

              {cardAction && (
                <Screen
                  title={
                    cardAction === "add"
                      ? "Add the selected cards to…"
                      : "Take the selected cards out of…"
                  }
                  onBack={() => setCardAction(null)}
                >
                  <CheckList
                    options={decks.map((d) => ({
                      id: d.id,
                      title: d.title,
                      note: `${plural(d.cardCount || 0, "card")}`,
                    }))}
                    chosen={pickedDecks}
                    onToggle={(id, on) =>
                      setPickedDecks((x) => (on ? x.filter((y) => y !== id) : x.concat([id])))
                    }
                    empty="You have no decks yet."
                  />
                  <div className="at-row at-mt5">
                    <Button variant="ghost"
                      onClick={() => {
                        setCardAction(null);
                        setPickedDecks([]);
                      }}
          icon="close"
        >
          Cancel
        </Button>
                    <Button variant="primary"
                      disabled={!pickedDecks.length || busy}
                      onClick={() =>
                        run(
                          async () => {
                            /* Counted rather than assumed: a card already in
                               the deck is skipped, so the number selected is
                               not the number changed. */
                            let changed = 0;
                            for (const id of selCards) {
                              const card = cards.find((c) => c.id === id);
                              if (!card) continue;
                              const inNow = card.decks || [];
                              const next =
                                cardAction === "add"
                                  ? [...new Set(inNow.concat(pickedDecks))]
                                  : inNow.filter((x) => !pickedDecks.includes(x));
                              if (next.length === inNow.length) continue;
                              absorbSaved(await API.saveCard(card, next));
                              changed += 1;
                            }
                            setCardAction(null);
                            setPickedDecks([]);
                            setSelCards(new Set());
                            return changed;
                          },
                          (changed) =>
                            changed
                              ? `${plural(changed, "card")} ${cardAction === "add" ? "added" : "removed"}`
                              : "Nothing to change — they were already like that"
                        )
                      }
          icon="check"
        >
          {cardAction === "add" ? "Add" : "Remove"}
        </Button>
                  </div>
                </Screen>
              )}

              {viewing && (
                <Screen
                  title={viewing.en || viewing.ar}
                  onBack={() => setViewing(null)}
                  action={
                    <Button variant="primary" size="sm"
                      onClick={() => {
                        setEditing({ card: viewing, decks: viewing.decks || [] });
                        setViewing(null);
                      }}
          icon="edit"
        >
          Edit
        </Button>
                  }
                >
                  <CardReadout card={viewing} lang={langOfCard(viewing)} decks={decks} />
                </Screen>
              )}

              <Help>
                A card is one thing to learn — a word, a phrase, a sentence. Add it to a deck so students get it.
              </Help>

              <ItemList
                noun="card"
                items={shownCards}
                count={
                  shownCards.length === cards.length
                    ? null
                    : `${shownCards.length} of ${plural(cards.length, "card")}`
                }
                filters={
                  <FilterBar
                    note={
                      shownCards.length === cards.length
                        ? null
                        : `${shownCards.length} of ${cards.length}`
                    }
                    groups={[
                      {
                        key: "sort",
                        label: "Sort",
                        value: sortKey,
                        onChange: setSortKey,
                        quiet: "changed",
                        options: Object.entries(CARD_SORTS).map(([k, v]) => ({
                          value: k,
                          label: v.label,
                        })),
                      },
                      {
                        key: "dir",
                        label: "Order",
                        value: newestFirst ? "down" : "up",
                        onChange: (v) => setNewestFirst(v === "down"),
                        quiet: "down",
                        /* Named for what they mean rather than which way the
                           arrow points: "most" is newest for a date and the
                           most forms for a count. */
                        options: [
                          { value: "down", label: "Most first" },
                          { value: "up", label: "Least first" },
                        ],
                      },
                      {
                        key: "audio",
                        label: "Recordings",
                        value: cardFilter.audio,
                        onChange: (v) => setCardFilter((f) => ({ ...f, audio: v })),
                        quiet: "any",
                        options: [
                          { value: "any", label: "Any" },
                          { value: "with", label: "With" },
                          { value: "without", label: "Without" },
                        ],
                      },
                      {
                        key: "forms",
                        label: "Forms",
                        value: cardFilter.forms,
                        onChange: (v) => setCardFilter((f) => ({ ...f, forms: v })),
                        quiet: "any",
                        options: [
                          { value: "any", label: "Any" },
                          { value: "one", label: "One" },
                          { value: "several", label: "Several" },
                        ],
                      },
                    ]}
                  />
                }
                size="small"
                busy={busy}
                empty="No cards yet. Make one — a card is anything to learn, with its meaning."
                match={(c, q) =>
                  (c.ar || "").toLowerCase().includes(q) ||
                  (c.en || "").toLowerCase().includes(q) ||
                  (c.lat || "").toLowerCase().includes(q)
                }
                onNew={() => {
                  if (mustAsk) setNewCardLang(knownLangs[0] || "");
                  else setEditing({ card: null, decks: [], lang: soleLang });
                }}
                selected={selCards}
                onSelectedChange={setSelCards}
                bulkActions={[
                  { label: "Add to a deck", onClick: () => setCardAction("add") },
                  { label: "Remove from a deck", onClick: () => setCardAction("remove") },
                  {
                    label: "Delete",
                    danger: true,
                    onClick: (ids) => setConfirm({ kind: "cards", ids, action: () => {} }),
                  },
                ]}
                renderItem={(c) => (
                  <CardTile
                    card={c}
                    lang={langOfCard(c)}
                    meta={shortDate(cardAdded(c))}
                    onClick={() => setViewing(c)}
                    actions={
                      <>
                        <IconButton
                          icon="edit"
                          label="Edit"
                          onClick={(/** @type {React.MouseEvent} */ e) => {
                            e.stopPropagation();
                            setEditing({ card: c, decks: c.decks || [] });
                          }}
                        />
                        <IconButton
                          icon="delete"
                          label="Delete"
                          danger
                          onClick={(/** @type {React.MouseEvent} */ e) => {
                            e.stopPropagation();
                            setConfirm({ kind: "cards", ids: [c.id], action: () => {} });
                          }}
                        />
                      </>
                    }
                  />
                )}
              />

            </>
          )}

          {tab === "decks" && (
            <>
              {deckAction && (
                <Screen
                  title={
                    deckAction === "add"
                      ? "Add the selected decks to…"
                      : "Take the selected decks out of…"
                  }
                  onBack={() => setDeckAction(null)}
                >
                  <CheckList
                    options={courses.map((c) => ({
                      id: c.id,
                      title: c.title,
                      note: languageName(languages, c.language),
                    }))}
                    chosen={pickedCourses}
                    onToggle={(id, on) =>
                      setPickedCourses((x) => (on ? x.filter((y) => y !== id) : x.concat([id])))
                    }
                    empty="You aren't teaching a course yet."
                  />
                  <div className="at-row at-mt5">
                    <Button variant="ghost"
                      onClick={() => {
                        setDeckAction(null);
                        setPickedCourses([]);
                      }}
          icon="close"
        >
          Cancel
        </Button>
                    <Button variant="primary"
                      disabled={!pickedCourses.length || busy}
                      onClick={() =>
                        run(
                          async () => {
                            const n = selDecks.size;
                            for (const id of selDecks) {
                              for (const cid of pickedCourses) {
                                if (deckAction === "add") await API.attachDeck(id, cid);
                                else await API.detachDeck(id, cid);
                              }
                            }
                            setDeckAction(null);
                            setPickedCourses([]);
                            setSelDecks(new Set());
                            await refresh();
                            return n;
                          },
                          (n) =>
                            `${plural(n, "deck")} ${deckAction === "add" ? "added to" : "removed from"} ${plural(pickedCourses.length, "course")}`
                        )
                      }
          icon="check"
        >
          {deckAction === "add" ? "Add" : "Remove"}
        </Button>
                  </div>
                </Screen>
              )}

              {confirm && confirm.kind === "deck" && (
                <ConfirmModal
                  title={confirm.title}
                  body={confirm.body}
                  confirmLabel={confirm.confirmLabel}
                  confirmWord={confirm.confirmWord}
                  busy={busy}
                  onCancel={() => setConfirm(null)}
                  onConfirm={() =>
                    run(async () => {
                      await confirm.action();
                      setConfirm(null);
                      setOpenDeck(null);
                      await refresh();
                    })
                  }
                />
              )}

              <Help>
                A deck is a set of cards. A deck can be used to group cards by theme, class, or objective. Students see a deck once it's added to a course they belong to.
              </Help>

              <ItemList
                noun="deck"
                items={decks}
                size="large"
                busy={busy}
                empty="No decks yet. Make one, then add it to a course so students can see it."
                match={(d, q) => d.title.toLowerCase().includes(q)}
                onNew={() => setNaming("new")}
                selected={selDecks}
                onSelectedChange={setSelDecks}
                bulkActions={[
                  { label: "Add to a course", onClick: () => setDeckAction("add") },
                  { label: "Remove from a course", onClick: () => setDeckAction("remove") },
                  {
                    label: "Delete",
                    danger: true,
                    onClick: (ids) => {
                      const picked = decks.filter((d) => ids.includes(d.id));
                      const n = picked.reduce((t, d) => t + (d.cardCount || 0), 0);
                      setConfirm({
                        kind: "deck",
                        title: `Delete ${plural(picked.length, "deck")}?`,
                        confirmLabel: "Delete them",
                        confirmWord: "delete",
                        body: (
                          <p>
                            {plural(n, "card")} go with them, out of every course and out
                            of the apps of everyone studying them. There is no undoing this.
                          </p>
                        ),
                        action: async () => {
                          for (const d of picked) await API.deleteDeck(d.id);
                          setSelDecks(new Set());
                        },
                      });
                    },
                  },
                ]}
                renderItem={(d) => {
                  const inCourses = (d.courses || [])
                    .map((l) => (courses.find((c) => c.id === l.courseId) || {}).title)
                    .filter(Boolean);
                  const live = inCourses.length > 0;
                  return (
                    <Tile
                      title={d.title}
                      meta={`${(langOfDeck(d) || { name: "" }).name} · ${plural(d.cardCount || 0, "card")}`}
                      onOpen={() => setOpenDeck(d.id)}
                      actions={
                        <>
                          <IconButton icon="edit" label="Deck settings" onClick={(/** @type {React.MouseEvent} */ e) => {
                              e.stopPropagation();
                              setNaming(d);
                            }} />
                          <IconButton icon="delete" label="Delete deck" danger onClick={(/** @type {React.MouseEvent} */ e) => {
                              e.stopPropagation();
                              setConfirm({
                                kind: "deck",
                                title: `Delete ${d.title}?`,
                                confirmLabel: "Delete the deck",
                                confirmWord: d.title,
                                body: (
                                  <p>
                                    Its {plural(d.cardCount || 0, "card")} go with
                                    it, out of every course and out of the apps of everyone
                                    studying it. There is no undoing this.
                                  </p>
                                ),
                                action: () => API.deleteDeck(d.id),
                              });
                            }} />
                        </>
                      }
                      footer={
                        <TileNote live={live}>
                          {live ? (
                            <>
                              Students see it in <b>{inCourses.join(", ")}</b>
                            </>
                          ) : (
                            <>Not in a course yet — nobody can see it</>
                          )}
                        </TileNote>
                      }
                    />
                  );
                }}
              />
            </>
          )}
    </SpaceFrame>
  );
}

/* ------------------------------------------------------------------
   Courses, from a student's side

   Course material is pulled down and kept as ordinary cards, so every
   part of the trainer — sessions, scheduling, progress — works on it
   without knowing where it came from. They are marked read-only and
   carry the deck they arrived in, so they can be practiced as a group
   and removed cleanly if the course ends.
   ------------------------------------------------------------------ */


/**
 * @param {{
 *   courses: Course[],
 *   decks: (Deck & { courseId: string, courseTitle?: string })[],
 *   languages: Record<LangId, Lang>,
 *   busy?: boolean,
 *   error?: Node,
 *   onJoin: (code: string) => Promise<any>,
 *   onRefresh?: () => void,
 *   onPractise: (deckTitle: string) => void,
 * }} props
 */
export function StudentCourses({
  courses,
  decks,
  languages,
  busy,
  error,
  onJoin,
  onRefresh,
  onPractise,
}) {
  const [note, setNote] = useState("");
  return (
    <CoursesPage
      courses={courses}
      languages={languages}
      busy={busy}
      error={error}
      lead="Open a course to see its decks."
      emptyLead="You're not in a course yet. Enter the code your teacher gave you below."
      joinTitle="Join a course"
      joinHint="Enter the code your teacher gave you."
      joinPlaceholder="Course code"
      joinNote={note}
      onJoin={async (code) => {
        try {
          const r = await onJoin(code);
          setNote(r && r.course ? `Joined ${r.course.title}.` : "Joined.");
        } catch (e) {
          setNote(API.explain(e));
        }
      }}
      renderCourse={(c) => {
        const mine = decks.filter((d) => d.courseId === c.id);
        return (
          <Tile
            title={c.title}
            meta={`${languageName(languages, c.language)} · ${plural(mine.length, "deck")}`}
            footer={
              <TileNote live={mine.length > 0}>
                {mine.length
                  ? mine.map((d) => d.title).join(", ")
                  : "No decks yet — nothing to study until your teacher adds one"}
              </TileNote>
            }
            actions={
              mine.length ? (
                <Button size="sm"
                  onClick={(/** @type {React.MouseEvent} */ e) => {
                    e.stopPropagation();
                    onPractise(mine[0].title);
                  }}
          icon="cards"
        >
          Practice
        </Button>
              ) : null
            }
          />
        );
      }}
      footer={
        <div className="at-row at-mt4">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onRefresh} icon="refresh">{busy ? "Checking…" : "Check for new material"}</Button>
        </div>
      }
    />
  );
}
