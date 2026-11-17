// Copies the storefront build (apps/web/dist) into the API's public/ folder so a
// single Next.js deployment serves both the shop and /api/*.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webDist = resolve(apiDir, '../web/dist')
const publicDir = resolve(apiDir, 'public')

if (!existsSync(resolve(webDist, 'index.html'))) {
  console.error(`[bundle-web] ${webDist}/index.html not found — build the storefront first`)
  process.exit(1)
}

rmSync(publicDir, { recursive: true, force: true })
cpSync(webDist, publicDir, { recursive: true })
console.log(`[bundle-web] copied storefront into ${publicDir}`)
