import clsx from 'clsx'

export default function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = { sm: 'h-5 w-5 border-2', md: 'h-10 w-10 border-[3px]', lg: 'h-14 w-14 border-4' }[size]
  return <div role="status" aria-label="Chargement" className={clsx('mx-auto animate-spin rounded-full border-gold border-t-transparent', dims, className)} />
}
