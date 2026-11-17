import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { BadgeVariant } from '@trs/shared'

const variants: Record<BadgeVariant, string> = {
  new: 'bg-gold text-primary-black',
  bestseller: 'bg-[#F6F3EE] text-[#111]',
  limited: 'bg-primary-black text-gold border border-gold/50',
  lowstock: 'bg-amber-600 text-[#fff]',
  soldout: 'bg-[#77726A] text-[#fff]',
  sale: 'bg-red-700 text-[#fff]',
}

export default function Badge({ children, variant = 'new', className }: { children: ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={clsx('inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', variants[variant], className)}>
      {children}
    </span>
  )
}
