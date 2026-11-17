import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiGift, HiUserGroup } from 'react-icons/hi2'
import { formatCurrency } from '@trs/shared'
import { useSettings } from '../../../context/SettingsContext'
import { settingsService } from '../../../services/settingsService'
import { promoService, type ReferralStat } from '../../../services/promoService'
import { errorMessage } from '../../../core/http'
import Button from '../../../components/ui/Button'
import Spinner from '../../../components/ui/Spinner'
import Section from './Section'

/** Back-office → Marketing → Parrainage: the offer, and who brings customers. */
export default function ReferralEditor() {
  const { settings, refreshSettings } = useSettings()
  const [enabled, setEnabled] = useState(settings.referral.enabled)
  const [friendPercent, setFriendPercent] = useState(settings.referral.friendPercent)
  const [rewardAmount, setRewardAmount] = useState(settings.referral.rewardAmount)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<ReferralStat[] | null>(null)

  useEffect(() => {
    setEnabled(settings.referral.enabled)
    setFriendPercent(settings.referral.friendPercent)
    setRewardAmount(settings.referral.rewardAmount)
  }, [settings.referral])

  useEffect(() => {
    promoService
      .referrals()
      .then(setStats)
      .catch(() => setStats([]))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await settingsService.updateMany({
        referral_enabled: enabled,
        referral_friend_discount: Math.min(50, Math.max(1, Math.round(friendPercent))),
        referral_reward_amount: Math.max(0, Math.round(rewardAmount)),
      })
      await refreshSettings()
      toast.success('Parrainage mis à jour')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Section icon={HiGift} title="Programme de parrainage" hint="Chaque client a son code dans « Mon compte → Parrainage ». Son proche a une remise sur sa première commande ; quand cette commande est livrée, le client reçoit un bon par email, valable 6 mois et réservé à son compte.">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Parrainage actif
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Remise du proche (%)</span>
            <input className="field" type="number" min={1} max={50} value={friendPercent} onChange={(e) => setFriendPercent(Number(e.target.value))} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Bon du parrain (FCFA)</span>
            <input className="field" type="number" min={0} step={500} value={rewardAmount} onChange={(e) => setRewardAmount(Number(e.target.value))} />
          </label>
        </div>
        <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
          Message vu par vos clients : « Offrez -{friendPercent} %, recevez {formatCurrency(rewardAmount)}. »
        </p>
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </div>
      </Section>

      <Section icon={HiUserGroup} title="Vos ambassadeurs" hint="Les clients dont le code a été utilisé, du plus actif au moins actif.">
        {stats === null ? (
          <Spinner />
        ) : stats.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commande parrainée pour le moment.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <tr>
                  <th className="px-2 py-3 font-medium">Client</th>
                  <th className="px-2 py-3 font-medium">Code</th>
                  <th className="px-2 py-3 font-medium">Commandes</th>
                  <th className="px-2 py-3 font-medium">Livrées</th>
                  <th className="px-2 py-3 font-medium">Bons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.map((s) => (
                  <tr key={s.referrer.id}>
                    <td className="px-2 py-3">
                      <p>{`${s.referrer.first_name} ${s.referrer.last_name}`.trim() || '—'}</p>
                      <p className="text-xs text-gray-500">{s.referrer.email}</p>
                    </td>
                    <td className="px-2 py-3 font-mono tracking-[0.15em] text-gold">{s.code ?? '—'}</td>
                    <td className="px-2 py-3 tabular-nums">{s.orders}</td>
                    <td className="px-2 py-3 tabular-nums">{s.delivered}</td>
                    <td className="px-2 py-3 tabular-nums">{s.rewards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
