import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Model3DMaterial, Model3DView, Vec3 } from '@trs/shared'

const GOLD = new THREE.Color('#D4AF37')
/** The model is scaled so its largest side measures this (scene units). */
const SIZE = 2

export interface SceneInfo {
  /** Material variants found in the GLB (KHR_materials_variants). */
  variants: string[]
  /** Names of the model's materials (for tint and finishes). */
  materials: string[]
}

export interface ScreenPoint {
  id: string
  x: number
  y: number
  visible: boolean
}

type VariantExt = { mappings: { material: number; variants: number[] }[] }
type Meshy = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>

const materialsOf = (m: Meshy): THREE.Material[] => (Array.isArray(m.material) ? m.material : [m.material])

/**
 * The real-time scene behind the 3D viewer: loads a GLB, centres it on a gold
 * ring with a soft shadow, lights it with a studio environment, turns it with
 * the pointer, switches its material variants or tints it, and draws the
 * "Atelier" wireframe. Rendering pauses off screen; dispose() frees it all.
 */
export class ModelScene {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100)
  private readonly controls: OrbitControls
  private readonly root = new THREE.Group()
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private readonly halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private readonly disposables: { dispose: () => void }[] = []
  private gltf: GLTF | null = null
  private wire: THREE.Group | null = null
  private raf = 0
  private visible = true
  private readonly clock = new THREE.Clock()
  private pulse = 0
  private bounce = 0
  private tints: { material: THREE.MeshStandardMaterial; from: THREE.Color; to: THREE.Color }[] = []
  private tintT = 1
  private finishes: Model3DMaterial[] = []
  private readonly io: IntersectionObserver
  private readonly ro: ResizeObserver
  /** Called each frame with the hotspots' screen positions. */
  onFrame: (() => void) | null = null
  /** Called once the visitor first moves the piece. */
  onInteract: (() => void) | null = null

  constructor(private readonly host: HTMLElement, opts: { exposure: number; autoRotate: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = opts.exposure
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none'
    host.appendChild(this.renderer.domElement)

    // Studio light: a soft room for reflections, a key light for the shadow.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    this.scene.environment = env
    this.disposables.push(env, pmrem)
    room.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.())
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2.5, 5, 3)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 6
    key.shadow.camera.left = key.shadow.camera.bottom = -2
    key.shadow.camera.right = key.shadow.camera.top = 2
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.15))

    // The floor: a soft shadow, a fine gold ring and a halo that pulses on a colour change.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.22 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.13, 128), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5 }))
    this.halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.16, 128), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false }))
    for (const m of [this.ring, this.halo]) {
      m.rotation.x = -Math.PI / 2
      m.position.y = 0.002
    }
    this.scene.add(ground, this.ring, this.halo, this.root)
    this.disposables.push(ground.geometry, ground.material, this.ring.geometry, this.ring.material, this.halo.geometry, this.halo.material)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.8
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(15)
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(95)
    this.controls.autoRotate = opts.autoRotate
    this.controls.autoRotateSpeed = 0.8
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false
      this.onInteract?.()
    })

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.io = new IntersectionObserver(([e]) => {
      this.visible = !!e?.isIntersecting
      if (this.visible) this.start()
    })
    this.io.observe(host)
    this.resize()
  }

  async load(url: string, onProgress?: (ratio: number) => void): Promise<SceneInfo> {
    const draco = new DRACOLoader().setDecoderPath('/three/draco/')
    const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
    loader.setCrossOrigin('anonymous')
    try {
      this.gltf = await loader.loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total))
    } finally {
      draco.dispose()
    }
    const model = this.gltf.scene

    // Centre on the ring, standing on the floor, at a fixed size.
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const scale = SIZE / Math.max(size.x, size.y, size.z, 1e-6)
    model.scale.setScalar(scale)
    box.setFromObject(model)
    const centre = box.getCenter(new THREE.Vector3())
    model.position.set(-centre.x, -box.min.y, -centre.z)
    this.root.add(model)

    const names = new Set<string>()
    model.traverse((o) => {
      const mesh = o as Meshy
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      materialsOf(mesh).forEach((m) => m.name && names.add(m.name))
    })

    const height = SIZE * (size.y / Math.max(size.x, size.y, size.z, 1e-6))
    this.controls.target.set(0, height / 2, 0)
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 7
    this.setView({ azimuth: 30, polar: 75 }, 5.4)
    this.start()

    const ext = this.gltf.userData.gltfExtensions?.KHR_materials_variants as { variants?: { name: string }[] } | undefined
    return { variants: (ext?.variants ?? []).map((v) => v.name), materials: [...names] }
  }

  /** Switches the material variant (null: the model's own materials). */
  async setVariant(name: string | null) {
    const gltf = this.gltf
    if (!gltf) return
    const ext = gltf.userData.gltfExtensions?.KHR_materials_variants as { variants?: { name: string }[] } | undefined
    const index = name ? (ext?.variants ?? []).findIndex((v) => v.name === name) : -1
    const jobs: Promise<void>[] = []
    gltf.scene.traverse((o) => {
      const mesh = o as Meshy
      const meshExt = mesh.userData.gltfExtensions?.KHR_materials_variants as VariantExt | undefined
      if (!mesh.isMesh || !meshExt) return
      if (!mesh.userData.originalMaterial) mesh.userData.originalMaterial = mesh.material
      const mapping = index >= 0 ? meshExt.mappings.find((m) => m.variants.includes(index)) : undefined
      if (!mapping) {
        mesh.material = mesh.userData.originalMaterial
        return
      }
      jobs.push(
        gltf.parser.getDependency('material', mapping.material).then((material: THREE.Material) => {
          mesh.material = material
          gltf.parser.assignFinalMaterial(mesh)
        }),
      )
    })
    await Promise.all(jobs)
    this.applyFinishes()
    this.react()
  }

  /** Tints the named materials (all of them when none is named) toward a colour, smoothly. */
  setTint(hex: string | null, only: string[]) {
    const root = this.gltf?.scene
    if (!root) return
    const targets: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      const mesh = o as Meshy
      if (!mesh.isMesh) return
      materialsOf(mesh).forEach((m) => {
        const std = m as THREE.MeshStandardMaterial
        if (!std.isMeshStandardMaterial || (only.length > 0 && !only.includes(m.name))) return
        if (!std.userData.baseColor) std.userData.baseColor = std.color.clone()
        if (!targets.includes(std)) targets.push(std)
      })
    })
    this.tints = targets.map((material) => ({
      material,
      from: material.color.clone(),
      to: hex ? new THREE.Color(hex) : (material.userData.baseColor as THREE.Color).clone(),
    }))
    this.tintT = 0
    this.react()
  }

  /** Roughness and metalness set once in the back-office, per material name. */
  setFinishes(finishes: Model3DMaterial[]) {
    this.finishes = finishes
    this.applyFinishes()
  }

  private applyFinishes() {
    if (!this.gltf || this.finishes.length === 0) return
    this.gltf.scene.traverse((o) => {
      const mesh = o as Meshy
      if (!mesh.isMesh) return
      materialsOf(mesh).forEach((m) => {
        const std = m as THREE.MeshStandardMaterial
        const f = this.finishes.find((x) => x.name === m.name)
        if (!f || !std.isMeshStandardMaterial) return
        std.roughness = f.roughness
        std.metalness = f.metalness
        std.needsUpdate = true
      })
    })
  }

  /** "Atelier": the piece's mesh drawn in fine gold lines over it. */
  setWireframe(on: boolean) {
    if (!this.gltf) return
    if (on && !this.wire) {
      const wire = new THREE.Group()
      const line = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.45, depthTest: true })
      this.disposables.push(line)
      this.root.updateMatrixWorld(true)
      // In the root's space, so the lines follow the piece when it moves.
      const toRoot = this.root.matrixWorld.clone().invert()
      this.gltf.scene.traverse((o) => {
        const mesh = o as Meshy
        if (!mesh.isMesh) return
        const geo = new THREE.WireframeGeometry(mesh.geometry)
        this.disposables.push(geo)
        const seg = new THREE.LineSegments(geo, line)
        seg.matrixAutoUpdate = false
        seg.matrix.multiplyMatrices(toRoot, mesh.matrixWorld)
        wire.add(seg)
      })
      this.wire = wire
      this.root.add(wire)
    }
    if (this.wire) this.wire.visible = on
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on
  }

  setExposure(value: number) {
    this.renderer.toneMappingExposure = value
  }

  /** The current angle, to save as the starting view. */
  getView(): Model3DView {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const s = new THREE.Spherical().setFromVector3(offset)
    return { azimuth: Math.round(THREE.MathUtils.radToDeg(s.theta)), polar: Math.round(THREE.MathUtils.radToDeg(s.phi)) }
  }

  setView(view: Model3DView, distance?: number) {
    const r = distance ?? this.camera.position.distanceTo(this.controls.target)
    const s = new THREE.Spherical(r, THREE.MathUtils.degToRad(view.polar), THREE.MathUtils.degToRad(view.azimuth))
    this.camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(this.controls.target))
    this.controls.update()
  }

  /** Points of the model (in its own space) projected on the screen; hidden when facing away. */
  project(points: { id: string; position: Vec3; normal: Vec3 }[]): ScreenPoint[] {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const camPos = this.camera.position
    return points.map((p) => {
      const world = this.root.localToWorld(new THREE.Vector3(...p.position))
      const normal = new THREE.Vector3(...p.normal).applyQuaternion(this.root.quaternion).normalize()
      const facing = normal.lengthSq() === 0 || normal.dot(camPos.clone().sub(world)) > 0
      const ndc = world.clone().project(this.camera)
      return { id: p.id, x: ((ndc.x + 1) / 2) * w, y: ((1 - ndc.y) / 2) * h, visible: facing && ndc.z < 1 }
    })
  }

  /** The model point under a screen position (back-office: placing a detail point). */
  pick(clientX: number, clientY: number): { position: Vec3; normal: Vec3 } | null {
    if (!this.gltf) return null
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    const hit = ray.intersectObject(this.gltf.scene, true)[0]
    if (!hit) return null
    const local = this.root.worldToLocal(hit.point.clone())
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3()
    const round = (v: number) => Math.round(v * 1000) / 1000
    return { position: [round(local.x), round(local.y), round(local.z)], normal: [round(n.x), round(n.y), round(n.z)] }
  }

  /** A colour change: the gold halo pulses and the piece gives a small lift. */
  private react() {
    this.pulse = 1
    this.bounce = 1
  }

  private resize() {
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Narrow screens step back so the whole piece stays in view.
    this.camera.fov = w / h < 0.8 ? 38 : 30
    this.camera.updateProjectionMatrix()
  }

  private start() {
    if (!this.raf && this.visible) {
      this.clock.getDelta()
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  private tick = () => {
    this.raf = 0
    if (!this.visible || document.hidden) return
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.controls.update()

    if (this.tintT < 1) {
      this.tintT = Math.min(1, this.tintT + dt / 0.6)
      const e = 1 - Math.pow(1 - this.tintT, 3)
      this.tints.forEach((t) => t.material.color.copy(t.from).lerp(t.to, e))
    }
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt / 1.1)
      const p = 1 - this.pulse
      this.halo.material.opacity = Math.sin(p * Math.PI) * 0.35
      this.halo.scale.setScalar(1 + p * 0.18)
    }
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt / 0.7)
      this.root.position.y = Math.sin((1 - this.bounce) * Math.PI) * 0.06
    }
    this.ring.material.opacity = 0.55 + Math.sin(this.clock.elapsedTime * 1.4) * 0.15

    this.renderer.render(this.scene, this.camera)
    this.onFrame?.()
    this.raf = requestAnimationFrame(this.tick)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.io.disconnect()
    this.ro.disconnect()
    this.controls.dispose()
    this.gltf?.scene.traverse((o) => {
      const mesh = o as Meshy
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      materialsOf(mesh).forEach((m) => {
        Object.values(m).forEach((v) => (v as THREE.Texture | null)?.isTexture && (v as THREE.Texture).dispose())
        m.dispose()
      })
    })
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
