import { useRef, useState } from 'react';
import { formatLrcTimestamp, parseLrcTimestamp } from '../lib/lyricTime.mjs';
import { createAndStoreLocalSong, parseLrcFile } from '../lib/localSongStore';
import { isSongHeadingLine } from '../lib/songMetadata';
import { findArtworkWithRetry } from '../lib/songHelpers';
export default function useSongImport({
  localAudioUrlRef,
  setLocalSongs,
  setLocalAudioUrls,
  chooseSongFromLibrary,
  setToast
} = {}) {
  const [importOpen, setImportOpen] = useState(false);
  const [importLrcFile, setImportLrcFile] = useState(null);
  const [importAudioFile, setImportAudioFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importAiProgress, setImportAiProgress] = useState(null);
  const [importPreparing, setImportPreparing] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const [importArtworkStatus, setImportArtworkStatus] = useState('idle');
  const [importArtwork, setImportArtwork] = useState(null);
  const [importArtworkUrl, setImportArtworkUrl] = useState('');
  const [importError, setImportError] = useState('');
  const importPreviewRequestRef = useRef(0);
  const importArtworkRequestRef = useRef(0);
  function openImportDialog() {
    setImportError('');
    setImportOpen(true);
  }
  function closeImportDialog() {
    if (importBusy) return;
    importPreviewRequestRef.current += 1;
    importArtworkRequestRef.current += 1;
    setImportOpen(false);
    setImportLrcFile(null);
    setImportAudioFile(null);
    setImportDraft(null);
    setImportPreparing(false);
    setImportArtworkStatus('idle');
    setImportArtwork(null);
    setImportArtworkUrl('');
    setImportError('');
  }
  async function searchImportArtwork(title, artist) {
    const requestId = ++importArtworkRequestRef.current;
    if (!title.trim()) {
      setImportArtworkStatus('idle');
      return;
    }
    setImportArtworkStatus('loading');
    setImportArtwork(null);
    setImportArtworkUrl('');
    const artwork = await findArtworkWithRetry(title.trim(), artist.trim());
    if (requestId !== importArtworkRequestRef.current) return;
    setImportArtwork(artwork);
    setImportArtworkUrl(artwork?.artworkUrl || '');
    setImportArtworkStatus(artwork ? 'found' : 'none');
  }
  async function prepareLrcPreview(file) {
    const requestId = ++importPreviewRequestRef.current;
    importArtworkRequestRef.current += 1;
    setImportLrcFile(file);
    setImportDraft(null);
    setImportArtwork(null);
    setImportArtworkUrl('');
    setImportArtworkStatus('idle');
    setImportError('');
    if (!file) {
      setImportPreparing(false);
      return;
    }
    setImportPreparing(true);
    try {
      const parsed = await parseLrcFile(file);
      if (requestId !== importPreviewRequestRef.current) return;
      setImportDraft({
        ...parsed,
        lines: parsed.lines.map(line => ({
          ...line,
          draftId: `parsed-${line.id}`,
          timeText: formatLrcTimestamp(line.start)
        }))
      });
      setImportPreparing(false);
      void searchImportArtwork(parsed.title, parsed.artist);
    } catch (error) {
      if (requestId !== importPreviewRequestRef.current) return;
      setImportError(error instanceof Error ? error.message : '无法解析这份 LRC 歌词。');
      setImportPreparing(false);
    }
  }
  function updateImportMetadata(field, value) {
    setImportDraft(previous => previous ? {
      ...previous,
      [field]: value
    } : previous);
    if (importArtworkStatus !== 'manual' && importArtworkStatus !== 'default') {
      importArtworkRequestRef.current += 1;
      setImportArtwork(null);
      setImportArtworkUrl('');
      setImportArtworkStatus('idle');
    }
  }
  function updateImportLine(draftId, field, value) {
    setImportDraft(previous => previous ? {
      ...previous,
      lines: previous.lines.map(line => line.draftId === draftId ? {
        ...line,
        [field]: value
      } : line)
    } : previous);
  }
  function addImportLine() {
    setImportDraft(previous => {
      if (!previous) return previous;
      const lastLine = previous.lines.at(-1);
      const lastStart = parseLrcTimestamp(lastLine?.timeText) ?? 0;
      return {
        ...previous,
        lines: [...previous.lines, {
          draftId: globalThis.crypto?.randomUUID?.() || `new-${Date.now()}`,
          timeText: formatLrcTimestamp(lastStart + 5),
          text: '',
          translation: ''
        }]
      };
    });
  }
  function removeImportLine(draftId) {
    setImportDraft(previous => previous ? {
      ...previous,
      lines: previous.lines.filter(line => line.draftId !== draftId)
    } : previous);
  }
  function useDefaultImportArtwork() {
    importArtworkRequestRef.current += 1;
    setImportArtwork(null);
    setImportArtworkUrl('');
    setImportArtworkStatus('default');
  }
  function changeImportArtworkUrl(value) {
    importArtworkRequestRef.current += 1;
    setImportArtwork(null);
    setImportArtworkUrl(value);
    setImportArtworkStatus(value.trim() ? 'manual' : 'idle');
  }
  async function importLocalSong() {
    if (!importLrcFile || !importAudioFile || !importDraft) {
      setImportError('请选择一个 LRC 歌词文件和一个音频文件。');
      return;
    }
    if (importArtworkStatus === 'idle' || importArtworkStatus === 'loading') {
      setImportError('请等待封面查询完成，或选择使用默认封面。');
      return;
    }
    const title = importDraft.title.trim();
    const artist = importDraft.artist.trim() || '本地导入';
    if (!title) {
      setImportError('请填写歌曲名。');
      return;
    }
    const lines = [];
    for (const [index, line] of importDraft.lines.entries()) {
      const start = parseLrcTimestamp(line.timeText);
      const text = line.text.trim().replace(/\s+/g, ' ');
      if (start == null) {
        setImportError(`第 ${index + 1} 行的时间戳无效，请使用 00:12.345 格式。`);
        return;
      }
      if (!text) {
        setImportError(`第 ${index + 1} 行缺少日文歌词。`);
        return;
      }
      if (!isSongHeadingLine(text, title, artist)) lines.push({
        start,
        text,
        translation: line.translation.trim()
      });
    }
    if (!lines.length) {
      setImportError('预览中没有可学习的歌词句子。');
      return;
    }
    if (importArtworkStatus === 'manual') {
      try {
        const coverUrl = new URL(importArtworkUrl.trim());
        if (!['http:', 'https:'].includes(coverUrl.protocol)) throw new Error('invalid URL');
      } catch {
        setImportError('封面链接需要是有效的 http 或 https 地址。');
        return;
      }
    }
    lines.sort((left, right) => left.start - right.start);
    const parsed = {
      title,
      artist,
      album: importDraft.album || '',
      sourceFile: importLrcFile.name,
      duration: lines.at(-1).start,
      lines: lines.map((line, id) => ({
        id,
        ...line
      }))
    };
    const artwork = importArtworkStatus === 'found' ? importArtwork : importArtworkStatus === 'manual' ? {
      artworkUrl: importArtworkUrl.trim(),
      artworkSourceUrl: '',
      artworkProvider: '手动填写'
    } : null;
    setImportBusy(true);
    setImportAiProgress(null);
    setImportError('');
    try {
      const record = await createAndStoreLocalSong(parsed, importAudioFile, artwork || {});
      const {
        audioBlob,
        ...song
      } = record;
      const audioObjectUrl = URL.createObjectURL(audioBlob);
      localAudioUrlRef.current = {
        ...localAudioUrlRef.current,
        [song.id]: audioObjectUrl
      };
      setLocalSongs(previous => [song, ...previous]);
      setLocalAudioUrls(previous => ({
        ...previous,
        [song.id]: audioObjectUrl
      }));
      setImportLrcFile(null);
      setImportAudioFile(null);
      setImportDraft(null);
      setImportAiProgress(null);
      setImportArtworkStatus('idle');
      setImportArtwork(null);
      setImportArtworkUrl('');
      setImportOpen(false);
      chooseSongFromLibrary(song.id);
      setToast(`已导入《${song.title}》，可以开始听读；AI 解析可在学习页按需生成。`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败，请检查歌词和音频文件。');
      setImportAiProgress(null);
    } finally {
      setImportBusy(false);
    }
  }
  return {
    importOpen,
    importLrcFile,
    importAudioFile,
    setImportAudioFile,
    importBusy,
    importAiProgress,
    importPreparing,
    importDraft,
    importArtworkStatus,
    importArtwork,
    importArtworkUrl,
    importError,
    setImportError,
    openImportDialog,
    closeImportDialog,
    searchImportArtwork,
    prepareLrcPreview,
    updateImportMetadata,
    updateImportLine,
    addImportLine,
    removeImportLine,
    useDefaultImportArtwork,
    changeImportArtworkUrl,
    importLocalSong
  };
}
