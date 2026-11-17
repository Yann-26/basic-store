/** Colour helpers behind "the dashboard controls the look of the shop". */

const HEX = /^#?([0-9a-f]{6})$/i

export function parseHex(value: string): [number, number, number] | null {
  const m = HEX.exec(value.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')

/** `amount` (0–1) of `toward` mixed into `hex`. */
export function mix(hex: string, toward: string, amount: number): string {
  const a = parseHex(hex)
  const b = parseHex(toward)
  if (!a || !b) return hex
  return toHex(a.map((c, i) => c + (b[i]! - c) * amount))
}

/** CSS variables replacing the gold family and the dark surfaces from the two main colours. */
export function themeVariables(primary: string, secondary: string): Record<string, string> {
  const vars: Record<string, string> = {}
  if (parseHex(primary)) {
    vars['--color-gold'] = toHex(parseHex(primary)!)
    vars['--color-gold-light'] = mix(primary, '#ffffff', 0.45)
    vars['--color-gold-pale'] = mix(primary, '#ffffff', 0.88)
    vars['--color-gold-dark'] = mix(primary, '#000000', 0.22)
    vars['--color-gold-deep'] = mix(primary, '#000000', 0.5)
    // Same values for the dark sections of a light storefront.
    for (const k of ['gold', 'gold-light', 'gold-pale', 'gold-dark', 'gold-deep']) vars[`--brand-${k}`] = vars[`--color-${k}`]!
  }
  if (parseHex(secondary)) {
    const base = toHex(parseHex(secondary)!)
    vars['--color-primary-black'] = base
    vars['--color-dark-900'] = base
    vars['--color-dark-800'] = mix(base, '#ffffff', 0.05)
    vars['--color-dark-700'] = mix(base, '#ffffff', 0.09)
    vars['--color-dark-600'] = mix(base, '#ffffff', 0.13)
    vars['--color-dark-500'] = mix(base, '#ffffff', 0.18)
  }
  return vars
}
