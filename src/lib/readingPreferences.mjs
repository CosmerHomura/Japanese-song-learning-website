export const DEFAULT_READING_PREFERENCES = { interfaceSize: 16, lyricSize: 26, motion: 'on' }
export function normalizeReadingPreferences(value = {}) {
  const clamp = (input, fallback, min, max) => Number.isFinite(Number(input)) ? Math.max(min, Math.min(max, Math.round(Number(input)))) : fallback
  return { interfaceSize: clamp(value.interfaceSize ?? 16, 16, 14, 22), lyricSize: clamp(value.lyricSize ?? 26, 26, 20, 40), motion: ['on', 'off', 'system'].includes(value.motion) ? value.motion : 'on' }
}
