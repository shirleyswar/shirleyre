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
        {/* Inline tags removed — root layout metadata export handles public-site icons.
            Segment-level metadata in /warroom and /warroom3 layouts override apple-touch-icon
            for the War Room routes. Removing inline tags eliminates the injection-order race. */}
        <meta name="viewport"        content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  )
}
