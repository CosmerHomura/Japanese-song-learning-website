import { scrollBehavior } from '../lib/uiMotion';
import { useEffect, useState } from 'react';
import { createPracticeSession } from '../lib/practiceSession.mjs';
export default function usePractice({
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
} = {}) {
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceScope, setPracticeScope] = useState('all');
  const [practiceReturnPage, setPracticeReturnPage] = useState('lesson');
  const [practiceSessionLineIds, setPracticeSessionLineIds] = useState([]);
  const [practicePosition, setPracticePosition] = useState(0);
  const practiceFinished = practiceActive && practiceSessionLineIds.length > 0 && practicePosition >= practiceSessionLineIds.length;
  function startPractice(scope = 'all', songId = activeSong.id, targetLineId = null) {
    const song = allSongs.find(item => item.id === songId);
    if (!song) return;
    const {
      lineIds,
      position
    } = createPracticeSession(song, scope, reviewItems, targetLineId);
    if (!lineIds.length) {
      setToast('这首歌还没有待复习的句子。');
      return;
    }
    stopLinePlayback();
    if (songId !== activeSong.id) chooseSong(songId);
    setPracticeReturnPage(activePage === 'review' ? 'review' : practiceActive ? practiceReturnPage : 'lesson');
    setActivePage(scope === 'review' && (activePage === 'review' || practiceReturnPage === 'review' && practiceActive) ? 'review' : 'lesson');
    setPracticeScope(scope);
    setPracticeSessionLineIds(lineIds);
    setPracticePosition(position);
    setActiveLineId(lineIds[position]);
    setPracticeRevealed(false);
    setSentenceExplanationOpen(null);
    setPracticeActive(true);
  }
  useEffect(() => {
    if (!practiceActive || !['lesson', 'review'].includes(activePage)) return;
    const frame = window.requestAnimationFrame(() => document.getElementById('guided-practice')?.scrollIntoView({
      behavior: scrollBehavior(),
      block: 'start'
    }));
    return () => window.cancelAnimationFrame(frame);
  }, [activePage, practiceActive, activeSong.id, practicePosition]);
  function goToPracticePosition(position) {
    const lineId = practiceSessionLineIds[position];
    if (lineId == null) return;
    stopLinePlayback();
    setPracticePosition(position);
    setActiveLineId(lineId);
    setPracticeRevealed(false);
    setSentenceExplanationOpen(null);
  }
  function gradePracticeLine(learned) {
    if (!practiceRevealed || practiceFinished) return;
    const lineId = practiceSessionLineIds[practicePosition];
    const line = activeSong.lines.find(item => item.id === lineId);
    if (!line) return;
    setLearnedBySong(previous => {
      const next = new Set(previous[activeSong.id] || []);
      if (learned) next.add(lineId);else next.delete(lineId);
      return {
        ...previous,
        [activeSong.id]: [...next]
      };
    });
    setReviewItems(previous => {
      const remaining = previous.filter(item => !(item.songId === activeSong.id && item.lineId === lineId));
      return learned ? remaining : [...remaining, {
        songId: activeSong.id,
        lineId,
        text: line.text
      }];
    });
    if (practicePosition + 1 < practiceSessionLineIds.length) {
      goToPracticePosition(practicePosition + 1);
      setToast(learned ? '已标记掌握，继续下一句。' : '已加入复习清单，继续下一句。');
    } else {
      stopLinePlayback();
      setPracticePosition(practiceSessionLineIds.length);
      setPracticeRevealed(false);
      setToast(learned ? '本轮练习完成。' : '本轮练习完成，错句已加入复习清单。');
    }
  }
  function exitPractice() {
    stopLinePlayback();
    setPracticeActive(false);
    setPracticeRevealed(false);
    setActivePage(practiceReturnPage);
  }
  return {
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
  };
}
