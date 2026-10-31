/**
 * Best-effort, in-memory limiter. On serverless hosts each instance has its own memory, so this only
 * slows casual abuse. For real protection, back it with Redis (e.g. Upstash Ratelimit).
 */
const g = globalThis as unknown as { __rl?: Map<string, number[]> };

export function allow(key: string, max: number, windowMs: number): boolean {
  const map: Map<string, number[]> = (g.__rl = g.__rl || new Map<string, number[]>());
  const now = Date.now();
  const hits = (map.get(key) || []).filter((t: number) => now - t < windowMs);
  if (hits.length >= max) {
    map.set(key, hits);
    return false;
  }
  hits.push(now);
  map.set(key, hits);
  if (map.size > 5000) map.clear();
  return true;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}
