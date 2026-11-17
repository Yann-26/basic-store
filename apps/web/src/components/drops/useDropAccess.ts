import { useEffect, useState } from 'react'
import type { ProductDrop } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { dropsService } from '../../services/reviewsService'

/** reserve: the drop takes reservations (deposit) before its release date. */
export type DropPhase = 'none' | 'reserve' | 'closed' | 'early' | 'open'

/** Where a piece's drop stands now (from its dates). */
export function dropPhase(drop: ProductDrop | null | undefined, now = Date.now()): DropPhase {
  if (!drop) return 'none'
  if (now >= new Date(drop.starts_at).getTime()) return 'open'
  if (drop.preorders_open !== false) return 'reserve'
  return now >= new Date(drop.early_access_at).getTime() && drop.early_access_at !== drop.starts_at ? 'early' : 'closed'
}

/** "mercredi 19 novembre à 19 h 00", Abidjan time. */
export const dropDateLabel = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')

/**
 * The phase of a piece's drop, kept current (it moves on by itself at the early access and at the
 * opening), and during early access whether the signed-in visitor is on the list.
 */
export function useDropAccess(drop: ProductDrop | null | undefined) {
  const { user } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  const phase = dropPhase(drop, now)
  const [eligible, setEligible] = useState<boolean | null>(null)

  useEffect(() => {
    if (!drop || phase === 'open' || phase === 'reserve') return
    const next = phase === 'closed' && drop.early_access_at !== drop.starts_at ? drop.early_access_at : drop.starts_at
    const wait = new Date(next).getTime() - Date.now()
    // setTimeout cannot wait more than ~24.8 days; the page will have been reloaded by then.
    if (wait > 2_147_000_000) return
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(0, wait) + 500)
    return () => window.clearTimeout(t)
  }, [drop, phase])

  useEffect(() => {
    if (!drop || phase !== 'early' || !user) {
      setEligible(phase === 'early' ? false : null)
      return
    }
    let alive = true
    dropsService
      .access(drop.id)
      .then((r) => alive && setEligible(r.eligible))
      .catch(() => alive && setEligible(false))
    return () => {
      alive = false
    }
  }, [drop, phase, user])

  /** Whether the visitor can put the piece in their basket now. */
  const canOrder = phase === 'none' || phase === 'open' || phase === 'reserve' || (phase === 'early' && eligible === true)
  return { phase, eligible, canOrder, signedIn: Boolean(user) }
}
