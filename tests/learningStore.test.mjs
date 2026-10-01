import test from 'node:test'
import assert from 'node:assert/strict'
import { loadLearningState } from '../src/lib/learningState.mjs'
import { updateLearningField, removeSongLearning } from '../src/lib/learningStore.mjs'

const song = { id: 'local-test', isLocal: true, lines: [{ id: 0, text: 'うた' }] }
const empty = () => loadLearningState({ getItem: () => null })

test('successive learning updates preserve corrections, preferences and AI costs', () => {
  let state = empty()
  state = updateLearningField([song], state, 'annotations', { [song.id]: [{ id: 0, text: 'うた', tokens: [{ index: 0, surface: 'うた' }] }] })
  state = updateLearningField([song], state, 'corrections', { 'local-test:0:0': 'うた' }, true)
  state = updateLearningField([song], state, 'aiUsage', { [song.id]: [{ estimated_cost: 0.02 }] })
  state = updateLearningField([song], state, 'readingStyle', 'romaji', true)
  state = updateLearningField([song], state, 'learnedBySong', previous => ({ ...previous, [song.id]: [0] }), true)
  assert.equal(state.progress.corrections['local-test:0:0'], 'うた')
  assert.equal(state.aiUsage[song.id][0].estimated_cost, 0.02)
  assert.equal(state.progress.readingStyle, 'romaji')
  assert.deepEqual(state.progress.learnedBySong[song.id], [0])
})

test('deleting a song removes all of its learning records in one update, preserving other songs', () => {
  const state = empty()
  for (const field of ['annotations', 'aiReviews', 'sentenceExplanations', 'aiUsage']) state[field] = { a: ['a'], b: ['b'] }
  Object.assign(state.progress, {
    learnedBySong: { a: [0], b: [1] }, lyricSnapshots: { a: {}, b: {} },
    favoriteSongIds: ['a', 'b'], reviewItems: [{ songId: 'a' }, { songId: 'b' }],
    corrections: { 'a:0:0': 'あ', 'b:1:0': 'び' }, meaningOverrides: { shared: '共同词义' },
  })
  const next = removeSongLearning(state, 'a')
  for (const field of ['annotations', 'aiReviews', 'sentenceExplanations', 'aiUsage']) assert.deepEqual(next[field], { b: ['b'] })
  assert.deepEqual(next.progress.corrections, { 'b:1:0': 'び' })
  assert.deepEqual(next.progress.favoriteSongIds, ['b'])
  assert.deepEqual(next.progress.reviewItems, [{ songId: 'b' }])
  assert.equal(next.progress.meaningOverrides.shared, '共同词义')
  assert.ok(state.annotations.a, 'original snapshot is not mutated')
})
