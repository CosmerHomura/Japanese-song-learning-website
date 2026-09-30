export function formatLrcTimestamp(seconds) {
  const milliseconds = Math.round(seconds * 1000)
  const minutes = Math.floor(milliseconds / 60000)
  const remainder = milliseconds % 60000
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remainder / 1000)).padStart(2, '0')}.${String(remainder % 1000).padStart(3, '0')}`
}

export function parseLrcTimestamp(value) {
  const match = String(value).trim().match(/^\[?(\d{1,3}):([0-5]\d(?:\.\d{1,3})?)\]?$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
