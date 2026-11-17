import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

let client: SupabaseClient | null = null

/**
 * Server-side Supabase client with the service-role key: the API is the only
 * trusted reader/writer (the public roles have no privileges on private tables).
 * The anon key is only a local-development fallback. Never import this module
 * from browser code.
 */
export function db(): SupabaseClient {
  if (client) return client
  if (env.isProduction && !env.supabaseServiceKey) {
    // Also reported by /api/health; with the anon key every private table is refused.
    console.error(JSON.stringify({ level: 'error', msg: 'config.invalid', missing: ['SUPABASE_SERVICE_ROLE_KEY'] }))
  }
  if (!env.supabaseUrl || !(env.supabaseServiceKey || env.supabaseAnonKey)) {
    console.error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key')
  }
  client = createClient(
    env.supabaseUrl ?? 'https://placeholder.supabase.co',
    env.supabaseServiceKey ?? env.supabaseAnonKey ?? 'placeholder-key',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'the-rising-star-api' } },
    },
  )
  return client
}

/** Throws the Supabase error so the HTTP layer returns a 500 with logging. */
export function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }, context: string): T {
  if (result.error) {
    const err = new Error(`[${context}] ${result.error.message}`)
    ;(err as Error & { code?: string }).code = result.error.code
    throw err
  }
  return result.data
}

/** Strips characters that would break PostgREST `or()` / `ilike` filters. */
export function safeSearchTerm(input: string): string {
  return input.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}
