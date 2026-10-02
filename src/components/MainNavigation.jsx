import { useLayoutEffect, useRef } from 'react'

const pages = [
  { id: 'library', label: '歌曲库' },
  { id: 'lesson', label: '歌曲学习' },
  { id: 'review', label: '复习' },
]

export default function MainNavigation({ activePage, onLibrary, onLesson, onReview }) {
  const navRef = useRef(null)
  const callbacks = { library: onLibrary, lesson: onLesson, review: onReview }

  useLayoutEffect(() => {
    const nav = navRef.current
    const positionIndicator = () => {
      const button = nav.querySelector('[aria-current="page"]')
      if (!button) return
      nav.style.setProperty('--nav-left', `${button.offsetLeft}px`)
      nav.style.setProperty('--nav-width', `${button.offsetWidth}px`)
    }
    positionIndicator()
    // Measure real labels instead of fixed columns: font size and narrow
    // layouts must keep the underline centered beneath the selected item.
    const observer = new ResizeObserver(positionIndicator)
    observer.observe(nav)
    nav.querySelectorAll('button').forEach(button => observer.observe(button))
    const frame = requestAnimationFrame(() => { nav.dataset.indicatorReady = 'true' })
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [activePage])

  return <nav ref={navRef} className="main-nav" aria-label="主导航">
    {pages.map(page => <button key={page.id} className={activePage === page.id ? 'active' : ''}
      aria-current={activePage === page.id ? 'page' : undefined} type="button"
      onClick={callbacks[page.id]}>{page.label}</button>)}
    <span className="nav-indicator" aria-hidden="true" />
  </nav>
}
