import { formatCurrency, type OrderItem } from '@trs/shared'
import { brand } from '../brand'

const gold = () => brand().color
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td align="center" style="padding:24px 0 28px;border-bottom:1px solid ${gold()}">
  <div style="font-size:26px;letter-spacing:6px;font-weight:700;color:${gold()}">${esc(brand().name).toUpperCase()}</div>
  <div style="font-size:11px;letter-spacing:4px;color:#666666;margin-top:8px;text-transform:uppercase">${esc(brand().tagline)}</div>
</td></tr>
<tr><td style="padding:32px 0">${body}</td></tr>
<tr><td align="center" style="padding:24px 0;border-top:1px solid #E5E0D6;color:#777;font-size:12px">
  &copy; ${new Date().getFullYear()} ${esc(brand().name)} &middot; ${esc(brand().address)}
</td></tr>
</table></td></tr></table></body></html>`
}

const card = (inner: string) =>
  `<div style="background:#FFFFFF;border:1px solid #E5E0D6;border-radius:12px;padding:20px;margin:0 0 16px">${inner}</div>`
const h3 = (t: string) => `<h3 style="margin:0 0 12px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${gold()}">${t}</h3>`

const ZONE_LABELS: Record<string, string> = { abidjan: 'Livraison à Abidjan', interior: 'Livraison à l’intérieur du pays', pickup: 'Retrait en boutique' }

export function orderConfirmationEmail(data: {
  orderNumber: string
  customerName: string
  items: Pick<OrderItem, 'product_name' | 'size' | 'color' | 'quantity' | 'product_price'>[]
  subtotal: number
  /** Taken off by a promo or referral code. */
  discount?: number
  promoCode?: string | null
  deliveryFee: number
  total: number
  paymentMethod: 'online' | 'cash_on_delivery'
  zone: string
  city: string
  address: string
  trackingUrl: string
}): string {
  const rows = data.items
    .map(
      (i) => `<tr>
<td style="padding:8px 0;color:#111111;font-size:14px">${esc(i.product_name)}<br><span style="color:#777777;font-size:12px">${[
        i.size && i.size !== 'TU' ? `Taille ${esc(i.size)}` : null,
        i.color ? esc(i.color) : null,
        `×${i.quantity}`,
      ]
        .filter(Boolean)
        .join(' · ')}</span></td>
<td align="right" style="padding:8px 0;color:#111111;font-size:14px;white-space:nowrap">${formatCurrency(i.product_price * i.quantity)}</td></tr>`,
    )
    .join('')
  const pickup = data.zone === 'pickup'
  const next =
    data.paymentMethod === 'online'
      ? 'Votre commande sera confirmée dès réception de votre paiement en ligne.'
      : pickup
        ? 'Nous vous appelons pour confirmer votre commande. Vous payez au retrait en boutique.'
        : 'Nous vous appelons pour confirmer votre commande. Vous payez au livreur, en espèces ou par Mobile Money.'

  return layout(
    `Commande ${data.orderNumber}`,
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.customerName)}</strong>,</p>
<p style="color:#444444;margin:0 0 24px;line-height:1.6">Merci pour votre commande ! Vos articles sont réservés. ${next}</p>
${card(`<div style="text-align:center"><div style="color:#777777;font-size:11px;letter-spacing:3px;text-transform:uppercase">N° de commande</div>
<div style="color:${gold()};font-size:26px;font-weight:700;font-family:monospace;margin-top:6px">${esc(data.orderNumber)}</div></div>`)}
${card(`${h3('Articles')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`)}
${card(`${h3('Paiement')}
<p style="margin:4px 0;color:#444444">Articles : ${formatCurrency(data.subtotal)}</p>
${data.discount ? `<p style="margin:4px 0;color:#444444">Code ${esc(data.promoCode ?? '')} : -${formatCurrency(data.discount)}</p>` : ''}
<p style="margin:4px 0;color:#444444">${esc(ZONE_LABELS[data.zone] ?? 'Livraison')} : ${data.deliveryFee > 0 ? formatCurrency(data.deliveryFee) : 'offerte'}</p>
<p style="margin:8px 0 4px;color:#111111;font-size:16px">Total : <strong>${formatCurrency(data.total)}</strong></p>
<p style="margin:4px 0;color:#444444">${data.paymentMethod === 'online' ? 'Paiement en ligne (Mobile Money ou carte)' : pickup ? 'Paiement au retrait en boutique' : 'Paiement à la livraison'}</p>`)}
${card(`${h3(pickup ? 'Retrait' : 'Livraison')}<p style="margin:0;color:#444444">${pickup ? esc(brand().address) : `${esc(data.address)}, ${esc(data.city)}`}</p>`)}
<div style="text-align:center;margin-top:28px"><a href="${esc(data.trackingUrl)}" style="display:inline-block;background:${gold()};color:#FFFFFF;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 28px;border-radius:999px">Suivre ma commande</a></div>`,
  )
}

