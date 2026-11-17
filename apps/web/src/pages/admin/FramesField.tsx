import { useState } from 'react'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiArrowRight, HiPhoto, HiXMark } from 'react-icons/hi2'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'

interface Props {
  frames: string[]
  onChange: (frames: string[]) => void
  folder?: 'hero' | 'products'
}

/**
 * The photos shot around a piece on a turntable. Added all at once (sorted by
 * file name), reordered or removed one by one; the storefront steps through
 * them as the visitor turns the piece.
 */
export default function FramesField({ frames, onChange, folder = 'hero' }: Props) {
  const [uploading, setUploading] = useState(0)

  const add = async (files: FileList) => {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    setUploading(sorted.length)
    const urls: string[] = []
    for (const file of sorted) {
      try {
        urls.push((await productsService.uploadFile(file, folder)).url)
      } catch (e) {
        toast.error(`${file.name} : ${errorMessage(e)}`)
      }
      setUploading((n) => n - 1)
    }
    onChange([...frames, ...urls])
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...frames]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">Photos pour tourner la pièce ({frames.length})</p>
      <p className="mb-3 text-xs text-gray-500">
        Posez la pièce sur un plateau tournant et prenez une photo tous les 10 à 15° (24 à 36 photos pour un tour complet), même cadrage, même lumière. Ajoutez-les toutes d'un coup : elles sont classées par nom de fichier. Avec moins de 2 photos, la rotation est désactivée.
      </p>
      <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold hover:bg-gold hover:text-primary-black">
        <HiPhoto className="h-4 w-4" /> {uploading > 0 ? `Envoi… (${uploading} restantes)` : 'Ajouter des photos'}
        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading > 0} onChange={(e) => e.target.files && void add(e.target.files)} />
      </label>
      {frames.length > 0 && (
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {frames.map((src, i) => (
            <li key={src + i} className="group relative aspect-square overflow-hidden rounded-lg bg-dark-700">
              <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-contain" />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px]">{i + 1}</span>
              <span className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" onClick={() => move(i, -1)} aria-label={`Reculer la photo ${i + 1}`} className="p-1 text-gray-300 hover:text-white"><HiArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(frames.filter((_, k) => k !== i))} aria-label={`Retirer la photo ${i + 1}`} className="p-1 text-gray-300 hover:text-red-400"><HiXMark className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} aria-label={`Avancer la photo ${i + 1}`} className="p-1 text-gray-300 hover:text-white"><HiArrowRight className="h-3.5 w-3.5" /></button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
