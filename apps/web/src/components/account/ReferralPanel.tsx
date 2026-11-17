import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiClipboardDocument, HiShare } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import { promoService, type MyReferral } from '../../services/promoService'
import { useSettings } from '../../context/SettingsContext'
import { errorMessage } from '../../core/http'
import Spinner from '../ui/Spinner'

/** "Mon compte → Parrainage": the code to share, how it works, and the credits earned. */
export default function ReferralPanel() {
  const { settings } = useSettings()
  const [data, setData] = useState<MyReferral | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    promoService
      .myReferral()
      .then(setData)
      .catch((e) => setError(errorMessage(e, 'Impossible de charger votre parrainage')))
  }, [])

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!data) return <Spinner />
  if (!data.enabled || !data.code || !data.link) {
    return (
      <div className="rounded-3xl border border-white/10 p-8 text-center">
        <p className="font-display text-2xl">Le parrainage revient bientôt.</p>
        <p className="mt-2 text-sm text-gray-400">Le programme est en pause pour le moment.</p>
      </div>
    )
  }

  const message = `J'adore ${settings.store_name}. Avec mon code ${data.code}, tu as -${data.friend_discount} % sur ta première commande : ${data.link}`
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copié`)
    } catch {
      toast.error('Copie impossible : sélectionnez le texte à la main')
    }
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: settings.store_name, text: message, url: data.link! })
      else await copy(message, 'Message')
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/10 via-transparent to-transparent p-6 md:p-10">
        <p className="eyebrow mb-3">Parrainage</p>
        <h2 className="font-display text-3xl font-medium md:text-4xl">Offrez -{data.friend_discount} %, recevez {formatCurrency(data.reward_amount)}.</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-300">
          Vos proches profitent de -{data.friend_discount} % sur leur première commande avec votre code. Dès que leur pièce est livrée, vous recevez par email un bon de{' '}
          {formatCurrency(data.reward_amount)}, valable 6 mois.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <button
            type="button"
            onClick={() => copy(data.code!, 'Code')}
            className="group flex flex-1 items-center justify-between gap-4 rounded-2xl border border-dashed border-gold/60 px-5 py-4 text-left transition-colors hover:bg-gold/5"
            aria-label={`Copier le code ${data.code}`}
          >
            <span className="font-mono text-2xl tracking-[0.25em] text-gold">{data.code}</span>
            <HiClipboardDocument className="h-5 w-5 text-gray-400 group-hover:text-gold" />
          </button>
          <div className="flex gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-black hover:bg-gold-light"
            >
              WhatsApp
            </a>
            <button
              type="button"
              onClick={share}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.2em] hover:border-gold hover:text-gold"
            >
              <HiShare className="h-4 w-4" /> Partager
            </button>
          </div>
        </div>
        <button type="button" onClick={() => copy(data.link!, 'Lien')} className="mt-4 block max-w-full truncate text-left text-xs text-gray-500 underline-offset-4 hover:text-white hover:underline">
          {data.link}
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Commandes parrainées', value: data.referred },
          { label: 'Livrées', value: data.delivered },
          { label: 'Bons reçus', value: data.rewards.length },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl border border-white/10 p-6">
            <p className="font-display text-4xl text-gold">{s.value}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-gray-400">{s.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">Mes bons</h3>
        {data.rewards.length === 0 ? (
          <p className="text-sm text-gray-500">Vos bons apparaîtront ici dès la première commande livrée d'un proche.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-3xl border border-white/10">
            {data.rewards.map((r) => {
              const expired = !!r.ends_at && new Date(r.ends_at) < new Date()
              const state = r.used ? 'Utilisé' : expired || !r.active ? 'Expiré' : 'Disponible'
              return (
                <li key={r.code} className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-mono tracking-[0.2em] text-gold">{r.code}</p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(r.value)}
                      {r.ends_at && ` · jusqu'au ${new Date(r.ends_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${state === 'Disponible' ? 'bg-gold/15 text-gold' : 'bg-white/5 text-gray-500'}`}>{state}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
