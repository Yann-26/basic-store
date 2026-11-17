export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

/** Ivorian phone numbers: 10 digits, optional +225 prefix. */
export function isValidPhone(phone: string): boolean {
  return /^(\+225)?[0-9]{10}$/.test(phone.replace(/[\s.-]/g, ''))
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s.-]/g, '')
}

export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export interface PasswordCheck {
  ok: boolean
  message?: string
}

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 8) return { ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères' }
  if (password.length > 128) return { ok: false, message: 'Mot de passe trop long' }
  if (!/[A-Za-z]/.test(password)) return { ok: false, message: 'Le mot de passe doit contenir des lettres' }
  if (!/[^A-Za-z]/.test(password)) return { ok: false, message: 'Le mot de passe doit contenir un chiffre ou un caractère spécial' }
  return { ok: true }
}
