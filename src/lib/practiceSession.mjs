export function createPracticeSession(song, scope, reviewItems, targetLineId = null) {
  let lineIds = [...new Set(song.lines.filter((line) => scope === 'all' || reviewItems.some((item) => item.songId === song.id && item.lineId === line.id)).map((line) => line.id))]
  const targetIndex = lineIds.indexOf(targetLineId)
  // Starting with a clicked review sentence must not omit earlier items.
  if (scope === 'review' && targetIndex > 0) lineIds = [...lineIds.slice(targetIndex), ...lineIds.slice(0, targetIndex)]
  return { lineIds, position: scope === 'review' ? 0 : Math.max(0, targetIndex) }
}
