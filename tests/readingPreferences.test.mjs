import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReadingPreferences } from '../src/lib/readingPreferences.mjs'
test('reading sizes default, clamp and recover invalid stored values', () => {
  assert.deepEqual(normalizeReadingPreferences(), { interfaceSize: 16, lyricSize: 26, motion: 'on' })
  assert.deepEqual(normalizeReadingPreferences({ interfaceSize: 100, lyricSize: 1 }), { interfaceSize: 22, lyricSize: 20, motion: 'on' })
  assert.deepEqual(normalizeReadingPreferences({ interfaceSize: 'bad', lyricSize: 'bad' }), { interfaceSize: 16, lyricSize: 26, motion: 'on' })
})
