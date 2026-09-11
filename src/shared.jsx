/** @import { Card, Course, Deck, ExerciseState, FlagKind, Form, Item, Lang, LangId, Millis } from "./types.ts" */
/**
 * Anything React will render: an element, a string, a list of them, or
 * nothing. Written once because nearly every component here takes one.
 * @typedef {React.ReactNode} Node
 */
/*
 * The handful of pieces the trainer needs at startup, kept apart from the
 * rest of spaces.jsx so that the onboarding, teaching and admin screens can
 * load as their own chunk, on the first tap that needs them, instead of
 * being parsed by every student on every launch.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import * as API from "./courses-api.js";
import { answerFields, dimValues, dimsOf, kindLabel, kindOf, labelFor, LANGUAGES, DEFAULT_LANGUAGE, scriptVars } from "./languages.js";
import { DIALOG_KIND, isDialog, isTwoSided, linesOf, namedPart, sideOf } from "./dialogs.ts";



/* When to ask, and how hard.
 *
 * The test is the consequence, not the noun. Typing a name is friction worth
 * spending only where the damage lands on other people and cannot be undone;
 * anything less than that gets a plain yes, and anything reversible should
 * not interrupt at all.
 *
 *   affectsOthers + permanent -> type the name back
 *   permanent, yours alone    -> a plain confirm
 *   reversible                -> no dialog; just do it
 */
/** @param {{ permanent?: boolean, affectsOthers?: boolean, name?: string }} what */
export function confirmStrength({ permanent, affectsOthers, name }) {
  if (!permanent) return {};
  if (affectsOthers && name) return { confirmWord: name };
  return {};
}

/* ------------------------------------------------------------------
   Icons

   Material Design glyphs, inlined as paths rather than pulled from a web
   font. The app is offline-first, and a font request that fails leaves
   every button showing a blank box or a stray ligature name — inlining
   costs a few kilobytes and can't fail.

   One component, one size scale, so an icon in a button and an icon in a
   list are the same icon.
   ------------------------------------------------------------------ */

/** @type {Record<string, string>} */
const ICONS = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  search:
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  delete:
    "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  edit:
    "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  tune:
    "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  save:
    "M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z",
  folder:
    "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  cards:
    "M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.2 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 5.95c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.6zM7.88 8.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM5.88 19.75c0 1.1.9 2 2 2h1.45l-3.45-8.34v6.34z",
  person:
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  group:
    "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  key:
    "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  verify:
    "M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z",
  play: "M8 5v14l11-7z",
  /* The same triangle inside a circle drawn as a broken line: play, but not
     at the speed the solid one runs at. It is what every video player uses
     for slow motion, so it is not a private symbol this app invented. */
  slow:
    "M13.05 9.79 10 7.5v9l3.05-2.29L16 12l-2.95-2.21zM11 4.07V2.05c-2.01.2-3.84 1-5.32 2.21L7.1 5.69c1.11-.86 2.44-1.44 3.9-1.62zM5.69 7.1 4.26 5.68C3.05 7.16 2.25 8.99 2.05 11h2.02c.18-1.46.76-2.79 1.62-3.9zM4.07 13H2.05c.2 2.01 1 3.84 2.21 5.32l1.43-1.43c-.86-1.11-1.44-2.44-1.62-3.89zm1.61 6.74C7.16 20.95 9 21.75 11 21.95v-2.02c-1.46-.18-2.79-.76-3.9-1.62l-1.42 1.43zM22 12c0 5.16-3.92 9.42-8.95 9.95v-2.02C16.97 19.41 20 16.05 20 12s-3.03-7.41-6.95-7.93V2.05C18.08 2.58 22 6.84 22 12z",
  pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
  view:
    "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  select:
    "M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11L2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z",
  school:
    "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z",
  copy:
    "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  refresh:
    "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  mic:
    "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z",
  remove: "M19 13H5v-2h14v2z",
  chevronDown: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z",
  chevronUp: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
  /* A speaker with a line through it, for saying you cannot hear this
     one, and a flag for reporting it. Both were bare text glyphs — ⚑ and
     nothing at all — which set at different weights from each other and
     from the type around them. */
  soundOff:
    "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z",
  flag: "M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z",
  menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
  help:
    "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  theme:
    "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16V5c3.87 0 7 3.13 7 7s-3.13 7-7 7z",
  language:
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z",
  lock:
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
};

/** @param {{ name: string, size?: number }} props */
export function Icon({ name, size = 20 }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      className="at-ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Playing a clip

   The button says what it will do next, and returns to Play by itself when
   the clip ends or is paused — it listens to the audio element rather than
   assuming, so the icon can never disagree with what you are hearing.
   ------------------------------------------------------------------ */

/* One recording, wherever it comes from. The teaching space holds server
   hashes; the learning space holds local ids that may need fetching. Passing
   the loader in means one player rather than three. */
/**
 * @param {{
 *   hash: string,
 *   label?: string | null,
 *   index: number,
 *   onRemove?: () => void,
 *   load?: (hash: string) => Promise<string | null>,
 * }} props
 */
function ClipRow({ hash, label, index, onRemove, load }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const [error, setError] = useState("");
  /* Asked before removing. A recording is a minute of somebody's voice and
     the × sits a thumb's width from Play, which is a poor trade for a
     control that used to act on the first tap. */
  const [asking, setAsking] = useState(
    /** @type {Parameters<typeof askConfirm>[0] | null} */ (null)
  );
  /** @type {React.MutableRefObject<HTMLAudioElement | null>} */
  const audio = useRef(null);

  /* An object URL made for this row is this row's to release. */
  const owned = useRef("");
  const releaseSrc = () => {
    if (owned.current && owned.current.startsWith("blob:")) URL.revokeObjectURL(owned.current);
    owned.current = "";
  };

  useEffect(
    () => () => {
      if (audio.current) {
        audio.current.pause();
        audio.current = null;
      }
      releaseSrc();
    },
    []
  );

  async function toggle() {
    if (state === "playing") {
      if (audio.current) audio.current.pause();
      setState("idle");
      return;
    }
    setError("");
    setState("loading");
    try {
      const src = load ? await load(hash) : (await API.getClip(hash)).data;
      if (!src) {
        setState("idle");
        setError("Not on this device");
        return;
      }
      if (!audio.current) audio.current = new Audio();
      const el = audio.current;
      el.onended = () => setState("idle");
      el.onpause = () => setState((v) => (v === "playing" ? "idle" : v));
      el.onplaying = () => setState("playing");
      el.onerror = () => {
        setState("idle");
        setError("Couldn't play that");
      };
      releaseSrc();
      owned.current = src;
      el.src = src;
      await el.play();
    } catch (e) {
      setState("idle");
      setError("Couldn't play that");
    }
  }

  return (
    <div className="at-clip">
      <button
        className={`at-clipplay${state === "playing" ? " on" : ""}`}
        onClick={toggle}
        disabled={state === "loading"}
        aria-label={state === "playing" ? "Pause" : "Play"}
        title={state === "playing" ? "Pause" : "Play"}
      >
        {state === "loading" ? "…" : state === "playing" ? "❚❚" : "▶"}
      </button>
      <span className="at-clipname">
        {label || `Voice ${index + 1}`}
        {error ? ` — ${error}` : ""}
      </span>
      {onRemove && (
        <button
          className="at-x"
          aria-label="Remove recording"
          onClick={() =>
            setAsking(
              askConfirm({
                title: "Delete this recording?",
                verb: "Delete it",
                /* Reversible: the card holds it until it is saved, so this is
                   a plain confirm rather than one that asks for a typed
                   word. See confirmStrength. */
                permanent: false,
                body: (
                  <p>
                    It goes from the card when you save. Leave the card without
                    saving and the recording stays.
                  </p>
                ),
                action: onRemove,
              })
            )
          }
        >
          ×
        </button>
      )}

      {asking && (
        <ConfirmModal
          {...asking}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null);
            asking.action();
          }}
        />
      )}
    </div>
  );
}


/* ==================================================================
   Primitives

   The layer under the screens. Before these existed every screen built
   buttons, fields, section headers and empty states out of raw class
   strings and inline margins, so the same thing was written dozens of
   times and drifted a little each time. Nothing here is clever; the
   point is that there is exactly one of each.
   ================================================================== */

/* --- plural -------------------------------------------------------
   Written out by hand forty-four times before this, always the same
   way, occasionally with the wrong noun. */
/**
 * @param {number} n
 * @param {string} one
 * @param {string} [many] Only where adding "s" is wrong.
 */
export function plural(n, one, many) {
  const word = n === 1 ? one : many || `${one}s`;
  return `${n} ${word}`;
}

/* --- Button -------------------------------------------------------
   Four looks and two sizes. The class strings used to be assembled at
   the call site, which is how "sm ghost" and "ghost sm" both came to
   exist, along with a stray "at-btn" with no variant at all. */
/**
 * @param {{
 *   variant?: "default" | "primary" | "ghost" | "danger",
 *   size?: "sm",
 *   wide?: boolean,
 *   icon?: string,
 *   iconSize?: number,
 *   className?: string,
 *   children?: Node,
 * } & Record<string, any>} props
 */
export function Button({
  variant = "default", // default | primary | ghost | danger
  size, // sm
  wide,
  icon,
  iconSize,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "at-btn",
    variant !== "default" ? variant : "",
    size === "sm" ? "sm" : "",
    wide ? "wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon ? <Icon name={icon} size={iconSize || (size === "sm" ? 16 : 18)} /> : null}
      {children}
    </button>
  );
}

/* An icon on its own still needs a name: it is the only label a screen
   reader has to go on.

   `ghost` is the same not-quite-a-button as Button's ghost variant — the
   outline without the fill. It exists so an icon can sit in a row beside a
   ghost Button without reading as the heavier of the two, which is what the
   hint button did next to "I don't know". */
/**
 * @param {{
 *   icon: string,
 *   label: string,
 *   danger?: boolean,
 *   ghost?: boolean,
 *   className?: string,
 * } & Record<string, any>} props
 */
