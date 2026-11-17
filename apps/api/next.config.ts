import type { NextConfig } from 'next'

// The shop's own Supabase project: the back-office uploads 3D models straight to
// its Storage (signed URL) and the viewer downloads them from there.
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
  } catch {
    return ''
  }
}

// Content-Security-Policy: only our own scripts plus Google reCAPTCHA may run.
// 'wasm-unsafe-eval' lets the 3D model decoders (Draco, meshopt) compile their
// WebAssembly; it does not allow eval() of JavaScript.
// Styles allow 'unsafe-inline' for animation libraries' style attributes; images
// may come from any HTTPS host (Supabase storage, Instagram posts entered by admins).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
  // The Draco decoder runs in a worker created from a blob.
  "worker-src 'self' blob:",
  "frame-src https://www.google.com https://www.recaptcha.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${supabaseOrigin()} https://www.google.com https://www.recaptcha.net`.replace(/\s+/g, ' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  // The shared domain package is published as TypeScript source.
  transpilePackages: ['@trs/shared'],
  poweredByHeader: false,

  // The storefront SPA is bundled into public/ (see scripts/bundle-web.mjs):
  // any non-API path that is not a static file falls back to its index.html.
  // Missing /assets/* stay 404 so stale chunks fail fast (the SPA then reloads).
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: '/:path((?!api/|assets/).*)', destination: '/index.html' }],
    }
  },

  async headers() {
    return [
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      // The app's service worker and manifest must be re-checked on every launch to pick up new deployments.
      { source: '/admin-sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/admin.webmanifest', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Content-Type', value: 'application/manifest+json' }] },
      { source: '/:path*', headers: securityHeaders },
    ]
  },
}

export default nextConfig
