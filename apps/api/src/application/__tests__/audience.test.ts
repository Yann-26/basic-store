import { describe, expect, it, vi } from 'vitest'
import { browserOf, classifySource, cleanPath, deviceOf, isBot } from '../audience'
import { makeAudienceUseCases } from '../use-cases/audience'
import type { SiteVisit, VisitRepository } from '../ports'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
const INSTAGRAM_APP = `${IPHONE_SAFARI} Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_0; fr_FR; fr; scale=3.00)`
const FACEBOOK_APP = 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]'
const TIKTOK_APP = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 trill_370400 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.4.0 ByteLocale/fr BytedanceWebview/d8a21c6'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

describe('classifySource — one link for every network', () => {
  it('recognises the app the link was opened in', () => {
    expect(classifySource({ userAgent: INSTAGRAM_APP }).source).toBe('instagram')
    expect(classifySource({ userAgent: FACEBOOK_APP }).source).toBe('facebook')
    expect(classifySource({ userAgent: TIKTOK_APP }).source).toBe('tiktok')
  })

  it('recognises WhatsApp, Telegram and Gmail on Android from the app that opened the browser', () => {
    expect(classifySource({ referrer: 'android-app://com.whatsapp/', userAgent: ANDROID_CHROME })).toEqual({ source: 'whatsapp', referrerHost: 'com.whatsapp' })
    expect(classifySource({ referrer: 'android-app://com.whatsapp.w4b/', userAgent: ANDROID_CHROME }).source).toBe('whatsapp')
    expect(classifySource({ referrer: 'android-app://org.telegram.messenger/', userAgent: ANDROID_CHROME }).source).toBe('telegram')
    expect(classifySource({ referrer: 'android-app://com.google.android.gm/', userAgent: ANDROID_CHROME }).source).toBe('email')
    expect(classifySource({ referrer: 'android-app://com.unknown.app/', userAgent: ANDROID_CHROME }).source).toBe('app')
  })

  it('recognises the referring website', () => {
    expect(classifySource({ referrer: 'https://l.facebook.com/l.php?u=x' }).source).toBe('facebook')
    expect(classifySource({ referrer: 'https://l.instagram.com/?u=x' }).source).toBe('instagram')
    expect(classifySource({ referrer: 'https://l.wl.co/l?u=x' }).source).toBe('whatsapp')
    expect(classifySource({ referrer: 'https://web.whatsapp.com/' }).source).toBe('whatsapp')
    expect(classifySource({ referrer: 'https://www.google.ci/' }).source).toBe('google')
    expect(classifySource({ referrer: 'https://mail.google.com/' }).source).toBe('email')
    expect(classifySource({ referrer: 'https://blog.example.com/post' })).toEqual({ source: 'referral', referrerHost: 'blog.example.com' })
  })

  it('credits the network where the link was clicked, not the tag of a copied link', () => {
    // a "WhatsApp" link pasted on Instagram
    expect(classifySource({ utmSource: 'whatsapp', userAgent: INSTAGRAM_APP }).source).toBe('instagram')
    // a "Facebook" link pasted in a WhatsApp chat (Android)
    expect(classifySource({ utmSource: 'facebook', referrer: 'android-app://com.whatsapp/', userAgent: ANDROID_CHROME }).source).toBe('whatsapp')
    // a "TikTok" link opened from Facebook on a computer
    expect(classifySource({ utmSource: 'tiktok', referrer: 'https://www.facebook.com/', userAgent: DESKTOP }).source).toBe('facebook')
  })

  it('falls back on a tag only when nothing was observed (older links, iPhone WhatsApp)', () => {
    expect(classifySource({ utmSource: 'whatsapp', userAgent: IPHONE_SAFARI }).source).toBe('whatsapp')
    expect(classifySource({ utmSource: 'IG', userAgent: IPHONE_SAFARI }).source).toBe('instagram')
    expect(classifySource({ utmSource: 'Flyer Boutique!' }).source).toBe('flyer_boutique')
  })

  it('treats internal navigation and unidentified clicks as direct', () => {
    expect(classifySource({ referrer: 'https://shop.ci/product/x', ownHost: 'shop.ci', userAgent: IPHONE_SAFARI })).toEqual({ source: 'direct', referrerHost: null })
    expect(classifySource({ userAgent: ANDROID_CHROME }).source).toBe('direct')
    expect(classifySource({ referrer: 'not a url', userAgent: ANDROID_CHROME }).source).toBe('direct')
  })
})

