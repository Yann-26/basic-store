import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { FaWhatsapp, FaInstagram } from 'react-icons/fa'
import { HiEnvelope, HiMapPin, HiPhone, HiCheckCircle } from 'react-icons/hi2'
import { isValidEmail } from '@trs/shared'
import { useSettings } from '../context/SettingsContext'
import { engagementService } from '../services/engagementService'
import { errorMessage } from '../core/http'
import { useRecaptchaPreload } from '../hooks/useRecaptchaPreload'
import { socialUrl, whatsappLink } from '../utils/constants'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import RecaptchaNotice from '../components/ui/RecaptchaNotice'

const SUBJECTS = ['Question sur une pièce', 'Suivi de commande', 'Taille & conseil style', 'Partenariat / presse', 'Autre']
const EMPTY = { name: '', email: '', phone: '', subject: SUBJECTS[0]!, message: '' }

export default function Contact() {
  const { settings } = useSettings()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  useRecaptchaPreload()

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (form.name.trim().length < 2) errs.name = 'Nom requis'
    if (!isValidEmail(form.email.trim())) errs.email = 'Email invalide'
    if (form.message.trim().length < 10) errs.message = 'Message trop court (10 caractères min.)'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await engagementService.sendContact({ ...form, email: form.email.trim(), phone: form.phone || undefined })
      setSent(true)
      setForm(EMPTY)
    } catch (err) {
      toast.error(errorMessage(err, "Le message n'a pas pu être envoyé"))
    } finally {
      setLoading(false)
    }
  }

  const channels = [
    { icon: FaWhatsapp, label: 'WhatsApp', value: settings.store_whatsapp, href: whatsappLink(settings.store_whatsapp) },
    { icon: HiPhone, label: 'Téléphone', value: settings.store_phone, href: `tel:${settings.store_phone.replace(/\s/g, '')}` },
    { icon: HiEnvelope, label: 'Email', value: settings.store_email, href: `mailto:${settings.store_email}` },
    { icon: FaInstagram, label: 'Instagram', value: settings.social_instagram ? `@${settings.social_instagram.replace(/^@/, '')}` : '', href: socialUrl('instagram', settings.social_instagram) },
    { icon: HiMapPin, label: 'Showroom', value: `${settings.store_address}, ${settings.store_city}`, href: undefined },
  ].filter((c) => c.value.trim())

  return (
    <>
      <Helmet>
        <title>{`Contact | ${settings.store_name}`}</title>
      </Helmet>
      <section className="container-custom grid gap-12 py-14 lg:grid-cols-[1fr_1.3fr] lg:py-20">
        <div>
          <p className="eyebrow mb-3">Contact</p>
          <h1 className="text-4xl font-semibold md:text-6xl">Parlons style.</h1>
          <p className="mt-4 max-w-md text-gray-400">Une question sur une pièce, une taille ou votre commande ? Notre équipe vous répond en moins de 24 h — souvent bien plus vite sur WhatsApp.</p>
          <ul className="mt-10 space-y-3">
            {channels.map((c) => {
              const inner = (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40">
                    <c.icon className="h-5 w-5 text-gold" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-gray-500">{c.label}</span>
                    <span className="text-white">{c.value}</span>
                  </span>
                </>
              )
              return (
                <li key={c.label}>
                  {c.href ? (
                    <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl p-2 transition-colors hover:bg-white/5">
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 p-2">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-3xl border border-white/5 bg-dark-800 p-6 md:p-10">
          {sent ? (
            <div className="py-16 text-center">
              <HiCheckCircle className="mx-auto h-16 w-16 text-gold" />
              <h2 className="mt-6 text-3xl">Message envoyé</h2>
              <p className="mt-2 text-gray-400">Merci ! Nous revenons vers vous très vite.</p>
              <Button variant="outline" className="mt-8" onClick={() => setSent(false)}>
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Nom complet" value={form.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
                <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Téléphone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
                <div className="space-y-1.5">
                  <label htmlFor="subject" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                    Sujet
                  </label>
                  <select id="subject" value={form.subject} onChange={set('subject')} className="field">
                    {SUBJECTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="message" className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
                  Message <span className="text-gold">*</span>
                </label>
                <textarea id="message" rows={6} value={form.message} onChange={set('message')} className={`field resize-none ${errors.message ? '!border-red-500' : ''}`} maxLength={5000} />
                {errors.message && <p className="text-xs text-red-400">{errors.message}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Envoyer
              </Button>
              <RecaptchaNotice />
            </form>
          )}
        </div>
      </section>
    </>
  )
}
