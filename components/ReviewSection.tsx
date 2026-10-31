"use client";

import { useEffect, useState } from "react";
import type { PublicReview, ReviewSummary } from "@/lib/types";

type Mode = "resend" | "dev" | "off";

export function Stars({ value, size = "1rem" }: { value: number; size?: string }) {
  return (
    <span aria-label={`${value} out of 5`} style={{ color: "#d98a00", letterSpacing: 1, fontSize: size }}>
      {"★".repeat(Math.round(value))}
      <span style={{ color: "#d9d6c9" }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export default function ReviewSection({
  productId,
  productName,
  reviews,
  summary,
  mode,
}: {
  productId: string;
  productName: string;
  reviews: PublicReview[];
  summary: ReviewSummary;
  mode: Mode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", rating: 0, title: "", body: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<null | { devVerifyUrl?: string }>(null);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("review") === "verified") setJustVerified(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your review.");
      setSent({ devVerifyUrl: data.devVerifyUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sc-section" id="reviews">
      <h2>
        Reviews{" "}
        {summary.count > 0 && (
          <span className="muted small">
            <Stars value={summary.avg} /> {summary.avg.toFixed(1)} · {summary.count} email-verified review{summary.count === 1 ? "" : "s"}
          </span>
        )}
      </h2>

      {justVerified && <div className="alert ok">Thank you. Your email is confirmed and your review is now live.</div>}

      {!reviews.length && <p className="muted">No reviews yet. Used {productName}? Be the first to share what it was like.</p>}

      {reviews.map((r) => (
        <div className="feat" key={r.id}>
          <div className="row between">
            <span>
              <Stars value={r.rating} /> <b style={{ display: "inline" }}>{r.title || ""}</b>
            </span>
            <span className="muted small">
              {r.name} · {r.date}
            </span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
          {r.reply && (
            <blockquote className="passage">
              <b>Reply from the {productName} team:</b> {r.reply.text}
            </blockquote>
          )}
        </div>
      ))}

      <p className="muted small" style={{ marginTop: 8 }}>
        Reviews are published only after the reviewer confirms their email. We don&apos;t verify that a reviewer is a paying customer. Founders can reply but cannot edit or remove reviews.
      </p>

      {mode === "off" ? (
        <p className="muted small">Reviews aren&apos;t switched on yet for this site.</p>
      ) : sent ? (
        <div className="alert ok">
          {sent.devVerifyUrl ? (
            <>
              <b>Dev mode (no email service configured):</b> open this link to confirm your review —{" "}
              <a href={sent.devVerifyUrl}>confirm my review</a>
            </>
          ) : (
            <>We&apos;ve emailed you a confirmation link. Click it and your review goes live. Check your spam folder if you don&apos;t see it.</>
          )}
        </div>
      ) : !open ? (
        <button className="btn" onClick={() => setOpen(true)}>
          Write a review
        </button>
      ) : (
        <form className="card" onSubmit={submit} style={{ marginTop: 10 }}>
          <div className="field">
            <label>Your rating</label>
            <div className="row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className="btn sm"
                  aria-pressed={form.rating === n}
                  onClick={() => setForm({ ...form, rating: n })}
                  style={form.rating === n ? { background: "var(--brand-soft)", borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
                >
                  {n} ★
                </button>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label>Your name (shown publicly)</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} />
            </div>
            <div className="field">
              <label>Your email (never shown)</label>
              <input type="text" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </div>
          </div>
          <div className="field">
            <label>Headline (optional)</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />
          </div>
          <div className="field">
            <label>What was it like to use {productName}?</label>
            <textarea rows={4} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={1500} placeholder="What did you use it for, what worked, what didn't?" />
          </div>
          {/* honeypot: hidden from people, tempting to bots */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
          {error && <div className="alert err">{error}</div>}
          <div className="row">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Submit and confirm by email"}
            </button>
            <button className="btn" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
