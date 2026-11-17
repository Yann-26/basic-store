/**
 * Domain / application errors. The HTTP layer maps them to status codes,
 * so use-cases never deal with HTTP concerns.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Données invalides', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'FORBIDDEN')
  }
}

/** The account must confirm its email address first (the client offers to resend the link). */
export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Confirmez votre adresse email pour continuer') {
    super(message, 403, 'EMAIL_NOT_VERIFIED')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit') {
    super(message, 409, 'CONFLICT')
  }
}

/** Not enough units on hand for a line (checkout or a stock movement). */
export class OutOfStockError extends AppError {
  constructor(
    readonly productName: string,
    readonly size: string | null,
    readonly available: number,
  ) {
    const what = `« ${productName} »${size && size !== 'TU' ? ` (taille ${size})` : ''}`
    super(
      available > 0 ? `Il ne reste que ${available} pièce${available > 1 ? 's' : ''} de ${what}` : `${what} est en rupture de stock`,
      409,
      'OUT_OF_STOCK',
      { productName, size, available },
    )
  }

  /** Reads the error raised by the database functions: OUT_OF_STOCK:<name>:<size>:<available>. */
  static fromDatabase(message: string | undefined): OutOfStockError | null {
    const m = /OUT_OF_STOCK:(.*):([^:]*):(\d+)\s*$/.exec(message ?? '')
    return m ? new OutOfStockError(m[1]!, m[2] || null, Number(m[3])) : null
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Trop de requêtes. Réessayez plus tard.') {
    super(message, 429, 'RATE_LIMITED')
  }
}

export class CaptchaError extends AppError {
  constructor(message = 'Vérification anti-robot échouée. Veuillez réessayer.') {
    super(message, 400, 'CAPTCHA_FAILED')
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'Service externe indisponible', details?: unknown) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details)
  }
}
