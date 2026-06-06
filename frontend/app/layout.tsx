import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Physical Cursor',
  description: 'Turn dense-city problems into reviewable smart-city hardware briefs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
