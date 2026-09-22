/*
 * A clock face, to read and to set.
 *
 * The one thing about telling the time that a word cannot ask. A learner
 * who can say *quarter past seven* from the figures 7:15 has learnt a
 * translation; one who can say it from a dial has learnt to tell the
 * time, and the two come apart in exactly the place the skill is used.
 *
 * Drawn rather than photographed, and drawn here rather than shipped as
 * an image, for the reasons the progress ring is: it has to take the
 * theme's colours, it has to be legible at the size a phone gives it, and
 * a picture of a clock is a file somebody has to remember to update when
 * the palette moves.
 *
 * Two components, because they are two different things:
 *
 *   * `ClockFace` is a **reading**. It is told a time and draws it, and
 *     it is `aria-hidden` with the time said in words beside it — a
 *     screen reader given a dial to interpret is a screen reader asked to
 *     do the exercise.
 *   * `ClockDial` is an **answer**. The hands are dragged, and because a
 *     thumb on a phone is not a precise instrument the minute hand snaps
 *     to whatever the question is asking in. It is keyboard-answerable
 *     too: the hour and the minute are each a slider, which is what a
 *     dial is once you stop drawing it.
 */
import { useCallback, useRef, useState } from "react";

/** Where the hands point, in degrees clockwise from twelve. */
const hourAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30;
const minuteAngle = (m: number) => (m % 60) * 6;

/** A point on a circle of radius `r`, at `deg` clockwise from the top. */
function at(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

export interface ClockFaceProps {
  hour: number;
  minute: number;
  /** What the time is, in words, for anybody not reading the picture. */
  label?: string;
  /** Marks every five minutes rather than every hour, for a question
      that is about the minutes. */
  fine?: boolean;
  size?: number;
}

/**
 * A time, drawn.
 *
 * The numerals are left off on purpose. A dial with 1 to 12 written round
 * it can be read by finding the number the short hand is nearest, which
 * is a different and much smaller skill than reading the angle — and it
 * is the one a learner falls back on the moment it is available.
 */
export function ClockFace({ hour, minute, label, fine = false, size = 180 }: ClockFaceProps) {
  const ticks = [];
  for (let i = 0; i < (fine ? 60 : 12); i += 1) {
    const deg = i * (fine ? 6 : 30);
    const major = fine ? i % 5 === 0 : true;
    const a = at(deg, major ? 38 : 41);
    const b = at(deg, 44);
    ticks.push(
      <line key={i} className={major ? "major" : "minor"} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />,
    );
  }
  const h = at(hourAngle(hour, minute), 24);
  const m = at(minuteAngle(minute), 36);
  return (
    <div className="at-clock" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="rim" cx="50" cy="50" r="47" />
        <g className="ticks">{ticks}</g>
        <line className="hand hour" x1="50" y1="50" x2={h.x} y2={h.y} />
        <line className="hand minute" x1="50" y1="50" x2={m.x} y2={m.y} />
        <circle className="pin" cx="50" cy="50" r="3" />
      </svg>
      {/* The picture is the question; this is what it says for anybody
          who is not looking at it. */}
      {label ? <span className="at-sr">{label}</span> : null}
    </div>
  );
}

export interface ClockDialProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  /** What the minutes may land on. Absent means any minute. */
  marks?: number[];
  /** Whether the hour is said on a twelve-hour clock. */
  clock?: "12h" | "24h";
  disabled?: boolean;
}

/**
 * A time, set.
 *
 * Dragging moves whichever hand is nearer where the finger went down, and
 * the minute hand lands on the marks the question uses — five past or
 * quarter past, never seven minutes past, when the question is asked in
 * fives. A thumb is not a precise instrument and a question that asks for
 * precision it cannot give is a question about the screen.
 */
