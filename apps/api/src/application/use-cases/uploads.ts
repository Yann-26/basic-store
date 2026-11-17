import { randomUUID } from 'node:crypto'
import { sameColor } from '@trs/shared'
import type { FileStorage, ProductRepository } from '../ports'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { detectFileType } from '@/infrastructure/security/file-type'

export const UPLOAD_FOLDERS = ['products', 'avatars', 'hero', 'settings', 'reviews'] as const
/** Customers' review photos: images only, smaller. */
const MAX_REVIEW_PHOTO = 5 * 1024 * 1024
const MAX_IMAGE = 10 * 1024 * 1024
const MAX_VIDEO = 100 * 1024 * 1024

export function makeUploadUseCases(d: { storage: FileStorage; products: ProductRepository }) {
  return {
    async upload(input: { file: File; folder: string; productId?: string | null; isMain?: boolean; color?: string | null }) {
      const { file, folder, productId } = input
      if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) throw new ValidationError('Dossier invalide')
      if (file.size > MAX_VIDEO) throw new ValidationError('Fichier trop lourd (max 100 Mo)')
      // The real type comes from the file's content, never from its name or the browser.
      const bytes = new Uint8Array(await file.arrayBuffer())
      const detected = detectFileType(bytes)
      if (!detected) throw new ValidationError('Format non supporté : JPEG, PNG, WebP, AVIF, MP4, MOV ou WebM uniquement')
      const isVideo = detected.kind === 'video'
      const isImage = !isVideo
      if (folder === 'reviews' && (isVideo || file.size > MAX_REVIEW_PHOTO)) throw new ValidationError('Photo uniquement (JPEG, PNG, WebP), 5 Mo maximum')
      if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) throw new ValidationError(`Fichier trop lourd (max ${isVideo ? '100' : '10'} Mo)`)

      const product = productId ? await d.products.findByIdOrSlug(productId, { includeInactive: true }) : null
      if (productId && !product) throw new NotFoundError('Produit introuvable')
      // Stored with the product's own spelling; an unknown colour is ignored (shared photo).
      const color = input.color ? (product?.colors.find((c) => sameColor(c, input.color)) ?? null) : null

      const name = `${Date.now()}-${randomUUID()}.${detected.ext}`
      const path = product ? `${product.id}/${name}` : name
      const url = await d.storage.upload(folder, path, bytes, detected.mime)

      let mediaId: string | undefined
      if (product) {
        const existing = await d.products.listMedia(product.id)
        const hasMain = existing.some((m) => m.is_main)
        const media = await d.products.addMedia({
          product_id: product.id,
          file_path: url,
          file_name: file.name.slice(0, 100),
          file_size: file.size,
          mime_type: detected.mime,
          media_type: isVideo ? 'video' : 'image',
          is_main: isImage && (input.isMain || !hasMain),
          sort_order: existing.length,
          color,
        })
        mediaId = media.id
        if (isImage && input.isMain && hasMain) await d.products.setMainMedia(product.id, media.id)
      }

      return { url, mediaId, fileName: file.name, size: file.size, type: detected.mime }
    },
  }
}
