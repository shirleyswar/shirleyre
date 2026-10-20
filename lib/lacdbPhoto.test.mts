import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lacdbPhotoPath } from './lacdbPhoto.ts'
import { lacdbTid } from './lacdbFlag.ts'

const manifest = JSON.parse(readFileSync(new URL('../public/agents/photos/manifest.json', import.meta.url), 'utf8'))
assert.equal(typeof manifest['138d8815'], 'string')
assert.match(manifest['138d8815'], /^138d8815\.webp$/)

const hudson = lacdbPhotoPath({
  deal_source: 'lacdb:138d8815-leased-office-acredit-tenant',
  lacdb_url: null,
})
assert.equal(hudson, '/agents/photos/138d8815.webp')
assert.equal(lacdbTid('https://lacdb.resimplifi.com/listings/138d8815-leased-office'), '138d8815')

assert.equal(lacdbPhotoPath({ deal_source: 'Duty', lacdb_url: null }), null)
assert.equal(lacdbPhotoPath({
  deal_source: null,
  lacdb_url: 'https://lacdb.resimplifi.com/listings/30f8f0a3-048-acres',
}), null)

const bytes = readFileSync(new URL('../public/agents/photos/138d8815.webp', import.meta.url))
assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')

console.log('lacdbPhoto ok', Object.keys(manifest).length)
