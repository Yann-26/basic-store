import { dropAccess, dropState, earlyAccessAt, resolveEarlyAccessHours, type Drop, type SessionUser } from '@trs/shared'
import type { DropRepository, DropWrite, Mailer, ProductRepository, SettingsRepository } from '../ports'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { dropEarlyAccessEmail, dropOpenEmail } from '../templates/emails'
import { brand } from '../brand'

export interface DropDeps {
  drops: DropRepository
  products: ProductRepository
  mailer: Mailer
  settings: SettingsRepository
  config: { appUrl: string }
}

/** "mercredi 19 novembre à 19 h 00", Abidjan time. */
export const dropDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')

/** Past drops stay on the calendar for a month. */
const KEEP_PAST_DAYS = 30
const BATCH = 100

/** The drop calendar: upcoming releases, "warn me" emails sent when a drop opens. */
export function makeDropUseCases(d: DropDeps) {
  const shopUrl = d.config.appUrl.replace(/\/$/, '')

  async function withProducts(drops: Drop[]): Promise<Drop[]> {
    const ids = [...new Set(drops.flatMap((x) => x.product_ids))]
    const found = ids.length ? await d.products.findManyByIds(ids) : []
    const byId = new Map(found.filter((p) => p.is_active).map((p) => [p.id, p]))
    return drops.map((drop) => ({
      ...drop,
      products: drop.product_ids.flatMap((id) => {
        const p = byId.get(id)
        if (!p) return []
        const image = p.product_media?.find((m) => m.is_main && m.media_type === 'image')?.file_path ?? p.product_media?.find((m) => m.media_type === 'image')?.file_path ?? null
        return [{ id: p.id, name: p.name, slug: p.slug, image, price: p.price }]
      }),
    }))
  }

  return {
    /** Public calendar: published drops from a month ago onwards, with their pieces. */
    async calendar() {
      const from = new Date(Date.now() - KEEP_PAST_DAYS * 86_400_000).toISOString()
      return withProducts(await d.drops.list({ publishedOnly: true, from }))
    },

    /** "Prévenez-moi": one email when the drop opens. */
    async remind(dropId: string, email: string) {
      const drop = await d.drops.findById(dropId)
      if (!drop || !drop.is_published) throw new NotFoundError('Drop introuvable')
      if (dropState(drop.starts_at) !== 'upcoming') throw new ConflictError('Ce drop est déjà ouvert : les pièces vous attendent.')
      const added = await d.drops.addReminder(drop.id, email.trim())
      return { success: true, already: !added }
    },

    /** Where a drop stands for the visitor: closed, early access (and whether they have it), open. */
    async access(dropId: string, user: SessionUser | null) {
      const drop = await d.drops.findById(dropId)
      if (!drop || !drop.is_published) throw new NotFoundError('Drop introuvable')
      const hours = resolveEarlyAccessHours((await d.settings.getAll().catch(() => ({} as Record<string, unknown>))).drop_early_access_hours)
      const early_access_at = earlyAccessAt(drop.starts_at, hours)
      const access = drop.preorders_open !== false ? 'open' : dropAccess(drop.starts_at, hours)
      // Before and during the window, a signed-in visitor learns whether they are on the list (asked before it opened).
      const eligible = access === 'open' ? true : Boolean(user?.email && hours > 0 && (await d.drops.hasEarlyAccess(drop.id, user.email, early_access_at)))
      return { access, eligible, starts_at: drop.starts_at, early_access_at, hours }
    },

    /** Called by the scheduler: early-access emails, then the people waiting for drops that just opened. */
    async processDueReminders() {
      const now = new Date().toISOString()
      const hours = resolveEarlyAccessHours((await d.settings.getAll().catch(() => ({} as Record<string, unknown>))).drop_early_access_hours)
      let early = 0
      for (const { drop, reminders } of await d.drops.dueEarlyAccess(now, hours, BATCH)) {
        const html = dropEarlyAccessEmail({ title: drop.title, imageUrl: drop.image_url, url: `${shopUrl}/drops`, opensToAll: dropDate(drop.starts_at), hours })
        const done: string[] = []
        for (const r of reminders) {
          if (await d.mailer.send({ to: r.email, subject: `Votre accès anticipé est ouvert : ${drop.title} | ${brand().name}`, html })) early++
          done.push(r.id)
        }
        await d.drops.markEarlyNotified(done)
      }

      const due = await d.drops.dueReminders(now, BATCH)
      let sent = 0
      for (const { drop, reminders } of due) {
        const html = dropOpenEmail({ title: drop.title, description: drop.description, imageUrl: drop.image_url, url: `${shopUrl}/drops`, location: drop.location })
        const done: string[] = []
        for (const r of reminders) {
          if (await d.mailer.send({ to: r.email, subject: `${drop.title} est ouvert | ${brand().name}`, html })) sent++
          // Marked even when the provider refused: one attempt, never a loop of retries.
          done.push(r.id)
        }
        await d.drops.markReminded(done)
      }
      return { drops: due.length, sent, early }
    },

    // ---------------------------------------------------------------- admin

    list() {
      return d.drops.list({ publishedOnly: false })
    },

    create(input: DropWrite) {
      return d.drops.create(input)
    },

    async update(id: string, input: Partial<DropWrite>) {
      if (!(await d.drops.findById(id))) throw new NotFoundError('Drop introuvable')
      return d.drops.update(id, input)
    },

    async remove(id: string) {
      if (!(await d.drops.findById(id))) throw new NotFoundError('Drop introuvable')
      await d.drops.delete(id)
    },
  }
}
