import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKUP_STORAGE_KEYS } from '../src/lib/learningBackup.js'
import { LEARNING_STATE_KEY, loadLearningState, saveLearningState, learningStateFromBackup } from '../src/lib/learningState.mjs'

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('legacy progress and annotations migrate without losing human corrections', () => {
  const storage = memoryStorage({
    [BACKUP_STORAGE_KEYS.progress]: JSON.stringify({ learnedBySong: { song: [1] }, corrections: { 'song:1:0': 'しがつ' } }),
    [BACKUP_STORAGE_KEYS.annotations]: JSON.stringify({ song: [{ id: 1, tokens: [{ index: 0, surface: '4月', reading: 'しがつ' }] }] }),
  })
  const loaded = loadLearningState(storage)
  assert.equal(loaded.version, 2)
  assert.equal(loaded.progress.corrections['song:1:0'], 'しがつ')
  saveLearningState(storage, loaded)
  assert.equal(storage.getItem(BACKUP_STORAGE_KEYS.progress), null)
  assert.equal(loadLearningState(storage).annotations.song[0].tokens[0].surface, '4月')
})

test('an old backup becomes a current snapshot and replaces stale local data', () => {
  const old = { progress: { learnedBySong: {}, reviewItems: [], favoriteSongIds: [], corrections: {}, meaningOverrides: {} }, annotations: {}, aiReviews: {}, sentenceExplanations: {}, aiUsage: {} }
  const storage = memoryStorage({ [LEARNING_STATE_KEY]: JSON.stringify({ version: 2, progress: { ...old.progress, corrections: { stale: 'x' } } }) })
  storage.setItem(LEARNING_STATE_KEY, JSON.stringify(learningStateFromBackup(old)))
  assert.equal(loadLearningState(storage).progress.corrections.stale, undefined)
})

test('damaged current snapshot falls back to legacy data', () => {
  const storage = memoryStorage({ [LEARNING_STATE_KEY]: '{', [BACKUP_STORAGE_KEYS.progress]: JSON.stringify({ corrections: { safe: 'かな' } }) })
  assert.equal(loadLearningState(storage).progress.corrections.safe, 'かな')
})

test('an older app never overwrites a future learning schema', () => {
  const storage = memoryStorage({ [LEARNING_STATE_KEY]: JSON.stringify({ version: 3, progress: { corrections: { saved: 'かな' } } }) })
  assert.throws(() => loadLearningState(storage), /更新版本/)
  assert.throws(() => saveLearningState(storage, { progress: {} }), /更新版本/)
  assert.equal(JSON.parse(storage.getItem(LEARNING_STATE_KEY)).progress.corrections.saved, 'かな')
})

test('reading choice and exact lyric snapshots survive the consolidated state', () => {
  const storage = memoryStorage()
  saveLearningState(storage, { progress: {
    readingStyle: 'romaji',
    lyricSnapshots: { 'folder-abc': { sourceFile: 'example.lrc', lines: [{ id: 1, text: '四月' }] } },
  } })
  const restored = loadLearningState(storage)
  assert.equal(restored.progress.readingStyle, 'romaji')
  assert.equal(restored.progress.lyricSnapshots['folder-abc'].lines[0].text, '四月')
})
