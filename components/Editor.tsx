"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal, Feature, FeatureStatus, FounderProduct, PublicReview, Showcase } from "@/lib/types";
import Mic from "@/components/Mic";
import { buildChecklist, missingRequired, type CheckItem } from "@/lib/checklist";
import { completeness, completenessSentence } from "@/lib/completeness";
import { contextAround, newId, uncoveredPassages } from "@/lib/text";
import { ApiError, headers, runExtraction } from "@/lib/clientApi";
import { readFiles, rememberProduct, tokenFor } from "@/lib/clientStore";

const lines = (a: string[]) => a.join("\n");
const toList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/* ───────────────────────── small parts ───────────────────────── */

function SourceBox({ product, f }: { product: FounderProduct; f: Feature }) {
  const [wide, setWide] = useState(false);
  if (!f.source) {
    return <div className="srcbox">No source passage linked. Add the detail yourself or leave this feature out.</div>;
  }
  const doc = product.documents.find((d) => d.id === f.source!.docId);
  const ctx = doc ? contextAround(doc.text, f.source.start, f.source.end, wide ? 700 : 160) : null;
  return (
    <div className="srcbox">
      <div className="label">
        From “{f.source.docName}”{!f.source.verified && " · closest match, please verify"}
      </div>
      {ctx ? (
        <div className="ctx">
          {ctx.before}
          <mark>{ctx.passage}</mark>
          {ctx.after}
        </div>
      ) : (
        <div className="ctx">{f.source.passage}</div>
      )}
      <button type="button" className="linkbtn" onClick={() => setWide(!wide)}>
        {wide ? "Show less context" : "Show more context"}
      </button>
    </div>
  );
}

interface Suggestion {
  title: string;
  description: string;
  droppedNumbers: string[];
}

