'use client'

import { useEffect, useRef, useState } from 'react'
import { dealPhotoPublicUrl } from '@/lib/dealPhoto'
import { lacdbPhotoPath } from '@/lib/lacdbPhoto'
import type { LacdbDealLink } from '@/lib/lacdbFlag'

export type DealPhotoKind = 'upload' | 'lacdb' | 'none'

/**
 * Uploaded storage photo first. If that file is missing and the deal is linked
 * to a Louisiana Commercial Database listing, use the mirrored listing photo.
 * A failed mirror falls through to the empty state. Nothing here hotlinks.
 */
export function useDealPhoto(dealId: string, deal: LacdbDealLink | null | undefined, cacheBust = 0) {
  const lacdbSrc = lacdbPhotoPath(deal)
  const uploadSrc = dealId ? dealPhotoPublicUrl(dealId, cacheBust || undefined) : ''
  const [kind, setKind] = useState<DealPhotoKind>('upload')

  useEffect(() => {
    setKind('upload')
  }, [dealId, cacheBust])

  const src = kind === 'none' ? '' : kind === 'lacdb' ? (lacdbSrc ?? '') : uploadSrc
  const failedSrc = useRef('')

  useEffect(() => {
    failedSrc.current = ''
  }, [dealId, cacheBust])

  function onError() {
    if (!src || failedSrc.current === src) return
    failedSrc.current = src
    if (kind === 'upload' && lacdbSrc) setKind('lacdb')
    else setKind('none')
  }

  return { src, kind, onError, listingPhoto: kind === 'lacdb' && Boolean(src) }
}
