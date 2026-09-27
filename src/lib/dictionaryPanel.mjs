export function dictionaryPanelVisible(status, wasOpen, forceOpen = false) {
  if (status?.phase === 'ready') return false
  if (forceOpen || ['downloading', 'installing', 'cancelling'].includes(status?.phase)) return true
  return wasOpen
}
