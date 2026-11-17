import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { HiArrowPath, HiArrowsPointingOut, HiOutlineCube, HiOutlineMapPin, HiXMark } from 'react-icons/hi2'
import { model3DColor, type Model3DHotspot, type Product3D, type Vec3 } from '@trs/shared'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { ModelScene, type SceneInfo } from './modelScene'

export interface ModelViewerEditor {
  /** Back-office: receives the variants and materials found in the file. */
  onInfo?: (info: SceneInfo) => void
  /** Back-office: when set, a click on the model places a detail point. */
  onPick?: ((point: { position: Vec3; normal: Vec3 }) => void) | null
  /** Back-office: receives the scene once created (current angle…), and null when it goes. */
  onScene?: (scene: ModelScene | null) => void
}

interface Props {
  model: Product3D
  name: string
  /** The piece's colours, in order; those with a look on the model become swatches. */
  colors: string[]
  /** The colour chosen in the buy panel. */
  color: string | null
  /** A swatch was clicked: the buy panel follows. */
  onColorChange?: (color: string) => void
  onFail?: () => void
  editor?: ModelViewerEditor
  className?: string
}

const toolButton = 'flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-[rgba(255,255,255,0.85)] text-[#333] backdrop-blur-md transition-colors hover:border-[#111] hover:text-[#111]'

/**
 * The piece in real-time 3D: turned with a finger or the mouse, zoomed with a
 * pinch or the wheel. Swatches switch the model to each colour of the piece —
 * and the buy panel follows, both ways. Gold points open notes on the details;
 * "Atelier" draws the piece's mesh in gold lines; it can go full screen.
 */
