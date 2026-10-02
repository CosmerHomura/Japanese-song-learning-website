// Songs and learning snapshots share a database so restore/delete can commit
// together. A failed write aborts the entire transaction.
export const DATABASE_NAME = 'uta-local-song-library'
export const DATABASE_VERSION = 2
export const SONG_STORE = 'songs'
export const LEARNING_STORE = 'learning'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error || new Error('无法打开本地学习数据。'))
    request.onblocked = () => reject(new Error('其他 UTA 窗口正在使用旧版数据，请关闭后重试。'))
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SONG_STORE)) request.result.createObjectStore(SONG_STORE, { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains(LEARNING_STORE)) request.result.createObjectStore(LEARNING_STORE)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

export async function runDatabaseTransaction(stores, mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode)
    let result
    let failure
    transaction.oncomplete = () => {
      database.close()
      try { resolve(typeof result === 'function' ? result() : result?.result) }
      catch (error) { reject(error) }
    }
    transaction.onerror = () => { /* onabort owns failure reporting */ }
    transaction.onabort = () => { database.close(); reject(failure || transaction.error || new Error('本地数据写入失败，原数据已保留。')) }
    const abort = error => { failure = error; transaction.abort() }
    try { result = action(transaction, abort) }
    catch (error) { failure = error; transaction.abort() }
  })
}

// Serialize autosaves with commands, so a delayed save cannot overwrite a
// newer restore or delete. Read-only transactions may still run independently.
let writes = Promise.resolve()
export function enqueueDatabaseWrite(action) {
  const task = writes.then(action)
  writes = task.catch(() => {})
  return task
}
