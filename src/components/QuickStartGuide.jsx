import { CircleHelp, X } from 'lucide-react';
export default function QuickStartGuide({
  view,
  actions
}) {
  const {
    localSongs,
    dictionaryStatus,
    guideAiConfigured
  } = view;
  const {
    dismissQuickStart,
    openGuideImport,
    openGuideSettings
  } = actions;
  return <section className="quick-start-guide" aria-labelledby="quick-start-title">
      <div className="quick-start-heading"><div><p className="eyebrow">QUICK START</p><h2 id="quick-start-title">第一次使用？按这三步开始</h2><p>基本注音可直接使用；词典和 AI 都是增强功能，可以稍后配置。</p></div><button type="button" onClick={dismissQuickStart} aria-label="关闭使用引导" title="以后可点顶部问号重新打开"><X size={16} /></button></div>
      <ol className="quick-start-steps">
        <li className={localSongs.length ? 'complete' : ''}><span>1</span><div><b>导入一首歌 <small>推荐</small></b><p>LRC 提供时间轴，音频负责逐句播放，两者需为同一版本。</p></div><button type="button" onClick={openGuideImport}>{localSongs.length ? `已有 ${localSongs.length} 首` : '开始导入'}</button></li>
        <li className={dictionaryStatus?.installed ? 'complete' : ''}><span>2</span><div><b>安装本地词典 <small>可选</small></b><p>增加日中释义；不安装也能生成假名读音。</p></div><button type="button" onClick={openGuideSettings}>{dictionaryStatus?.installed ? '已安装' : '去设置'}</button></li>
        <li className={guideAiConfigured ? 'complete' : ''}><span>3</span><div><b>选择 AI 模型 <small>可选</small></b><p>浏览模型无需 Key；生成解析前再填写 Key。</p></div><button type="button" onClick={openGuideSettings}>{guideAiConfigured ? '已配置' : '去设置'}</button></li>
      </ol>
      <p className="quick-start-footnote">关闭后可随时点击顶部的 <CircleHelp size={12} /> 重新查看。</p>
    </section>;
}
