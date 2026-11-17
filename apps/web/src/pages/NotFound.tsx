import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../components/ui/Button'
import { StarMark } from '../components/ui/Logo'
import { useSettings } from '../context/SettingsContext'

export default function NotFound() {
  const { settings } = useSettings()
  return (
    <section className="container-custom py-32 text-center">
      <Helmet>
        <title>{`Page introuvable | ${settings.store_name}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <StarMark className="mx-auto h-16 w-16" />
      <p className="mt-8 font-display text-8xl text-gold-gradient">404</p>
      <h1 className="mt-4 text-3xl">Cette étoile s'est éteinte…</h1>
      <p className="mt-2 text-gray-400">La page que vous cherchez n'existe pas ou a été déplacée.</p>
      <Link to="/" className="mt-10 inline-block">
        <Button>Retour à l'accueil</Button>
      </Link>
    </section>
  )
}