export function statusUpdateEmail(data: { preorderNumber: string; customerName: string; statusLabel: string; description: string; trackingUrl: string }) {
  return layout(
    `Mise à jour ${data.preorderNumber}`,
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.customerName)}</strong>,</p>
<p style="color:#444444;line-height:1.6">Votre commande <strong style="color:${gold()}">${esc(data.preorderNumber)}</strong> avance :</p>
${card(`<div style="font-size:20px;font-weight:700;color:${gold()}">${esc(data.statusLabel)}</div><p style="color:#444444;margin:8px 0 0">${esc(data.description)}</p>`)}
<div style="text-align:center;margin-top:24px"><a href="${esc(data.trackingUrl)}" style="display:inline-block;background:${gold()};color:#FFFFFF;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 28px;border-radius:999px">Voir le suivi</a></div>`,
  )
}

export function referralRewardEmail(data: { firstName: string; friendName: string; code: string; amount: number; endsAt: string; shopUrl: string }) {
  return layout(
    'Merci pour votre parrainage',
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.firstName)}</strong>,</p>
<p style="color:#444444;line-height:1.6">${esc(data.friendName)} a reçu sa commande grâce à votre code. Pour vous remercier, voici <strong style="color:${gold()}">${formatCurrency(data.amount)}</strong> à utiliser sur votre prochaine pièce :</p>
${card(`<div style="text-align:center;font-size:26px;font-weight:700;letter-spacing:4px;color:${gold()}">${esc(data.code)}</div><p style="text-align:center;color:#777777;margin:8px 0 0;font-size:13px">Valable jusqu'au ${esc(data.endsAt)}, réservé à votre compte.</p>`)}
<div style="text-align:center;margin-top:24px"><a href="${esc(data.shopUrl)}" style="display:inline-block;background:${gold()};color:#FFFFFF;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 28px;border-radius:999px">Découvrir les pièces</a></div>`,
  )
}

export function reviewInvitationEmail(data: { firstName: string; items: { name: string; url: string }[] }) {
  const links = data.items
    .map((i) => `<p style="margin:10px 0"><a href="${esc(i.url)}" style="color:${gold()};text-decoration:none;font-weight:700">${esc(i.name)} &rarr;</a></p>`)
    .join('')
  return layout(
    'Votre avis compte',
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.firstName)}</strong>,</p>
<p style="color:#444444;line-height:1.6">Votre commande vous a été livrée. Comment trouvez-vous vos pièces ? Une note, quelques mots, et si vous le souhaitez une photo de vous les portant : votre avis guide les prochains clients.</p>
${card(`${h3('Donner mon avis')}${links}`)}`,
  )
}

export function adminNewReviewEmail(data: { productName: string; rating: number; author: string; adminUrl: string }) {
  return layout(
    'Nouvel avis à valider',
    `${card(`${h3('Nouvel avis')}
<p style="margin:4px 0;color:#444444">${esc(data.author)} — ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</p>
<p style="margin:4px 0;color:#444444">${esc(data.productName)}</p>`)}
<div style="text-align:center"><a href="${esc(data.adminUrl)}" style="color:${gold()}">Valider dans le tableau de bord</a></div>`,
  )
}

