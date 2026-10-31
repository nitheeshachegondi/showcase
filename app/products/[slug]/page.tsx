import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/store";
import { publicView } from "@/lib/views";
import { publicReviews } from "@/lib/reviews";
import { mailMode } from "@/lib/mail";
import ReviewSection, { Stars } from "@/components/ReviewSection";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const p = await getProduct(slug);
  return p && p.status === "published" ? publicView(p) : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await load(params.slug);
  if (!p) return { title: "Not found" };
  return { title: `${p.name}: product showcase`, description: p.showcase.tagline || p.showcase.what.slice(0, 160) };
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((i, k) => (
        <li key={k}>{i}</li>
      ))}
    </ul>
  );
}

export default async function ShowcasePage({ params }: { params: { slug: string } }) {
  const p = await load(params.slug);
  if (!p) notFound();
  const s = p.showcase;
  const deals = s.deals ?? [];
  const rv = await publicReviews(p.id);
  const withSource = p.features.filter((f) => f.source).length;

  const groups = new Map<string, typeof p.features>();
  for (const f of p.features) groups.set(f.category, [...(groups.get(f.category) || []), f]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: p.name,
    url: p.website,
    description: s.what || s.tagline,
    featureList: p.features.map((f) => f.title),
    dateModified: p.updatedAt,
  };

  const hasWhat = !!(s.what || s.problem || s.differentiators.length);
  const hasFit = s.whoFor.length > 0 || s.notFor.length > 0;

  return (
    <main className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="sc-head">
        <span className="tag blue">Approved by the founder</span>
        <h1>{p.name}</h1>
        {s.tagline && <p className="lead">{s.tagline}</p>}
        {rv.summary.count > 0 && (
          <p>
            <a href="#reviews" style={{ color: "inherit", textDecoration: "none" }}>
              <Stars value={rv.summary.avg} /> <b>{rv.summary.avg.toFixed(1)}</b>{" "}
              <span className="muted small">
                from {rv.summary.count} email-verified review{rv.summary.count === 1 ? "" : "s"}
              </span>
            </a>
          </p>
        )}
        <div className="row">
          <a className="btn primary" href={p.website} target="_blank" rel="noopener noreferrer">
            Visit {p.name}
          </a>
          {s.demoUrl && (
            <a className="btn" href={s.demoUrl} target="_blank" rel="noopener noreferrer">
              Watch the demo
            </a>
          )}
        </div>
        <p className="proof">
          <b>{p.features.length}</b> features documented, <b>{withSource}</b> of them linked to the founder&apos;s own words. Last updated {p.updatedAt.slice(0, 10)}.
        </p>
      </header>

      <nav className="sc-nav" aria-label="On this page">
        {hasWhat && <a href="#what">What it is</a>}
        <a href="#features">Features</a>
        {hasFit && <a href="#fit">Who it&apos;s for</a>}
        <a href="#pricing">Pricing</a>
        <a href="#reviews">Reviews</a>
      </nav>

      <div className="sc-grid">
        <div>
          {hasWhat && (
            <div id="what">
              {s.what && (
                <section className="sc-section">
                  <h2>What it is</h2>
                  <p>{s.what}</p>
                </section>
              )}
              {s.problem && (
                <section className="sc-section">
                  <h2>The problem it solves</h2>
                  <p>{s.problem}</p>
                </section>
              )}
              {s.differentiators.length > 0 && (
                <section className="sc-section">
                  <h2>What makes it different</h2>
                  <List items={s.differentiators} />
                </section>
              )}
            </div>
          )}

          <section className="sc-section" id="features">
            <h2>
              Every documented feature <span className="count">({p.features.length})</span>
            </h2>
            {Array.from(groups.entries()).map(([cat, feats]) => (
              <div className="idx-row" key={cat}>
                <div className="idx-cat">{cat}</div>
                <div>
                  {feats.map((f) => (
                    <div className="f" key={f.id}>
                      <b>{f.title}</b>
                      {f.description && <p>{f.description}</p>}
                      {f.source && (
                        <details className="src">
                          <summary>See the founder&apos;s words</summary>
                          <blockquote className="passage">
                            <span className="hl">{f.source.passage}</span>
                            <cite>From {f.source.docName}</cite>
                          </blockquote>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {hasFit && (
            <section className="sc-section" id="fit">
              <h2>Who should use it</h2>
              <div className="two-col">
                <div className="fit yes">
                  <h3>A good fit</h3>
                  {s.whoFor.length ? <List items={s.whoFor} /> : <p className="muted small">Not stated</p>}
                </div>
                <div className="fit no">
                  <h3>Not suitable for</h3>
                  {s.notFor.length ? <List items={s.notFor} /> : <p className="muted small">Not stated</p>}
                </div>
              </div>
            </section>
          )}

          {s.screenshots.length > 0 && (
            <section className="sc-section">
              <h2>Screenshots</h2>
              <div className="shots">
                {s.screenshots.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt={`${p.name} screenshot`} loading="lazy" referrerPolicy="no-referrer" />
                ))}
              </div>
            </section>
          )}

          {s.limitations.length > 0 && (
            <section className="sc-section">
              <h2>Limitations</h2>
              <List items={s.limitations} />
            </section>
          )}

          {s.founderNote && (
            <section className="sc-section">
              <h2>A note from the founder</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.founderNote}</p>
            </section>
          )}

          <ReviewSection productId={p.id} productName={p.name} reviews={rv.reviews} summary={rv.summary} mode={mailMode()} />

          {p.documents.length > 0 && (
            <section className="sc-section">
              <h2>Supporting documents</h2>
              {p.documents.map((d) => (
                <details key={d.id} className="src" style={{ marginBottom: 8 }}>
                  <summary>{d.name}</summary>
                  <pre className="doc">{d.text}</pre>
                </details>
              ))}
            </section>
          )}
        </div>

        <aside className="sc-side">
          {deals.length > 0 && (
            <div className="note-sheet" style={{ marginBottom: 18 }}>
              <h3>Special offer{deals.length === 1 ? "" : "s"} from the founder</h3>
              {deals.map((d, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <b>{d.title}</b>
                  {d.details && (
                    <p className="small" style={{ margin: "2px 0" }}>
                      {d.details}
                    </p>
                  )}
                  {d.code && (
                    <p className="small" style={{ margin: "2px 0" }}>
                      Code: <code>{d.code}</code>
                    </p>
                  )}
                  {d.url && (
                    <a className="btn sm" href={d.url} target="_blank" rel="sponsored nofollow noopener noreferrer">
                      Claim this offer
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="note-sheet" id="pricing">
            <h3>Pricing</h3>
            <p>{s.pricing || <span className="muted">Not stated by the founder</span>}</p>
            <a className="btn primary" href={p.website} target="_blank" rel="noopener noreferrer">
              Visit website
            </a>
            <p className="small" style={{ marginTop: 12, marginBottom: 0, color: "var(--ink-soft)" }}>
              Written and approved by the founder.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
