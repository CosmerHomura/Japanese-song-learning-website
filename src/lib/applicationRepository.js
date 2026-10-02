import { SONG_STORE, LEARNING_STORE, runDatabaseTransaction, enqueueDatabaseWrite } from './localDatabase.js'
import { loadLearningState, normalizeLearningSnapshot, LEARNING_STATE_KEY, LEARNING_STATE_VERSION } from './learningState.mjs'
import { BACKUP_STORAGE_KEYS } from './learningBackup.js'
import { removeSongLearning } from './learningStore.mjs'

const SNAPSHOT_KEY = 'current'
const removedSongs = new Set()
let restoreCommitted = false

function checkVersion(snapshot) {
  if (snapshot?.version > LEARNING_STATE_VERSION) throw new Error('学习数据由更新版本创建，请升级 UTA 后再打开。')
  if (snapshot && snapshot.version !== LEARNING_STATE_VERSION) throw new Error('学习数据版本不受支持，已停止写入。')
  if (snapshot && (!snapshot.progress || typeof snapshot.progress !== 'object' || Array.isArray(snapshot.progress))) throw new Error('学习数据格式异常，已保留原记录，请用备份恢复。')
  return snapshot ? normalizeLearningSnapshot(snapshot) : snapshot
}

function writeWithCurrent(stores, action) {
  return runDatabaseTransaction(stores, 'readwrite', (transaction, abort) => {
    const request = transaction.objectStore(LEARNING_STORE).get(SNAPSHOT_KEY)
    let result
    request.onsuccess = () => {
      try { result = action(checkVersion(request.result), transaction) }
      catch (error) { abort(error) }
    }
    return () => result
  })
}

function withoutRemovedSongs(snapshot) {
  for (const id of removedSongs) snapshot = removeSongLearning(snapshot, id)
  return snapshot
}

export async function loadApplicationData(storage = localStorage) {
  const data = await runDatabaseTransaction([SONG_STORE, LEARNING_STORE], 'readonly', transaction => {
    const songs = transaction.objectStore(SONG_STORE).getAll()
    const learning = transaction.objectStore(LEARNING_STORE).get(SNAPSHOT_KEY)
    return () => ({ songs: songs.result || [], learning: checkVersion(learning.result) })
  })
  if (!data.learning) {
    const migrated = loadLearningState(storage)
    data.learning = await enqueueDatabaseWrite(() => writeWithCurrent([LEARNING_STORE], (current, transaction) => {
      if (!current) transaction.objectStore(LEARNING_STORE).put(migrated, SNAPSHOT_KEY)
      return current || migrated
    }))
  }
  // Retire the old record only after an IndexedDB snapshot is durable.
  for (const key of [LEARNING_STATE_KEY, ...Object.values(BACKUP_STORAGE_KEYS)]) {
    try { storage.removeItem(key) } catch { /* durable data already exists */ }
  }
  return data
}

export function saveApplicationLearning(snapshot) {
  return enqueueDatabaseWrite(() => {
    if (restoreCommitted) return
    return writeWithCurrent([LEARNING_STORE], (_current, transaction) => {
      transaction.objectStore(LEARNING_STORE).put(withoutRemovedSongs(checkVersion(snapshot)), SNAPSHOT_KEY)
    })
  })
}

export function deleteSongAndLearning(songId) {
  return enqueueDatabaseWrite(async () => {
    await writeWithCurrent([SONG_STORE, LEARNING_STORE], (current, transaction) => {
      const learning = transaction.objectStore(LEARNING_STORE)
      if (current) learning.put(removeSongLearning(current, songId), SNAPSHOT_KEY)
      transaction.objectStore(SONG_STORE).delete(songId)
    })
    // Later in-flight AI results and older autosaves cannot resurrect records.
    removedSongs.add(songId)
  })
}

export function restoreApplicationData(songs, snapshot) {
  const restored = checkVersion(snapshot)
  if (!restored) throw new Error('备份中缺少学习数据。')
  return enqueueDatabaseWrite(async () => {
    await writeWithCurrent([SONG_STORE, LEARNING_STORE], (_current, transaction) => {
      const store = transaction.objectStore(SONG_STORE)
      store.clear()
      songs.forEach(song => store.put(song))
      transaction.objectStore(LEARNING_STORE).put(restored, SNAPSHOT_KEY)
    })
    restoreCommitted = true // Reload hydrates the restored snapshot before edits.
  })
}
