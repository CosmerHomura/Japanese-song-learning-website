import { useLayoutEffect, useRef } from 'react'
import { animateUi } from '../lib/uiMotion'

export default function MasteryButton({ mastered, children, ...props }) {
  const ref = useRef(null)
  const previous = useRef(mastered)
  useLayoutEffect(() => {
    const newlyMastered = mastered && !previous.current
    previous.current = mastered
    if (!newlyMastered) return
    return animateUi(ref.current, [
      { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(65,109,89,0)' },
      { transform: 'scale(1.04)', boxShadow: '0 0 0 5px rgba(65,109,89,.18)', offset: .45 },
      { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(65,109,89,0)' },
    ], { duration: 320 })
  }, [mastered])
  return <button {...props} ref={ref} aria-pressed={mastered}>{children}</button>
}
