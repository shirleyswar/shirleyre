import assert from 'node:assert/strict'
import { acresFromLand, fmtAcres } from './landSize.ts'

assert.equal(fmtAcres(81849), '1.88 AC')
assert.equal(fmtAcres(81849.24), '1.88 AC')
assert.equal(fmtAcres(1.879), '1.88 AC')
assert.equal(fmtAcres(0.7335), '0.73 AC')
assert.equal(fmtAcres(12.933), '12.93 AC')
assert.equal(fmtAcres(500), '500.00 AC')
assert.equal(fmtAcres(null), '')
assert.equal(fmtAcres(undefined), '')
assert.equal(fmtAcres(0), '')
assert.equal(acresFromLand(563361)?.toFixed(2), '12.93')

console.log('landSize tests ok')