export function adminNewOrderEmail(data: {
  orderNumber: string
  customerName: string
  phone: string
  total: number
  itemsCount: number
  paymentMethod: 'online' | 'cash_on_delivery'
  zone: string
  adminUrl: string
}) {
  return layout(
    `Nouvelle commande ${data.orderNumber}`,
    `${card(`${h3('Nouvelle commande')}
<p style="margin:4px 0;color:#444444">N° <strong style="color:${gold()}">${esc(data.orderNumber)}</strong></p>
<p style="margin:4px 0;color:#444444">Client : ${esc(data.customerName)} (${esc(data.phone)})</p>
<p style="margin:4px 0;color:#444444">${data.itemsCount} article(s) — ${formatCurrency(data.total)}</p>
<p style="margin:4px 0;color:#444444">${data.paymentMethod === 'online' ? 'Paiement en ligne' : 'Paiement à la livraison'} · ${esc(ZONE_LABELS[data.zone] ?? data.zone)}</p>`)}
<div style="text-align:center"><a href="${esc(data.adminUrl)}" style="color:${gold()}">Ouvrir les commandes</a></div>`,
  )
}

export function contactNotificationEmail(data: { name: string; email: string; phone?: string | null; subject: string; message: string }) {
  return layout(
    `Contact : ${data.subject}`,
    card(`${h3('Nouveau message')}
<p style="margin:4px 0;color:#444444"><strong>${esc(data.name)}</strong> &lt;${esc(data.email)}&gt; ${data.phone ? `· ${esc(data.phone)}` : ''}</p>
<p style="margin:12px 0 4px;color:${gold()}">${esc(data.subject)}</p>
<p style="margin:0;color:#333333;white-space:pre-line;line-height:1.6">${esc(data.message)}</p>`),
  )
}

// --------------------------------------------------------------- account ---
const button = (href: string, label: string) =>
  `<div style="text-align:center;margin-top:28px"><a href="${esc(href)}" style="display:inline-block;background:${gold()};color:#FFFFFF;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 28px;border-radius:999px">${esc(label)}</a></div>`
const hello = (firstName: string) => `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(firstName)}</strong>,</p>`
const text = (t: string) => `<p style="color:#444444;margin:0 0 16px;line-height:1.6">${t}</p>`
const row = (label: string, value: string) => `<p style="margin:4px 0;color:#444444"><span style="color:#777777">${esc(label)} :</span> ${esc(value)}</p>`

/** "Chrome sur Windows" from a user-agent string (best effort). */
export function describeDevice(userAgent?: string | null): string {
  const ua = userAgent ?? ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : null
  if (browser && os) return `${browser} sur ${os}`
  return browser ?? os ?? 'Appareil inconnu'
}

const frenchDate = (d: Date) =>
  d.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'full', timeStyle: 'short' })

