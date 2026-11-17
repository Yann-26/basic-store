import { describe, expect, it } from 'vitest'
import { isOwnModelUrl, model3DColor, parseProduct3D } from './model3d'

const SB = 'https://proj.supabase.co'
const url = `${SB}/storage/v1/object/public/models/p1/1700-shoe.glb`

describe('parseProduct3D', () => {
  it('cleans what is stored and keeps sensible bounds', () => {
    const m = parseProduct3D({
      url,
      colors: [{ color: 'Noir', variant: 'midnight' }, { color: 'Or', tint: '#D4AF37' }, { color: 'Rouge', tint: 'red' }, { color: '' }],
      hotspots: [{ title: 'Couture', text: 'Main', position: [0, 1, 'x'], normal: [0, 0, 1] }, { title: '' }],
      view: { azimuth: 400, polar: 0 },
      exposure: 9,
      tint_materials: ['Leather', 3],
    })
    expect(m).toMatchObject({
      enabled: true,
      colors: [{ color: 'Noir', variant: 'midnight', tint: null, swatch: null }, { color: 'Or', variant: null, tint: '#d4af37', swatch: null }],
      hotspots: [{ id: 'h0', title: 'Couture', position: [0, 1, 0] }],
      view: { azimuth: 180, polar: 10 },
      exposure: 2,
      tint_materials: ['Leather'],
    })
  })
  it('refuses anything without an https model', () => {
    expect(parseProduct3D({ url: 'javascript:alert(1)' })).toBeNull()
    expect(parseProduct3D(null)).toBeNull()
  })
  it('finds the look of a colour, whatever its case', () => {
    expect(model3DColor(parseProduct3D({ url, colors: [{ color: 'Noir', variant: 'v' }] })!, ' noir')?.variant).toBe('v')
  })
  it('only accepts files of this product in the models bucket', () => {
    expect(isOwnModelUrl(url, SB, 'p1')).toBe(true)
    expect(isOwnModelUrl(url, SB, 'p2')).toBe(false)
    expect(isOwnModelUrl('https://evil.test/models/p1/x.glb', SB, 'p1')).toBe(false)
    expect(isOwnModelUrl(`${SB}/storage/v1/object/public/models/p1/../p2/x.glb`, SB, 'p1')).toBe(false)
  })
})
