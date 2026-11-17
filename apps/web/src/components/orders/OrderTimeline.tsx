import clsx from 'clsx'
import { HiCheck, HiXMark } from 'react-icons/hi2'
import { TRACKING_STEPS, trackingStatus, type OrderStatus } from '@trs/shared'

interface Props {
  status: OrderStatus
  timeline: { status: OrderStatus; notes: string; location: string | null; created_at: string }[]
}

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function OrderTimeline({ status, timeline }: Props) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <HiXMark className="h-6 w-6 text-red-400" />
        <p className="text-sm text-red-300">Cette précommande a été annulée. Contactez-nous pour toute question.</p>
      </div>
    )
  }
  const currentIndex = TRACKING_STEPS.findIndex((s) => s.status === trackingStatus(status))
  return (
    <ol className="relative space-y-6">
      {TRACKING_STEPS.map((step, i) => {
        const done = i < currentIndex || status === 'delivered'
        const current = i === currentIndex && status !== 'delivered'
        const event = [...timeline].reverse().find((t) => t.status === step.status)
        return (
          <li key={step.status} className="relative flex gap-4">
            {i < TRACKING_STEPS.length - 1 && (
              <span className={clsx('absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-px', done ? 'bg-gold' : 'bg-white/10')} aria-hidden />
            )}
            <span
              className={clsx(
                'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs',
                done && 'border-gold bg-gold text-primary-black',
                current && 'border-gold bg-primary-black text-gold shadow-[0_0_0_6px_rgb(var(--glow)/0.15)]',
                !done && !current && 'border-white/15 text-gray-600',
              )}
            >
              {done ? <HiCheck className="h-4 w-4" /> : i + 1}
            </span>
            <div className={clsx('pb-1', !done && !current && 'opacity-50')}>
              <p className={clsx('font-medium', current && 'text-gold')}>{step.label}</p>
              <p className="text-sm text-gray-400">{event?.notes && event.notes !== step.label ? event.notes : step.description}</p>
              {event && (
                <p className="mt-1 text-xs text-gray-500">
                  {fmt(event.created_at)}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
