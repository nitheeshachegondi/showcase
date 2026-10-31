import { NextResponse } from "next/server";
import { listPublished } from "@/lib/store";
import { searchProducts } from "@/lib/search";
import { reviewSummaries } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 400);
  const products = await listPublished();
  const result = await searchProducts(q, products);

  const sums = await reviewSummaries(result.hits.map((h) => h.slug));
  const byId = new Map(products.map((p) => [p.id, p]));
  const hits = result.hits.map((h) => ({
    ...h,
    rating: sums.get(h.slug) || null,
    hasDeal: (byId.get(h.slug)?.showcase.deals?.length || 0) > 0,
  }));
  return NextResponse.json({ ...result, hits });
}
