import type { NewsletterBlock, NewsletterBlockType, NewsletterStatus } from '@trs/shared'

export const STATUS_TONE: Record<NewsletterStatus, string> = {
  draft: 'bg-white/10 text-gray-300',
  scheduled: 'bg-blue-500/15 text-blue-300',
  sending: 'bg-amber-500/15 text-amber-300',
  sent: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-white/5 text-gray-500',
  failed: 'bg-red-500/15 text-red-300',
}

let seq = 0
export const blockId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

/** A fresh block of each type, as added from the editor's palette. */
export function newBlock(type: NewsletterBlockType): NewsletterBlock {
  const id = blockId()
  switch (type) {
    case 'heading':
      return { id, type, text: 'Nouveautés de la saison' }
    case 'text':
      return { id, type, text: 'Bonjour {{prenom}},\n\nDécouvrez les dernières pièces arrivées dans la boutique.' }
    case 'image':
      return { id, type, url: '', alt: '', link: '' }
    case 'video':
      return { id, type, url: '', thumbnail: '', caption: '' }
    case 'button':
      return { id, type, label: 'Découvrir la boutique', url: '/collection' }
    case 'products':
      return { id, type, title: 'Nos coups de cœur', productIds: [] }
    case 'recommendations':
      return { id, type, title: 'Sélectionné pour vous' }
    case 'divider':
      return { id, type }
  }
}

/** A ready-made "Pour vous" campaign built on each customer's last purchases. */
export function recommendationTemplate(): NewsletterBlock[] {
  return [
    { id: blockId(), type: 'heading', text: 'Rien que pour vous, {{prenom}}' },
    { id: blockId(), type: 'text', text: 'D’après vos derniers achats, nous avons sélectionné ces pièces qui devraient vous plaire.' },
    { id: blockId(), type: 'recommendations', title: 'Sélectionné pour vous' },
    { id: blockId(), type: 'button', label: 'Voir toute la boutique', url: '/collection' },
  ]
}
