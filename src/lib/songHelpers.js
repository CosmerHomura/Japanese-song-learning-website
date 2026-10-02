import { searchSongArtwork } from './annotationApi'

export async function findArtworkWithRetry(title, artist) {
  try {
    return await searchSongArtwork(title, artist)
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    try { return await searchSongArtwork(title, artist) } catch { return null }
  }
}

export function hasCachedSentenceExplanation(cache, line) {
  const entry = cache?.[line.id]
  return entry?.text === line.text && typeof entry.explanation?.meaning === 'string' && Boolean(entry.explanation.meaning.trim())
}
