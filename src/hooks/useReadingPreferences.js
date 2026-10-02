import { useEffect, useState } from 'react'
import { normalizeReadingPreferences } from '../lib/readingPreferences.mjs'

export default function useReadingPreferences() {
  const [readingPreferences, setReadingPreferences] = useState(() => {
    try { return normalizeReadingPreferences(JSON.parse(localStorage.getItem('uta-reading-preferences-v1')) || {}) }
    catch { return normalizeReadingPreferences() }
  })
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const motionEnabled = readingPreferences.motion === 'on' || readingPreferences.motion === 'system' && !systemReducedMotion
  useEffect(() => {
    const preferences = normalizeReadingPreferences(readingPreferences)
    const root = document.documentElement
    root.style.setProperty('--ui-font-size', `${preferences.interfaceSize}px`)
    root.style.setProperty('--lyric-font-size', `${preferences.lyricSize}px`)
    root.dataset.motion = motionEnabled ? 'on' : 'off'
    root.dataset.theme = preferences.theme
    localStorage.setItem('uta-reading-preferences-v1', JSON.stringify(preferences))
  }, [readingPreferences, motionEnabled])
  return { readingPreferences, setReadingPreferences, systemReducedMotion }
}
