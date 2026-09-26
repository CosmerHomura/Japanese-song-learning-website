import { aiRequestHeaders } from './aiSettings'

const apiOrigin = import.meta.env.VITE_ANNOTATION_API_URL || 'http://127.0.0.1:8000'

export async function annotateSongLines(lines) {
  const response = await fetch(`${apiOrigin}/api/annotate/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines: lines.map(({ id, text }) => ({ id, text })) }),
  })
  if (!response.ok) throw new Error('自动注音服务暂不可用')
  return response.json()
}

export async function searchSongArtwork(title, artist = '') {
  const params = new URLSearchParams({ title, artist })
  const response = await fetch(`${apiOrigin}/api/artwork/search?${params.toString()}`)
  if (!response.ok) throw new Error('封面查询服务暂不可用')
  const result = await response.json().catch(() => ({}))
  if (!result.artwork_url) return null
  return {
    artworkUrl: result.artwork_url,
    artworkSourceUrl: result.source_url || '',
    artworkProvider: result.provider || 'Apple Music',
  }
}

async function postAi(path, payload, settings, signal) {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiRequestHeaders(settings) },
    signal,
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'AI 服务暂不可用，请检查配置')
  return body
}

export function reviewSongWithAi(song) {
  return postAi('/api/ai/review-song', {
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    lines: song.lines.map(({ id, text }) => ({ id, text })),
  })
}

export function explainSelectionWithAi(payload) {
  return postAi('/api/ai/explain-selection', payload)
}

export function explainSentenceBatchWithAi(lines) {
  return postAi('/api/ai/explain-sentences', { lines })
}

export async function getAiStatus(signal) {
  const response = await fetch(`${apiOrigin}/api/ai/status`, { signal })
  if (!response.ok) throw new Error('无法读取 AI 服务状态')
  return response.json()
}

export async function testAiConnection(settings, signal) {
  try {
    return await postAi('/api/ai/test', {}, settings, signal)
  } catch (error) {
    if (error instanceof TypeError) throw new Error('无法连接网站后端，请确认服务已启动。')
    throw error
  }
}
