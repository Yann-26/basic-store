import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SCION CARON API',
  description: 'Backend API for SCION CARON',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
