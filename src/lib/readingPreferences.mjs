export const DEFAULT_READING_PREFERENCES = { interfaceSize: 18, lyricSize: 28, motion: 'on' }
export function normalizeReadingPreferences(value = {}) {
  const clamp = (input, fallback, min, max) => Number.isFinite(Number(input)) ? Math.max(min, Math.min(max, Math.round(Number(input)))) : fallback
  return { interfaceSize: clamp(value.interfaceSize ?? 18, 18, 16, 24), lyricSize: clamp(value.lyricSize ?? 28, 28, 24, 40), motion: ['on', 'off', 'system'].includes(value.motion) ? value.motion : 'on' }
}
