import { resegmentLine } from '../lib/segmentation.mjs';
import { scrollBehavior } from '../lib/uiMotion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { explainSelectionWithAi, reviewSongWithAi } from '../lib/annotationApi';
import { correctionKey, hasKanji } from '../lib/ruby';
import { restoreMergedToken } from '../lib/phraseCorrection.mjs';
import { displayReading } from '../lib/readingDisplay';
function fallbackTokens(text) {
  return [{
    index: 0,
    surface: text,
    reading: '',
    base: text,
    ruby: '',
    suffix: '',
    part_of_speech: '待注音',
    dictionary_form: text,
    normalized_form: text,
    inflection_type: '待分析',
    inflection_form: '待分析',
    meaning: null,
    examples: [],
    needs_review: true,
    is_symbol: false
  }];
}
export default function useWordLearning({
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
}) {
  const requestGeneration = useRef(0);
  const contextRef = useRef('');
  const context = `${activeSong.id}:${activeLine.id}`;
  if (contextRef.current !== context) {
    contextRef.current = context;
    requestGeneration.current++;
  }
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [draftReading, setDraftReading] = useState('');
  const [draftMeaning, setDraftMeaning] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [segmentationUndo, setSegmentationUndo] = useState({});
  const [detailView, setDetailView] = useState('word');
  const [selectedText, setSelectedText] = useState(null);
  const [dragSelection, setDragSelection] = useState(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiBusy, setAiBusy] = useState('');
  const [aiError, setAiError] = useState('');
  const dragSelectionRef = useRef(null);
  const reviewQueueScrollPending = useRef(false);
  const suppressNextTokenClick = useRef(false);
  const activeTokens = useMemo(() => activeAnnotation?.tokens || fallbackTokens(activeLine.text), [activeAnnotation, activeLine.text]);
  const lexicalActiveTokens = activeTokens.filter(token => !token.is_symbol);
  const focusToken = lexicalActiveTokens.find(token => token.index === selectedTokenIndex) || lexicalActiveTokens.find(token => hasKanji(token.surface)) || lexicalActiveTokens[0] || activeTokens[0];
  const focusKey = correctionKey(activeSong.id, activeLine.id, focusToken.index);
  const focusReading = corrections[focusKey] || focusToken.reading;
  const focusDisplayReading = displayReading(focusReading, readingStyle, focusToken, Boolean(corrections[focusKey]));
  const meaningKey = `${focusToken.dictionary_form || focusToken.surface}:${focusToken.reading}`;
  const wordMeaning = meaningOverrides[meaningKey] || focusToken.meaning || '';
  const aiReview = aiReviews[activeSong.id];
  const pendingAiSuggestions = (aiReview?.suggestions || []).filter(suggestion => {
    const token = annotations?.find(line => line.id === suggestion.line_id)?.tokens.find(token => token.index === suggestion.token_index);
    return token?.surface === suggestion.surface && token.reading === suggestion.original_reading && !corrections[correctionKey(activeSong.id, suggestion.line_id, suggestion.token_index)];
  });
  const focusSuggestion = pendingAiSuggestions.find(item => item.line_id === activeLine.id && item.token_index === focusToken.index);
  useEffect(() => {
    const finishOnWindow = () => finishTokenSelection();
    window.addEventListener('pointerup', finishOnWindow);
    return () => window.removeEventListener('pointerup', finishOnWindow);
  }, [activeSong.id, annotations]);
  useEffect(() => {
    const dismissOnBlank = event => {
      if (event.button !== 0 || document.getElementById('guided-practice') || event.target.closest('.lyric-row, .word-panel, .word-detail, .line-progress-grid, .ai-review-queue, .backup-backdrop, .song-import-backdrop, .quick-start-guide, button, a, input, select, textarea, label, summary')) return;
      clearLineSelection();
    };
    document.addEventListener('pointerdown', dismissOnBlank);
    return () => document.removeEventListener('pointerdown', dismissOnBlank);
  }, [detailOpen]);
  useEffect(() => {
    if (!editingReadings || !reviewQueueScrollPending.current) return undefined;
    reviewQueueScrollPending.current = false;
    const frame = window.requestAnimationFrame(() => focusAiReviewQueue());
    return () => window.cancelAnimationFrame(frame);
  }, [editingReadings, activePage, pendingAiSuggestions.length]);
  useEffect(() => {
    const firstToken = activeTokens.find(token => !token.is_symbol && hasKanji(token.surface)) || activeTokens.find(token => !token.is_symbol) || activeTokens[0];
    if (firstToken) setSelectedTokenIndex(previous => activeTokens.some(token => token.index === previous && !token.is_symbol) ? previous : firstToken.index);
  }, [activeSong.id, activeLine.id, activeTokens]);
  useEffect(() => {
    setDraftReading(focusReading);
  }, [focusKey, focusReading]);
  useEffect(() => {
    setDraftMeaning(wordMeaning);
  }, [meaningKey, wordMeaning]);
  function chooseLine(lineId) {
    requestGeneration.current++;
    setAiExplanation(null);
    setActiveLineId(lineId);
  }
  function clearLineSelection() {
    requestGeneration.current++;
    setDetailOpen(false);
    setAiExplanation(null);
    setActiveLineId(null);
    setSelectedTokenIndex(-1);
    setSelectedText(null);
    setSelectedPhraseRange(null);
    dragSelectionRef.current = null;
    setDragSelection(null);
  }
  function focusAiReviewQueue() {
    const queue = document.getElementById('ai-review-queue');
    queue?.focus({
      preventScroll: true
    });
    queue?.scrollIntoView({
      behavior: scrollBehavior(),
      block: 'start'
    });
  }
  function showAiReviewQueue() {
    if (editingReadings) focusAiReviewQueue();else {
      reviewQueueScrollPending.current = true;
      setEditingReadings(true);
    }
  }
  function saveCorrection() {
    const nextReading = draftReading.trim();
    if (!nextReading) {
      setToast('读音不能为空。');
      return;
    }
    setCorrections(previous => ({
      ...previous,
      [focusKey]: nextReading
    }));
    setToast(`已保存「${focusToken.surface}」的读音修正。`);
  }
  function resetCorrection() {
    setCorrections(previous => {
      const {
        [focusKey]: ignored,
        ...rest
      } = previous;
      return rest;
    });
    setToast('已恢复词典自动读音。');
  }
  function saveMeaning() {
    const nextMeaning = draftMeaning.trim();
    if (!nextMeaning) {
      setToast('常用意思不能为空。');
      return;
    }
    setMeaningOverrides(previous => ({
      ...previous,
      [meaningKey]: nextMeaning
    }));
    setToast(`已保存「${focusToken.surface}」的常用意思。`);
  }
  function openWordDetails() {
    setEditingReadings(false);
    setDetailView('word');
    setAiExplanation(null);
    setDetailOpen(true);
  }
  function closeDetail() {
    requestGeneration.current++;
    setDetailOpen(false);
    setDetailView('word');
  }
  function applySegmentation(replacement) {
    const key = `${activeSong.id}:${activeLine.id}`;
    try {
      const result = resegmentLine(activeTokens, selectedPhraseRange || {
        startIndex: focusToken.index,
        endIndex: focusToken.index
      }, replacement, corrections, `${key}:`);
      setSegmentationUndo(previous => ({
        ...previous,
        [key]: {
          tokens: activeTokens,
          corrections: Object.fromEntries(Object.entries(corrections).filter(([item]) => item.startsWith(`${key}:`)))
        }
      }));
      setCorrections(result.corrections);
      setAnnotationsBySong(previous => ({
        ...previous,
        [activeSong.id]: (previous[activeSong.id] || []).map(line => line.id === activeLine.id ? {
          ...line,
          tokens: result.tokens
        } : line)
      }));
      setAiReviews(previous => {
        const {
          [activeSong.id]: ignored,
          ...rest
        } = previous;
        return rest;
      });
      setSelectedPhraseRange(null);
      setSelectedText(null);
      setSelectedTokenIndex(result.selectedIndex);
      setToast('分词已更新并重新查词，未改变词边界的人工读音已保留。');
    } catch (error) {
      setToast(error.message);
    }
  }
  function undoSegmentation() {
    const key = `${activeSong.id}:${activeLine.id}`;
    const saved = segmentationUndo[key];
    if (!saved) return;
    setAnnotationsBySong(previous => ({
      ...previous,
      [activeSong.id]: previous[activeSong.id].map(line => line.id === activeLine.id ? {
        ...line,
        tokens: saved.tokens
      } : line)
    }));
    setCorrections(previous => ({
      ...Object.fromEntries(Object.entries(previous).filter(([item]) => !item.startsWith(`${key}:`))),
      ...saved.corrections
    }));
    setSegmentationUndo(previous => {
      const next = {
        ...previous
      };
      delete next[key];
      return next;
    });
    setSelectedPhraseRange(null);
    setSelectedText(null);
    setSelectedTokenIndex(saved.tokens.find(token => !token.is_symbol)?.index || 0);
    setToast('已撤销分词，恢复原来的读音修正。');
  }
  function restorePhraseCorrection() {
    const next = restoreMergedToken(activeTokens, focusToken.index);
    const originalKeys = (focusToken.user_merge_original || []).map(token => correctionKey(activeSong.id, activeLine.id, token.index));
    setCorrections(previous => ({
      ...Object.fromEntries(Object.entries(previous).filter(([key]) => !originalKeys.includes(key))),
      ...focusToken.user_merge_original_corrections
    }));
    setAnnotationsBySong(previous => ({
      ...previous,
      [activeSong.id]: previous[activeSong.id].map(line => line.id === activeLine.id ? {
        ...line,
        tokens: next
      } : line)
    }));
    setToast('已恢复原来的分词。');
  }
  async function runAiReview() {
    setAiBusy('review');
    setAiError('');
    try {
      const result = await reviewSongWithAi(activeSong, annotations, corrections);
      recordBilling(activeSong.id, result.billing, 'reading-review');
      setAiReviews(previous => ({
        ...previous,
        [activeSong.id]: {
          ...result,
          reviewedAt: Date.now()
        }
      }));
      setToast(result.suggestions?.length ? `AI 标出了 ${result.suggestions.length} 处待确认读音。` : 'AI 未发现明显需要复核的读音。');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 复核暂时不可用。';
      setAiError(message);
      setToast(message);
    } finally {
      setAiBusy('');
    }
  }
  function applyAiSuggestion() {
    if (!focusSuggestion) return;
    setDraftReading(focusSuggestion.suggested_reading);
    setCorrections(previous => ({
      ...previous,
      [focusKey]: focusSuggestion.suggested_reading
    }));
    setToast(`已采用建议读音「${focusSuggestion.suggested_reading}」，仍可继续修改。`);
  }
  function beginTokenSelection(lineId, tokenIndex) {
    const next = {
      lineId,
      startIndex: tokenIndex,
      endIndex: tokenIndex
    };
    dragSelectionRef.current = next;
    setDragSelection(next);
    setSelectedPhraseRange(null);
    setSelectedText(null);
  }
  function extendTokenSelection(lineId, tokenIndex) {
    const current = dragSelectionRef.current;
    if (!current || current.lineId !== lineId || current.endIndex === tokenIndex) return;
    const next = {
      ...current,
      endIndex: tokenIndex
    };
    dragSelectionRef.current = next;
    setDragSelection(next);
  }
  function finishTokenSelection() {
    const range = dragSelectionRef.current;
    if (!range) return;
    dragSelectionRef.current = null;
    setDragSelection(null);
    if (range.startIndex === range.endIndex) {
      chooseLine(range.lineId);
      setSelectedTokenIndex(range.startIndex);
      setSelectedText(null);
      setSelectedPhraseRange(null);
      return;
    }
    const tokens = annotations?.find(line => line.id === range.lineId)?.tokens || [];
    const first = Math.min(range.startIndex, range.endIndex);
    const last = Math.max(range.startIndex, range.endIndex);
    const text = tokens.filter(token => token.index >= first && token.index <= last).map(token => token.surface).join('');
    if (!text) return;
    suppressNextTokenClick.current = true;
    window.setTimeout(() => {
      suppressNextTokenClick.current = false;
    }, 0);
    chooseLine(range.lineId);
    setSelectedTokenIndex(range.endIndex);
    setSelectedText({
      text,
      lineId: range.lineId,
      aiOnly: true
    });
    setSelectedPhraseRange(range);
    setDetailOpen(true);
    setDetailView('word');
    setEditingReadings(false);
    setAiError('');
  }
  function handleTokenClick(lineId, tokenIndex) {
    if (suppressNextTokenClick.current) {
      suppressNextTokenClick.current = false;
      return;
    }
    chooseLine(lineId);
    setSelectedTokenIndex(tokenIndex);
    setSelectedText(null);
    setSelectedPhraseRange(null);
    if (!editingReadings) openWordDetails();
  }
  function jumpToAiSuggestion(suggestion) {
    chooseLine(suggestion.line_id);
    setSelectedTokenIndex(suggestion.token_index);
    setSelectedText(null);
    setSelectedPhraseRange(null);
    window.requestAnimationFrame(() => {
      document.getElementById(`lyric-row-${activeSong.id}-${suggestion.line_id}`)?.scrollIntoView({
        behavior: scrollBehavior(),
        block: 'center'
      });
    });
  }
  function getAiTargetToken(target) {
    const targetTokens = annotations?.find(line => line.id === target.lineId)?.tokens || [];
    const token = targetTokens.find(item => item.surface === target.text);
    return token ? {
      surface: token.surface,
      reading: corrections[correctionKey(activeSong.id, target.lineId, token.index)] || token.reading,
      dictionary_form: token.dictionary_form,
      part_of_speech: token.part_of_speech
    } : undefined;
  }
  async function askAiToExplain(target) {
    if (!target?.text) return;
    const generation = ++requestGeneration.current;
    const lineIndex = activeSong.lines.findIndex(line => line.id === target.lineId);
    const targetLine = activeSong.lines[lineIndex] || activeLine;
    setAiBusy('explain');
    setAiError('');
    try {
      const result = await explainSelectionWithAi({
        selection: target.text,
        line_text: targetLine.text,
        previous_line: activeSong.lines[lineIndex - 1]?.text || '',
        next_line: activeSong.lines[lineIndex + 1]?.text || '',
        learner_level: 'N3',
        token: getAiTargetToken(target)
      });
      recordBilling(activeSong.id, result.billing, 'selection-explanation');
      if (generation !== requestGeneration.current) return;
      setAiExplanation(result);
      setDetailView(target.aiOnly ? 'ai' : 'word');
      setDetailOpen(true);
      setToast('AI 语境讲解已生成，可结合词典信息确认。');
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      const message = error instanceof Error ? error.message : 'AI 讲解暂时不可用。';
      setAiError(message);
      setToast(message);
    } finally {
      setAiBusy('');
    }
  }
  return {
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
  };
}
