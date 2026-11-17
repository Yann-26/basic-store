import clsx from 'clsx'
import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  align?: 'left' | 'center'
  tone?: 'dark' | 'light'
  action?: ReactNode
}

export default function SectionHeading({ eyebrow, title, subtitle, align = 'left', tone = 'dark', action }: Props) {
  return (
    <div className={clsx('mb-10 flex flex-col gap-4 md:mb-14', align === 'center' ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between')}>
      <div className={clsx(align === 'center' && 'max-w-2xl')}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className={clsx('text-3xl font-semibold md:text-5xl', tone === 'light' ? 'text-primary-black' : 'text-white')}>{title}</h2>
        {subtitle && <p className={clsx('mt-4 text-base leading-relaxed', tone === 'light' ? 'text-neutral-600' : 'text-gray-400')}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
