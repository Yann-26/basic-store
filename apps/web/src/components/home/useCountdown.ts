import { useEffect, useState } from 'react'

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

/** Time left until `target` (an ISO date); `null` when no valid date is set. */
export function useCountdown(target: string): Countdown | null {
  const end = Date.parse(target)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (Number.isNaN(end)) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [end])
  if (Number.isNaN(end)) return null
  const left = Math.max(0, end - now)
  return {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor(left / 3_600_000) % 24,
    minutes: Math.floor(left / 60_000) % 60,
    seconds: Math.floor(left / 1000) % 60,
    done: left === 0,
  }
}
