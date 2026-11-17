import type { Product } from '@trs/shared'
import { useCountdown } from '../home/useCountdown'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * The series is made once enough pieces are paid: how many already are, how
 * many are missing, and when the preorders close. Shown on pieces given a goal
 * in the back-office (Produits → Jauge de précommandes).
 */
export default function PreorderGauge({ product }: { product: Product }) {
  const goal = product.preorder_goal ?? 0
  const deadline = product.preorder_deadline ?? ''
  const left = useCountdown(deadline)
  if (goal <= 0) return null

  const count = Math.max(0, product.preorder_count ?? 0)
  const reached = count >= goal
  const missing = goal - count
  const closed = Boolean(left?.done)
  const percent = Math.min(100, Math.round((count / goal) * 100))

  return (
    <section aria-label="Précommandes" className="mt-8 border border-white/10 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">Série de {goal} pièces</p>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{count}</span> / {goal} pièces
        </p>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-dark-600"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(count, goal)}
        aria-label={`${count} pièces précommandées sur ${goal}`}
      >
        <div className="h-full bg-gold transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>

      <p className="mt-3 text-sm">
        {reached
          ? 'Objectif atteint : la série est lancée en fabrication.'
          : `Encore ${missing} pièce${missing > 1 ? 's' : ''} pour lancer la fabrication.`}
      </p>

      {deadline && left && (
        <p className="mt-1 text-xs text-gray-400">
          {closed ? (
            <>Précommandes closes le {fmtDate(deadline)}.</>
          ) : (
            <>
              Clôture le {fmtDate(deadline)}
              {' · '}
              <span className="tabular-nums">
                {left.days > 0 ? `${left.days} j ` : ''}
                {left.hours} h {String(left.minutes).padStart(2, '0')} min
              </span>
            </>
          )}
        </p>
      )}

      {!reached && (
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Vous payez aujourd’hui ; la pièce est fabriquée pour vous à Abidjan dès que la série est complète. Si l’objectif n’est pas atteint à la clôture, vous êtes remboursé
          intégralement.
        </p>
      )}
    </section>
  )
}
