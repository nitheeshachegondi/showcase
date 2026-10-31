import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { groqJSON, GroqError } from "@/lib/groq";
import { REWRITE_SYSTEM } from "@/lib/prompts";
import { clamp, str } from "@/lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 30;

const nums = (s: string) => (s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, ""));

/**
 * Suggests better wording for one feature. Nothing is saved here: the founder sees the
 * suggestion and accepts or discards it.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    // A feature the founder just added may not be saved yet; the client then sends its own source text.
    const feature = r.product.features.find((f) => f.id === str(body.featureId));

    const title = clamp(str(body.title), 120) || feature?.title || "Feature";
    const description = clamp(str(body.description), 800);
    const instruction = clamp(str(body.instruction), 2000);

    let passage = "";
    let context = "";
    if (feature?.source) {
      const doc = r.product.documents.find((d) => d.id === feature.source!.docId);
      if (doc) {
        passage = doc.text.slice(feature.source.start, feature.source.end);
        context = doc.text.slice(Math.max(0, feature.source.start - 700), Math.min(doc.text.length, feature.source.end + 700));
      }
    }
    if (!passage) passage = clamp(str(body.sourcePassage), 1200);

    const user = `CURRENT TITLE: ${title}
CURRENT DESCRIPTION: ${description || "(empty)"}

SOURCE PASSAGE: ${passage || "(none linked)"}
SURROUNDING CONTEXT: ${context || "(none)"}

FOUNDER'S INSTRUCTION: ${instruction || "(none: just make it complete and clear using the source)"}`;

    const out = (await groqJSON(REWRITE_SYSTEM, user)) as Record<string, unknown>;
    const newTitle = clamp(str(out.title), 120) || title;
    const newDesc = clamp(str(out.description), 800);
    if (!newDesc) return NextResponse.json({ error: "The rewrite came back empty. Please try again." }, { status: 502 });

    // Safety net: numbers that were in the original text or source but vanished from the rewrite.
    const kept = new Set(nums(`${newTitle} ${newDesc}`));
    const dropped = Array.from(new Set(nums(`${description} ${passage}`))).filter((n) => !kept.has(n));

    return NextResponse.json({ title: newTitle, description: newDesc, droppedNumbers: dropped.slice(0, 8) });
  } catch (e) {
    const status = e instanceof GroqError ? e.status : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rewrite failed." }, { status });
  }
}
