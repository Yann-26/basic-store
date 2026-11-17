import { ApiError } from './http'

/**
 * The host refuses any request over 4.5 MB (HTTP 413) before it reaches the API. Files are
 * made to fit before they are sent: photos are resized and re-encoded in the browser.
 */
export const MAX_SEND_BYTES = 4_300_000
/** Longest side of a photo once prepared: sharp on a large screen, light to send. */
const MAX_SIDE = 2560
/** Photos lighter than this and not too large are sent untouched. */
const KEEP_BELOW = 1_500_000
const RESIZABLE = /^image\/(jpeg|png|webp)$/

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** A photo resized to MAX_SIDE and re-encoded (WebP, transparency kept), or the original when that is not lighter. */
async function shrinkImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // not decodable here: the API will say what is wrong
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= KEEP_BELOW) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const quality of [0.88, 0.8, 0.7]) {
    let blob = await encode(canvas, 'image/webp', quality)
    // Browsers without a WebP encoder fall back to PNG; JPEG is then the light option (no transparency).
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality)
    if (!blob) return file
    if (blob.size <= MAX_SEND_BYTES || quality === 0.7) {
      if (blob.size >= file.size && file.size <= MAX_SEND_BYTES) return file
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: blob.type, lastModified: Date.now() })
    }
  }
  return file
}

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo`

/** Makes a file fit the host's limit, or explains (in French) why it can't be sent. */
export async function prepareUpload(file: File): Promise<File> {
  const ready = RESIZABLE.test(file.type) ? await shrinkImage(file) : file
  if (ready.size <= MAX_SEND_BYTES) return ready
  if (file.type.startsWith('video/')) {
    throw new ApiError(
      `Vidéo trop lourde (${mb(file.size)}) : 4 Mo maximum à l’envoi. Raccourcissez-la ou compressez-la (720p, par exemple avec HandBrake ou CapCut), ou utilisez une photo.`,
      413,
      'FILE_TOO_LARGE',
    )
  }
  throw new ApiError(`Fichier trop lourd (${mb(file.size)}) : 4 Mo maximum. Exportez-le en JPEG ou WebP plus léger.`, 413, 'FILE_TOO_LARGE')
}
