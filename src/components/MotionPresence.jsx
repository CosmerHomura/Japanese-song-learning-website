import { useLayoutEffect, useRef, useState } from 'react'
import { animateUi } from '../lib/uiMotion'

export default function MotionPresence({ shown, children }) {
  const [present, setPresent] = useState(shown)
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (shown) { setPresent(true); return }
    if (!present || !ref.current?.firstElementChild) return
    return animateUi(ref.current.firstElementChild,
      [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(20px)' }],
      { duration: 180 }, () => setPresent(false))
  }, [shown, present])
  return present ? <div ref={ref} className="motion-presence" inert={!shown}>{children}</div> : null
}
