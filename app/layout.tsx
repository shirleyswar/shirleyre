import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'ShirleyCRE',
  description: 'ShirleyCRE — Commercial Real Estate',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/warroom-app-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
