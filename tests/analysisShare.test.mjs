import assert from 'node:assert/strict'
import test from 'node:test'

import { createSongAnalysisFile, importSongAnalysisFile } from '../src/lib/analysisShare.js'

const song = {
  id: 'local-1', title: '测试曲', artist: '测试歌手',
  lines: [{ id: 7, text: '夏の空を見上げる' }, { id: 8, text: '君に届けたい' }],
}

test('shared analysis omits lyric text and reattaches by hash', async () => {
  const blob = await createSongAnalysisFile(song, {
    7: { text: song.lines[0].text, explanation: { meaning: '仰望夏日天空', grammar: [], vocabulary: [] } },
  }, [{ estimated_cost: 0.001, currency: 'USD' }])
  const raw = await blob.text()
  assert.equal(raw.includes(song.lines[0].text), false)
  const imported = await importSongAnalysisFile(blob, [song])
  assert.equal(imported.song.id, song.id)
  assert.equal(imported.entries[7].explanation.meaning, '仰望夏日天空')
  assert.equal(imported.entries[7].shared, true)
})

test('shared analysis requires an existing matching song', async () => {
  const blob = await createSongAnalysisFile(song, {
    7: { text: song.lines[0].text, explanation: { meaning: '解析', grammar: [], vocabulary: [] } },
  })
  await assert.rejects(() => importSongAnalysisFile(blob, [{ ...song, lines: [{ id: 7, text: '另一句' }] }]), /没有歌词指纹匹配/)
})
