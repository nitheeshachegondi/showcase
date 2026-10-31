"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/search";
import { Stars } from "@/components/ReviewSection";

const EXAMPLES = [
  "I need an interview tool that creates a roadmap from my resume and a job description",
  "Something to make my resume pass ATS filters",
  "Communication skills practice for pharmacy students",
];

export default function Discover() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState("");
  const seq = useRef(0);

  async function run(query: string) {
    const my = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("Search failed. Check your connection and try again.");
      const data = (await r.json()) as SearchResult;
      if (my !== seq.current) return;
      setRes(data);
      setSearched(query.trim());
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    run("");
  }, []);

  const showingAll = !searched;

  return (
    <>
      <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", letterSpacing: "-.035em" }}>What do you need?</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Say it the way you&apos;d tell a friend. We search the features founders have documented, so each result shows what matched.
      </p>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <textarea
          value={q}
          aria-label="Describe what you need"
          placeholder="e.g. I need an interview tool that builds a roadmap from my resume and a job description"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run(q);
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="example"
            onClick={() => {
              setQ(ex);
              run(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="alert err">{error}</div>}

      {res && (
        <>
          <p className="muted small" style={{ marginBottom: 6 }}>
            {showingAll
              ? `${res.total} published product${res.total === 1 ? "" : "s"}`
              : `${res.hits.length} match${res.hits.length === 1 ? "" : "es"} for “${searched}”${res.mode === "keyword" ? ", found by keyword" : ""}`}
          </p>

          {!res.hits.length && (
            <div className="card center">
              <p>{showingAll ? "No products have been published yet." : "No product matches that need yet. Try describing the goal instead of the tool."}</p>
              <Link href="/founder/new" className="btn primary">
                Add your product
              </Link>
            </div>
          )}

          {res.hits.map((h) => (
            <div key={h.slug} className="result">
              <div className="row between" style={{ alignItems: "baseline" }}>
                <div className="headword">
                  <Link href={`/products/${h.slug}`}>{h.name}</Link>
                </div>
                {!showingAll && h.score > 0 && <span className="score">{h.score}% match</span>}
              </div>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {h.tagline}
              </p>
              {(h.rating || h.hasDeal) && (
                <p className="row" style={{ margin: "8px 0 0" }}>
                  {h.rating && (
                    <span className="small">
                      <Stars value={h.rating.avg} /> {h.rating.avg.toFixed(1)} <span className="muted">from {h.rating.count} verified review{h.rating.count === 1 ? "" : "s"}</span>
                    </span>
                  )}
                  {h.hasDeal && <span className="tag warn">Special offer</span>}
                </p>
              )}
              {!showingAll && h.why && <p className="why">{h.why}</p>}
              {h.matched.length > 0 && (
                <ul className="match-list">
                  {h.matched.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      <b>
                        <span className="hl">{f.title}</span>
                      </b>
                      <span>{f.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row">
                <Link href={`/products/${h.slug}`} className="btn primary sm">
                  Read the full showcase
                </Link>
                <a href={h.website} target="_blank" rel="noopener noreferrer" className="btn sm">
                  Visit website
                </a>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
