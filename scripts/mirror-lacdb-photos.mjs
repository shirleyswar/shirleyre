#!/usr/bin/env node
/**
 * Copy each LACDB listing's main photo into public/agents/photos/.
 *
 * The deal page serves these same-origin files. It does not hotlink
 * storage.googleapis.com. Re-run after public/agents/listings.json is refreshed:
 *   node scripts/mirror-lacdb-photos.mjs
 *
 * Photo choice matches scripts/lacdb-sync.mjs photoForListing: skip a file
 * whose name carries a different listing's street number.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FEED = resolve(ROOT, 'public/agents/listings.json')
const OUT_DIR = resolve(ROOT, 'public/agents/photos')
const MANIFEST = resolve(OUT_DIR, 'manifest.json')

export function fileNumbers(url) {
  const file = decodeURIComponent(String(url).split('/').pop() || '')
  return file.match(/\d{3,5}/g) || []
}

export function streetNumber(street) {
  const match = String(street || '').match(/\b(\d{3,6})\b/)
  return match ? match[1] : ''
}

/** First usable photo URL, or null when every photo belongs to another street number. */
export function chooseMainPhoto(listing, houseNumbers) {
  const photos = listing?.media?.photos || []
  if (!photos.length) return null
  const number = streetNumber(listing.address?.street || '')
  if (!number) return photos[0]
  const known = houseNumbers || new Set()
  const usable = photos.filter(url => !fileNumbers(url).some(n => known.has(n) && n !== number))
  if (!usable.length) return null
  return usable.find(url => fileNumbers(url).includes(number)) || usable[0]
}

export function listingTid(listing) {
  const raw = listing?.source?.listing_id || ''
  const match = String(raw).match(/[0-9a-f]{8}/i)
  return match ? match[0].toLowerCase() : ''
}

function houseNumberSet(listings) {
  const set = new Set()
  for (const listing of listings) {
    const n = streetNumber(listing.address?.street || '')
    if (n) set.add(n)
  }
  return set
}

function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  if (buf[0] === 0xff && buf[1] === 0xd8) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf.toString('ascii', 0, 3) === 'GIF') return true
  return false
}

function selfTest() {
  const known = new Set(['5229', '5235', '1301'])
  const wrong = chooseMainPhoto({
    address: { street: '5229 Government St' },
    media: { photos: ['https://example.test/5d4a0303/5235-government-st-a.webp'] },
  }, known)
  if (wrong) throw new Error('photo from another street number was kept')
  const hudson = chooseMainPhoto({
    address: { street: '1301 Hudson Ln' },
    media: { photos: [
      'https://example.test/138d8815/1301-hudson-ln-c4f186e6.webp',
      'https://example.test/138d8815/1301-hudson-ln-31a497c1.webp',
    ] },
  }, known)
  if (!hudson || !hudson.includes('1301-hudson-ln-c4f186e6')) {
    throw new Error('Hudson main photo was not the first matching file')
  }
  const noNumber = chooseMainPhoto({
    address: { street: 'Between N 13th and N 14th St' },
    media: { photos: ['https://example.test/only.webp'] },
  }, known)
  if (noNumber !== 'https://example.test/only.webp') throw new Error('numberless listing should keep the first photo')
  console.log('mirror-lacdb-photos self-test ok')
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!looksLikeImage(buf)) throw new Error(`not an image: ${url}`)
  return buf
}

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }
  const feed = JSON.parse(readFileSync(FEED, 'utf8'))
  const listings = feed.listings || []
  const known = houseNumberSet(listings)
  mkdirSync(OUT_DIR, { recursive: true })
  const manifest = {}
  const skipped = []
  for (const listing of listings) {
    const tid = listingTid(listing)
    if (!tid) continue
    const url = chooseMainPhoto(listing, known)
    if (!url) {
      skipped.push(`${tid} no usable photo`)
      continue
    }
    const ext = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || 'webp').toLowerCase()
    const filename = `${tid}.${ext}`
    const dest = resolve(OUT_DIR, filename)
    if (existsSync(dest)) {
      const existing = readFileSync(dest)
      if (looksLikeImage(existing)) {
        manifest[tid] = filename
        continue
      }
    }
    try {
      const buf = await download(url)
      writeFileSync(dest, buf)
      manifest[tid] = filename
      console.log(`wrote ${filename} (${buf.length} bytes)`)
    } catch (err) {
      skipped.push(`${tid} ${err.message}`)
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`manifest ${Object.keys(manifest).length} photos`)
  if (skipped.length) console.log('skipped:\n' + skipped.map(s => `- ${s}`).join('\n'))
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isDirect) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
