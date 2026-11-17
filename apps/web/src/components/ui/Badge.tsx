import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { BadgeVariant } from '@trs/shared'

const variants: Record<BadgeVariant, string> = {
  new: 'bg-gold text-primary-black',
  bestseller: 'bg-white text-primary-black',
  limited: 'bg-primary-black text-gold border border-gold/50',
  lowstock: 'bg-amber-500 text-white',
  soldout: 'bg-neutral-700 text-white',
  sale: 'bg-red-600 text-white',
}

export default function Badge({ children, variant = 'new', className }: { children: ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={clsx('inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]', variants[variant], className)}>
      {children}
    </span>
  )
}
