import test from 'node:test'
import assert from 'node:assert/strict'
import { resegmentLine } from '../src/lib/segmentation.mjs'

test('resegmentation preserves only corrections for unchanged character spans', () => {
  const tokens = [{ index: 0, surface: '四月' }, { index: 1, surface: 'に' }, { index: 2, surface: '会う' }]
  const corrections = { 'song:0:0': 'しがつ', 'song:0:2': 'あう', 'other:0:0': 'ほか' }
  const result = resegmentLine(tokens, { startIndex: 0, endIndex: 1 }, [{ surface: '四' }, { surface: '月' }, { surface: 'に' }], corrections, 'song:0:')
  assert.deepEqual(result.corrections, { 'song:0:3': 'あう', 'other:0:0': 'ほか' })
  assert.deepEqual(result.tokens.map(token => [token.start, token.end]), [[0, 1], [1, 2], [2, 3], [3, 5]])
  assert.equal(tokens[2].index, 2, 'undo source was not mutated')
})

test('equal words at different offsets cannot exchange corrections', () => {
  const tokens = [{ index: 0, surface: '月' }, { index: 1, surface: '月' }, { index: 2, surface: '夜' }]
  const result = resegmentLine(tokens, { startIndex: 1, endIndex: 2 }, [{ surface: '月夜' }], { 's:0:0': 'つき', 's:0:1': 'げつ' }, 's:0:')
  assert.deepEqual(result.corrections, { 's:0:0': 'つき' })
  assert.throws(() => resegmentLine(tokens, { startIndex: 0, endIndex: 0 }, [{ surface: '日' }], {}, 's:0:'), /原文/)
})
