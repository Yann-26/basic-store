import { describe, expect, it } from 'vitest'
import { validateConfig } from '../validate'

const prod = {
  isProduction: true,
  appUrl: 'https://shop.ci',
  supabaseUrl: 'https://x.supabase.co',
  supabaseServiceKey: 'k',
  jwtSecret: 'x'.repeat(40),
  recaptchaSecret: 'r',
  paystackSecret: 'p',
  redis: { url: 'https://r', token: 't' },
}

describe('validateConfig', () => {
  it('passes a complete production configuration', () => {
    expect(validateConfig(prod)).toEqual({ errors: [], warnings: [] })
  })

  it('reports missing security settings by name, never by value', () => {
    const report = validateConfig({ ...prod, recaptchaSecret: undefined, jwtSecret: 'short', redis: { url: undefined, token: undefined } })
    expect(report.errors).toEqual(['AUTH_JWT_SECRET (>= 32 characters)', 'RECAPTCHA_SECRET_KEY'])
    expect(report.warnings[0]).toMatch(/UPSTASH/)
    expect(JSON.stringify(report)).not.toContain('short')
  })

  it('only warns in development', () => {
    expect(validateConfig({ ...prod, isProduction: false, jwtSecret: undefined }).errors).toEqual([])
  })
})
