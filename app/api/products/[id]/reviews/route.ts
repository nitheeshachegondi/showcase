import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { publicReviews, replyToReview } from "@/lib/reviews";
import { str } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Founder view of their product's verified reviews. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  return NextResponse.json(await publicReviews(params.id));
}

/** Founders can reply to a review. They cannot edit or delete it. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = await replyToReview(params.id, str(body.reviewId), str(body.text));
  if (!ok) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  return NextResponse.json(await publicReviews(params.id));
}