export default function ModelViewer({ model, name, colors, color, onColorChange, onFail, editor, className }: Props) {
  const reduced = usePrefersReducedMotion()
  const frame = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<ModelScene | null>(null)
  const dots = useRef(new Map<string, HTMLButtonElement>())
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)
  const [atelier, setAtelier] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [openSpot, setOpenSpot] = useState<Model3DHotspot | null>(null)

  // The latest props, read by the scene's callbacks without recreating it.
  const hotspots = useRef(model.hotspots)
  const pick = useRef(editor?.onPick ?? null)
  const failed = useRef(onFail)
  const info = useRef(editor?.onInfo)
  const onScene = useRef(editor?.onScene)
  useLayoutEffect(() => {
    hotspots.current = model.hotspots
    pick.current = editor?.onPick ?? null
    failed.current = onFail
    info.current = editor?.onInfo
    onScene.current = editor?.onScene
  })

  // The scene: created once per model file.
  useEffect(() => {
    const el = host.current
    if (!el) return
    let s: ModelScene
    try {
      s = new ModelScene(el, { exposure: model.exposure, autoRotate: !reduced })
    } catch {
      failed.current?.()
      return
    }
    scene.current = s
    onScene.current?.(s)
    let alive = true
    s.onInteract = () => setTouched(true)
    s.onFrame = () => {
      const points = s.project(hotspots.current)
      for (const p of points) {
        const dot = dots.current.get(p.id)
        if (!dot) continue
        dot.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
        dot.style.opacity = p.visible ? '1' : '0'
        dot.style.pointerEvents = p.visible ? 'auto' : 'none'
      }
    }
    s.load(model.url, (r) => alive && setProgress(r))
      .then((found) => {
        if (!alive) return
        info.current?.(found)
        setReady(true)
      })
      .catch(() => alive && failed.current?.())
    return () => {
      alive = false
      scene.current = null
      onScene.current?.(null)
      s.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.url])

  // Settings that change without reloading the file.
  useEffect(() => {
    scene.current?.setExposure(model.exposure)
  }, [model.exposure])
  useEffect(() => {
    if (ready) scene.current?.setFinishes(model.materials)
  }, [ready, model.materials])
  useEffect(() => {
    if (ready && model.view) scene.current?.setView(model.view)
  }, [ready, model.view])
  useEffect(() => {
    scene.current?.setWireframe(atelier)
  }, [atelier, ready])

  // The chosen colour drives the model's look.
  const look = model3DColor(model, color)
  const lookKey = look ? `${look.variant ?? ''}|${look.tint ?? ''}` : ''
  const tintKey = model.tint_materials.join('|')
  useEffect(() => {
    const s = scene.current
    if (!s || !ready) return
    const usesVariants = model.colors.some((c) => c.variant)
    if (usesVariants) void s.setVariant(look?.variant ?? null)
    if (look?.tint || model.colors.some((c) => c.tint)) s.setTint(look?.tint ?? null, model.tint_materials)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lookKey, tintKey])

  const swatches = colors.map((c) => ({ color: c, look: model3DColor(model, c) })).filter((x) => x.look)

  const fullscreen = () => {
    const el = frame.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.().catch(() => undefined)
  }

  const reset = () => {
    const s = scene.current
    if (!s) return
    s.setView(model.view ?? { azimuth: 30, polar: 75 })
    s.setAutoRotate(!reduced)
  }

  return (
    <div
      ref={frame}
      className={clsx(
        'relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#ffffff_0%,#f2f1ee_55%,#e4e2dd_100%)] [&:fullscreen]:rounded-none',
        className,
      )}
    >
      <div
        ref={host}
        role="img"
        aria-label={`${name} en 3D : glissez pour tourner, pincez pour zoomer`}
        className={clsx('absolute inset-0 transition-opacity duration-1000', ready ? 'opacity-100' : 'opacity-0', editor?.onPick && 'cursor-crosshair')}
        onClick={(e) => {
          if (!pick.current) return
          const hit = scene.current?.pick(e.clientX, e.clientY)
          if (hit) pick.current(hit)
        }}
      />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#6b6b6b]">Chargement de la pièce en 3D</span>
          <span className="h-px w-40 overflow-hidden bg-white/10">
            <span className="block h-full bg-gold transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </div>
      )}

      {/* Detail points */}
      {ready && showDetails && (
        <div className="pointer-events-none absolute inset-0">
          {model.hotspots.map((h) => (
            <button
              key={h.id}
              ref={(el) => {
                if (el) dots.current.set(h.id, el)
                else dots.current.delete(h.id)
              }}
              type="button"
              onClick={() => setOpenSpot((o) => (o?.id === h.id ? null : h))}
              className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity duration-300"
              aria-label={h.title}
            >
              <span className="absolute h-7 w-7 animate-ping rounded-full bg-gold/30" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.9)]" />
            </button>
          ))}
        </div>
      )}
      {openSpot && (
        <div className="absolute inset-x-4 top-4 z-10 mx-auto max-w-sm rounded-2xl border border-black/10 bg-[rgba(255,255,255,0.92)] p-4 text-[#111] backdrop-blur-md md:left-auto md:right-20 md:top-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold">{openSpot.title}</p>
            <button type="button" onClick={() => setOpenSpot(null)} aria-label="Fermer" className="text-[#6b6b6b] hover:text-[#111]">
              <HiXMark className="h-4 w-4" />
            </button>
          </div>
          {openSpot.text && <p className="mt-2 text-sm leading-relaxed text-[#333]">{openSpot.text}</p>}
        </div>
      )}

      {/* Tools */}
      {ready && (
        <div className="absolute left-3 top-3 flex flex-col gap-2 md:left-5 md:top-5">
          <button type="button" onClick={reset} className={toolButton} aria-label="Revenir à la vue de départ" title="Vue de départ">
            <HiArrowPath className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setAtelier((v) => !v)} className={clsx(toolButton, atelier && 'border-gold text-gold')} aria-pressed={atelier} aria-label="Mode atelier : la structure de la pièce" title="Atelier">
            <HiOutlineCube className="h-5 w-5" />
          </button>
          {model.hotspots.length > 0 && (
            <button type="button" onClick={() => setShowDetails((v) => !v)} className={clsx(toolButton, showDetails && 'border-gold text-gold')} aria-pressed={showDetails} aria-label="Afficher les détails" title="Détails">
              <HiOutlineMapPin className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={fullscreen} className={toolButton} aria-label="Plein écran" title="Plein écran">
            <HiArrowsPointingOut className="h-5 w-5" />
          </button>
        </div>
      )}

      {ready && !touched && (
        <p className="pointer-events-none absolute inset-x-0 top-5 text-center text-[10px] uppercase tracking-[0.35em] text-[#6b6b6b] md:top-7">← Glissez pour tourner →</p>
      )}
      {atelier && <p className="pointer-events-none absolute right-5 top-5 text-[10px] uppercase tracking-[0.35em] text-gold">Atelier</p>}

      {/* Colours of the piece */}
      {ready && swatches.length > 1 && (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-black/10 bg-[rgba(255,255,255,0.8)] px-4 py-3 backdrop-blur-md md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:px-6">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.3em] text-[#6b6b6b]">
            Couleur <span className="text-[#111]">{color ?? swatches[0]!.color}</span>
          </p>
          <div className="no-scrollbar flex justify-center gap-3 overflow-x-auto" role="radiogroup" aria-label="Couleur de la pièce">
            {swatches.map(({ color: c, look: l }) => {
              const active = (color ?? '').trim().toLowerCase() === c.trim().toLowerCase()
              const fill = l?.swatch || l?.tint
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c}
                  title={c}
                  onClick={() => onColorChange?.(c)}
                  className={clsx('flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 transition-all duration-300', active ? 'scale-110 border-gold shadow-[0_0_18px_rgba(212,175,55,0.45)]' : 'border-transparent hover:border-black/30')}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 text-[11px] font-semibold text-[#fff]"
                    style={{ background: fill ? `radial-gradient(circle at 35% 30%, ${fill}cc, ${fill} 60%, #000 140%)` : 'linear-gradient(135deg,#3a3326,#111)' }}
                  >
                    {fill ? '' : c.charAt(0).toUpperCase()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
