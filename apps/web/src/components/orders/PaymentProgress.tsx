import clsx from 'clsx'
import { PAYMENT_PROGRESS_LABELS, formatCurrency, paymentProgress, type PaymentProgressState } from '@trs/shared'

const TONE: Record<PaymentProgressState, { bar: string; badge: string }> = {
  unpaid: { bar: 'bg-white/20', badge: 'border-white/15 bg-white/5 text-gray-300' },
  partial: { bar: 'bg-gold', badge: 'border-gold/30 bg-gold/10 text-gold' },
  paid: { bar: 'bg-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  refunded: { bar: 'bg-red-400', badge: 'border-red-500/30 bg-red-500/10 text-red-400' },
}

export function PaymentBadge({ state, className }: { state: PaymentProgressState; className?: string }) {
  return (
    <span className={clsx('inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium', TONE[state].badge, className)}>
      {PAYMENT_PROGRESS_LABELS[state]}
    </span>
  )
}

/**
 * What an order really received: a bar, "4 000 / 10 000 FCFA · 40 %" and what
 * is left. Computed from the money recorded, never from the order status.
 */
export default function PaymentProgress({
  order,
  compact,
  className,
}: {
  order: { total_price: number; amount_paid?: number | null; payment_status?: string | null }
  compact?: boolean
  className?: string
}) {
  const p = paymentProgress(order)
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="whitespace-nowrap text-gray-300">
          <strong className="text-white">{formatCurrency(p.paid)}</strong>
          <span className="text-gray-500"> / {formatCurrency(p.total)}</span>
        </span>
        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-300">{p.paidPercent} %</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Part payée"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.paidPercent}
      >
        <div className={clsx('h-full rounded-full transition-all', TONE[p.state].bar)} style={{ width: `${p.paidPercent}%` }} />
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <PaymentBadge state={p.state} />
          {p.outstanding > 0 && <span className="whitespace-nowrap text-[11px] text-gray-400">Reste {formatCurrency(p.outstanding)}</span>}
        </div>
      )}
    </div>
  )
}