describe('robots, devices, paths', () => {
  it('ignores link-preview robots and scripts', () => {
    expect(isBot('WhatsApp/2.24.20.79 A')).toBe(true)
    expect(isBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBot('curl/8.5.0')).toBe(true)
    expect(isBot(null)).toBe(true)
    expect(isBot(ANDROID_CHROME)).toBe(false)
    expect(isBot(INSTAGRAM_APP)).toBe(false)
  })

  it('detects device and browser', () => {
    expect(deviceOf(ANDROID_CHROME)).toBe('mobile')
    expect(deviceOf(IPHONE_SAFARI)).toBe('mobile')
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe('tablet')
    expect(deviceOf(DESKTOP)).toBe('desktop')
    expect(browserOf(INSTAGRAM_APP)).toBe('Instagram')
    expect(browserOf(ANDROID_CHROME)).toBe('Chrome')
    expect(browserOf(IPHONE_SAFARI)).toBe('Safari')
  })

  it('counts storefront pages only, without query strings', () => {
    expect(cleanPath('/product/air-force-1?utm_source=whatsapp#top')).toBe('/product/air-force-1')
    expect(cleanPath('/admin/orders')).toBeNull()
    expect(cleanPath('/admin')).toBeNull()
    expect(cleanPath('//evil.example')).toBeNull()
    expect(cleanPath('https://x.y/')).toBeNull()
  })
})

describe('audience use-cases', () => {
  function setup() {
    const rows: SiteVisit[] = []
    const visits: VisitRepository = { record: vi.fn(async (v) => void rows.push(v)), stats: vi.fn(async () => ({}) as never) }
    const hashVisitor = vi.fn((ip: string, ua: string, day: string) => `h${day}${ip.length}${ua.length}`)
    const uc = makeAudienceUseCases({ visits, hashVisitor, now: () => new Date('2026-10-06T14:30:00Z') })
    return { uc, rows, visits, hashVisitor }
  }
  const view = { path: '/?utm_source=whatsapp', utm: { source: 'whatsapp', medium: 'status' }, sessionId: 'sess_12345678', visitorKey: 'device-aaaaaaaa', landing: true }

  it('records a WhatsApp visit with its location, without storing the IP', async () => {
    const { uc, rows } = setup()
    const counted = await uc.recordPageView(view, { ip: '41.202.1.2', userAgent: ANDROID_CHROME, country: 'ci', region: 'AB', city: 'Abidjan', host: 'shop.ci' })
    expect(counted).toBe(true)
    expect(rows[0]).toMatchObject({ path: '/', source: 'whatsapp', utm_medium: 'status', country: 'CI', city: 'Abidjan', device: 'mobile', is_landing: true })
    expect(JSON.stringify(rows[0])).not.toContain('41.202.1.2')
  })

  it('decodes edge city names', async () => {
    const { uc, rows } = setup()
    await uc.recordPageView(view, { ip: '1.1.1.1', userAgent: ANDROID_CHROME, country: 'BR', city: 'S%C3%A3o%20Paulo' })
    expect(rows[0]?.city).toBe('São Paulo')
  })

  it('mixes the browser key into a daily visitor id', async () => {
    const { uc, hashVisitor } = setup()
    await uc.recordPageView(view, { ip: '41.202.1.2', userAgent: ANDROID_CHROME })
    expect(hashVisitor).toHaveBeenCalledWith('41.202.1.2|device-aaaaaaaa', ANDROID_CHROME, '2026-10-06')
  })

  it('skips robots and the back-office', async () => {
    const { uc, visits } = setup()
    expect(await uc.recordPageView(view, { ip: '1.1.1.1', userAgent: 'WhatsApp/2.24.20.79 A' })).toBe(false)
    expect(await uc.recordPageView({ ...view, path: '/admin/orders' }, { ip: '1.1.1.1', userAgent: DESKTOP })).toBe(false)
    expect(visits.record).not.toHaveBeenCalled()
  })

  it('computes the periods (today hourly from midnight UTC)', async () => {
    const { uc, visits } = setup()
    const today = await uc.stats('today')
    expect(today).toMatchObject({ from: '2026-10-06T00:00:00.000Z', hourly: true })
    await uc.stats('7d')
    expect(vi.mocked(visits.stats).mock.calls[1]?.[0].toISOString()).toBe('2026-09-29T14:30:00.000Z')
    await expect(uc.stats('1y' as never)).rejects.toMatchObject({ status: 400 })
  })
})
