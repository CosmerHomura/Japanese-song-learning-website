import { BookOpenCheck, CircleAlert, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
export default function ImportDialog({
  view,
  actions
}) {
  const {
    closeImportDialog,
    importLocalSong,
    importLrcFile,
    prepareLrcPreview,
    importAudioFile,
    importPreparing,
    importDraft,
    updateImportMetadata,
    importArtworkUrl,
    importArtworkStatus,
    searchImportArtwork,
    useDefaultImportArtwork,
    changeImportArtworkUrl,
    importArtwork,
    addImportLine,
    updateImportLine,
    removeImportLine,
    importAiProgress,
    importError,
    importBusy
  } = view;
  const {
    setImportAudioFile,
    setImportError
  } = actions;
  return <div className="song-import-backdrop" role="presentation" onClick={closeImportDialog}><form className="song-import-dialog" onSubmit={event => {
      event.preventDefault();
      importLocalSong();
    }} onClick={event => event.stopPropagation()}>
      <button className="song-import-close" type="button" onClick={closeImportDialog} aria-label="关闭导入窗口"><X size={18} /></button>
      <p className="eyebrow">ADD A LOCAL SONG</p><h2>导入歌曲开始学习</h2><p className="song-import-intro">准备同一版本的 LRC 和音频：LRC 决定每句从哪里开始，音频用于逐句播放。选择后先检查预览，确认时才会保存到本机。</p>
      <details className="lrc-help"><summary>LRC 是什么？从哪里获得？</summary><p>LRC 是带时间戳的歌词文本，不是音频。例如 <code>[00:12.50]ここから始めよう</code> 表示这句在 12.5 秒开始。当前导入需要 LRC 与音频，才能准确定位每句。</p><ul><li>在 <a href="https://lrclib.net" target="_blank" rel="noreferrer">LRCLIB 搜索同步歌词</a>，核对歌名、歌手、时长和版本；并非每首歌都有。</li><li>如果你的音乐播放器支持导出歌词，可选择导出 .lrc 文件。</li><li>找不到时，可用歌词编辑器边听边为每句打时间戳，保存为 UTF-8 的 .lrc 文件。仅把 TXT 改后缀不会生成时间轴。</li></ul><p>现场版、伴奏版、剪辑版通常需要各自的时间轴。优先使用官方提供或你有权使用的歌词与音频。</p></details>
      <div className="import-guide-strip"><span><b>1</b> 选择 LRC</span><span><b>2</b> 选择音频</span><span><b>3</b> 校对时间与歌词</span><span><b>4</b> 确认导入</span></div>
      <label className={`song-file-field ${importLrcFile ? 'selected' : ''}`}><span>01 · 歌词文件</span><strong>{importLrcFile?.name || '选择 .lrc 文件'}</strong><small>需要每句开头的时间戳，例如 [01:23.45]</small><input key={importLrcFile?.name || 'empty-lrc'} type="file" accept=".lrc,text/plain" onChange={event => prepareLrcPreview(event.target.files?.[0] || null)} /></label>
      <label className={`song-file-field ${importAudioFile ? 'selected' : ''}`}><span>02 · 原声音频</span><strong>{importAudioFile?.name || '选择 MP3、M4A、WAV、OGG 等音频'}</strong><small>播放时会根据 LRC 时间戳逐句截取</small><input key={importAudioFile?.name || 'empty-audio'} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" onChange={event => {
          setImportAudioFile(event.target.files?.[0] || null);
          setImportError('');
        }} /></label>
      {importPreparing && <p className="import-preview-loading"><LoaderCircle className="spin" size={14} /> 正在解析歌词与译文…</p>}
      {importDraft && <section className="import-preview" aria-labelledby="import-preview-title">
        <div className="import-preview-heading"><div><p className="eyebrow">REVIEW BEFORE SAVING</p><h3 id="import-preview-title">导入预览</h3></div><span>{importDraft.lines.length} 句 · 歌名与歌手资料行已排除</span></div>
        <div className="import-meta-fields"><label>歌曲名<input value={importDraft.title} onChange={event => updateImportMetadata('title', event.target.value)} maxLength={160} /></label><label>歌手<input value={importDraft.artist} onChange={event => updateImportMetadata('artist', event.target.value)} maxLength={160} /></label></div>
        <div className="import-cover-preview"><div className="import-cover-thumb"><span>{importDraft.title.slice(0, 2) || 'UTA'}</span>{/^https?:\/\//i.test(importArtworkUrl) && <img key={importArtworkUrl} src={importArtworkUrl} alt="候选歌曲封面" referrerPolicy="no-referrer" onError={event => {
              event.currentTarget.hidden = true;
            }} />}</div><div className="import-cover-controls"><b>封面预览</b><p>{importArtworkStatus === 'loading' ? '正在按歌名与歌手查找封面…' : importArtworkStatus === 'found' ? '已找到候选封面，请核对是否正确。' : importArtworkStatus === 'none' ? '未找到可靠封面，可填写链接或使用默认封面。' : importArtworkStatus === 'manual' ? '使用你填写的封面链接。' : importArtworkStatus === 'default' ? '将使用默认封面。' : '请查找封面，或选择默认封面。'}</p><div><button type="button" disabled={importArtworkStatus === 'loading'} onClick={() => searchImportArtwork(importDraft.title, importDraft.artist)}>重新查找</button><button type="button" onClick={useDefaultImportArtwork}>使用默认封面</button></div><label>也可以填写封面图片链接<input type="url" value={importArtworkUrl} onChange={event => changeImportArtworkUrl(event.target.value)} placeholder="https://example.com/cover.jpg" /></label>{importArtworkStatus === 'found' && importArtwork?.artworkSourceUrl && <a href={importArtwork.artworkSourceUrl} target="_blank" rel="noreferrer">查看封面来源 · {importArtwork.artworkProvider || 'Apple Music'}</a>}</div></div>
        <div className="import-lines-heading"><div><b>歌词与时间轴</b><span>可修改时间、日文、中文译文；保存时会按时间排序。</span></div><button type="button" onClick={addImportLine}><Plus size={13} /> 添加一句</button></div>
        <ol className="import-preview-lines">{importDraft.lines.map((line, index) => <li key={line.draftId}><span>{String(index + 1).padStart(2, '0')}</span><div><label>时间戳<input value={line.timeText} onChange={event => updateImportLine(line.draftId, 'timeText', event.target.value)} placeholder="00:12.345" aria-label={`第 ${index + 1} 句时间戳`} /></label><label>日文歌词<input value={line.text} onChange={event => updateImportLine(line.draftId, 'text', event.target.value)} maxLength={500} lang="ja" aria-label={`第 ${index + 1} 句日文歌词`} /></label><label>中文译文<input value={line.translation} onChange={event => updateImportLine(line.draftId, 'translation', event.target.value)} maxLength={500} aria-label={`第 ${index + 1} 句中文译文`} placeholder="没有译文可留空" /></label></div><button className="import-remove-line" type="button" onClick={() => removeImportLine(line.draftId)} aria-label={`删除第 ${index + 1} 句`} title="删除这一句"><Trash2 size={14} /></button></li>)}</ol>
      </section>}
      <p className="import-ai-disclosure"><BookOpenCheck size={14} /> 导入只保存歌曲并生成本地读音，无需 API Key。AI 解析可在学习页按需生成，也可以导入共享解析。</p>
      {importAiProgress && <p className="import-ai-progress" role="status"><LoaderCircle className="spin" size={14} /> 歌曲已保存，正在生成整句解析：{importAiProgress.ready} / {importAiProgress.total} 句</p>}
      {importError && <p className="song-import-error"><CircleAlert size={14} /> {importError}</p>}
      <div className="song-import-actions"><button type="button" onClick={closeImportDialog} disabled={importBusy}>取消</button><button className="song-import-submit" type="submit" disabled={importBusy || importPreparing || importArtworkStatus === 'loading'}>{importBusy ? '正在导入…' : '保存并开始学习'}</button></div>
    </form></div>;
}
