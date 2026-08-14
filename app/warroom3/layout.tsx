import type { Metadata } from 'next'
// Item 7b fix: FAB CSS removed from globals.css (retired code), imported from delivered asset.
import '../../assets/fab/fab.css'
// P3: LAUNCH asset CSS — same family as FAB
import '../../assets/launch/launch.css'

// War Room app-level metadata — overrides root layout icons for this segment.
// Next.js merges metadata: child segment overrides parent for matching keys.
// apple: here replaces root layout's apple-touch-icon.png with the official mark.
// Path: /icons/ — all files live there.
// shirleyre.com (public site) unaffected — uses root layout only.
export const metadata: Metadata = {
  title: 'War Room',
  description: 'ShirleyCRE War Room',
  manifest: '/icons/manifest.webmanifest',
  themeColor: '#08080C',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    // Overrides root layout apple icon — War Room mark replaces gold beacon here
    apple: [
      { url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
}

export default function WarRoom3Layout({ children }: { children: React.ReactNode }) {
  // No raw <head> tags — Next.js metadata handles injection, no duplicate risk.
  return <>{children}</>
}