export function welcomeEmail(data: { firstName: string; shopUrl: string; verifyUrl?: string }) {
  return layout(
    `Bienvenue chez ${brand().name}`,
    `${hello(data.firstName)}
${text(`Bienvenue chez <strong style="color:${gold()}">${esc(brand().name)}</strong> ! Votre compte est créé.`)}
${
  data.verifyUrl
    ? `${card(`${h3('Dernière étape')}<p style="margin:0;color:#444444;line-height:1.6">Confirmez votre adresse email pour pouvoir passer commande.</p>`)}
${button(data.verifyUrl, 'Confirmer mon email')}
<p style="color:#777;font-size:12px;text-align:center;margin:12px 0 24px">Ce lien est valable 48 heures.</p>`
    : ''
}
${card(`${h3('Ce qui vous attend')}
<p style="margin:4px 0;color:#444444">&bull; Commandez en ligne, payez à la livraison ou en ligne</p>
<p style="margin:4px 0;color:#444444">&bull; Livraison partout en Côte d’Ivoire, ou retrait en boutique à Angré</p>
<p style="margin:4px 0;color:#444444">&bull; Suivez chaque commande jusqu'à la livraison</p>`)}
${button(data.shopUrl, 'Découvrir la boutique')}`,
  )
}

export function loginAlertEmail(data: { firstName: string; at: Date; device: string; ip: string; securityUrl: string; admin?: boolean }) {
  return layout(
    'Nouvelle connexion à votre compte',
    `${hello(data.firstName)}
${text(`Une connexion ${data.admin ? "à l'<strong>espace administration</strong>" : 'à votre compte'} vient d'avoir lieu.`)}
${card(`${h3('Détails')}${row('Date', frenchDate(data.at))}${row('Appareil', data.device)}${row('Adresse IP', data.ip)}`)}
${text("C'est bien vous ? Vous n'avez rien à faire.")}
${text(`<strong style="color:#111111">Ce n'est pas vous ?</strong> Changez votre mot de passe immédiatement : toutes les autres sessions seront déconnectées.`)}
${button(data.securityUrl, 'Sécuriser mon compte')}`,
  )
}

export function passwordChangedEmail(data: { firstName: string; at: Date; contactEmail: string }) {
  return layout(
    'Mot de passe modifié',
    `${hello(data.firstName)}
${text(`Le mot de passe de votre compte a été modifié le <strong style="color:#111111">${esc(frenchDate(data.at))}</strong>. Les autres sessions ouvertes ont été déconnectées.`)}
${text(`Si vous n'êtes pas à l'origine de ce changement, contactez-nous tout de suite : <a href="mailto:${esc(data.contactEmail)}" style="color:${gold()}">${esc(data.contactEmail)}</a>.`)}`,
  )
}

export function accountSuspendedEmail(data: { firstName: string; contactEmail: string }) {
  return layout(
    'Compte suspendu',
    `${hello(data.firstName)}
${card(`<div style="font-size:20px;font-weight:700;color:#F87171">Votre compte a été suspendu</div>
<p style="color:#444444;margin:8px 0 0;line-height:1.6">Vous ne pouvez plus vous connecter à ${esc(brand().name)} pour le moment. Vos commandes en cours restent suivies par notre équipe.</p>`)}
${text(`Pour toute question ou pour contester cette décision, écrivez-nous : <a href="mailto:${esc(data.contactEmail)}" style="color:${gold()}">${esc(data.contactEmail)}</a>.`)}`,
  )
}

export function accountReactivatedEmail(data: { firstName: string; loginUrl: string }) {
  return layout(
    'Compte réactivé',
    `${hello(data.firstName)}
${text(`Bonne nouvelle : votre compte <strong style="color:${gold()}">${esc(brand().name)}</strong> est de nouveau actif. Vous pouvez vous reconnecter.`)}
${button(data.loginUrl, 'Me connecter')}`,
  )
}

export function roleChangedEmail(data: { firstName: string; role: 'admin' | 'customer'; url: string }) {
  const admin = data.role === 'admin'
  return layout(
    admin ? 'Accès administrateur accordé' : 'Accès administrateur retiré',
    `${hello(data.firstName)}
${
  admin
    ? `${text(`Vous êtes désormais <strong style="color:${gold()}">administrateur</strong> de ${esc(brand().name)}.`)}
${text("À votre première connexion à l'espace administration, vous activerez la double authentification avec une application comme Google Authenticator.")}
${button(data.url, "Accéder à l'administration")}`
    : `${text(`Vos droits d'administrateur sur ${esc(brand().name)} ont été retirés. Votre compte client reste actif.`)}`
}`,
  )
}

export function twoFactorResetEmail(data: { firstName: string; adminLoginUrl: string }) {
  return layout(
    'Double authentification réinitialisée',
    `${hello(data.firstName)}
${text("Un administrateur a réinitialisé la double authentification de votre compte (par exemple après la perte de votre téléphone). Vos sessions ont été fermées.")}
${text("À votre prochaine connexion, scannez le nouveau QR code avec votre application d'authentification.")}
${text(`<strong style="color:#111111">Vous n'avez rien demandé ?</strong> Changez votre mot de passe et prévenez le propriétaire du site.`)}
${button(data.adminLoginUrl, 'Me reconnecter')}`,
  )
}

export function verifyEmailEmail(data: { firstName: string; verifyUrl: string }) {
  return layout(
    'Confirmez votre adresse email',
    `${hello(data.firstName)}
${text(`Confirmez votre adresse email pour pouvoir passer commande sur ${esc(brand().name)}.`)}
${button(data.verifyUrl, 'Confirmer mon email')}
<p style="color:#777;font-size:12px;text-align:center;margin-top:16px">Ce lien est valable 48 heures. Vous n'avez rien demandé ? Ignorez cet email.</p>`,
  )
}

