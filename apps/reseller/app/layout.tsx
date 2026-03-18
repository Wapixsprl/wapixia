import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WapixIA — Espace Revendeur',
  description: 'Votre site web intelligent géré par IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
