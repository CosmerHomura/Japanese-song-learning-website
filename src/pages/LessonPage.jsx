import { scrollBehavior } from '../lib/uiMotion';
import { BookOpenCheck, Check, ChevronDown, ChevronRight, Circle, CircleAlert, Download, Heart, MousePointer2, Pause, Pencil, Play, Plus, Save, Sparkles, Volume2, WandSparkles, X } from 'lucide-react';
import AnnotatedLine from '../components/AnnotatedLine';
import SentenceAnalysis from '../components/SentenceAnalysis';
import twilightStation from '../assets/uta-twilight-station.png';
import LearningProgress from '../components/LearningProgress';
import { displayReading, lineReading as getLineReading } from '../lib/readingDisplay';
import { hasCachedSentenceExplanation } from '../lib/songHelpers';
export default function LessonPage({
  view,
  actions
}) {
  const {
    activePage,
    exitPractice,
    activeSong,
    totalCorrections,
    reviewItems,
    activeSongCostSummary,
    practiceActive,
    startPractice,
    activeLine,
    isFavorite,
    editingReadings,
    allSongs,
    progress,
    learnedLines,
    currentProgress,
    activeLineId,
    mode,
    annotating,
    annotationError,
    audioUrl,
    openImportDialog,
    playbackRate,
    sentenceExplanationJob,
    readySentenceCount,
    exportCurrentSongAnalysis,
    generateCurrentSongExplanations,
    aiBusy,
    sentenceExplanationError,
    currentSongReviewCount,
    practiceScope,
    practiceReturnPage,
    practiceFinished,
    practicePosition,
    practiceSessionLineIds,
    playLine,
    playingLineId,
    audioError,
    practiceRevealed,
    readingLang,
    activeLineReading,
    sentenceExplanationOpen,
    showSentenceExplanation,
    gradePracticeLine,
    goToPracticePosition,
    hasSelectedLine,
    focusToken,
    focusDisplayReading,
    wordMeaning,
    reviewNeeded,
    aiError,
    aiReview,
    pendingAiSuggestions,
    annotations,
    corrections,
    readingStyle,
    currentSentenceCache,
    selectedTokenIndex,
    dragSelection,
    selectedPhraseRange,
    selectedText,
    readingLabel,
    focusKey,
    focusSuggestion,
    draftReading,
    hasReview
  } = view;
  const {
    toggleFavorite,
    setEditingReadings,
    showLibraryPage,
    chooseLine,
    chooseSong,
    setMode,
    choosePlaybackRate,
    runAiReview,
    setPracticeRevealed,
    openWordDetails,
    showAiReviewQueue,
    clearLineSelection,
    beginTokenSelection,
    extendTokenSelection,
    finishTokenSelection,
    askAiToExplain,
    handleTokenClick,
    toggleLearnedLine,
    applyAiSuggestion,
    setDraftReading,
    saveCorrection,
    resetCorrection,
    jumpToAiSuggestion,
    toggleReview
  } = actions;
  return <>
      {activePage === 'review' && <div className="review-practice-breadcrumb"><button type="button" onClick={exitPractice}>← 复习列表</button><span> / {activeSong.title} · 本曲待复习句</span></div>}
      <section className="hero anime-hero compact-lesson-header" aria-labelledby="song-title" style={{
      '--hero-art': `url(${twilightStation})`
    }}>
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-label"><span />日语歌词 · 一句一句唱清楚</div>
          <div className="anime-hero-grid">
            <div className="song-intro">
              <p className="hero-kicker">LYRICS, SLOWLY</p>
              <p className="hero-season">夜风 · 电车 · 一首歌</p>
              <h1 id="song-title">{activeSong.title}</h1>
              <p className="roman">{activeSong.artist} <span>·</span> <strong>{activeSong.lines.length} 句日语歌词</strong></p>
              <p className="song-description">把喜欢的歌拆成一句一句：先听见、读准，再慢慢唱出来。读音初稿和词义都可由你校正。</p>
              <div className="song-meta"><span><b>本次选曲</b> {activeSong.sourceFile}</span><span><b>已修正</b> {totalCorrections} 词</span><span><b>待复习</b> {reviewItems.length} 句</span><span><b>AI 估算费用</b> {activeSongCostSummary}</span></div>
              <div className="hero-cta">
                {!practiceActive && <button className="play-button" type="button" onClick={() => startPractice('all', activeSong.id, activeLine.id)}><BookOpenCheck size={14} /> 开始练习</button>}
                <button className={`save-button ${isFavorite ? 'saved' : ''}`} onClick={toggleFavorite} type="button"><Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? '已收藏' : '收藏'}</button>
                {!practiceActive && <button className="ai-review-button" onClick={() => setEditingReadings(!editingReadings)} aria-pressed={editingReadings} type="button"><Pencil size={14} /> {editingReadings ? '结束校对' : '校对读音'}</button>}
                <button className="save-button" type="button" onClick={() => showLibraryPage()}>换歌</button>
              </div>
              <p className="ai-privacy-note">AI 只会在你主动点击时参与复核，始终由你决定是否采用建议。</p>
            </div>
            <aside className="hero-focus-card" aria-label="当前歌曲学习进度">
              <p className="hero-focus-label">NOW PLAYING</p>
              <div className="hero-focus-title"><span>{String(allSongs.indexOf(activeSong) + 1).padStart(2, '0')}</span><div><b>{activeSong.title}</b><small>{activeSong.artist}</small></div></div>
              <div className="hero-progress"><div><span>读音掌握</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{
                  width: `${progress}%`
                }} /></div><p>{learnedLines.size} / {activeSong.lines.length} 句已掌握</p></div>
              <button type="button" onClick={() => showLibraryPage()}>换一首歌 <ChevronDown size={14} /></button>
            </aside>
          </div>
        </div>
      </section>

      <div className="lesson-progress-wrap"><LearningProgress stats={currentProgress} title="本曲学习进度"><details className="line-progress-details"><summary>查看逐句进度 · 点击跳转</summary><div className="line-progress-grid">{activeSong.lines.map(line => <button className={`${currentProgress.learnedIds.has(line.id) ? 'mastered' : ''} ${currentProgress.reviewIds.has(line.id) ? 'pending' : ''} ${line.id === activeLineId ? 'current' : ''}`} type="button" key={line.id} aria-label={`第 ${line.displayNumber} 句，${currentProgress.learnedIds.has(line.id) ? '已掌握' : '未掌握'}${currentProgress.reviewIds.has(line.id) ? '，待复习' : ''}`} title={line.text} onClick={() => {
              if (practiceActive) startPractice('all', activeSong.id, line.id);else chooseLine(line.id);
              window.requestAnimationFrame(() => document.getElementById(practiceActive ? 'guided-practice' : `lyric-row-${activeSong.id}-${line.id}`)?.scrollIntoView({
                behavior: scrollBehavior(),
                block: 'center'
              }));
            }}>{String(line.displayNumber).padStart(2, '0')}{currentProgress.learnedIds.has(line.id) && <Check size={12} />}</button>)}</div><p>绿色＝已掌握，橙色标记＝待复习；描边表示当前句。进度依据你的标记，不是 AI 评分。</p></details></LearningProgress></div>
      <section className={`practice-layout simplified-lesson ${editingReadings && !practiceActive ? 'editing-readings' : ''} ${practiceActive ? 'guided-practice-layout' : ''}`} id="lesson" aria-label="歌词发音学习工作区">
        <aside className="lesson-rail">
          <div className="rail-heading"><span>已导入歌曲</span><span>{allSongs.length} 首</span></div>
          <ol className="song-import-list">{allSongs.map((song, index) => <li className={song.id === activeSong.id ? 'current' : ''} key={song.id}><button onClick={() => chooseSong(song.id)} type="button"><em>{String(index + 1).padStart(2, '0')}</em><span><b>{song.title}</b><small>{song.artist} · {song.lines.length} 句</small></span></button></li>)}</ol>
          <div className="learning-tip"><span>→</span><p><b>用法</b>先看自动标注，再点词修正。你保存的版本始终优先。</p></div>
        </aside>

        <section className="lyrics-panel" aria-labelledby="lyrics-heading">
          <div className="panel-head"><div><p className="eyebrow">{practiceActive ? 'LISTEN, RECALL, REVEAL' : 'AUTO ANNOTATE, THEN VERIFY'}</p><h2 id="lyrics-heading">{practiceActive ? '逐句练习' : '逐句读音'}</h2></div>{!practiceActive && <div className="view-toggle" role="group" aria-label="读音显示方式">{[['original', '原文'], ['reading', '假名'], ['practice', '遮住练习']].map(([value, label]) => <button className={mode === value ? 'selected' : ''} onClick={() => setMode(value)} type="button" key={value}>{label}</button>)}</div>}</div>
          {!practiceActive && <div className="pronunciation-strip"><div><span className="strip-index">{annotating ? 'ANNOTATING' : annotationError ? 'OFFLINE' : 'AUTO READY'}</span><b>{annotating ? '正在为整首歌词生成读音…' : annotationError || '点击任一词查看详情；开启校对后可修改读音'}</b></div><span className="source-badge"><WandSparkles size={13} /> SudachiPy + 本地日中词典</span></div>}
          <div className="audio-tools"><p className="audio-play-tip"><Volume2 size={13} /> {audioUrl ? practiceActive ? '先听这一句，再尝试自己读出歌词。' : '点击每句右侧的播放按钮，系统会提前 0.5 秒进入本句，并播到下一句。' : <>当前示例不附带音频。<button type="button" className="audio-import-link" onClick={() => {
                showLibraryPage();
                openImportDialog();
              }}>导入 LRC 与音频</button></>}</p><label className="speed-control"><span>慢放</span><select value={playbackRate} onChange={event => choosePlaybackRate(Number(event.target.value))} aria-label="逐句播放速度" disabled={!audioUrl}><option value={1}>1×</option><option value={0.75}>0.75×</option><option value={0.5}>0.5×</option><option value={0.25}>0.25×</option></select></label></div>
          {!practiceActive && <details className="lesson-extra-tools"><summary>AI 与共享工具{sentenceExplanationJob?.songId === activeSong.id ? ' · 正在生成…' : ''}</summary><div className="sentence-explanation-status"><div><Sparkles size={15} /><span>{sentenceExplanationJob?.songId === activeSong.id ? `正在生成整句解析 ${sentenceExplanationJob.ready} / ${sentenceExplanationJob.total}` : `已有 ${readySentenceCount} / ${activeSong.lines.length} 句解析`}</span></div><div className="sentence-share-actions">{readySentenceCount > 0 && <button type="button" onClick={exportCurrentSongAnalysis}><Download size={12} /> 导出解析</button>}{readySentenceCount < activeSong.lines.length && <button type="button" disabled={Boolean(sentenceExplanationJob)} onClick={generateCurrentSongExplanations}>生成剩余解析</button>}<button type="button" onClick={runAiReview} disabled={Boolean(aiBusy)}>{aiBusy === 'review' ? '正在复核…' : 'AI 复核全曲'}</button></div></div><p className="sentence-explanation-disclosure">生成解析和 AI 复核会发送歌词给所选供应商，可能产生费用；本曲估算 {activeSongCostSummary}。</p></details>}
          {!practiceActive && sentenceExplanationError?.songId === activeSong.id && <p className="sentence-explanation-error" role="alert"><CircleAlert size={13} /> {sentenceExplanationError.message}</p>}
          {!practiceActive && <div className="practice-launch"><div><b>把这一句真正练会</b><span>先听、自己读并猜意思，再揭晓答案。</span></div><div><button className="practice-start" type="button" onClick={() => startPractice('all', activeSong.id, activeLine.id)}><BookOpenCheck size={15} /> 开始逐句练习</button>{currentSongReviewCount > 0 && <button className="practice-review-start" type="button" onClick={() => startPractice('review')}>只练待复习的 {currentSongReviewCount} 句</button>}</div></div>}
          {practiceActive && <section className="guided-card" id="guided-practice" aria-label="逐句练习卡片">
            <div className="guided-card-top"><span>{practiceScope === 'review' ? '待复习句练习' : '全曲逐句练习'}</span><button type="button" onClick={exitPractice}>{practiceReturnPage === 'review' ? '返回复习列表' : '退出练习'} <X size={13} /></button></div>
            {practiceFinished ? <div className="guided-finished" role="status"><BookOpenCheck size={28} /><h3>本轮练习完成</h3><p>已掌握的句子会计入歌曲进度；没把握的句子留在复习清单中。</p><div><button type="button" onClick={() => startPractice('all')}>再练整首</button><button type="button" disabled={!currentSongReviewCount} onClick={() => startPractice('review')}>练习待复习的 {currentSongReviewCount} 句</button></div></div> : <>
              <p className="guided-counter">第 {practicePosition + 1} / {practiceSessionLineIds.length} 句 <span>·</span> {currentSongReviewCount} 句待复习</p>
              <h3 lang="ja">{activeLine.text}</h3>
              <p className="guided-prompt">先听原声，自己读一遍，并猜猜这句的意思。答案在你点击前不会显示。</p>
              <div className="guided-listen"><button type="button" disabled={!audioUrl} onClick={() => playLine(activeLine.id)}>{playingLineId === activeLine.id ? <Pause size={14} /> : <Play size={14} />} {playingLineId === activeLine.id ? '暂停原声' : '听这一句'}</button><span>{audioUrl ? `当前 ${playbackRate}× 速度` : '这首歌尚无音频'}</span></div>
              {audioError && <p className="guided-error" role="alert">{audioError}</p>}
              {practiceRevealed ? <div className="guided-answer" aria-live="polite"><span>读音</span><p lang={readingLang}>{activeLineReading || '自动读音尚未准备好，请先到校对页面确认。'}</p><span>中文释义</span><p>{activeLine.translation || '原 LRC 未提供中文译文，请结合词汇理解这一句。'}</p><button className="guided-sentence-explain" type="button" aria-expanded={sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id} aria-controls={`guided-sentence-analysis-${activeSong.id}-${activeLine.id}`} onClick={() => showSentenceExplanation(activeLine)}><Sparkles size={13} /> {sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id ? '收起整句解析' : '查看整句解析'}</button>{sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === activeLine.id && <SentenceAnalysis explanation={sentenceExplanationOpen.explanation} id={`guided-sentence-analysis-${activeSong.id}-${activeLine.id}`} />}<div className="guided-grade"><button type="button" onClick={() => gradePracticeLine(false)}>还要再练 · 加入复习</button><button type="button" onClick={() => gradePracticeLine(true)}>我会了 · 下一句 <Check size={14} /></button></div></div> : <button className="guided-reveal" type="button" disabled={!activeLineReading} onClick={() => setPracticeRevealed(true)}>{activeLineReading ? '揭晓读音与译文' : annotationError || '正在准备自动读音…'}</button>}
              <div className="guided-navigation"><button type="button" disabled={practicePosition === 0} onClick={() => goToPracticePosition(practicePosition - 1)}>← 上一句</button><button type="button" disabled={practicePosition + 1 >= practiceSessionLineIds.length} onClick={() => goToPracticePosition(practicePosition + 1)}>跳过这一句 →</button></div>
            </>}
          </section>}
          {!practiceActive && <>
          <p className="selection-guide"><MousePointer2 size={13} /> 按住鼠标左键向右拖过词语，松开后点高亮段右上角的“AI 解释”。</p>
          {hasSelectedLine && <div className="mobile-word-dock"><div><b>{focusToken.surface} <span lang={readingLang}>{focusDisplayReading}</span></b><small>{wordMeaning || '常用意思待补充'}</small></div><button type="button" onClick={openWordDetails}>查看详情</button></div>}
          {reviewNeeded > 0 && <p className="annotation-tip warn"><CircleAlert size={13} /> 有 {reviewNeeded} 个词典未能确定读音，请优先人工校对。</p>}
          {aiError && <p className="annotation-tip ai-error"><CircleAlert size={13} /> {aiError}</p>}
          {aiReview && <p className="ai-review-summary"><Sparkles size={13} /> AI 已复核 {aiReview.reviewed_token_count} 个词素：{pendingAiSuggestions.length ? <>还有 {pendingAiSuggestions.length} 处待处理建议，<button type="button" onClick={showAiReviewQueue}>查看全部</button></> : aiReview.suggestions?.length ? '所有建议均已处理。' : '未发现明显异常；仍建议以原唱为准。'}</p>}
          <div className="lyrics-list">
            {activeSong.lines.map(line => {
              const annotation = annotations?.find(item => item.id === line.id);
              const lineTokens = annotation?.tokens;
              const current = line.id === activeLineId;
              const isPlaying = playingLineId === line.id;
              const isLearned = learnedLines.has(line.id);
              const lineReading = getLineReading(lineTokens, corrections, activeSong.id, line.id, readingStyle);
              const hasSentenceExplanation = hasCachedSentenceExplanation(currentSentenceCache, line);
              const sentenceExpanded = sentenceExplanationOpen?.songId === activeSong.id && sentenceExplanationOpen.line.id === line.id;
              return <article id={`lyric-row-${activeSong.id}-${line.id}`} className={`lyric-row ${current ? 'active' : ''}`} onClick={event => {
                if (event.target.closest('button')) return;
                if (current) clearLineSelection();else chooseLine(line.id);
              }} key={`${activeSong.id}-${line.id}`}>
                <span className="line-number">{String(line.displayNumber).padStart(2, '0')}</span>
                <div className="auto-line-wrap">
                  <div className="japanese"><AnnotatedLine tokens={lineTokens} corrections={corrections} songId={activeSong.id} lineId={line.id} mode={mode} readingStyle={readingStyle} selectedIndex={current ? selectedTokenIndex : -1} selectionRange={dragSelection?.lineId === line.id ? dragSelection : selectedPhraseRange?.lineId === line.id ? selectedPhraseRange : null} showSelectionAction={selectedText?.lineId === line.id && selectedPhraseRange?.lineId === line.id} onStartSelection={tokenIndex => beginTokenSelection(line.id, tokenIndex)} onExtendSelection={tokenIndex => extendTokenSelection(line.id, tokenIndex)} onFinishSelection={finishTokenSelection} onExplainSelection={() => askAiToExplain(selectedText)} onSelectToken={tokenIndex => handleTokenClick(line.id, tokenIndex)} /></div>
                  <div className={`reading ${lineTokens ? '' : 'needs-review'}`}>{mode === 'reading' ? lineReading || '正在生成读音…' : mode === 'practice' ? '读音已隐藏，尝试自己读出这一句' : `切换到“${readingLabel}”查看自动标注`}</div>
                  {line.translation && <div className="translation lyric-translation">{line.translation}</div>}
                </div>
                <div className="line-actions"><button className={`line-action line-play ${isPlaying ? 'playing' : ''}`} type="button" disabled={!audioUrl} onClick={event => {
                    event.stopPropagation();
                    playLine(line.id);
                  }} aria-label={audioUrl ? `${isPlaying ? '暂停' : '播放'}第 ${line.displayNumber} 句` : `第 ${line.displayNumber} 句没有音频`} title={audioUrl ? `${isPlaying ? '暂停' : '播放'}这一句` : '请先在歌曲库导入 LRC 与音频'}>{isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</button><button className={`line-mastery ${isLearned ? 'mastered' : ''}`} type="button" aria-pressed={isLearned} onClick={event => {
                    event.stopPropagation();
                    toggleLearnedLine(line.id);
                  }} title={isLearned ? '点击改为未掌握' : '点击标记为已掌握'}>{isLearned ? <Check size={12} /> : <Circle size={11} />}<span>{isLearned ? '已掌握' : '未掌握'}</span></button><button className="sentence-explain-link" type="button" aria-expanded={sentenceExpanded} aria-controls={`sentence-analysis-${activeSong.id}-${line.id}`} disabled={!hasSentenceExplanation && Boolean(sentenceExplanationJob)} onClick={event => {
                    event.stopPropagation();
                    showSentenceExplanation(line);
                  }}><Sparkles size={11} /> {sentenceExpanded ? '收起解析' : hasSentenceExplanation ? '查看解析' : sentenceExplanationJob ? '生成中…' : '生成解析'}</button></div>
                {sentenceExpanded && <SentenceAnalysis explanation={sentenceExplanationOpen.explanation} id={`sentence-analysis-${activeSong.id}-${line.id}`} />}
              </article>;
            })}
          </div>
          <div className="lyrics-footer"><span>点击任一词即可在右侧校对；选中短语可请求 AI 解释</span><span>每句右侧可切换掌握状态</span></div>
          </>}
        </section>

        {!practiceActive && editingReadings && <aside className="word-panel" aria-labelledby="word-heading">
          <div className="panel-head compact"><div><p className="eyebrow">EDIT THE READING</p><h2 id="word-heading">校对读音</h2></div><span className={`annotation-state ${hasSelectedLine && corrections[focusKey] ? 'corrected' : ''}`}>{hasSelectedLine ? corrections[focusKey] ? '已修正' : '自动初稿' : '未选中'}</span></div>
          {hasSelectedLine ? <div className="word-card correction-card">
            <div className="word-topline"><span className="word-level">{focusToken.part_of_speech || '词素'}</span><button type="button" aria-label="选中词"><Pencil size={15} /></button></div>
            <div className="word-main"><h3>{focusToken.surface}</h3><p className="word-kana" lang={readingLang}>{focusDisplayReading || '暂无词典读音'}</p><p className="word-meaning">{wordMeaning || '常用意思暂未收录，可在详情中补充'}</p><button className="detail-link" type="button" onClick={openWordDetails}>查看详情 <ChevronRight size={14} /></button></div>
            {focusSuggestion && <div className="ai-suggestion"><span><Sparkles size={12} /> AI 复核建议 · {(focusSuggestion.confidence * 100).toFixed(0)}%</span><p>建议读作「{displayReading(focusSuggestion.suggested_reading, readingStyle)}」：{focusSuggestion.reason}</p><button type="button" onClick={applyAiSuggestion}>采用建议</button></div>}
            <label className="reading-editor"><span>{readingStyle === 'romaji' ? '假名输入（用于校对）' : '假名读音'}</span><input value={draftReading} onChange={event => setDraftReading(event.target.value)} placeholder="输入平假名或片假名" lang="ja" /><small>{readingStyle === 'romaji' ? `罗马音预览：${displayReading(draftReading, 'romaji') || '请先输入假名'}` : '如：わすれた / もの / かえる'}</small></label>
            <div className="editor-actions"><button className="save-reading" onClick={saveCorrection} type="button"><Save size={13} /> 保存修正</button>{corrections[focusKey] && <button className="reset-reading" onClick={resetCorrection} type="button">恢复初稿</button>}</div>
          </div> : <p className="word-panel-empty">选择歌词中的一个词，即可查看并修改它的读音。</p>}
          {pendingAiSuggestions.length > 0 && <section className="ai-review-queue" id="ai-review-queue" aria-labelledby="ai-review-queue-title" tabIndex={-1}>
            <div><span className="eyebrow">AI REVIEW QUEUE</span><h3 id="ai-review-queue-title">复核建议 <b>{pendingAiSuggestions.length}</b></h3></div>
            <ol>{pendingAiSuggestions.map(suggestion => <li className={suggestion.line_id === activeLineId && suggestion.token_index === focusToken.index ? 'current' : ''} key={`${suggestion.line_id}-${suggestion.token_index}`}><button type="button" onClick={() => jumpToAiSuggestion(suggestion)}><span>第 {activeSong.lines.find(line => line.id === suggestion.line_id)?.displayNumber} 句 · {suggestion.surface}</span><small>{displayReading(suggestion.original_reading, readingStyle)} <ChevronRight size={11} /> {displayReading(suggestion.suggested_reading, readingStyle)}</small></button></li>)}</ol>
          </section>}
          {hasSelectedLine && <><div className="word-context"><span>所在句子</span><p>{activeLine.text}</p><small>点击歌词中的其他词，可继续逐词校对。</small></div>
          <div className="practice-checklist"><span>校对建议</span><p>① 先确认自动读音是否合理<br />② 歌词特殊读法按原唱实际修正<br />③ 将有疑问的整句加入复习</p></div>
          <button className={`review-button ${hasReview ? 'added' : ''}`} onClick={toggleReview} type="button">{hasReview ? <><Check size={13} /> 已加入今日复习</> : <><Plus size={13} /> 加入今日复习</>}</button></>}
        </aside>}
      </section>


      <section className="method-section"><div className="method-title"><p className="eyebrow">THE CORRECTION LOOP</p><h2>自动起稿，<br />由学习者校准。</h2></div><div className="method-cards"><article><span>01</span><h3>全曲自动注音</h3><p>导入任意日语歌词后，由 Sudachi 词典逐词生成读音初稿。</p></article><article><span>02</span><h3>AI 复核与人工确认</h3><p>AI 只标出可能不合理的读法；采用、修改或忽略建议始终由你决定。</p></article><article><span>03</span><h3>按语境理解词汇</h3><p>选中词或短语再请求讲解，结合相邻歌词学习词义和变形。</p></article></div></section>

      </>;
}
