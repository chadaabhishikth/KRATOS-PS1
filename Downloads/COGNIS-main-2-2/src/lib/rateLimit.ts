import { NextRequest } from 'next/server'

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * IMPORTANT: this is process-local. It works fine for a single Node
 * server (e.g. `next start`, a single container/VM) but will NOT
 * coordinate across multiple serverless instances (e.g. Vercel
 * functions scale horizontally, each with its own memory). For a
 * multi-instance production deployment, swap the store below for a
 * shared backend such as Upstash Redis / Vercel KV — the
 * `checkRateLimit` call site does not need to change.
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Periodically drop expired buckets so this map doesn't grow forever.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref?.()

export function getClientIp(req: NextRequest): string {
  // Trust standard proxy headers if present (e.g. behind Vercel/nginx),
  // falling back to a constant so at least a global limit still applies.
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 * `key` should combine the route name and the client identifier, e.g.
 * `submit:${ip}`, so limits on different endpoints don't collide.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true }
}
