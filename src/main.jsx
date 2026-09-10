import React from "react";
import { createRoot } from "react-dom/client";
import { storage, requestPersistence } from "./storage.js";
import { watchForUpdates } from "./updates.js";
import ArabicTrainer from "./ArabicTrainer.jsx";
import "./index.css";

// The component reads window.storage, so point it at the local adapter.
window.storage = storage;

// Ask for durable storage before first paint. Harmless if unsupported.
requestPersistence();

/* Before anything renders: a newly deployed worker can take charge at any
   moment, including during the first paint, and this is what notices. */
watchForUpdates();

/*
 * The last line of defence. A render error anywhere used to leave a blank
 * page, and because the document is already saved, the same blank page on
 * every launch after that. This catches it, keeps the page usable, and
 * offers the two things that always help: a reload, and a copy of the data
 * as it stands so nothing is lost while the cause is found.
 */
/**
 * @typedef {{ children?: React.ReactNode }} RecoveryProps
 * @typedef {{ error: unknown }} RecoveryState
 * @extends {React.Component<RecoveryProps, RecoveryState>}
 */
class Recovery extends React.Component {
  /** @param {RecoveryProps} props */
  constructor(props) {
    super(props);
    /** @type {RecoveryState} */
    this.state = { error: null };
  }

  /** @param {unknown} error */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /** @param {unknown} error */
  componentDidCatch(error) {
    console.error("Unrecoverable render error:", error);
  }

  download() {
    /** @type {Record<string, string | null>} */
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("arabic-trainer")) out[k] = localStorage.getItem(k);
      }
    } catch (e) {
      /* nothing readable */
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taleb33-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const err = this.state.error;
    const msg = String(
      (err && typeof err === "object" && "message" in err && err.message) || err
    );
    return (
      <div style={{ padding: "32px 20px", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui" }}>
        <h2 style={{ marginTop: 0 }}>Something broke</h2>
        <p>
          The app hit an error it couldn't recover from. Your cards and progress are still saved on
          this device.
        </p>
        <p style={{ fontSize: 13, opacity: 0.7, wordBreak: "break-word" }}>{msg}</p>
        <p>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 16px", marginRight: 10 }}>
            Reload
          </button>
          <button onClick={() => this.download()} style={{ padding: "10px 16px" }}>
            Download my data
          </button>
        </p>
      </div>
    );
  }
}

const host = document.getElementById("root");
if (!host) throw new Error("No #root element: index.html is not the one this build expects.");

createRoot(host).render(
  <React.StrictMode>
    <Recovery>
      <ArabicTrainer />
    </Recovery>
  </React.StrictMode>
);
