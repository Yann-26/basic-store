import { contactNotificationEmail } from '../templates/emails'
import type { CommunityLook, ContactMessage, ContactRepository, InstagramPost, InstagramRepository, Mailer, ProductRepository } from '../ports'

/** "@Awa.Style" / "instagram.com/awa.style/" → "awa.style". */
export function cleanHandle(handle: string | null | undefined): string | null {
  const h = (handle ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null
}

export function makeEngagementUseCases(d: {
  contact: ContactRepository
  instagram: InstagramRepository
  products: ProductRepository
  mailer: Mailer
  config: { adminEmail?: string }
}) {
  return {
    async sendContactMessage(msg: { name: string; email: string; phone?: string | null; subject: string; message: string }) {
      let stored = true
      try {
        await d.contact.saveMessage(msg)
      } catch (error) {
        // Table may not exist yet (migration not applied): still forward by email.
        console.error('[contact] could not store message', error)
        stored = false
      }
      const emailed = d.config.adminEmail
        ? await d.mailer.send({
            to: d.config.adminEmail,
            subject: `✉️ Contact : ${msg.subject}`,
            html: contactNotificationEmail(msg),
            replyTo: msg.email,
          })
        : false
      if (!stored && !emailed) throw new Error('Contact message could not be delivered')
      return { success: true }
    },

    listMessages(status?: ContactMessage['status']) {
      return d.contact.listMessages({ status })
    },

    updateMessageStatus(id: string, status: ContactMessage['status']) {
      return d.contact.updateMessageStatus(id, status)
    },

    async subscribe(email: string, source = 'website') {
      const result = await d.contact.subscribe(email.toLowerCase(), source)
      return { success: true, alreadySubscribed: result === 'exists' }
    },

    /** Published community looks, with the pieces worn (active products only). */
    async instagramFeed(limit = 9): Promise<CommunityLook[]> {
      const posts = await d.instagram.list({ publishedOnly: true, limit })
      const ids = [...new Set(posts.flatMap((p) => p.product_ids ?? []))]
      const found = ids.length ? await d.products.findManyByIds(ids) : []
      const byId = new Map(found.filter((p) => p.is_active).map((p) => [p.id, p]))
      return posts.map((post) => ({
        ...post,
        products: (post.product_ids ?? []).flatMap((id) => {
          const p = byId.get(id)
          if (!p) return []
          const image = p.product_media?.find((m) => m.media_type === 'image')?.file_path ?? null
          return [{ id: p.id, name: p.name, slug: p.slug, image }]
        }),
      }))
    },

    instagramPosts() {
      return d.instagram.list({ publishedOnly: false })
    },

    createInstagramPost(input: Partial<Omit<InstagramPost, 'id'>>) {
      return d.instagram.create({
        image_url: input.image_url ?? null,
        caption: input.caption ?? '',
        embed_code: input.embed_code ?? null,
        post_url: input.post_url ?? null,
        permalink: input.permalink ?? input.post_url ?? null,
        post_id: input.post_id ?? null,
        media_type: input.media_type ?? 'image',
        likes: input.likes ?? 0,
        comments: input.comments ?? 0,
        is_published: input.is_published ?? true,
        posted_at: new Date().toISOString(),
        customer_name: input.customer_name || null,
        customer_handle: cleanHandle(input.customer_handle),
        customer_city: input.customer_city || null,
        quote: input.quote || null,
        product_ids: [...new Set(input.product_ids ?? [])],
        sort_order: input.sort_order ?? 0,
      })
    },

    updateInstagramPost(id: string, patch: Partial<Omit<InstagramPost, 'id'>>) {
      const data = { ...patch }
      if ('customer_handle' in patch) data.customer_handle = cleanHandle(patch.customer_handle)
      if (patch.product_ids) data.product_ids = [...new Set(patch.product_ids)]
      if ('post_url' in patch && !('permalink' in patch)) data.permalink = patch.post_url || null
      return d.instagram.update(id, data)
    },

    deleteInstagramPost(id: string) {
      return d.instagram.delete(id)
    },
  }
}
