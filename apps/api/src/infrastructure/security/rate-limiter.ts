import { env } from '@/config/env'

/**
 * Fixed-window rate limiter.
 * With Upstash Redis configured (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN,
 * or Vercel KV's KV_REST_API_URL + KV_REST_API_TOKEN) the counters are shared by
 * every serverless instance. Otherwise each instance counts on its own, in memory.
 * If Redis is configured but unreachable, `critical` buckets (sign-in, 2FA,
 * password reset, payments) fail closed; the others degrade to memory.
 */
const store = new Map<string, { count: number; resetAt: number }>()
let lastSweep = Date.now()
let warned = false

function consumeInMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (now - lastSweep > 60_000) {
    for (const [k, v] of store) if (v.resetAt < now) store.delete(k)
    lastSweep = now
  }
  const record = store.get(key)
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= max) return false
  record.count++
  return true
}

/** INCR + PEXPIRE NX in one round trip: the window starts with the first hit. */
async function consumeInRedis(url: string, token: string, key: string, max: number, windowMs: number): Promise<boolean> {
  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify([
      ['INCR', `trs:rl:${key}`],
      ['PEXPIRE', `trs:rl:${key}`, String(windowMs), 'NX'],
    ]),
    signal: AbortSignal.timeout(1500),
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const [incr] = (await res.json()) as [{ result?: number; error?: string }]
  if (typeof incr?.result !== 'number') throw new Error(incr?.error ?? 'Upstash: unexpected reply')
  return incr.result <= max
}

/** True if the call is allowed (and counts it), false once `max` calls happened in the window. */
export async function consume(key: string, max: number, windowMs: number, opts: { critical?: boolean } = {}): Promise<boolean> {
  const { url, token } = env.redis
  if (url && token) {
    try {
      return await consumeInRedis(url, token, key, max, windowMs)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (opts.critical) {
        console.error(JSON.stringify({ level: 'error', msg: 'rate_limit.redis_unavailable', mode: 'fail_closed', reason }))
        return false
      }
      if (!warned) console.error(JSON.stringify({ level: 'error', msg: 'rate_limit.redis_unavailable', mode: 'memory', reason }))
      warned = true
    }
  }
  return consumeInMemory(key, max, windowMs)
}
