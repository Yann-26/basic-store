import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HiMegaphone } from 'react-icons/hi2'
import { useSettings } from '../../../context/SettingsContext'
import { settingsService } from '../../../services/settingsService'
import { errorMessage } from '../../../core/http'
import Button from '../../../components/ui/Button'
import Section from './Section'

const IDEAS = [
  'Livraison à Abidjan en 1 à 3 jours',
  'Paiement sécurisé en ligne',
  'Séries limitées',
  'Nouveau drop ce vendredi',
  'Pop-up store samedi — venez essayer',
]

/** The announcement bar: messages separated by "·" take turns at the top of the shop. */
export default function AnnouncementEditor() {
  const { settings, refreshSettings } = useSettings()
  const [messages, setMessages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(
    () =>
      setMessages(
        settings.announcement_text
          .split('·')
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    [settings.announcement_text],
  )

  const save = async () => {
    setSaving(true)
    try {
      await settingsService.updateMany({ announcement_text: messages.map((m) => m.trim()).filter(Boolean).join(' · ') })
      await refreshSettings()
      toast.success('Bandeau mis à jour')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section icon={HiMegaphone} title="Bandeau d'annonce" hint="Les messages défilent un par un tout en haut de la boutique, toutes les 4 secondes. Aucun message : le bandeau disparaît.">
      <ul className="space-y-2">
        {messages.map((m, i) => (
          <li key={i} className="flex gap-2">
            <input value={m} onChange={(e) => setMessages((ms) => ms.map((x, k) => (k === i ? e.target.value.replace(/·/g, '') : x)))} className="field" aria-label={`Message ${i + 1}`} maxLength={80} />
            <button type="button" onClick={() => setMessages((ms) => ms.filter((_, k) => k !== i))} className="rounded-xl px-3 text-sm text-gray-400 hover:text-red-400">
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMessages((ms) => [...ms, ''])} className="rounded-full border border-white/15 px-4 py-2 text-xs hover:border-gold">
          + Ajouter un message
        </button>
        {IDEAS.filter((idea) => !messages.includes(idea)).map((idea) => (
          <button key={idea} type="button" onClick={() => setMessages((ms) => [...ms, idea])} className="rounded-full border border-dashed border-white/10 px-4 py-2 text-xs text-gray-400 hover:border-gold hover:text-gold">
            {idea}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Publier le bandeau
        </Button>
      </div>
    </Section>
  )
}
