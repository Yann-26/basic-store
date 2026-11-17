import { formatCurrency, videoThumbnail, type NewsletterBlock, type Product } from '@trs/shared'
import { brand } from '../brand'

const gold = () => brand().color
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Only https links, site paths (made absolute) and mailto: — anything else
 * (javascript:, data:, http:…) is dropped. Same rule for image sources (no mailto).
 */
export function safeUrl(raw: string | undefined, appUrl: string, opts: { image?: boolean } = {}): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//')) return `${appUrl.replace(/\/$/, '')}${value}`
  if (!opts.image && /^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export interface NewsletterRenderInput {
  subject: string
  preheader: string
  blocks: NewsletterBlock[]
  /** Products referenced by "products" blocks, by id. */
  products: Map<string, Product>
  /** Personalised picks for this recipient ("recommendations" blocks); empty hides the block. */
  recommendations: Product[]
  firstName: string | null
  appUrl: string
  unsubscribeUrl: string
}

const mainImage = (p: Product) =>
  (p.product_media ?? []).find((m) => m.is_main && m.media_type === 'image')?.file_path ?? (p.product_media ?? []).find((m) => m.media_type === 'image')?.file_path ?? null

/** {{prenom}} → the recipient's first name (or nothing, tidily). */
export function personalize(text: string, firstName: string | null): string {
  const name = firstName?.trim() ?? ''
  return text.replace(/\s*\{\{\s*pr[ée]nom\s*\}\}/gi, name ? ` ${name}` : '').replace(/^\s+/, '')
}

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;color:#D4D4D4;font-size:16px;line-height:1.7">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

function productGrid(title: string | undefined, items: Product[], appUrl: string): string {
  if (items.length === 0) return ''
  const cells = items.map((p) => {
    const href = safeUrl(`/product/${encodeURIComponent(p.slug)}`, appUrl)!
    const img = safeUrl(mainImage(p) ?? undefined, appUrl, { image: true })
    return `<td width="50%" valign="top" style="padding:8px">
  <a href="${esc(href)}" style="text-decoration:none;color:#FFFFFF;display:block">
    ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" width="268" style="display:block;width:100%;max-width:268px;height:auto;border-radius:12px;border:0">` : ''}
    <div style="padding:10px 2px 0;font-size:15px;font-weight:600;line-height:1.3">${esc(p.name)}</div>
    <div style="padding:4px 2px 0;font-size:15px;color:${gold()}">${esc(formatCurrency(p.price))}</div>
  </a>
</td>`
  })
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`)
  return `${title ? `<h2 style="margin:8px 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${gold()}">${esc(title)}</h2>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px 16px">${rows.join('')}</table>`
}

function renderBlock(block: NewsletterBlock, input: NewsletterRenderInput): string {
  const { appUrl } = input
  switch (block.type) {
    case 'heading':
      return `<h1 style="margin:8px 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#FFFFFF;font-weight:600">${esc(personalize(block.text, input.firstName))}</h1>`
    case 'text':
      return paragraphs(personalize(block.text, input.firstName))
    case 'image': {
      const src = safeUrl(block.url, appUrl, { image: true })
      if (!src) return ''
      const img = `<img src="${esc(src)}" alt="${esc(block.alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px">`
      const href = safeUrl(block.link, appUrl)
      return `<div style="margin:0 0 20px">${href ? `<a href="${esc(href)}">${img}</a>` : img}</div>`
    }
    case 'video': {
      // Email clients can't play video: a poster with a play button links to it.
      const href = safeUrl(block.url, appUrl)
      if (!href) return ''
      const poster = safeUrl(videoThumbnail(block) ?? undefined, appUrl, { image: true })
      const visual = poster
        ? `<img src="${esc(poster)}" alt="Lire la vidéo" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px">`
        : `<div style="background:#141414;border:1px solid #2A2A2A;border-radius:14px;padding:60px 0;text-align:center;color:${gold()};font-size:16px">Voir la vidéo</div>`
      return `<div style="margin:0 0 20px"><a href="${esc(href)}" style="text-decoration:none;display:block">${visual}
<div style="text-align:center;margin-top:10px"><span style="display:inline-block;background:${gold()};color:#0A0A0A;border-radius:999px;padding:10px 22px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase">&#9654; Lire la vidéo</span></div></a>
${block.caption ? `<p style="margin:10px 0 0;text-align:center;color:#999;font-size:13px">${esc(block.caption)}</p>` : ''}</div>`
    }
    case 'button': {
      const href = safeUrl(block.url, appUrl)
      if (!href || !block.label.trim()) return ''
      return `<div style="text-align:center;margin:8px 0 24px"><a href="${esc(href)}" style="display:inline-block;background:${gold()};color:#0A0A0A;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;border-radius:999px;padding:15px 34px">${esc(block.label)}</a></div>`
    }
    case 'products':
      return productGrid(block.title, block.productIds.map((id) => input.products.get(id)).filter((p): p is Product => Boolean(p && p.is_active)), appUrl)
    case 'recommendations':
      return productGrid(block.title || 'Sélectionné pour vous', input.recommendations, appUrl)
    case 'divider':
      return `<div style="height:1px;background:#2A2A2A;margin:24px 0"></div>`
  }
}

/** Full campaign email for one recipient. */
export function renderNewsletter(input: NewsletterRenderInput): string {
  const body = input.blocks.map((b) => renderBlock(b, input)).join('\n')
  const shop = safeUrl('/', input.appUrl)!
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${esc(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Helvetica,Arial,sans-serif;color:#FFFFFF">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(input.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td align="center" style="padding:20px 0 24px;border-bottom:1px solid ${gold()}">
  <a href="${esc(shop)}" style="text-decoration:none"><div style="font-size:24px;letter-spacing:6px;font-weight:700;color:${gold()}">&#9733; ${esc(brand().name)}</div></a>
  <div style="font-size:11px;letter-spacing:4px;color:#BBBBBB;margin-top:8px;text-transform:uppercase">${esc(brand().tagline)}</div>
</td></tr>
<tr><td style="padding:28px 0 8px">${body}</td></tr>
<tr><td align="center" style="padding:24px 0;border-top:1px solid #222;color:#777;font-size:12px;line-height:1.7">
  Vous recevez cet email car vous êtes inscrit(e) aux nouveautés ${esc(brand().name)}.<br>
  <a href="${esc(input.unsubscribeUrl)}" style="color:#AAAAAA">Se désinscrire</a> &middot; ${esc(brand().address)}<br>
  &copy; ${new Date().getFullYear()} ${esc(brand().name)}
</td></tr>
</table></td></tr></table></body></html>`
}
