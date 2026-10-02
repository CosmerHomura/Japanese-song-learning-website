export function scrollBehavior() {
  return document.documentElement.dataset.motion === 'off' ? 'auto' : 'smooth'
}

export function animateUi(element, frames, options, complete = () => {}) {
  if (document.documentElement.dataset.motion === 'off') { complete(); return () => {} }
  const animation = element.animate(frames, { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both', ...options })
  let cancelled = false
  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.motion === 'off') animation.finish()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  animation.finished.then(() => { observer.disconnect(); if (!cancelled) complete(); animation.cancel() }).catch(() => {})
  return () => { cancelled = true; observer.disconnect(); animation.cancel() }
}
