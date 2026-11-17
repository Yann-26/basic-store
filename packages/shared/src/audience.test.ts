import { describe, expect, it } from 'vitest'
import { WHATSAPP_LINKS, whatsappLinkLabel } from './audience'

describe('WhatsApp links', () => {
  it('labels each link type, including common spellings', () => {
    expect(whatsappLinkLabel('status')).toBe('Statut')
    expect(whatsappLinkLabel('Statut')).toBe('Statut')
    expect(whatsappLinkLabel('message')).toBe('Discussion')
    expect(whatsappLinkLabel('chat')).toBe('Discussion')
    expect(whatsappLinkLabel('group')).toBe('Groupe')
    expect(whatsappLinkLabel('groupe')).toBe('Groupe')
    expect(whatsappLinkLabel('')).toBe('Lien général')
    expect(whatsappLinkLabel('flyer')).toBe('flyer')
  })

  it('offers exactly status, discussion and group', () => {
    expect(WHATSAPP_LINKS.map((l) => whatsappLinkLabel(l.medium))).toEqual(['Statut', 'Discussion', 'Groupe'])
  })
})