function ImprovePanel({
  f,
  onRewrite,
  onAccept,
}: {
  f: Feature;
  onRewrite: (f: Feature, instruction: string) => Promise<Suggestion>;
  onAccept: (s: Suggestion) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sug, setSug] = useState<Suggestion | null>(null);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      setSug(await onRewrite(f, instruction));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rewrite failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="srcbox" style={{ background: "#f3f6ff", borderColor: "#d3dcff" }}>
      <div className="label">Improve wording</div>
      <p className="small" style={{ margin: "0 0 6px" }}>
        Say what is missing or wrong (type, or dictate with Wispr Flow). Leave it empty to just tidy the wording. Every detail is kept.
      </p>
      <textarea
        rows={2}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder='e.g. "Mention that it works for any role, and that answers can be spoken."'
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary sm" disabled={busy} onClick={run}>
          {busy ? "Rewriting…" : "Rewrite"}
        </button>
        <Mic onText={(t) => setInstruction((c) => (c ? c.trimEnd() + " " : "") + t)} onError={setErr} />
      </div>
      {err && <div className="alert err">{err}</div>}
      {sug && (
        <div style={{ marginTop: 10 }}>
          <div className="label">Suggested</div>
          <p style={{ margin: "0 0 2px" }}>
            <b>{sug.title}</b>
          </p>
          <p style={{ margin: 0 }}>{sug.description}</p>
          {sug.droppedNumbers.length > 0 && (
            <div className="alert warn">
              Check this: the original mentioned {sug.droppedNumbers.join(", ")}, which isn&apos;t in the new wording.
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => {
                onAccept(sug);
                setSug(null);
                setInstruction("");
              }}
            >
              Use this wording
            </button>
            <button type="button" className="btn sm" onClick={() => setSug(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One feature = one line. Click to open the details. */
function FeatureRow({
  product,
  f,
  onChange,
  onRemove,
  onRewrite,
}: {
  product: FounderProduct;
  f: Feature;
  onChange: (patch: Partial<Feature>) => void;
  onRemove: () => void;
  onRewrite: (f: Feature, instruction: string) => Promise<Suggestion>;
}) {
  const [open, setOpen] = useState(f.status === "clarify");
  const [showSrc, setShowSrc] = useState(false);
  const [showImprove, setShowImprove] = useState(false);
  const changed = !!f.original && (f.original.title !== f.title || f.original.description !== f.description || f.original.category !== f.category);
  const seg = (s: FeatureStatus, label: string, cls: string) => (
    <button type="button" className={f.status === s ? `on ${cls}` : ""} onClick={() => onChange({ status: s })}>
      {label}
    </button>
  );

  return (
    <div className={`frow ${f.status}`}>
      <div className="frow-main">
        <input
          type="checkbox"
          checked={f.status === "included"}
          onChange={(e) => onChange({ status: e.target.checked ? "included" : "excluded" })}
          aria-label={`Include ${f.title}`}
          title="Include in the showcase"
        />
        <button type="button" className="frow-text" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="frow-title">{f.title || "Untitled feature"}</span>
          {!open && <span className="frow-desc">{f.description}</span>}
        </button>
        {f.status === "clarify" && <span className="tag warn">Check</span>}
        {f.status === "excluded" && <span className="tag no">Left out</span>}
        {f.origin === "founder" && <span className="tag gray">Yours</span>}
        <button type="button" className="linkbtn" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="frow-body">
          {f.note && f.status === "clarify" && <p className="note">{f.note}</p>}
          <div className="field">
            <input type="text" value={f.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="Feature title" style={{ fontWeight: 600 }} />
          </div>
          <div className="field">
            <textarea rows={2} value={f.description} onChange={(e) => onChange({ description: e.target.value })} aria-label="Feature description" />
          </div>
          <div className="row between">
            <div className="seg">
              {seg("included", "Include", "inc")}
              {seg("clarify", "Unsure", "cla")}
              {seg("excluded", "Leave out", "exc")}
            </div>
            <div className="row">
              <button type="button" className="linkbtn" onClick={() => setShowImprove(!showImprove)}>
                {showImprove ? "Hide improve" : "Improve wording"}
              </button>
              <button type="button" className="linkbtn" onClick={() => setShowSrc(!showSrc)}>
                {showSrc ? "Hide source" : "Inspect source"}
              </button>
              {changed && f.original && (
                <button type="button" className="linkbtn" onClick={() => onChange({ ...f.original! })}>
                  Restore original
                </button>
              )}
              <button type="button" className="linkbtn" style={{ color: "var(--no)" }} onClick={onRemove}>
                Delete
              </button>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ margin: 0 }} className="small muted">
              Category
            </label>
            <input type="text" value={f.category} onChange={(e) => onChange({ category: e.target.value })} style={{ width: 170, padding: "4px 8px" }} />
          </div>
          {showImprove && <ImprovePanel f={f} onRewrite={onRewrite} onAccept={(s) => onChange({ title: s.title, description: s.description })} />}
          {showSrc && <SourceBox product={product} f={f} />}
        </div>
      )}
    </div>
  );
}

/** Talk or type features; they become features linked to what you said. */
function QuickAdd({ busy, onAdd }: { busy: boolean; onAdd: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="quick">
      <label>Speak or type your features</label>
      <p className="muted small" style={{ margin: "0 0 6px" }}>
        Just talk, like explaining to a friend: &ldquo;It lets users…&rdquo;, &ldquo;It also has…&rdquo;. Use Wispr Flow in this box, or the mic. We turn it into features, linked to what you said.
      </p>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. It builds a week-by-week roadmap from your resume and a job description. It also scores every answer in a mock interview and shows a model answer. Pro costs Rs 499 per month."
      />
      {err && <div className="alert err">{err}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn primary sm"
          disabled={busy || text.trim().length < 40}
          onClick={async () => {
            setErr("");
            if (await onAdd(text.trim())) setText("");
          }}
        >
          {busy ? "Adding…" : "Add these features"}
        </button>
        <Mic onText={(t) => setText((c) => (c ? c.trimEnd() + " " : "") + t)} onError={setErr} />
        {text.trim().length > 0 && text.trim().length < 40 && <span className="muted small">A few more words, please.</span>}
      </div>
    </div>
  );
}

function ListField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [text, setText] = useState(lines(value));
  const last = useRef(lines(value));
  useEffect(() => {
    // Re-sync when the list changes from outside (e.g. after extraction), but not while typing.
    if (lines(value) !== last.current) {
      last.current = lines(value);
      setText(lines(value));
    }
  }, [value]);
  return (
    <div className="field listedit">
      <label>
        {label} <span className="muted small">(one per line{hint ? `, ${hint}` : ""})</span>
      </label>
      <textarea
        rows={Math.max(2, Math.min(6, text.split("\n").length + 1))}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const l = toList(e.target.value);
          last.current = lines(l);
          onChange(l);
        }}
      />
    </div>
  );
}

function DealsEditor({ deals, onChange }: { deals: Deal[]; onChange: (d: Deal[]) => void }) {
  const set = (i: number, patch: Partial<Deal>) => onChange(deals.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  return (
    <div className="field">
      <label>
        Special offers / referral links <span className="muted small">(optional, up to 5)</span>
      </label>
      <p className="muted small" style={{ margin: "0 0 8px" }}>
        A discount, free trial or partner deal for people who find you here. Shown as a sponsored link. Clicks aren&apos;t tracked yet.
      </p>
      {deals.map((d, i) => (
        <div className="fcard" key={i}>
          <div className="grid2">
            <div className="field">
              <label>Offer title</label>
              <input type="text" value={d.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="20% off Pro for the first 3 months" />
            </div>
            <div className="field">
              <label>Code (optional)</label>
              <input type="text" value={d.code} onChange={(e) => set(i, { code: e.target.value })} placeholder="SHOWCASE20" />
            </div>
          </div>
          <div className="field">
            <label>Details / conditions</label>
            <input type="text" value={d.details} onChange={(e) => set(i, { details: e.target.value })} placeholder="New users only, valid until 31 Dec" />
          </div>
          <div className="field">
            <label>Referral or offer link (https)</label>
            <input type="text" value={d.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://yourproduct.com/offer?ref=showcase" />
          </div>
          <button type="button" className="linkbtn" style={{ color: "var(--no)" }} onClick={() => onChange(deals.filter((_, k) => k !== i))}>
            Remove this offer
          </button>
        </div>
      ))}
      {deals.length < 5 && (
        <button type="button" className="btn sm" onClick={() => onChange([...deals, { title: "", details: "", code: "", url: "" }])}>
          + Add an offer
        </button>
      )}
    </div>
  );
}

function FounderReviews({ id, token, live }: { id: string; token: string; live: boolean }) {
  const [data, setData] = useState<{ reviews: PublicReview[]; summary: { avg: number; count: number } } | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!live) return;
    fetch(`/api/products/${id}/reviews`, { headers: headers(token), cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.reviews ? setData(d) : null))
      .catch(() => {});
  }, [id, token, live]);

  async function reply(reviewId: string) {
    setErr("");
    const res = await fetch(`/api/products/${id}/reviews`, { method: "POST", headers: headers(token), body: JSON.stringify({ reviewId, text: text[reviewId] || "" }) });
    const d = await res.json();
    if (!res.ok) setErr(d.error || "Could not save your reply.");
    else setData(d);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="hint">Email-verified reviews from visitors. You can reply publicly, but you can&apos;t edit or remove reviews. That keeps them trustworthy.</p>
      {data && !data.reviews.length && <p className="muted">No verified reviews yet.</p>}
      {err && <div className="alert err">{err}</div>}
      {data?.reviews.map((r) => (
        <div className="fcard" key={r.id}>
          <div className="row between">
            <b>
              {"★".repeat(r.rating)} {r.title}
            </b>
            <span className="muted small">
              {r.name} · {r.date}
            </span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
          <textarea rows={2} placeholder="Write a public reply…" value={text[r.id] ?? r.reply?.text ?? ""} onChange={(e) => setText({ ...text, [r.id]: e.target.value })} />
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => reply(r.id)}>
            {r.reply ? "Update reply" : "Post reply"}
          </button>
        </div>
      ))}
    </div>
  );
}

