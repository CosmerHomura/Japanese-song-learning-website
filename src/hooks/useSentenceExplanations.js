import { useRef, useState } from 'react';
import { explainSentenceBatchWithAi } from '../lib/annotationApi';
import { hasCachedSentenceExplanation } from '../lib/songHelpers';
const SENTENCE_BATCH_SIZE = 8;
export default function useSentenceExplanations({
  setAiUsageBySong,
  sentenceExplanationsBySong,
  setSentenceExplanationsBySong,
  activeSong,
  setToast
} = {}) {
  const [sentenceExplanationOpen, setSentenceExplanationOpen] = useState(null);
  const [sentenceExplanationJob, setSentenceExplanationJob] = useState(null);
  const [sentenceExplanationError, setSentenceExplanationError] = useState(null);
  const sentenceExplanationJobRef = useRef(null);
  const selectionRequest = useRef(0);
  const activeSongRef = useRef(activeSong.id);
  activeSongRef.current = activeSong.id;
  function recordBilling(songId, billing, action) {
    if (!billing?.billed_request) return;
    setAiUsageBySong(previous => ({
      ...previous,
      [songId]: [...(previous[songId] || []), {
        ...billing,
        action,
        recordedAt: new Date().toISOString()
      }]
    }));
  }
  async function generateSentenceExplanations(song, requestedLines = song.lines, onProgress) {
    const cache = {
      ...(sentenceExplanationsBySong[song.id] || {})
    };
    const pending = requestedLines.filter(line => !hasCachedSentenceExplanation(cache, line));
    const countReady = () => song.lines.filter(line => hasCachedSentenceExplanation(cache, line)).length;
    if (!pending.length) return {
      cache,
      complete: true,
      ready: countReady(),
      error: ''
    };
    if (sentenceExplanationJobRef.current) {
      return {
        cache,
        complete: false,
        ready: countReady(),
        error: '已有一首歌曲正在生成解析，请稍后重试。'
      };
    }
    sentenceExplanationJobRef.current = song.id;
    setSentenceExplanationError(null);
    setSentenceExplanationJob({
      songId: song.id,
      ready: countReady(),
      total: song.lines.length
    });
    onProgress?.(countReady(), song.lines.length);
    let failure = '';
    try {
      for (let offset = 0; offset < pending.length; offset += SENTENCE_BATCH_SIZE) {
        const batch = pending.slice(offset, offset + SENTENCE_BATCH_SIZE);
        const contextLines = batch.map(line => {
          const index = song.lines.findIndex(item => item.id === line.id);
          return {
            id: line.id,
            text: line.text,
            translation: line.translation || '',
            previous_line: song.lines[index - 1]?.text || '',
            next_line: song.lines[index + 1]?.text || ''
          };
        });
        try {
          const result = await explainSentenceBatchWithAi(contextLines);
          recordBilling(song.id, result.billing, 'sentence-explanations');
          const knownIds = new Set(batch.map(line => line.id));
          const lineById = new Map(batch.map(line => [line.id, line]));
          for (const explanation of result.explanations || []) {
            if (!knownIds.has(explanation.line_id) || !explanation.meaning) continue;
            const line = lineById.get(explanation.line_id);
            cache[line.id] = {
              text: line.text,
              explanation
            };
          }
          setSentenceExplanationsBySong(previous => ({
            ...previous,
            [song.id]: {
              ...(previous[song.id] || {}),
              ...cache
            }
          }));
          const ready = countReady();
          setSentenceExplanationJob({
            songId: song.id,
            ready,
            total: song.lines.length
          });
          onProgress?.(ready, song.lines.length);
        } catch (error) {
          failure = error instanceof Error ? error.message : 'AI 整句解析暂时不可用。';
          break;
        }
      }
      const complete = requestedLines.every(line => hasCachedSentenceExplanation(cache, line));
      if (!complete && !failure) failure = '部分句子的解析未生成，可稍后重试。';
      if (failure) setSentenceExplanationError({
        songId: song.id,
        message: failure
      });
      return {
        cache,
        complete,
        ready: countReady(),
        error: failure
      };
    } finally {
      sentenceExplanationJobRef.current = null;
      setSentenceExplanationJob(null);
    }
  }
  async function showSentenceExplanation(line) {
    const request = ++selectionRequest.current;
    const songId = activeSong.id;
    if (sentenceExplanationOpen?.songId === songId && sentenceExplanationOpen.line.id === line.id) {
      setSentenceExplanationOpen(null);
      return;
    }
    const cached = sentenceExplanationsBySong[activeSong.id]?.[line.id];
    if (hasCachedSentenceExplanation(sentenceExplanationsBySong[activeSong.id], line)) {
      setSentenceExplanationOpen({
        songId,
        line,
        explanation: cached.explanation
      });
      return;
    }
    const result = await generateSentenceExplanations(activeSong, [line]);
    if (request !== selectionRequest.current || activeSongRef.current !== songId) return;
    const prepared = result.cache[line.id];
    if (hasCachedSentenceExplanation(result.cache, line)) setSentenceExplanationOpen({
      songId,
      line,
      explanation: prepared.explanation
    });else setToast(result.error || '这句的解析暂未生成，请稍后重试。');
  }
  async function generateCurrentSongExplanations() {
    const result = await generateSentenceExplanations(activeSong);
    setToast(result.complete ? `《${activeSong.title}》的 ${result.ready} 句解析已准备好。` : `${result.error || '部分句子未完成'}：已准备 ${result.ready} / ${activeSong.lines.length} 句，可重试。`);
  }
  return {
    sentenceExplanationOpen,
    setSentenceExplanationOpen,
    sentenceExplanationJob,
    sentenceExplanationError,
    setSentenceExplanationError,
    recordBilling,
    showSentenceExplanation,
    generateCurrentSongExplanations
  };
}
