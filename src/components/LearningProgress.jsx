export default function LearningProgress({ stats, title, children }) {
  return <section className="learning-progress-card" aria-label={title}>
    <div className="learning-progress-heading"><h2>{title}</h2><strong>{stats.percent}<small>%</small></strong></div>
    <div className="learning-progress-bar" role="progressbar" aria-label={`${title}已掌握比例`} aria-valuemin={0} aria-valuemax={stats.total || 1} aria-valuenow={stats.learned} aria-valuetext={`已掌握 ${stats.learned} / ${stats.total} 句`}><span style={{ width: `${stats.total ? stats.learned / stats.total * 100 : 0}%` }} /></div>
    <div className="learning-progress-values"><span><i className="mastered" />已掌握 <b>{stats.learned}</b> / {stats.total} 句</span><span><i className="pending" />待复习 <b>{stats.review}</b> 句</span>{stats.songs !== undefined && <span>歌曲 <b>{stats.songs}</b> 首</span>}</div>
    {children}
  </section>
}
