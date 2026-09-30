const FORMAT = 'uta-song-analysis'
const VERSION = 1

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value).normalize('NFKC').trim())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createSongAnalysisFile(song, sentenceEntries, usage = []) {
  const lines = []
  for (const line of song.lines) {
    const entry = sentenceEntries?.[line.id]
    if (entry?.text !== line.text || !entry.explanation?.meaning) continue
    lines.push({ hash: await sha256(line.text), explanation: entry.explanation })
  }
  return new Blob([JSON.stringify({
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    song: { title: song.title, artist: song.artist, lineCount: song.lines.length },
    lines,
    provenance: { usage, note: '导入者复用已有解析，不应把历史费用计作自己的支出。' },
  }, null, 2)], { type: 'application/json' })
}

export async function importSongAnalysisFile(file, songs) {
  if (!(file instanceof Blob) || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MB 的 .uta-analysis 文件。')
  let payload
  try { payload = JSON.parse(await file.text()) } catch { throw new Error('无法读取共享解析文件。') }
  if (!isRecord(payload) || payload.format !== FORMAT || payload.version !== VERSION
    || !isRecord(payload.song) || !Array.isArray(payload.lines) || payload.lines.length > 300) {
    throw new Error('共享解析文件格式不受支持。')
  }
  const candidates = songs.filter((song) => song.title === payload.song.title && song.artist === payload.song.artist)
  for (const song of candidates) {
    const byHash = new Map()
    for (const line of song.lines) byHash.set(await sha256(line.text), line)
    const entries = {}
    for (const item of payload.lines) {
      if (!isRecord(item) || typeof item.hash !== 'string' || !isRecord(item.explanation)
        || typeof item.explanation.meaning !== 'string') continue
      const line = byHash.get(item.hash)
      if (line) entries[line.id] = { text: line.text, explanation: item.explanation, shared: true }
    }
    if (Object.keys(entries).length) return { song, entries, sourceUsage: payload.provenance?.usage || [] }
  }
  throw new Error('本机歌曲库中没有歌词指纹匹配的同名歌曲；请先导入对应歌词。')
}
