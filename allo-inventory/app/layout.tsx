import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Allo Inventory',
  description: 'Multi-warehouse inventory reservation platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