export function passwordResetEmail(data: { firstName: string; resetUrl: string }) {
  return layout(
    'Réinitialisation du mot de passe',
    `${hello(data.firstName)}
${text('Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.')}
${button(data.resetUrl, 'Choisir un nouveau mot de passe')}
<p style="color:#777;font-size:12px;text-align:center;margin-top:16px">Ce lien est valable 1 heure et ne fonctionne qu'une fois.</p>
${text(`<strong style="color:#111111">Vous n'avez rien demandé ?</strong> Ignorez cet email : votre mot de passe reste inchangé.`)}`,
  )
}

export function testEmail(data: { firstName: string; provider: string; from: string }) {
  return layout(
    'Email de test',
    `${hello(data.firstName)}
${card(`<div style="font-size:20px;font-weight:700;color:${gold()}">Les emails fonctionnent ✓</div>
<p style="color:#444444;margin:8px 0 0;line-height:1.6">Envoyé via <strong style="color:#111111">${esc(data.provider)}</strong> depuis <strong style="color:#111111">${esc(data.from)}</strong>. Vos clients recevront désormais les emails de bienvenue, de confirmation et de suivi de commande.</p>`)}`,
  )
}

const balanceCard = (data: { total: number; paid: number; outstanding: number }) =>
  card(`${h3('Paiement')}
<p style="margin:4px 0;color:#444444">Total : <strong style="color:#111111">${formatCurrency(data.total)}</strong></p>
<p style="margin:4px 0;color:${gold()}">Déjà payé : <strong>${formatCurrency(data.paid)}</strong> (${data.total > 0 ? Math.min(100, Math.floor((data.paid / data.total) * 100)) : 0} %)</p>
<p style="margin:4px 0;color:#444444">${data.outstanding > 0 ? `Reste à payer : <strong style="color:#111111">${formatCurrency(data.outstanding)}</strong>` : '<strong style="color:#111111">Commande payée à 100 %</strong>'}</p>`)

/** Receipt for every payment received, online or recorded by hand. */
export function paymentReceivedEmail(data: {
  preorderNumber: string
  customerName: string
  amount: number
  methodLabel: string
  total: number
  paid: number
  outstanding: number
  payUrl: string
}) {
  return layout(
    `Paiement reçu — ${data.preorderNumber}`,
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.customerName)}</strong>,</p>
<p style="color:#444444;margin:0 0 24px;line-height:1.6">Nous avons bien reçu votre paiement de <strong style="color:#111111">${formatCurrency(data.amount)}</strong> (${esc(data.methodLabel)}) pour la commande <strong style="color:${gold()};font-family:monospace">${esc(data.preorderNumber)}</strong>. Merci !</p>
${balanceCard(data)}
${data.outstanding > 0 ? button(data.payUrl, 'Payer en ligne') : ''}`,
  )
}

/** Sent by the admin when money is still due. */
export function balanceReminderEmail(data: { preorderNumber: string; customerName: string; total: number; paid: number; outstanding: number; payUrl: string }) {
  return layout(
    `Reste à régler — ${data.preorderNumber}`,
    `<p style="font-size:18px;margin:0 0 8px">Bonjour <strong>${esc(data.customerName)}</strong>,</p>
<p style="color:#444444;margin:0 0 24px;line-height:1.6">Il reste <strong style="color:#111111">${formatCurrency(data.outstanding)}</strong> à régler sur votre commande <strong style="color:${gold()};font-family:monospace">${esc(data.preorderNumber)}</strong>. Vous pouvez payer en ligne (Mobile Money ou carte) depuis votre compte ou avec le bouton ci-dessous, ou au livreur à la livraison.</p>
${balanceCard(data)}
${button(data.payUrl, 'Payer en ligne')}`,
  )
}
