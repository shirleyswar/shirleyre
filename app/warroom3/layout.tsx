import type { Metadata } from 'next'

// War Room app-level metadata — icon kit per official mark directive.
// Path: /icons/ — all files live there, all hrefs match.
// shirleyre.com (public site) is unaffected — it uses the root layout only.
export const metadata: Metadata = {
  title: 'War Room',
  description: 'ShirleyCRE War Room',
  manifest: '/icons/manifest.webmanifest',
}

export default function WarRoom3Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Official War Room mark head tags — README wiring block, path /icons/ */}
      {/* These tags override root layout equivalents for this route segment */}
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
        <meta name="theme-color" content="#08080C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      {children}
    </>
  )
}
