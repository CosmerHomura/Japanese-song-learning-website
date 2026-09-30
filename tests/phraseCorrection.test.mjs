import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSelectedTokens, restoreMergedToken } from '../src/lib/phraseCorrection.mjs'
test('phrase corrections merge readings without reindexing unaffected words and can be undone', () => {
  const tokens = [{ index: 0, surface: '4' }, { index: 1, surface: '月' }, { index: 2, surface: 'に' }]
  const merged = mergeSelectedTokens(tokens, 0, 1, 'しがつ', '四月')
  assert.equal(merged[0].surface, '4月')
  assert.equal(merged[0].reading, 'しがつ')
  assert.equal(merged[1].index, 2)
  assert.deepEqual(restoreMergedToken(merged, 0), tokens)
  assert.throws(() => mergeSelectedTokens(tokens, 0, 1, ''))
})
