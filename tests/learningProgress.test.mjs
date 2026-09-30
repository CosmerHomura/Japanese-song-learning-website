import { test } from 'node:test'
import assert from 'node:assert/strict'
import { songProgress, libraryProgress } from '../src/lib/learningProgress.mjs'

const song = { id: 'a', lines: [{ id: 0 }, { id: 1 }, { id: 2 }] }
test('progress excludes stale ids and duplicate saved records', () => {
  const stats = songProgress(song, [0, 0, 99], [{ songId: 'a', lineId: 1 }, { songId: 'a', lineId: 1 }, { songId: 'b', lineId: 2 }, { songId: 'a', lineId: 99 }])
  assert.equal(stats.learned, 1)
  assert.equal(stats.review, 1)
  assert.equal(stats.percent, 33)
})
test('empty library has zero progress, not NaN', () => {
  assert.deepEqual(libraryProgress([]), { songs: 0, completed: 0, total: 0, learned: 0, review: 0, percent: 0 })
})
test('library progress is weighted by sentence count, not mean of song percentages', () => {
  const second = { id: 'b', lines: [{ id: 0 }] }
  const stats = libraryProgress([song, second, second], { b: [0] })
  assert.equal(stats.songs, 2)
  assert.equal(stats.total, 4)
  assert.equal(stats.percent, 25)
  assert.equal(stats.completed, 1)
})
test('only songs with every valid sentence learned are completed', () => {
  const empty = { id: 'empty', lines: [] }
  assert.equal(libraryProgress([song, empty], { a: [0, 1, 2, 99, 0] }).completed, 1)
  assert.equal(libraryProgress([song], { a: [0, 1, 99] }).completed, 0)
})
