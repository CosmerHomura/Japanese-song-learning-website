import { useEffect, useRef, useState } from 'react';
import { annotateSongLines, refreshDictionaryMeanings } from '../lib/annotationApi';
import { annotationMatchesLine } from '../lib/learningIdentity';
export default function useSongAnnotation(song, saved, setAnnotations, ready, dictionaryRevision) {
  const [annotating, setAnnotating] = useState(false);
  const [annotationError, setAnnotationError] = useState('');
  const refreshed = useRef(new Map());
  const cached = saved[song.id];
  useEffect(() => {
    if (!ready) return;
    const existing = (cached || []).filter(annotation => song.lines.some(line => annotationMatchesLine(annotation, line)));
    const missing = song.lines.filter(line => !existing.some(annotation => annotationMatchesLine(annotation, line)));
    if (!missing.length) {
      setAnnotating(false);
      return;
    }
    let disposed = false;
    setAnnotating(true);
    setAnnotationError('');
    annotateSongLines(missing).then(annotation => {
      if (!missing.every(line => annotation.some(item => annotationMatchesLine(item, line)))) throw new Error('注音与歌词不匹配');
      if (!disposed) setAnnotations(previous => ({
        ...previous,
        [song.id]: [...existing, ...annotation.map(item => ({
          ...item,
          text: missing.find(line => line.id === item.id)?.text
        }))]
      }));
    }).catch(() => {
      if (!disposed) setAnnotationError('自动注音暂不可用，请稍后重试或重新打开应用。');
    }).finally(() => {
      if (!disposed) setAnnotating(false);
    });
    return () => {
      disposed = true;
    };
  }, [song.id, song.lines, cached, ready]);
  useEffect(() => {
    if (!ready || !dictionaryRevision || !cached?.length || refreshed.current.get(song.id) === dictionaryRevision) return;
    const lines = cached.filter(annotation => song.lines.some(line => annotationMatchesLine(annotation, line))).map(annotation => ({
      ...annotation,
      text: song.lines.find(line => line.id === annotation.id).text
    }));
    if (!lines.length) return;
    let disposed = false;
    refreshDictionaryMeanings(lines).then(results => {
      if (disposed) return;
      refreshed.current.set(song.id, dictionaryRevision);
      setAnnotations(previous => ({
        ...previous,
        [song.id]: (previous[song.id] || []).map(line => {
          const entries = results.find(result => result.id === line.id)?.tokens || [];
          return {
            ...line,
            tokens: line.tokens.map(token => {
              const entry = entries.find(entry => entry.index === token.index && entry.surface === token.surface);
              return entry?.meaning && !token.user_merge_original ? {
                ...token,
                meaning: entry.meaning,
                examples: entry.examples
              } : token;
            })
          };
        })
      }));
    }).catch(() => {});
    return () => {
      disposed = true;
    };
  }, [song.id, song.lines, cached, ready, dictionaryRevision]);
  return {
    annotating,
    annotationError
  };
}
