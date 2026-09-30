import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenCheck, Bot, Check, ChevronDown, ChevronRight, Circle, CircleAlert, CircleHelp, Download, Heart, LoaderCircle, MousePointer2, Pause, Pencil, Play, Plus, Save, Search, Settings2, Sparkles, Trash2, Upload, Volume2, WandSparkles, X } from 'lucide-react'
import AnnotatedLine from './components/AnnotatedLine'
import SegmentationEditor from './components/SegmentationEditor'
import { reconcileModelCatalog } from './lib/modelRefresh.mjs'
import { importedSongs } from './data/songs.generated'
import { demoSongs } from './data/demoSongs'
import { songArtworkBySource } from './data/songArtwork'
import twilightStation from './assets/uta-twilight-station.png'
import utaAppIcon from './assets/uta-app-icon.png'
import { annotateSongLines, explainSelectionWithAi, explainSentenceBatchWithAi, reviewSongWithAi, searchSongArtwork } from './lib/annotationApi'
import { createAndStoreLocalSong, deleteLocalSong, loadLocalSongs, parseLrcFile, replaceLocalSongs, updateLocalSongMetadata } from './lib/localSongStore'
import { BACKUP_STORAGE_KEYS, createLearningBackup, inspectLearningBackup, songsFromLearningBackup } from './lib/learningBackup'
import { createSongAnalysisFile, importSongAnalysisFile } from './lib/analysisShare'
import { correctionKey, hasKanji } from './lib/ruby'
import { isSongHeadingLine, withoutSongHeadingLines } from './lib/songMetadata'
import { modelChoices, modelLabel } from './lib/modelChoices.mjs'
import LearningProgress from './components/LearningProgress'
import { songProgress, libraryProgress } from './lib/learningProgress.mjs'
import { createPracticeSession } from './lib/practiceSession.mjs'
import { dictionaryPanelVisible } from './lib/dictionaryPanel.mjs'
import { normalizeReadingPreferences, DEFAULT_READING_PREFERENCES } from './lib/readingPreferences.mjs'
import { mergeSelectedTokens, restoreMergedToken } from './lib/phraseCorrection.mjs'

const PROGRESS_KEY = BACKUP_STORAGE_KEYS.progress
const ANNOTATION_KEY = BACKUP_STORAGE_KEYS.annotations
const AI_REVIEW_KEY = BACKUP_STORAGE_KEYS.aiReviews
const SENTENCE_EXPLANATION_KEY = BACKUP_STORAGE_KEYS.sentenceExplanations
const AI_USAGE_KEY = 'uta-ai-usage-v1'
const GUIDE_DISMISSED_KEY = 'uta-quick-start-dismissed-v1'
const LINE_PLAYBACK_LEAD_IN_SECONDS = 0.5
const SENTENCE_BATCH_SIZE = 8

function loadLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function normalizeSongSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '')
}

async function findArtworkWithRetry(title, artist) {
  try {
    return await searchSongArtwork(title, artist)
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    try { return await searchSongArtwork(title, artist) } catch { return null }
  }
}

function initialSong() {
  return importedSongs.find((song) => song.title === 'Lemon') || importedSongs[0] || demoSongs[0]
}

function fallbackTokens(text) {
  return [{
    index: 0, surface: text, reading: '', base: text, ruby: '', suffix: '',
    part_of_speech: '待注音', dictionary_form: text, normalized_form: text,
    inflection_type: '待分析', inflection_form: '待分析', meaning: null, examples: [], needs_review: true, is_symbol: false,
  }]
}

function cleanSelectedText(value) {
  return value.replace(/\s+/g, '').trim().slice(0, 100)
}

function hasCachedSentenceExplanation(cache, line) {
  const entry = cache?.[line.id]
  return entry?.text === line.text && typeof entry.explanation?.meaning === 'string' && Boolean(entry.explanation.meaning.trim())
}