export function ClockDial({ hour, minute, onChange, marks, clock = "12h", disabled }: ClockDialProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const [holding, setHolding] = useState<"hour" | "minute" | null>(null);

  const snap = useCallback(
    (m: number) => {
      if (!marks || !marks.length) return ((m % 60) + 60) % 60;
      const want = ((m % 60) + 60) % 60;
      let best = marks[0];
      let gap = 60;
      for (const mark of marks) {
        const d = Math.min(Math.abs(mark - want), 60 - Math.abs(mark - want));
        if (d < gap) {
          gap = d;
          best = mark;
        }
      }
      return best;
    },
    [marks],
  );

  /** Where a touch landed, as an angle from twelve. */
  const angleAt = (clientX: number, clientY: number) => {
    const el = box.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    if (!x && !y) return null;
    const deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    return { deg: ((deg % 360) + 360) % 360, r: Math.hypot(x, y) / (rect.width / 2) };
  };

  const move = (clientX: number, clientY: number, which: "hour" | "minute" | null) => {
    const found = angleAt(clientX, clientY);
    if (!found) return;
    /* Which hand: the one the finger went down nearer to. The minute hand
       is the long one, so the outer half of the face is its. */
    const hand = which || (found.r > 0.55 ? "minute" : "hour");
    if (hand === "minute") {
      onChange(hour, snap(Math.round(found.deg / 6)));
    } else {
      const twelve = Math.round(found.deg / 30) % 12;
      /* A twelve-hour dial has no nought on it, and a twenty-four-hour
         clock still only has twelve positions — which half of the day it
         is stays whatever the learner last said. */
      const said = twelve === 0 ? 12 : twelve;
      const afternoon = clock === "24h" && hour >= 12;
      onChange(afternoon ? (said % 12) + 12 : said % 12 || (clock === "24h" ? 0 : 12), minute);
    }
    setHolding(hand);
  };

  const ticks = [];
  for (let i = 0; i < 60; i += 1) {
    const deg = i * 6;
    const major = i % 5 === 0;
    const a = at(deg, major ? 38 : 41);
    const b = at(deg, 44);
    ticks.push(
      <line key={i} className={major ? "major" : "minor"} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />,
    );
  }
  const h = at(hourAngle(hour, minute), 24);
  const m = at(minuteAngle(minute), 36);

  return (
    <div className="at-dialwrap">
      <div
        ref={box}
        className={`at-clock at-dial${disabled ? " off" : ""}`}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          move(e.clientX, e.clientY, null);
        }}
        onPointerMove={(e) => {
          if (disabled || !holding) return;
          move(e.clientX, e.clientY, holding);
        }}
        onPointerUp={() => setHolding(null)}
        onPointerCancel={() => setHolding(null)}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="rim" cx="50" cy="50" r="47" />
          <g className="ticks">{ticks}</g>
          <line className="hand hour" x1="50" y1="50" x2={h.x} y2={h.y} />
          <line className="hand minute" x1="50" y1="50" x2={m.x} y2={m.y} />
          <circle className="pin" cx="50" cy="50" r="3" />
        </svg>
      </div>
      {/*
       * The same answer, typed rather than dragged.
       *
       * Not a fallback for a broken dial: a range is a slider to a
       * keyboard and to a screen reader, and it is the only way either of
       * them can give this answer at all. Both are always live, and each
       * shows what the other did.
       */}
      <div className="at-dialrows">
        <label className="at-dialrow">
          <span>Hour</span>
          <input
            type="range"
            min={clock === "24h" ? 0 : 1}
            max={clock === "24h" ? 23 : 12}
            value={clock === "24h" ? hour : hour % 12 || 12}
            disabled={disabled}
            onChange={(e) => {
              const said = Number(e.target.value);
              if (clock === "24h") return onChange(said, minute);
              const afternoon = hour >= 12;
              onChange(afternoon ? (said % 12) + 12 : said % 12, minute);
            }}
          />
          <b>{clock === "24h" ? hour : hour % 12 || 12}</b>
        </label>
        <label className="at-dialrow">
          <span>Minute</span>
          <input
            type="range"
            min={0}
            max={59}
            step={marks && marks.length ? 5 : 1}
            value={minute}
            disabled={disabled}
            onChange={(e) => onChange(hour, snap(Number(e.target.value)))}
          />
          <b>{String(minute).padStart(2, "0")}</b>
        </label>
        {clock === "12h" ? (
          <label className="at-dialrow">
            <span>Half</span>
            <button
              type="button"
              className="at-dialhalf"
              disabled={disabled}
              onClick={() => onChange((hour + 12) % 24, minute)}
            >
              {hour < 12 ? "morning" : "afternoon"}
            </button>
            <b />
          </label>
        ) : null}
      </div>
    </div>
  );
}
