import { restoreApplicationData } from '../lib/applicationRepository';
import { useState } from 'react';
import { loadLocalSongs } from '../lib/localSongStore';
import { createLearningBackup, inspectLearningBackup, songsFromLearningBackup } from '../lib/learningBackup';
import { learningStateFromBackup } from '../lib/learningState.mjs';
import { createSongAnalysisFile, importSongAnalysisFile } from '../lib/analysisShare';
export default function useLearningBackup({
  learnedBySong,
  reviewItems,
  favoriteSongIds,
  corrections,
  meaningOverrides,
  playbackRate,
  lyricSnapshots,
  readingStyle,
  annotationsBySong,
  aiReviews,
  sentenceExplanationsBySong,
  aiUsageBySong,
  setToast,
  activeSong,
  activeSongUsage,
  allSongs,
  setSentenceExplanationsBySong
} = {}) {
  const [backupBusy, setBackupBusy] = useState('');
  const [backupPreview, setBackupPreview] = useState(null);
  const [backupError, setBackupError] = useState('');
  async function exportLearningData() {
    if (backupBusy) return;
    setBackupBusy('export');
    setBackupError('');
    try {
      const records = await loadLocalSongs();
      const progressState = {
        learnedBySong,
        reviewItems,
        favoriteSongIds,
        corrections,
        meaningOverrides,
        playbackRate,
        lyricSnapshots,
        readingStyle
      };
      const blob = createLearningBackup(records, {
        progress: progressState,
        annotations: annotationsBySong,
        aiReviews,
        sentenceExplanations: sentenceExplanationsBySong,
        aiUsage: aiUsageBySong
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `UTA-学习备份-${new Date().toISOString().slice(0, 10)}.uta-backup`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setToast(`备份已生成：${records.length} 首本地导入歌曲及学习数据。请妥善保管下载的文件。`);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '生成备份失败。');
    } finally {
      setBackupBusy('');
    }
  }
  async function exportCurrentSongAnalysis() {
    try {
      const blob = await createSongAnalysisFile(activeSong, sentenceExplanationsBySong[activeSong.id], activeSongUsage);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `UTA-${activeSong.title.replace(/[\\/:*?"<>|]/g, '-')}-解析.uta-analysis`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setToast('共享解析已导出：不含 API Key、音频和歌词正文。');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导出共享解析失败。');
    }
  }
  async function importSharedAnalysis(file) {
    if (!file) return;
    try {
      const imported = await importSongAnalysisFile(file, allSongs);
      setSentenceExplanationsBySong(previous => ({
        ...previous,
        [imported.song.id]: {
          ...(previous[imported.song.id] || {}),
          ...imported.entries
        }
      }));
      setToast(`已为《${imported.song.title}》导入 ${Object.keys(imported.entries).length} 句共享解析，不计入本机费用。`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导入共享解析失败。');
    }
  }
  async function prepareBackupRestore(file) {
    if (backupBusy || !file) return;
    setBackupBusy('inspect');
    setBackupPreview(null);
    setBackupError('');
    try {
      setBackupPreview(await inspectLearningBackup(file));
      return true;
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '无法读取备份文件。');
    } finally {
      setBackupBusy('');
    }
  }
  async function restoreLearningData() {
    if (!backupPreview || backupBusy) return;
    if (!window.confirm('这会用备份中的歌曲和学习记录覆盖当前应用的数据。建议先导出当前备份。确定继续吗？')) return;
    setBackupBusy('restore');
    setBackupError('');
    try {
      await restoreApplicationData(songsFromLearningBackup(backupPreview), learningStateFromBackup(backupPreview.manifest));
      window.location.reload();
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '恢复失败，原有数据未更改。');
      setBackupBusy('');
    }
  }
  return {
    backupBusy,
    backupPreview,
    setBackupPreview,
    backupError,
    setBackupError,
    exportLearningData,
    exportCurrentSongAnalysis,
    importSharedAnalysis,
    prepareBackupRestore,
    restoreLearningData
  };
}
