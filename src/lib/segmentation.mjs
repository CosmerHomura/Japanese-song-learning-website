// Match corrections by exact character span and text, never by a new token's
// positional index. Unchanged words keep their reading when neighbours split.
export function resegmentLine(tokens, range, replacement, corrections, prefix) {
  const first = Math.min(range.startIndex, range.endIndex)
  const last = Math.max(range.startIndex, range.endIndex)
  let offset = 0
  const original = tokens.map(token => {
    const span = { ...token, start: offset, end: offset + token.surface.length }
    offset = span.end
    return span
  })
  const selected = original.filter(token => token.index >= first && token.index <= last)
  if (!selected.length || !replacement.length || replacement.some(token => !token.surface)
    || replacement.map(token => token.surface).join('') !== selected.map(token => token.surface).join('')) {
    throw new Error('分词结果必须完整保留选中的原文。')
  }
  const selectedIds = new Set(selected.map(token => token.index))
  const next = original.flatMap(token => token.index === selected[0].index ? replacement : selectedIds.has(token.index) ? [] : [token])
  const existing = new Map(original.map(token => [`${token.start}:${token.end}:${token.surface}`, token]))
  const nextCorrections = Object.fromEntries(Object.entries(corrections).filter(([key]) => !key.startsWith(prefix)))
  offset = 0
  const indexed = next.map((token, index) => {
    const start = offset
    offset += token.surface.length
    const old = existing.get(`${start}:${offset}:${token.surface}`)
    const reading = old && corrections[`${prefix}${old.index}`]
    if (reading) nextCorrections[`${prefix}${index}`] = reading
    return { ...token, index, start, end: offset }
  })
  return { tokens: indexed, corrections: nextCorrections, selectedIndex: indexed.find(token => token.start === selected[0].start)?.index ?? 0 }
}
