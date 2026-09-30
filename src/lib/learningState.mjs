import { BACKUP_STORAGE_KEYS } from './learningBackup.js'

export const LEARNING_STATE_VERSION = 2
export const LEARNING_STATE_KEY = 'uta-learning-state-v2'

const legacyKeys = ['progress', 'annotations', 'aiReviews', 'sentenceExplanations', 'aiUsage']
const emptyProgress = () => ({ learnedBySong: {}, reviewItems: [], favoriteSongIds: [], corrections: {}, meaningOverrides: {}, playbackRate: 1 })
const record = value => value && typeof value === 'object' && !Array.isArray(value)

function readJson(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback } catch { return fallback }
}

function normalize(snapshot) {
  if (!record(snapshot) || !record(snapshot.progress)) return null
  const progress = snapshot.progress
  return {
    version: LEARNING_STATE_VERSION,
    progress: {
      ...emptyProgress(), ...progress,
      learnedBySong: record(progress.learnedBySong) ? progress.learnedBySong : {},
      reviewItems: Array.isArray(progress.reviewItems) ? progress.reviewItems : [],
      favoriteSongIds: Array.isArray(progress.favoriteSongIds) ? progress.favoriteSongIds : [],
      corrections: record(progress.corrections) ? progress.corrections : {},
      meaningOverrides: record(progress.meaningOverrides) ? progress.meaningOverrides : {},
      playbackRate: [1, .75, .5, .25].includes(progress.playbackRate) ? progress.playbackRate : 1,
    },
    annotations: record(snapshot.annotations) ? snapshot.annotations : {},
    aiReviews: record(snapshot.aiReviews) ? snapshot.aiReviews : {},
    sentenceExplanations: record(snapshot.sentenceExplanations) ? snapshot.sentenceExplanations : {},
    aiUsage: record(snapshot.aiUsage) ? snapshot.aiUsage : {},
  }
}

export function loadLearningState(storage) {
  const current = readJson(storage, LEARNING_STATE_KEY, null)
  if (Number.isInteger(current?.version) && current.version > LEARNING_STATE_VERSION) {
    throw new Error('本机学习数据由更新版本的 UTA 创建；请升级应用，避免覆盖已有记录。')
  }
  if (current?.version === LEARNING_STATE_VERSION) {
    const normalized = normalize(current)
    if (normalized) return normalized
  }
  return normalize(Object.fromEntries(legacyKeys.map(field => [field, readJson(storage, BACKUP_STORAGE_KEYS[field], field === 'progress' ? emptyProgress() : {})])))
}

export function saveLearningState(storage, state) {
  const current = readJson(storage, LEARNING_STATE_KEY, null)
  if (Number.isInteger(current?.version) && current.version > LEARNING_STATE_VERSION) {
    throw new Error('检测到更新版本的学习数据，已停止写入以保护记录。')
  }
  const snapshot = normalize(state)
  if (!snapshot) throw new Error('学习记录格式不正确。')
  try {
    storage.setItem(LEARNING_STATE_KEY, JSON.stringify(snapshot))
    // Retire legacy copies only after the new record has been written.
    for (const field of legacyKeys) storage.removeItem(BACKUP_STORAGE_KEYS[field])
  } catch (error) {
    // If a browser cannot fit the consolidated record, preserve the existing
    // format rather than discarding progress on an upgrade.
    for (const field of legacyKeys) storage.setItem(BACKUP_STORAGE_KEYS[field], JSON.stringify(snapshot[field]))
    storage.removeItem(LEARNING_STATE_KEY)
    if (error?.name !== 'QuotaExceededError') throw error
  }
  return snapshot
}

export function learningStateFromBackup(manifest) {
  return normalize({
    progress: manifest.progress,
    annotations: manifest.annotations,
    aiReviews: manifest.aiReviews,
    sentenceExplanations: manifest.sentenceExplanations || {},
    aiUsage: manifest.aiUsage || {},
  })
}
