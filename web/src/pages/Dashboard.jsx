// web/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useConsent, useWishlist, useCompare, useCoupons, useTrends } from "../hooks/useBackendExamples";
import RunAgentButton from "../components/RunAgentButton";
import { useToast } from "../components/ToastProvider";

export default function Dashboard() {
  const { userId, giveConsent } = useConsent();
  const { add, list, remove } = useWishlist(userId);
  const { compare } = useCompare();
  const { apply } = useCoupons();
  const { trends } = useTrends();
  const { addToast } = useToast(); // <- string-only toasts: addToast(message, type?)

  const [email, setEmail] = useState(localStorage.getItem("cf_email") || "test@example.com");
  const [title, setTitle] = useState("Logitech MX Master 3S");
  const [target, setTarget] = useState(70);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consenting, setConsenting] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(
    localStorage.getItem("cf_agent_last_run") ? Number(localStorage.getItem("cf_agent_last_run")) : null
  );

  // create / load user once, then load wishlist
  useEffect(() => {
    (async () => {
      if (!userId) {
        try {
          setConsenting(true);
          await giveConsent(email);
          localStorage.setItem("cf_email", email);
        } finally {
          setConsenting(false);
        }
      }
      const wl = await list().catch(() => []);
      setWishlist(wl);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // re-run once userId exists

  async function handleAdd(e) {
    e.preventDefault();
    await add({ title, target_price: Number(target), currency: "USD" });
    setWishlist(await list());
    addToast(`“${title}” saved to wishlist.`, "success");
    setTitle("");
  }

  async function handleConsent() {
    try {
      setConsenting(true);
      await giveConsent(email);
      localStorage.setItem("cf_email", email);
      setWishlist(await list());
      addToast("Email saved. You'll get alerts when prices drop.", "success");
    } finally {
      setConsenting(false);
    }
  }

  const HeaderBadge = () =>
    lastRunAt ? (
      <span
        style={{
          marginLeft: 12,
          fontSize: 12,
          background: "#efeaff",
          color: "#4a3fbf",
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #e2defb",
          verticalAlign: "middle",
        }}
      >
        last run: {new Date(lastRunAt).toLocaleTimeString()}
      </span>
    ) : null;

  return (
    <section style={{ background: "#F7F5FF", padding: "64px 0" }}>
      <div className="container" style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, marginBottom: 12 }}>
          Your Savings Hub <HeaderBadge />
        </h1>
        <p style={{ color: "#5b5b76", marginBottom: 24 }}>
          All your wishlist items, latest best prices, coupons and trend summaries in one place.
        </p>

        {/* Run Agent (manual) */}
        <RunAgentButton
          secret="changeme"
          onAfterRun={({ at, updated, notified }) => {
            setLastRunAt(at);
            addToast(`Agent ran. Updated ${updated} item(s); emailed ${notified}.`, "success");
          }}
        />

        {/* Consent / Email row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px",
            gap: 12,
            background: "#ffffff",
            padding: 16,
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(50, 0, 150, 0.06)",
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (for alerts)"
            className="input"
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #E2E0F0" }}
          />
          <button
            className="btn primary"
            onClick={handleConsent}
            disabled={consenting}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "linear-gradient(180deg,#6D4AFF,#9B5BFF)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: consenting ? "not-allowed" : "pointer",
              opacity: consenting ? 0.7 : 1,
            }}
          >
            {consenting ? "Saving…" : "Save email"}
          </button>
        </div>

        {/* Add item / start */}
        <form
          onSubmit={handleAdd}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 160px",
            gap: 12,
            background: "#ffffff",
            padding: 16,
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(50, 0, 150, 0.08)",
            marginBottom: 24,
            alignItems: "center",
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Product name (e.g., Logitech MX Master 3S)"
            className="input"
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #E2E0F0" }}
          />
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target price"
            className="input"
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #E2E0F0" }}
          />
          <button
            type="submit"
            className="btn primary"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "linear-gradient(180deg,#6D4AFF,#9B5BFF)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
            }}
          >
            Save to wishlist
          </button>
        </form>

        {loading ? (
          <div>Loading…</div>
        ) : wishlist.length === 0 ? (
          <p style={{ color: "#5b5b76" }}>No items yet. Use the form above to add one.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {wishlist.map((it) => (
              <div
                key={it.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: "0 8px 30px rgba(50, 0, 150, 0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{it.title}</div>
                    <div style={{ color: "#6a6880", fontSize: 14, marginTop: 4 }}>
                      Target: {it.target_price ?? "—"} {it.currency} &nbsp;•&nbsp; Last:{" "}
                      {it.last_price ?? "—"} {it.currency}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn"
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E0F0" }}
                      onClick={async () => {
                        try {
                          const res = await compare(it.sku || it.title);
                          if (res?.best) {
                            addToast(`Best: ${res.best.source}  $${res.best.price}`, "success");
                          } else {
                            addToast("No comparison results found.", "warning");
                          }
                          console.log("Compare:", res);
                        } catch (e) {
                          addToast("Compare failed. Check console.", "error");
                          console.error(e);
                        }
                      }}
                    >
                      Compare
                    </button>

                    <button
                      className="btn"
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E0F0" }}
                      onClick={async () => {
                        try {
                          // For demo, ask user for price. In real app, get from cart data
                          const priceStr = window.prompt("Enter original price:");
                          const originalPrice = parseFloat(priceStr);
                          if (isNaN(originalPrice) || originalPrice <= 0) {
                            addToast("Invalid price.", "error");
                            return;
                          }
                          const c = await apply("https://example.com/cart/123", originalPrice);
                          if (c?.code) {
                            const msg = `Coupon ${c.code} applied!\nBefore: $${c.originalPrice}  After: $${c.discountedPrice}`;
                            addToast(msg, "success");
                          } else {
                            addToast("No coupons found.", "warning");
                          }
                          console.log("Coupon:", c);
                        } catch (e) {
                          addToast("Coupon check failed. See console.", "error");
                          console.error(e);
                        }
                      }}
                    >
                      Coupon
                    </button>

                    <button
                      className="btn"
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E0F0" }}
                      onClick={async () => {
                        try {
                          const t = await trends(it.title);
                          if (t && typeof t.avg !== "undefined") {
                            addToast(`Search trend avg ~ ${Math.round(t.avg)}`, "info");
                          } else {
                            addToast("No trend data.", "warning");
                          }
                          console.log("Trends:", t);
                        } catch (e) {
                          addToast("Trend fetch failed. See console.", "error");
                          console.error(e);
                        }
                      }}
                    >
                      Trends
                    </button>

                    <button
                      className="btn"
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #FFD6DB", color: "#D11A2A" }}
                      onClick={async () => {
                        await remove(it.id);
                        setWishlist(await list());
                        addToast(`“${it.title}” removed.`, "warning");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
