import type { ReactNode } from 'react'
import { StarMark } from '../ui/Logo'

/** Split layout: black form panel + ivory brand panel. */
export default function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid min-h-[calc(100vh-8rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-semibold">{title}</h1>
          <p className="mb-10 mt-2 text-gray-400">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ivory text-primary-black lg:flex lg:items-center lg:justify-center">
        <StarMark className="absolute -right-24 -top-24 h-96 w-96 opacity-10" />
        <div className="relative max-w-sm p-12">
          {aside ?? (
            <>
              <p className="eyebrow !text-gold-dark">Le Cercle</p>
              <p className="mt-4 font-display text-4xl leading-tight">Vos favoris, vos commandes et nos avant-premières, réunis.</p>
              <ul className="mt-8 space-y-3 text-sm text-neutral-600">
                <li>★ Checkout plus rapide</li>
                <li>★ Suivi de toutes vos commandes</li>
                <li>★ Accès prioritaire aux éditions limitées</li>
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
