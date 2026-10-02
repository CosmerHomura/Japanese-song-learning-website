import { useLayoutEffect, useRef, useState } from 'react'
import { animateUi } from '../lib/uiMotion'

export default function AnimatedDetails({ className, title, children }) {
  const [expanded, setExpanded] = useState(false)
  const detailsRef = useRef(null)
  const contentRef = useRef(null)
  useLayoutEffect(() => {
    const details = detailsRef.current, content = contentRef.current
    if (!expanded && !details.open) return
    const height = content.getBoundingClientRect().height
    details.open = true
    const cancel = animateUi(content, [{ height: `${height}px`, opacity: expanded ? .6 : 1 },
      { height: `${expanded ? content.scrollHeight : 0}px`, opacity: expanded ? 1 : 0 }], {}, () => {
      content.style.height = expanded ? 'auto' : '0px'
      details.open = expanded
    })
    return () => { content.style.height = `${content.getBoundingClientRect().height}px`; cancel() }
  }, [expanded])
  return <details ref={detailsRef} className={className}>
    <summary aria-expanded={expanded} onClick={event => { event.preventDefault(); setExpanded(value => !value) }}>{title}</summary>
    <div ref={contentRef} className="disclosure-content" inert={!expanded}>{children}</div>
  </details>
}
