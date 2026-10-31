import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveProduct } from "@/lib/store";
import { buildChecklist, missingRequired } from "@/lib/checklist";
import { founderView } from "@/lib/views";

export const runtime = "nodejs";

/**
 * The founder's explicit approval. Publishing approves every feature currently marked "included",
 * but only once the required details are filled in (the same checklist the editor shows).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  const product = r.product;

  const body = (await req.json().catch(() => ({}))) as { publish?: boolean };
  const now = new Date().toISOString();

  if (body.publish === false) {
    product.status = "draft";
  } else {
    const missing = missingRequired(buildChecklist({ showcase: product.showcase, features: product.features }));
    if (missing.length) {
      return NextResponse.json(
        { error: `Before publishing, please complete: ${missing.map((m) => m.label).join("; ")}.` },
        { status: 400 }
      );
    }
    product.features = product.features.map((f) => (f.status === "included" ? { ...f, approved: true } : f));
    product.status = "published";
    product.publishedAt = product.publishedAt || now;
  }

  product.updatedAt = now;
  await saveProduct(product);
  return NextResponse.json(founderView(product));
}
