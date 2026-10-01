import { useEffect, useRef, useState } from 'react'

const LINE_PLAYBACK_LEAD_IN_SECONDS = 0.5

export default function useLineAudio(activeSong, audioUrl, playbackRate) {
  const [playingLineId, setPlayingLineId] = useState(null)
  const [audioError, setAudioError] = useState('')
  const audioRef = useRef(null)
  const clipEndRef = useRef(null)
  const pendingClipRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    clipEndRef.current = null
    pendingClipRef.current = null
    setPlayingLineId(null)
    setAudioError('')
  }, [activeSong.id])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  function stopLinePlayback() {
    audioRef.current?.pause()
    clipEndRef.current = null
    pendingClipRef.current = null
    setPlayingLineId(null)
  }

  function startClipPlayback(clip) {
    const audio = audioRef.current
    if (!audio) return
    if (Number.isFinite(audio.duration) && clip.start >= audio.duration - 0.05) {
      setPlayingLineId(null)
      setAudioError('这句 LRC 的时间戳超过了音频时长，请检查歌词时间。')
      return
    }
    const fallbackEnd = Number.isFinite(audio.duration) ? audio.duration : clip.start + 8
    clipEndRef.current = Math.max(clip.start + 0.12, clip.end ?? fallbackEnd)
    audio.muted = false
    if (audio.volume === 0) audio.volume = 1
    audio.playbackRate = playbackRate
    try { audio.currentTime = clip.start } catch { /* Wait for metadata if the browser has not seeked yet. */ }
    audio.play()
      .then(() => { setPlayingLineId(clip.lineId); setAudioError('') })
      .catch((error) => {
        setPlayingLineId(null)
        setAudioError(error?.name === 'NotSupportedError' ? '该音频编码不受支持，请改用 MP3、M4A、WAV 或 OGG。' : '未能开始播放；请检查系统输出设备与应用音量。')
      })
  }

  function playLine(lineId) {
    if (!audioUrl) {
      setAudioError('当前示例不附带音频。请在歌曲库导入自己的 LRC 与音频文件。')
      return
    }
    const lineIndex = activeSong.lines.findIndex((line) => line.id === lineId)
    const line = activeSong.lines[lineIndex]
    const audio = audioRef.current
    if (!line || !audio) return
    if (playingLineId === lineId && !audio.paused) {
      audio.pause()
      setPlayingLineId(null)
      return
    }
    const nextStart = activeSong.lines[lineIndex + 1]?.start
    const clip = {
      lineId,
      // LRC marks often land just after the initial consonant. Start a little
      // early so learners hear the complete onset of the sung line.
      start: Math.max(0, (line.start || 0) - LINE_PLAYBACK_LEAD_IN_SECONDS),
      end: Number.isFinite(nextStart) ? nextStart : null,
    }
    if (audio.readyState < 1) {
      pendingClipRef.current = clip
      audio.load()
      return
    }
    startClipPlayback(clip)
  }

  function handleAudioLoadedMetadata() {
    const clip = pendingClipRef.current
    if (!clip) return
    pendingClipRef.current = null
    startClipPlayback(clip)
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current
    if (!audio || clipEndRef.current == null || audio.currentTime < clipEndRef.current - 0.04) return
    audio.pause()
    audio.currentTime = clipEndRef.current
    clipEndRef.current = null
    setPlayingLineId(null)
  }

  function handleAudioEnded() { clipEndRef.current = null; setPlayingLineId(null) }
  function handleAudioError() {
    setPlayingLineId(null)
    setAudioError(`未能加载《${activeSong.title}》的音频；请确认文件没有损坏且编码受支持。`)
  }
  return { audioRef, playingLineId, audioError, stopLinePlayback, playLine, handleAudioLoadedMetadata, handleAudioTimeUpdate, handleAudioEnded, handleAudioError }
}
