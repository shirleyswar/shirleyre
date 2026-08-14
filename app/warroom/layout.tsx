import type { Metadata } from 'next'
import '../../assets/fab/fab.css'
import '../../assets/launch/launch.css'

// War Room metadata — overrides root layout icons for /warroom segment.
// PinGate is shared — mark swap applies here too (approved).
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
    apple: [
      { url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
}

export default function WarRoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
