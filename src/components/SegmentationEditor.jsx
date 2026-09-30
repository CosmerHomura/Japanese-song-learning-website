import { useEffect, useRef, useState } from 'react'
import { reparseSegments } from '../lib/annotationApi'

export default function SegmentationEditor({ tokens, lineText, apply, bill, undo, canUndo }) {
  const source = tokens.map(token => token.surface).join('')
  const [draft, setDraft] = useState(tokens.map(token => token.surface).join('\n'))
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  useEffect(() => {
    const version = ++generation.current
    setPreview(null)
    setError('')
    const segments = draft.split('\n')
    if (segments.some(item => !item) || segments.join('') !== source) {
      setError('只调整换行位置，不要增删歌词、空格或标点。')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const result = await reparseSegments({ text: source, line_text: lineText, segments })
        if (generation.current === version) setPreview(result)
      } catch (failure) { if (generation.current === version) setError(failure.message) }
    }, 400)
    return () => { clearTimeout(timer); generation.current++ }
  }, [draft, source, lineText])
  async function check() {
    const version = ++generation.current
    setBusy(true); setError(''); setPreview(null)
    try {
      const result = await reparseSegments({ text: source, line_text: lineText, segments: tokens.map(token => token.surface) }, true)
      bill(result.billing)
      if (generation.current !== version) return
      if (result.error) throw new Error(result.error)
      setPreview(result)
    } catch (failure) { if (generation.current === version) setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="phrase-correction-editor">
    <h3>调整分词</h3>
    <p>当前：{tokens.map(token => token.surface).join(' / ')}。每行一个词：删除换行合并，插入换行拆分。拖选相邻词可一起编辑。</p>
    <textarea aria-label="分词边界编辑" rows={4} value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} />
    <button type="button" disabled={busy} onClick={check}>{busy ? 'AI 检查中…' : 'AI 检查分词（按整句语境）'}</button>
    <p>手动查词免费；AI 使用设置中的模型，可能产生费用。AI 建议不会直接覆盖歌词。</p>
    {error && <p role="alert">{error}</p>}
    {preview && <div aria-live="polite"><h4>建议 / 重新查词结果</h4>{preview.reason && <p>{preview.reason}</p>}{preview.tokens.map((token, index) => <div key={index} className="segmentation-result"><strong>{token.surface}</strong> · {token.reading}<p>{token.meaning || '未查到对应词条，不自动编造释义。'}</p><small>{token.dictionary_source}</small></div>)}<button type="button" onClick={() => apply(preview.tokens)}>确认应用分词</button></div>}
    {canUndo && <button type="button" onClick={undo}>撤销上一次分词修改</button>}
  </section>
}
