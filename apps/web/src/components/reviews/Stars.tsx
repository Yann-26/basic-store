import { HiStar } from 'react-icons/hi2'

/** Five gold stars, filled up to `value` (halves rounded). */
export default function Stars({ value, size = 'h-4 w-4', label = true }: { value: number; size?: string; label?: boolean }) {
  const rounded = Math.round(value * 2) / 2
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? `${value.toLocaleString('fr-FR')} sur 5` : undefined} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`relative ${size}`}>
          <HiStar className={`absolute inset-0 ${size} text-white/15`} />
          <span className="absolute inset-0 overflow-hidden" style={{ width: rounded >= i ? '100%' : rounded >= i - 0.5 ? '50%' : '0%' }}>
            <HiStar className={`${size} text-gold`} />
          </span>
        </span>
      ))}
    </span>
  )
}
