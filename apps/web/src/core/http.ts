import { RECAPTCHA_HEADER } from '@trs/shared'
import { config } from './config'
import { getRecaptchaToken } from './recaptcha'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let isSignedIn: () => boolean = () => false
let onUnauthorized: (() => void) | null = null

/**
 * Wired by the AuthProvider. The session itself is an HttpOnly cookie that the
 * browser attaches on its own: no token is ever readable from JavaScript.
 */
export function configureAuth(signedIn: () => boolean, unauthorizedHandler: () => void) {
  isSignedIn = signedIn
  onUnauthorized = unauthorizedHandler
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** reCAPTCHA v3 action — a token is generated and sent in a header. */
  captcha?: string
  signal?: AbortSignal
  headers?: Record<string, string>
}

export async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, captcha, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  const signedIn = isSignedIn()
  if (captcha) {
    const captchaToken = await getRecaptchaToken(captcha)
    if (captchaToken) headers[RECAPTCHA_HEADER] = captchaToken
  }

  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${config.apiUrl}${endpoint}`, { method, headers, body: payload, signal, credentials: 'include' })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('Connexion au serveur impossible. Vérifiez votre connexion internet.', 0, 'NETWORK_ERROR')
  }

  if (res.status === 204) return null as T
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    if (res.status === 401 && signedIn) onUnauthorized?.()
    // 413 comes from the host itself (no JSON): the file was over its 4.5 MB limit.
    const fallback = res.status === 413 ? 'Fichier trop lourd pour l’envoi (4 Mo maximum).' : `Erreur ${res.status}`
    throw new ApiError(data?.error || fallback, res.status, data?.code)
  }
  return data as T
}

export const http = {
  get: <T>(endpoint: string, signal?: AbortSignal) => request<T>(endpoint, { signal }),
  post: <T>(endpoint: string, body?: unknown, captcha?: string) => request<T>(endpoint, { method: 'POST', body, captcha }),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  upload: <T>(endpoint: string, form: FormData) => request<T>(endpoint, { method: 'POST', body: form }),
}

export function errorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}
