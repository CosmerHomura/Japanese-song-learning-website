import { useEffect, useMemo, useState } from 'react';
import { loadLearningState } from '../lib/learningState.mjs';
import { loadApplicationData, saveApplicationLearning } from '../lib/applicationRepository';
import { reconcileSnapshot, updateLearningField, removeSongLearning } from '../lib/learningStore.mjs';

// All learning edits share one snapshot, so batched updates cannot overwrite
// each other with a separately persisted copy of progress or billing.
export default function useLearningStore(songs, storage = localStorage) {
  const [saved, setSaved] = useState(() => loadLearningState({
    getItem: () => null
  }));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    let disposed = false;
    loadApplicationData(storage).then(data => {
      if (disposed) return;
      setSaved(data.learning);
      setReady(true);
    }).catch(error => {
      if (!disposed) setStorageError(error.message || '无法读取学习数据，请重新打开应用。');
    });
    return () => {
      disposed = true;
    };
  }, [storage]);
  const snapshot = useMemo(() => reconcileSnapshot(songs, saved), [songs, saved]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    saveApplicationLearning(snapshot).then(() => {
      if (!disposed) setStorageError('');
    }).catch(error => {
      if (!disposed) setStorageError(error.message || '学习数据未保存，请先导出备份。');
    });
    return () => {
      disposed = true;
    };
  }, [ready, snapshot]);
  const actions = useMemo(() => {
    const setter = (field, inProgress = false) => update => setSaved(previous => updateLearningField(songs, previous, field, update, inProgress));
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
      removeSongLearning: songId => setSaved(previous => removeSongLearning(previous, songId))
    };
  }, [songs]);
  return {
    snapshot,
    ready,
    storageError,
    ...actions
  };
}
