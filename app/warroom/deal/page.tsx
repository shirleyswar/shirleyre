'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function DealRedirectInner() {
  const router = useRouter()
  const sp = useSearchParams()
  useEffect(() => {
    const id = sp.get('id')
    if (id) router.replace('/warroom/deal/' + id)
    else router.replace('/warroom/deals')
  }, [router, sp])
  return null
}

export default function DealRedirect() {
  return (
    <Suspense fallback={null}>
      <DealRedirectInner />
    </Suspense>
  )
}