export function IconButton({ icon, label, danger, ghost, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`at-icon${danger ? " danger" : ""}${ghost ? " ghost" : ""}${
        className ? " " + className : ""
      }`}
      title={label}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/* --- Text ---------------------------------------------------------
   at-hint used to do eight jobs at once, so the helper text under a
   control could not be restyled without also restyling every empty
   state and count line. Each job now says which it is. */
/*
 * The on-screen keys toggle, which sits inside the field it types into.
 *
 * A learner answering in Arabic and a teacher writing a card need the same
 * control, and it was drawn twice — once here as a labelled button under
 * the answer box, once in the card editor as an icon in the corner of the
 * field. The corner is the better of the two: it costs no vertical space,
 * which matters most on a phone with its own keyboard already up, and it
 * sits on the thing it acts on.
 *
 * Its own glyph rather than an Icon: the set is single-path and filled, and
 * a keyboard reads as a keyboard only with the keys punched out of it.
 */
/** @param {{ on?: boolean, onClick?: () => void, label?: string }} props */
export function KeysButton({ on, onClick, label = "On-screen keys" }) {
  return (
    <button
      type="button"
      className={`at-keybtn${on ? " on" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!on}
      title={label}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 12.8h.01M10 12.8h.01M13.5 12.8h.01M17 12.8h.01M8.5 15.6h7" />
      </svg>
    </button>
  );
}

/** @param {{ children?: Node, className?: string }} props */
export function Lede({ children, className = "" }) {
  return <p className={`at-lede${className ? " " + className : ""}`}>{children}</p>;
}
/** @param {{ children?: Node, className?: string } & Record<string, any>} props */
export function Help({ children, className = "", ...rest }) {
  return (
    <p className={`at-hint${className ? " " + className : ""}`} {...rest}>
      {children}
    </p>
  );
}
/** @param {{ children?: Node, className?: string }} props */
export function Meta({ children, className = "" }) {
  return <span className={`at-meta${className ? " " + className : ""}`}>{children}</span>;
}

/* --- Notice -------------------------------------------------------
   Every failure, warning, confirmation and "working…" line. The same
   error used to read as a red toast on one screen and grey helper text
   on another, purely by which idiom the screen happened to use. */
/** @param {{ kind?: "info" | "error" | "warn" | "ok" | "busy", children?: Node, plain?: boolean }} props */
export function Notice({ kind = "info", children, plain }) {
  if (!children) return null;
  return (
    <p className={`at-notice ${kind}${plain ? " plain" : ""}`} role={kind === "error" ? "alert" : undefined}>
      {children}
    </p>
  );
}

/* --- Section ------------------------------------------------------
   An eyebrow, an optional count, an optional lede. Thirty-two hand
   assembled copies of this shape, each with its own inline margins. */
/**
 * @param {{
 *   title?: Node, count?: number, lede?: Node,
 *   action?: Node, children?: Node, className?: string,
 * }} props
 */
export function Section({ title, count, lede, action, children, className = "" }) {
  return (
    <div className={`at-section${className ? " " + className : ""}`}>
      {(title || count || action) && (
        <div className="at-sectiontop">
          {title ? <p className="at-eyebrow">{title}</p> : <span />}
          {action || (count != null ? <span className="at-sectioncount">{count}</span> : null)}
        </div>
      )}
      {lede ? <p className="at-hint at-sectionlede">{lede}</p> : null}
      {children ? <div className="at-sectionbody">{children}</div> : null}
    </div>
  );
}

/* --- Empty --------------------------------------------------------
   Sixteen different ad-hoc versions of "there is nothing here",
   fifteen of which did not use the class that existed for it. */
/** @param {{ title?: Node, children?: Node, action?: Node }} props */
export function Empty({ title, children, action }) {
  return (
    <div className="at-empty2">
      {title ? <p className="at-eyebrow">{title}</p> : null}
      {children ? <p className="at-hint">{children}</p> : null}
      {action ? <div className="at-row">{action}</div> : null}
    </div>
  );
}

/* --- StickyFoot ---------------------------------------------------
   The foot of an exercise screen: the row of buttons that carries the
   question forward, and above it an optional line of plain text — the
   way out of a listening question, or the way to report a bad one.

   One fixed element holding both, rather than two fixed elements with
   the lower one's height written into the upper one's offset. The bar's
   height is 8px of padding plus whatever a button is today, and that
   changes with the type scale and again when the phone keyboard is up;
   anything that hard-codes it is one button-size edit away from a gap or
   an overlap. Stacked in a column, the browser does the arithmetic.

   The page reserves room underneath from .at-footextra's presence, so
   the last line of an answer is never left under the foot. */
/** @param {{ above?: Node, children?: Node, className?: string }} props */
export function StickyFoot({ above, children, className }) {
  return (
    <div className={`at-foot${className ? " " + className : ""}`}>
      {above ? <div className="at-footextra">{above}</div> : null}
      <div className="at-row at-answerbar">{children}</div>
    </div>
  );
}

/* --- accepted answers ---------------------------------------------
   Lives in answers.js, which is where the pairing between an answer and
   its transliteration is decided — and which a test can import. Re-exported
   here because this is where the screens look for it. */
export { splitAlternatives, joinAlternatives } from "./answers.ts";
import { answersOf } from "./answers.ts";

/* --- Segmented ----------------------------------------------------
   Pick one of a few. Replaces eighteen groups of buttons that each
   toggled their own "primary" class, and tells assistive software what
   is chosen, which none of them did. */
/**
 * Pick one from a few. Options may be {value, label} or bare values.
 *
 * Generic in the value because not every choice here is a word: the
 * session sheet picks a number of questions and a number of minutes, and
 * the settings screen picks an on or an off. The value goes out and comes
 * back untouched, and turning it into a string on the way would put the
 * parsing back on every caller.
 *
 * null is one of those values rather than the absence of one: a scene's
 * "either part" is a choice a teacher makes, sits in the row beside the
 * named parts, and reads back as null. A group with nothing chosen passes
 * no value at all.
 * @template {string | number | boolean | null} T
 * @param {{
 *   options: ({ value: T, label?: Node } | T)[],
 *   value?: T | null,
 *   onChange: (value: T) => void,
 *   size?: string | null,
 *   label?: string,
 *   disabled?: boolean,
 * } & Record<string, any>} props
 */
export function Segmented({ options, value, onChange, size = "sm", label, disabled, ...rest }) {
  return (
    <div
      className={`at-segmented${size === "sm" ? " sm" : ""}`}
      data-n={options.length}
      role="group"
      aria-label={label}
      {...rest}
    >
      {options.map((o) => {
        /* `typeof null` is "object", so a bare null option has to be told
           apart from a {value, label} one by looking for the wrapper. */
        const wrapped = !!o && typeof o === "object";
        const v = wrapped ? /** @type {any} */ (o).value : /** @type {any} */ (o);
        const text = wrapped ? /** @type {any} */ (o).label : /** @type {any} */ (o);
        const on = v === value;
        return (
          <button
            key={String(v)}
            type="button"
            className={`at-seg${on ? " on" : ""}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/* --- Tabs ---------------------------------------------------------
   The trainer, the teaching space and the admin space each had their
   own copy of this, and only one of them said which tab was current. */
/**
 * @param {{
 *   tabs: [string, string, string?][],
 *   value?: string,
 *   onChange: (key: string) => void,
 *   label?: string,
 * }} props Each tab is [key, label, iconName].
 */
export function Tabs({ tabs, value, onChange, label = "Section" }) {
  return (
    <div className="at-nav2" role="tablist" aria-label={label}>
      {tabs.map(([k, text, icon]) => (
        <button
          key={k}
          type="button"
          role="tab"
          className={`at-tab2${value === k ? " on" : ""}`}
          aria-selected={value === k}
          aria-current={value === k ? "page" : undefined}
          onClick={() => onChange(k)}
        >
          {icon ? <Icon name={icon} size={18} /> : null}
          {text}
        </button>
      ))}
    </div>
  );
}

/* --- Stat ---------------------------------------------------------
   One big number with its label, instead of a font size written inline
   on a paragraph borrowed from somewhere else. */
/**
 * @param {{
 *   value?: Node, label?: Node, big?: boolean,
 *   lang?: string, dir?: string,
 *   style?: React.CSSProperties, className?: string,
 * }} props
 */
export function Stat({ value, label, big, lang, dir, style, className = "" }) {
  return (
    <div className={`at-stat2${big ? " big" : ""}`}>
      <p className={`at-statvalue${className ? " " + className : ""}`} lang={lang} dir={dir} style={style}>
        {value}
      </p>
      {label ? <p className="at-statlabel">{label}</p> : null}
    </div>
  );
}

/* --- Field --------------------------------------------------------
   A label, a control, and the helper text underneath. Forty-eight
   hand-built copies, nine of which carried marginBottom:0 to undo a
   default that is now handled by the stylesheet. */
/**
 * @param {{
 *   label?: Node, hint?: Node, optional?: boolean,
 *   htmlFor?: string, children?: Node, className?: string,
 * }} props
 */
export function Field({ label, hint, optional, htmlFor, children, className = "" }) {
  return (
    <div className={`at-field${className ? " " + className : ""}`}>
      {label ? (
        <label className="at-label" htmlFor={htmlFor}>
          {label}
          {optional ? <span className="at-optional"> — {optional === true ? "optional" : optional}</span> : null}
        </label>
      ) : null}
      {children}
      {hint ? <p className="at-hint">{hint}</p> : null}
    </div>
  );
}

/* --- SpaceFrame ---------------------------------------------------
   The Teaching and Admin spaces are the same frame: a full-bleed screen,
   whatever is waiting to be confirmed, the error and busy lines, then a
   tab strip and the tab's contents. Both built that by hand, which is how
   one of them came to show the busy line and the other not. */
/**
 * @param {{
 *   tabs: [string, string, string?][],
 *   tab?: string,
 *   onTab: (key: string) => void,
 *   error?: Node, busy?: boolean, label?: string,
 *   dialog?: Node, children?: Node,
 * }} props
 */
export function SpaceFrame({ tabs, tab, onTab, error, busy, label = "Section", dialog, children }) {
  /* The frame is a fixed panel that scrolls inside itself, so the page's
     own scroll position is not the one a tab change has to reset — this
     is. Switching tabs from halfway down a long list used to hand you the
     next tab already scrolled past its heading. */
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab]);

  /* "Working…" used to be a line in the flow above the tabs, which meant
     every arrival in a space shoved the tabs and everything under them
     down a notch and pulled them back up again a moment later. It is a
     passing remark about the app, not a part of the page, so it is said
     where the app's other passing remarks are said: in the snackbar's
     place, over the content, moving nothing. The confirmation that
     follows a slow save then lands in the same spot the waiting was in. */
  const slow = useSlowWait(busy);

  return (
    <div className="at-screen bare">
      {dialog}
      <div className="at-screenbody" ref={bodyRef}>
        <div className="at-screeninner">
          <Notice kind="error">{error}</Notice>
          <Tabs tabs={tabs} value={tab} onChange={onTab} label={label} />
          {children}
        </div>
      </div>
      {slow && (
        <p className="at-working" role="status">
          Working…
        </p>
      )}
    </div>
  );
}

/* --- language naming ----------------------------------------------
   Lived in spaces.jsx, so the trainer built its own "not set" fallback
   with a ternary and the two could disagree. */
/**
 * @param {Record<string, { name?: string }>} languages Only the name is read.
 * @param {LangId} [id]
 */
export function languageName(languages, id) {
  if (!id) return "Language not set";
  return ((languages || {})[id] || {}).name || id;
}

/** @param {{ languages: Record<string, { name?: string }>, id?: LangId }} props */
export function LanguageTag({ languages, id }) {
  return <span className={`at-flag ${id ? "forms" : "flagged"}`}>{languageName(languages, id)}</span>;
}

/* --- CardTile -----------------------------------------------------
   The student's card list and the teacher's card list had their own
   tiles built from the same classes, showing different things and
   counting forms two different ways. One tile, with what differs
   passed in. */
/**
 * The card is a form rather than a `Card` or an `Item`, because both
 * sides show these: only the wording is read, and that is all a form is.
 * @param {{
 *   card: Form,
 *   lang?: Lang,
 *   showLat?: boolean,
 *   meta?: Node,
 *   actions?: Node,
 *   onClick?: () => void,
 *   className?: string,
 * }} props
 */
export function CardTile({ card, lang, showLat, meta, actions, onClick, className }) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  /* A conversation has no front of its own: its first line stands in for
     one, which is what a person recognises it by. Here rather than at each
     list, so every place cards are shown says the same thing about them —
     the tile with an empty face was the alternative. */
  const face = isDialog(card) ? (linesOf(card)[0] || {}).ar || "" : card.ar;
  return (
    <div className={`at-minicard${className ? " " + className : ""}`} onClick={onClick}>
      {/* And it says so. A conversation's face is somebody else's opening
          line, which on its own reads as a phrase card written oddly —
          this is the word that makes it one of the kinds of card rather
          than a puzzle. Only this kind is marked: word, phrase and
          sentence look like what they are, and a label on every tile is
          the small print this list was cleared of. */}
      {isDialog(card) ? <div className="at-minikind">{kindLabel(DIALOG_KIND)}</div> : null}
      <div className="ar" lang={L.id} dir={L.direction} style={{ ...(L.fontStack ? { fontFamily: L.fontStack } : null), ...scriptVars(L) }}>
        {face}
      </div>
      <div className="at-minien">{card.en}</div>
      {showLat && card.lat ? <div className="at-minilat">{card.lat}</div> : null}
      {/* One line of small print, and the caller decides what it says.
          It used to carry the language, the decks the card was in, how
          many forms it had and how many recordings — four facts in a
          tile you are scanning past, none of them what you came to the
          list for. */}
      {meta ? <div className="at-minimeta">{meta}</div> : null}
      {actions ? <div className="at-miniacts">{actions}</div> : null}
    </div>
  );
}

/* --- what can be wrong with a question ----------------------------
 *
 * Three things, each shown as a card: a title saying what is wrong, and a
 * line saying when to pick it. The list was four one-line labels, and two
 * of them were guesses about what a label meant — "The check was too
 * strict" describes the marking rather than the complaint, and someone
 * whose recording was silent had to choose between "the card's data" and
 * "something else" with nothing to go on. A sentence under each title
 * costs a line and removes the guessing, which is what makes the reports
 * worth reading at the other end.
 *
 * Here rather than in the trainer because both ends need it: the learner
 * picks from this list, and Admin → Flags names what they picked. Two
 * copies of it would be two vocabularies for one thing, and the admin one
 * would be the one that went stale.
 *
 * `fixes` marks the option that also overturns the marking; `asks` marks
 * the one that cannot be sent on its own, because it covers everything not
 * listed and so has to be said in words.
 */
/** @type {{ key: FlagKind, title: string, what: string, fixes?: boolean, asks?: boolean }[]} */
export const FLAG_KINDS = [
  {
    key: "strict",
    title: "My answer should have been accepted",
    what: "What you typed means the same thing, and the check marked it wrong.",
    fixes: true,
  },
  {
    key: "data",
    title: "The card's data is incorrect",
    what: "The word, its meaning, one of its forms or its recording is wrong.",
  },
  {
    key: "other",
    title: "Something else",
    what: "Anything the two above don't cover. Tell us what happened.",
    asks: true,
  },
];

/* Long enough for a paragraph explaining what went wrong, short enough
   that the report stays a report. The server enforces the same number. */
export const FLAG_NOTE_MAX = 500;

/* What a flag of this kind is called, for a screen showing one that was
   sent by somebody else. Falls back to the stored key rather than to
   nothing: a kind this build does not know about is still a report. */
/** @param {string} kind */
export function flagTitle(kind) {
  const found = FLAG_KINDS.find((k) => k.key === kind);
  return found ? found.title : String(kind || "Something else");
}

/* --- the two speeds a word is recorded at -------------------------
 *
 * A word said at the speed it is really said, and the same word said
 * slowly enough to hear its parts, are two different recordings doing two
 * different jobs — and a teacher may make either, both, or neither.
 *
 * They are two fields on the form rather than one list with a mark on each
 * entry: which speed a recording is at is the only thing that distinguishes
 * them, and a mark is a thing that can be lost in a merge, a backup or an
 * older client. Two lists cannot lose it.
 *
 * Here rather than in the teaching space because both ends need it: the
 * teacher records against these, and the learner's card shows what it got
 * under the same names.
 */
/** @type {{ key: "clips" | "slowClips", title: string, short: string, what: string }[]} */
export const CLIP_KINDS = [
  {
    key: "clips",
    title: "Regular speed",
    short: "Regular",
    what: "The word as it is really said. This is what a listening exercise plays.",
  },
  {
    key: "slowClips",
    title: "Slow",
    short: "Slow",
    what: "The same word said slowly, so a learner can hear each sound in it.",
  },
];

/* Every recording on one form, named by the speed it was made at, in the
   shape ClipList reads. Numbered only where there is more than one of a
   speed — "Slow" alone says more than "Slow 1". The speed is carried as
   well as written into the label, because the app has to sort recordings by
   it and reading a label back is not sorting, it is guessing. */
/** @param {{ clips?: string[], slowClips?: string[] }} [form] */
export function clipsOf(form) {
  /** @type {{ id: string, label: string, speed: "regular" | "slow" }[]} */
  const out = [];
  for (const kind of CLIP_KINDS) {
    const list = (form && form[kind.key]) || [];
    const speed = kind.key === "slowClips" ? "slow" : "regular";
    for (let i = 0; i < list.length; i++) {
      out.push({
        id: list[i],
        label: list.length > 1 ? `${kind.short} ${i + 1}` : kind.short,
        speed,
      });
    }
  }
  return out;
}

/* Whether a form has any recording at all, whichever speed it is at. */
/** @param {{ clips?: string[], slowClips?: string[] }} [form] */
export const formHasAudio = (form) =>
  CLIP_KINDS.some((k) => ((form && form[k.key]) || []).length > 0);

/* Every recording a whole card refers to, its other forms included — for
   the places that care about the bytes rather than about the card: a backup
   checking that nothing it names is missing. */
/** @param {{ clips?: string[], slowClips?: string[], subs?: { clips?: string[], slowClips?: string[] }[] }} card */
export function clipHashes(card) {
  /** @param {{ clips?: string[], slowClips?: string[] }} form */
  const on = (form) => CLIP_KINDS.flatMap((k) => form[k.key] || []);
  return [...on(card || {}), ...((card && card.subs) || []).flatMap(on)];
}

/* --- shortDate ----------------------------------------------------
   A date small enough for the foot of a tile. The year is left off when
   it is this one, because "6 Sep" is what you would say out loud and the
   year only earns its space when it is not the obvious one. */
/** @param {Millis} [ms] */
export function shortDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? null : { year: "numeric" }),
  });
}

