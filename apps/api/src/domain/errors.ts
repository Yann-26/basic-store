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
