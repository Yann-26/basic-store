import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import QRCode from 'qrcode'
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  paymentProgress,
  type Order, formatPieceNumbers } from '@trs/shared'
import { payBalanceUrl } from '../../utils/payLinks'


const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')

/**
 * Paper ticket handed over with the parcel (or kept in the customer's
 * account): what was ordered, what was really paid and what is left, with a
 * QR code to pay the rest online. Light on purpose so it prints on any printer.
 */
export default function BalanceTicket({ order, contactPhone }: { order: Order; contactPhone?: string }) {
  const { settings } = useSettings()
  const p = paymentProgress(order)
  const url = payBalanceUrl(order.preorder_number)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (p.outstanding <= 0) return
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then((data) => alive && setQr(data))
      .catch(() => alive && setQr(null))
    return () => {
      alive = false
    }
  }, [url, p.outstanding])

  const received = (order.payments ?? []).filter((x) => x.status === 'success')
  const name = `${order.customers?.first_name ?? ''} ${order.customers?.last_name ?? ''}`.trim()

  return (
    <article className="balance-ticket mx-auto w-full max-w-[420px] rounded-2xl border border-[#d4d4d4] bg-[#fff] p-6 font-sans text-[#171717] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="border-b border-dashed border-[#d4d4d4] pb-4 text-center">
        <p className="font-display text-xl font-bold tracking-[0.2em]">{settings.store_name}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#8a6d12]">Ticket de paiement</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed border-[#d4d4d4] py-4 text-sm">
        <dt className="text-[#737373]">Précommande</dt>
        <dd className="text-right font-mono font-semibold">{order.preorder_number}</dd>
        <dt className="text-[#737373]">Date</dt>
        <dd className="text-right">{fmtDate(order.created_at)}</dd>
        {name && (
          <>
            <dt className="text-[#737373]">Client</dt>
            <dd className="text-right">{name}</dd>
          </>
        )}
      </dl>

      <ul className="space-y-1.5 border-b border-dashed border-[#d4d4d4] py-4 text-sm">
        {(order.order_items ?? []).map((i, n) => (
          <li key={i.id ?? n} className="flex justify-between gap-3">
            <span className="min-w-0">
              {i.product_name}
              <span className="text-[#737373]">
                {[i.size && i.size !== 'TU' ? ` · ${i.size}` : '', i.color ? ` · ${i.color}` : '', i.quantity > 1 ? ` · ×${i.quantity}` : '', (i.piece_numbers ?? []).length ? ` · ${formatPieceNumbers(i.piece_numbers)}` : ''].join('')}
              </span>
            </span>
            <span className="whitespace-nowrap tabular-nums">{formatCurrency(i.product_price * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 py-4 text-sm">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="font-semibold tabular-nums">{formatCurrency(p.total)}</span>
        </div>
        <div className="flex justify-between text-[#8a6d12]">
          <span>Déjà payé ({p.paidPercent} %)</span>
          <span className="font-semibold tabular-nums">{formatCurrency(p.paid)}</span>
        </div>
        {received.length > 0 && (
          <ul className="space-y-0.5 pl-3 text-xs text-[#737373]">
            {received.map((x) => (
              <li key={x.id} className="flex justify-between gap-3">
                <span>
                  {PAYMENT_KIND_LABELS[x.kind] ?? 'Paiement'} · {PAYMENT_METHOD_LABELS[x.method] ?? x.method} · {fmtDate(x.paid_at ?? x.created_at)}
                </span>
                <span className="tabular-nums">{formatCurrency(x.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {p.outstanding > 0 ? (
        <div className="rounded-xl border-2 border-[#171717] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest">Reste à payer ({100 - p.paidPercent} %)</span>
            <span className="text-2xl font-bold tabular-nums">{formatCurrency(p.outstanding)}</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {qr ? (
              <img src={qr} alt={`QR code pour payer le solde de ${order.preorder_number}`} className="h-32 w-32 shrink-0" />
            ) : (
              <div className="h-32 w-32 shrink-0 animate-pulse rounded bg-[#f5f5f5]" />
            )}
            <div className="min-w-0 text-xs leading-relaxed text-[#404040]">
              <p className="font-semibold text-[#171717]">Scannez pour payer en ligne</p>
              <p className="mt-1">Le montant est déjà rempli. Le solde apparaît aussi dans « Mon compte ».</p>
              <p className="mt-2 break-all font-mono text-[10px] text-[#737373]">{url.replace(/^https?:\/\//, '')}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-emerald-600 p-4 text-center">
          <p className="text-lg font-bold text-emerald-700">Payé à 100 %</p>
          <p className="mt-1 text-xs text-[#525252]">Merci ! Plus rien à régler sur cette commande.</p>
        </div>
      )}

      <footer className="mt-4 text-center text-[11px] leading-relaxed text-[#737373]">
        {p.outstanding > 0 && <p>Vous payez en espèces ? Remettez le montant au livreur : votre paiement sera enregistré et vous recevrez un reçu par email.</p>}
        <p className="mt-1">
          {settings.store_name} · {contactPhone || settings.store_phone}
        </p>
      </footer>
    </article>
  )
}
