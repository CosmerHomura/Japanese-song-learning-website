import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unresolvedReadings } from '../src/lib/readingReview.mjs'

test('reading review follows song order and excludes corrected, removed and symbol tokens', () => {
  const song = { id: 'song', lines: [{ id: 1 }, { id: 0 }] }
  const annotations = [
    { id: 0, tokens: [{ index: 0, surface: '月', needs_review: true }] },
    { id: 1, tokens: [{ index: 0, surface: '春', needs_review: true }, { index: 1, surface: '。', needs_review: true, is_symbol: true }] },
    { id: 2, tokens: [{ index: 0, surface: '旧', needs_review: true }] },
  ]
  assert.deepEqual(unresolvedReadings(song, annotations), [{ line_id: 1, token_index: 0, surface: '春' }, { line_id: 0, token_index: 0, surface: '月' }])
  assert.deepEqual(unresolvedReadings(song, annotations, { 'song:1:0': 'はる' }), [{ line_id: 0, token_index: 0, surface: '月' }])
  assert.deepEqual(unresolvedReadings(song, null), [])
})
