import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Manu',
  description: 'Turn dense-city problems into reviewable smart-city hardware briefs',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
