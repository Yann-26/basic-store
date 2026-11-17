import { useSettings } from '../../context/SettingsContext'
import toast from 'react-hot-toast'
import { HiArrowDownTray, HiClipboardDocument } from 'react-icons/hi2'

/** One-time recovery codes, shown once: copy or download, then keep them safe. */
export default function RecoveryCodes({ codes }: { codes: string[] }) {
  const { settings } = useSettings()
  const text = codes.join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Codes copiés')
    } catch {
      toast.error('Copie impossible, notez-les à la main')
    }
  }
  const download = () => {
    const blob = new Blob([`${settings.store_name} — codes de secours (usage unique)\n\n${text}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'codes-de-secours.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-gold/30 bg-black/40 p-4 font-mono text-sm tracking-wider">
        {codes.map((c) => (
          <li key={c} className="text-center text-gold">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 py-2 text-xs uppercase tracking-widest hover:border-gold hover:text-gold">
          <HiClipboardDocument className="h-4 w-4" /> Copier
        </button>
        <button type="button" onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 py-2 text-xs uppercase tracking-widest hover:border-gold hover:text-gold">
          <HiArrowDownTray className="h-4 w-4" /> Télécharger
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Chaque code ne sert qu'une fois, si vous perdez l'accès à votre application d'authentification. Gardez-les en lieu sûr : ils ne seront plus affichés.
      </p>
    </div>
  )
}
