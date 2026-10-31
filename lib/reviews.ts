import { createHash, randomBytes } from "crypto";
import { kvGet, kvSet } from "./store";
import { clamp, str } from "./sanitize";
import { newId } from "./text";
import type { PublicReview, ReviewRec, ReviewSummary } from "./types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const listKey = (productId: string) => `reviews:${productId}`;
const tokenKey = (tokenHash: string) => `rtoken:${tokenHash.slice(0, 40)}`;

export async function loadReviews(productId: string): Promise<ReviewRec[]> {
  return (await kvGet<ReviewRec[]>(listKey(productId))) || [];
}

export function toPublic(r: ReviewRec): PublicReview {
  return {
    id: r.id,
    name: r.name,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: (r.verifiedAt || r.createdAt).slice(0, 10),
    reply: r.reply,
  };
}

export const summarize = (reviews: ReviewRec[]): ReviewSummary => {
  const v = reviews.filter((r) => r.status === "verified");
  return { count: v.length, avg: v.length ? Math.round((v.reduce((a, r) => a + r.rating, 0) / v.length) * 10) / 10 : 0 };
};

export async function publicReviews(productId: string): Promise<{ reviews: PublicReview[]; summary: ReviewSummary }> {
  const all = await loadReviews(productId);
  const verified = all.filter((r) => r.status === "verified").sort((a, b) => (b.verifiedAt || "").localeCompare(a.verifiedAt || ""));
  return { reviews: verified.map(toPublic), summary: summarize(all) };
}

export async function reviewSummaries(productIds: string[]): Promise<Map<string, ReviewSummary>> {
  const out = new Map<string, ReviewSummary>();
  await Promise.all(
    productIds.map(async (id) => {
      const s = summarize(await loadReviews(id));
      if (s.count) out.set(id, s);
    })
  );
  return out;
}

export type SubmitResult = { ok: true; token: string } | { ok: false; error: string };

/** Validates and stores a pending review. The raw email is never stored, only a per-product hash. */
export async function submitReview(productId: string, input: Record<string, unknown>): Promise<SubmitResult> {
  const name = clamp(str(input.name), 40);
  const email = str(input.email).toLowerCase();
  const rating = Math.round(Number(input.rating));
  const title = clamp(str(input.title), 80);
  const body = clamp(str(input.body), 1500);

  if (name.length < 2) return { ok: false, error: "Please enter your name (it will be shown with your review)." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address. It is used only to verify your review and is never shown." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Please choose a rating from 1 to 5." };
  if (body.length < 20) return { ok: false, error: "Please write at least a couple of sentences about your experience." };

  const emailHash = sha(`${productId}:${email}`);
  const all = await loadReviews(productId);
  const existing = all.find((r) => r.emailHash === emailHash);
  if (existing && existing.status === "verified") return { ok: false, error: "This email has already reviewed this product." };

  const token = randomBytes(24).toString("hex");
  const tokenHash = sha(token);
  const rec: ReviewRec = {
    id: existing ? existing.id : newId("r"),
    productId,
    name,
    rating,
    title,
    body,
    emailHash,
    tokenHash,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  // A new submission from the same unverified email replaces the old pending one.
  const kept = all.filter((r) => r.emailHash !== emailHash);
  // Keep storage bounded: drop the oldest pending reviews beyond 200.
  const pendingIdx = kept.filter((r) => r.status === "pending");
  const trimmed = pendingIdx.length > 200 ? kept.filter((r) => r.status === "verified" || pendingIdx.slice(-200).includes(r)) : kept;
  await kvSet(listKey(productId), [...trimmed, rec]);
  await kvSet(tokenKey(tokenHash), { productId });
  return { ok: true, token };
}

export async function verifyReview(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const tokenHash = sha(token);
  const ref = await kvGet<{ productId: string }>(tokenKey(tokenHash));
  if (!ref) return null;
  const all = await loadReviews(ref.productId);
  const idx = all.findIndex((r) => r.tokenHash === tokenHash);
  if (idx < 0) return null;
  if (all[idx].status !== "verified") {
    all[idx] = { ...all[idx], status: "verified", verifiedAt: new Date().toISOString() };
    await kvSet(listKey(ref.productId), all);
  }
  return ref.productId;
}

/** The founder can reply to a verified review. They cannot edit or delete reviews. */
export async function replyToReview(productId: string, reviewId: string, text: string): Promise<boolean> {
  const all = await loadReviews(productId);
  const idx = all.findIndex((r) => r.id === reviewId && r.status === "verified");
  if (idx < 0) return false;
  const reply = clamp(text.trim(), 1000);
  all[idx] = { ...all[idx], reply: reply ? { text: reply, at: new Date().toISOString() } : undefined };
  await kvSet(listKey(productId), all);
  return true;
}
