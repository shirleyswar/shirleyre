import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono, Montserrat } from 'next/font/google'
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

// Deal header DELETE / EDIT only. The property plates are drawn in a rounded
// geometric sans; Montserrat Medium is the measured match to that letterform.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-montserrat',
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

const WARROOM_BUILD = process.env.NEXT_PUBLIC_WARROOM_BUILD || ''

// Runs from the document itself, not a hashed chunk. A home-screen launch
// that ignored Cache-Control still has this copy of the build id. If
// /warroom-build.txt (no-store) names a newer deploy, replace onto ?v=
// so the shortcut loads that document instead of the stored one.
const buildGuard = `(function(){try{var build=${JSON.stringify(WARROOM_BUILD)};if(!build)return;fetch("/warroom-build.txt",{cache:"no-store"}).then(function(r){return r.ok?r.text():""}).then(function(t){var next=String(t||"").trim();if(!next||next===build)return;var key="wr_build_reload";try{if(sessionStorage.getItem(key)===next)return;sessionStorage.setItem(key,next)}catch(e){}var url=new URL(location.href);url.searchParams.set("v",next.slice(0,12));location.replace(url.toString())}).catch(function(){})}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${montserrat.variable}`}>
      <head>
        {/* Inline tags removed — root layout metadata export handles public-site icons.
            Segment-level metadata in /warroom and /warroom3 layouts override apple-touch-icon
            for the War Room routes. Removing inline tags eliminates the injection-order race. */}
        <meta name="viewport"        content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: buildGuard }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
