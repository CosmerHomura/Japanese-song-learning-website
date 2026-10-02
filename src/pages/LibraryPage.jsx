import { useRef } from 'react'
import { BookOpenCheck, CircleAlert, Download, LoaderCircle, Search, Trash2, Upload, X } from 'lucide-react'
import { demoSongs } from '../data/demoSongs'
import { songArtworkBySource } from '../data/songArtwork'
import { songProgress } from '../lib/learningProgress.mjs'

export default function LibraryPage({ librarySearch, setLibrarySearch, visibleLibrarySongs, collectionProgress, learnedBySong, activeSongId, deletingSongId, openImportDialog, chooseSongFromLibrary, removeImportedSong, backupBusy, backupError, backupPreview, exportLearningData, prepareBackupRestore, importSharedAnalysis }) {
  const backupInputRef = useRef(null)
  const analysisInputRef = useRef(null)
  return <section className="library-section library-page" id="library" aria-labelledby="library-title">
<div className="library-top"><div><p className="eyebrow">YOUR IMPORTED SONGS</p><h2 id="library-title">歌曲库</h2><p>先导入歌曲，再进入逐句听读；AI 解析可在学习时按需生成。</p></div><div className="library-top-actions"><label className="library-search"><Search size={14} /><input id="library-search" type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="搜索歌名或歌手" aria-label="搜索歌名或歌手" />{librarySearch && <button type="button" onClick={() => setLibrarySearch('')} aria-label="清除搜索"><X size={13} /></button>}</label><span className="library-count">{librarySearch ? `找到 ${visibleLibrarySongs.length} / ${collectionProgress.songs} 首` : `已导入 ${collectionProgress.songs} 首`}</span><button className="library-import-trigger" type="button" onClick={openImportDialog}><Upload size={14} /> 导入歌曲</button></div></div>
        <section className="library-completion-summary visual-completion" aria-label="歌曲库完成情况"><div className="completion-ring" role="img" aria-label={`完成 ${collectionProgress.completed} / ${collectionProgress.songs} 首歌曲`} style={{ '--completion-angle': `${collectionProgress.songs ? collectionProgress.completed / collectionProgress.songs * 360 : 0}deg` }}><span><strong>{collectionProgress.completed}<small> / {collectionProgress.songs}</small></strong><small>首歌曲已完成</small></span></div><div className="completion-copy"><span>歌曲学习进度</span><div className="completion-song-track" role="progressbar" aria-valuemin={0} aria-valuemax={collectionProgress.songs || 1} aria-valuenow={collectionProgress.completed} aria-label="已完成歌曲比例"><i style={{ width: `${collectionProgress.songs ? collectionProgress.completed / collectionProgress.songs * 100 : 0}%` }} /></div><p>已完成 <b>{collectionProgress.completed}</b> 首 · 歌曲总数 <b>{collectionProgress.songs}</b> 首</p></div></section>
        <div className="library-backup-bar"><div><b>保存或共享学习结果</b><span>完整备份供自己迁移；共享解析不含 API Key、音频或歌词正文。</span></div><div className="library-backup-actions"><button type="button" onClick={exportLearningData} disabled={Boolean(backupBusy)}>{backupBusy === 'export' ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />} 导出备份</button><button type="button" onClick={() => backupInputRef.current?.click()} disabled={Boolean(backupBusy)}>{backupBusy === 'inspect' ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} 恢复备份</button><button type="button" onClick={() => analysisInputRef.current?.click()}><Upload size={14} /> 导入共享解析</button><input ref={backupInputRef} type="file" accept=".uta-backup,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void prepareBackupRestore(file) }} hidden /><input ref={analysisInputRef} type="file" accept=".uta-analysis,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importSharedAnalysis(file) }} hidden /></div></div>
        {backupError && !backupPreview && <p className="library-backup-error" role="alert"><CircleAlert size={14} /> {backupError}</p>}
        {visibleLibrarySongs.length ? <div className="song-library-grid">{visibleLibrarySongs.map((song, index) => {
          const artwork = song.artworkUrl ? { artworkUrl: song.artworkUrl, sourceUrl: song.artworkSourceUrl, provider: song.artworkProvider } : songArtworkBySource[song.sourceFile]
          const learnedCount = songProgress(song, learnedBySong[song.id] || []).learned
          const isCurrentSong = song.id === activeSongId
          return <article className={`library-song-card ${isCurrentSong ? 'current' : ''}`} key={song.id}>
            <button className="library-song-open" type="button" onClick={() => chooseSongFromLibrary(song.id)} aria-label={`学习 ${song.title}，${song.artist}`}>
              <span className="library-cover">
                <span className="library-cover-fallback" aria-hidden="true">{song.title.slice(0, 2)}</span>
                {artwork?.artworkUrl && <img src={artwork.artworkUrl} alt={`${song.title} 的发行封面`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
                <span className="library-cover-shade" aria-hidden="true" />
                <span className="library-card-index">{String(index + 1).padStart(2, '0')}</span>
                {isCurrentSong && <span className="library-current-badge">正在学习</span>}
                <span className="library-local-badge">{song.isLocal ? '本地导入' : song.isDemo ? '内置原创示例' : '来自项目文件夹'}</span>
              </span>
              <span className="library-card-copy"><b>{song.title}</b><small>{song.artist}</small><span><BookOpenCheck size={15} /> {learnedCount === song.lines.length ? '已完成' : '未完成'}</span></span>
            </button>
            <p className="library-source-note">{song.isLocal ? '删除仅移除应用中的副本，保留电脑上的原文件。' : song.isDemo ? '随应用提供的原创练习示例。' : '此歌曲随应用提供，你也可以导入自己的歌曲。'}</p>
            {artwork?.sourceUrl && <a className="library-artwork-source" href={artwork.sourceUrl} target="_blank" rel="noreferrer">封面来源 · {artwork.provider || 'Apple Music'}</a>}
            {song.isLocal && <button className="library-delete-button" type="button" disabled={deletingSongId === song.id} onClick={() => removeImportedSong(song)} aria-label={`删除 ${song.title}`} title="删除这首本地导入歌曲"><Trash2 size={13} /> {deletingSongId === song.id ? '删除中' : '删除'}</button>}
          </article>
        })}</div> : <div className="library-empty-search"><BookOpenCheck size={32} /><h3>{librarySearch ? '没有找到匹配的歌曲' : '从你喜欢的第一首歌开始'}</h3><p>准备同一版本的 LRC 与音频，导入后即可逐句听读。词典和 AI 可以稍后配置。</p><button type="button" onClick={openImportDialog}>导入歌曲</button><button type="button" onClick={() => chooseSongFromLibrary(demoSongs[0].id)}>体验无音频示例</button></div>}
      </section>
}
