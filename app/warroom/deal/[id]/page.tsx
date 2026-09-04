/**
 * /warroom/deal/[id] — Server shell for static export.
 * generateStaticParams fetches IDs at build time.
 * All UI is in DealPageClient (client component).
 */

// ── generateStaticParams ──────────────────────────────────────────────────────
export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const res = await fetch(
      'https://mtkyyaorvensylrfbhxv.supabase.co/rest/v1/deals?select=id',
      {
        headers: {
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA',
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA',
        },
      }
    )
    if (!res.ok) return [{ id: '_placeholder' }]
    const rows = await res.json() as { id: string }[]
    if (!rows || rows.length === 0) return [{ id: '_placeholder' }]
    return rows.map(r => ({ id: r.id }))
  } catch {
    return [{ id: '_placeholder' }]
  }
}

import DealPageClient from './DealPageClient'

export default function DealPage({ params }: { params: { id: string } }) {
  return <DealPageClient id={params.id} />
}
