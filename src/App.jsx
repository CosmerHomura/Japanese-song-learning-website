import useSongAnnotation from './hooks/useSongAnnotation';
import useWordLearning from './hooks/useWordLearning';
import QuickStartGuide from './components/QuickStartGuide';
import LessonPage from './pages/LessonPage';
import BackupRestoreDialog from './components/BackupRestoreDialog';
import ImportDialog from './components/ImportDialog';
import WordDetails from './components/WordDetails';
import DictionaryDownloadPanel from './components/DictionaryDownloadPanel';
import useLocalLibrary from './hooks/useLocalLibrary';
import useSongImport from './hooks/useSongImport';
import useLearningBackup from './hooks/useLearningBackup';
import usePractice from './hooks/usePractice';
import useDesktopServices from './hooks/useDesktopServices';
import useSentenceExplanations from './hooks/useSentenceExplanations';
import usePageNavigation from './hooks/usePageNavigation';
import useLineAudio from './hooks/useLineAudio';
import LibraryPage from './pages/LibraryPage';
import ReviewPage from './pages/ReviewPage';
import useLearningStore from './hooks/useLearningStore';
import useReadingPreferences from './hooks/useReadingPreferences';
import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Search, Settings2 } from 'lucide-react';
import SettingsDialog from './components/SettingsDialog';
import WebSettingsDialog from './components/WebSettingsDialog';
import useAiSettings from './hooks/useAiSettings';
import { importedSongs } from './data/songs.generated';
import { demoSongs } from './data/demoSongs';
import utaAppIcon from './assets/uta-app-icon.png';
import { deleteSongAndLearning } from './lib/applicationRepository';
import { withoutSongHeadingLines } from './lib/songMetadata';
import { songProgress, libraryProgress } from './lib/learningProgress.mjs';
import { annotationMatchesLine } from './lib/learningIdentity';
import { lineReading as getLineReading } from './lib/readingDisplay';
const GUIDE_DISMISSED_KEY = 'uta-quick-start-dismissed-v1';
function normalizeSongSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
}
function initialSong() {
  return importedSongs.find(song => song.title === 'Lemon') || importedSongs[0] || demoSongs[0];
}
function hasCachedSentenceExplanation(cache, line) {
  const entry = cache?.[line.id];
  return entry?.text === line.text && typeof entry.explanation?.meaning === 'string' && Boolean(entry.explanation.meaning.trim());
}
export default function App() {
  const [activeSongId, setActiveSongId] = useState(initialSong().id);
  const {
    activePage,
    setActivePage,
    pageDirection
  } = usePageNavigation();
  const [activeLineId, setActiveLineId] = useState(0);
  const [mode, setMode] = useState('reading');
  const [motionPreview, setMotionPreview] = useState(0);
  const [librarySearch, setLibrarySearch] = useState('');
  const [settingsTab, setSettingsTab] = useState('ai');
  const [editingReadings, setEditingReadings] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem(GUIDE_DISMISSED_KEY) !== '1');
  const [guideAiConfigured, setGuideAiConfigured] = useState(false);
  const [toast, setToast] = useState('');
  const {
    aiSettingsOpen,
    webSettingsOpen,
    modelsRefreshing,
    aiSettings,
    aiModels,
    showAllModels,
    modelSearch,
    aiSettingsBusy,
    aiSettingsError,
    setAiSettingsOpen,
    setWebSettingsOpen,
    setModelsRefreshing,
    setAiSettings,
    setAiModels,
    setShowAllModels,
    setModelSearch,
    setAiSettingsBusy,
    setAiSettingsError,
    openAiSettings,
    refreshAiModels,
    saveAiConfiguration,
    selectAiProvider,
    selectDiscoveredModel,
    selectSavedKey,
    deleteSavedKey
  } = useAiSettings({
    setToast,
    setGuideAiConfigured
  });
  const {
    localSongs,
    setLocalSongs,
    localAudioUrls,
    setLocalAudioUrls,
    deletingSongId,
    setDeletingSongId,
    localAudioUrlRef,
    libraryReady,
    libraryError
  } = useLocalLibrary();
  const {
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
  } = useSongImport({
    localAudioUrlRef,
    setLocalSongs,
    setLocalAudioUrls,
    chooseSongFromLibrary,
    setToast
  });
  const {
    dictionaryStatus,
    dictionaryPanelOpen,
    setDictionaryPanelOpen,
    updateStatus,
    runUpdateAction,
    runDictionaryAction
  } = useDesktopServices({
    setToast
  });
  const allSongs = useMemo(() => [...importedSongs, ...localSongs, ...demoSongs].map(withoutSongHeadingLines).filter(song => song.lines.length), [localSongs, importedSongs]);
  const {
    snapshot: learning,
    ready: learningReady,
    storageError,
    setLearnedBySong,
    setReviewItems,
    setFavoriteSongIds,
    setCorrections,
    setMeaningOverrides,
    setPlaybackRate,
    setReadingStyle,
    setAnnotationsBySong,
    setAiReviews,
    setSentenceExplanationsBySong,
    setAiUsageBySong,
    removeSongLearning
  } = useLearningStore(allSongs);
  const {
    learnedBySong,
    reviewItems,
    favoriteSongIds,
    corrections,
    lyricSnapshots,
    meaningOverrides,
    playbackRate,
    readingStyle
  } = learning.progress;
  const {
    annotations: annotationsBySong,
    aiReviews,
    sentenceExplanations: sentenceExplanationsBySong,
    aiUsage: aiUsageBySong
  } = learning;
  const {
    readingPreferences,
    setReadingPreferences,
    systemReducedMotion
  } = useReadingPreferences();
  const readingLabel = readingStyle === 'romaji' ? '罗马音' : '平假名';
  const readingLang = readingStyle === 'romaji' ? 'ja-Latn' : 'ja';
  const visibleLibrarySongs = useMemo(() => {
    const query = normalizeSongSearch(librarySearch);
    const songs = allSongs.filter(song => !demoSongs.some(demo => demo.id === song.id));
    if (!query) return songs;
    return songs.filter(song => normalizeSongSearch(`${song.title}${song.artist}`).includes(query));
  }, [allSongs, librarySearch]);
  const reviewQueue = useMemo(() => reviewItems.flatMap(item => {
    const song = allSongs.find(candidate => candidate.id === item.songId);
    const line = song?.lines.find(candidate => candidate.id === item.lineId);
    return song && line ? [{
      song,
      line
    }] : [];
  }), [allSongs, reviewItems]);
  const activeSong = allSongs.find(song => song.id === activeSongId) || initialSong();
  const audioUrl = activeSong.isLocal ? localAudioUrls[activeSong.id] || '' : activeSong.audioFile ? `${import.meta.env.BASE_URL}${activeSong.audioFile.split('/').map(part => encodeURIComponent(part)).join('/')}` : '';
  const {
    audioRef,
    playingLineId,
    audioError,
    stopLinePlayback,
    playLine,
    handleAudioLoadedMetadata,
    handleAudioTimeUpdate,
    handleAudioEnded,
    handleAudioError
  } = useLineAudio(activeSong, audioUrl, playbackRate);
  const {
    annotating,
    annotationError
  } = useSongAnnotation(activeSong, annotationsBySong, setAnnotationsBySong, learningReady && libraryReady, dictionaryStatus?.phase === 'ready' ? dictionaryStatus.revision : '');
  const activeLine = activeSong.lines.find(line => line.id === activeLineId) || activeSong.lines[0];
  const hasSelectedLine = activeSong.lines.some(line => line.id === activeLineId);
  const annotations = useMemo(() => annotationsBySong[activeSong.id]?.filter(annotation => activeSong.lines.some(line => annotationMatchesLine(annotation, line))), [annotationsBySong, activeSong]);
  const activeAnnotation = annotations?.find(line => line.id === activeLine.id);
  const {
    sentenceExplanationOpen,
    setSentenceExplanationOpen,
    sentenceExplanationJob,
    sentenceExplanationError,
    setSentenceExplanationError,
    recordBilling,
    showSentenceExplanation,
    generateCurrentSongExplanations
  } = useSentenceExplanations({
    setAiUsageBySong,
    sentenceExplanationsBySong,
    setSentenceExplanationsBySong,
    activeSong,
    setToast
  });
  const {
    selectedTokenIndex,
    draftReading,
    setDraftReading,
    draftMeaning,
    setDraftMeaning,
    detailOpen,
    setDetailOpen,
    segmentationUndo,
    detailView,
    selectedText,
    setSelectedText,
    dragSelection,
    setDragSelection,
    selectedPhraseRange,
    setSelectedPhraseRange,
    aiExplanation,
    setAiExplanation,
    aiBusy,
    aiError,
    setAiError,
    dragSelectionRef,
    activeTokens,
    focusToken,
    focusKey,
    focusDisplayReading,
    wordMeaning,
    aiReview,
    pendingAiSuggestions,
    focusSuggestion,
    chooseLine,
    clearLineSelection,
    showAiReviewQueue,
    saveCorrection,
    resetCorrection,
    saveMeaning,
    openWordDetails,
    closeDetail,
    applySegmentation,
    undoSegmentation,
    restorePhraseCorrection,
    runAiReview,
    applyAiSuggestion,
    beginTokenSelection,
    extendTokenSelection,
    finishTokenSelection,
    handleTokenClick,
    jumpToAiSuggestion,
    askAiToExplain
  } = useWordLearning({
    activeAnnotation,
    activeLine,
    activeSong,
    corrections,
    readingStyle,
    meaningOverrides,
    aiReviews,
    annotations,
    editingReadings,
    activePage,
    setActiveLineId,
    setEditingReadings,
    setToast,
    setCorrections,
    setMeaningOverrides,
    setAnnotationsBySong,
    recordBilling,
    setAiReviews
  });
  const activeLineReading = getLineReading(activeAnnotation?.tokens, corrections, activeSong.id, activeLine.id, readingStyle);
  const learnedLines = new Set((learnedBySong[activeSong.id] || []).filter(lineId => activeSong.lines.some(line => line.id === lineId)));
  const progress = activeSong.lines.length ? Math.round(learnedLines.size / activeSong.lines.length * 100) : 0;
  const currentProgress = songProgress(activeSong, learnedBySong[activeSong.id] || [], reviewItems);
  const collectionProgress = libraryProgress(allSongs.filter(song => !demoSongs.some(demo => demo.id === song.id)), learnedBySong, reviewItems);
  const isFavorite = favoriteSongIds.includes(activeSong.id);
  const hasReview = reviewItems.some(item => item.songId === activeSong.id && item.lineId === activeLine.id);
  const currentSongReviewCount = reviewQueue.filter(item => item.song.id === activeSong.id).length;
  const totalCorrections = Object.keys(corrections).filter(key => key.startsWith(`${activeSong.id}:`)).length;
  const reviewNeeded = annotations?.filter(line => activeSong.lines.some(lyric => lyric.id === line.id)).flatMap(line => line.tokens).filter(token => token.needs_review).length || 0;
  const currentSentenceCache = sentenceExplanationsBySong[activeSong.id] || {};
  const readySentenceCount = activeSong.lines.filter(line => hasCachedSentenceExplanation(currentSentenceCache, line)).length;
  const activeSongUsage = aiUsageBySong[activeSong.id] || [];
  const activeSongCostSummary = Object.entries(activeSongUsage.reduce((totals, item) => {
    const currency = item.currency || 'CNY';
    totals[currency] = (totals[currency] || 0) + (Number(item.estimated_cost) || 0);
    return totals;
  }, {})).map(([currency, cost]) => `${currency === 'CNY' ? '¥' : currency} ${cost.toFixed(6)}`).join(' + ') || '¥ 0.000000';
  const {
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
  } = useLearningBackup({
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
  });
  const {
    practiceActive,
    setPracticeActive,
    practiceRevealed,
    setPracticeRevealed,
    practiceScope,
    practiceReturnPage,
    practiceSessionLineIds,
    practicePosition,
    practiceFinished,
    startPractice,
    goToPracticePosition,
    gradePracticeLine,
    exitPractice
  } = usePractice({
    activeSong,
    allSongs,
    reviewItems,
    setToast,
    stopLinePlayback,
    chooseSong,
    activePage,
    setActivePage,
    setActiveLineId,
    setSentenceExplanationOpen,
    setLearnedBySong,
    setReviewItems
  });
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  function chooseSong(songId) {
    stopLinePlayback();
    setActiveSongId(songId);
    setActiveLineId(0);
    setPracticeActive(false);
    setPracticeRevealed(false);
    setSelectedText(null);
    dragSelectionRef.current = null;
    setDragSelection(null);
    setSelectedPhraseRange(null);
    setAiExplanation(null);
    setAiError('');
    setSentenceExplanationOpen(null);
    setSentenceExplanationError(null);
    setToast('已切换歌词，正在准备自动读音。');
  }
  function chooseSongFromLibrary(songId) {
    chooseSong(songId);
    setActivePage('lesson');
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    });
  }
  function showLessonPage() {
    setActivePage('lesson');
    window.requestAnimationFrame(() => window.scrollTo({
      top: 0,
      behavior: 'instant'
    }));
  }
  function showReviewQueue() {
    stopLinePlayback();
    setPracticeActive(false);
    setPracticeRevealed(false);
    setDetailOpen(false);
    setActivePage('review');
    window.requestAnimationFrame(() => window.scrollTo({
      top: 0,
      behavior: 'instant'
    }));
  }
  function showLibraryPage({
    focusSearch = false
  } = {}) {
    stopLinePlayback();
    setPracticeActive(false);
    setPracticeRevealed(false);
    setDetailOpen(false);
    setActivePage('library');
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
      if (focusSearch) window.setTimeout(() => document.getElementById('library-search')?.focus(), 100);
    });
  }
  function dismissQuickStart() {
    setGuideOpen(false);
    localStorage.setItem(GUIDE_DISMISSED_KEY, '1');
  }
  function openGuideSettings() {
    setGuideOpen(false);
    openAiSettings();
  }
  function openGuideImport() {
    setGuideOpen(false);
    showLibraryPage();
    openImportDialog();
  }
  function focusLibrarySearch() {
    showLibraryPage({
      focusSearch: true
    });
  }
  async function removeImportedSong(song) {
    if (!song.isLocal || deletingSongId) return;
    if (!window.confirm(`确定删除《${song.title}》吗？歌词、音频和这首歌的学习进度都会从当前应用移除。`)) return;
    setDeletingSongId(song.id);
    try {
      await deleteSongAndLearning(song.id);
      const audioObjectUrl = localAudioUrlRef.current[song.id];
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
      const {
        [song.id]: removedUrl,
        ...remainingUrls
      } = localAudioUrlRef.current;
      localAudioUrlRef.current = remainingUrls;
      setLocalAudioUrls(remainingUrls);
      setLocalSongs(previous => previous.filter(item => item.id !== song.id));
      removeSongLearning(song.id);
      if (song.id === activeSong.id) {
        const nextSong = allSongs.find(item => item.id !== song.id) || initialSong();
        chooseSong(nextSong.id);
      }
      setToast(`已删除《${song.title}》及其本机保存的数据。`);
    } catch {
      setToast('删除失败：应用未能更新本地歌曲库。');
    } finally {
      setDeletingSongId('');
    }
  }
  function choosePlaybackRate(nextRate) {
    setPlaybackRate(nextRate);
    setToast(`已切换为 ${nextRate}× 速度播放。`);
  }
  function toggleLearnedLine(lineId) {
    const willLearn = !learnedLines.has(lineId);
    setLearnedBySong(previous => {
      const next = new Set(previous[activeSong.id] || []);
      if (willLearn) next.add(lineId);else next.delete(lineId);
      return {
        ...previous,
        [activeSong.id]: [...next]
      };
    });
    if (willLearn) setReviewItems(previous => previous.filter(item => !(item.songId === activeSong.id && item.lineId === lineId)));
    setToast(willLearn ? '本句已标记为掌握。' : '本句已改为未掌握。');
  }
  function toggleFavorite() {
    setFavoriteSongIds(previous => previous.includes(activeSong.id) ? previous.filter(id => id !== activeSong.id) : [...previous, activeSong.id]);
    setToast(isFavorite ? '已从收藏中移除。' : `已收藏《${activeSong.title}》。`);
  }
  function toggleReview() {
    setReviewItems(previous => hasReview ? previous.filter(item => !(item.songId === activeSong.id && item.lineId === activeLine.id)) : [...previous, {
      songId: activeSong.id,
      lineId: activeLine.id,
      text: activeLine.text
    }]);
    if (!hasReview) setLearnedBySong(previous => ({
      ...previous,
      [activeSong.id]: (previous[activeSong.id] || []).filter(lineId => lineId !== activeLine.id)
    }));
    setToast(hasReview ? '已移出复习清单。' : '本句已加入今日复习。');
  }
  if (!learningReady || !libraryReady) return <div className="startup-data-state" role="status"><h1>UTA</h1><p>{storageError || libraryError || '正在读取歌曲与学习记录…'}</p>{(storageError || libraryError) && <button type="button" onClick={() => window.location.reload()}>重新打开</button>}</div>;
  return <>
    <div className="page-grain" aria-hidden="true" />
    <audio ref={audioRef} src={audioUrl || undefined} preload="auto" onLoadedMetadata={handleAudioLoadedMetadata} onCanPlay={handleAudioLoadedMetadata} onTimeUpdate={handleAudioTimeUpdate} onEnded={handleAudioEnded} onError={handleAudioError} />
    <header className="topbar">
      <button className="brand" type="button" onClick={() => showLibraryPage()} aria-label="返回歌曲库首页" title="返回歌曲库"><img className="brand-icon" src={utaAppIcon} alt="" /><span>UTA<span className="brand-dot">.</span></span></button>
      <nav className="main-nav" aria-label="主导航"><button className={activePage === 'library' ? 'active' : ''} aria-current={activePage === 'library' ? 'page' : undefined} type="button" onClick={() => showLibraryPage()}>歌曲库</button><button className={activePage === 'lesson' ? 'active' : ''} aria-current={activePage === 'lesson' ? 'page' : undefined} type="button" onClick={showLessonPage}>歌曲学习</button><button className={activePage === 'review' ? 'active' : ''} aria-current={activePage === 'review' ? 'page' : undefined} type="button" onClick={showReviewQueue}>复习</button></nav>
      <div className="top-actions"><button className="icon-button" type="button" onClick={() => setGuideOpen(true)} aria-label="打开使用引导" title="使用引导"><CircleHelp size={19} /></button><button className="icon-button" type="button" onClick={focusLibrarySearch} aria-label="搜索歌曲"><Search size={20} /></button>{['available', 'downloading', 'downloaded'].includes(updateStatus?.phase) && <button className="update-available-button" type="button" onClick={() => {
          setSettingsTab('updates');
          void openAiSettings();
        }}>{updateStatus.phase === 'downloaded' ? '重启更新' : '发现新版本'}</button>}<button className="avatar" type="button" onClick={openAiSettings} aria-label="应用设置" title="应用设置"><Settings2 size={15} /></button></div>
    </header>

    {guideOpen && <QuickStartGuide view={{
      localSongs,
      dictionaryStatus,
      guideAiConfigured
    }} actions={{
      dismissQuickStart,
      openGuideImport,
      openGuideSettings
    }} />}

    {storageError && <p className="storage-error-banner" role="alert">{storageError} <button type="button" onClick={exportLearningData}>导出备份</button></p>}
    <main id="top" key={activePage} data-page-direction={pageDirection} data-reading-style={readingStyle} className={`page-transition ${detailOpen ? 'with-word-sidebar' : ''}`}>
      {(activePage === 'lesson' || activePage === 'review' && practiceActive) && <LessonPage view={{
        activePage,
        exitPractice,
        activeSong,
        totalCorrections,
        reviewItems,
        activeSongCostSummary,
        practiceActive,
        startPractice,
        activeLine,
        isFavorite,
        editingReadings,
        allSongs,
        progress,
        learnedLines,
        currentProgress,
        activeLineId,
        mode,
        annotating,
        annotationError,
        audioUrl,
        openImportDialog,
        playbackRate,
        sentenceExplanationJob,
        readySentenceCount,
        exportCurrentSongAnalysis,
        generateCurrentSongExplanations,
        aiBusy,
        sentenceExplanationError,
        currentSongReviewCount,
        practiceScope,
        practiceReturnPage,
        practiceFinished,
        practicePosition,
        practiceSessionLineIds,
        playLine,
        playingLineId,
        audioError,
        practiceRevealed,
        readingLang,
        activeLineReading,
        sentenceExplanationOpen,
        showSentenceExplanation,
        gradePracticeLine,
        goToPracticePosition,
        hasSelectedLine,
        focusToken,
        focusDisplayReading,
        wordMeaning,
        reviewNeeded,
        aiError,
        aiReview,
        pendingAiSuggestions,
        annotations,
        corrections,
        readingStyle,
        currentSentenceCache,
        selectedTokenIndex,
        dragSelection,
        selectedPhraseRange,
        selectedText,
        readingLabel,
        focusKey,
        focusSuggestion,
        draftReading,
        hasReview
      }} actions={{
        toggleFavorite,
        setEditingReadings,
        showLibraryPage,
        chooseLine,
        chooseSong,
        setMode,
        choosePlaybackRate,
        runAiReview,
        setPracticeRevealed,
        openWordDetails,
        showAiReviewQueue,
        clearLineSelection,
        beginTokenSelection,
        extendTokenSelection,
        finishTokenSelection,
        askAiToExplain,
        handleTokenClick,
        toggleLearnedLine,
        applyAiSuggestion,
        setDraftReading,
        saveCorrection,
        resetCorrection,
        jumpToAiSuggestion,
        toggleReview
      }} />}

      {activePage === 'library' && <LibraryPage librarySearch={librarySearch} setLibrarySearch={setLibrarySearch} visibleLibrarySongs={visibleLibrarySongs} collectionProgress={collectionProgress} learnedBySong={learnedBySong} activeSongId={activeSong.id} deletingSongId={deletingSongId} openImportDialog={openImportDialog} chooseSongFromLibrary={chooseSongFromLibrary} removeImportedSong={removeImportedSong} backupBusy={backupBusy} backupError={backupError} backupPreview={backupPreview} exportLearningData={exportLearningData} prepareBackupRestore={prepareBackupRestore} importSharedAnalysis={importSharedAnalysis} />}
      {activePage === 'review' && !practiceActive && <ReviewPage reviewQueue={reviewQueue} currentSongReviewCount={currentSongReviewCount} startPractice={startPractice} />}
    </main>

    <footer><span>UTA. Learn Japanese, one lyric at a time.</span><span>自动注音在本机生成 · 词义数据：<a href="https://github.com/tomoshi-app/tomoshi-dict-data" target="_blank" rel="noreferrer">Tomoshi / EDRDG</a> · AI 请求仅在你主动点击后发起</span></footer>

    {backupPreview && <BackupRestoreDialog view={{
      backupBusy,
      backupPreview,
      backupError,
      restoreLearningData
    }} actions={{
      setBackupPreview,
      setBackupError
    }} />}

    {importOpen && <ImportDialog view={{
      closeImportDialog,
      importLocalSong,
      importLrcFile,
      prepareLrcPreview,
      importAudioFile,
      importPreparing,
      importDraft,
      updateImportMetadata,
      importArtworkUrl,
      importArtworkStatus,
      searchImportArtwork,
      useDefaultImportArtwork,
      changeImportArtworkUrl,
      importArtwork,
      addImportLine,
      updateImportLine,
      removeImportLine,
      importAiProgress,
      importError,
      importBusy
    }} actions={{
      setImportAudioFile,
      setImportError
    }} />}

    {detailOpen && <WordDetails view={{
      detailView,
      activeTokens,
      activeSong,
      activeLine,
      selectedPhraseRange,
      focusToken,
      recordBilling,
      segmentationUndo,
      readingLang,
      focusDisplayReading,
      wordMeaning,
      draftMeaning,
      aiBusy,
      aiExplanation,
      readingStyle
    }} actions={{
      closeDetail,
      setSelectedPhraseRange,
      applySegmentation,
      undoSegmentation,
      restorePhraseCorrection,
      setDraftMeaning,
      saveMeaning,
      askAiToExplain
    }} />}

    {dictionaryPanelOpen && dictionaryStatus && <DictionaryDownloadPanel view={{
      dictionaryStatus,
      runDictionaryAction
    }} actions={{
      setDictionaryPanelOpen
    }} />}

    {aiSettingsOpen && <SettingsDialog state={{
      settingsTab,
      modelsRefreshing,
      readingPreferences,
      readingStyle,
      aiSettingsBusy,
      systemReducedMotion,
      motionPreview,
      aiSettings,
      aiModels,
      showAllModels,
      modelSearch,
      dictionaryStatus,
      aiSettingsError,
      updateStatus
    }} actions={{
      close: () => setAiSettingsOpen(false),
      setSettingsTab,
      setReadingPreferences,
      setReadingStyle,
      setMotionPreview,
      selectAiProvider,
      setAiSettings,
      selectSavedKey,
      deleteSavedKey,
      selectDiscoveredModel,
      refreshAiModels,
      setShowAllModels,
      setModelSearch,
      runDictionaryAction,
      saveAiConfiguration,
      runUpdateAction
    }} />}
    {webSettingsOpen && <WebSettingsDialog readingStyle={readingStyle} onReadingStyleChange={setReadingStyle} onClose={() => setWebSettingsOpen(false)} onExport={exportLearningData} onRestore={async file => {
      const ready = await prepareBackupRestore(file);
      if (ready) setWebSettingsOpen(false);
    }} backupBusy={backupBusy} backupError={backupError} />}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
  </>;
}
