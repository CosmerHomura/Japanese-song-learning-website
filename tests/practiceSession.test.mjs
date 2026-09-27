import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPracticeSession } from '../src/lib/practiceSession.mjs'

const song = { id: 'song', lines: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }] }
const review = [0, 2, 3].map(lineId => ({ songId: 'song', lineId }))
test('clicked review sentence comes first without losing earlier review sentences', () => {
  assert.deepEqual(createPracticeSession(song, 'review', review, 2), { lineIds: [2, 3, 0], position: 0 })
})
test('full-song practice retains selected starting position', () => {
  assert.deepEqual(createPracticeSession(song, 'all', review, 2), { lineIds: [0, 1, 2, 3], position: 2 })
})
test('review ignores other songs and deleted or duplicate records', () => {
  assert.deepEqual(createPracticeSession(song, 'review', [...review, review[0], { songId: 'other', lineId: 1 }, { songId: 'song', lineId: 99 }], 99), { lineIds: [0, 2, 3], position: 0 })
})
test('empty review queue produces no session', () => {
  assert.deepEqual(createPracticeSession(song, 'review', []), { lineIds: [], position: 0 })
})
