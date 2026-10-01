import { useEffect, useMemo, useState } from 'react'
import { loadLearningState, saveLearningState } from '../lib/learningState.mjs'
import { reconcileSnapshot, updateLearningField, removeSongLearning } from '../lib/learningStore.mjs'

// All learning edits share one snapshot, so batched updates cannot overwrite
// each other with a separately persisted copy of progress or billing.
export default function useLearningStore(songs, storage = localStorage) {
  const [saved, setSaved] = useState(() => loadLearningState(storage))
  const snapshot = useMemo(() => reconcileSnapshot(songs, saved), [songs, saved])
  useEffect(() => { saveLearningState(storage, snapshot) }, [storage, snapshot])
  const actions = useMemo(() => {
    const setter = (field, inProgress = false) => update =>
      setSaved(previous => updateLearningField(songs, previous, field, update, inProgress))
    return {
      setLearnedBySong: setter('learnedBySong', true),
      setReviewItems: setter('reviewItems', true),
      setFavoriteSongIds: setter('favoriteSongIds', true),
      setCorrections: setter('corrections', true),
      setMeaningOverrides: setter('meaningOverrides', true),
      setPlaybackRate: setter('playbackRate', true),
      setReadingStyle: setter('readingStyle', true),
      setAnnotationsBySong: setter('annotations'),
      setAiReviews: setter('aiReviews'),
      setSentenceExplanationsBySong: setter('sentenceExplanations'),
      setAiUsageBySong: setter('aiUsage'),
      removeSongLearning: songId => setSaved(previous => removeSongLearning(previous, songId)),
    }
  }, [songs])
  return { snapshot, ...actions }
}
