import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'

// ─── Spec §3.1 — Space Grotesk (sentence case body) ─────────────────────────
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

// ─── Spec §3.1 — JetBrains Mono (UPPERCASE labels, figures) ─────────────────
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

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
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon"             type="image/x-icon" href="/favicon.ico" />
        <link rel="icon"             type="image/png"    sizes="32x32" href="/favicon.png?v=4" />
        <link rel="apple-touch-icon" sizes="180x180"    href="/apple-touch-icon.png?v=4" />
        <link rel="manifest"         href="/site.webmanifest" />
        <meta name="theme-color"     content="#0D0F14" />
        <meta name="viewport"        content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  )
}