/* The same date with the time on it, for the places where "which day" is
   not enough — an administrator asking whether somebody has opened the app
   since being told to wants the hour, not the date. Empty for a moment
   that never happened, so the caller decides what to say instead. */
/** @param {Millis} [ms] */
export function dateTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${shortDate(ms)}, ${d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/* --- useClipPlayer ------------------------------------------------
   One audio element, one object URL, one state machine. There were
   three copies of this, and every fix — the leaked URL, the missing
   error handler — had to be made in each of them separately. */
/* --- Tile ---------------------------------------------------------
   The deck and course tile. Lived in spaces.jsx, which meant the one
   library the docs point at did not actually hold it. */
/**
 * @param {{
 *   title?: Node, meta?: Node,
 *   onOpen?: () => void,
 *   actions?: Node, footer?: Node,
 * }} props
 */
export function Tile({ title, meta, onOpen, actions, footer }) {
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
/** @param {{ live?: boolean, children?: Node }} props */
export function TileNote({ live, children }) {
  return (
    <div className="at-reach">
      <span className={`at-reachdot${live ? " live" : ""}`} />
      <span className="at-reachtext">{children}</span>
    </div>
  );
}

/** @param {((hash: string) => Promise<string | null>) | undefined} load Absent on a read-only list. */
export function useClipPlayer(load) {
  const [state, setState] = useState("idle"); // idle | loading | playing | missing
  /** @type {React.MutableRefObject<HTMLAudioElement | null>} */
  const audio = useRef(null);
  const url = useRef("");

  const release = () => {
    if (url.current && url.current.startsWith("blob:")) URL.revokeObjectURL(url.current);
    url.current = "";
  };

  useEffect(
    () => () => {
      if (audio.current) audio.current.pause();
      audio.current = null;
      release();
    },
    []
  );

  /** @param {string} id */
  const play = async (id) => {
    if (state === "playing") {
      if (audio.current) audio.current.pause();
      setState("idle");
      return;
    }
    setState("loading");
    let src = null;
    try {
      src = load ? await load(id) : null;
    } catch (e) {
      src = null;
    }
    if (!src) {
      setState("missing");
      return;
    }
    if (!audio.current) audio.current = new Audio();
    const el = audio.current;
    el.onended = () => setState("idle");
    el.onpause = () => setState((v) => (v === "playing" ? "idle" : v));
    el.onplaying = () => setState("playing");
    el.onerror = () => setState("missing");
    release();
    url.current = src;
    el.src = src;
    try {
      await el.play();
      setState("playing");
    } catch (e) {
      // Autoplay refused until the page has been interacted with.
      setState("idle");
    }
  };

  return { state, play, playing: state === "playing", reset: () => setState("idle") };
}

/* The button that goes with it, so play/pause looks the same wherever
   a recording appears. */
/**
 * @param {{
 *   state?: "idle" | "loading" | "playing" | "missing",
 *   onClick?: () => void, className?: string, label?: string,
 * }} props
 */
export function PlayButton({ state, onClick, className = "", label = "Play" }) {
  return (
    <button
      type="button"
      className={className || "at-clipplay"}
      onClick={onClick}
      disabled={state === "loading"}
      aria-label={state === "playing" ? "Pause" : label}
      title={state === "playing" ? "Pause" : label}
    >
      <Icon name={state === "playing" ? "pause" : "play"} />
    </button>
  );
}

/* Clips may be plain ids or objects carrying their own label. */
/**
 * @param {{
 *   clips?: (string | { id: string, label?: string })[],
 *   onChange?: (clips: (string | { id: string, label?: string })[]) => void,
 *   load?: (hash: string) => Promise<string | null>,
 * }} props Read-only lists — a card's own recordings — pass no loader.
 */
export function ClipList({ clips, onChange, load }) {
  const list = clips || [];
  if (!list.length) return null;
  return (
    <div className="at-cliplist">
      {list.map((clip, i) => {
        const id = typeof clip === "string" ? clip : clip.id;
        const label = typeof clip === "string" ? null : clip.label;
        return (
          <ClipRow
            key={id}
            hash={id}
            label={label}
            index={i}
            load={load}
            onRemove={
              onChange
                ? () =>
                    onChange(
                      list.filter((c) => (typeof c === "string" ? c !== id : c.id !== id))
                    )
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

const PAGE_SIZE = 120;

/*
 * A row of pickers over a list: how to order it, and what to leave out.
 *
 * Shut until it is asked for. Four groups of buttons standing permanently
 * above a card grid is four rows of chrome before the first card, which is
 * a heavy price for controls most visits do not touch — so the list looks
 * exactly as it did until the button is pressed, and the button says how
 * many groups are away from their default so a narrowed list is never a
 * mystery.
 *
 * Built from Segmented rather than a new control, because picking one of a
 * few is a thing this app already does one way. It goes in ItemList's
 * `filters` slot, so a list that wants it gains a line under the search box
 * and nothing else moves.
 *
 * Each group is { key, label, value, onChange, options, quiet } where the
 * options are Segmented's own. `quiet` is the value that counts as "not
 * narrowing", used only to decide whether to flag the button.
 */
/**
 * How to order a list, and what to leave out of it. A group's `quiet`
 * value is the setting that counts as not narrowing, which is how the
 * button knows whether to show a count.
 * @param {{
 *   groups?: {
 *     key?: string, label?: string, value?: string, quiet?: string,
 *     onChange: (value: string) => void,
 *     options?: { value: string, label?: Node, note?: Node }[],
 *   }[],
 *   note?: Node,
 *   label?: string,
 * }} props
 */
export function FilterBar({ groups, note, label = "Sort and filter" }) {
  const [open, setOpen] = useState(false);
  const live = (groups || []).filter((g) => g && g.options && g.options.length > 1);
  if (!live.length) return null;
  const busy = live.filter((g) => g.quiet !== undefined && g.value !== g.quiet).length;

  return (
    <div className="at-filterwrap">
      <button
        className={`at-btn sm ghost at-filterbtn${busy ? " on" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name="tune" size={16} />
        {label}
        {busy ? <span className="at-filtercount">{busy}</span> : null}
        <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
      </button>
      {note && !open ? <span className="at-filternote">{note}</span> : null}

      {open && (
        <div className="at-filterbar">
          {live.map((g) => (
            <div className="at-filtergroup" key={g.key}>
              <span className="at-filterlabel">{g.label}</span>
              {/* Full width: a filter group is a narrow column, and some of
                  these option sets are long — "Least first", "Recordings".
                  Compact would take the width the labels want and hang off
                  the side of the bar. */}
              <Segmented
                options={g.options || []}
                value={g.value}
                onChange={g.onChange}
                label={g.label}
                size={null}
              />
            </div>
          ))}
          {note ? <span className="at-filternote">{note}</span> : null}
        </div>
      )}
    </div>
  );
}

/*
 * One filter, narrow enough to live in the toolbar.
 *
 * FilterBar is the answer when a list wants several pickers at once; this is
 * the answer when it wants one and the choices are a list rather than a few
 * — every person who has made a deck, say, which Segmented would wrap into
 * four rows of buttons. It takes the width of an icon until it is pressed,
 * so it goes beside the search box rather than on a line of its own, and it
 * lights up while it is narrowing so a short list is never a mystery.
 *
 * Options are { value, label, note }, and `quiet` is the value that means
 * "everything" — usually the first one.
 */
/**
 * @param {{
 *   icon?: string, label?: string,
 *   options?: { value: string, label?: Node, note?: Node }[],
 *   value?: string,
 *   onChange: (value: string) => void,
 *   quiet?: string,
 * }} props
 */
export function FilterMenu({ icon = "tune", label, options, value, onChange, quiet = "" }) {
  const [open, setOpen] = useState(false);

  /* The same close-on-anything-else the corner menu uses. Registered only
     while it is open, and the menu stops the click that opened it from
     closing it again. */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  if (!options || options.length < 2) return null;
  const on = value !== quiet;
  const chosen = options.find((o) => o.value === value);

  return (
    <div className="at-pickwrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`at-icon at-pickbtn${on ? " on" : ""}`}
        /* The label says what the filter does; the title also says where it
           has got to, because the lit button alone does not name the person
           the list has been narrowed to. */
        title={on && chosen ? `${label}: ${chosen.label}` : label}
        aria-label={label}
        aria-expanded={open}
        aria-pressed={on}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={icon} />
      </button>

      {open && (
        <div className="at-pickmenu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`at-pickline${o.value === value ? " on" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="at-pickmark">
                {o.value === value ? <Icon name="check" size={16} /> : null}
              </span>
              <span className="at-picktext">{o.label}</span>
              {o.note ? <span className="at-picknote">{o.note}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The standard list frame: New button, search, Select mode, bulk-action
 * tray, empty state, and paging.
 *
 * Generic in the item, so `match`, `renderItem` and `itemKey` all see the
 * same thing the caller passed in `items` rather than an `any`.
 * `itemKey` defaults to reading `.id`. Items need not have one — the People
 * list is keyed by handle — but then the caller passes its own.
 * @template T
 * @param {{
 *   noun: string,
 *   plural?: string,
 *   tools?: Node,
 *   filters?: Node,
 *   count?: Node,
 *   items: T[],
 *   itemKey?: (item: T) => string,
 *   match?: (item: T, lowercasedQuery: string) => boolean,
 *   size?: "large" | "small",
 *   onNew?: () => void,
 *   renderItem: (item: T, state: { selecting: boolean, selected: boolean }) => Node,
 *   selected?: Set<string>,
 *   onSelectedChange?: (chosen: Set<string>) => void,
 *   bulkActions?: {
 *     label: string,
 *     danger?: boolean,
 *     icon?: string,
 *     onClick: (ids: string[]) => void,
 *   }[],
 *   empty?: Node,
 *   busy?: boolean,
 * }} props
 */
export function ItemList({
  noun, // "course", "deck", "person", "card"
  plural,
  tools, // optional controls in the toolbar itself, right of the search box
  filters, // optional controls under the toolbar — tag pickers and the like
  count, // optional override for the "n of m" line
  items,
  itemKey = (it) => /** @type {any} */ (it).id,
  match, // (item, lowercased query) => boolean
  size = "large", // large | small
  onNew,
  renderItem, // (item, { selecting, selected }) => node
  selected,
  onSelectedChange,
  bulkActions, // [{ label, danger, onClick }]
  empty,
  busy,
}) {
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  /* How many tiles are on the page. A long list is shown a page at a time:
     every tile rendered at once is what made a big course slow to open. */
  const [limit, setLimit] = useState(PAGE_SIZE);

  /* match is nearly always an inline arrow, so depending on it directly
     would throw the filtered list away on every render of the parent. */
  const matchRef = useRef(match);
  matchRef.current = match;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = matchRef.current;
    if (!q || !m) return items;
    return items.filter((it) => m(it, q));
  }, [items, query]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query]);
  const page = shown.length > limit ? shown.slice(0, limit) : shown;

  const picked = selected || new Set();
  /* Nothing to select means no toggle: an empty list should not offer a mode
     that cannot do anything. */
  const canSelect = !!(onSelectedChange && bulkActions && bulkActions.length && items.length);

  const stopSelecting = () => {
    setSelecting(false);
    if (onSelectedChange) onSelectedChange(new Set());
  };

  /** @param {string} id */
  const toggle = (id) => {
    if (!onSelectedChange) return;
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const allShown = shown.length > 0 && shown.every((it) => picked.has(itemKey(it)));

  return (
    <div className="at-listwrap">
      <div className="at-toolbar at-toolbar-top">
        {onNew && (
          <button className="at-btn primary" onClick={onNew}>
            <Icon name="add" />
            New {noun}
          </button>
        )}
        {items.length > 0 && (
          <input
            className="at-input at-search"
            type="search"
            /* Cards are searched by typing the language they are written in,
               so the box has to lay itself out by what is in it. */
            dir="auto"
            placeholder={`Search ${plural || `${noun}s`}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {/* Beside the search box, because narrowing by hand and narrowing by
            typing are the same job. Before the select toggle, which is not a
            filter and belongs at the end of the row. */}
        {tools}
        {canSelect && (
          <button
            className={`at-icon at-selectbtn${selecting ? " on" : ""}`}
            title={selecting ? "Done selecting" : "Select several"}
            aria-label={selecting ? "Done selecting" : "Select several"}
            aria-pressed={selecting}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            <Icon name={selecting ? "close" : "select"} />
          </button>
        )}
      </div>

      {filters}

      {canSelect && selecting && (
        <div className="at-listtools">
          {shown.length > 0 && (
            <button
              className="at-btn sm ghost"
              onClick={() =>
                onSelectedChange(
                  allShown ? new Set() : new Set(shown.map((it) => itemKey(it)))
                )
              }
            >
              <Icon name="check" />
              {allShown ? "Select none" : `Select all ${shown.length}`}
            </button>
          )}
          {(query || count) && (
            <span className="at-hint">
              {count || `${shown.length} of ${items.length}`}
            </span>
          )}
        </div>
      )}

      <div className={size === "small" ? "at-cardgrid" : "at-decklist2"}>
        {page.map((it) => {
          const id = itemKey(it);
          const on = picked.has(id);
          return (
            <div
              className={`at-tilewrap${on ? " picked" : ""}`}
              key={id}
              onClickCapture={
                selecting
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(id);
                    }
                  : undefined
              }
            >
              {selecting && (
                <button
                  className={`at-ckbox pick${on ? " on" : ""}`}
                  aria-label={on ? "Deselect" : "Select"}
                  onClick={() => toggle(id)}
                >
                  {on ? "✓" : ""}
                </button>
              )}
              {renderItem(it, { selecting, selected: on })}
            </div>
          );
        })}
      </div>

      {shown.length > page.length && (
        <div className="at-row at-mt3">
          <button className="at-btn ghost sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show more — {shown.length - page.length} remaining
          </button>
        </div>
      )}

      {!shown.length && !busy && (
        <p className="at-hint">
          {query ? `No ${plural || `${noun}s`} match "${query}".` : empty}
        </p>
      )}

      {selecting && picked.size > 0 && (
        <div className="at-bulkfloat">
          <div className="at-bulkhead2">
            <span className="at-bulktitle">Bulk actions</span>
            <span className="at-bulkcount">{picked.size} selected</span>
          </div>
          <div className="at-bulkrow">
            {(bulkActions || []).map((a) =>
              a.danger ? (
                <button
                  key={a.label}
                  className="at-icon danger at-bulkdel"
                  disabled={busy}
                  title={a.label}
                  aria-label={a.label}
                  onClick={() => a.onClick([...picked])}
                >
                  <Icon name="delete" />
                </button>
              ) : (
                <button
                  key={a.label}
                  className="at-btn sm"
                  disabled={busy}
                  onClick={() => a.onClick([...picked])}
                >
                  <Icon name={a.icon || "folder"} />
                  {a.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   A card, read only

   Used on both sides: a teacher checking their material, a student looking
   at a card between sessions. Grouped the way the editor groups it — what
   gets drilled, then what is reference — so the two screens describe the
   card the same way.
   ------------------------------------------------------------------ */

/**
 * The card is described by what this reads rather than as a `Card`,
 * because both sides pass one: the teacher a card as the server holds it,
 * the learner an item as this device holds it. Neither is the other, and
 * the fields below are the ones they agree on.
 *
 * `whereItLives` is the one difference between the two readers. A teacher
 * needs to know which decks carry a card, because a card in no deck reaches
 * nobody and that is their problem to fix. A student is already holding the
 * card; being told which shelf it came off answers a question they did not
 * ask, so their screen leaves that panel out.
 *
 * @param {{
 *   card: Record<string, any> & { subs?: Record<string, any>[], decks?: string[] },
 *   lang?: Lang,
 *   decks: { id: string, title?: string }[],
 *   whereItLives?: boolean,
 * }} props Only a deck's id and title are read, to name where the card lives.
 */
export function CardReadout({ card, lang, decks, whereItLives = true }) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  const dims = dimsOf(L);
  /** @type {Record<string, any>[]} */
  const forms = [card, ...(card.subs || [])];
  const titles = (card.decks || [])
    .map((/** @type {string} */ id) => decks.find((d) => d.id === id))
    .map((d) => d && d.title)
    .filter(Boolean);

  /** @param {{ label?: Node, children?: Node }} props */
  const Row = ({ label, children }) =>
    children ? (
      <div className="at-readrow">
        <span className="at-readlabel">{label}</span>
        <span className="at-readvalue">{children}</span>
      </div>
    ) : null;

  /* A conversation reads as one: who spoke, what they said, what it meant.
     The card above it is built around a word and its other spellings,
     which is the wrong shape for four people taking turns — and this is
     the same picture the student sees in a session, drawn from the same
     classes, so the two cannot drift apart. */
  const speakers = (card.speakers || []).filter(Boolean);
  /** @param {number} who */
  const nameOf = (who) => speakers[who] || speakers[0] || `Speaker ${who + 1}`;

  if (isDialog(card)) {
    return (
      <div className="at-readout">
        <section className="at-panel">
          <p className="at-eyebrow">The scene</p>
          <p className="at-hint">
            {card.note || "A conversation. Each line is practised in its own right."}
          </p>
          {/* Two people, one down each side — which is how a conversation
              is read everywhere else, and the difference between scanning
              a scene and parsing it. Three or four stay a list: there is
              no third side of a page. */}
          <div className={`at-scene at-mt3${isTwoSided(card) ? " sided" : ""}`}>
            {linesOf(card).map((/** @type {any} */ line, /** @type {number} */ i) => (
              <div
                className={`at-sceneline${sideOf(card, line.who) === null ? "" : ` side${sideOf(card, line.who)}`}`}
                key={line.id || i}
              >
                <span className={`at-speaker s${(line.who || 0) % 4}`}>{nameOf(line.who || 0)}</span>
                <div className="at-scenesaid">
                  <p className="at-arabic phrase" lang={L.id} dir={L.direction}
                    style={{ fontFamily: L.fontStack, direction: L.direction, ...scriptVars(L) }}>
                    {line.ar}
                  </p>
                  {line.en ? <p className="at-scenemeaning">{line.en}</p> : null}
                  {line.lat ? <p className="at-scenemeaning">{line.lat}</p> : null}
                  {clipsOf(line).length ? <ClipList clips={clipsOf(line)} /> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="at-panel">
          <p className="at-eyebrow">The student's part</p>
          <p className="at-hint">
            {namedPart(card) === null
              ? "Not set. The question picks a part and takes them in turn, so a scene met twice has been held up from both ends."
              : `${nameOf(/** @type {number} */ (namedPart(card)))} — their turns are the ones they produce when the whole scene is asked. Everything else is said to them.`}
          </p>
        </section>

        {whereItLives ? (
          <section className="at-panel">
            <p className="at-eyebrow">Where it lives</p>
            <Row label="Language">{L.name}</Row>
            <Row label="Decks">
              {titles.length ? (
                <span className="at-flags">
                  {titles.map((t) => (
                    <span className="at-flag audio" key={t}>
                      {t}
                    </span>
                  ))}
                </span>
              ) : (
                "In no deck"
              )}
            </Row>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="at-readout">
      {forms.map((f, i) => (
        <section className="at-panel" key={i}>
          <p className="at-eyebrow">{i === 0 ? "The card" : `Other form ${i}`}</p>
          <p className="at-hint">
            {i === 0
              ? "What a student is asked, and what counts as the answer."
              : "Another way the same thing is said. It is practiced on its own."}
          </p>

          {/* Each accepted answer with the transliteration that belongs to
              it, rather than every spelling on one line and one
              pronunciation under the lot of them — which said nothing about
              which was which, and read as a single wrong answer when the two
              lists were different lengths. */}
          {answersOf(f, answerFields()).map((answer, n) => (
            <div className="at-readanswer" key={n}>
              <p className="at-readword" dir={L.direction} style={{ fontFamily: L.fontStack, ...scriptVars(L) }}>
                {answer.text}
              </p>
              {answer.lat ? <p className="at-readlat">{answer.lat}</p> : null}
              {/* And what this one is, grammatically. Beside the answer it
                  is about rather than under the card, because two accepted
                  answers may be a masculine and a feminine and a single
                  label over the pair describes one of them. */}
              {labelFor(answer, L) ? <p className="at-readlat">{labelFor(answer, L)}</p> : null}
            </div>
          ))}
          <p className="at-readmeaning">{f.en}</p>

          {clipsOf(f).length ? (
            <>
              <p className="at-eyebrow at-mt4">
                Recordings
              </p>
              <p className="at-hint">
                How it sounds, at each speed it was recorded at. Cards with a
                recording can be practiced by ear.
              </p>
              <ClipList clips={clipsOf(f)} />
            </>
          ) : null}

          {dims.some((d) => f[d.field]) || (i === 0 && L.lexical && f[L.lexical.key]) ? (
            <>
              <p className="at-eyebrow at-mt4">
                Reference
              </p>
              <p className="at-hint">
                Recorded on the card, but never asked in an exercise.
              </p>
              {dims.map((dim) => (
                <Row key={dim.field} label={dim.label}>
                  {(dim.options.find(([v]) => v === f[dim.field]) || [])[1]}
                </Row>
              ))}
              {i === 0 && L.lexical ? (
                <Row label={L.lexical.label}>{f[L.lexical.key]}</Row>
              ) : null}
            </>
          ) : null}
        </section>
      ))}

      {/* The note used to be a row of the panel below, which meant dropping
          that panel for the student would have dropped the note with it —
          and the note is the one thing in there written for them to read.
          It stands on its own now, so each screen keeps what it needs. */}
      {card.note ? (
        <section className="at-panel">
          <p className="at-eyebrow">Note</p>
          <p className="at-hint">{card.note}</p>
        </section>
      ) : null}

      {whereItLives ? (
        <section className="at-panel">
          <p className="at-eyebrow">Where it lives</p>
          <p className="at-hint">
            A card is seen through its decks. One in no deck reaches nobody.
          </p>
          <Row label="Language">{L.name}</Row>
          <Row label="Decks">
            {titles.length ? (
              <span className="at-flags">
                {titles.map((t) => (
                  <span className="at-flag audio" key={t}>
                    {t}
                  </span>
                ))}
              </span>
            ) : (
              "In no deck"
            )}
          </Row>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   Ticking things

   The same rows wherever a set is chosen from: decks on a card, courses
   on a deck, cards into a deck. A real checkbox, so it behaves like one
   for a keyboard and a screen reader.
   ------------------------------------------------------------------ */

/**
 * @param {{
 *   options: { id: string, title?: Node, note?: Node }[],
 *   chosen?: string[],
 *   onToggle?: (id: string, wasOn: boolean) => void,
 *   empty?: Node,
 * }} props
 */
export function CheckList({ options, chosen, onToggle, empty }) {
  if (!options.length) {
    return empty ? (
      <p className="at-hint">
        {empty}
      </p>
    ) : null;
  }
  return (
    <div className="at-ticklist">
      {options.map((o) => {
        const on = (chosen || []).includes(o.id);
        return (
          <label className="at-tickrow" key={o.id}>
            <input type="checkbox" checked={on} onChange={() => onToggle && onToggle(o.id, on)} />
            <span className="at-tickbody">
              <b>{o.title}</b>
              {o.note ? <i>{o.note}</i> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   A screen

   Every full-screen view in the app — editors, settings, pickers, the
   guide — is this one shell: back at the left, a title, at most one action
   at the right, a scrolling body. It sits above the app chrome so nothing
   else competes for attention. Dialogs are the same shell too: a dialog is
   a small screen, not a different kind of thing, and on a phone a sheet
   that the keyboard can push off the bottom is worse than a screen.
   ------------------------------------------------------------------ */

/*
 * Where something that floats above the whole app belongs in the document.
 *
 * The colour tokens live on the app root, not on :root, so a portal into
 * document.body renders on a themeless background — dark text on dark, or
 * nothing at all. Everything that escapes its parent goes into `.at`
 * instead.
 *
 * Looked up after mounting rather than during the first render: on that
 * first pass the app root is not in the document yet, and looking too early
 * silently falls back to the body, which is exactly the case that loses the
 * theme. Until it is found the caller renders where it was written, which
 * looks the same.
 */
function useAppHost() {
  const [host, setHost] = useState(/** @type {Element | null} */ (null));
  useEffect(() => {
    setHost(document.querySelector(".at") || document.body);
  }, []);
  return host;
}

/* ==================================================================
   The snackbar
   ==================================================================

   A sentence that appears, is read, and goes: a save confirmed, a change
   quietly refused, a setting that will expire. It is the app's answer to
   "did that work?", and it exists so that answer is not a page reload.

   Three rules it is built around:

   - It never asks for anything. Nothing here needs a tap, nothing here
     blocks, and losing it costs nothing — which is why it is allowed to
     vanish on a timer. Anything that must be acknowledged is a
     ConfirmModal, and anything that must persist is a Notice.
   - One at a time. A second message replaces the first rather than
     stacking, because two floating pills in a corner are read as one
     block of noise and neither gets read.
   - It is announced. `role="status"` means a screen reader hears the save
     confirmed too, rather than a sighted-only reassurance.

   The trainer already had a private version of this — a `notice` string, a
   timer ref and a `flash()` — while the teaching and admin screens had no
   way to say "saved" at all. This is that mechanism, moved somewhere both
   can reach.
*/

const SNACK_DWELL_MS = 4000;

/** @param {{ message?: Node, kind?: string, onDismiss?: () => void }} props */
export function Snackbar({ message, kind = "info", onDismiss }) {
  const host = useAppHost();

  const view = (
    <div className={`at-snack ${kind}`} role="status" aria-live="polite">
      <span className="msg">{message}</span>
      {onDismiss && (
        <button className="at-snackx" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );

  if (typeof document === "undefined" || !host) return view;
  return createPortal(view, host);
}

/*
 * The state behind it, for the one component that hosts the snackbar.
 *
 * Returns the node as well as the opener so the host has nothing to
 * assemble: render `node` once, near the end of the tree, and call `show`
 * from anywhere.
 */
/** @param {{ dwell?: number }} [opts] */
export function useSnackbarState({ dwell = SNACK_DWELL_MS } = {}) {
  const [snack, setSnack] = useState(
    /** @type {{ id: number, message: string, kind: string } | null} */ (null)
  );
  /** @type {React.MutableRefObject<ReturnType<typeof setTimeout> | null>} */
  const timer = useRef(null);
  /* Numbered so that a second message remounts the pill rather than
     swapping the text inside the old one: without it the entrance is played
     once and every later message arrives silently, in place. */
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSnack(null);
  }, []);

  const show = useCallback(
    (/** @type {unknown} */ message, /** @type {string} */ kind = "info") => {
      const text = String(message == null ? "" : message).trim();
      /* An empty message would show an empty pill, which reads as a bug. */
      if (!text) return;
      if (timer.current) clearTimeout(timer.current);
      seq.current += 1;
      setSnack({ id: seq.current, message: text, kind });
      timer.current = setTimeout(() => {
        timer.current = null;
        setSnack(null);
      }, dwell);
    },
    [dwell]
  );

  /* A message raised by the last thing a screen did before unmounting would
     otherwise leave its timer running against a gone component. */
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    show,
    dismiss,
    current: snack,
    node: snack ? (
      <Snackbar key={snack.id} message={snack.message} kind={snack.kind} onDismiss={dismiss} />
    ) : null,
  };
}

/*
 * And the way everything below the host reaches it. The saves that most
 * want to confirm themselves — a card, a deck, a course — happen several
 * components down from where the pill is rendered, and threading a
 * callback through all of them would put a prop on every screen for the
 * sake of one line each.
 *
 * Outside a provider `show` is a no-op rather than a crash: the gallery
 * renders these components with nothing hosting them, and a notification
 * that goes nowhere is not worth taking a screen down for.
 */
/** @type {(message: string, kind?: string) => void} */
const noSnackbar = () => {};
const SnackbarContext = React.createContext(noSnackbar);

/** @param {{ show?: (message: string, kind?: string) => void, children?: Node }} props */
export function SnackbarProvider({ show, children }) {
  return <SnackbarContext.Provider value={show || noSnackbar}>{children}</SnackbarContext.Provider>;
}

export function useSnackbar() {
  return React.useContext(SnackbarContext) || noSnackbar;
}

/* How many screens are open. A screen opened from inside a space is nested in
   an element that is already positioned, so it cannot out-layer the app chrome
   with z-index alone — the nesting caps it. Rather than fight that, the chrome
   is hidden for as long as any screen is up. Counted, because a screen can
   open another one. */
/* Every open screen, oldest first. Only the last one answers Escape, so a
   screen opened on top of another doesn't take both down with one key. */
/** @type {any[]} */
const SCREEN_STACK = [];

/*
 * The class hides the app chrome, and it used to come off only when the
 * stack emptied. That made one entry outliving its component permanent: the
 * chrome stayed hidden for the rest of the session and only a reload
 * brought it back, which is a poor trade for a counter that is only ever an
 * approximation of what is on screen.
 *
 * The document is the thing that actually knows. A screen React has taken
 * down is no longer connected, so any entry whose element has gone is
 * dropped before the class is set — a stale one corrects itself the next
 * time any screen opens or closes, instead of wedging the app.
 *
 * A screen that is merely hidden — Suspense does this while a chunk
 * loads — stays connected, so it still counts, which is right: it is
 * coming back.
 */
function reconcileScreens() {
  for (let i = SCREEN_STACK.length - 1; i >= 0; i--) {
    const el = SCREEN_STACK[i].el;
    if (el && !el.isConnected) SCREEN_STACK.splice(i, 1);
  }
  document.body.classList.toggle("at-screening", SCREEN_STACK.length > 0);
}

/*
 * Back to the top, whatever is doing the scrolling.
 *
 * The page itself, not the window: window.scrollTo is the canonical call
 * but jsdom answers it with an error on the virtual console, and the
 * smoke run treats console errors as failures. Assigning scrollTop is the
 * same thing, works in every browser, and is silent where there is no
 * layout to scroll. document.scrollingElement is <html> in the standards
 * mode every browser is in here; the fallback is for a document that has
 * none, which is a document with nothing to scroll anyway.
 */
export function scrollToTop() {
  const el = typeof document === "undefined" ? null : document.scrollingElement || document.documentElement;
  if (el) el.scrollTop = 0;
}

/*
 * Somewhere new starts at the top.
 *
 * Opening a tab is arriving somewhere, not staying where you were: a list
 * read halfway down and then a tab away used to hand you the next screen
 * already scrolled into its middle, past whatever it opens with. Keyed on
 * whatever identifies the place — a tab name, a space and tab together —
 * so it fires on arrival and not on every render.
 *
 * Not keyed on a screen opening or closing. A screen covers the page
 * rather than replacing it, so the page underneath does not move, and
 * closing one hands it back exactly as it was left — which is what going
 * back should do.
 *
 * That only holds for the page. In the teaching and admin spaces an open
 * screen returns early instead of rendering the frame, so the frame
 * unmounts and comes back new, and a list read halfway down is at the top
 * again on the way back. Untouched here: it is older than this and worth
 * fixing on its own terms, by keeping the frame mounted.
 */
/** @param {unknown} key */
export function useScrollTop(key) {
  useEffect(() => {
    scrollToTop();
  }, [key]);
}

/**
 * @param {{
 *   title?: Node,
 *   onBack?: () => void,
 *   action?: Node, children?: Node, footer?: Node,
 *   backLabel?: string,
 *   rise?: boolean,
 * }} props `rise` is for a screen opened to do one small thing and leave
 *   again — it comes up from the foot of the window rather than appearing,
 *   which says it is a step to the side of what is underneath rather than
 *   somewhere new.
 */
export function Screen({ title, onBack, action, children, footer, backLabel = "Back", rise }) {
  /** @type {React.MutableRefObject<{ el: Element | null, close?: () => void }>} */
  const self = useRef({ el: null });
  /* The screen's own element, so the stack can be checked against the
     document rather than trusted. See reconcileScreens. */
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const elRef = useRef(null);
  const host = useAppHost();

  /* A screen scrolls inside itself, so the page-level reset does not reach
     it — and one screen replacing another at the same place in the tree
     keeps the same DOM node, scroll position included. Opening a card from
     the bottom of a deck used to drop you into the middle of the card.
     Keyed on the title because that is what a screen has instead of an
     id; renaming the thing you are looking at scrolls you up, which is
     rare and cheap next to arriving halfway down every time. */
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [title]);

  useEffect(() => {
    const me = self.current;
    me.el = elRef.current;
    SCREEN_STACK.push(me);
    reconcileScreens();
    return () => {
      const i = SCREEN_STACK.indexOf(me);
      if (i >= 0) SCREEN_STACK.splice(i, 1);
      reconcileScreens();
    };
  }, []);

  /* The handler reads the latest onBack through a ref, so it is registered
     once rather than on every render of the parent. */
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== "Escape") return;
      /* Same reason as the class: a stale entry on top would otherwise
         swallow Escape for every screen underneath it. */
      reconcileScreens();
      if (SCREEN_STACK[SCREEN_STACK.length - 1] !== self.current) return;
      if (onBackRef.current) onBackRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Rendered at the app root rather than where it was written.
     
     A space is a positioned, layered element, so a screen opened inside one
     was trapped in that layer and the corner menu floated over it however
     high its z-index went. Portalling escapes that.
     
     The root, not the body: every colour, font and size in the app is a CSS
     variable declared on .at, and those are inherited, not global. A screen
     mounted on the body sits outside that scope, so var(--bg) resolves to
     nothing and the page shows straight through it. .at declares no position
     and no z-index of its own, so it is not a stacking context — mounting
     inside it escapes the space's layer while staying in the theme. */
  const view = (
    <div className={`at-screen over${rise ? " rise" : ""}`} ref={elRef} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <div className="at-screenhead">
        {onBack ? (
          <button className="at-back" onClick={onBack} aria-label={backLabel}>
            <Icon name="back" />
          </button>
        ) : (
          <span className="at-back" aria-hidden="true" style={{ visibility: "hidden" }} />
        )}
        <h2>{title}</h2>
        {/* The action sits hard right, away from the title, so back and save
            are at opposite ends and neither is hit by accident. */}
        <span className="at-screenaction">{action}</span>
      </div>
      <div className="at-screenbody" ref={bodyRef}>
        <div className="at-screeninner">
          {children}
          {footer ? <div className="at-screenfoot">{footer}</div> : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !host) return view;
  return createPortal(view, host);
}

/* Choosing one language: a radio list, one row per option, the same
   wherever a language is asked for. */
/**
 * @param {{
 *   languages: Record<string, { id: LangId, name: string }>,
 *   value?: LangId,
 *   onChange: (id: LangId) => void,
 *   label?: string, name?: string,
 * }} props
 */
export function LanguageRadio({ languages, value, onChange, label = "Language", name = "lang" }) {
  return (
    <div className="at-field" role="radiogroup" aria-label={label}>
      <label className="at-label">{label}</label>
      <div className="at-ticklist">
        {Object.values(languages).map((L) => (
          <label className="at-tickrow" key={L.id}>
            <input
              type="radio"
              name={name}
              checked={value === L.id}
              onChange={() => onChange(L.id)}
            />
            <span className="at-tickbody">
              <b>{L.name}</b>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* One shape for asking "are you sure".
 *
 * Callers describe the consequence; this decides how hard to ask, using the
 * rule in confirmStrength. Fifteen call sites used to pass six different
 * shapes and each host had to know them all.
 */
/**
 * @param {{
 *   title?: Node, body?: Node, verb?: string, name?: string,
 *   permanent?: boolean, affectsOthers?: boolean,
 *   action: () => any, then?: (result: any) => void,
 * }} ask
 */
export function askConfirm({ title, body, verb, name, permanent, affectsOthers, action, then }) {
  return {
    title,
    body,
    confirmLabel: verb || "Yes, do it",
    ...confirmStrength({ permanent, affectsOthers, name }),
    action,
    then,
  };
}

/**
 * `confirmWord` makes the person type a word before the button enables —
 * for the things that cannot be undone.
 * @param {{
 *   title?: Node,
 *   body?: Node,
 *   confirmLabel?: string,
 *   confirmWord?: string,
 *   busy?: boolean,
 *   danger?: boolean,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 * }} props
 */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmWord,
  busy,
  danger = true,
  onCancel,
  onConfirm,
}) {
  const [typed, setTyped] = useState("");
  /* Case and stray spaces aren't the point — the point is that you had to
     type the name rather than tap through. */
  const ready =
    !confirmWord || typed.trim().toLowerCase() === String(confirmWord).trim().toLowerCase();

  useEffect(() => {
    const onKey = (/** @type {KeyboardEvent} */ e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div className="at-modalback" onClick={onCancel}>
      <div
        className={`at-modal${danger ? " danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="at-modaltitle">{title}</h3>
        <div className="at-modalbody">{body}</div>

        {confirmWord && (
          <div className="at-field" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="at-label">
              Type <strong>{confirmWord}</strong> to confirm
            </label>
            <input
              className="at-input"
              value={typed}
              autoFocus
              placeholder={confirmWord}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ready && !busy && onConfirm()}
            />
          </div>
        )}

        <div className="at-row at-mt5">
          <button className="at-btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`at-btn ${danger ? "danger" : "primary"}`}
            disabled={!ready || busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* A wait worth mentioning.

   Most waits are not. Switching space, opening a tab, saving a card: on a
   working connection these come back inside a couple of hundred
   milliseconds, and a "Working…" that appears and vanishes inside that is
   read as a flicker, not as an answer — the eye catches the movement and
   nothing else. So a wait says nothing until it has lasted long enough to
   be a wait, and the quick ones pass in silence.

   Half a second is the usual figure for this and it holds here: long
   enough that a healthy round trip never reaches it, short enough that
   somebody who has started to wonder is told before they wonder twice. */
/**
 * @param {boolean | undefined} waiting
 * @param {number} [ms]
 */
export function useSlowWait(waiting, ms = 500) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [waiting, ms]);
  return slow;
}

/* --- what each space holds, and who fetches it ---------------------

   Teaching and Admin are unmounted the moment you leave them, so what they
   were showing is kept here rather than in the components: coming back puts
   the screen up at once and the check for what has changed runs behind it.

   It is also where "Sync now" leaves what it fetches. Pressing sync means
   "bring what I have up to date", and that has to include the spaces the
   person is not looking at — which have no component to ask. So the fetching
   lives here, in one function per space, used both by the space itself and by
   sync; a space that is on screen is handed the result and takes it.

   Held against the handle it was fetched for, so the next person to sign in on
   this device is shown nothing of the last one's, and what was kept for them
   is dropped the moment a different handle asks. */
/** @type {Record<string, { handle: string, shown: any } | null>} */
const spaceHeld = { admin: null, teach: null };
const spaceWatchers = new Set();

/* Quietly: the space itself, keeping the slot level with what it is
   showing. Nothing to tell anyone, since the teller is the only one
   showing it. */
/**
 * @param {"admin" | "teach"} space
 * @param {string} handle
 * @param {any} shown
 */
export function rememberSpace(space, handle, shown) {
  spaceHeld[space] = { handle, shown };
}

/* Out loud: a fetch made on somebody else's behalf, which whoever is on
   screen should take. */
/**
 * @param {"admin" | "teach"} space
 * @param {string} handle
 * @param {any} shown
 */
function deliverSpace(space, handle, shown) {
  rememberSpace(space, handle, shown);
  for (const watcher of [...spaceWatchers]) watcher(space, handle, shown);
}

/**
 * @param {"admin" | "teach"} space
 * @param {string} handle
 */
export function recallSpace(space, handle) {
  const held = spaceHeld[space];
  if (!held) return null;
  if (held.handle !== handle) {
    spaceHeld[space] = null;
    return null;
  }
  return held.shown;
}

/* A space on screen taking contents fetched for it elsewhere. The callback
   is held in a ref so that a space does not have to memoise it to avoid
   resubscribing on every render. */
/**
 * @param {"admin" | "teach"} space
 * @param {string} handle
 * @param {(shown: any) => void} adopt
 */
export function useFreshSpace(space, handle, adopt) {
  const latest = useRef(adopt);
  latest.current = adopt;
  useEffect(() => {
    const watcher = (/** @type {string} */ which, /** @type {string} */ whose, /** @type {any} */ shown) => {
      if (which === space && whose === handle) latest.current(shown);
    };
    spaceWatchers.add(watcher);
    return () => {
      spaceWatchers.delete(watcher);
    };
  }, [space, handle]);
}

/* The administrator's whole view of the site, in one request. */
/**
 * @param {string} handle
 * @returns {Promise<import("./types.ts").AdminOverview>}
 */
export async function pullAdmin(handle) {
  const data = await API.adminOverview();
  deliverSpace("admin", handle, data);
  return data;
}

/* What a teacher has: the courses they teach, their decks, their cards.
   One failing call shouldn't blank the screen, so what arrives is taken
   and what didn't is reported — and what was already held stands in for
   the part that failed. */
/** @param {string} handle */
export async function pullTeaching(handle) {
  const [c, d, k] = await Promise.allSettled([API.myCourses(), API.myDecks(), API.myCards()]);
  const before = recallSpace("teach", handle) || { courses: [], decks: [], cards: [] };
  const shown = {
    courses:
      c.status === "fulfilled"
        ? (c.value.courses || []).filter((/** @type {{ role: string }} */ x) => x.role === "teacher")
        : before.courses,
    decks: d.status === "fulfilled" ? d.value.decks || [] : before.decks,
    cards: k.status === "fulfilled" ? k.value.cards || [] : before.cards,
  };
  deliverSpace("teach", handle, shown);
  const failed = [c, d, k].find((r) => r.status === "rejected");
  return { ...shown, failed: failed ? failed.reason : null };
}

/* Course membership is changed by other people on other devices, so a screen
   that fetched once at mount goes quietly stale — a deleted course sits there
   until the app is reloaded. Re-fetch whenever this window comes back to the
   foreground, and occasionally while it stays there. */
/**
 * @param {() => void} refresh
 * @param {number} [everyMs]
 */
export function useLiveRefresh(refresh, everyMs = 45000) {
  useEffect(() => {
    if (!refresh) return undefined;
    const again = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    const timer = setInterval(again, everyMs);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
      clearInterval(timer);
    };
  }, [refresh, everyMs]);
}

/** @type {Record<string, string>} */
const MODE_LABEL = { learn: "Learning", teach: "Teaching", admin: "Admin" };

/**
 * @param {{
 *   mode: string,
 *   modes: string[],
 *   onChange: (mode: string) => void,
 * }} props
 */
export function ModeSelector({ mode, modes, onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  if (modes.length < 2) return null;

  return (
    <div className="at-mode" onClick={(e) => e.stopPropagation()}>
      <button className="at-modebtn" onClick={() => setOpen((v) => !v)}>
        {MODE_LABEL[mode]}
        <span className={`at-modecaret${open ? " up" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="at-modemenu">
          {modes.map((m) => (
            <button
              key={m}
              className={`at-modeitem${m === mode ? " on" : ""}`}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              {MODE_LABEL[m]}
              {m === mode && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* A local id derived from the server's, so progress survives a refresh. */
/** @type {(cardId: string) => string} */
export const localIdFor = (cardId) => `srv${cardId}`;

/* The recordings on one form, as the trainer holds them: the ordinary ones
   first and unnamed, the slow ones after and named, so a card that has both
   plays the real one by default and offers the slow one beside it. */
/** @param {{ clips?: string[], slowClips?: string[] }} form */
function recsOf(form) {
  return clipsOf(form).map((c) => ({
    id: c.id,
    label: c.speed === "slow" ? c.label : "",
    /* What the player sorts on. A recording the learner made themselves
       carries no speed, which reads as the ordinary one — which is what it
       is. */
    speed: c.speed,
    mime: "",
    size: 0,
    dur: 0,
  }));
}

/* Turn what the server holds into what the trainer expects. */
/* One card's accepted answers, in the shape a card stores them: no index,
   because an index is a fact about a list rather than about an answer. */
/** @param {Record<string, any>} form */
const keptAnswers = (form) =>
  answersOf(form, answerFields()).map(({ at: _at, ...answer }) => answer);

/**
 * @param {Card} card
 * @param {string} deckTitle
 * @param {string} courseId
 * @param {string} deckId
 * @param {() => Record<string, ExerciseState>} freshStates
 * @returns {Item}
 */
export function cardToItem(card, deckTitle, courseId, deckId, freshStates) {
  const forms = (card.subs || []).map((sb, i) => ({
    id: `${localIdFor(card.id)}-f${i}`,
    ar: sb.ar || "",
    lat: sb.lat || "",
    en: sb.en || "",
    ...dimValues(sb),
    /* What each accepted answer is, grammatically. Read rather than copied,
       so a card the server has not been asked to save since the change —
       one set of values flat on the form — arrives with each of its answers
       carrying them, which is what they meant when there was one set. */
    answers: keptAnswers(sb),
    note: "",
    /* Which language this is in, carried onto every form rather than onto
       the card alone: a form is what an exercise is about, and what marks
       an answer has to be the language the words are in — not whichever
       language the app happens to be set to, which for somebody studying
       two is right half the time. */
    lang: card.lang,
    recs: recsOf(sb),
    created: Date.now(),
    updated: Date.now(),
    s: freshStates(),
  }));

  /* A conversation's turns, which are forms with a speaker on them. Named
     the way the other forms are, so a line keeps its progress across a
     refresh; the words a line uses are card ids on the server and item
     ids here, the same translation the card's own `uses` gets. */
  const lines = (/** @type {Record<string, any>[]} */ (card.lines || [])).map((ln, /** @type {number} */ i) => ({
    id: `${localIdFor(card.id)}-l${i}`,
    who: Number(ln.who) || 0,
    ar: ln.ar || "",
    lat: ln.lat || "",
    en: ln.en || "",
    uses: (ln.uses || []).map(localIdFor),
    lang: card.lang,
    recs: recsOf(ln),
    created: Date.now(),
    updated: Date.now(),
    s: freshStates(),
  }));

  return {
    id: localIdFor(card.id),
    ar: card.ar || "",
    lat: card.lat || "",
    en: card.en || "",
    /* Every course card used to arrive labelled a word, whatever it held.
       That made the practice filter useless on course material, told the
       session builder that any two cards were more alike than they are, and
       set full sentences in the single-word type size — and it is why the
       app cannot yet see that one of these phrases contains one of these
       words. Asked of the language, which owns the rule. */
    /* A card with turns on it is a conversation, whatever its own fields
       would otherwise have been guessed as: the kind follows what the card
       holds. Asked through kindOf, which is the one answer to "what is
       this card" that every screen reads. */
    kind: kindOf({ ...card, lines }, LANGUAGES[card.lang]),
    ...(lines.length
      ? {
          lines,
          speakers: (/** @type {string[]} */ (card.speakers || [])).filter(Boolean),
          /* Which part the student takes, or null where the teacher left it
             open — in which case the question picks one, and picks the
             other next time. */
          you: namedPart(card),
        }
      : null),
    /* See the forms above: the card says what language it is in, and the
       device keeps it. */
    lang: card.lang,
    /* The word cards this one teaches by containing them, as the teacher
       confirmed them. Server card ids; the index that turns them into
       questions maps them to local ids. */
    uses: (card.uses || []).map(localIdFor),
    note: card.note || "",
    tags: [deckTitle],
    locked: true,
    flags: [],
    recs: recsOf(card),
    ...dimValues(card),
    answers: keptAnswers(card),
    subs: forms,
    source: { courseId, deckId, cardId: card.id, rev: card.rev || 1 },
    /* When the card was made, not when it reached this device — so "added"
       means the same thing to the student as it does to the teacher who
       added it. Falls back for a card made before the server kept the
       date. */
    created: card.created || Date.now(),
    updated: Date.now(),
    s: freshStates(),
  };
}

/*
 * And back the other way: what the server calls the card an item came from.
 *
 * localIdFor is not reversible by taking the prefix off, because an item
 * may be a form of a card rather than the card, and because an item that
 * was never a course card has no server id at all. `source` is the honest
 * answer and every course card carries one.
 *
 * It exists because reporting an item's own id for a course card is a
 * mistake with no symptom on this side: the report is accepted, filed, and
 * read at the other end as being about a card the site has never held.
 */
/** @param {Item | null | undefined} item */
export function serverCardId(item) {
  if (!item) return "";
  if (item.source && item.source.cardId) return item.source.cardId;
  return item.id || "";
}

/*
 * Fetch every course the person studies and fold its cards into the local
 * ones. Anything already here keeps its progress; anything the teacher has
 * withdrawn goes. Cards the person made themselves are untouched.
 *
 * One request. The server is told the version last seen and answers
 * { unchanged } when nothing has moved, which is nearly always — so the
 * forty-five-second check costs a few bytes rather than a request per
 * course, one per deck, and a rewrite of every card.
 */
/**
 * The two answers are told apart by `unchanged`, which is why it is a
 * literal `true` on one and absent on the other rather than a boolean on
 * both: `if (r.unchanged) return;` is then enough for the checker to know
 * that everything below the guard is the full answer.
 *
 * @typedef {object} CoursesUnchanged
 * @property {true} unchanged
 * @property {string} version
 * @property {boolean} teaches
 */
/**
 * @typedef {object} Folded
 * @property {Item[]} items
 * @property {number} added
 * @property {number} gone
 * @property {string[]} goneIds
 */
/**
 * @typedef {Folded & {
 *   unchanged?: false,
 *   decks: Deck[],
 *   courses: Course[],
 *   fold: (current: Item[]) => Folded,
 *   version: string,
 *   teaches: boolean,
 * }} CoursesPulled
 */
/**
 * @param {Item[]} items
 * @param {() => Record<string, ExerciseState>} freshStates
 * @param {string} [knownVersion]
 * @returns {Promise<CoursesUnchanged | CoursesPulled>}
 */
export async function pullCourses(items, freshStates, knownVersion) {
  const r = await API.myMaterial(knownVersion || "");
  if (r.unchanged) {
    return { unchanged: true, version: r.version || "", teaches: !!r.teaches };
  }
  const enrolled = r.courses || [];
  const decks = r.decks || [];
  /** @type {Map<string, Card[]>} */
  const cardsByDeck = new Map((r.cards || []).map((/** @type {{ deckId: string, cards?: Card[] }} */ x) => [x.deckId, x.cards || []]));

  /** @type {Item[]} */
  const incoming = [];
  for (const deck of decks) {
    for (const card of cardsByDeck.get(deck.id) || []) {
      incoming.push(cardToItem(card, deck.title, deck.courseId, deck.id, freshStates));
    }
  }

  const folded = foldCourses(items, incoming);
  return {
    ...folded,
    decks,
    courses: enrolled,
    /* The same fold again, against whatever the cards are by the time the
       caller adopts the result. */
    fold: (/** @type {Item[]} */ current) => foldCourses(current, incoming),
    version: r.version || "",
    teaches: !!r.teaches,
  };
}

/* Fold fresh course cards into the person's cards: progress kept, wording
   taken from the teacher, withdrawn cards named so they can be tombstoned. */
/**
 * @param {Item[]} items
 * @param {Item[]} incoming
 */
export function foldCourses(items, incoming) {
  const byId = new Map(items.map((i) => [i.id, i]));
  /** @type {Item[]} */
  const kept = [];
  for (const fresh of incoming) {
    const existing = byId.get(fresh.id);
    if (existing) {
      /* Keep what the student has earned; take the teacher's wording. */
      kept.push({
        ...fresh,
        s: existing.s,
        subs: (fresh.subs || []).map((f, i) => ({ ...f, s: ((existing.subs || [])[i] || {}).s || f.s })),
      });
    } else {
      kept.push(fresh);
    }
  }

  const incomingIds = new Set(kept.map((i) => i.id));
  const own = items.filter((i) => !i.source);
  /* Which course cards have been withdrawn. The ids matter, not just the
     count: dropping them from this device is not enough, because the shared
     copy still holds them and the next sync would hand them straight back.
     They have to be marked as deleted, the same as a card the person removed
     themselves. */
  const goneIds = items.filter((i) => i.source && !incomingIds.has(i.id)).map((i) => i.id);

  return {
    items: own.concat(kept),
    added: kept.length,
    gone: goneIds.length,
    goneIds,
  };
}
