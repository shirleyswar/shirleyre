import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { activeLacdbIndex, lacdbFlagFor, lacdbTid } from './lacdbFlag.ts'

assert.equal(lacdbTid('lacdb:5d4a0303-084-acres-lit-hard-corner'), '5d4a0303')
assert.equal(lacdbTid('lacdb:e0963f9a-8235-4325-9f0d-f1d4a40ce237'), 'e0963f9a')
assert.equal(lacdbTid('https://lacdb.resimplifi.com/listings/7eb337d8-best-value'), '7eb337d8')
assert.equal(lacdbTid('Duty'), '')
assert.equal(lacdbTid(null), '')

const feed = JSON.parse(readFileSync(new URL('../public/agents/listings.json', import.meta.url), 'utf8'))
const active = activeLacdbIndex(feed.listings)

const laborde = lacdbFlagFor({
  deal_source: 'lacdb:5d4a0303-084-acres-lit-hard-corner-c1-no-flood-buildready',
  lacdb_url: null,
}, active)
assert.equal(laborde?.kind, 'active')
assert.match(laborde?.href ?? '', /\/listings\/5d4a0303/)

const jefferson = lacdbFlagFor({
  deal_source: null,
  lacdb_url: 'https://lacdb.resimplifi.com/listings/7eb337d8-best-value-mid-city-office-great-parking-full-service-',
}, active)
assert.equal(jefferson?.kind, 'active')

const off = lacdbFlagFor({ deal_source: 'lacdb:d18319c8', lacdb_url: null }, active)
assert.deepEqual(off, { kind: 'off', href: null })

const pending = lacdbFlagFor({
  deal_source: 'Duty',
  lacdb_url: 'https://lacdb.resimplifi.com/listings/118b7fa2-interstate-12',
}, active)
assert.equal(pending?.kind, 'off')

const unlabeled = lacdbFlagFor({ deal_source: 'Duty', lacdb_url: null }, active)
assert.equal(unlabeled, null)

const blank = lacdbFlagFor({ deal_source: null, lacdb_url: '  ' }, active)
assert.equal(blank, null)

console.log('lacdbFlag ok', active.size)
