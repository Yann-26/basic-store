import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

/** A titled block of the Marketing panel. */
export default function Section({ icon: Icon, title, hint, children, actions }: { icon: IconType; title: string; hint?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-6 rounded-2xl border border-white/5 bg-dark-800 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gold/40">
            <Icon className="h-4 w-4 text-gold" />
          </span>
          <div>
            <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.15em]">{title}</h2>
            {hint && <p className="mt-1 max-w-2xl text-sm text-gray-400">{hint}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
