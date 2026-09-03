import React from "react";
import { createRoot } from "react-dom/client";
import { storage, requestPersistence } from "./storage.js";
import ArabicTrainer from "./ArabicTrainer.jsx";
import "./index.css";

// The component reads window.storage, so point it at the local adapter.
window.storage = storage;

// Ask for durable storage before first paint. Harmless if unsupported.
requestPersistence();

/*
 * The last line of defence. A render error anywhere used to leave a blank
 * page, and because the document is already saved, the same blank page on
 * every launch after that. This catches it, keeps the page usable, and
 * offers the two things that always help: a reload, and a copy of the data
 * as it stands so nothing is lost while the cause is found.
 */
class Recovery extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Unrecoverable render error:", error);
  }

  download() {
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
    const msg = String((this.state.error && this.state.error.message) || this.state.error);
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Recovery>
      <ArabicTrainer />
    </Recovery>
  </React.StrictMode>
);
