import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { HiArrowLeft, HiArrowUpTray, HiCube, HiMapPin, HiTrash, HiCamera, HiSwatch, HiAdjustmentsHorizontal } from 'react-icons/hi2'
import { MAX_HOTSPOTS, MAX_MODEL_BYTES, type Model3DColor, type Model3DMaterial, type Product, type Product3D } from '@trs/shared'
import { productsService } from '../../services/productsService'
import { errorMessage } from '../../core/http'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import ModelViewer from '../../components/three/ModelViewer'
import type { ModelScene, SceneInfo } from '../../components/three/modelScene'
import Section from './marketing/Section'

const blank = (url: string, size: number): Product3D => ({ enabled: true, url, size, colors: [], tint_materials: [], hotspots: [], materials: [], view: null, exposure: 1 })
const mb = (n?: number | null) => (n ? `${(n / 1024 / 1024).toFixed(1)} Mo` : '')

/**
 * Back-office → Produits → 3D: upload the piece's GLB, link each colour of the
 * piece to a look of the model, place the detail points, set the finishes and
 * the starting angle — with the live viewer beside the settings.
 */
export default function Product3D() {
  const { id = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [model, setModel] = useState<Product3D | null>(null)
  const [info, setInfo] = useState<SceneInfo | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [upload, setUpload] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const sceneRef = useRef<ModelScene | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    productsService
      .getById(id)
      .then((p) => {
        setProduct(p)
        setModel(p.model_3d ?? null)
        setColor(p.colors[0] ?? null)
      })
      .catch((e) => toast.error(errorMessage(e, 'Produit introuvable')))
  }, [id])

  const change = (patch: Partial<Product3D>) => {
    setModel((m) => (m ? { ...m, ...patch } : m))
    setDirty(true)
  }

  const save = async (next = model) => {
    if (!next) return
    setSaving(true)
    try {
      const saved = await productsService.saveModel3D(id, next)
      setModel(saved.model_3d ?? null)
      setDirty(false)
      toast.success('Vue 3D enregistrée')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    if (f.size > MAX_MODEL_BYTES) return toast.error('Modèle trop lourd (30 Mo maximum) : compressez-le (meshopt ou Draco, textures WebP).')
    setUpload(0)
    try {
      const url = await productsService.uploadModel3D(id, f, setUpload)
      // A new file keeps the settings that still apply (colours, finishes); points and angle restart.
      const next = model ? { ...model, url, size: f.size, hotspots: [], view: null } : blank(url, f.size)
      setInfo(null)
      await save(next)
    } catch (e) {
      toast.error(errorMessage(e, 'Envoi impossible'))
    } finally {
      setUpload(null)
    }
  }

  const remove = async () => {
    if (!window.confirm('Retirer la vue 3D de cette pièce ? Le fichier sera supprimé.')) return
    try {
      await productsService.removeModel3D(id)
      setModel(null)
      setInfo(null)
      setDirty(false)
      toast.success('Vue 3D retirée')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onInfo = useCallback((found: SceneInfo) => setInfo(found), [])
  const onScene = useCallback((scene: ModelScene | null) => {
    sceneRef.current = scene
  }, [])

  const setLook = (c: string, patch: Partial<Model3DColor>) => {
    if (!model) return
    const current = model.colors.find((x) => x.color === c) ?? { color: c, variant: null, tint: null, swatch: null }
    const next = { ...current, ...patch }
    const others = model.colors.filter((x) => x.color !== c)
    change({ colors: next.variant || next.tint ? [...others, next] : others })
  }

  const finish = (name: string): Model3DMaterial => model?.materials.find((m) => m.name === name) ?? { name, roughness: 0.5, metalness: 0 }
  const setFinish = (name: string, patch: Partial<Model3DMaterial>) => {
    if (!model) return
    change({ materials: [...model.materials.filter((m) => m.name !== name), { ...finish(name), ...patch }] })
  }

  if (!product) return <Spinner />

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/admin/products" className="mb-3 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
            <HiArrowLeft className="h-4 w-4" /> Produits
          </Link>
          <h1 className="text-3xl font-bold">Vue 3D — {product.name}</h1>
          <p className="mt-1 text-gray-400">Le client fait tourner la pièce et change sa couleur en direct sur la fiche produit.</p>
        </div>
        {model && (
          <div className="flex gap-3">
            <Button variant="ghost" icon={HiTrash} onClick={remove}>
              Retirer
            </Button>
            <Button onClick={() => save()} loading={saving} disabled={!dirty}>
              Enregistrer
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Live preview */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {model ? (
            <ModelViewer
              key={model.url}
              model={model}
              name={product.name}
              colors={product.colors}
              color={color}
              onColorChange={setColor}
              onFail={() => toast.error('Ce modèle ne peut pas être affiché : vérifiez le fichier.')}
              editor={{
                onInfo,
                onScene,
                onPick: placing
                  ? (p) => {
                      change({ hotspots: [...model.hotspots, { id: `h${Date.now()}`, ...p, title: 'Détail', text: '' }] })
                      setPlacing(false)
                    }
                  : null,
              }}
              className="aspect-square w-full rounded-3xl"
            />
          ) : (
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/20 text-gray-400 hover:border-gold hover:text-gold"
            >
              <HiCube className="h-12 w-12" />
              <span className="text-sm">Envoyer le modèle 3D (.glb, 30 Mo max)</span>
            </button>
          )}
          {placing && <p className="text-center text-sm text-gold">Cliquez sur la pièce à l'endroit du détail…</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" icon={HiArrowUpTray} loading={upload !== null} onClick={() => file.current?.click()}>
              {model ? 'Remplacer le fichier' : 'Choisir un fichier .glb'}
            </Button>
            {upload !== null && <span className="text-xs text-gray-400">Envoi… {Math.round(upload * 100)} %</span>}
            {model?.size ? <span className="text-xs text-gray-500">{mb(model.size)}</span> : null}
            <input ref={file} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {!model && (
            <p className="text-xs leading-relaxed text-gray-500">
              Export depuis 3ds Max (ou CLO 3D, Blender) en <strong>GLB</strong>, matériaux en PBR (couleur, rugosité, métal, relief). Les variantes de couleur se placent dans le même fichier (extension
              KHR_materials_variants). Compressez avec gltf-transform ou gltfpack (meshopt ou Draco, textures WebP 2048 px).
            </p>
          )}
        </div>

        {model && (
          <div className="space-y-6">
            <Section icon={HiCube} title="Affichage">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={model.enabled} onChange={(e) => change({ enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />
                Afficher la vue 3D sur la fiche produit
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Luminosité · {model.exposure.toFixed(2)}</span>
                <input type="range" min={0.5} max={2} step={0.05} value={model.exposure} onChange={(e) => change({ exposure: Number(e.target.value) })} className="w-full accent-[var(--color-gold)]" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  icon={HiCamera}
                  onClick={() => {
                    const view = sceneRef.current?.getView()
                    if (view) change({ view })
                  }}
                >
                  Utiliser l'angle actuel au départ
                </Button>
                {model.view && <span className="text-xs text-gray-500">{`${model.view.azimuth}° / ${model.view.polar}°`}</span>}
              </div>
            </Section>

            <Section icon={HiSwatch} title="Couleurs" hint="Pour chaque couleur de la pièce : une variante du fichier (le vrai cuir, le vrai tissu), ou une teinte appliquée aux matières choisies.">
              {product.colors.length === 0 ? (
                <p className="text-sm text-gray-500">Cette pièce n'a pas de couleurs : ajoutez-les dans sa fiche pour les relier au modèle.</p>
              ) : (
                <ul className="space-y-3">
                  {product.colors.map((c) => {
                    const look = model.colors.find((x) => x.color === c)
                    return (
                      <li key={c} className={clsx('rounded-2xl border p-4', color === c ? 'border-gold/50' : 'border-white/10')}>
                        <div className="flex flex-wrap items-center gap-3">
                          <button type="button" onClick={() => setColor(c)} className="min-w-24 text-left text-sm font-medium hover:text-gold">
                            {c}
                          </button>
                          {(info?.variants.length ?? 0) > 0 && (
                            <select className="field max-w-48" value={look?.variant ?? ''} onChange={(e) => setLook(c, { variant: e.target.value || null, tint: null })} aria-label={`Variante pour ${c}`}>
                              <option value="">— Variante —</option>
                              {info!.variants.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          )}
                          <label className="flex items-center gap-2 text-xs text-gray-400">
                            Teinte
                            <input type="color" value={look?.tint ?? '#d4af37'} onChange={(e) => setLook(c, { tint: e.target.value, variant: null })} className="h-8 w-10 rounded" />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-400">
                            Pastille
                            <input type="color" value={look?.swatch ?? look?.tint ?? '#888888'} onChange={(e) => setLook(c, { swatch: e.target.value })} className="h-8 w-10 rounded" />
                          </label>
                          {look && (
                            <button type="button" onClick={() => change({ colors: model.colors.filter((x) => x.color !== c) })} className="text-xs text-gray-500 hover:text-red-400">
                              Délier
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {model.colors.some((c) => c.tint) && (info?.materials.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.15em] text-gray-400">Matières teintées (aucune cochée : toutes)</p>
                  <div className="flex flex-wrap gap-2">
                    {info!.materials.map((m) => {
                      const on = model.tint_materials.includes(m)
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => change({ tint_materials: on ? model.tint_materials.filter((x) => x !== m) : [...model.tint_materials, m] })}
                          className={clsx('rounded-full px-3 py-1.5 text-xs', on ? 'bg-gold text-primary-black' : 'border border-white/15 text-gray-300')}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </Section>

            <Section icon={HiMapPin} title="Détails" hint="Des points dorés sur la pièce ; le client les touche pour lire la note (couture, fermoir, logo…).">
              <ul className="space-y-3">
                {model.hotspots.map((h, i) => (
                  <li key={h.id} className="space-y-2 rounded-2xl border border-white/10 p-4">
                    <div className="flex gap-2">
                      <input
                        className="field"
                        value={h.title}
                        maxLength={60}
                        onChange={(e) => change({ hotspots: model.hotspots.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })}
                        aria-label="Titre du détail"
                      />
                      <button type="button" onClick={() => change({ hotspots: model.hotspots.filter((_, k) => k !== i) })} className="rounded-xl px-3 text-gray-500 hover:text-red-400" aria-label="Supprimer le détail">
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      className="field min-h-16"
                      value={h.text}
                      maxLength={300}
                      onChange={(e) => change({ hotspots: model.hotspots.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })}
                      placeholder="Ex. Coutures sellier faites à la main, fil ciré."
                      aria-label="Note du détail"
                    />
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="outline" icon={HiMapPin} onClick={() => setPlacing((v) => !v)} disabled={model.hotspots.length >= MAX_HOTSPOTS}>
                {placing ? 'Annuler' : 'Placer un détail sur la pièce'}
              </Button>
            </Section>

            {(info?.materials.length ?? 0) > 0 && (
              <Section icon={HiAdjustmentsHorizontal} title="Finitions" hint="Réglez une fois l'aspect de chaque matière : le client voit le résultat, sans réglage à faire.">
                <ul className="space-y-4">
                  {info!.materials.map((name) => {
                    const f = finish(name)
                    const set = model.materials.some((m) => m.name === name)
                    return (
                      <li key={name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{name}</span>
                          {set && (
                            <button type="button" onClick={() => change({ materials: model.materials.filter((m) => m.name !== name) })} className="text-xs text-gray-500 hover:text-white">
                              Valeurs du fichier
                            </button>
                          )}
                        </div>
                        {(['roughness', 'metalness'] as const).map((k) => (
                          <label key={k} className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="w-24 uppercase tracking-[0.15em]">{k === 'roughness' ? 'Mat' : 'Métal'}</span>
                            <input type="range" min={0} max={1} step={0.01} value={f[k]} onChange={(e) => setFinish(name, { [k]: Number(e.target.value) })} className="flex-1 accent-[var(--color-gold)]" />
                            <span className="w-10 text-right tabular-nums">{Math.round(f[k] * 100)} %</span>
                          </label>
                        ))}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
