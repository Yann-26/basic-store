import { afterEach, describe, expect, it, vi } from 'vitest'

async function load(redis: { url?: string; token?: string }) {
  vi.resetModules()
  vi.doMock('@/config/env', () => ({ env: { redis } }))
  return (await import('../rate-limiter')).consume
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/config/env')
})

describe('rate limiter', () => {
  it('counts in memory without Redis', async () => {
    const consume = await load({})
    expect(await consume('k', 2, 60_000)).toBe(true)
    expect(await consume('k', 2, 60_000)).toBe(true)
    expect(await consume('k', 2, 60_000)).toBe(false)
  })

  it('uses shared Redis counters when configured', async () => {
    let count = 0
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ result: ++count }, { result: 1 }])))
    vi.stubGlobal('fetch', fetch)
    const consume = await load({ url: 'https://redis.example', token: 'secret' })
    expect(await consume('login:a', 2, 1000)).toBe(true)
    expect(await consume('login:a', 2, 1000)).toBe(true)
    expect(await consume('login:a', 2, 1000)).toBe(false)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://redis.example/pipeline')
    expect(JSON.parse(String(init.body))).toEqual([['INCR', 'trs:rl:login:a'], ['PEXPIRE', 'trs:rl:login:a', '1000', 'NX']])
  })

  it('falls back to memory if Redis is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consume = await load({ url: 'https://redis.example', token: 'secret' })
    expect(await consume('x', 1, 60_000)).toBe(true)
    expect(await consume('x', 1, 60_000)).toBe(false)
  })

  it('fails closed on critical buckets if Redis is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consume = await load({ url: 'https://redis.example', token: 'secret' })
    expect(await consume('login', 10, 60_000, { critical: true })).toBe(false)
  })
})
