import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiTicket, HiPlus, HiPencil, HiTrash, HiSparkles } from 'react-icons/hi2'
import { formatCurrency, promoLabel, type PromoCode } from '@trs/shared'
import { promoService, type PromoCodeInput } from '../../../services/promoService'
import { errorMessage } from '../../../core/http'
import Button from '../../../components/ui/Button'
import Spinner from '../../../components/ui/Spinner'
import Section from './Section'

const EMPTY: PromoCodeInput = {
  code: '',
  kind: 'percent',
  value: 10,
  description: '',
  min_order: 0,
  max_uses: null,
  per_account_limit: 1,
  starts_at: null,
  ends_at: null,
  is_active: true,
  first_order_only: false,
}

/** Ready-made ideas: one click fills the form. */
const IDEAS: { label: string; values: Partial<PromoCodeInput> }[] = [
  { label: 'Bienvenue -10 %', values: { code: 'BIENVENUE', kind: 'percent', value: 10, description: 'Première commande', first_order_only: true } },
  { label: 'Nouvel arrivage', values: { code: 'ARRIVAGE', kind: 'percent', value: 15, description: 'Les 48 premières heures de l’arrivage', max_uses: 50 } },
  { label: 'Influenceur', values: { code: 'NOM10', kind: 'percent', value: 10, description: 'Code de l’influenceur : ses ventes se lisent dans la colonne « Utilisé »' } },
  { label: 'Pop-up store', values: { code: 'POPUP', kind: 'fixed', value: 5000, description: 'Remis au pop-up store', min_order: 20000 } },
]

