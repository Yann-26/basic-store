import crypto from 'node:crypto'
import type { PaymentGateway } from '@/application/ports'
import { ExternalServiceError } from '@/domain/errors'
import { env } from '@/config/env'

const BASE_URL = 'https://api.paystack.co'

async function paystack<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!env.paystackSecret) throw new ExternalServiceError('Paiement non configuré (PAYSTACK_SECRET_KEY manquant)')
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${env.paystackSecret}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!res.ok || !json.status) {
    throw new ExternalServiceError(`Paystack: ${json.message ?? `HTTP ${res.status}`}`)
  }
  return json.data as T
}

export class PaystackGateway implements PaymentGateway {
  async initialize(params: { email: string; amount: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }) {
    const data = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
      method: 'POST',
      body: {
        email: params.email,
        amount: Math.round(params.amount * 100), // smallest currency unit
        reference: params.reference,
        currency: 'XOF',
        callback_url: params.callbackUrl,
        metadata: params.metadata,
        channels: ['mobile_money', 'card', 'bank_transfer'],
      },
    })
    return { authorizationUrl: data.authorization_url, reference: data.reference }
  }

  async verify(reference: string) {
    const data = await paystack<{ status: string; amount: number; currency?: string; channel?: string; paid_at?: string }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    )
    return {
      status: data.status,
      amount: (Number(data.amount) || 0) / 100,
      currency: data.currency ?? null,
      channel: data.channel ?? null,
      paidAt: data.paid_at ?? null,
    }
  }

  isValidWebhookSignature(rawBody: string, signature: string | null) {
    if (!signature || !env.paystackWebhookSecret) return false
    const expected = crypto.createHmac('sha512', env.paystackWebhookSecret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }
}
