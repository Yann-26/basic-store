import type { FileStorage } from '@/application/ports'
import { db } from './client'

export class SupabaseFileStorage implements FileStorage {
  async upload(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await db().storage.from(bucket).upload(path, bytes, { cacheControl: '31536000', upsert: false, contentType })
    if (error) throw new Error(`[storage.upload] ${error.message}`)
    return db().storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  async createUploadUrl(bucket: string, path: string) {
    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path)
    if (error || !data) throw new Error(`[storage.createUploadUrl] ${error?.message ?? 'no url'}`)
    return { uploadUrl: data.signedUrl, publicUrl: db().storage.from(bucket).getPublicUrl(path).data.publicUrl }
  }

  async removeByUrls(bucket: string, publicUrls: string[]) {
    const paths = publicUrls.map((u) => storagePathFromUrl(u, bucket)).filter((p): p is string => !!p)
    if (paths.length === 0) return
    const { error } = await db().storage.from(bucket).remove(paths)
    if (error) console.error('[storage.remove]', error.message)
  }
}

/** Extracts the object path from a Supabase public URL (…/object/public/<bucket>/<path>). */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null
}
