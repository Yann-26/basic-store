import { useState } from 'react'
import toast from 'react-hot-toast'
import { HiPhoto } from 'react-icons/hi2'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'
import Spinner from '../../components/ui/Spinner'

interface Props {
  label: string
  value: string
  onChange: (url: string) => void
  hint?: string
  square?: boolean
  folder?: 'hero' | 'settings'
}

/** One image uploaded from the back-office; the stored value is its public URL. */
export default function ImageUpload({ label, value, onChange, hint, square, folder = 'settings' }: Props) {
  const [busy, setBusy] = useState(false)

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const { url } = await productsService.uploadFile(file, folder)
      onChange(url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-300">{label}</p>
      <label className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-dark-700 hover:border-gold ${square ? 'aspect-square max-w-[9rem]' : 'aspect-video'}`}>
        {busy ? (
          <Spinner size="sm" />
        ) : value ? (
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs text-gray-500">
            <HiPhoto className="h-7 w-7" /> Téléverser
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      </label>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
      {value && (
        <button type="button" onClick={() => onChange('')} className="mt-1 text-xs text-gray-500 hover:text-red-400">
          Retirer
        </button>
      )}
    </div>
  )
}
