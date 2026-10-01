export function scrollBehavior() {
  return document.documentElement.dataset.motion === 'off' ? 'auto' : 'smooth'
}
