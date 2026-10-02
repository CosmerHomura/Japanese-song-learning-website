import { Bot, LoaderCircle, Save, Sparkles, X } from 'lucide-react';
import SegmentationEditor from '../components/SegmentationEditor';
import { displayReading } from '../lib/readingDisplay';
export default function WordDetails({
  view,
  actions
}) {
  const {
    detailView,
    activeTokens,
    activeSong,
    activeLine,
    selectedPhraseRange,
    focusToken,
    recordBilling,
    segmentationUndo,
    readingLang,
    focusDisplayReading,
    wordMeaning,
    draftMeaning,
    aiBusy,
    aiExplanation,
    readingStyle
  } = view;
  const {
    closeDetail,
    setSelectedPhraseRange,
    applySegmentation,
    undoSegmentation,
    restorePhraseCorrection,
    setDraftMeaning,
    saveMeaning,
    askAiToExplain
  } = actions;
  return <div className="detail-sidebar-shell"><section className={`word-detail ${detailView === 'ai' ? 'ai-only-detail' : ''}`} role="complementary" aria-label="词典与语境释义" aria-labelledby="detail-title">
      <button className="detail-close" type="button" onClick={closeDetail} aria-label="关闭详情"><X size={18} /></button>
      <button type="button" className="restore-phrase-button" onClick={() => setSelectedPhraseRange({
        startIndex: activeTokens[0].index,
        endIndex: activeTokens.at(-1).index
      })}>选择整句调整分词</button>
      <SegmentationEditor key={`${activeSong.id}:${activeLine.id}:${selectedPhraseRange ? `${selectedPhraseRange.startIndex}-${selectedPhraseRange.endIndex}` : focusToken.index}:${activeTokens.map(token => `${token.index}:${token.surface}`).join(',')}`} tokens={selectedPhraseRange ? activeTokens.filter(token => token.index >= Math.min(selectedPhraseRange.startIndex, selectedPhraseRange.endIndex) && token.index <= Math.max(selectedPhraseRange.startIndex, selectedPhraseRange.endIndex)) : [focusToken]} lineText={activeLine.text} apply={applySegmentation} bill={billing => recordBilling(activeSong.id, billing, 'segmentation-review')} undo={undoSegmentation} canUndo={Boolean(segmentationUndo[`${activeSong.id}:${activeLine.id}`])} />
      {focusToken.user_merge_original && <button type="button" className="restore-phrase-button" onClick={restorePhraseCorrection}>恢复“{focusToken.surface}”的原分词</button>}
      {detailView !== 'ai' && <p className="eyebrow">WORD DETAILS</p>}
      {detailView !== 'ai' && <><div className="detail-heading"><div><h2 id="detail-title">{focusToken.surface}</h2><p lang={readingLang}>{focusDisplayReading || '读音待校对'}</p></div><span>{focusToken.part_of_speech || '词素'}</span></div>
      <dl className="detail-metadata"><div><dt>常用意思</dt><dd>{wordMeaning || '暂未收录；可在下方补充。'}</dd></div><div><dt>词典形</dt><dd>{focusToken.dictionary_form || focusToken.surface}</dd></div><div><dt>当前形式</dt><dd>{focusToken.surface}</dd></div><div><dt>活用信息</dt><dd>{focusToken.inflection_type || '无活用'} · {focusToken.inflection_form || '基本形'}</dd></div></dl>
      <div className="meaning-editor"><label htmlFor="meaning-input">补充或修正常用意思</label><input id="meaning-input" value={draftMeaning} onChange={event => setDraftMeaning(event.target.value)} placeholder="例如：梦；梦想" /><button type="button" onClick={saveMeaning}><Save size={14} /> 保存意思</button></div>
      <div className="detail-ai-action"><div><Bot size={15} /><span>想了解这个词在歌词中的具体用法？</span></div><button type="button" disabled={aiBusy === 'explain'} onClick={() => askAiToExplain({
            text: focusToken.surface,
            lineId: activeLine.id
          })}>{aiBusy === 'explain' ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />} AI 语境讲解</button></div></>}
      {aiExplanation && <section className="ai-explanation"><p className="eyebrow">AI IN CONTEXT</p><h3 id={detailView === 'ai' ? 'detail-title' : undefined}>{aiExplanation.term} <small lang={readingLang}>{displayReading(aiExplanation.reading, readingStyle)} · 本句推荐</small></h3><dl><div><dt>常用义</dt><dd>{aiExplanation.common_meaning || '未给出'}</dd></div><div><dt>歌词中</dt><dd>{aiExplanation.contextual_meaning || '未给出'}</dd></div>{aiExplanation.dictionary_form && <div><dt>词典形</dt><dd>{aiExplanation.dictionary_form}</dd></div>}{aiExplanation.conjugation && <div><dt>变形</dt><dd>{aiExplanation.conjugation}</dd></div>}</dl>{aiExplanation.alternative_readings?.length > 0 && <div className="alternative-readings"><h4>其他常见读音</h4><ul>{aiExplanation.alternative_readings.map(item => <li key={item.reading}><b lang={readingLang}>{displayReading(item.reading, readingStyle)}</b><span>{item.meaning || '常见异读'}</span>{item.when_to_use && <small>{item.when_to_use}</small>}</li>)}</ul></div>}{aiExplanation.usages?.length > 0 && <ul>{aiExplanation.usages.map(item => <li key={item}>{item}</li>)}</ul>}{aiExplanation.learning_tip && <p className="ai-tip">学习提示：{aiExplanation.learning_tip}</p>}{aiExplanation.caution && <p className="ai-caution">注意：{aiExplanation.caution}</p>}</section>}
      {detailView !== 'ai' && <><div className="detail-examples"><h3>常见搭配</h3>{focusToken.examples?.length ? <ul>{focusToken.examples.map(example => <li key={example}>{example}</li>)}</ul> : <p>暂未收录搭配。可先根据当前歌词语境补充常用意思。</p>}</div>
      <div className="detail-line"><span>歌词语境</span><p>{activeLine.text}</p></div></>}
    </section></div>;
}
