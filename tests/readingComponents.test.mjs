import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, AnnotatedLine, SettingsDialog
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  AnnotatedLine = (await server.ssrLoadModule('/src/components/AnnotatedLine.jsx')).default
  SettingsDialog = (await server.ssrLoadModule('/src/components/SettingsDialog.jsx')).default
})
after(async () => { await server?.close() })

function lyric(style, mode = 'reading') {
  return renderToStaticMarkup(createElement(AnnotatedLine, {
    tokens: [{ index: 0, surface: '帰る', reading: 'かえる' }], corrections: { 'test:0:0': 'かえる' },
    songId: 'test', lineId: 0, mode, readingStyle: style,
  }))
}

test('ruby display switches scripts without changing original lyrics or kana suffixes', () => {
  assert.match(lyric('hiragana'), /<ruby>帰<rt lang="ja">かえ<\/rt><\/ruby>る/)
  assert.match(lyric('romaji'), /<ruby>帰<rt lang="ja-Latn">kae<\/rt><\/ruby>る/)
  assert.match(lyric('romaji'), /読音|读音 kaeru/)
})

test('original and hidden practice modes still hide ruby in both scripts', () => {
  for (const style of ['hiragana', 'romaji']) {
    for (const mode of ['original', 'practice']) assert.ok(!lyric(style, mode).includes('<rt'))
  }
})

test('settings offers both options and reflects persisted selection', () => {
  for (const style of ['hiragana', 'romaji']) {
    const markup = renderToStaticMarkup(createElement(SettingsDialog, { initialTab: 'reading', readingStyle: style, onReadingStyleChange: () => {} }))
    assert.match(markup, /注音显示/)
    assert.match(markup, /平假名/)
    assert.match(markup, /罗马音/)
    assert.match(markup, new RegExp(`checked="" value="${style}"`))
  }
})
