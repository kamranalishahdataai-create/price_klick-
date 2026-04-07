// web/src/components/RunAgentButton.jsx
import { useState } from "react";
import { API_BASE } from "../api/client";

export default function RunAgentButton({ secret = "changeme" }) {
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  async function runAgent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/agent/run?secret=${encodeURIComponent(secret)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || "Agent failed");
      }

      // derive a quick summary for UI
      const results = Array.isArray(data.results) ? data.results : [];
      const notified = results.filter(r => r.notified).length;
      const updated = results.length;

      setSummary({ notified, updated });
      setLastRun(new Date());
      // simple toast
      alert(`Agent ran ✅\nUpdated: ${updated}\nNotified: ${notified}`);
      console.log("Agent results:", data);
    } catch (e) {
      setError(e.message || String(e));
      alert(`Agent failed ❌\n${e.message || e}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
        padding: 16,
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(50,0,150,.06)",
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ fontWeight: 800 }}>AI Agent</div>
        <div style={{ color: "#6a6880", fontSize: 14 }}>
          Scans your wishlist and emails users when prices drop.
        </div>
        {summary && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#6a6880" }}>
            Last run: <b>{lastRun?.toLocaleTimeString()}</b> • Updated{" "}
            <b>{summary.updated}</b> items, emailed <b>{summary.notified}</b>.
          </div>
        )}
        {error && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#d12" }}>
            {error}
          </div>
        )}
      </div>

      <button
        className="btn primary"
        onClick={runAgent}
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          background: "linear-gradient(180deg,#6D4AFF,#9B5BFF)",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          minWidth: 160,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Running…" : "Run Agent Now"}
      </button>
    </div>
  );
}
