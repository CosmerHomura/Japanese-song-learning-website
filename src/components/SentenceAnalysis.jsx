import { Sparkles } from 'lucide-react'

export default function SentenceAnalysis({ explanation, id }) {
  return <section className="sentence-inline-analysis" id={id} aria-label="整句解析" onClick={event => event.stopPropagation()}>
    <h3><Sparkles size={14} /> 整句解析</h3>
    <div className="sentence-analysis-section"><h4>整句意思</h4><p>{explanation.meaning}</p></div>
    {explanation.vocabulary?.length > 0 && <div className="sentence-analysis-section"><h4>关键表达</h4><dl>{explanation.vocabulary.map((item, index) => <div key={`${item.surface}-${index}`}><dt lang="ja">{item.surface}</dt><dd>{item.meaning}</dd></div>)}</dl></div>}
    {explanation.grammar?.length > 0 && <div className="sentence-analysis-section"><h4>语法与语境</h4><ul>{explanation.grammar.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul></div>}
    {explanation.pronunciation_tip && <div className="sentence-analysis-section"><h4>发音提示</h4><p>{explanation.pronunciation_tip}</p></div>}
    <p className="sentence-analysis-footnote">AI 解析仅供学习参考；想了解具体词句，仍可在歌词中选中后单独提问。</p>
  </section>
}
