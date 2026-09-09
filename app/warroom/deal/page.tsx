'use client'
/**
 * /warroom/deal/?id={uuid} — static client shell for any deal id.
 *
 * Static export cannot prebuild a folder per UUID. generateStaticParams
 * only knew IDs at build time, so a deal created after deploy 404'd on
 * Cloudflare Pages. This page is one HTML file; DealPageClient loads
 * the row from Supabase the same way it always did.
 */
import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DealPageClient from './[id]/DealPageClient'

function resolveDealId(queryId: string | null, pathname: string): string | null {
  if (queryId) return queryId
  const match = pathname.match(/^\/warroom\/deal\/([^/]+)\/?$/)
  const segment = match?.[1]
  if (!segment || segment === 'prospects') return null
  return segment
}

function DealPageInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const pathname = usePathname()
  const id = resolveDealId(sp.get('id'), pathname)

  useEffect(() => {
    if (!id) router.replace('/warroom/deals')
  }, [id, router])

  if (!id) return null
  return <DealPageClient id={id} />
}

export default function DealPage() {
  return (
    <Suspense fallback={
      <div style={{
        background: '#08080C',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: '#8E8CA0',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          Loading…
        </span>
      </div>
    }>
      <DealPageInner />
    </Suspense>
  )
}
