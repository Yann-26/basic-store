import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, counterAt, hashRecoveryCode, hotp, open, seal, TotpTwoFactorCrypto, verifyTotp } from '../totp'

// RFC 6238 appendix B: SHA-1 seed "12345678901234567890", 8 digits.
const RFC_SEED = Buffer.from('12345678901234567890')
const RFC_VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
]

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC test vectors', () => {
    for (const [time, expected] of RFC_VECTORS) expect(hotp(RFC_SEED, counterAt(time), 8)).toBe(expected)
  })

  it('round-trips base32', () => {
    const secret = base32Encode(RFC_SEED)
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(base32Decode(secret).equals(RFC_SEED)).toBe(true)
  })

  it('accepts the current code and one step of clock drift, not older ones', () => {
    const secret = base32Encode(RFC_SEED)
    const now = 1_800_000_000
    const code = (t: number) => hotp(RFC_SEED, counterAt(t))
    expect(verifyTotp(secret, code(now), 0, now)).toBe(counterAt(now))
    expect(verifyTotp(secret, code(now - 30), 0, now)).toBe(counterAt(now) - 1)
    expect(verifyTotp(secret, code(now - 90), 0, now)).toBeNull()
    expect(verifyTotp(secret, 'abcdef', 0, now)).toBeNull()
  })

  it('refuses a code that was already used (replay)', () => {
    const secret = base32Encode(RFC_SEED)
    const now = 1_800_000_000
    const used = verifyTotp(secret, hotp(RFC_SEED, counterAt(now)), 0, now)!
    expect(verifyTotp(secret, hotp(RFC_SEED, counterAt(now)), used, now)).toBeNull()
  })
})

describe('secret sealing and recovery codes', () => {
  it('encrypts secrets (random IV) and decrypts them', () => {
    const a = seal('JBSWY3DPEHPK3PXP')
    expect(a).not.toContain('JBSWY3DPEHPK3PXP')
    expect(seal('JBSWY3DPEHPK3PXP')).not.toBe(a)
    expect(open(a)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('rejects a tampered secret', () => {
    const parts = seal('JBSWY3DPEHPK3PXP').split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => open(parts.join('.'))).toThrow()
  })

  it('generates distinct recovery codes whose hash ignores case and dashes', () => {
    const codes = new TotpTwoFactorCrypto().newRecoveryCodes()
    expect(new Set(codes).size).toBe(8)
    expect(codes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/)
    expect(hashRecoveryCode('ABCD-efgh')).toBe(hashRecoveryCode('abcdefgh'))
  })

  it('builds an otpauth:// URL for authenticator apps', () => {
    const url = new TotpTwoFactorCrypto().otpauthUrl('admin@shop.ci', 'JBSWY3DPEHPK3PXP')
    expect(url).toMatch(/^otpauth:\/\/totp\/Basic%20Store%3Aadmin%40shop\.ci\?secret=JBSWY3DPEHPK3PXP&issuer=Basic\+Store/)
  })
})
