import { NextResponse } from "next/server";
import { getProduct } from "@/lib/store";
import { publicReviews, submitReview } from "@/lib/reviews";
import { mailMode, sendVerificationEmail } from "@/lib/mail";
import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function publishedProduct(id: string) {
  const p = await getProduct(id);
  return p && p.status === "published" ? p : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await publishedProduct(params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...(await publicReviews(params.id)), mail: mailMode() });
}

/** Submit a review. It stays hidden until the reviewer confirms their email. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const product = await publishedProduct(params.id);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const mode = mailMode();
  if (mode === "off") {
    return NextResponse.json({ error: "Reviews aren't switched on yet for this site." }, { status: 503 });
  }

  try {
    const raw = await req.text();
    if (raw.length > 10_000) return NextResponse.json({ error: "Review is too long." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;

    // Honeypot: real people never fill this hidden field.
    if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

    if (!allow(`rev:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many reviews from this connection. Please try again later." }, { status: 429 });
    }

    const result = await submitReview(params.id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const origin = process.env.APP_URL || new URL(req.url).origin;
    const link = `${origin}/api/reviews/verify?token=${result.token}`;

    if (mode === "resend") {
      await sendVerificationEmail(String(body.email).trim(), link, product.name);
      return NextResponse.json({ ok: true, mode });
    }
    // dev mode: no email provider, so hand the link back for local testing.
    return NextResponse.json({ ok: true, mode, devVerifyUrl: link });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save your review." }, { status: 400 });
  }
}
