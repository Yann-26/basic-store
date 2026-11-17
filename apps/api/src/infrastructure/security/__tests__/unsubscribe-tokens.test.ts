import { describe, expect, it } from 'vitest'
import { HmacUnsubscribeTokens } from '../unsubscribe-tokens'

describe('unsubscribe link signatures', () => {
  const tokens = new HmacUnsubscribeTokens()
  it('verifies its own signature, case-insensitively on the address', () => {
    const t = tokens.sign('Awa@Mail.ci')
    expect(tokens.verify('awa@mail.ci', t)).toBe(true)
  })
  it('rejects another address, a tampered or truncated token', () => {
    const t = tokens.sign('awa@mail.ci')
    expect(tokens.verify('moussa@mail.ci', t)).toBe(false)
    expect(tokens.verify('awa@mail.ci', t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))).toBe(false)
    expect(tokens.verify('awa@mail.ci', t.slice(0, 10))).toBe(false)
  })
})