function ChecklistList({ items }: { items: CheckItem[] }) {
  const row = (i: CheckItem) => (
    <li key={i.id} style={{ listStyle: "none", margin: "6px 0", display: "flex", gap: 8 }}>
      <span style={{ color: i.ok ? "var(--ok)" : i.required ? "var(--no)" : "var(--warn)", fontWeight: 800, width: 16 }}>{i.ok ? "✓" : i.required ? "✗" : "•"}</span>
      <span>
        <b style={{ fontWeight: i.ok ? 500 : 700 }}>{i.label}</b>
        {!i.ok && <span className="muted small"> · {i.hint}</span>}
      </span>
    </li>
  );
  return (
    <div className="grid2" style={{ marginTop: 8 }}>
      <div>
        <h3 className="mini">Required</h3>
        <ul style={{ padding: 0 }}>{items.filter((i) => i.required).map(row)}</ul>
      </div>
      <div>
        <h3 className="mini">Recommended</h3>
        <ul style={{ padding: 0 }}>{items.filter((i) => !i.required).map(row)}</ul>
      </div>
    </div>
  );
}

/* ───────────────────────── the editor ───────────────────────── */

export default function Editor({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [product, setProduct] = useState<FounderProduct | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "analyze" | "read">("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "clarify" | "excluded">("all");
  const [quick, setQuick] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = tokenFor(id);
    setToken(t);
    if (!t) {
      setLoadError("This browser doesn't have the edit link for this product. Open the edit link you copied (it ends in #k=…).");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { headers: headers(t), cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load the product.");
        setProduct(data);
        rememberProduct({ id, token: t, name: data.name });
        const stored = sessionStorage.getItem(`showcase:err:${id}`);
        if (stored) {
          setError(`${stored} You can retry with “Analyse documents” below.`);
          sessionStorage.removeItem(`showcase:err:${id}`);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load the product.");
      }
    })();
  }, [id]);

  const stats = useMemo(() => (product ? completeness(product.features) : null), [product]);
  const uncovered = useMemo(
    () => (product ? uncoveredPassages(product.documents, product.features, product.dismissed) : []),
    [product]
  );
  const checklist = useMemo(
    () => (product ? buildChecklist({ showcase: product.showcase, features: product.features, uncoveredCount: uncovered.length }) : []),
    [product, uncovered]
  );
  const blocked = missingRequired(checklist);

  if (loadError) {
    return (
      <div className="card narrow center">
        <p>{loadError}</p>
        <Link href="/founder" className="btn">
          Back to my products
        </Link>
      </div>
    );
  }
  if (!product || !stats) {
    return (
      <div className="center">
        <div className="spinner" />
        <p className="muted">Loading your product…</p>
      </div>
    );
  }

  const edit = (fn: (p: FounderProduct) => FounderProduct) => {
    setProduct((p) => (p ? fn(p) : p));
    setDirty(true);
    setNotice("");
  };
  const setShowcase = (patch: Partial<Showcase>) => edit((p) => ({ ...p, showcase: { ...p.showcase, ...patch } }));
  const patchFeature = (fid: string, patch: Partial<Feature>) =>
    edit((p) => ({ ...p, features: p.features.map((f) => (f.id === fid ? { ...f, ...patch } : f)) }));

  async function save(): Promise<FounderProduct | null> {
    if (!product) return null;
    setBusy("save");
    setError("");
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify({
          name: product.name,
          website: product.website,
          showcase: product.showcase,
          documents: product.documents.map((d) => ({ id: d.id, isPublic: d.isPublic })),
          features: product.features,
          dismissed: product.dismissed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setProduct(data);
      setDirty(false);
      setNotice("Saved.");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function publish(unpublish = false) {
    const saved = dirty ? await save() : product;
    if (!saved) return;
    setBusy("publish");
    setError("");
    try {
      const res = await fetch(`/api/products/${id}/publish`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ publish: !unpublish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not publish.");
      setProduct(data);
      setNotice(unpublish ? "Showcase unpublished. It is now a private draft." : "Approved and published.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy("");
    }
  }

  async function analyze(newDocs: { name: string; text: string }[] = []): Promise<boolean> {
    if (dirty && !(await save())) return false;
    setBusy("analyze");
    setError("");
    try {
      const res = await runExtraction(id, token, newDocs);
      setProduct(res.product);
      setWarnings(res.warnings);
      setDirty(false);
      setNotice(newDocs.length ? "Added. Your new features are in the list." : "Analysis complete.");
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.product) setProduct(e.product);
      setError(e instanceof Error ? e.message : "Analysis failed.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy("read");
    const { docs, errors } = await readFiles(Array.from(files));
    setBusy("");
    if (errors.length) setError(errors.join(" "));
    if (docs.length) await analyze(docs);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function rewriteFeature(f: Feature, instruction: string) {
    const res = await fetch(`/api/products/${id}/rewrite`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        featureId: f.id,
        title: f.title,
        description: f.description,
        instruction,
        sourcePassage: f.source?.passage || "",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rewrite failed.");
    return data as { title: string; description: string; droppedNumbers: string[] };
  }

  function addFromPassage(u: (typeof uncovered)[number]) {
    const words = u.text.replace(/\s+/g, " ").split(" ");
    const title = words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
    const f: Feature = {
      id: newId("f"),
      title,
      description: u.text.replace(/\s+/g, " ").slice(0, 400),
      category: "General",
      status: "included",
      approved: false,
      origin: "founder",
      source: { docId: u.docId, docName: u.docName, passage: u.text, start: u.start, end: u.end, verified: true },
      original: null,
      note: "",
    };
    edit((p) => ({ ...p, features: [...p.features, f] }));
  }

  const showQuick = quick ?? product.features.length === 0;
  const shown = product.features.filter((f) => filter === "all" || f.status === filter);
  const groups = new Map<string, Feature[]>();
  for (const f of shown) groups.set(f.category || "General", [...(groups.get(f.category || "General") || []), f]);
  const unprocessed = product.documents.filter((d) => !d.processed).length;
  const s = product.showcase;
  const isLive = product.status === "published";
  const optionalMissing = checklist.filter((c) => !c.required && !c.ok && ["notFor", "limitations", "diff", "demo", "note"].includes(c.id)).length;

  return (
    <div className="narrow-wide">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="muted small">
            <Link href="/founder">My products</Link> / Review
          </div>
          <h1 style={{ fontSize: "1.9rem", letterSpacing: "-.03em" }}>{product.name}</h1>
        </div>
        <div className="row">
          <span className={`tag ${isLive ? "ok" : "gray"}`}>{isLive ? "Published" : "Draft, not public"}</span>
          {isLive && (
            <Link href={`/products/${product.id}`} className="btn sm" target="_blank">
              View public page ↗
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}
      {notice && !error && <div className="alert ok">{notice}</div>}
      {warnings.map((w, i) => (
        <div className="alert warn" key={i}>
          {w}
        </div>
      ))}

      {unprocessed > 0 && (
        <div className="alert warn">
          {unprocessed} document{unprocessed === 1 ? " hasn't" : "s haven't"} been analysed yet.{" "}
          <button className="linkbtn" disabled={busy !== ""} onClick={() => analyze()}>
            {busy === "analyze" ? "Analysing…" : "Analyse documents"}
          </button>
        </div>
      )}

      {/* STATUS: one glance */}
      <div className="cbar">
        <div className="sentence">{completenessSentence(stats)}</div>
        <div className="stats">
          {blocked.length ? (
            <span className="tag no">
              {blocked.length} needed to publish: {blocked.map((b) => b.label).join(", ")}
            </span>
          ) : (
            <span className="tag ok">Ready to publish</span>
          )}
          {stats.clarify > 0 && <span className="tag warn">{stats.clarify} to check</span>}
          {uncovered.length > 0 && <span className="tag gray">{uncovered.length} passages not in a feature</span>}
        </div>
        <details className="plain">
          <summary>See the full publish checklist</summary>
          <ChecklistList items={checklist} />
        </details>
      </div>

      {/* 1. FEATURES */}
      <div className="card">
        <div className="row between">
          <h2>1. Your features</h2>
          <div className="row">
            <button className="btn sm" onClick={() => setQuick(!showQuick)}>
              {showQuick ? "Hide" : "+ Speak or type more features"}
            </button>
            <button
              className="btn sm"
              onClick={() =>
                edit((p) => ({
                  ...p,
                  features: [
                    ...p.features,
                    { id: newId("f"), title: "New feature", description: "", category: "General", status: "included", approved: false, origin: "founder", source: null, original: null, note: "" },
                  ],
                }))
              }
            >
              + Blank
            </button>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>
          Tick what belongs in your showcase. Click a feature to edit it, improve its wording or see where it came from.
        </p>

        {showQuick && <QuickAdd busy={busy === "analyze"} onAdd={(text) => analyze([{ name: "Added by you", text }])} />}

        {product.features.length > 0 && (
          <div className="row between" style={{ margin: "10px 0 2px" }}>
            <div className="seg">
              {(["all", "clarify", "excluded"] as const).map((k) => (
                <button key={k} type="button" className={filter === k ? "on inc" : ""} onClick={() => setFilter(k)}>
                  {k === "all" ? `All (${product.features.length})` : k === "clarify" ? `To check (${stats.clarify})` : `Left out (${stats.excluded})`}
                </button>
              ))}
            </div>
            {stats.clarify > 0 && (
              <button className="linkbtn" onClick={() => edit((p) => ({ ...p, features: p.features.map((f) => (f.status === "clarify" ? { ...f, status: "included" } : f)) }))}>
                Include all the “check” ones
              </button>
            )}
          </div>
        )}

        {!product.features.length && !showQuick && <p className="muted">No features yet. Speak or type them above, or analyse a document.</p>}
        {Array.from(groups.entries()).map(([cat, feats]) => (
          <div key={cat} className="cat">
            <h3>{cat}</h3>
            {feats.map((f) => (
              <FeatureRow
                key={f.id}
                product={product}
                f={f}
                onChange={(patch) => patchFeature(f.id, patch)}
                onRemove={() => edit((p) => ({ ...p, features: p.features.filter((x) => x.id !== f.id) }))}
                onRewrite={rewriteFeature}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 2. THE BASICS (already filled from your documents) */}
      <div className="card">
        <h2>2. The basics</h2>
        <p className="hint">Filled in from what you wrote. Fix anything that&apos;s off. These are what people read first.</p>
        <div className="field">
          <label>Tagline</label>
          <input type="text" value={s.tagline} onChange={(e) => setShowcase({ tagline: e.target.value })} />
        </div>
        <div className="field">
          <label>What it is</label>
          <textarea rows={3} value={s.what} onChange={(e) => setShowcase({ what: e.target.value })} />
        </div>
        <div className="field">
          <label>The problem it solves</label>
          <textarea rows={2} value={s.problem} onChange={(e) => setShowcase({ problem: e.target.value })} />
        </div>
        <div className="grid2">
          <ListField label="Who should use it" value={s.whoFor} onChange={(v) => setShowcase({ whoFor: v })} />
          <div className="field">
            <label>Pricing</label>
            <textarea rows={2} value={s.pricing} onChange={(e) => setShowcase({ pricing: e.target.value })} placeholder="e.g. Free tier; Pro Rs 499/month" />
          </div>
        </div>
      </div>

      {/* EVERYTHING ELSE: folded away */}
      <details className="card sect">
        <summary>
          More details <span className="muted small">(optional{optionalMissing ? ` · ${optionalMissing} suggested` : ""})</span>
        </summary>
        <p className="hint">Not for, limitations, what makes it different, demo, offers and your note. Short answers are fine.</p>
        <ListField label="Who it is NOT suitable for" value={s.notFor} onChange={(v) => setShowcase({ notFor: v })} />
        <ListField label="Limitations" value={s.limitations} onChange={(v) => setShowcase({ limitations: v })} />
        <ListField label="What makes it different" value={s.differentiators} onChange={(v) => setShowcase({ differentiators: v })} />
        <div className="field">
          <label>Demo link (video or live demo)</label>
          <input type="text" value={s.demoUrl} onChange={(e) => setShowcase({ demoUrl: e.target.value })} placeholder="https://…" />
        </div>
        <ListField label="Screenshot image URLs" value={s.screenshots} onChange={(v) => setShowcase({ screenshots: v })} hint="https only" />
        <DealsEditor deals={s.deals ?? []} onChange={(d) => setShowcase({ deals: d })} />
        <div className="field">
          <label>A note from the founder</label>
          <textarea rows={3} value={s.founderNote} onChange={(e) => setShowcase({ founderNote: e.target.value })} placeholder="Your own words on why you built it." />
        </div>
      </details>

      {uncovered.length > 0 && (
        <details className="card sect">
          <summary>
            Check for missed details <span className="muted small">({uncovered.length} passages aren&apos;t in a feature)</span>
          </summary>
          <p className="hint">Passages in your documents that no feature points at. Add the ones that describe something the product does.</p>
          {uncovered.slice(0, 25).map((u) => (
            <div className="uncov" key={u.key}>
              <p>{u.text}</p>
              <div className="row">
                <span className="muted small">{u.docName}</span>
                <button className="btn sm" onClick={() => addFromPassage(u)}>
                  Add as feature
                </button>
                <button className="btn sm" onClick={() => edit((p) => ({ ...p, dismissed: [...p.dismissed, u.key] }))}>
                  Not a feature
                </button>
              </div>
            </div>
          ))}
          {uncovered.length > 25 && <p className="muted small">Showing the first 25 of {uncovered.length}.</p>}
        </details>
      )}

      <details className="card sect">
        <summary>
          Documents <span className="muted small">({product.documents.length})</span>
        </summary>
        <p className="hint">Choose which documents visitors can read in full. Private ones are only used to build your showcase.</p>
        {product.documents.map((d) => (
          <div className="doc-row" key={d.id}>
            <span>
              <b>{d.name}</b>{" "}
              <span className="muted small">
                · {d.text.length.toLocaleString()} characters{d.processed ? "" : " · not analysed"}
                {d.truncated ? " · long, partly analysed" : ""}
              </span>
            </span>
            <label style={{ margin: 0, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={d.isPublic}
                onChange={(e) => edit((p) => ({ ...p, documents: p.documents.map((x) => (x.id === d.id ? { ...x, isPublic: e.target.checked } : x)) }))}
              />{" "}
              Show publicly
            </label>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <button className="btn sm" disabled={busy !== ""} onClick={() => fileRef.current?.click()}>
            {busy === "read" ? "Reading…" : busy === "analyze" ? "Analysing…" : "+ Upload another document"}
          </button>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm" onChange={(e) => addFiles(e.target.files)} />
        </div>
      </details>

      {isLive && (
        <details className="card sect">
          <summary>Reviews</summary>
          <FounderReviews id={id} token={token} live={isLive} />
        </details>
      )}

      <div style={{ height: 70 }} />
      <div className="savebar">
        <div className="savebar-in">
          <span className="muted small">
            {blocked.length ? `${blocked.length} required detail${blocked.length === 1 ? "" : "s"} missing before you can publish. ` : ""}
            {dirty ? "You have unsaved changes." : stats.awaiting > 0 ? `${stats.awaiting} included feature${stats.awaiting === 1 ? "" : "s"} waiting for your approval.` : `${stats.live} feature${stats.live === 1 ? "" : "s"} live.`}
          </span>
          <div className="row">
            <button className="btn" disabled={busy !== "" || !dirty} onClick={() => save()}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            {isLive && (
              <button className="btn danger" disabled={busy !== ""} onClick={() => publish(true)}>
                Unpublish
              </button>
            )}
            <button
              className="btn primary"
              disabled={busy !== "" || blocked.length > 0}
              title={blocked.length ? `Still needed: ${blocked.map((b) => b.label).join("; ")}` : ""}
              onClick={() => publish(false)}
            >
              {busy === "publish" ? "Publishing…" : isLive ? "Approve & update showcase" : "Approve & publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}