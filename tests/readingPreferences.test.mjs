import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReadingPreferences } from '../src/lib/readingPreferences.mjs'
test('reading sizes default, clamp and recover invalid stored values', () => {
  assert.deepEqual(normalizeReadingPreferences(), { interfaceSize: 18, lyricSize: 28, motion: 'on', theme: 'sakura' })
  assert.deepEqual(normalizeReadingPreferences({ interfaceSize: 100, lyricSize: 1 }), { interfaceSize: 24, lyricSize: 24, motion: 'on', theme: 'sakura' })
  assert.deepEqual(normalizeReadingPreferences({ interfaceSize: 'bad', lyricSize: 'bad' }), { interfaceSize: 18, lyricSize: 28, motion: 'on', theme: 'sakura' })
})

test('theme preferences validate and preserve saved choices', () => {
  for (const theme of ['sakura', 'paper', 'mint', 'night']) assert.equal(normalizeReadingPreferences({ theme }).theme, theme)
  assert.equal(normalizeReadingPreferences({ theme: 'invalid' }).theme, 'sakura')
})
