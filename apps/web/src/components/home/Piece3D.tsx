import { lazy, Suspense, useState } from 'react'
import { formatCurrency, type Product } from '@trs/shared'
import { LinkBar } from './Campaign'

const ModelViewer = lazy(() => import('../three/ModelViewer'))

/**
 * The piece in real-time 3D on the home page: turned, zoomed and shown in each
 * of its colours, beside its name and a link to buy it. Hidden when no piece
 * has a 3D model, or when the viewer cannot run on the device.
 */
export default function Piece3D({ product }: { product: Product | null }) {
  const [color, setColor] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const model = product?.model_3d
  if (!product || !model || failed) return null
  const to = color ? `/product/${product.slug}?couleur=${encodeURIComponent(color)}` : `/product/${product.slug}`

  return (
    <section aria-labelledby="piece-3d" className="grid border-y border-white/10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Suspense fallback={<div className="aspect-square w-full bg-dark-800 lg:aspect-auto lg:h-[80svh]" />}>
        <ModelViewer
          model={model}
          name={product.name}
          colors={product.colors}
          color={color ?? product.colors[0] ?? null}
          onColorChange={setColor}
          onFail={() => setFailed(true)}
          className="aspect-square w-full lg:aspect-auto lg:h-[80svh]"
        />
      </Suspense>
      <div className="flex flex-col justify-end px-4 py-10 sm:px-6 lg:px-12 lg:py-14">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">La pièce en 3D</p>
        <h2 id="piece-3d" className="campaign-title mt-4 text-5xl md:text-7xl">
          {product.name}
        </h2>
        <p className="mt-4 text-sm">{formatCurrency(product.price)}</p>
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-gray-400">
          Tournez-la, approchez-vous des finitions et choisissez sa couleur : la pièce change sous vos yeux.
        </p>
        <LinkBar to={to} label="Voir la pièce" className="mt-8 border-t border-white/10" />
      </div>
    </section>
  )
}