const toDay = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const fromDay = (day: string, end = false) => (day ? new Date(`${day}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : null)

function randomCode() {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  return `SC-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join('')}`
}

function status(p: PromoCode): { label: string; tone: string } {
  const now = new Date()
  if (!p.is_active) return { label: 'Désactivé', tone: 'bg-white/5 text-gray-500' }
  if (p.ends_at && new Date(p.ends_at) < now) return { label: 'Expiré', tone: 'bg-white/5 text-gray-500' }
  if (p.max_uses !== null && p.uses >= p.max_uses) return { label: 'Épuisé', tone: 'bg-amber-500/10 text-amber-300' }
  if (p.starts_at && new Date(p.starts_at) > now) return { label: 'Programmé', tone: 'bg-sky-500/10 text-sky-300' }
  return { label: 'Actif', tone: 'bg-gold/15 text-gold' }
}

/** Back-office → Marketing → Codes promo: create, schedule, limit and follow the codes. */
export default function PromoCodesEditor() {
  const [codes, setCodes] = useState<PromoCode[] | null>(null)
  const [form, setForm] = useState<PromoCodeInput | null>(null)
  const [editing, setEditing] = useState<PromoCode | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    promoService
      .list({ source: 'manual' })
      .then(setCodes)
      .catch((e) => {
        setCodes([])
        toast.error(errorMessage(e, 'Impossible de charger les codes'))
      })
  }, [])
  useEffect(load, [load])

  const set = <K extends keyof PromoCodeInput>(key: K, value: PromoCodeInput[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  const open = (p?: PromoCode, preset?: Partial<PromoCodeInput>) => {
    setEditing(p ?? null)
    setForm(
      p
        ? { code: p.code, kind: p.kind, value: p.value, description: p.description, min_order: p.min_order, max_uses: p.max_uses, per_account_limit: p.per_account_limit, starts_at: p.starts_at, ends_at: p.ends_at, is_active: p.is_active, first_order_only: p.first_order_only }
        : { ...EMPTY, ...preset },
    )
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      if (editing) await promoService.update(editing.id, form)
      else await promoService.create(form)
      toast.success(editing ? 'Code mis à jour' : `Code ${form.code.toUpperCase()} créé`)
      setForm(null)
      setEditing(null)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (p: PromoCode) => {
    try {
      await promoService.update(p.id, { is_active: !p.is_active })
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (p: PromoCode) => {
    if (!window.confirm(`Supprimer le code ${p.code} ?`)) return
    try {
      const r = await promoService.remove(p.id)
      toast.success(r.deactivated ? 'Code déjà utilisé : il est désactivé et reste dans l’historique' : 'Code supprimé')
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <Section
        icon={HiTicket}
        title="Codes promo"
        hint="Le client saisit le code au paiement ; la remise est calculée par le serveur. Un code utilisé ne peut plus être supprimé : il est désactivé."
        actions={
          !form && (
            <Button size="sm" icon={HiPlus} onClick={() => open()}>
              Nouveau code
            </Button>
          )
        }
      >
        {!form && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Idées :</span>
            {IDEAS.map((idea) => (
              <button key={idea.label} type="button" onClick={() => open(undefined, idea.values)} className="rounded-full border border-white/15 px-4 py-2 text-xs hover:border-gold hover:text-gold">
                {idea.label}
              </button>
            ))}
          </div>
        )}

        {form && (
          <div className="space-y-5 rounded-2xl border border-gold/20 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 md:col-span-1">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Code</span>
                <div className="flex gap-2">
                  <input className="field font-mono uppercase tracking-[0.15em]" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, ''))} maxLength={30} placeholder="BIENVENUE" disabled={!!editing && editing.uses > 0} />
                  {!editing && (
                    <button type="button" onClick={() => set('code', randomCode())} className="rounded-xl border border-white/15 px-3 text-gray-400 hover:border-gold hover:text-gold" aria-label="Générer un code" title="Générer un code">
                      <HiSparkles className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Type de remise</span>
                <select className="field" value={form.kind} onChange={(e) => set('kind', e.target.value as PromoCodeInput['kind'])}>
                  <option value="percent">Pourcentage</option>
                  <option value="fixed">Montant fixe (FCFA)</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">{form.kind === 'percent' ? 'Remise (%)' : 'Remise (FCFA)'}</span>
                <input className="field" type="number" min={1} max={form.kind === 'percent' ? 100 : undefined} value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Note interne (facultatif)</span>
              <input className="field" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={200} placeholder="Ex. Influenceuse Awa, campagne d’octobre" />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Panier minimum (FCFA)</span>
                <input className="field" type="number" min={0} step={1000} value={form.min_order} onChange={(e) => set('min_order', Number(e.target.value))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Utilisations au total</span>
                <input className="field" type="number" min={1} value={form.max_uses ?? ''} placeholder="Illimité" onChange={(e) => set('max_uses', e.target.value ? Number(e.target.value) : null)} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Par client</span>
                <input className="field" type="number" min={1} max={100} value={form.per_account_limit} onChange={(e) => set('per_account_limit', Number(e.target.value) || 1)} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Début (facultatif)</span>
                <input className="field" type="date" value={toDay(form.starts_at)} onChange={(e) => set('starts_at', fromDay(e.target.value))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Fin (facultatif)</span>
                <input className="field" type="date" value={toDay(form.ends_at)} onChange={(e) => set('ends_at', fromDay(e.target.value, true))} />
              </label>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.first_order_only} onChange={(e) => set('first_order_only', e.target.checked)} className="accent-[var(--color-gold)]" />
                Première commande uniquement
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="accent-[var(--color-gold)]" />
                Actif
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => (setForm(null), setEditing(null))}>
                Annuler
              </Button>
              <Button onClick={save} loading={saving} disabled={form.code.trim().length < 3 || form.value <= 0}>
                {editing ? 'Enregistrer' : 'Créer le code'}
              </Button>
            </div>
          </div>
        )}

        {codes === null ? (
          <Spinner />
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun code pour le moment.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <tr>
                  <th className="px-2 py-3 font-medium">Code</th>
                  <th className="px-2 py-3 font-medium">Remise</th>
                  <th className="px-2 py-3 font-medium">Conditions</th>
                  <th className="px-2 py-3 font-medium">Utilisé</th>
                  <th className="px-2 py-3 font-medium">Statut</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map((p) => {
                  const st = status(p)
                  const conditions = [
                    p.first_order_only && '1re commande',
                    p.min_order > 0 && `dès ${formatCurrency(p.min_order)}`,
                    p.ends_at && `jusqu'au ${new Date(p.ends_at).toLocaleDateString('fr-FR')}`,
                  ].filter(Boolean)
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-3">
                        <p className="font-mono tracking-[0.15em] text-gold">{p.code}</p>
                        {p.description && <p className="max-w-[16rem] truncate text-xs text-gray-500">{p.description}</p>}
                      </td>
                      <td className="px-2 py-3">{promoLabel(p)}</td>
                      <td className="px-2 py-3 text-xs text-gray-400">{conditions.length ? conditions.join(' · ') : '—'}</td>
                      <td className="px-2 py-3 tabular-nums">
                        {p.uses}
                        {p.max_uses !== null && <span className="text-gray-500"> / {p.max_uses}</span>}
                      </td>
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => toggle(p)} className={clsx('rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.15em]', st.tone)} title={p.is_active ? 'Désactiver' : 'Activer'}>
                          {st.label}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => open(p)} className="rounded-lg p-2 text-gray-400 hover:text-gold" aria-label={`Modifier ${p.code}`}>
                            <HiPencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => remove(p)} className="rounded-lg p-2 text-gray-400 hover:text-red-400" aria-label={`Supprimer ${p.code}`}>
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
