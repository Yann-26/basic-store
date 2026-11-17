import { useSettings } from '../../context/SettingsContext'

/** "Mot du fondateur": the founder's own words, managed in Admin → Paramètres → Vitrine. Hidden until written. */
export default function FounderWord() {
  const { settings } = useSettings()
  const message = settings.founder_message.trim()
  if (!message) return null
  const paragraphs = message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const name = settings.founder_name.trim()

  return (
    <section className="border-y border-white/10 py-16 md:py-24" aria-labelledby="founder-title">
      <div className="container-custom grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        {settings.founder_photo && (
          <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden bg-dark-700">
            <img src={settings.founder_photo} alt={name ? `${name}, fondateur de ${settings.store_name}` : 'Le fondateur'} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}

        <div className={settings.founder_photo ? '' : 'lg:col-span-2 lg:mx-auto lg:max-w-3xl'}>
          <h2 id="founder-title" className="mb-6 text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">
            Mot du fondateur
          </h2>
          <div className="space-y-5 font-display text-xl leading-relaxed text-white md:text-2xl">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
          {(name || settings.founder_role) && (
            <div className="mt-10 border-t border-white/10 pt-6">
              {name && <p className="campaign-title text-3xl">{name}</p>}
              {settings.founder_role && <p className="mt-2 text-xs uppercase tracking-[0.15em] text-gray-500">{settings.founder_role}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
