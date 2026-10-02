import { BookOpenCheck, X } from 'lucide-react';
export default function DictionaryDownloadPanel({
  view,
  actions
}) {
  const {
    dictionaryStatus,
    runDictionaryAction
  } = view;
  const {
    setDictionaryPanelOpen
  } = actions;
  return <aside className="dictionary-download-panel" role="status" aria-live="polite">
      <div className="dictionary-panel-head"><div><BookOpenCheck size={17} /><b>Tomoshi 本地词典</b></div>{!['downloading', 'installing', 'cancelling'].includes(dictionaryStatus.phase) && <button type="button" onClick={() => setDictionaryPanelOpen(false)} aria-label="关闭词典下载提示"><X size={15} /></button>}</div>
      <p>{dictionaryStatus.phase === 'downloading' ? '正在下载词典，可随时取消；下次会从已下载部分继续。' : dictionaryStatus.phase === 'installing' ? '正在校验并安装数据库…' : dictionaryStatus.phase === 'cancelling' ? '正在停止当前操作…' : dictionaryStatus.phase === 'cancelled' ? '下载已取消，已下载部分会保留以便续传。' : dictionaryStatus.phase === 'ready' ? '本地日中词典已安装完成。' : dictionaryStatus.error || '词典尚未安装。'}</p>
      {['downloading', 'installing', 'cancelling'].includes(dictionaryStatus.phase) && <div className="dictionary-progress"><span style={{
        width: dictionaryStatus.total_bytes ? `${Math.min(100, dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%` : dictionaryStatus.phase === 'installing' ? '100%' : '18%'
      }} /></div>}
      <div className="dictionary-progress-meta"><span>{dictionaryStatus.total_bytes ? `${(dictionaryStatus.downloaded_bytes / 1048576).toFixed(1)} / ${(dictionaryStatus.total_bytes / 1048576).toFixed(1)} MB` : dictionaryStatus.phase === 'installing' ? '正在安装' : ''}</span>{dictionaryStatus.total_bytes && <b>{Math.round(dictionaryStatus.downloaded_bytes / dictionaryStatus.total_bytes * 100)}%</b>}</div>
      <div className="dictionary-panel-actions">{['downloading', 'installing'].includes(dictionaryStatus.phase) ? <button type="button" className="danger" onClick={() => runDictionaryAction('cancel')}>取消下载</button> : <><button type="button" onClick={() => runDictionaryAction('download')}>{dictionaryStatus.phase === 'cancelled' ? '继续下载' : '下载最新版'}</button><button type="button" onClick={() => runDictionaryAction('chooseLocal')}>选择本地文件</button><button type="button" onClick={() => window.utaDesktop.dictionary.openReleases()}>打开发布页</button></>}</div>
    </aside>;
}
