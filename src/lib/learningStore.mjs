import { reconcileLearningState } from './learningIdentity.js'

export function reconcileSnapshot(songs, snapshot) {
  return { ...snapshot, ...reconcileLearningState(songs, snapshot) }
}

export function updateLearningField(songs, previous, field, update, inProgress = false) {
  const snapshot = reconcileSnapshot(songs, previous)
  const container = inProgress ? snapshot.progress : snapshot
  const value = typeof update === 'function' ? update(container[field]) : update
  return inProgress
    ? { ...snapshot, progress: { ...snapshot.progress, [field]: value } }
    : { ...snapshot, [field]: value }
}

export function removeSongLearning(previous, songId) {
  const omitSong = (map = {}) => Object.fromEntries(Object.entries(map).filter(([id]) => id !== songId))
  return {
    ...previous,
    annotations: omitSong(previous.annotations),
    aiReviews: omitSong(previous.aiReviews),
    sentenceExplanations: omitSong(previous.sentenceExplanations),
    aiUsage: omitSong(previous.aiUsage),
    progress: {
      ...previous.progress,
      learnedBySong: omitSong(previous.progress.learnedBySong),
      lyricSnapshots: omitSong(previous.progress.lyricSnapshots),
      reviewItems: previous.progress.reviewItems.filter(item => item.songId !== songId),
      favoriteSongIds: previous.progress.favoriteSongIds.filter(id => id !== songId),
      corrections: Object.fromEntries(Object.entries(previous.progress.corrections).filter(([key]) => !key.startsWith(`${songId}:`))),
    },
  }
}
