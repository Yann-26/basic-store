import { afterEach, describe, expect, it } from 'vitest'
import { applyBrandSettings, brand, refreshBrand, resetBrand } from '../brand'
import { welcomeEmail } from '../templates/emails'

afterEach(() => resetBrand())

describe('shop identity read from the dashboard settings', () => {
  it('falls back to the defaults while nothing is set', () => {
    applyBrandSettings({})
    expect(brand().name).toBe('SCION CARON')
  })

  it('takes the name, signature, address and colour from the settings', () => {
    applyBrandSettings({ store_name: ' Maison X ', store_tagline: 'Slogan', store_address: 'Cocody', store_city: 'Abidjan', primary_color: '#112233' })
    expect(brand()).toEqual({ name: 'Maison X', tagline: 'Slogan', address: 'Cocody, Abidjan', color: '#112233' })
  })

  it('ignores a colour that is not a hex value', () => {
    applyBrandSettings({ primary_color: 'red' })
    expect(brand().color).toBe('#D4AF37')
  })

  it('shows up in the emails', () => {
    applyBrandSettings({ store_name: 'Maison X', primary_color: '#112233' })
    const mail = welcomeEmail({ firstName: 'Awa', shopUrl: 'https://shop.test/collection' })
    expect(mail).toContain('Maison X')
    expect(mail).toContain('#112233')
    expect(mail).not.toContain('RISING STAR')
  })

  it('reloads the settings at most once a minute and survives a failure', async () => {
    let calls = 0
    const failing = async () => {
      calls++
      throw new Error('db down')
    }
    await refreshBrand(failing) // stale: tries, fails, keeps the defaults
    await refreshBrand(failing) // within the minute: does not try again
    expect(calls).toBe(1)
    expect(brand().name).toBe('SCION CARON')
  })
})
