import { CircleAlert, LoaderCircle, Upload, X } from 'lucide-react';
export default function BackupRestoreDialog({
  view,
  actions
}) {
  const {
    backupBusy,
    backupPreview,
    backupError,
    restoreLearningData
  } = view;
  const {
    setBackupPreview,
    setBackupError
  } = actions;
  return <div className="backup-backdrop" role="presentation" onClick={() => {
    if (backupBusy !== 'restore') {
      setBackupPreview(null);
      setBackupError('');
    }
  }}><section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title" onClick={event => event.stopPropagation()}>
      <button className="backup-close" type="button" disabled={backupBusy === 'restore'} onClick={() => {
        setBackupPreview(null);
        setBackupError('');
      }} aria-label="关闭备份预览"><X size={18} /></button>
      <p className="eyebrow">RESTORE LOCAL DATA</p><h2 id="backup-dialog-title">确认恢复备份</h2>
      <p className="backup-file-name">{backupPreview.file.name || 'UTA 备份文件'}</p>
      <dl className="backup-summary"><div><dt>备份时间</dt><dd>{new Date(backupPreview.manifest.createdAt).toLocaleString('zh-CN')}</dd></div><div><dt>本地导入歌曲</dt><dd>{backupPreview.manifest.songs.length} 首（含音频）</dd></div><div><dt>读音修正</dt><dd>{Object.keys(backupPreview.manifest.progress.corrections).length} 处</dd></div><div><dt>待复习句</dt><dd>{backupPreview.manifest.progress.reviewItems.length} 句</dd></div><div><dt>文件大小</dt><dd>{(backupPreview.file.size / 1048576).toFixed(1)} MB</dd></div></dl>
      <p className="backup-warning"><CircleAlert size={16} /> 恢复会替换当前应用中的本地导入歌曲和学习数据，包括已掌握句子、读音修正与复习清单。建议先导出当前数据。</p>
      {backupError && <p className="library-backup-error" role="alert">{backupError}</p>}
      <div className="backup-dialog-actions"><button type="button" disabled={backupBusy === 'restore'} onClick={() => {
          setBackupPreview(null);
          setBackupError('');
        }}>取消</button><button type="button" disabled={backupBusy === 'restore'} onClick={restoreLearningData}>{backupBusy === 'restore' ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{backupBusy === 'restore' ? '正在恢复…' : '覆盖当前数据并恢复'}</button></div>
    </section></div>;
}
