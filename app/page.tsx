import Link from "next/link";
import { HEADLINE, SUBLINE } from "@/lib/brand";
import { listPublished } from "@/lib/store";
import SourceDemo from "@/components/SourceDemo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = (await listPublished()).slice(0, 6);

  return (
    <main className="shell">
      <section className="hero2">
        <div>
          <h1>{HEADLINE}</h1>
          <p className="sub">{SUBLINE}</p>
          <div className="cta-row">
            <Link href="/founder/new" className="btn primary">
              Add your product
            </Link>
            <Link href="/discover" className="btn">
              Find a product
            </Link>
          </div>
        </div>
        <SourceDemo />
      </section>

      <section className="duo">
        <div>
          <h2>If you built a product</h2>
          <p>Say everything it does, in your own words. Talk, type or upload a document, then check each feature against the sentence it came from.</p>
          <ol className="how">
            <li>Describe your product, or upload the documents you already have.</li>
            <li>Review the features we found. Edit, add or leave out anything.</li>
            <li>Approve the showcase and publish it.</li>
          </ol>
        </div>
        <div>
          <h2>If you need a tool</h2>
          <p>Describe what you need the way you&apos;d say it to a friend. You&apos;ll see which products do it, and exactly which features match.</p>
          <ol className="how">
            <li>Say what you need.</li>
            <li>Compare the products that match, feature by feature.</li>
            <li>Read the full showcase, then visit the product&apos;s website.</li>
          </ol>
        </div>
      </section>

      {recent.length > 0 && (
        <section style={{ marginTop: 56 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <h2 style={{ fontSize: "1.7rem" }}>Recently published</h2>
            <Link href="/discover">Browse all products</Link>
          </div>
          {recent.map((p) => {
            const n = p.features.filter((f) => f.status === "included" && f.approved).length;
            return (
              <Link key={p.id} href={`/products/${p.id}`} className="entry">
                <div className="headword">{p.name}</div>
                <p className="def">{p.showcase.tagline}</p>
                <div className="meta">
                  {n} documented feature{n === 1 ? "" : "s"}
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
