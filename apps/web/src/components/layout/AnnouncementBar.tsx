/**
 * The announcement line of Vitrine → Bandeau. Its parts (separated by "·")
 * all show on a computer; a phone keeps the first one so the bar stays on one line.
 */
export default function AnnouncementBar({ text }: { text: string }) {
  const parts = text
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  return (
    <div className="relative z-50 bg-[#111] text-[#F2EEE7]" role="note">
      <p className="container-custom flex h-8 items-center justify-center truncate text-center text-[11px] tracking-[0.04em]">
        <span className="md:hidden">{parts[0]}</span>
        <span className="hidden md:inline">{parts.join('  ·  ')}</span>
      </p>
    </div>
  )
}
