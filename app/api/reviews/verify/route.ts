import { NextResponse } from "next/server";
import { verifyReview } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The link in the verification email. Publishes the review, then sends the reviewer to the product page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.APP_URL || url.origin;
  const productId = await verifyReview(url.searchParams.get("token") || "");
  if (!productId) return NextResponse.redirect(new URL("/discover?review=invalid", origin));
  return NextResponse.redirect(new URL(`/products/${productId}?review=verified#reviews`, origin));
}
