import { useEffect, useState } from 'react'
import { dropState, type Drop } from '@trs/shared'
import { dropsService } from '../../services/reviewsService'

/** The published drops, sorted, with the next upcoming one picked out. */
export function useDrops() {
  const [drops, setDrops] = useState<Drop[] | null>(null)
  useEffect(() => {
    let alive = true
    dropsService
      .calendar()
      .then((d) => alive && setDrops(d))
      .catch(() => alive && setDrops([]))
    return () => {
      alive = false
    }
  }, [])
  const list = drops ?? []
  const upcoming = list.filter((d) => dropState(d.starts_at) === 'upcoming')
  const live = list.filter((d) => dropState(d.starts_at) === 'live')
  const past = list.filter((d) => dropState(d.starts_at) === 'past').reverse()
  return { loading: drops === null, drops: list, upcoming, live, past, next: upcoming[0] ?? null }
}

export function formatDropDate(iso: string, withTime = true) {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}
