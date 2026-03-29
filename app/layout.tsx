import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'ShirleyCRE',
  description: 'ShirleyCRE — Commercial Real Estate',
  icons: {
    icon: [
      { url: '/favicon.ico',  sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.png',  sizes: '32x32', type: 'image/png'    },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon"             type="image/x-icon" href="/favicon.ico" />
        <link rel="icon"             type="image/png"    sizes="32x32" href="/favicon.png?v=4" />
        <link rel="apple-touch-icon" sizes="180x180"    href="/apple-touch-icon.png?v=4" />
        <link rel="manifest"         href="/site.webmanifest" />
        <meta name="theme-color"     content="#0D0F14" />
      </head>
      <body>{children}</body>
    </html>
  )
}
