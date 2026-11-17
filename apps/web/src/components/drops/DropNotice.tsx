import { Link, useLocation } from 'react-router-dom'
import type { ProductDrop } from '@trs/shared'
import { RemindForm } from './dropTools'
import { useSettings } from '../../context/SettingsContext'
import { dropDateLabel, type DropPhase } from './useDropAccess'

/**
 * A piece of an upcoming drop: when it opens, the early access of the people on the list, and
 * where the visitor stands (sign up, sign in, on the list or not).
 */
export default function DropNotice({ drop, phase, eligible, signedIn }: { drop: ProductDrop; phase: DropPhase; eligible: boolean | null; signedIn: boolean }) {
  const { pathname } = useLocation()
  const deposit = useSettings().settings.deposit_percentage
  if (phase === 'none' || phase === 'open') return null
  if (phase === 'reserve') {
    return (
      <section aria-label="Précommande" className="mt-8 border border-white/10 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">{drop.title}</p>
        <p className="mt-2 text-sm">
          Sortie le <span className="font-semibold">{dropDateLabel(drop.starts_at)}</span>. Réservez la vôtre dès maintenant avec un acompte de {deposit} %, le solde avant la livraison.
        </p>
      </section>
    )
  }
  const hasEarly = drop.early_access_at !== drop.starts_at
  const hours = Math.round((new Date(drop.starts_at).getTime() - new Date(drop.early_access_at).getTime()) / 3_600_000)

  if (phase === 'closed') {
    return (
      <section aria-label="Sortie du drop" className="mt-8 border border-white/10 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">{drop.title}</p>
        <p className="mt-2 text-sm">
          Précommandes le <span className="font-semibold">{dropDateLabel(drop.starts_at)}</span>.
        </p>
        {hasEarly && (
          <p className="mt-1 text-sm text-gray-400">
            Accès anticipé {hours} h avant, le {dropDateLabel(drop.early_access_at)}, pour les inscrits à la liste.
          </p>
        )}
        <div className="mt-4">
          <RemindForm drop={drop} />
        </div>
      </section>
    )
  }

  // Early access
  return (
    <section aria-label="Accès anticipé" className="mt-8 border border-gold/40 p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gold">Accès anticipé · {drop.title}</p>
      {eligible ? (
        <p className="mt-2 text-sm">Vous êtes sur la liste : précommandez avant l’ouverture à tous, le {dropDateLabel(drop.starts_at)}.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            Réservé aux inscrits jusqu’au <span className="font-semibold">{dropDateLabel(drop.starts_at)}</span>, puis ouvert à tous.
          </p>
          {!signedIn && (
            <p className="mt-2 text-sm text-gray-400">
              Inscrit·e ?{' '}
              <Link to="/login" state={{ from: pathname }} className="underline underline-offset-4 hover:opacity-70">
                Connectez-vous
              </Link>{' '}
              avec l’adresse email de votre inscription.
            </p>
          )}
        </>
      )}
    </section>
  )
}
