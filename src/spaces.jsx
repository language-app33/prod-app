import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as API from "./courses-api.js";
import { GRAMMAR, dimsOf, dimValues, LANGUAGES, DEFAULT_LANGUAGE } from "./languages.js";
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
  Lede,
  Notice,
  Screen,
  Section,
  Segmented,
  SpaceFrame,
  Tabs,
  askConfirm,
  cardToItem,
  languageName,
  localIdFor,
  plural,
  useLiveRefresh,
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

export function Onboarding({ onDone }) {
  const [step, setStep] = useState("choose"); // choose | new | existing | key
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState(null);
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
      if (String(e && e.message) === "signup-code-required") {
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
export function PersonName({ name, handle, me }) {
  return (
    <>
      {name || handle}
      {handle && handle === me ? <span className="at-me"> (me)</span> : null}
    </>
  );
}

/* A "modal" is now a screen. Kept under this name so nothing that opens one
   has to change; what it opens is the standard full-screen shell. */
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



export function CodeBox({ label, code, hint, onNew, busy }) {
  return (
    <div className="at-codeblock">
      <div className="at-codehead">{label}</div>
      <div className="at-codebox">
        <b>{code || "—"}</b>
        <Button variant="ghost" size="sm"
          disabled={!code}
          onClick={() => navigator.clipboard && navigator.clipboard.writeText(code)}
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
async function buildBackup(onProgress) {
  const { manifest } = await API.backupManifest();
  const plan = manifest.plan || [];
  const { plan: _drop, ...kept } = manifest;

  const digests = {};
  const seen = new Set();
  const refs = { decks: new Set(), clips: new Set() };
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
async function restoreBackup(file, onProgress) {
  const records = file.records || {};
  const keys = Object.keys(records).filter((k) => !k.startsWith("index:"));
  const batches = [];
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
function verifyBackup(file) {
  const problems = [];
  if (!file || file.format !== "language-app-backup") return ["Not a backup file."];
  const m = file.manifest || {};
  const rec = file.records || {};
  if (m.version !== 1) problems.push(`Made by a different version (${m.version}).`);

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
      const all = [...(value.clips || []), ...(value.subs || []).flatMap((sb) => sb.clips || [])];
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

function CourseSettings({
  course,
  users,
  languages,
  account,
  busy,
  onSetLanguage,
  onNewCode,
  onAssignTeacher,
  onAssignStudent,
  onRemoveMember,
  onDelete,
  onClose,
}) {
  const [assigning, setAssigning] = useState(false);
  const [unlockLang, setUnlockLang] = useState(false);
  const c = course;
  const people = [...c.teachers, ...c.students];

  return (
    <Screen
      title={c.title}
      onBack={onClose}
      action={
        <Button variant="danger" size="sm" onClick={onDelete} icon="delete">Delete</Button>
      }
    >
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
                <Segmented
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
          <div className="at-list">
            {people.map((h) => {
              const u = users.find((x) => x.handle === h);
              const teaching = c.teachers.includes(h);
              return (
                <div className="at-item" key={h}>
                  <div className="grow">
                    <div className="en">
                      <PersonName name={u ? u.displayName : h} handle={h} me={account.handle} />
                    </div>
                    <div className="at-handle">{h}</div>
                  </div>
                  <span className="at-flags">
                    {c.teachers.includes(h) && <span className="at-flag forms">Teacher</span>}
                    {c.students.includes(h) && <span className="at-flag audio">Student</span>}
                  </span>
                  <IconButton icon="delete" label="Remove from course" danger onClick={() => onRemoveMember(h, u ? u.displayName : h)} />
                </div>
              );
            })}
            {!people.length && (
              <Help>
                Nobody in this course yet. Share a join code, or make someone a teacher below.
              </Help>
            )}
          </div>

          {assigning ? (
            <Field label={<>{assigning === "student" ? "Enrol someone as a student" : "Make someone a teacher"}</>} className="at-mt3">
              <div className="at-chips">
                {users
                  .filter((u) =>
                    assigning === "student"
                      ? !c.students.includes(u.handle)
                      : !c.teachers.includes(u.handle)
                  )
                  .map((u) => (
                    <button
                      key={u.handle}
                      className="at-btn sm ghost"
                      onClick={() => {
                        if (assigning === "student") onAssignStudent(u.handle);
                        else onAssignTeacher(u.handle);
                        setAssigning(false);
                      }}
                    >
                      <Icon name="person" />
                      {u.displayName}
                    </button>
                  ))}
              </div>
              <Button variant="ghost" size="sm"
                className="at-mt3"
                onClick={() => setAssigning(false)}
              >
                Cancel
              </Button>
            </Field>
          ) : (
            <div className="at-row at-mt3">
              <Button size="sm" onClick={() => setAssigning("teacher")}
          icon="school"
        >
          Assign a teacher
        </Button>
              <Button size="sm" onClick={() => setAssigning("student")}
          icon="person"
        >
          Enrol a student
        </Button>
            </div>
          )}
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Administrator
   ------------------------------------------------------------------ */

export function AdminSpace({ account, languages, onClose }) {
  const [tab, setTab] = useState("courses");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState(Object.keys(languages)[0]);
  const [assigning, setAssigning] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [makingCourse, setMakingCourse] = useState(false);
  const [makingUser, setMakingUser] = useState(null); // the form, while open
  const [openCourse2, setOpenCourse2] = useState(null); // a course being settled
  const [selPeople, setSelPeople] = useState(() => new Set());
  const [backup, setBackup] = useState(null); // { state, done, total, note }
  const [selDecks, setSelDecks] = useState(() => new Set());
  const [deckAction, setDeckAction] = useState(null); // "add" | "remove"
  /* One slot for whatever is waiting to be confirmed, so only one of these
     can ever be on screen at a time. */
  const [confirm, setConfirm] = useState(null);

  const refresh = useCallback(async (background) => {
    /* A background poll must not flash "Working" or grey the buttons out
       from under someone mid-click; only a deliberate refresh does that. */
    if (!background) setBusy(true);
    try {
      setData(await API.adminOverview());
      setError("");
    } catch (e) {
      if (!background) setError(API.explain(e));
    } finally {
      if (!background) setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const backgroundRefresh = useCallback(() => refresh(true), [refresh]);
  useLiveRefresh(backgroundRefresh);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      setError("");
    } catch (e) {
      setError(API.explain(e));
      setBusy(false);
    }
  }

  const users = (data && data.users) || [];
  const courses = (data && data.courses) || [];
  const decks = (data && data.decks) || [];

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
          onSetLanguage={(id) => run(() => API.setCourseLanguage(c.id, id))}
          onNewCode={(which) => run(() => API.newCourseCode(c.id, which))}
          onAssignTeacher={(h) => run(() => API.assignTeacher(c.id, h))}
          onAssignStudent={(h) => run(() => API.assignStudent(c.id, h))}
          onRemoveMember={(h, name) =>
            setConfirm({
              title: `Remove ${name} from ${c.title}?`,
              confirmLabel: "Remove them",
              body: (
                <p>
                  They lose access to every deck in this course. Their account, their own cards
                  and their progress are untouched, and they can rejoin with the code.
                </p>
              ),
              action: () => API.removeMember(c.id, h),
            })
          }
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
                          await API.createCourse(title.trim(), lang);
                          setTitle("");
                          setMakingCourse(false);
                        })
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
                      <IconButton icon="edit" label="Course settings" onClick={(e) => {
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
                        run(async () => {
                          const r = await API.createUser(
                            makingUser.name.trim(),
                            makingUser.courseId || undefined,
                            makingUser.role
                          );
                          setNewKey({
                            name: r.user.displayName,
                            handle: r.user.handle,
                            key: r.key,
                            fresh: true,
                          });
                          setMakingUser(null);
                        })
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
                        setMakingUser((u) => ({ ...u, name: e.target.value }))
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
                            setMakingUser((u) => ({
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
                    <Field label="In that course they are a">
                      <Segmented
                        label="Role"
                        options={[
                          { value: "teacher", label: "Teacher" },
                          { value: "student", label: "Student" },
                        ]}
                        value={makingUser.role}
                        onChange={(v) => setMakingUser((u) => ({ ...u, role: v }))}
                      />
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
                onNew={() => setMakingUser({ name: "", courseId: "", role: "teacher" })}
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
                    <div className="at-flags">
                      {u.admin && <span className="at-flag flagged">Admin</span>}
                      {u.teaching.map((c) => (
                        <span className="at-flag forms" key={`t${c.title || c}`}>
                          Teacher · {c.title || c}
                        </span>
                      ))}
                      {u.studying.map((c) => (
                        <span className="at-flag audio" key={`s${c.title || c}`}>
                          Student · {c.title || c}
                        </span>
                      ))}
                      {!u.admin && !u.teaching.length && !u.studying.length && (
                        <span className="at-flag">No courses</span>
                      )}
                      {!u.lastSeen && <span className="at-flag flagged">Hasn't signed in yet</span>}
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
                          run(async () => {
                            for (const id of selDecks) {
                              if (deckAction === "add") await API.attachDeck(id, c.id);
                              else await API.detachDeck(id, c.id);
                            }
                            setDeckAction(null);
                            setSelDecks(new Set());
                          })
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
                items={decks}
                size="large"
                busy={busy}
                empty="No decks yet. Make one, then add it to a course so students can see it."
                match={(d, q) =>
                  d.title.toLowerCase().includes(q) ||
                  (d.ownerName || "").toLowerCase().includes(q)
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
                    meta={`${d.ownerName} · ${plural(d.cardCount, "card")}`}
                    actions={
                        <IconButton icon="delete" label="Delete deck" danger onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({
                              title: `Delete ${d.title}?`,
                              confirmLabel: "Delete the deck",
                              confirmWord: d.title,
                              body: (
                                <p>
                                  Its {plural(d.cardCount, "card")} go with it,
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

              {backup && backup.state === "restoring" && backup.total > 0 && (
                <Help>
                  Writing {backup.done} of {backup.total} parts…
                </Help>
              )}

              {backup && backup.state === "running" && backup.total > 0 && (
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
            </>
          )}
    </SpaceFrame>
  );
}

/* ------------------------------------------------------------------
   Becoming the administrator — once, from Account settings
   ------------------------------------------------------------------ */

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

function ScriptInput({ lang, value, onChange }) {
  const [keys, setKeys] = useState(false);
  const ref = useRef(null);

  return (
    <>
      <div className="at-inputwrap">
        <input
          ref={ref}
          className="at-input"
          dir={lang.direction}
          style={{
            fontFamily: lang.fontStack,
            fontSize: 22,
            paddingRight: 52,
            textAlign: lang.direction === "rtl" ? "right" : "left",
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className={`at-keybtn${keys ? " on" : ""}`}
          onClick={() => setKeys((v) => !v)}
          aria-label="On-screen keys"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
            <path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 12.8h.01M10 12.8h.01M13.5 12.8h.01M17 12.8h.01M8.5 15.6h7" />
          </svg>
        </button>
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
                style={{ fontFamily: lang.fontStack }}
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

async function hashOf(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
function Tile({ title, meta, onOpen, actions, footer }) {
  return (
    /* data-open marks a tile that actually opens something, so only those
       get the hover treatment. */
    <div className="at-deckcard" onClick={onOpen} data-open={onOpen ? "" : undefined}>
      <div className="at-deckrow2">
        <div className="at-deckmain">
          <div className="at-decktitle">{title}</div>
          {meta ? <div className="at-deckmeta">{meta}</div> : null}
        </div>
        {actions ? <div className="at-deckacts">{actions}</div> : null}
      </div>
      {footer}
    </div>
  );
}

/* The line under a deck's rule: whether anyone can see it. */
function TileNote({ live, children }) {
  return (
    <div className="at-reach">
      <span className={`at-reachdot${live ? " live" : ""}`} />
      <span className="at-reachtext">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------
   Choosing which decks a course carries

   Membership is a property of the deck, and deck settings is still where a
   single deck says which courses it belongs to. But when the question comes
   from the other direction — "what should this course teach?" — sending
   someone off to visit each deck in turn is the wrong shape. Same data,
   same two calls underneath; this just asks the question the other way
   round, and only writes what actually changed.
   ------------------------------------------------------------------ */

function DeckPicker({ course, decks, langOfDeck, busy, onSave, onClose }) {
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
              note: `${(langOfDeck(d) || {}).name} · ${plural(d.cardCount, "card")}`,
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

function DeckEditor({
  deck,
  choices,
  mustAsk,
  initialLang,
  busy,
  courses,
  languages,
  onToggleCourse,
  onSave,
  onClose,
}) {
  const [title, setTitle] = useState((deck && deck.title) || "");
  const [lang, setLang] = useState((deck && deck.lang) || initialLang || "");
  const asking = !deck && mustAsk;
  const canSave = title.trim() && (!asking || lang);

  return (
    <Screen
      title={deck ? "Deck settings" : "New deck"}
      onBack={onClose}
      action={
        <Button variant="primary" size="sm"
          disabled={!canSave || busy}
          onClick={() => onSave(title.trim(), lang)}
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

          {/* Which courses carry it. Changes here take effect at once — there
              is nothing to save, and pretending otherwise would mean the Save
              button meant two different things. */}
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
                  const on = (deck.courses || []).some((l) => l.courseId === c.id);
                  return (
                    <button
                      key={c.id}
                      className={`at-ck${on ? " on" : ""}`}
                      disabled={busy}
                      onClick={() => onToggleCourse(c, on)}
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
            </>
          )}
    </Screen>
  );
}

function Recordings({ clips, onChange }) {

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const rec = useRef(null);
  const tick = useRef(null);
  const list = clips || [];

  useEffect(() => () => tick.current && clearInterval(tick.current), []);

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
        String(e && e.name) === "NotAllowedError"
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

      <ClipList clips={list} onChange={onChange} />

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
          A recording lets this form be practised by ear as well as by sight.
        </Help>
      )}
    </Field>
  );
}

function CardEditor({ card, lang, decks, inDecks, onSave, onDelete, onClose, busy, confirming }) {
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
  const [note, setNote] = useState((card && card.note) || "");
  const [chosen, setChosen] = useState(inDecks || []);

  const main = forms[0];
  const canSave = main.ar.trim() && (main.en.trim() || main.lat.trim());
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
            onClick={() => onSave(forms, note, chosen)}
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
                {i > 0 && (
                  <Button variant="ghost" size="sm"
                    onClick={() => setForms((x) => x.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <p className="at-groupline">Drilled in exercises</p>

              {/* What this form needs, next to the fields it's about. */}
              {i === 0 && (
                <p className={`at-formneed${canSave ? "" : " unmet"}`}>
                  {lang.scriptLabel} plus English{drillsTranslit ? " or " + lang.translitLabel.toLowerCase() : ""}.
                </p>
              )}

              <Field label={lang.scriptLabel}>
                <ScriptInput lang={lang} value={f.ar} onChange={(v) => setForm(i, { ...f, ar: v })} />
              </Field>

              <Field label="English">
                <input
                  className="at-input"
                  value={f.en}
                  onChange={(e) => setForm(i, { ...f, en: e.target.value })}
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
                        value={f[dim.field]}
                        onChange={(v) =>
                          setForm(i, {
                            ...f,
                            [dim.field]: !dim.required && f[dim.field] === v ? "" : v,
                          })
                        }
                      />
                    </Field>
                  ))}

                  {i === 0 && lang && lang.lexical && (
                    <Field label={lang.lexical.label}>
                      <input
                        className="at-input"
                        value={f[lang.lexical.key] || ""}
                        placeholder={lang.lexical.help || ""}
                        onChange={(e) => setForm(i, { ...f, [lang.lexical.key]: e.target.value })}
                      />
                    </Field>
                  )}
                </>
              )}
            </div>
          ))}

          <Button variant="ghost" size="sm"
            onClick={() => setForms((f) => f.concat([{ ...blankForm(), number: "plural" }]))}
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

          {card && onDelete && (
            <Button variant="danger" className="at-mt5" onClick={onDelete}>
              Delete this card
            </Button>
          )}
      </Screen>
    </>
  );
}

export function TeachSpace({ account, languages, onClose }) {
  const [tab, setTab] = useState("courses");
  const [courses, setCourses] = useState([]);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [openCourse, setOpenCourse] = useState(null);
  const [courseView, setCourseView] = useState(null);
  const [openDeck, setOpenDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [editing, setEditing] = useState(null); // {card|null, decks:[]}
  const [naming, setNaming] = useState(null); // "new" | deck
  const [deckTitle, setDeckTitle] = useState("");
  const [deckLang, setDeckLang] = useState("");
  const [confirm, setConfirm] = useState(null); // whatever is awaiting a yes
  const [viewing, setViewing] = useState(null); // a card being read, not edited
  const [selCards, setSelCards] = useState(() => new Set());
  const [cardAction, setCardAction] = useState(null); // "add" | "remove"
  const [newCardLang, setNewCardLang] = useState(null);
  const [managingDecks, setManagingDecks] = useState(null); // a course id
  /* Already teaching something? Then this is a rare errand, folded away. */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinNote, setJoinNote] = useState("");
  const [selDecks, setSelDecks] = useState(() => new Set());
  const [deckAction, setDeckAction] = useState(null); // "add" | "remove"
  const [pickedDecks, setPickedDecks] = useState([]);
  const [pickedCourses, setPickedCourses] = useState([]);

  const refresh = useCallback(async (background) => {
    if (!background) setBusy(true);
    try {
      /* One failing call shouldn't blank the screen: take what arrives and
         report only what didn't. */
      const [c, d, k] = await Promise.allSettled([API.myCourses(), API.myDecks(), API.myCards()]);
      if (c.status === "fulfilled")
        setCourses((c.value.courses || []).filter((x) => x.role === "teacher"));
      if (d.status === "fulfilled") setDecks(d.value.decks || []);
      if (k.status === "fulfilled") setCards(k.value.cards || []);

      const failed = [c, d, k].find((r) => r.status === "rejected");
      if (!background || !failed) setError(failed ? API.explain(failed.reason) : "");
    } catch (e) {
      if (!background) setError(API.explain(e));
    } finally {
      if (!background) setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Courses are changed by the administrator elsewhere. Without this, a course
     that has been deleted — and the decks and cards that went with it — stays
     on screen until the app is reloaded. */
  const backgroundRefresh = useCallback(() => refresh(true), [refresh]);
  useLiveRefresh(backgroundRefresh);

  /* The languages this person actually teaches. One means nothing to ask
     about; several mean every new deck and card has to say which it is. */
  const teachingLangs = useMemo(() => {
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

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      setError("");
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
  /* Deck names for a card, in the order the decks are listed. Both card
     lists show these; they used to be worked out inside the tile, which is
     why the student's tile and the teacher's showed different things. */
  const deckTitlesFor = (card) =>
    (card.decks || []).map((id) => (decks.find((d) => d.id === id) || {}).title).filter(Boolean);

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

  function absorbDecks(records) {
    if (!Array.isArray(records) || !records.length) return;
    setDecks((prev) =>
      prev.map((d) => {
        const fresh = records.find((x) => x.id === d.id);
        return fresh ? { ...d, ...fresh, cardCount: (fresh.cardIds || []).length } : d;
      })
    );
  }

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

  const langOfDeck = (deck) => {
    if (deck && deck.lang && languages[deck.lang]) return languages[deck.lang];
    for (const link of (deck && deck.courses) || []) {
      const c = courses.find((x) => x.id === link.courseId);
      if (c && languages[c.language]) return languages[c.language];
    }
    return languages[soleLang] || languages[Object.keys(languages)[0]];
  };

  const langOfCard = (card) =>
    (card && card.lang && languages[card.lang]) ||
    langOfDeck(decks.find((d) => ((card && card.decks) || []).includes(d.id)) || {});

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
        onToggleCourse={(c, on) =>
          run(async () => {
            if (on) await API.detachDeck(existing.id, c.id);
            else await API.attachDeck(existing.id, c.id);
            await refresh();
          })
        }
        onClose={() => setNaming(null)}
        onSave={(title, lang) =>
          run(async () => {
            if (existing) await API.renameDeck(existing.id, title);
            else await API.createDeck(title, "", lang || soleLang);
            setNaming(null);
            await refresh();
          })
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
      (editing.card ? langOfCard(editing.card) : langOfDeck(forDeck || { courses: [] }));
    return (
      <CardEditor
        card={editing.card}
        lang={editLang}
        decks={decks}
        inDecks={editing.decks}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={(forms, note, inDecks) =>
          run(async () => {
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
                subs: subs.filter((f) => f.ar.trim() || f.en.trim()),
              },
              inDecks
            );
            absorbSaved(r);
            setEditing(null);
          })
        }
        onDelete={editing.card ? () => setConfirm({ kind: "card", card: editing.card }) : undefined}
        confirming={
          confirm && confirm.kind === "card" ? (
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
                  await API.deleteCard(confirm.card.id);
                  absorbDeleted([confirm.card.id]);
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
                    run(async () => {
                      for (const id of ids) {
                        const card = cards.find((c) => c.id === id);
                        if (!card) continue;
                        absorbSaved(
                          await API.saveCard(card, (card.decks || []).filter((x) => x !== d.id))
                        );
                      }
                      setSelCards(new Set());
                    }),
                },
                {
                  label: "Delete",
                  danger: true,
                  onClick: (ids) => setConfirm({ kind: "cards", ids }),
                },
              ]}
              renderItem={(c) => (
                <CardTile
                  card={c}
                  lang={langOfCard(c)}
                  deckTitles={deckTitlesFor(c)}
                  meta={(langOfCard(c) || {}).name}
                  onClick={() => setViewing(c)}
                  actions={
                    <>
                      <IconButton
                        icon="edit"
                        label="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing({ card: c, decks: c.decks || [] });
                        }}
                      />
                      <IconButton
                        icon="delete"
                        label="Delete"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirm({ kind: "cards", ids: [c.id] });
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
            title={`Delete ${plural(confirm.ids.length, "card")}?`}
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
                const r = await API.deleteCards(confirm.ids);
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
        langOfDeck={langOfDeck}
        busy={busy}
        onClose={() => setManagingDecks(null)}
        onSave={(added, removed) =>
          run(async () => {
            for (const id of added) await API.attachDeck(id, c.id);
            for (const id of removed) await API.detachDeck(id, c.id);
            setManagingDecks(null);
            await refresh();
          })
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
    const addedOn = (d) => {
      const link = (d.courses || []).find((l) => l.courseId === c.id);
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
                    meta={`${(langOfDeck(d) || {}).name} · ${plural(d.cardCount, "card")}`}
                    onOpen={() => setOpenDeck(d.id)}
                    actions={
                      <IconButton icon="edit" label="Deck settings" onClick={(e) => {
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
                  title={`Delete ${plural(confirm.ids.length, "card")}?`}
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
                      const r = await API.deleteCards(confirm.ids);
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
                      note: `${plural(d.cardCount, "card")}`,
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
                        run(async () => {
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
                          }
                          setCardAction(null);
                          setPickedDecks([]);
                          setSelCards(new Set());
                        })
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
                items={cards}
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
                    onClick: (ids) => setConfirm({ kind: "cards", ids }),
                  },
                ]}
                renderItem={(c) => (
                  <CardTile
                    card={c}
                    lang={langOfCard(c)}
                    deckTitles={deckTitlesFor(c)}
                    meta={(langOfCard(c) || {}).name}
                    onClick={() => setViewing(c)}
                    actions={
                      <>
                        <IconButton
                          icon="edit"
                          label="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing({ card: c, decks: c.decks || [] });
                          }}
                        />
                        <IconButton
                          icon="delete"
                          label="Delete"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({ kind: "cards", ids: [c.id] });
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
                        run(async () => {
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
                        })
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
                      meta={`${(langOfDeck(d) || {}).name} · ${plural(d.cardCount, "card")}`}
                      onOpen={() => setOpenDeck(d.id)}
                      actions={
                        <>
                          <IconButton icon="edit" label="Deck settings" onClick={(e) => {
                              e.stopPropagation();
                              setNaming(d);
                            }} />
                          <IconButton icon="delete" label="Delete deck" danger onClick={(e) => {
                              e.stopPropagation();
                              setConfirm({
                                kind: "deck",
                                title: `Delete ${d.title}?`,
                                confirmLabel: "Delete the deck",
                                confirmWord: d.title,
                                body: (
                                  <p>
                                    Its {plural(d.cardCount, "card")} go with
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
   carry the deck they arrived in, so they can be practised as a group
   and removed cleanly if the course ends.
   ------------------------------------------------------------------ */


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
                  onClick={(e) => {
                    e.stopPropagation();
                    onPractise(mine[0].title);
                  }}
          icon="cards"
        >
          Practise
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
