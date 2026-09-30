export function mergeSelectedTokens(tokens, firstIndex, lastIndex, reading, meaning = '') {
  if (!reading.trim()) throw new Error('请填写合并后的假名读音。')
  const selected = tokens.filter((token) => token.index >= Math.min(firstIndex, lastIndex) && token.index <= Math.max(firstIndex, lastIndex))
  if (selected.length < 2 || selected.some((token) => token.user_merge_original)) throw new Error('请选择至少两个尚未合并的相邻词；已合并词可先恢复分词。')
  const first = selected[0]
  const surface = selected.map((token) => token.surface).join('')
  const merged = { ...first, surface, reading: reading.trim(), dictionary_form: surface, normalized_form: surface, base: surface, ruby: reading.trim(), suffix: '', meaning: meaning.trim() || null, examples: [], is_symbol: false, needs_review: false, part_of_speech: '自定义词组', user_merge_original: selected }
  return tokens.flatMap((token) => token.index === first.index ? [merged] : selected.some((item) => item.index === token.index) ? [] : [token])
}

export function restoreMergedToken(tokens, index) {
  return tokens.flatMap((token) => token.index === index && token.user_merge_original ? token.user_merge_original : [token])
}
