import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLrcTimestamp, parseLrcTimestamp } from '../src/lib/lyricTime.mjs'

test('LRC time conversions round-trip milliseconds', () => {
  assert.equal(formatLrcTimestamp(72.345), '01:12.345')
  assert.equal(parseLrcTimestamp('[01:12.345]'), 72.345)
  assert.equal(parseLrcTimestamp('not a time'), null)
})
