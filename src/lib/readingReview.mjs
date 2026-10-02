export function unresolvedReadings(song, annotations = [], corrections = {}) {
  return song.lines.flatMap(line => (annotations?.find(item => item.id === line.id)?.tokens || [])
    .filter(token => token.needs_review && !token.is_symbol && !corrections[`${song.id}:${line.id}:${token.index}`])
    .map(token => ({ line_id: line.id, token_index: token.index, surface: token.surface })))
}
