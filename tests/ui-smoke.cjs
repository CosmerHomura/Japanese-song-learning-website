/* Run after npm run build: node tests/ui-smoke.cjs. Uses an isolated Electron profile. */
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

const { app, BrowserWindow } = require('electron')
const http = require('node:http')
const assert = require('node:assert/strict')
fs.mkdirSync(path.join(root, 'out'), { recursive: true })
const profile = fs.mkdtempSync(path.join(root, 'out', 'ui-smoke-'))
app.setPath('userData', profile)

async function main() {
  const { demoSongs } = await import('../src/data/demoSongs.js')
  const song = demoSongs[0]
  const annotations = song.lines.map(line => ({ ...line, tokens: Array.from(line.text).map((surface, index) => ({
    index, surface, reading: surface, is_symbol: /\s/.test(surface), part_of_speech: '测试词',
  })) }))
  const snapshot = {
    version: 2,
    progress: { corrections: { [`${song.id}:0:0`]: 'ゆう' },
      reviewItems: [{ songId: song.id, lineId: 1, text: song.lines[1].text }],
      lyricSnapshots: { [song.id]: { lines: song.lines } } },
    annotations: { [song.id]: annotations },
    aiReviews: { [song.id]: { reviewed_token_count: 20, suggestions: [{ line_id: 0, token_index: 1, surface: '暮', original_reading: 'くれ', suggested_reading: 'ぐれ', confidence: .8, reason: '测试建议' }] } },
  }
  const dist = path.join(root, 'dist')
  const server = http.createServer((req, res) => {
    if (req.url === '/seed') { res.end('<!doctype html><title>Test seed</title>'); return }
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(req.url === '/api/ai/status' ? { configured: false } : {}))
      return
    }
    const filename = path.resolve(dist, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url.split('?')[0]))
    if (!filename.startsWith(dist + path.sep) || !fs.existsSync(filename)) { res.writeHead(404); res.end(); return }
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(filename)] || 'application/octet-stream')
    fs.createReadStream(filename).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  await app.whenReady()
  const origin = `http://127.0.0.1:${server.address().port}`
  const window = new BrowserWindow({ show: false, width: 1360, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') && !details.url.startsWith('data:') }))
  const js = code => window.webContents.executeJavaScript(code)
  async function until(code, label) {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await js(code)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Timed out: ${label}`)
  }
  const clickText = text => js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`)
  try {
    await window.loadURL(origin + '/seed')
    await js(`localStorage.setItem('uta-learning-state-v2', ${JSON.stringify(JSON.stringify(snapshot))}); localStorage.setItem('uta-quick-start-dismissed-v1','1'); localStorage.setItem('uta-reading-preferences-v1',JSON.stringify({motion:'on'}))`)
    await window.loadURL(origin + '/')
    await until(`!!document.querySelector('.library-page')`, 'library')
    await clickText('歌曲学习')
    await until(`!!document.querySelector('.lyric-token')`, 'lesson tokens')
    await js(`document.querySelector('.lyrics-panel').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))`)
    await until(`!document.querySelector('.lyric-row.active')`, 'deselection')
    const colors = await js(`Array.from(document.querySelectorAll('.lyric-row:first-child .lyric-token')).slice(0,2).map(e => getComputedStyle(e).color)`)
    assert.equal(colors[0], colors[1], 'corrected word uses the normal text color')
    await clickText('查看全部')
    await until(`document.activeElement?.id === 'ai-review-queue'`, 'review queue mounts and receives focus')
    await js(`document.querySelectorAll('.lyric-token')[1].click()`)
    await until(`!!document.querySelector('.lyric-row.active')`, 'word selection')
    await js(`document.querySelector('.lyrics-panel').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))`)
    await until(`!!document.querySelector('.word-panel-empty') && !document.querySelector('.lyric-row.active')`, 'cleared sidebar')
    await js(`document.querySelectorAll('.lyric-row')[1].querySelector('.lyric-token').click()`)
    await until(`!!document.querySelector('.reading-editor input')`, 'kana correction editor')
    await js(`{ const input=document.querySelector('.reading-editor input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'ゆっくり'); input.dispatchEvent(new Event('input',{bubbles:true})); }`)
    await clickText('保存修正')
    await until(`JSON.parse(localStorage.getItem('uta-learning-state-v2')).progress.corrections[${JSON.stringify(song.id + ':1:0')}] === 'ゆっくり'`, 'correction persistence')
    await clickText('复习')
    await until(`!!document.querySelector('.review-line-list button')`, 'review page preserves queue')
    await clickText('歌曲库')
    await until(`!!document.querySelector('.library-page')`, 'library navigation')
    await js(`document.querySelector('.page-transition').getAnimations().forEach(a=>a.finish())`)
    assert.equal(await js(`getComputedStyle(document.querySelector('.page-transition')).transform`), 'none', 'finished page animation does not retain a transformed containing block')
    await window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [mode, expected] of [['system', 'off'], ['on', 'on'], ['off', 'off']]) {
      await js(`localStorage.setItem('uta-reading-preferences-v1', JSON.stringify({motion:${JSON.stringify(mode)}}))`)
      await window.loadURL(origin + '/')
      await until(`document.documentElement.dataset.motion === '${expected}'`, `${mode} motion preference`)
    }
    assert.ok(await js(`JSON.parse(localStorage.getItem('uta-learning-state-v2')).progress.corrections[${JSON.stringify(song.id + ':1:0')}] === 'ゆっくり'`), 'correction survives reload')
    console.log('UI smoke passed: correction color, queue link, selection, persistence, pages, and all motion modes.')
    console.log(`Isolated test profile: ${profile}`)
  } finally {
    window.destroy()
    server.close()
  }
}
main().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })
