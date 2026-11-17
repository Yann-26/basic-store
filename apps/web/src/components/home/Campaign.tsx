import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { HiArrowRight } from 'react-icons/hi2'

export interface CampaignTile {
  key: string
  image: string
  /** Picture used on phones, when it differs. */
  mobileImage?: string
  title: string
  to: string
  cta: string
}

/** The line under a campaign picture: its call to action and an arrow. */
export function LinkBar({ to, label, className }: { to: string; label: string; className?: string }) {
  return (
    <Link to={to} className={clsx('link-bar', className)}>
      {label}
      <HiArrowRight className="h-4 w-4 flex-none" aria-hidden />
    </Link>
  )
}

function Picture({ tile, eager, onShape }: { tile: CampaignTile; eager?: boolean; onShape?: (wide: boolean) => void }) {
  return (
    <picture className="absolute inset-0 block">
      {tile.mobileImage && <source media="(max-width: 767px)" srcSet={tile.mobileImage} />}
      <img
        src={tile.image}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onLoad={onShape && ((e) => onShape(e.currentTarget.naturalWidth >= e.currentTarget.naturalHeight * 1.2))}
        className="h-full w-full object-cover"
      />
    </picture>
  )
}

/**
 * One campaign across the full width: the picture, its title set large at the
 * bottom left, and the call to action on a plain line underneath. On a
 * computer, an upright picture (a product photo) sits on the right half and
 * the title on a plain panel beside it, so it is never cropped to a strip.
 */
export function CampaignFull({ tile, eyebrow, children }: { tile: CampaignTile; eyebrow?: string; children?: ReactNode }) {
  const [wide, setWide] = useState(true)
  const text = (
    <>
      {eyebrow && <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em]">{eyebrow}</p>}
      <h1 className="campaign-title max-w-4xl text-5xl sm:text-6xl md:text-8xl">{tile.title}</h1>
      {children}
    </>
  )
  return (
    <section aria-label={tile.title}>
      <Link to={tile.to} className={clsx('relative block h-[calc(100svh-7.5rem)] min-h-[26rem] overflow-hidden bg-dark-700', !wide && 'md:grid md:grid-cols-2 md:bg-dark-800')}>
        <div className={clsx('absolute inset-0', !wide && 'md:relative md:order-2')}>
          <Picture tile={tile} eager onShape={setWide} />
        </div>
        <div aria-hidden className={clsx('absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent', !wide && 'md:hidden')} />
        <div className={clsx('absolute inset-x-0 bottom-0 px-4 pb-6 text-[#fff] sm:px-6 md:pb-10 lg:px-8', !wide && 'md:relative md:flex md:flex-col md:justify-end md:text-white')}>{text}</div>
      </Link>
      <LinkBar to={tile.to} label={tile.cta} className="px-4 sm:px-6 lg:px-8" />
    </section>
  )
}

/** Two campaigns side by side (one above the other on a phone). */
export function CampaignPair({ tiles }: { tiles: [CampaignTile, CampaignTile] }) {
  return (
    <section aria-label="À la une" className="grid md:grid-cols-2">
      {tiles.map((t) => (
        <div key={t.key}>
          <Link to={t.to} className="relative block aspect-[4/5] overflow-hidden bg-dark-700 md:aspect-[5/6]">
            <Picture tile={t} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <h2 className="campaign-title absolute bottom-6 left-4 right-4 text-4xl text-[#fff] sm:left-6 md:bottom-10 md:text-6xl">{t.title}</h2>
          </Link>
          <LinkBar to={t.to} label={t.cta} className="px-4 sm:px-6" />
        </div>
      ))}
    </section>
  )
}

/** Smaller pairs, centred on the page: the "edits" by category. */
export function EditPair({ tiles }: { tiles: CampaignTile[] }) {
  return (
    <section aria-label="Les sélections" className="mx-auto grid max-w-3xl gap-x-3 gap-y-10 px-4 py-16 sm:grid-cols-2 sm:px-6 md:py-24">
      {tiles.map((t) => (
        <div key={t.key}>
          <Link to={t.to} className="relative block aspect-[3/4] overflow-hidden bg-dark-700">
            <Picture tile={t} />
            <h2 className="campaign-title absolute left-4 top-4 right-4 text-4xl text-[#fff] [text-shadow:0_1px_18px_rgba(0,0,0,.25)] md:text-5xl">{t.title}</h2>
          </Link>
          <LinkBar to={t.to} label={t.cta} />
        </div>
      ))}
    </section>
  )
}
