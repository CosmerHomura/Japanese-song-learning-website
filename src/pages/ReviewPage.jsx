import { ChevronRight } from 'lucide-react'

export default function ReviewPage({ reviewQueue, currentSongReviewCount, startPractice }) {
  return <section className="review-queue-section" id="review-queue" aria-labelledby="review-queue-title">
        <div className="review-queue-heading"><div><p className="eyebrow">WORDS IN CONTEXT, ONE LINE AT A TIME</p><h2 id="review-queue-title">待复习的句子 <span>{reviewQueue.length}</span></h2><p>练习时选择“还要再练”，句子就会来到这里；学会后会自动移出。</p></div>{currentSongReviewCount > 0 && <button type="button" onClick={() => startPractice('review')}>练习本首待复习句 <ChevronRight size={15} /></button>}</div>
        {reviewQueue.length ? <ol className="review-line-list">{reviewQueue.map(({ song, line }) => <li key={`${song.id}:${line.id}`}><button type="button" onClick={() => startPractice('review', song.id, line.id)}><span>{song.title} · 第 {line.displayNumber} 句</span><b lang="ja">{line.text}</b><small>开始练习 <ChevronRight size={13} /></small></button></li>)}</ol> : <p className="review-queue-empty">目前没有待复习句。开始逐句练习，把没把握的句子留下来。</p>}
      </section>
}
