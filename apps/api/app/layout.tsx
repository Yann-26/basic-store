import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Basic Store API',
  description: 'Backend API for Basic Store',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
