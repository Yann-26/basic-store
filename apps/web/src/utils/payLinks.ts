/** The link a ticket's QR code opens: the balance payment page of the order (sign-in required). */
export const payBalanceUrl = (preorderNumber: string) => `${window.location.origin}/payer/${encodeURIComponent(preorderNumber)}`
