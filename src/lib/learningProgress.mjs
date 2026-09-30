export function songProgress(song, learnedIds = [], reviewItems = []) {
  const ids = new Set(song.lines.map((line) => line.id))
  const learned = new Set(learnedIds.filter((id) => ids.has(id)))
  const review = new Set(reviewItems.filter((item) => item.songId === song.id && ids.has(item.lineId)).map((item) => item.lineId))
  return {
    total: ids.size,
    learned: learned.size,
    remaining: ids.size - learned.size,
    review: review.size,
    percent: ids.size ? Math.round(learned.size / ids.size * 100) : 0,
    learnedIds: learned,
    reviewIds: review,
  }
}

export function libraryProgress(songs, learnedBySong = {}, reviewItems = []) {
  const uniqueSongs = [...new Map(songs.map((song) => [song.id, song])).values()]
  const result = uniqueSongs.reduce((totals, song) => {
    const stats = songProgress(song, learnedBySong[song.id] || [], reviewItems)
    return { songs: totals.songs + 1, completed: totals.completed + (stats.total > 0 && stats.learned === stats.total ? 1 : 0), total: totals.total + stats.total, learned: totals.learned + stats.learned, review: totals.review + stats.review }
  }, { songs: 0, completed: 0, total: 0, learned: 0, review: 0 })
  return { ...result, percent: result.total ? Math.round(result.learned / result.total * 100) : 0 }
}
