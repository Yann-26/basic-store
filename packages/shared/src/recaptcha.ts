/** reCAPTCHA v3 action names — must match between the web app and the API. */
export const RECAPTCHA_ACTIONS = {
  login: 'login',
  adminLogin: 'admin_login',
  register: 'register',
  checkout: 'checkout',
  contact: 'contact',
  newsletter: 'newsletter',
  dropReminder: 'drop_reminder',
  forgotPassword: 'forgot_password',
} as const

export type RecaptchaAction = (typeof RECAPTCHA_ACTIONS)[keyof typeof RECAPTCHA_ACTIONS]

/** Header used to send the reCAPTCHA token alongside JSON bodies. */
export const RECAPTCHA_HEADER = 'x-recaptcha-token'
