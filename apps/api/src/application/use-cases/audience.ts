import { AUDIENCE_RANGES, type AudienceRange, type AudienceStats } from '@trs/shared'
import type { VisitRepository, VisitorHasher } from '../ports'
import { browserOf, classifySource, cleanPath, cleanUtm, deviceOf, isBot } from '../audience'
import { ValidationError } from '@/domain/errors'

export interface PageViewInput {
  path: string
  referrer?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null
  sessionId: string
  /** Random key kept by the browser: tells apart phones sharing one carrier IP. Never stored as is. */
  visitorKey?: string | null
  landing: boolean
}

export interface RequestInfo {
  ip: string
  userAgent: string | null
  /** Country (ISO 3166-1 alpha-2), region and city resolved at the edge (Vercel). */
  country?: string | null
  region?: string | null
  city?: string | null
  /** The shop's own hostname: internal navigation is not a referrer. */
  host?: string | null
}

const RANGE_DAYS: Record<Exclude<AudienceRange, 'today'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** Edge geo headers are URL-encoded ("Abidjan", "S%C3%A3o%20Paulo"). */
function geo(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value).trim().slice(0, max) || null
  } catch {
    return null
  }
}

export function makeAudienceUseCases(d: { visits: VisitRepository; hashVisitor: VisitorHasher; now?: () => Date }) {
  const now = d.now ?? (() => new Date())

  return {
    /** Records one storefront page view. Robots and the back-office are ignored; returns whether it was counted. */
    async recordPageView(input: PageViewInput, req: RequestInfo): Promise<boolean> {
      if (isBot(req.userAgent)) return false
      const path = cleanPath(input.path)
      if (!path) return false
      const ua = req.userAgent!
      const { source, referrerHost } = classifySource({ utmSource: input.utm?.source, referrer: input.referrer, userAgent: ua, ownHost: req.host })
      const country = (req.country ?? '').toUpperCase()
      await d.visits.record({
        session_id: input.sessionId,
        visitor_hash: d.hashVisitor(`${req.ip}|${input.visitorKey ?? ''}`, ua, now().toISOString().slice(0, 10)),
        is_landing: input.landing,
        path,
        source,
        referrer_host: referrerHost,
        utm_source: cleanUtm(input.utm?.source),
        utm_medium: cleanUtm(input.utm?.medium),
        utm_campaign: cleanUtm(input.utm?.campaign, 80),
        country: /^[A-Z]{2}$/.test(country) ? country : null,
        region: geo(req.region, 80),
        city: geo(req.city, 80),
        device: deviceOf(ua),
        browser: browserOf(ua),
      })
      return true
    },

    /** Audience figures for a period (Africa/Abidjan = UTC, so days are UTC days). */
    async stats(range: AudienceRange): Promise<AudienceStats> {
      if (!AUDIENCE_RANGES.includes(range)) throw new ValidationError('Période invalide')
      const to = now()
      const from =
        range === 'today'
          ? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
          : new Date(to.getTime() - RANGE_DAYS[range] * 86_400_000)
      const hourly = range === 'today'
      const stats = await d.visits.stats(from, to, hourly)
      return { range, from: from.toISOString(), to: to.toISOString(), hourly, ...stats }
    },
  }
}