function SentenceAnalysis({ explanation, id }) {
  return <section className="sentence-inline-analysis" id={id} aria-label="整句解析" onClick={(event) => event.stopPropagation()}>
    <h3><Sparkles size={14} /> 整句解析</h3>
    <div className="sentence-analysis-section"><h4>整句意思</h4><p>{explanation.meaning}</p></div>
    {explanation.vocabulary?.length > 0 && <div className="sentence-analysis-section"><h4>关键表达</h4><dl>{explanation.vocabulary.map((item, index) => <div key={`${item.surface}-${index}`}><dt lang="ja">{item.surface}</dt><dd>{item.meaning}</dd></div>)}</dl></div>}
    {explanation.grammar?.length > 0 && <div className="sentence-analysis-section"><h4>语法与语境</h4><ul>{explanation.grammar.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul></div>}
    {explanation.pronunciation_tip && <div className="sentence-analysis-section"><h4>发音提示</h4><p>{explanation.pronunciation_tip}</p></div>}
    <p className="sentence-analysis-footnote">AI 解析仅供学习参考；想了解具体词句，仍可在歌词中选中后单独提问。</p>
  </section>
}

function formatLrcTimestamp(seconds) {
  const milliseconds = Math.round(seconds * 1000)
  const minutes = Math.floor(milliseconds / 60000)
  const remainder = milliseconds % 60000
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remainder / 1000)).padStart(2, '0')}.${String(remainder % 1000).padStart(3, '0')}`
}

function parseLrcTimestamp(value) {
  const match = String(value).trim().match(/^\[?(\d{1,3}):([0-5]\d(?:\.\d{1,3})?)\]?$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export default function App() {
  const savedProgress = useMemo(() => loadLocal(PROGRESS_KEY, {
    learnedBySong: {}, reviewItems: [], favoriteSongIds: [], corrections: {}, meaningOverrides: {},
  }), [])
  const [activeSongId, setActiveSongId] = useState(initialSong().id)
  const [activePage, setActivePage] = useState('library')
  const [activeLineId, setActiveLineId] = useState(0)
  const [mode, setMode] = useState('reading')
  const [practiceActive, setPracticeActive] = useState(false)
  const [practiceRevealed, setPracticeRevealed] = useState(false)
  const [practiceScope, setPracticeScope] = useState('all')
  const [practiceReturnPage, setPracticeReturnPage] = useState('lesson')
  const [practiceSessionLineIds, setPracticeSessionLineIds] = useState([])
  const [practicePosition, setPracticePosition] = useState(0)
  const [learnedBySong, setLearnedBySong] = useState(savedProgress.learnedBySong || {})
  const [reviewItems, setReviewItems] = useState(savedProgress.reviewItems || [])
  const [favoriteSongIds, setFavoriteSongIds] = useState(savedProgress.favoriteSongIds || [])
  const [corrections, setCorrections] = useState(savedProgress.corrections || {})
  const [meaningOverrides, setMeaningOverrides] = useState(savedProgress.meaningOverrides || {})
  const [playbackRate, setPlaybackRate] = useState(savedProgress.playbackRate || 1)
  const [localSongs, setLocalSongs] = useState([])
  const [localAudioUrls, setLocalAudioUrls] = useState({})
  const [annotationsBySong, setAnnotationsBySong] = useState(() => loadLocal(ANNOTATION_KEY, {}))
  const [aiReviews, setAiReviews] = useState(() => loadLocal(AI_REVIEW_KEY, {}))
  const [sentenceExplanationsBySong, setSentenceExplanationsBySong] = useState(() => loadLocal(SENTENCE_EXPLANATION_KEY, {}))
  const [aiUsageBySong, setAiUsageBySong] = useState(() => loadLocal(AI_USAGE_KEY, {}))
  const [sentenceExplanationOpen, setSentenceExplanationOpen] = useState(null)
  const [sentenceExplanationJob, setSentenceExplanationJob] = useState(null)
  const [sentenceExplanationError, setSentenceExplanationError] = useState(null)
  const [annotating, setAnnotating] = useState(false)
  const [annotationError, setAnnotationError] = useState('')
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  const [draftReading, setDraftReading] = useState('')
  const [draftMeaning, setDraftMeaning] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [readingPreferences, setReadingPreferences] = useState(() => normalizeReadingPreferences(loadLocal('uta-reading-preferences-v1', {})))
  const [phraseReading, setPhraseReading] = useState('')
  const [segmentationUndo, setSegmentationUndo] = useState({})
  const [phraseMeaning, setPhraseMeaning] = useState('')
  const [motionPreview, setMotionPreview] = useState(0)
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const pageRef = useRef(null)
  const [detailView, setDetailView] = useState('word')
  const [selectedText, setSelectedText] = useState(null)
  const [dragSelection, setDragSelection] = useState(null)
  const [selectedPhraseRange, setSelectedPhraseRange] = useState(null)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiBusy, setAiBusy] = useState('')
  const [aiError, setAiError] = useState('')
  const [playingLineId, setPlayingLineId] = useState(null)
  const [audioError, setAudioError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importLrcFile, setImportLrcFile] = useState(null)
  const [importAudioFile, setImportAudioFile] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importAiProgress, setImportAiProgress] = useState(null)
  const [importPreparing, setImportPreparing] = useState(false)
  const [importDraft, setImportDraft] = useState(null)
  const [importArtworkStatus, setImportArtworkStatus] = useState('idle')
  const [importArtwork, setImportArtwork] = useState(null)
  const [importArtworkUrl, setImportArtworkUrl] = useState('')
  const [importError, setImportError] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [deletingSongId, setDeletingSongId] = useState('')
  const [backupBusy, setBackupBusy] = useState('')
  const [backupPreview, setBackupPreview] = useState(null)
  const [backupError, setBackupError] = useState('')
  const [dictionaryStatus, setDictionaryStatus] = useState(null)
  const [dictionaryPanelOpen, setDictionaryPanelOpen] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('ai')
  const [modelsRefreshing, setModelsRefreshing] = useState(false)
  const modelRefreshVersion = useRef(0)
  const [aiSettings, setAiSettings] = useState(null)
  const [aiModels, setAiModels] = useState([])
  const [showAllModels, setShowAllModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [editingReadings, setEditingReadings] = useState(false)
  const [aiSettingsBusy, setAiSettingsBusy] = useState('')
  const [aiSettingsError, setAiSettingsError] = useState('')
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem(GUIDE_DISMISSED_KEY) !== '1')
  const [guideAiConfigured, setGuideAiConfigured] = useState(false)
  const [toast, setToast] = useState('')
  const dragSelectionRef = useRef(null)
  const suppressNextTokenClick = useRef(false)
  const audioRef = useRef(null)
  const clipEndRef = useRef(null)
  const pendingClipRef = useRef(null)
  const localAudioUrlRef = useRef({})
  const artworkLookupRef = useRef(new Set())
  const importPreviewRequestRef = useRef(0)
  const importArtworkRequestRef = useRef(0)
  const backupInputRef = useRef(null)
  const analysisInputRef = useRef(null)
  const sentenceExplanationJobRef = useRef(null)

  const allSongs = useMemo(() => [...importedSongs, ...localSongs, ...demoSongs].map(withoutSongHeadingLines).filter((song) => song.lines.length), [localSongs])
  const visibleLibrarySongs = useMemo(() => {
    const query = normalizeSongSearch(librarySearch)
    const songs = allSongs.filter((song) => !demoSongs.some((demo) => demo.id === song.id))
    if (!query) return songs
    return songs.filter((song) => normalizeSongSearch(`${song.title}${song.artist}`).includes(query))
  }, [allSongs, librarySearch])
  const reviewQueue = useMemo(() => reviewItems.flatMap((item) => {
    const song = allSongs.find((candidate) => candidate.id === item.songId)
    const line = song?.lines.find((candidate) => candidate.id === item.lineId)
    return song && line ? [{ song, line }] : []
  }), [allSongs, reviewItems])
  const activeSong = allSongs.find((song) => song.id === activeSongId) || initialSong()
  const audioUrl = activeSong.isLocal
    ? localAudioUrls[activeSong.id] || ''
    : activeSong.audioFile
    ? `${import.meta.env.BASE_URL}${activeSong.audioFile.split('/').map((part) => encodeURIComponent(part)).join('/')}`
    : ''
  const activeLine = activeSong.lines.find((line) => line.id === activeLineId) || activeSong.lines[0]
  const annotations = annotationsBySong[activeSong.id]
  const activeAnnotation = annotations?.find((line) => line.id === activeLine.id)
  const activeLineReading = activeAnnotation?.tokens
    .filter((token) => !token.is_symbol)
    .map((token) => corrections[correctionKey(activeSong.id, activeLine.id, token.index)] || token.reading)
    .filter(Boolean).join(' ') || ''
  const activeTokens = useMemo(
    () => activeAnnotation?.tokens || fallbackTokens(activeLine.text),
    [activeAnnotation, activeLine.text],
  )
  const lexicalActiveTokens = activeTokens.filter((token) => !token.is_symbol)
  const focusToken = lexicalActiveTokens.find((token) => token.index === selectedTokenIndex)
    || lexicalActiveTokens.find((token) => hasKanji(token.surface)) || lexicalActiveTokens[0] || activeTokens[0]
  const focusKey = correctionKey(activeSong.id, activeLine.id, focusToken.index)
  const focusReading = corrections[focusKey] || focusToken.reading
  const meaningKey = `${focusToken.dictionary_form || focusToken.surface}:${focusToken.reading}`
  const wordMeaning = meaningOverrides[meaningKey] || focusToken.meaning || ''
  const learnedLines = new Set((learnedBySong[activeSong.id] || []).filter((lineId) => activeSong.lines.some((line) => line.id === lineId)))
  const progress = activeSong.lines.length ? Math.round((learnedLines.size / activeSong.lines.length) * 100) : 0
  const currentProgress = songProgress(activeSong, learnedBySong[activeSong.id] || [], reviewItems)
  const collectionProgress = libraryProgress(allSongs.filter((song) => !demoSongs.some((demo) => demo.id === song.id)), learnedBySong, reviewItems)
  const isFavorite = favoriteSongIds.includes(activeSong.id)
  const hasReview = reviewItems.some((item) => item.songId === activeSong.id && item.lineId === activeLine.id)
  const currentSongReviewCount = reviewQueue.filter((item) => item.song.id === activeSong.id).length
  const practiceFinished = practiceActive && practiceSessionLineIds.length > 0 && practicePosition >= practiceSessionLineIds.length
  const totalCorrections = Object.keys(corrections).filter((key) => key.startsWith(`${activeSong.id}:`)).length
  const reviewNeeded = annotations?.filter((line) => activeSong.lines.some((lyric) => lyric.id === line.id)).flatMap((line) => line.tokens).filter((token) => token.needs_review).length || 0
  const aiReview = aiReviews[activeSong.id]
  const pendingAiSuggestions = (aiReview?.suggestions || []).filter((suggestion) => activeSong.lines.some((line) => line.id === suggestion.line_id) && !corrections[correctionKey(activeSong.id, suggestion.line_id, suggestion.token_index)])
  const focusSuggestion = pendingAiSuggestions.find((item) => item.line_id === activeLine.id && item.token_index === focusToken.index)
  const currentSentenceCache = sentenceExplanationsBySong[activeSong.id] || {}
  const readySentenceCount = activeSong.lines.filter((line) => hasCachedSentenceExplanation(currentSentenceCache, line)).length
  const activeSongUsage = aiUsageBySong[activeSong.id] || []
  const activeSongCostSummary = Object.entries(activeSongUsage.reduce((totals, item) => {
    const currency = item.currency || 'CNY'
    totals[currency] = (totals[currency] || 0) + (Number(item.estimated_cost) || 0)
    return totals
  }, {})).map(([currency, cost]) => `${currency === 'CNY' ? '¥' : currency} ${cost.toFixed(6)}`).join(' + ') || '¥ 0.000000'

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ learnedBySong, reviewItems, favoriteSongIds, corrections, meaningOverrides, playbackRate }))
  }, [learnedBySong, reviewItems, favoriteSongIds, corrections, meaningOverrides, playbackRate])

  useEffect(() => { localStorage.setItem(ANNOTATION_KEY, JSON.stringify(annotationsBySong)) }, [annotationsBySong])
  useEffect(() => { localStorage.setItem(AI_REVIEW_KEY, JSON.stringify(aiReviews)) }, [aiReviews])
  useEffect(() => { localStorage.setItem(SENTENCE_EXPLANATION_KEY, JSON.stringify(sentenceExplanationsBySong)) }, [sentenceExplanationsBySong])
  useEffect(() => { localStorage.setItem(AI_USAGE_KEY, JSON.stringify(aiUsageBySong)) }, [aiUsageBySong])
  useEffect(() => {
    if (!guideOpen || !window.utaDesktop?.ai) return undefined
    let disposed = false
    window.utaDesktop.ai.settings()
      .then((settings) => { if (!disposed) setGuideAiConfigured(Boolean(settings?.has_api_key)) })
      .catch(() => {})
    return () => { disposed = true }
  }, [guideOpen])
  useEffect(() => {
    if (!window.utaDesktop?.dictionary) return undefined
    let disposed = false
    let lastPhase = ''
    const update = (status, forceOpen = false) => {
      if (disposed || !status) return
      setDictionaryStatus(status)
      setDictionaryPanelOpen((wasOpen) => dictionaryPanelVisible(status, wasOpen, forceOpen))
      if (status.phase === 'ready' && ['downloading', 'installing', 'cancelling'].includes(lastPhase)) setToast('本地词典已安装，可以开始查词。')
      lastPhase = status.phase
    }
    const refresh = () => window.utaDesktop.dictionary.status().then((status) => update(status)).catch(() => {})
    const unsubscribe = window.utaDesktop.dictionary.onStatusChanged((status) => update(status, true))
    refresh()
    const timer = window.setInterval(refresh, 700)
    return () => { disposed = true; window.clearInterval(timer); unsubscribe?.() }
  }, [])
  useEffect(() => {
    let disposed = false
    loadLocalSongs()
      .then((records) => {
        const nextUrls = {}
        records.forEach((record) => { nextUrls[record.id] = URL.createObjectURL(record.audioBlob) })
        if (disposed) {
          Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
          return
        }
        localAudioUrlRef.current = nextUrls
        setLocalAudioUrls(nextUrls)
        setLocalSongs(records.map(({ audioBlob, ...song }) => song))
      })
      .catch(() => { /* Local import is optional; built-in songs remain available. */ })
    return () => { disposed = true }
  }, [])
  useEffect(() => () => {
    Object.values(localAudioUrlRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [])
  useEffect(() => {
    const missingArtwork = localSongs.filter((song) => song.isLocal && !song.artworkUrl && song.title && !artworkLookupRef.current.has(song.id))
    missingArtwork.forEach((song) => {
      artworkLookupRef.current.add(song.id)
      findArtworkWithRetry(song.title, song.artist)
        .then(async (artwork) => {
          if (!artwork) return
          await updateLocalSongMetadata(song.id, artwork)
          setLocalSongs((previous) => previous.map((item) => item.id === song.id ? { ...item, ...artwork } : item))
        })
        .catch(() => { /* The fallback card remains usable if online lookup fails. */ })
    })
  }, [localSongs])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const cached = annotationsBySong[activeSong.id]
    if (cached?.length === activeSong.lines.length) return undefined
    let abandoned = false
    setAnnotating(true)
    setAnnotationError('')
    annotateSongLines(activeSong.lines)
      .then((annotation) => {
        if (!abandoned) setAnnotationsBySong((all) => ({ ...all, [activeSong.id]: annotation }))
      })
      .catch(() => {
        if (!abandoned) setAnnotationError('自动注音服务未连接。请使用 npm.cmd run dev 启动完整学习环境。')
      })
      .finally(() => { if (!abandoned) setAnnotating(false) })
    return () => { abandoned = true }
  }, [activeSong.id, activeSong.lines, annotationsBySong])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    clipEndRef.current = null
    pendingClipRef.current = null
    setPlayingLineId(null)
    setAudioError('')
  }, [activeSong.id])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const finishOnWindow = () => finishTokenSelection()
    window.addEventListener('pointerup', finishOnWindow)
    return () => window.removeEventListener('pointerup', finishOnWindow)
  }, [activeSong.id, annotations])

  useEffect(() => {
    const firstToken = activeTokens.find((token) => !token.is_symbol && hasKanji(token.surface))
      || activeTokens.find((token) => !token.is_symbol) || activeTokens[0]
    if (firstToken) setSelectedTokenIndex((previous) => activeTokens.some((token) => token.index === previous && !token.is_symbol) ? previous : firstToken.index)
  }, [activeSong.id, activeLine.id, activeTokens])

  useEffect(() => { setDraftReading(focusReading) }, [focusKey, focusReading])
  useEffect(() => { setDraftMeaning(wordMeaning) }, [meaningKey, wordMeaning])

  function stopLinePlayback() {
    audioRef.current?.pause()
    clipEndRef.current = null
    pendingClipRef.current = null
    setPlayingLineId(null)
  }

  function chooseSong(songId) {
    stopLinePlayback()
    setActiveSongId(songId)
    setActiveLineId(0)
    setPracticeActive(false)
    setPracticeRevealed(false)
    setSelectedText(null)
    dragSelectionRef.current = null
    setDragSelection(null)
    setSelectedPhraseRange(null)
    setAiExplanation(null)
    setAiError('')
    setSentenceExplanationOpen(null)
    setSentenceExplanationError(null)
    setToast('已切换歌词，正在准备自动读音。')
  }

  function chooseLine(lineId) { setActiveLineId(lineId) }

  function startPractice(scope = 'all', songId = activeSong.id, targetLineId = null) {
    const song = allSongs.find((item) => item.id === songId)
    if (!song) return
    const { lineIds, position } = createPracticeSession(song, scope, reviewItems, targetLineId)
    if (!lineIds.length) {
      setToast('这首歌还没有待复习的句子。')
      return
    }
    stopLinePlayback()
    if (songId !== activeSong.id) chooseSong(songId)
    setPracticeReturnPage(activePage === 'review' ? 'review' : practiceActive ? practiceReturnPage : 'lesson')
    setActivePage(scope === 'review' && (activePage === 'review' || practiceReturnPage === 'review' && practiceActive) ? 'review' : 'lesson')
    setPracticeScope(scope)
    setPracticeSessionLineIds(lineIds)
    setPracticePosition(position)
    setActiveLineId(lineIds[position])
    setPracticeRevealed(false)
    setSentenceExplanationOpen(null)
    setPracticeActive(true)
  }

  useEffect(() => {
    if (!practiceActive || !['lesson', 'review'].includes(activePage)) return
    const frame = window.requestAnimationFrame(() => document.getElementById('guided-practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [activePage, practiceActive, activeSong.id, practicePosition])

  function goToPracticePosition(position) {
    const lineId = practiceSessionLineIds[position]
    if (lineId == null) return
    stopLinePlayback()
    setPracticePosition(position)
    setActiveLineId(lineId)
    setPracticeRevealed(false)
    setSentenceExplanationOpen(null)
  }

  function gradePracticeLine(learned) {
    if (!practiceRevealed || practiceFinished) return
    const lineId = practiceSessionLineIds[practicePosition]
    const line = activeSong.lines.find((item) => item.id === lineId)
    if (!line) return
    setLearnedBySong((previous) => {
      const next = new Set(previous[activeSong.id] || [])
      if (learned) next.add(lineId)
      else next.delete(lineId)
      return { ...previous, [activeSong.id]: [...next] }
    })
    setReviewItems((previous) => {
      const remaining = previous.filter((item) => !(item.songId === activeSong.id && item.lineId === lineId))
      return learned ? remaining : [...remaining, { songId: activeSong.id, lineId, text: line.text }]
    })
    if (practicePosition + 1 < practiceSessionLineIds.length) {
      goToPracticePosition(practicePosition + 1)
      setToast(learned ? '已标记掌握，继续下一句。' : '已加入复习清单，继续下一句。')
    } else {
      stopLinePlayback()
      setPracticePosition(practiceSessionLineIds.length)
      setPracticeRevealed(false)
      setToast(learned ? '本轮练习完成。' : '本轮练习完成，错句已加入复习清单。')
    }
  }

  function exitPractice() {
    stopLinePlayback()
    setPracticeActive(false)
    setPracticeRevealed(false)
    setActivePage(practiceReturnPage)
  }

  function chooseSongFromLibrary(songId) {
    chooseSong(songId)
    setActivePage('lesson')
    window.requestAnimationFrame(() => {
      document.getElementById('lesson')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function showLessonPage() {
    setActivePage('lesson')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  function showReviewQueue() {
    stopLinePlayback()
    setPracticeActive(false)
    setPracticeRevealed(false)
    setDetailOpen(false)
    setActivePage('review')
    window.requestAnimationFrame(() => document.getElementById('review-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function showLibraryPage({ focusSearch = false } = {}) {
    stopLinePlayback()
    setPracticeActive(false)
    setPracticeRevealed(false)
    setDetailOpen(false)
    setActivePage('library')
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (focusSearch) window.setTimeout(() => document.getElementById('library-search')?.focus(), 100)
    })
  }

  function openImportDialog() {
    setImportError('')
    setImportOpen(true)
  }

  function dismissQuickStart() {
    setGuideOpen(false)
    localStorage.setItem(GUIDE_DISMISSED_KEY, '1')
  }

  function openGuideSettings() {
    setGuideOpen(false)
    openAiSettings()
  }

  function openGuideImport() {
    setGuideOpen(false)
    showLibraryPage()
    openImportDialog()
  }

  function closeImportDialog() {
    if (importBusy) return
    importPreviewRequestRef.current += 1
    importArtworkRequestRef.current += 1
    setImportOpen(false)
    setImportLrcFile(null)
    setImportAudioFile(null)
    setImportDraft(null)
    setImportPreparing(false)
    setImportArtworkStatus('idle')
    setImportArtwork(null)
    setImportArtworkUrl('')
    setImportError('')
  }

  async function searchImportArtwork(title, artist) {
    const requestId = ++importArtworkRequestRef.current
    if (!title.trim()) {
      setImportArtworkStatus('idle')
      return
    }
    setImportArtworkStatus('loading')
    setImportArtwork(null)
    setImportArtworkUrl('')
    const artwork = await findArtworkWithRetry(title.trim(), artist.trim())
    if (requestId !== importArtworkRequestRef.current) return
    setImportArtwork(artwork)
    setImportArtworkUrl(artwork?.artworkUrl || '')
    setImportArtworkStatus(artwork ? 'found' : 'none')
  }

  async function prepareLrcPreview(file) {
    const requestId = ++importPreviewRequestRef.current
    importArtworkRequestRef.current += 1
    setImportLrcFile(file)
    setImportDraft(null)
    setImportArtwork(null)
    setImportArtworkUrl('')
    setImportArtworkStatus('idle')
    setImportError('')
    if (!file) { setImportPreparing(false); return }
    setImportPreparing(true)
    try {
      const parsed = await parseLrcFile(file)
      if (requestId !== importPreviewRequestRef.current) return
      setImportDraft({
        ...parsed,
        lines: parsed.lines.map((line) => ({ ...line, draftId: `parsed-${line.id}`, timeText: formatLrcTimestamp(line.start) })),
      })
      setImportPreparing(false)
      void searchImportArtwork(parsed.title, parsed.artist)
    } catch (error) {
      if (requestId !== importPreviewRequestRef.current) return
      setImportError(error instanceof Error ? error.message : '无法解析这份 LRC 歌词。')
      setImportPreparing(false)
    }
  }

  function updateImportMetadata(field, value) {
    setImportDraft((previous) => previous ? { ...previous, [field]: value } : previous)
    if (importArtworkStatus !== 'manual' && importArtworkStatus !== 'default') {
      importArtworkRequestRef.current += 1
      setImportArtwork(null)
      setImportArtworkUrl('')
      setImportArtworkStatus('idle')
    }
  }

  function updateImportLine(draftId, field, value) {
    setImportDraft((previous) => previous ? {
      ...previous,
      lines: previous.lines.map((line) => line.draftId === draftId ? { ...line, [field]: value } : line),
    } : previous)
  }

  function addImportLine() {
    setImportDraft((previous) => {
      if (!previous) return previous
      const lastLine = previous.lines.at(-1)
      const lastStart = parseLrcTimestamp(lastLine?.timeText) ?? 0
      return {
        ...previous,
        lines: [...previous.lines, {
          draftId: globalThis.crypto?.randomUUID?.() || `new-${Date.now()}`,
          timeText: formatLrcTimestamp(lastStart + 5), text: '', translation: '',
        }],
      }
    })
  }

  function removeImportLine(draftId) {
    setImportDraft((previous) => previous ? { ...previous, lines: previous.lines.filter((line) => line.draftId !== draftId) } : previous)
  }

  function useDefaultImportArtwork() {
    importArtworkRequestRef.current += 1
    setImportArtwork(null)
    setImportArtworkUrl('')
    setImportArtworkStatus('default')
  }

  function changeImportArtworkUrl(value) {
    importArtworkRequestRef.current += 1
    setImportArtwork(null)
    setImportArtworkUrl(value)
    setImportArtworkStatus(value.trim() ? 'manual' : 'idle')
  }

  function focusLibrarySearch() {
    showLibraryPage({ focusSearch: true })
  }

  function recordBilling(songId, billing, action) {
    if (!billing?.billed_request) return
    setAiUsageBySong((previous) => ({
      ...previous,
      [songId]: [...(previous[songId] || []), { ...billing, action, recordedAt: new Date().toISOString() }],
    }))
  }

  async function generateSentenceExplanations(song, requestedLines = song.lines, onProgress) {
    const cache = { ...(sentenceExplanationsBySong[song.id] || {}) }
    const pending = requestedLines.filter((line) => !hasCachedSentenceExplanation(cache, line))
    const countReady = () => song.lines.filter((line) => hasCachedSentenceExplanation(cache, line)).length
    if (!pending.length) return { cache, complete: true, ready: countReady(), error: '' }
    if (sentenceExplanationJobRef.current) {
      return { cache, complete: false, ready: countReady(), error: '已有一首歌曲正在生成解析，请稍后重试。' }
    }
    sentenceExplanationJobRef.current = song.id
    setSentenceExplanationError(null)
    setSentenceExplanationJob({ songId: song.id, ready: countReady(), total: song.lines.length })
    onProgress?.(countReady(), song.lines.length)
    let failure = ''
    try {
      for (let offset = 0; offset < pending.length; offset += SENTENCE_BATCH_SIZE) {
        const batch = pending.slice(offset, offset + SENTENCE_BATCH_SIZE)
        const contextLines = batch.map((line) => {
          const index = song.lines.findIndex((item) => item.id === line.id)
          return {
            id: line.id, text: line.text, translation: line.translation || '',
            previous_line: song.lines[index - 1]?.text || '',
            next_line: song.lines[index + 1]?.text || '',
          }
        })
        try {
          const result = await explainSentenceBatchWithAi(contextLines)
          recordBilling(song.id, result.billing, 'sentence-explanations')
          const knownIds = new Set(batch.map((line) => line.id))
          const lineById = new Map(batch.map((line) => [line.id, line]))
          for (const explanation of result.explanations || []) {
            if (!knownIds.has(explanation.line_id) || !explanation.meaning) continue
            const line = lineById.get(explanation.line_id)
            cache[line.id] = { text: line.text, explanation }
          }
          setSentenceExplanationsBySong((previous) => ({ ...previous, [song.id]: { ...(previous[song.id] || {}), ...cache } }))
          const ready = countReady()
          setSentenceExplanationJob({ songId: song.id, ready, total: song.lines.length })
          onProgress?.(ready, song.lines.length)
        } catch (error) {
          failure = error instanceof Error ? error.message : 'AI 整句解析暂时不可用。'
          break
        }
      }
      const complete = requestedLines.every((line) => hasCachedSentenceExplanation(cache, line))
      if (!complete && !failure) failure = '部分句子的解析未生成，可稍后重试。'
      if (failure) setSentenceExplanationError({ songId: song.id, message: failure })
      return { cache, complete, ready: countReady(), error: failure }
    } finally {
      sentenceExplanationJobRef.current = null
      setSentenceExplanationJob(null)
    }
  }

  async function showSentenceExplanation(line) {
    const songId = activeSong.id
    if (sentenceExplanationOpen?.songId === songId && sentenceExplanationOpen.line.id === line.id) {
      setSentenceExplanationOpen(null)
      return
    }
    const cached = sentenceExplanationsBySong[activeSong.id]?.[line.id]
    if (hasCachedSentenceExplanation(sentenceExplanationsBySong[activeSong.id], line)) {
      setSentenceExplanationOpen({ songId, line, explanation: cached.explanation })
      return
    }
    const result = await generateSentenceExplanations(activeSong, [line])
    const prepared = result.cache[line.id]
    if (hasCachedSentenceExplanation(result.cache, line)) setSentenceExplanationOpen({ songId, line, explanation: prepared.explanation })
    else setToast(result.error || '这句的解析暂未生成，请稍后重试。')
  }

  async function generateCurrentSongExplanations() {
    const result = await generateSentenceExplanations(activeSong)
    setToast(result.complete ? `《${activeSong.title}》的 ${result.ready} 句解析已准备好。`
      : `${result.error || '部分句子未完成'}：已准备 ${result.ready} / ${activeSong.lines.length} 句，可重试。`)
  }

  async function exportLearningData() {
    if (backupBusy) return
    setBackupBusy('export')
    setBackupError('')
    try {
      const records = await loadLocalSongs()
      const progressState = { learnedBySong, reviewItems, favoriteSongIds, corrections, meaningOverrides, playbackRate }
      const blob = createLearningBackup(records, {
        progress: progressState, annotations: annotationsBySong, aiReviews,
        sentenceExplanations: sentenceExplanationsBySong, aiUsage: aiUsageBySong,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `UTA-学习备份-${new Date().toISOString().slice(0, 10)}.uta-backup`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      setToast(`备份已生成：${records.length} 首网页导入歌曲及学习数据。请妥善保管下载的文件。`)
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '生成备份失败。')
    } finally {
      setBackupBusy('')
    }
  }

  async function exportCurrentSongAnalysis() {
    try {
      const blob = await createSongAnalysisFile(activeSong, sentenceExplanationsBySong[activeSong.id], activeSongUsage)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `UTA-${activeSong.title.replace(/[\\/:*?"<>|]/g, '-')}-解析.uta-analysis`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      setToast('共享解析已导出：不含 API Key、音频和歌词正文。')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导出共享解析失败。')
    }
  }

  async function importSharedAnalysis(file) {
    if (!file) return
    try {
      const imported = await importSongAnalysisFile(file, allSongs)
      setSentenceExplanationsBySong((previous) => ({
        ...previous,
        [imported.song.id]: { ...(previous[imported.song.id] || {}), ...imported.entries },
      }))
      setToast(`已为《${imported.song.title}》导入 ${Object.keys(imported.entries).length} 句共享解析，不计入本机费用。`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导入共享解析失败。')
    }
  }

  async function openAiSettings() {
    if (!window.utaDesktop?.ai) {
      setToast('AI 供应商设置仅在桌面版中提供。')
      return
    }
    setAiSettingsOpen(true)
    if (aiSettings) return
    setAiSettingsBusy('load')
    setAiSettingsError('')
    try {
      const loaded = await window.utaDesktop.ai.settings()
      setAiSettings(loaded)
      void refreshAiModels(loaded, true)
    }
    catch (error) { setAiSettingsError(error instanceof Error ? error.message : '无法读取 AI 设置。') }
    finally { setAiSettingsBusy('') }
  }

  async function refreshAiModels(settingsOverride = aiSettings, quiet = false) {
    if (!settingsOverride) return
    const version = ++modelRefreshVersion.current
    setModelsRefreshing(true)
    setAiSettingsError('')
    try {
      const result = await window.utaDesktop.ai.models(settingsOverride)
      if (version !== modelRefreshVersion.current) return
      const models = result.models || []
      setAiModels(models)
      setAiSettings(previous => reconcileModelCatalog(previous, settingsOverride.provider, models))
      if (!quiet) setToast(`已从供应商识别 ${models.length} 个模型。`)
    } catch (error) { if (version === modelRefreshVersion.current) setAiSettingsError(error instanceof Error ? error.message : '模型列表读取失败。') }
    finally { if (version === modelRefreshVersion.current) setModelsRefreshing(false) }
  }

  useEffect(() => {
    if (!window.utaDesktop?.ai) return
    let disposed = false
    window.utaDesktop.ai.settings().then(loaded => {
      if (disposed) return
      setAiSettings(previous => previous || loaded)
      void refreshAiModels(loaded, true)
    }).catch(() => {})
    return () => { disposed = true; modelRefreshVersion.current++ }
  }, [])

  useEffect(() => {
    if (!aiSettingsOpen) return
    const closeOnEscape = event => { if (event.key === 'Escape') setAiSettingsOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [aiSettingsOpen])

  async function saveAiConfiguration(event) {
    event.preventDefault()
    setAiSettingsBusy('save')
    setAiSettingsError('')
    try {
      const saved = await window.utaDesktop.ai.saveSettings(aiSettings)
      setAiSettings(saved)
      setGuideAiConfigured(Boolean(saved.has_api_key))
      setToast('AI 供应商与模型设置已保存在本机。')
      setAiSettingsOpen(false)
    } catch (error) { setAiSettingsError(error instanceof Error ? error.message : 'AI 设置保存失败。') }
    finally { setAiSettingsBusy('') }
  }

  function selectAiProvider(provider) {
    setShowAllModels(false)
    setModelSearch('')
    const defaults = aiSettings.provider_defaults?.[provider] || {}
    const nextSettings = { ...aiSettings, provider, base_url: defaults.base_url || '', model: defaults.model || '', api_key: '', selected_key_id: '', has_api_key: false, input_price: 0, cached_input_price: 0, output_price: 0, currency: 'CNY', pricing_source: '未获取' }
    setAiSettings(nextSettings)
    setAiModels([])
    refreshAiModels(nextSettings, true)
  }

  function selectDiscoveredModel(modelId) {
    const discovered = aiModels.find((item) => item.id === modelId)
    setAiSettings((previous) => ({
      ...previous,
      model: modelId,
      ...(discovered?.input_price != null ? { input_price: discovered.input_price } : {}),
      ...(discovered?.cached_input_price != null ? { cached_input_price: discovered.cached_input_price } : {}),
      ...(discovered?.output_price != null ? { output_price: discovered.output_price } : {}),
      currency: 'CNY',
      pricing_source: discovered?.pricing_source || '供应商未提供',
    }))
  }

  function selectSavedKey(keyId) {
    const next = { ...aiSettings, selected_key_id: keyId, api_key: '', has_api_key: Boolean(keyId) }
    setAiSettings(next)
    refreshAiModels(next, true)
  }

  async function deleteSavedKey() {
    if (!aiSettings.selected_key_id || !window.confirm('删除这个本机 API Key？删除后需要重新填写才能使用。')) return
    setAiSettingsBusy('save')
    try {
      const saved = await window.utaDesktop.ai.saveSettings({ ...aiSettings, api_key: '', selected_key_id: '', delete_key_id: aiSettings.selected_key_id })
      setAiSettings(saved)
      setGuideAiConfigured(false)
      setToast('已删除本机 Key。请选择其他账号或新增。')
      await refreshAiModels(saved, true)
    } catch (error) { setAiSettingsError(error.message) }
    finally { setAiSettingsBusy('') }
  }

  async function runDictionaryAction(action) {
    if (!window.utaDesktop?.dictionary) return
    try {
      const status = await window.utaDesktop.dictionary[action]()
      if (status) {
        setDictionaryStatus(status)
        setDictionaryPanelOpen((wasOpen) => dictionaryPanelVisible(status, wasOpen, true))
      }
    } catch (error) {
      setDictionaryStatus((previous) => ({ ...(previous || {}), phase: 'error', error: error instanceof Error ? error.message : '词典操作失败。' }))
      setDictionaryPanelOpen(true)
    }
  }

  async function prepareBackupRestore(file) {
    if (backupBusy || !file) return
    setBackupBusy('inspect')
    setBackupPreview(null)
    setBackupError('')
    try {
      setBackupPreview(await inspectLearningBackup(file))
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '无法读取备份文件。')
    } finally {
      setBackupBusy('')
    }
  }

  async function restoreLearningData() {
    if (!backupPreview || backupBusy) return
    if (!window.confirm('这会用备份中的歌曲和学习记录覆盖当前浏览器的数据。建议先导出当前备份。确定继续吗？')) return
    setBackupBusy('restore')
    setBackupError('')
    const previousStorage = Object.fromEntries(Object.values(BACKUP_STORAGE_KEYS).map((key) => [key, localStorage.getItem(key)]))
    let previousSongs = null
    try {
      const { manifest } = backupPreview
      const restoredStorage = {
        [PROGRESS_KEY]: JSON.stringify(manifest.progress),
        [ANNOTATION_KEY]: JSON.stringify(manifest.annotations),
        [AI_REVIEW_KEY]: JSON.stringify(manifest.aiReviews),
        [SENTENCE_EXPLANATION_KEY]: JSON.stringify(manifest.sentenceExplanations),
        [AI_USAGE_KEY]: JSON.stringify(manifest.aiUsage || {}),
      }
      previousSongs = await loadLocalSongs()
      await replaceLocalSongs(songsFromLearningBackup(backupPreview))
      try {
        Object.entries(restoredStorage).forEach(([key, value]) => localStorage.setItem(key, value))
      } catch (error) {
        let rollbackFailed = false
        try {
          Object.keys(previousStorage).forEach((key) => localStorage.removeItem(key))
          Object.entries(previousStorage).forEach(([key, value]) => { if (value !== null) localStorage.setItem(key, value) })
        } catch { rollbackFailed = true }
        try { await replaceLocalSongs(previousSongs) } catch { rollbackFailed = true }
        if (rollbackFailed) throw new Error('恢复未完成，且自动回滚失败。请不要清除浏览器数据，并用原备份重试。')
        throw error
      }
      window.location.reload()
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '恢复失败，原有数据未更改。')
      setBackupBusy('')
    }
  }

  async function importLocalSong() {
    if (!importLrcFile || !importAudioFile || !importDraft) {
      setImportError('请选择一个 LRC 歌词文件和一个音频文件。')
      return
    }
    if (importArtworkStatus === 'idle' || importArtworkStatus === 'loading') {
      setImportError('请等待封面查询完成，或选择使用默认封面。')
      return
    }
    const title = importDraft.title.trim()
    const artist = importDraft.artist.trim() || '本地导入'
    if (!title) { setImportError('请填写歌曲名。'); return }
    const lines = []
    for (const [index, line] of importDraft.lines.entries()) {
      const start = parseLrcTimestamp(line.timeText)
      const text = line.text.trim().replace(/\s+/g, ' ')
      if (start == null) { setImportError(`第 ${index + 1} 行的时间戳无效，请使用 00:12.345 格式。`); return }
      if (!text) { setImportError(`第 ${index + 1} 行缺少日文歌词。`); return }
      if (!isSongHeadingLine(text, title, artist)) lines.push({ start, text, translation: line.translation.trim() })
    }
    if (!lines.length) { setImportError('预览中没有可学习的歌词句子。'); return }
    if (importArtworkStatus === 'manual') {
      try {
        const coverUrl = new URL(importArtworkUrl.trim())
        if (!['http:', 'https:'].includes(coverUrl.protocol)) throw new Error('invalid URL')
      } catch { setImportError('封面链接需要是有效的 http 或 https 地址。'); return }
    }
    lines.sort((left, right) => left.start - right.start)
    const parsed = {
      title, artist, album: importDraft.album || '', sourceFile: importLrcFile.name,
      duration: lines.at(-1).start,
      lines: lines.map((line, id) => ({ id, ...line })),
    }
    const artwork = importArtworkStatus === 'found' ? importArtwork
      : importArtworkStatus === 'manual' ? { artworkUrl: importArtworkUrl.trim(), artworkSourceUrl: '', artworkProvider: '手动填写' }
      : null
    setImportBusy(true)
    setImportAiProgress(null)
    setImportError('')
    try {
      const record = await createAndStoreLocalSong(parsed, importAudioFile, artwork || {})
      const { audioBlob, ...song } = record
      const audioObjectUrl = URL.createObjectURL(audioBlob)
      localAudioUrlRef.current = { ...localAudioUrlRef.current, [song.id]: audioObjectUrl }
      setLocalSongs((previous) => [song, ...previous])
      setLocalAudioUrls((previous) => ({ ...previous, [song.id]: audioObjectUrl }))
      setImportLrcFile(null)
      setImportAudioFile(null)
      setImportDraft(null)
      setImportAiProgress(null)
      setImportArtworkStatus('idle')
      setImportArtwork(null)
      setImportArtworkUrl('')
      setImportOpen(false)
      chooseSongFromLibrary(song.id)
      setToast(`已导入《${song.title}》，可以开始听读；AI 解析可在学习页按需生成。`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败，请检查歌词和音频文件。')
      setImportAiProgress(null)
    } finally {
      setImportBusy(false)
    }
  }

  async function removeImportedSong(song) {
    if (!song.isLocal || deletingSongId) return
    if (!window.confirm(`确定删除《${song.title}》吗？歌词、音频和这首歌的学习进度都会从当前浏览器移除。`)) return
    setDeletingSongId(song.id)
    try {
      await deleteLocalSong(song.id)
      const audioObjectUrl = localAudioUrlRef.current[song.id]
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl)
      const { [song.id]: removedUrl, ...remainingUrls } = localAudioUrlRef.current
      localAudioUrlRef.current = remainingUrls
      setLocalAudioUrls(remainingUrls)
      setLocalSongs((previous) => previous.filter((item) => item.id !== song.id))
      setAnnotationsBySong((previous) => { const { [song.id]: removed, ...rest } = previous; return rest })
      setAiReviews((previous) => { const { [song.id]: removed, ...rest } = previous; return rest })
      setSentenceExplanationsBySong((previous) => { const { [song.id]: removed, ...rest } = previous; return rest })
      setLearnedBySong((previous) => { const { [song.id]: removed, ...rest } = previous; return rest })
      setReviewItems((previous) => previous.filter((item) => item.songId !== song.id))
      setFavoriteSongIds((previous) => previous.filter((songId) => songId !== song.id))
      setCorrections((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${song.id}:`))))
      if (song.id === activeSong.id) {
        const nextSong = allSongs.find((item) => item.id !== song.id) || initialSong()
        chooseSong(nextSong.id)
      }
      setToast(`已删除《${song.title}》及其本机保存的数据。`)
    } catch {
      setToast('删除失败：浏览器未能更新本地歌曲库。')
    } finally {
      setDeletingSongId('')
    }
  }

  function choosePlaybackRate(nextRate) {
    setPlaybackRate(nextRate)
    setToast(`已切换为 ${nextRate}× 速度播放。`)
  }

  function startClipPlayback(clip) {
    const audio = audioRef.current
    if (!audio) return
    if (Number.isFinite(audio.duration) && clip.start >= audio.duration - 0.05) {
      setPlayingLineId(null)
      setAudioError('这句 LRC 的时间戳超过了音频时长，请检查歌词时间。')
      return
    }
    const fallbackEnd = Number.isFinite(audio.duration) ? audio.duration : clip.start + 8
    clipEndRef.current = Math.max(clip.start + 0.12, clip.end ?? fallbackEnd)
    audio.muted = false
    if (audio.volume === 0) audio.volume = 1
    audio.playbackRate = playbackRate
    try { audio.currentTime = clip.start } catch { /* Wait for metadata if the browser has not seeked yet. */ }
    audio.play()
      .then(() => { setPlayingLineId(clip.lineId); setAudioError('') })
      .catch((error) => {
        setPlayingLineId(null)
        setAudioError(error?.name === 'NotSupportedError' ? '该音频编码不受支持，请改用 MP3、M4A、WAV 或 OGG。' : '未能开始播放；请检查系统输出设备与应用音量。')
      })
  }

  function playLine(lineId) {
    if (!audioUrl) {
      setAudioError('当前示例不附带音频。请在歌曲库导入自己的 LRC 与音频文件。')
      return
    }
    const lineIndex = activeSong.lines.findIndex((line) => line.id === lineId)
    const line = activeSong.lines[lineIndex]
    const audio = audioRef.current
    if (!line || !audio) return
    if (playingLineId === lineId && !audio.paused) {
      audio.pause()
      setPlayingLineId(null)
      return
    }
    const nextStart = activeSong.lines[lineIndex + 1]?.start
    const clip = {
      lineId,
      // LRC marks often land just after the initial consonant. Start a little
      // early so learners hear the complete onset of the sung line.
      start: Math.max(0, (line.start || 0) - LINE_PLAYBACK_LEAD_IN_SECONDS),
      end: Number.isFinite(nextStart) ? nextStart : null,
    }
    if (audio.readyState < 1) {
      pendingClipRef.current = clip
      audio.load()
      return
    }
    startClipPlayback(clip)
  }

  function handleAudioLoadedMetadata() {
    const clip = pendingClipRef.current
    if (!clip) return
    pendingClipRef.current = null
    startClipPlayback(clip)
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current
    if (!audio || clipEndRef.current == null || audio.currentTime < clipEndRef.current - 0.04) return
    audio.pause()
    audio.currentTime = clipEndRef.current
    clipEndRef.current = null
    setPlayingLineId(null)
  }

  function toggleLearnedLine(lineId) {
    const willLearn = !learnedLines.has(lineId)
    setLearnedBySong((previous) => {
      const next = new Set(previous[activeSong.id] || [])
      if (willLearn) next.add(lineId)
      else next.delete(lineId)
      return { ...previous, [activeSong.id]: [...next] }
    })
    if (willLearn) setReviewItems((previous) => previous.filter((item) => !(item.songId === activeSong.id && item.lineId === lineId)))
    setToast(willLearn ? '本句已标记为掌握。' : '本句已改为未掌握。')
  }

  function toggleFavorite() {
    setFavoriteSongIds((previous) => previous.includes(activeSong.id)
      ? previous.filter((id) => id !== activeSong.id) : [...previous, activeSong.id])
    setToast(isFavorite ? '已从收藏中移除。' : `已收藏《${activeSong.title}》。`)
  }

  function toggleReview() {
    setReviewItems((previous) => hasReview
      ? previous.filter((item) => !(item.songId === activeSong.id && item.lineId === activeLine.id))
      : [...previous, { songId: activeSong.id, lineId: activeLine.id, text: activeLine.text }])
    if (!hasReview) setLearnedBySong((previous) => ({ ...previous, [activeSong.id]: (previous[activeSong.id] || []).filter((lineId) => lineId !== activeLine.id) }))
    setToast(hasReview ? '已移出复习清单。' : '本句已加入今日复习。')
  }

  function saveCorrection() {
    const nextReading = draftReading.trim()
    if (!nextReading) { setToast('读音不能为空。'); return }
    setCorrections((previous) => ({ ...previous, [focusKey]: nextReading }))
    setToast(`已保存「${focusToken.surface}」的读音修正。`)
  }

  function resetCorrection() {
    setCorrections((previous) => {
      const { [focusKey]: ignored, ...rest } = previous
      return rest
    })
    setToast('已恢复词典自动读音。')
  }

  function saveMeaning() {
    const nextMeaning = draftMeaning.trim()
    if (!nextMeaning) { setToast('常用意思不能为空。'); return }
    setMeaningOverrides((previous) => ({ ...previous, [meaningKey]: nextMeaning }))
    setToast(`已保存「${focusToken.surface}」的常用意思。`)
  }

  function openWordDetails() {
    setEditingReadings(false)
    setDetailView('word')
    setAiExplanation(null)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailView('word')
  }

  function applySegmentation(replacement) {
    const range = selectedPhraseRange || { startIndex: focusToken.index, endIndex: focusToken.index }
    const selected = activeTokens.filter(token => token.index >= Math.min(range.startIndex, range.endIndex) && token.index <= Math.max(range.startIndex, range.endIndex))
    if (replacement.map(token => token.surface).join('') !== selected.map(token => token.surface).join('')) return
    const undoKey = `${activeSong.id}:${activeLine.id}`
    setSegmentationUndo(previous => ({ ...previous, [undoKey]: { tokens: activeTokens, corrections: Object.fromEntries(Object.entries(corrections).filter(([key]) => key.startsWith(`${undoKey}:`))) } }))
    let nextIndex = Math.max(...activeTokens.map(token => token.index)) + 1
    let offset = 0
    const originalByOffset = new Map(selected.map(token => { const start = offset; offset += token.surface.length; return [start, token] }))
    offset = 0
    const updated = replacement.map(token => {
      const original = originalByOffset.get(offset)
      offset += token.surface.length
      return { ...token, index: original?.surface === token.surface ? original.index : nextIndex++ }
    })
    const selectedIds = new Set(selected.map(token => token.index))
    const next = activeTokens.flatMap(token => token.index === selected[0].index ? updated : selectedIds.has(token.index) ? [] : [{ ...token }])
    const indexMap = new Map(next.map((token, index) => [token.index, index]))
    next.forEach((token, index) => { token.index = index })
    setCorrections(previous => Object.fromEntries(Object.entries(previous).flatMap(([key, value]) => {
      if (!key.startsWith(`${undoKey}:`)) return [[key, value]]
      const mapped = indexMap.get(Number(key.slice(undoKey.length + 1)))
      return mapped === undefined ? [] : [[`${undoKey}:${mapped}`, value]]
    })))
    setAnnotationsBySong(previous => ({ ...previous, [activeSong.id]: (previous[activeSong.id] || activeSong.lines.map(line => ({ id: line.id, tokens: line.id === activeLine.id ? activeTokens : fallbackTokens(line.text) }))).map(line => line.id === activeLine.id ? { ...line, tokens: next } : line) }))
    setSelectedPhraseRange(null); setSelectedText(null); setSelectedTokenIndex(updated[0].index)
    setToast('分词已更新并重新查词；未改变词边界的人工读音已保留。')
  }

  function undoSegmentation() {
    const key = `${activeSong.id}:${activeLine.id}`
    const saved = segmentationUndo[key]
    if (!saved) return
    setAnnotationsBySong(previous => ({ ...previous, [activeSong.id]: previous[activeSong.id].map(line => line.id === activeLine.id ? { ...line, tokens: saved.tokens } : line) }))
    setCorrections(previous => ({ ...Object.fromEntries(Object.entries(previous).filter(([item]) => !item.startsWith(`${key}:`))), ...saved.corrections }))
    setSegmentationUndo(previous => { const next = { ...previous }; delete next[key]; return next })
    setSelectedPhraseRange(null); setSelectedText(null); setSelectedTokenIndex(saved.tokens.find(token => !token.is_symbol)?.index || 0)
    setToast('已撤销分词，恢复原来的读音修正。')
  }

  function savePhraseCorrection() {
    if (!selectedPhraseRange) return
    try {
      const range = selectedPhraseRange
      const next = mergeSelectedTokens(activeTokens, range.startIndex, range.endIndex, phraseReading, phraseMeaning)
      const selectedIndices = activeTokens.filter((token) => token.index >= Math.min(range.startIndex, range.endIndex) && token.index <= Math.max(range.startIndex, range.endIndex)).map((token) => correctionKey(activeSong.id, activeLine.id, token.index))
      const merged = next.find((token) => token.index === Math.min(range.startIndex, range.endIndex))
      if (merged) merged.user_merge_original_corrections = Object.fromEntries(Object.entries(corrections).filter(([key]) => selectedIndices.includes(key)))
      setAnnotationsBySong((previous) => ({ ...previous, [activeSong.id]: previous[activeSong.id].map((line) => line.id === activeLine.id ? { ...line, tokens: next } : line) }))
      setSelectedTokenIndex(Math.min(range.startIndex, range.endIndex))
      setCorrections((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !activeTokens.filter((token) => token.index >= Math.min(range.startIndex, range.endIndex) && token.index <= Math.max(range.startIndex, range.endIndex)).some((token) => key === correctionKey(activeSong.id, activeLine.id, token.index)))))
      setCorrections((previous) => ({ ...previous, [correctionKey(activeSong.id, activeLine.id, Math.min(range.startIndex, range.endIndex))]: phraseReading.trim() }))
      setSelectedPhraseRange(null)
      setSelectedText(null)
      setToast('词组已合并，使用你的读音和释义；可随时恢复分词。')
    } catch (error) { setToast(error.message) }
  }

  function restorePhraseCorrection() {
    const next = restoreMergedToken(activeTokens, focusToken.index)
    const originalKeys = (focusToken.user_merge_original || []).map((token) => correctionKey(activeSong.id, activeLine.id, token.index))
    setCorrections((previous) => ({ ...Object.fromEntries(Object.entries(previous).filter(([key]) => !originalKeys.includes(key))), ...focusToken.user_merge_original_corrections }))
    setAnnotationsBySong((previous) => ({ ...previous, [activeSong.id]: previous[activeSong.id].map((line) => line.id === activeLine.id ? { ...line, tokens: next } : line) }))
    setToast('已恢复原来的分词。')
  }

  useEffect(() => {
    const preferences = normalizeReadingPreferences(readingPreferences)
    document.documentElement.style.setProperty('--ui-font-size', `${preferences.interfaceSize}px`)
    document.documentElement.style.setProperty('--lyric-font-size', `${preferences.lyricSize}px`)
    document.documentElement.dataset.motion = preferences.motion
    localStorage.setItem('uta-reading-preferences-v1', JSON.stringify(preferences))
  }, [readingPreferences])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (readingPreferences.motion === 'off' || readingPreferences.motion === 'system' && systemReducedMotion) return
    const animation = pageRef.current?.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' })
    return () => animation?.cancel()
  }, [activePage, readingPreferences.motion, systemReducedMotion])

  async function runAiReview() {
    setAiBusy('review')
    setAiError('')
    try {
      const result = await reviewSongWithAi(activeSong)
      recordBilling(activeSong.id, result.billing, 'reading-review')
      setAiReviews((previous) => ({ ...previous, [activeSong.id]: { ...result, reviewedAt: Date.now() } }))
      setToast(result.suggestions?.length ? `AI 标出了 ${result.suggestions.length} 处待确认读音。` : 'AI 未发现明显需要复核的读音。')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 复核暂时不可用。'
      setAiError(message)
      setToast(message)
    } finally {
      setAiBusy('')
    }
  }

  function applyAiSuggestion() {
    if (!focusSuggestion) return
    setDraftReading(focusSuggestion.suggested_reading)
    setCorrections((previous) => ({ ...previous, [focusKey]: focusSuggestion.suggested_reading }))
    setToast(`已采用建议读音「${focusSuggestion.suggested_reading}」，仍可继续修改。`)
  }

  function beginTokenSelection(lineId, tokenIndex) {
    const next = { lineId, startIndex: tokenIndex, endIndex: tokenIndex }
    dragSelectionRef.current = next
    setDragSelection(next)
    setSelectedPhraseRange(null)
    setSelectedText(null)
  }

  function extendTokenSelection(lineId, tokenIndex) {
    const current = dragSelectionRef.current
    if (!current || current.lineId !== lineId || current.endIndex === tokenIndex) return
    const next = { ...current, endIndex: tokenIndex }
    dragSelectionRef.current = next
    setDragSelection(next)
  }

  function finishTokenSelection() {
    const range = dragSelectionRef.current
    if (!range) return
    dragSelectionRef.current = null
    setDragSelection(null)

    if (range.startIndex === range.endIndex) {
      chooseLine(range.lineId)
      setSelectedTokenIndex(range.startIndex)
      setSelectedText(null)
      setSelectedPhraseRange(null)
      return
    }

    const tokens = annotations?.find((line) => line.id === range.lineId)?.tokens || []
    const first = Math.min(range.startIndex, range.endIndex)
    const last = Math.max(range.startIndex, range.endIndex)
    const text = tokens.filter((token) => token.index >= first && token.index <= last).map((token) => token.surface).join('')
    if (!text) return
    suppressNextTokenClick.current = true
    window.setTimeout(() => { suppressNextTokenClick.current = false }, 0)
    chooseLine(range.lineId)
    setSelectedTokenIndex(range.endIndex)
    setSelectedText({ text, lineId: range.lineId, aiOnly: true })
    setSelectedPhraseRange(range)
    setPhraseReading('')
    setPhraseMeaning('')
    setDetailOpen(true)
    setDetailView('word')
    setEditingReadings(false)
    setAiError('')
  }

  function handleTokenClick(lineId, tokenIndex) {
    if (suppressNextTokenClick.current) {
      suppressNextTokenClick.current = false
      return
    }
    chooseLine(lineId)
    setSelectedTokenIndex(tokenIndex)
    setSelectedText(null)
    setSelectedPhraseRange(null)
    if (!editingReadings) openWordDetails()
  }

  function jumpToAiSuggestion(suggestion) {
    chooseLine(suggestion.line_id)
    setSelectedTokenIndex(suggestion.token_index)
    setSelectedText(null)
    setSelectedPhraseRange(null)
    window.requestAnimationFrame(() => {
      document.getElementById(`lyric-row-${activeSong.id}-${suggestion.line_id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function getAiTargetToken(target) {
    const targetTokens = annotations?.find((line) => line.id === target.lineId)?.tokens || []
    const token = targetTokens.find((item) => item.surface === target.text)
    return token ? {
      surface: token.surface,
      reading: corrections[correctionKey(activeSong.id, target.lineId, token.index)] || token.reading,
      dictionary_form: token.dictionary_form,
      part_of_speech: token.part_of_speech,
    } : undefined
  }

  async function askAiToExplain(target) {
    if (!target?.text) return
    const lineIndex = activeSong.lines.findIndex((line) => line.id === target.lineId)
    const targetLine = activeSong.lines[lineIndex] || activeLine
    setAiBusy('explain')
    setAiError('')
    try {
      const result = await explainSelectionWithAi({
        selection: target.text,
        line_text: targetLine.text,
        previous_line: activeSong.lines[lineIndex - 1]?.text || '',
        next_line: activeSong.lines[lineIndex + 1]?.text || '',
        learner_level: 'N3',
        token: getAiTargetToken(target),
      })
      recordBilling(activeSong.id, result.billing, 'selection-explanation')
      setAiExplanation(result)
      setDetailView(target.aiOnly ? 'ai' : 'word')
      setDetailOpen(true)
      setToast('AI 语境讲解已生成，可结合词典信息确认。')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 讲解暂时不可用。'
      setAiError(message)
      setToast(message)
    } finally {
      setAiBusy('')
    }
  }

  return <>
    <div className="page-grain" aria-hidden="true" />
    <audio ref={audioRef} src={audioUrl || undefined} preload="auto" onLoadedMetadata={handleAudioLoadedMetadata} onCanPlay={handleAudioLoadedMetadata} onTimeUpdate={handleAudioTimeUpdate} onEnded={() => { clipEndRef.current = null; setPlayingLineId(null) }} onError={() => { setPlayingLineId(null); setAudioError(`未能加载《${activeSong.title}》的音频；请确认文件没有损坏且编码受支持。`) }} />
    <header className="topbar">
      <button className="brand" type="button" onClick={() => showLibraryPage()} aria-label="返回歌曲库首页" title="返回歌曲库"><img className="brand-icon" src={utaAppIcon} alt="" /><span>UTA<span className="brand-dot">.</span></span></button>
      <nav className="main-nav" aria-label="主导航"><button className={activePage === 'library' ? 'active' : ''} aria-current={activePage === 'library' ? 'page' : undefined} type="button" onClick={() => showLibraryPage()}>歌曲库</button><button className={activePage === 'lesson' ? 'active' : ''} aria-current={activePage === 'lesson' ? 'page' : undefined} type="button" onClick={showLessonPage}>歌曲学习</button><button className={activePage === 'review' ? 'active' : ''} aria-current={activePage === 'review' ? 'page' : undefined} type="button" onClick={showReviewQueue}>复习</button></nav>
      <div className="top-actions"><button className="icon-button" type="button" onClick={() => setGuideOpen(true)} aria-label="打开使用引导" title="使用引导"><CircleHelp size={19} /></button><button className="icon-button" type="button" onClick={focusLibrarySearch} aria-label="搜索歌曲"><Search size={20} /></button><button className="avatar" type="button" onClick={openAiSettings} aria-label="应用设置" title="应用设置"><Settings2 size={15} /></button></div>
    </header>

    {guideOpen && <section className="quick-start-guide" aria-labelledby="quick-start-title">
      <div className="quick-start-heading"><div><p className="eyebrow">QUICK START</p><h2 id="quick-start-title">第一次使用？按这三步开始</h2><p>基本注音可直接使用；词典和 AI 都是增强功能，可以稍后配置。</p></div><button type="button" onClick={dismissQuickStart} aria-label="关闭使用引导" title="以后可点顶部问号重新打开"><X size={16} /></button></div>
      <ol className="quick-start-steps">
        <li className={localSongs.length ? 'complete' : ''}><span>1</span><div><b>导入一首歌 <small>推荐</small></b><p>LRC 提供时间轴，音频负责逐句播放，两者需为同一版本。</p></div><button type="button" onClick={openGuideImport}>{localSongs.length ? `已有 ${localSongs.length} 首` : '开始导入'}</button></li>
        <li className={dictionaryStatus?.installed ? 'complete' : ''}><span>2</span><div><b>安装本地词典 <small>可选</small></b><p>增加日中释义；不安装也能生成假名读音。</p></div><button type="button" onClick={openGuideSettings}>{dictionaryStatus?.installed ? '已安装' : '去设置'}</button></li>
        <li className={guideAiConfigured ? 'complete' : ''}><span>3</span><div><b>选择 AI 模型 <small>可选</small></b><p>浏览模型无需 Key；生成解析前再填写 Key。</p></div><button type="button" onClick={openGuideSettings}>{guideAiConfigured ? '已配置' : '去设置'}</button></li>
      </ol>
      <p className="quick-start-footnote">关闭后可随时点击顶部的 <CircleHelp size={12} /> 重新查看。</p>
    </section>}

    <main ref={pageRef} id="top" key={activePage} className={`page-transition ${detailOpen ? 'with-word-sidebar' : ''}`}>
      {(activePage === 'lesson' || activePage === 'review' && practiceActive) && <>
      {activePage === 'review' && <div className="review-practice-breadcrumb"><button type="button" onClick={exitPractice}>← 复习列表</button><span> / {activeSong.title} · 本曲待复习句</span></div>}
      <section className="hero anime-hero compact-lesson-header" aria-labelledby="song-title" style={{ '--hero-art': `url(${twilightStation})` }}>
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-label"><span />日语歌词 · 一句一句唱清楚</div>
          <div className="anime-hero-grid">
            <div className="song-intro">
              <p className="hero-kicker">LYRICS, SLOWLY</p>
              <p className="hero-season">夜风 · 电车 · 一首歌</p>
              <h1 id="song-title">{activeSong.title}</h1>
              <p className="roman">{activeSong.artist} <span>·</span> <strong>{activeSong.lines.length} 句日语歌词</strong></p>
              <p className="song-description">把喜欢的歌拆成一句一句：先听见、读准，再慢慢唱出来。读音初稿和词义都可由你校正。</p>
              <div className="song-meta"><span><b>本次选曲</b> {activeSong.sourceFile}</span><span><b>已修正</b> {totalCorrections} 词</span><span><b>待复习</b> {reviewItems.length} 句</span><span><b>AI 估算费用</b> {activeSongCostSummary}</span></div>
              <div className="hero-cta">
                {!practiceActive && <button className="play-button" type="button" onClick={() => startPractice('all', activeSong.id, activeLine.id)}><BookOpenCheck size={14} /> 开始练习</button>}
                <button className={`save-button ${isFavorite ? 'saved' : ''}`} onClick={toggleFavorite} type="button"><Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? '已收藏' : '收藏'}</button>
                {!practiceActive && <button className="ai-review-button" onClick={() => setEditingReadings(!editingReadings)} aria-pressed={editingReadings} type="button"><Pencil size={14} /> {editingReadings ? '结束校对' : '校对读音'}</button>}
                <button className="save-button" type="button" onClick={() => showLibraryPage()}>换歌</button>
              </div>
              <p className="ai-privacy-note">AI 只会在你主动点击时参与复核，始终由你决定是否采用建议。</p>
            </div>
            <aside className="hero-focus-card" aria-label="当前歌曲学习进度">
              <p className="hero-focus-label">NOW PLAYING</p>
              <div className="hero-focus-title"><span>{String(allSongs.indexOf(activeSong) + 1).padStart(2, '0')}</span><div><b>{activeSong.title}</b><small>{activeSong.artist}</small></div></div>
              <div className="hero-progress"><div><span>读音掌握</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p>{learnedLines.size} / {activeSong.lines.length} 句已掌握</p></div>
              <button type="button" onClick={() => showLibraryPage()}>换一首歌 <ChevronDown size={14} /></button>
            </aside>
          </div>
        </div>
      </section>

      <div className="lesson-progress-wrap"><LearningProgress stats={currentProgress} title="本曲学习进度"><details className="line-progress-details"><summary>查看逐句进度 · 点击跳转</summary><div className="line-progress-grid">{activeSong.lines.map((line) => <button className={`${currentProgress.learnedIds.has(line.id) ? 'mastered' : ''} ${currentProgress.reviewIds.has(line.id) ? 'pending' : ''} ${line.id === activeLine.id ? 'current' : ''}`} type="button" key={line.id} aria-label={`第 ${line.displayNumber} 句，${currentProgress.learnedIds.has(line.id) ? '已掌握' : '未掌握'}${currentProgress.reviewIds.has(line.id) ? '，待复习' : ''}`} title={line.text} onClick={() => { if (practiceActive) startPractice('all', activeSong.id, line.id); else chooseLine(line.id); window.requestAnimationFrame(() => document.getElementById(practiceActive ? 'guided-practice' : `lyric-row-${activeSong.id}-${line.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }}>{String(line.displayNumber).padStart(2, '0')}{currentProgress.learnedIds.has(line.id) && <Check size={12} />}</button>)}</div><p>绿色＝已掌握，橙色标记＝待复习；描边表示当前句。进度依据你的标记，不是 AI 评分。</p></details></LearningProgress></div>
      <section className={`practice-layout simplified-lesson ${editingReadings && !practiceActive ? 'editing-readings' : ''} ${practiceActive ? 'guided-practice-layout' : ''}`} id="lesson" aria-label="歌词发音学习工作区">
        <aside className="lesson-rail">
          <div className="rail-heading"><span>已导入歌曲</span><span>{allSongs.length} 首</span></div>
          <ol className="song-import-list">{allSongs.map((song, index) => <li className={song.id === activeSong.id ? 'current' : ''} key={song.id}><button onClick={() => chooseSong(song.id)} type="button"><em>{String(index + 1).padStart(2, '0')}</em><span><b>{song.title}</b><small>{song.artist} · {song.lines.length} 句</small></span></button></li>)}</ol>
          <div className="learning-tip"><span>→</span><p><b>用法</b>先看自动标注，再点词修正。你保存的版本始终优先。</p></div>
        </aside>

        <section className="lyrics-panel" aria-labelledby="lyrics-heading">
          <div className="panel-head"><div><p className="eyebrow">{practiceActive ? 'LISTEN, RECALL, REVEAL' : 'AUTO ANNOTATE, THEN VERIFY'}</p><h2 id="lyrics-heading">{practiceActive ? '逐句练习' : '逐句读音'}</h2></div>{!practiceActive && <div className="view-toggle" role="group" aria-label="读音显示方式">{[['original', '原文'], ['reading', '假名'], ['practice', '遮住练习']].map(([value, label]) => <button className={mode === value ? 'selected' : ''} onClick={() => setMode(value)} type="button" key={value}>{label}</button>)}</div>}</div>
          {!practiceActive && <div className="pronunciation-strip"><div><span className="strip-index">{annotating ? 'ANNOTATING' : annotationError ? 'OFFLINE' : 'AUTO READY'}</span><b>{annotating ? '正在为整首歌词生成读音…' : annotationError || '点击带假名的汉字词，可在右侧修改读音'}</b></div><span className="source-badge"><WandSparkles size={13} /> SudachiPy + 本地日中词典</span></div>}
          <div className="audio-tools"><p className="audio-play-tip"><Volume2 size={13} /> {audioUrl ? practiceActive ? '先听这一句，再尝试自己读出歌词。' : '点击每句右侧的播放按钮，系统会提前 0.5 秒进入本句，并播到下一句。' : <>当前示例不附带音频。<button type="button" className="audio-import-link" onClick={() => { showLibraryPage(); openImportDialog() }}>导入 LRC 与音频</button></>}</p><label className="speed-control"><span>慢放</span><select value={playbackRate} onChange={(event) => choosePlaybackRate(Number(event.target.value))} aria-label="逐句播放速度" disabled={!audioUrl}><option value={1}>1×</option><option value={0.75}>0.75×</option><option value={0.5}>0.5×</option><option value={0.25}>0.25×</option></select></label></div>
          {!practiceActive && <details className="lesson-extra-tools"><summary>AI 与共享工具{sentenceExplanationJob?.songId === activeSong.id ? ' · 正在生成…' : ''}</summary><div className="sentence-explanation-status"><div><Sparkles size={15} /><span>{sentenceExplanationJob?.songId === activeSong.id ? `正在生成整句解析 ${sentenceExplanationJob.ready} / ${sentenceExplanationJob.total}` : `已有 ${readySentenceCount} / ${activeSong.lines.length} 句解析`}</span></div><div className="sentence-share-actions">{readySentenceCount > 0 && <button type="button" onClick={exportCurrentSongAnalysis}><Download size={12} /> 导出解析</button>}{readySentenceCount < activeSong.lines.length && <button type="button" disabled={Boolean(sentenceExplanationJob)} onClick={generateCurrentSongExplanations}>生成剩余解析</button>}<button type="button" onClick={runAiReview} disabled={Boolean(aiBusy)}>{aiBusy === 'review' ? '正在复核…' : 'AI 复核全曲'}</button></div></div><p className="sentence-explanation-disclosure">生成解析和 AI 复核会发送歌词给所选供应商，可能产生费用；本曲估算 {activeSongCostSummary}。</p></details>}
          {!practiceActive && sentenceExplanationError?.songId === activeSong.id && <p className="sentence-explanation-error" role="alert"><CircleAlert size={13} /> {sentenceExplanationError.message}</p>}
          {!practiceActive && <div className="practice-launch"><div><b>把这一句真正练会</b><span>先听、自己读并猜意思，再揭晓答案。</span></div><div><button className="practice-start" type="button" onClick={() => startPractice('all', activeSong.id, activeLine.id)}><BookOpenCheck size={15} /> 开始逐句练习</button>{currentSongReviewCount > 0 && <button className="practice-review-start" type="button" onClick={() => startPractice('review')}>只练待复习的 {currentSongReviewCount} 句</button>}</div></div>}
          {practiceActive && <section className="guided-card" id="guided-practice" aria-label="逐句练习卡片">
            <div className="guided-card-top"><span>{practiceScope === 'review' ? '待复习句练习' : '全曲逐句练习'}</span><button type="button" onClick={exitPractice}>{practiceReturnPage === 'review' ? '返回复习列表' : '退出练习'} <X size={13} /></button></div>
            {practiceFinished ? <div className="guided-finished" role="status"><BookOpenCheck size={28} /><h3>本轮练习完成</h3><p>已掌握的句子会计入歌曲进度；没把握的句子留在复习清单中。</p><div><button type="button" onClick={() => startPractice('all')}>再练整首</button><button type="button" disabled={!currentSongReviewCount} onClick={() => startPractice('review')}>练习待复习的 {currentSongReviewCount} 句</button></div></div> : <>
              <p className="guided-counter">第 {practicePosition + 1} / {practiceSessionLineIds.length} 句 <span>·</span> {currentSongReviewCount} 句待复习</p>
              <h3 lang="ja">{activeLine.text}</h3>
              <p className="guided-prompt">先听原声，自己读一遍，并猜猜这句的意思。答案在你点击前不会显示。</p>
              <div className="guided-listen"><button type="button" disabled={!audioUrl} onClick={() => playLine(activeLine.id)}>{playingLineId === activeLine.id ? <Pause size={14} /> : <Play size={14} />} {playingLineId === activeLine.id ? '暂停原声' : '听这一句'}</button><span>{audioUrl ? `当前 ${playbackRate}× 速度` : '这首歌尚无音频'}</span></div>
              {audioError && <p className="guided-error" role="alert">{audioError}</p>}
              {practiceRevealed ? <div className="guided-answer" aria-live="polite"><span>读音</span><p lang="ja">{activeLineReading || '自动读音尚未准备好，请先到校对页面确认。'}</p><span>中文释义</span><p>{activeLine.translation || '原 LRC 未提供中文译文，请结合词汇理解这一句。'}</p><button className="guided-sentence-explain" type="button" aria-expanded={sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id} aria-controls={`guided-sentence-analysis-${activeSong.id}-${activeLine.id}`} onClick={() => showSentenceExplanation(activeLine)}><Sparkles size={13} /> {sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id ? '收起整句解析' : '查看整句解析'}</button>{sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id && <SentenceAnalysis explanation={sentenceExplanationOpen.explanation} id={`guided-sentence-analysis-${activeSong.id}-${activeLine.id}`} />}<div className="guided-grade"><button type="button" onClick={() => gradePracticeLine(false)}>还要再练 · 加入复习</button><button type="button" onClick={() => gradePracticeLine(true)}>我会了 · 下一句 <Check size={14} /></button></div></div> : <button className="guided-reveal" type="button" disabled={!activeLineReading} onClick={() => setPracticeRevealed(true)}>{activeLineReading ? '揭晓读音与译文' : annotationError || '正在准备自动读音…'}</button>}
              <div className="guided-navigation"><button type="button" disabled={practicePosition === 0} onClick={() => goToPracticePosition(practicePosition - 1)}>← 上一句</button><button type="button" disabled={practicePosition + 1 >= practiceSessionLineIds.length} onClick={() => goToPracticePosition(practicePosition + 1)}>跳过这一句 →</button></div>
            </>}
          </section>}
          {!practiceActive && <>
          <p className="selection-guide"><MousePointer2 size={13} /> 按住鼠标左键向右拖过词语，松开后点高亮段右上角的“AI 解释”。</p>
          <div className="mobile-word-dock"><div><b>{focusToken.surface} <span>{focusReading}</span></b><small>{wordMeaning || '常用意思待补充'}</small></div><button type="button" onClick={openWordDetails}>查看详情</button></div>
          {reviewNeeded > 0 && <p className="annotation-tip warn"><CircleAlert size={13} /> 有 {reviewNeeded} 个词典未能确定读音，请优先人工校对。</p>}
          {aiError && <p className="annotation-tip ai-error"><CircleAlert size={13} /> {aiError}</p>}
          {aiReview && <p className="ai-review-summary"><Sparkles size={13} /> AI 已复核 {aiReview.reviewed_token_count} 个词素：{pendingAiSuggestions.length ? <>还有 {pendingAiSuggestions.length} 处待处理建议，<button type="button" onClick={() => document.getElementById('ai-review-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看全部</button></> : aiReview.suggestions?.length ? '所有建议均已处理。' : '未发现明显异常；仍建议以原唱为准。'}</p>}
          <div className="lyrics-list">
            {activeSong.lines.map((line) => {
              const annotation = annotations?.find((item) => item.id === line.id)
              const lineTokens = annotation?.tokens
              const current = line.id === activeLine.id
              const isPlaying = playingLineId === line.id
              const isLearned = learnedLines.has(line.id)
              const lexicalTokens = lineTokens?.filter((token) => !token.is_symbol)
              const lineReading = lexicalTokens?.map((token) => corrections[correctionKey(activeSong.id, line.id, token.index)] || token.reading).filter(Boolean).join(' ')
              const hasSentenceExplanation = hasCachedSentenceExplanation(currentSentenceCache, line)
              const sentenceExpanded = sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === line.id
              return <article id={`lyric-row-${activeSong.id}-${line.id}`} className={`lyric-row ${current ? 'active' : ''}`} onClick={() => chooseLine(line.id)} key={`${activeSong.id}-${line.id}`}>
                <span className="line-number">{String(line.displayNumber).padStart(2, '0')}</span>
                <div className="auto-line-wrap">
                  <div className="japanese"><AnnotatedLine tokens={lineTokens} corrections={corrections} songId={activeSong.id} lineId={line.id} mode={mode} selectedIndex={current ? selectedTokenIndex : -1} selectionRange={dragSelection?.lineId === line.id ? dragSelection : selectedPhraseRange?.lineId === line.id ? selectedPhraseRange : null} showSelectionAction={selectedText?.lineId === line.id && selectedPhraseRange?.lineId === line.id} onStartSelection={(tokenIndex) => beginTokenSelection(line.id, tokenIndex)} onExtendSelection={(tokenIndex) => extendTokenSelection(line.id, tokenIndex)} onFinishSelection={finishTokenSelection} onExplainSelection={() => askAiToExplain(selectedText)} onSelectToken={(tokenIndex) => handleTokenClick(line.id, tokenIndex)} /></div>
                  <div className={`reading ${lineTokens ? '' : 'needs-review'}`}>{mode === 'reading' ? lineReading || '正在生成假名…' : mode === 'practice' ? '假名已隐藏，尝试自己读出这一句' : '切换到“假名”查看自动标注'}</div>
                  {line.translation && <div className="translation lyric-translation">{line.translation}</div>}
                </div>
                <div className="line-actions"><button className={`line-action line-play ${isPlaying ? 'playing' : ''}`} type="button" disabled={!audioUrl} onClick={(event) => { event.stopPropagation(); playLine(line.id) }} aria-label={audioUrl ? `${isPlaying ? '暂停' : '播放'}第 ${line.displayNumber} 句` : `第 ${line.displayNumber} 句没有音频`} title={audioUrl ? `${isPlaying ? '暂停' : '播放'}这一句` : '请先在歌曲库导入 LRC 与音频'}>{isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</button><button className={`line-mastery ${isLearned ? 'mastered' : ''}`} type="button" aria-pressed={isLearned} onClick={(event) => { event.stopPropagation(); toggleLearnedLine(line.id) }} title={isLearned ? '点击改为未掌握' : '点击标记为已掌握'}>{isLearned ? <Check size={12} /> : <Circle size={11} />}<span>{isLearned ? '已掌握' : '未掌握'}</span></button><button className="sentence-explain-link" type="button" aria-expanded={sentenceExpanded} aria-controls={`sentence-analysis-${activeSong.id}-${line.id}`} disabled={!hasSentenceExplanation && Boolean(sentenceExplanationJob)} onClick={(event) => { event.stopPropagation(); showSentenceExplanation(line) }}><Sparkles size={11} /> {sentenceExpanded ? '收起解析' : hasSentenceExplanation ? '查看解析' : sentenceExplanationJob ? '生成中…' : '生成解析'}</button></div>
                {sentenceExpanded && <SentenceAnalysis explanation={sentenceExplanationOpen.explanation} id={`sentence-analysis-${activeSong.id}-${line.id}`} />}
              </article>
            })}
          </div>
          <div className="lyrics-footer"><span>点击任一词即可在右侧校对；选中短语可请求 AI 解释</span><span>每句右侧可切换掌握状态</span></div>
          </>}
        </section>

        {!practiceActive && editingReadings && <aside className="word-panel" aria-labelledby="word-heading">
          <div className="panel-head compact"><div><p className="eyebrow">EDIT THE READING</p><h2 id="word-heading">校对读音</h2></div><span className={`annotation-state ${corrections[focusKey] ? 'corrected' : ''}`}>{corrections[focusKey] ? '已修正' : '自动初稿'}</span></div>
          <div className="word-card correction-card">
            <div className="word-topline"><span className="word-level">{focusToken.part_of_speech || '词素'}</span><button type="button" aria-label="选中词"><Pencil size={15} /></button></div>
            <div className="word-main"><h3>{focusToken.surface}</h3><p className="word-kana">{focusReading || '暂无词典读音'}</p><p className="word-meaning">{wordMeaning || '常用意思暂未收录，可在详情中补充'}</p><button className="detail-link" type="button" onClick={openWordDetails}>查看详情 <ChevronRight size={14} /></button></div>
            {focusSuggestion && <div className="ai-suggestion"><span><Sparkles size={12} /> AI 复核建议 · {(focusSuggestion.confidence * 100).toFixed(0)}%</span><p>建议读作「{focusSuggestion.suggested_reading}」：{focusSuggestion.reason}</p><button type="button" onClick={applyAiSuggestion}>采用建议</button></div>}
            <label className="reading-editor"><span>假名读音</span><input value={draftReading} onChange={(event) => setDraftReading(event.target.value)} placeholder="输入平假名或片假名" lang="ja" /><small>如：わすれた / もの / かえる</small></label>
            <div className="editor-actions"><button className="save-reading" onClick={saveCorrection} type="button"><Save size={13} /> 保存修正</button>{corrections[focusKey] && <button className="reset-reading" onClick={resetCorrection} type="button">恢复初稿</button>}</div>
          </div>
          {pendingAiSuggestions.length > 0 && <section className="ai-review-queue" id="ai-review-queue" aria-labelledby="ai-review-queue-title">
            <div><span className="eyebrow">AI REVIEW QUEUE</span><h3 id="ai-review-queue-title">复核建议 <b>{pendingAiSuggestions.length}</b></h3></div>
            <ol>{pendingAiSuggestions.map((suggestion) => <li className={suggestion.line_id === activeLine.id && suggestion.token_index === focusToken.index ? 'current' : ''} key={`${suggestion.line_id}-${suggestion.token_index}`}><button type="button" onClick={() => jumpToAiSuggestion(suggestion)}><span>第 {activeSong.lines.find((line) => line.id === suggestion.line_id)?.displayNumber} 句 · {suggestion.surface}</span><small>{suggestion.original_reading} <ChevronRight size={11} /> {suggestion.suggested_reading}</small></button></li>)}</ol>
          </section>}
          <div className="word-context"><span>所在句子</span><p>{activeLine.text}</p><small>点击歌词中的其他词，可继续逐词校对。</small></div>
          <div className="practice-checklist"><span>校对建议</span><p>① 先确认自动假名是否合理<br />② 歌词特殊读法按原唱实际修正<br />③ 将有疑问的整句加入复习</p></div>
          <button className={`review-button ${hasReview ? 'added' : ''}`} onClick={toggleReview} type="button">{hasReview ? <><Check size={13} /> 已加入今日复习</> : <><Plus size={13} /> 加入今日复习</>}</button>
        </aside>}
      </section>


      <section className="method-section"><div className="method-title"><p className="eyebrow">THE CORRECTION LOOP</p><h2>自动起稿，<br />由学习者校准。</h2></div><div className="method-cards"><article><span>01</span><h3>全曲自动注音</h3><p>导入任意日语歌词后，由 Sudachi 词典逐词生成读音初稿。</p></article><article><span>02</span><h3>AI 复核与人工确认</h3><p>AI 只标出可能不合理的读法；采用、修改或忽略建议始终由你决定。</p></article><article><span>03</span><h3>按语境理解词汇</h3><p>选中词或短语再请求讲解，结合相邻歌词学习词义和变形。</p></article></div></section>

      </>}

      {activePage === 'library' && <section className="library-section library-page" id="library" aria-labelledby="library-title">
<div className="library-top"><div><p className="eyebrow">YOUR IMPORTED SONGS</p><h2 id="library-title">歌曲库</h2><p>先导入歌曲，再进入逐句听读；AI 解析可在学习时按需生成。</p></div><div className="library-top-actions"><label className="library-search"><Search size={14} /><input id="library-search" type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="搜索歌名或歌手" aria-label="搜索歌名或歌手" />{librarySearch && <button type="button" onClick={() => setLibrarySearch('')} aria-label="清除搜索"><X size={13} /></button>}</label><span className="library-count">{librarySearch ? `找到 ${visibleLibrarySongs.length} / ${allSongs.filter((song) => !demoSongs.some((demo) => demo.id === song.id)).length} 首` : `已导入 ${collectionProgress.songs} 首`}</span><button className="library-import-trigger" type="button" onClick={openImportDialog}><Upload size={14} /> 导入歌曲</button></div></div>
        <section className="library-completion-summary visual-completion" aria-label="歌曲库完成情况"><div className="completion-ring" role="img" aria-label={`完成 ${collectionProgress.completed} / ${collectionProgress.songs} 首歌曲`} style={{ '--completion-angle': `${collectionProgress.songs ? collectionProgress.completed / collectionProgress.songs * 360 : 0}deg` }}><span><strong>{collectionProgress.completed}<small> / {collectionProgress.songs}</small></strong><small>首歌曲已完成</small></span></div><div className="completion-copy"><span>歌曲学习进度</span><div className="completion-song-track" role="progressbar" aria-valuemin={0} aria-valuemax={collectionProgress.songs || 1} aria-valuenow={collectionProgress.completed} aria-label="已完成歌曲比例"><i style={{ width: `${collectionProgress.songs ? collectionProgress.completed / collectionProgress.songs * 100 : 0}%` }} /></div><p>已完成 <b>{collectionProgress.completed}</b> 首 · 歌曲总数 <b>{collectionProgress.songs}</b> 首</p></div></section>
        <div className="library-backup-bar"><div><b>保存或共享学习结果</b><span>完整备份供自己迁移；共享解析不含 API Key、音频或歌词正文。</span></div><div className="library-backup-actions"><button type="button" onClick={exportLearningData} disabled={Boolean(backupBusy)}>{backupBusy === 'export' ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />} 导出备份</button><button type="button" onClick={() => backupInputRef.current?.click()} disabled={Boolean(backupBusy)}>{backupBusy === 'inspect' ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} 恢复备份</button><button type="button" onClick={() => analysisInputRef.current?.click()}><Upload size={14} /> 导入共享解析</button><input ref={backupInputRef} type="file" accept=".uta-backup,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void prepareBackupRestore(file) }} hidden /><input ref={analysisInputRef} type="file" accept=".uta-analysis,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importSharedAnalysis(file) }} hidden /></div></div>
        {backupError && !backupPreview && <p className="library-backup-error" role="alert"><CircleAlert size={14} /> {backupError}</p>}
        {visibleLibrarySongs.length ? <div className="song-library-grid">{visibleLibrarySongs.map((song, index) => {
          const artwork = song.artworkUrl ? { artworkUrl: song.artworkUrl, sourceUrl: song.artworkSourceUrl, provider: song.artworkProvider } : songArtworkBySource[song.sourceFile]
          const learnedCount = songProgress(song, learnedBySong[song.id] || []).learned
          const isCurrentSong = song.id === activeSong.id
          return <article className={`library-song-card ${isCurrentSong ? 'current' : ''}`} key={song.id}>
            <button className="library-song-open" type="button" onClick={() => chooseSongFromLibrary(song.id)} aria-label={`学习 ${song.title}，${song.artist}`}>
              <span className="library-cover">
                <span className="library-cover-fallback" aria-hidden="true">{song.title.slice(0, 2)}</span>
                {artwork?.artworkUrl && <img src={artwork.artworkUrl} alt={`${song.title} 的发行封面`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
                <span className="library-cover-shade" aria-hidden="true" />
                <span className="library-card-index">{String(index + 1).padStart(2, '0')}</span>
                {isCurrentSong && <span className="library-current-badge">正在学习</span>}
                {song.isLocal && <span className="library-local-badge">本地导入</span>}
              </span>
              <span className="library-card-copy"><b>{song.title}</b><small>{song.artist}</small><span><BookOpenCheck size={15} /> {learnedCount === song.lines.length ? '已完成' : '未完成'}</span></span>
            </button>
            {artwork?.sourceUrl && <a className="library-artwork-source" href={artwork.sourceUrl} target="_blank" rel="noreferrer">封面来源 · {artwork.provider || 'Apple Music'}</a>}
            {song.isLocal && <button className="library-delete-button" type="button" disabled={deletingSongId === song.id} onClick={() => removeImportedSong(song)} aria-label={`删除 ${song.title}`} title="删除这首本地导入歌曲"><Trash2 size={13} /> {deletingSongId === song.id ? '删除中' : '删除'}</button>}
          </article>
        })}</div> : <div className="library-empty-search"><BookOpenCheck size={32} /><h3>{librarySearch ? '没有找到匹配的歌曲' : '从你喜欢的第一首歌开始'}</h3><p>准备同一版本的 LRC 与音频，导入后即可逐句听读。词典和 AI 可以稍后配置。</p><button type="button" onClick={openImportDialog}>导入歌曲</button><button type="button" onClick={() => chooseSongFromLibrary(demoSongs[0].id)}>体验无音频示例</button></div>}
      </section>}
      {activePage === 'review' && !practiceActive && <>
      <section className="review-queue-section" id="review-queue" aria-labelledby="review-queue-title">
        <div className="review-queue-heading"><div><p className="eyebrow">WORDS IN CONTEXT, ONE LINE AT A TIME</p><h2 id="review-queue-title">待复习的句子 <span>{reviewQueue.length}</span></h2><p>练习时选择“还要再练”，句子就会来到这里；学会后会自动移出。</p></div>{currentSongReviewCount > 0 && <button type="button" onClick={() => startPractice('review')}>练习本首待复习句 <ChevronRight size={15} /></button>}</div>
        {reviewQueue.length ? <ol className="review-line-list">{reviewQueue.map(({ song, line }) => <li key={`${song.id}:${line.id}`}><button type="button" onClick={() => startPractice('review', song.id, line.id)}><span>{song.title} · 第 {line.displayNumber} 句</span><b lang="ja">{line.text}</b><small>开始练习 <ChevronRight size={13} /></small></button></li>)}</ol> : <p className="review-queue-empty">目前没有待复习句。开始逐句练习，把没把握的句子留下来。</p>}
      </section>
      </>}
    </main>

    <footer><span>UTA. Learn Japanese, one lyric at a time.</span><span>自动注音在本机生成 · 词义数据：<a href="https://github.com/tomoshi-app/tomoshi-dict-data" target="_blank" rel="noreferrer">Tomoshi / EDRDG</a> · AI 请求仅在你主动点击后发起</span></footer>

    {backupPreview && <div className="backup-backdrop" role="presentation" onClick={() => { if (backupBusy !== 'restore') { setBackupPreview(null); setBackupError('') } }}><section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title" onClick={(event) => event.stopPropagation()}>
      <button className="backup-close" type="button" disabled={backupBusy === 'restore'} onClick={() => { setBackupPreview(null); setBackupError('') }} aria-label="关闭备份预览"><X size={18} /></button>
      <p className="eyebrow">RESTORE LOCAL DATA</p><h2 id="backup-dialog-title">确认恢复备份</h2>
      <p className="backup-file-name">{backupPreview.file.name || 'UTA 备份文件'}</p>
      <dl className="backup-summary"><div><dt>备份时间</dt><dd>{new Date(backupPreview.manifest.createdAt).toLocaleString('zh-CN')}</dd></div><div><dt>网页导入歌曲</dt><dd>{backupPreview.manifest.songs.length} 首（含音频）</dd></div><div><dt>读音修正</dt><dd>{Object.keys(backupPreview.manifest.progress.corrections).length} 处</dd></div><div><dt>待复习句</dt><dd>{backupPreview.manifest.progress.reviewItems.length} 句</dd></div><div><dt>文件大小</dt><dd>{(backupPreview.file.size / 1048576).toFixed(1)} MB</dd></div></dl>
      <p className="backup-warning"><CircleAlert size={16} /> 恢复会替换当前浏览器中的网页导入歌曲和学习数据，包括已掌握句子、读音修正与复习清单。建议先导出当前数据。</p>
      {backupError && <p className="library-backup-error" role="alert">{backupError}</p>}
      <div className="backup-dialog-actions"><button type="button" disabled={backupBusy === 'restore'} onClick={() => { setBackupPreview(null); setBackupError('') }}>取消</button><button type="button" disabled={backupBusy === 'restore'} onClick={restoreLearningData}>{backupBusy === 'restore' ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{backupBusy === 'restore' ? '正在恢复…' : '覆盖当前数据并恢复'}</button></div>
    </section></div>}

    {importOpen && <div className="song-import-backdrop" role="presentation" onClick={closeImportDialog}><form className="song-import-dialog" onSubmit={(event) => { event.preventDefault(); importLocalSong() }} onClick={(event) => event.stopPropagation()}>
      <button className="song-import-close" type="button" onClick={closeImportDialog} aria-label="关闭导入窗口"><X size={18} /></button>
      <p className="eyebrow">ADD A LOCAL SONG</p><h2>导入歌曲开始学习</h2><p className="song-import-intro">准备同一版本的 LRC 和音频：LRC 决定每句从哪里开始，音频用于逐句播放。选择后先检查预览，确认时才会保存到本机。</p>
      <details className="lrc-help"><summary>LRC 是什么？从哪里获得？</summary><p>LRC 是带时间戳的歌词文本，不是音频。例如 <code>[00:12.50]ここから始めよう</code> 表示这句在 12.5 秒开始。当前导入需要 LRC 与音频，才能准确定位每句。</p><ul><li>在 <a href="https://lrclib.net" target="_blank" rel="noreferrer">LRCLIB 搜索同步歌词</a>，核对歌名、歌手、时长和版本；并非每首歌都有。</li><li>如果你的音乐播放器支持导出歌词，可选择导出 .lrc 文件。</li><li>找不到时，可用歌词编辑器边听边为每句打时间戳，保存为 UTF-8 的 .lrc 文件。仅把 TXT 改后缀不会生成时间轴。</li></ul><p>现场版、伴奏版、剪辑版通常需要各自的时间轴。优先使用官方提供或你有权使用的歌词与音频。</p></details>
      <div className="import-guide-strip"><span><b>1</b> 选择 LRC</span><span><b>2</b> 选择音频</span><span><b>3</b> 校对时间与歌词</span><span><b>4</b> 确认导入</span></div>
      <label className={`song-file-field ${importLrcFile ? 'selected' : ''}`}><span>01 · 歌词文件</span><strong>{importLrcFile?.name || '选择 .lrc 文件'}</strong><small>需要每句开头的时间戳，例如 [01:23.45]</small><input key={importLrcFile?.name || 'empty-lrc'} type="file" accept=".lrc,text/plain" onChange={(event) => prepareLrcPreview(event.target.files?.[0] || null)} /></label>
      <label className={`song-file-field ${importAudioFile ? 'selected' : ''}`}><span>02 · 原声音频</span><strong>{importAudioFile?.name || '选择 MP3、M4A、WAV、OGG 等音频'}</strong><small>播放时会根据 LRC 时间戳逐句截取</small><input key={importAudioFile?.name || 'empty-audio'} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" onChange={(event) => { setImportAudioFile(event.target.files?.[0] || null); setImportError('') }} /></label>
      {importPreparing && <p className="import-preview-loading"><LoaderCircle className="spin" size={14} /> 正在解析歌词与译文…</p>}
      {importDraft && <section className="import-preview" aria-labelledby="import-preview-title">
        <div className="import-preview-heading"><div><p className="eyebrow">REVIEW BEFORE SAVING</p><h3 id="import-preview-title">导入预览</h3></div><span>{importDraft.lines.length} 句 · 歌名与歌手资料行已排除</span></div>
        <div className="import-meta-fields"><label>歌曲名<input value={importDraft.title} onChange={(event) => updateImportMetadata('title', event.target.value)} maxLength={160} /></label><label>歌手<input value={importDraft.artist} onChange={(event) => updateImportMetadata('artist', event.target.value)} maxLength={160} /></label></div>
        <div className="import-cover-preview"><div className="import-cover-thumb"><span>{importDraft.title.slice(0, 2) || 'UTA'}</span>{/^https?:\/\//i.test(importArtworkUrl) && <img key={importArtworkUrl} src={importArtworkUrl} alt="候选歌曲封面" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}</div><div className="import-cover-controls"><b>封面预览</b><p>{importArtworkStatus === 'loading' ? '正在按歌名与歌手查找封面…' : importArtworkStatus === 'found' ? '已找到候选封面，请核对是否正确。' : importArtworkStatus === 'none' ? '未找到可靠封面，可填写链接或使用默认封面。' : importArtworkStatus === 'manual' ? '使用你填写的封面链接。' : importArtworkStatus === 'default' ? '将使用默认封面。' : '请查找封面，或选择默认封面。'}</p><div><button type="button" disabled={importArtworkStatus === 'loading'} onClick={() => searchImportArtwork(importDraft.title, importDraft.artist)}>重新查找</button><button type="button" onClick={useDefaultImportArtwork}>使用默认封面</button></div><label>也可以填写封面图片链接<input type="url" value={importArtworkUrl} onChange={(event) => changeImportArtworkUrl(event.target.value)} placeholder="https://example.com/cover.jpg" /></label>{importArtworkStatus === 'found' && importArtwork?.artworkSourceUrl && <a href={importArtwork.artworkSourceUrl} target="_blank" rel="noreferrer">查看封面来源 · {importArtwork.artworkProvider || 'Apple Music'}</a>}</div></div>
        <div className="import-lines-heading"><div><b>歌词与时间轴</b><span>可修改时间、日文、中文译文；保存时会按时间排序。</span></div><button type="button" onClick={addImportLine}><Plus size={13} /> 添加一句</button></div>
        <ol className="import-preview-lines">{importDraft.lines.map((line, index) => <li key={line.draftId}><span>{String(index + 1).padStart(2, '0')}</span><div><label>时间戳<input value={line.timeText} onChange={(event) => updateImportLine(line.draftId, 'timeText', event.target.value)} placeholder="00:12.345" aria-label={`第 ${index + 1} 句时间戳`} /></label><label>日文歌词<input value={line.text} onChange={(event) => updateImportLine(line.draftId, 'text', event.target.value)} maxLength={500} lang="ja" aria-label={`第 ${index + 1} 句日文歌词`} /></label><label>中文译文<input value={line.translation} onChange={(event) => updateImportLine(line.draftId, 'translation', event.target.value)} maxLength={500} aria-label={`第 ${index + 1} 句中文译文`} placeholder="没有译文可留空" /></label></div><button className="import-remove-line" type="button" onClick={() => removeImportLine(line.draftId)} aria-label={`删除第 ${index + 1} 句`} title="删除这一句"><Trash2 size={14} /></button></li>)}</ol>
      </section>}
      <p className="import-ai-disclosure"><BookOpenCheck size={14} /> 导入只保存歌曲并生成本地读音，无需 API Key。AI 解析可在学习页按需生成，也可以导入共享解析。</p>
      {importAiProgress && <p className="import-ai-progress" role="status"><LoaderCircle className="spin" size={14} /> 歌曲已保存，正在生成整句解析：{importAiProgress.ready} / {importAiProgress.total} 句</p>}
      {importError && <p className="song-import-error"><CircleAlert size={14} /> {importError}</p>}
      <div className="song-import-actions"><button type="button" onClick={closeImportDialog} disabled={importBusy}>取消</button><button className="song-import-submit" type="submit" disabled={importBusy || importPreparing || importArtworkStatus === 'loading'}>{importBusy ? '正在导入…' : '保存并开始学习'}</button></div>
    </form></div>}

    {detailOpen && <div className="detail-sidebar-shell"><section className={`word-detail ${detailView === 'ai' ? 'ai-only-detail' : ''}`} role="complementary" aria-label="词典与语境释义" aria-labelledby="detail-title">
      <button className="detail-close" type="button" onClick={closeDetail} aria-label="关闭详情"><X size={18} /></button>
      <button type="button" className="restore-phrase-button" onClick={() => setSelectedPhraseRange({ startIndex: activeTokens[0].index, endIndex: activeTokens.at(-1).index })}>选择整句调整分词</button>
      <SegmentationEditor key={`${activeSong.id}:${activeLine.id}:${selectedPhraseRange ? `${selectedPhraseRange.startIndex}-${selectedPhraseRange.endIndex}` : focusToken.index}:${activeTokens.map(token => `${token.index}:${token.surface}`).join(',')}`} tokens={selectedPhraseRange ? activeTokens.filter(token => token.index >= Math.min(selectedPhraseRange.startIndex, selectedPhraseRange.endIndex) && token.index <= Math.max(selectedPhraseRange.startIndex, selectedPhraseRange.endIndex)) : [focusToken]} lineText={activeLine.text} apply={applySegmentation} bill={billing => recordBilling(activeSong.id, billing, 'segmentation-review')} undo={undoSegmentation} canUndo={Boolean(segmentationUndo[`${activeSong.id}:${activeLine.id}`])} />
      {focusToken.user_merge_original && <button type="button" className="restore-phrase-button" onClick={restorePhraseCorrection}>恢复“{focusToken.surface}”的原分词</button>}
      {detailView !== 'ai' && <p className="eyebrow">WORD DETAILS</p>}
      {detailView !== 'ai' && <><div className="detail-heading"><div><h2 id="detail-title">{focusToken.surface}</h2><p>{focusReading || '读音待校对'}</p></div><span>{focusToken.part_of_speech || '词素'}</span></div>
      <dl className="detail-metadata"><div><dt>常用意思</dt><dd>{wordMeaning || '暂未收录；可在下方补充。'}</dd></div><div><dt>词典形</dt><dd>{focusToken.dictionary_form || focusToken.surface}</dd></div><div><dt>当前形式</dt><dd>{focusToken.surface}</dd></div><div><dt>活用信息</dt><dd>{focusToken.inflection_type || '无活用'} · {focusToken.inflection_form || '基本形'}</dd></div></dl>
      <div className="meaning-editor"><label htmlFor="meaning-input">补充或修正常用意思</label><input id="meaning-input" value={draftMeaning} onChange={(event) => setDraftMeaning(event.target.value)} placeholder="例如：梦；梦想" /><button type="button" onClick={saveMeaning}><Save size={14} /> 保存意思</button></div>
      <div className="detail-ai-action"><div><Bot size={15} /><span>想了解这个词在歌词中的具体用法？</span></div><button type="button" disabled={aiBusy === 'explain'} onClick={() => askAiToExplain({ text: focusToken.surface, lineId: activeLine.id })}>{aiBusy === 'explain' ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />} AI 语境讲解</button></div></>}
      {aiExplanation && <section className="ai-explanation"><p className="eyebrow">AI IN CONTEXT</p><h3 id={detailView === 'ai' ? 'detail-title' : undefined}>{aiExplanation.term} <small>{aiExplanation.reading} · 本句推荐</small></h3><dl><div><dt>常用义</dt><dd>{aiExplanation.common_meaning || '未给出'}</dd></div><div><dt>歌词中</dt><dd>{aiExplanation.contextual_meaning || '未给出'}</dd></div>{aiExplanation.dictionary_form && <div><dt>词典形</dt><dd>{aiExplanation.dictionary_form}</dd></div>}{aiExplanation.conjugation && <div><dt>变形</dt><dd>{aiExplanation.conjugation}</dd></div>}</dl>{aiExplanation.alternative_readings?.length > 0 && <div className="alternative-readings"><h4>其他常见读音</h4><ul>{aiExplanation.alternative_readings.map((item) => <li key={item.reading}><b>{item.reading}</b><span>{item.meaning || '常见异读'}</span>{item.when_to_use && <small>{item.when_to_use}</small>}</li>)}</ul></div>}{aiExplanation.usages?.length > 0 && <ul>{aiExplanation.usages.map((item) => <li key={item}>{item}</li>)}</ul>}{aiExplanation.learning_tip && <p className="ai-tip">学习提示：{aiExplanation.learning_tip}</p>}{aiExplanation.caution && <p className="ai-caution">注意：{aiExplanation.caution}</p>}</section>}
      {detailView !== 'ai' && <><div className="detail-examples"><h3>常见搭配</h3>{focusToken.examples?.length ? <ul>{focusToken.examples.map((example) => <li key={example}>{example}</li>)}</ul> : <p>暂未收录搭配。可先根据当前歌词语境补充常用意思。</p>}</div>
      <div className="detail-line"><span>歌词语境</span><p>{activeLine.text}</p></div></>}
    </section></div>}

    {dictionaryPanelOpen && dictionaryStatus && <aside className="dictionary-download-panel" role="status" aria-live="polite">
      <div className="dictionary-panel-head"><div><BookOpenCheck size={17} /><b>Tomoshi 本地词典</b></div>{!['downloading', 'installing', 'cancelling'].includes(dictionaryStatus.phase) && <button type="button" onClick={() => setDictionaryPanelOpen(false)} aria-label="关闭词典下载提示"><X size={15} /></button>}</div>
      <p>{dictionaryStatus.phase === 'downloading' ? '正在下载词典，可随时取消；下次会从已下载部分继续。' : dictionaryStatus.phase === 'installing' ? '正在校验并安装数据库…' : dictionaryStatus.phase === 'cancelling' ? '正在停止当前操作…' : dictionaryStatus.phase === 'cancelled' ? '下载已取消，已下载部分会保留以便续传。' : dictionaryStatus.phase === 'ready' ? '本地日中词典已安装完成。' : dictionaryStatus.error || '词典尚未安装。'}</p>
      {['downloading', 'installing', 'cancelling'].includes(dictionaryStatus.phase) && <div className="dictionary-progress"><span style={{ width: dictionaryStatus.total_bytes ? `${Math.min(100, dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%` : dictionaryStatus.phase === 'installing' ? '100%' : '18%' }} /></div>}
      <div className="dictionary-progress-meta"><span>{dictionaryStatus.total_bytes ? `${(dictionaryStatus.downloaded_bytes / 1048576).toFixed(1)} / ${(dictionaryStatus.total_bytes / 1048576).toFixed(1)} MB` : dictionaryStatus.phase === 'installing' ? '正在安装' : ''}</span>{dictionaryStatus.total_bytes && <b>{Math.round(dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%</b>}</div>
      <div className="dictionary-panel-actions">{['downloading', 'installing'].includes(dictionaryStatus.phase) ? <button type="button" className="danger" onClick={() => runDictionaryAction('cancel')}>取消下载</button> : <><button type="button" onClick={() => runDictionaryAction('download')}>{dictionaryStatus.phase === 'cancelled' ? '继续下载' : '下载最新版'}</button><button type="button" onClick={() => runDictionaryAction('chooseLocal')}>选择本地文件</button><button type="button" onClick={() => window.utaDesktop.dictionary.openReleases()}>打开发布页</button></>}</div>
    </aside>}

    {aiSettingsOpen && <div className="backup-backdrop" role="presentation" onClick={() => setAiSettingsOpen(false)}><form className="backup-dialog ai-settings-dialog" data-settings-tab={settingsTab} onSubmit={saveAiConfiguration} onClick={(event) => event.stopPropagation()}>
      <button className="backup-close" type="button" onClick={() => setAiSettingsOpen(false)} aria-label="关闭设置"><X size={18} /></button>
      <p className="eyebrow">APPLICATION SETTINGS</p><h2>设置</h2>
      <nav className="settings-tabs" aria-label="设置分类">{[['ai', 'AI 与模型'], ['dictionary', '本地词典'], ['appearance', '阅读与动效']].map(([id, label]) => <button key={id} type="button" aria-pressed={settingsTab === id} onClick={() => setSettingsTab(id)}>{label}</button>)}</nav>
      {modelsRefreshing && <p className="settings-refresh-status" role="status"><LoaderCircle className="spin" size={14} /> 模型目录正在后台刷新，可随时关闭设置。</p>}
      <section className="settings-section reading-settings"><div className="settings-section-heading"><b>阅读与字号</b><button type="button" onClick={() => setReadingPreferences(DEFAULT_READING_PREFERENCES)}>恢复默认</button></div><label>界面字号 · {readingPreferences.interfaceSize}px<input type="range" min="14" max="22" step="1" value={readingPreferences.interfaceSize} onChange={(event) => setReadingPreferences({ ...readingPreferences, interfaceSize: Number(event.target.value) })} /></label><label>歌词字号 · {readingPreferences.lyricSize}px<input type="range" min="20" max="40" step="1" value={readingPreferences.lyricSize} onChange={(event) => setReadingPreferences({ ...readingPreferences, lyricSize: Number(event.target.value) })} /></label><p>即时预览并自动保存在本机，不受下面 AI 设置保存按钮影响。</p></section>
      {aiSettingsBusy === 'load' && <p><LoaderCircle className="spin" size={14} /> 正在读取本机设置…</p>}
      <section className="settings-section"><label>动态效果<select value={readingPreferences.motion} onChange={(event) => setReadingPreferences({ ...readingPreferences, motion: event.target.value })}><option value="on">开启</option><option value="system">跟随系统</option><option value="off">关闭</option></select></label><p className="field-help">系统减少动态效果：{systemReducedMotion ? '已开启' : '未开启'}。选择“开启”会使用应用动画，不跟随系统禁用。</p><button type="button" onClick={() => setMotionPreview((value) => value + 1)}>播放动效预览</button><div className="motion-demo" aria-label="动画预览"><span key={motionPreview}>UTA</span></div></section>
      {aiSettings && <div className="ai-settings-fields">
        <section className="settings-section"><div className="settings-section-heading"><div><Bot size={16} /><b>AI 供应商与模型</b></div><span>选厂家即可浏览模型</span></div>
          <label><span className="settings-step-label">1 · 选择供应商</span><select value={aiSettings.provider} onChange={(event) => selectAiProvider(event.target.value)}>{(aiSettings.providers || []).map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
          {aiSettings.provider === 'custom' && <label><span className="settings-step-label">自定义接口地址</span><input type="url" value={aiSettings.base_url} onChange={(event) => setAiSettings({ ...aiSettings, base_url: event.target.value })} /><small className="field-help">仅自定义 OpenAI 兼容服务需要填写，普通厂家地址由应用维护。</small></label>}
          <section className="key-management">{(aiSettings.keys || []).some((key) => key.provider === aiSettings.provider) && <><label>已保存的 Key<select value={aiSettings.selected_key_id || ''} onChange={(event) => selectSavedKey(event.target.value)}><option value="">添加新 Key / 暂不使用</option>{(aiSettings.keys || []).filter((key) => key.provider === aiSettings.provider).map((key) => <option key={key.id} value={key.id}>{key.name} · ••••{key.last_four}</option>)}</select></label>{aiSettings.selected_key_id && <button type="button" onClick={deleteSavedKey} disabled={Boolean(aiSettingsBusy)}>删除此 Key</button>}</>}<label>{aiSettings.selected_key_id ? '添加其他 Key（可选）' : 'API Key'}<input type="password" value={aiSettings.api_key || ''} onChange={(event) => setAiSettings({ ...aiSettings, api_key: event.target.value, key_name: '' })} placeholder={aiSettings.selected_key_id ? '留空继续使用已保存的 Key' : '粘贴 Key 即可，无需命名'} autoComplete="off" /></label><small className="field-help">保存在本机并加密；不填 Key 也可以浏览模型。</small></section>
          <div className="ai-model-row"><label><span className="settings-step-label">模型</span><select value={aiSettings.model} onChange={(event) => selectDiscoveredModel(event.target.value)}>{!modelChoices(aiModels, aiSettings.model, showAllModels, modelSearch).some((model) => model.id === aiSettings.model) && <option value={aiSettings.model}>{modelLabel(aiModels.find((model) => model.id === aiSettings.model) || { id: aiSettings.model || '正在读取模型…' })}</option>}{modelChoices(aiModels, aiSettings.model, showAllModels, modelSearch).map((model) => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}</select></label><button type="button" onClick={() => refreshAiModels()} disabled={modelsRefreshing || Boolean(aiSettingsBusy)}>{modelsRefreshing ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />} 刷新</button></div>
          <div className="model-list-options"><button type="button" onClick={() => { setShowAllModels(!showAllModels); setModelSearch('') }}>{showAllModels ? '收起全部模型' : `全部模型（${aiModels.length}）`}</button>{showAllModels && <input type="search" aria-label="搜索模型" placeholder="搜索名称或接口 ID" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} />}</div>
          <details className="model-technical-details"><summary>价格与连接详情</summary><p className="ai-settings-note">接口 ID：{aiSettings.model} · {aiSettings.base_url}</p>
          <p className="ai-settings-note">{aiModels[0]?.model_source || '公开模型目录'} · {aiModels[0]?.account_verified ? '已核对账号权限' : '公开目录供浏览，实际可用性需用 Key 校验'}。最新读取：{aiModels[0]?.catalog_checked_at ? new Date(aiModels[0].catalog_checked_at).toLocaleString() : '尚未读取'}。</p>
          <dl className="ai-price-summary"><div><dt>输入 / 百万 token</dt><dd>¥ {aiSettings.pricing_source === '供应商未提供' ? '暂未获取' : Number(aiSettings.input_price || 0).toFixed(4)}</dd></div><div><dt>缓存输入 / 百万 token</dt><dd>¥ {Number(aiSettings.cached_input_price || 0).toFixed(4)}</dd></div><div><dt>输出 / 百万 token</dt><dd>¥ {aiSettings.pricing_source === '供应商未提供' ? '暂未获取' : Number(aiSettings.output_price || 0).toFixed(4)}</dd></div><div><dt>价格来源</dt><dd>{aiSettings.pricing_source || '供应商未提供'}</dd></div></dl>
          <p className="ai-settings-note">人民币费用为本机估算，便于比较每首歌的成本；最终扣费以供应商账单为准。</p>
          </details>
        </section>
        <section className="settings-section"><div className="settings-section-heading"><div><BookOpenCheck size={16} /><b>本地词典</b></div><span>{dictionaryStatus?.installed ? '已安装' : '未安装（可选）'}</span></div>
          <p className="ai-settings-note">这是可选增强项：不安装仍可用 SudachiPy 自动注音；安装后可显示更多日中词义。推荐自动下载 Tomoshi Dictionary Open Data Layer，网络不稳定时也可打开发布页手动下载。</p>
          <p className="dictionary-format-hint"><b>上传格式：</b>.db.zst、.db、.sqlite、.sqlite3；SQLite 必须包含 entries、forms、zh_defs 表。</p>
          {dictionaryStatus?.error && <p className="settings-inline-error"><CircleAlert size={13} /> {dictionaryStatus.error}</p>}
          {dictionaryStatus && ['downloading', 'installing', 'cancelling'].includes(dictionaryStatus.phase) && <><div className="dictionary-progress"><span style={{ width: dictionaryStatus.total_bytes ? `${Math.min(100, dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%` : dictionaryStatus.phase === 'installing' ? '100%' : '18%' }} /></div><div className="dictionary-progress-meta"><span>{dictionaryStatus.phase === 'installing' ? '正在校验并安装' : '正在下载推荐词典'}</span>{dictionaryStatus.total_bytes && <b>{Math.round(dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%</b>}</div></>}
          <div className="settings-dictionary-actions">{dictionaryStatus && ['downloading', 'installing'].includes(dictionaryStatus.phase) ? <button type="button" className="danger" onClick={() => runDictionaryAction('cancel')}>取消下载</button> : <><button type="button" onClick={() => runDictionaryAction('download')}><Download size={12} /> {dictionaryStatus?.phase === 'cancelled' ? '继续下载' : '下载推荐词典'}</button><button type="button" onClick={() => runDictionaryAction('chooseLocal')}><Upload size={12} /> 上传本地词典</button><button type="button" onClick={() => window.utaDesktop?.dictionary?.openReleases()}>打开发布页</button></>}</div>
        </section>
      </div>}
      {aiSettingsError && <p className="library-backup-error" role="alert"><CircleAlert size={14} /> {aiSettingsError}</p>}
      <div className="backup-dialog-actions"><button type="button" onClick={() => setAiSettingsOpen(false)}>关闭</button>{settingsTab === 'ai' && <button type="submit" disabled={!aiSettings || Boolean(aiSettingsBusy)}>{aiSettingsBusy === 'save' ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} 保存 AI 设置</button>}</div>
    </form></div>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
  </>
}
