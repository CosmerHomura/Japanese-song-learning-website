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
  annotations[0].tokens[1].reading = 'くれ'
  const dist = path.join(root, 'dist')
  let pendingExplanation
  const testTokens = segments => segments.map((surface, index) => ({ index, surface, reading: surface, is_symbol: false, dictionary_form: surface, part_of_speech: '测试词', meaning: '测试释义', examples: [], needs_review: false }))
  const server = http.createServer((req, res) => {
    if (req.url === '/seed') { res.end('<!doctype html><title>Test seed</title>'); return }
    if (req.url === '/desktop-test') {
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
      const mock = `window.utaDesktop={ai:{settings:async()=>({provider:'deepseek',model:'test-model',base_url:'https://example.invalid',has_api_key:false,keys:[],providers:[{id:'deepseek',label:'测试供应商'}],provider_defaults:{deepseek:{model:'test-model',base_url:'https://example.invalid'}},currency:'CNY',input_price:5,cached_input_price:2,output_price:10,pricing_source:'测试价格'}),models:()=>new Promise(resolve=>{window.__finishModels=()=>resolve({models:[{id:'test-model',name:'测试模型',input_price:5,cached_input_price:2,output_price:10},{id:'unknown-model',name:'未知价格模型'}]})}),saveSettings:async(settings)=>{window.__lastSaved=settings;return {...settings,has_api_key:false}}}}`
      res.setHeader('Content-Type', 'text/html')
      res.end(html.replace('<head>', `<head><script>${mock}</script>`))
      return
    }
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/api/ai/explain-selection') {
        pendingExplanation = () => res.end(JSON.stringify({ term: '春', contextual_meaning: 'STALE_SHOULD_NOT_DISPLAY', billing: { billed_request: true, estimated_cost: .01, currency: 'CNY' } }))
        return
      }
      if (req.url === '/api/annotate/batch' || req.url === '/api/annotate/segments') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          const payload = JSON.parse(body)
          res.end(JSON.stringify(payload.lines ? payload.lines.map(line => ({ ...line, tokens: testTokens(Array.from(line.text)) })) : { tokens: testTokens(payload.segments) }))
        })
        return
      }
      res.end(JSON.stringify(req.url === '/api/ai/status' ? { configured: false } : {}))
      return
    }
    if (req.url.startsWith('/test-modules/')) {
      let filename = path.resolve(root, 'src', req.url.slice('/test-modules/'.length).split('?')[0])
      if (!path.extname(filename)) filename += '.js'
      if (!filename.startsWith(path.join(root, 'src') + path.sep) || !fs.existsSync(filename)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', 'application/javascript')
      fs.createReadStream(filename).pipe(res)
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
  const window = new BrowserWindow({ show: false, width: 1360, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') && !details.url.startsWith('data:') }))
  const js = code => window.webContents.executeJavaScript(code.startsWith('await ') ? `(async()=>{${code}})()` : code.includes('await ') && !code.startsWith('(async') ? `(async()=>(${code}))()` : code)
  window.webContents.on('console-message', event => {
    if (event.level === 'error') console.error(event.message)
  })
  const readSnapshot = `await new Promise((resolve,reject)=>{const r=indexedDB.open('uta-local-song-library',2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('learning'),q=tx.objectStore('learning').get('current');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close()}})`
  async function until(code, label) {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await js(code)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Timed out: ${label}`)
  }
  const clickText = text => js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`)
  async function screenshot(name) {
    await js(`await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
    fs.writeFileSync(path.join(root, 'out', name), (await window.webContents.capturePage()).toPNG())
  }
  try {
    await window.loadURL(origin + '/seed')
    await js(`localStorage.setItem('uta-learning-state-v2', ${JSON.stringify(JSON.stringify(snapshot))}); localStorage.setItem('uta-quick-start-dismissed-v1','1'); localStorage.setItem('uta-reading-preferences-v1',JSON.stringify({motion:'on'}))`)
    await js(`await new Promise((resolve,reject)=>{const r=indexedDB.open('uta-local-song-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('songs',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('songs','readwrite');tx.objectStore('songs').put({...${JSON.stringify(song)},id:'local-migration-test',isLocal:true,audioBlob:new Blob([new Uint8Array([1,2,3])]),createdAt:1,artworkUrl:'data:image/png;base64,'});tx.oncomplete=()=>{db.close();resolve()}}})`)
    await window.loadURL(origin + '/')
    await until(`!!document.querySelector('.library-page')`, 'library')
    assert.equal(await js(`document.querySelectorAll('.library-song-card').length`), 1, 'old IndexedDB songs survive schema upgrade')
    assert.equal(await js(`localStorage.getItem('uta-learning-state-v2')`), null, 'legacy snapshot retired after successful migration')
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
    await until(`(${readSnapshot}).progress.corrections[${JSON.stringify(song.id + ':1:0')}] === 'ゆっくり'`, 'correction persistence')
    await clickText('复习')
    await until(`!!document.querySelector('.review-line-list button')`, 'review page preserves queue')
    const forwardMotion = await js(`(()=>{const page=document.querySelector('.page-transition'),animation=page.getAnimations()[0];animation.pause();animation.currentTime=90;const matrix=new DOMMatrix(getComputedStyle(page).transform);return {x:matrix.m41,y:matrix.m42}})()`)
    assert.ok(forwardMotion.x > 0 && forwardMotion.y === 0, `page motion is horizontal: ${JSON.stringify(forwardMotion)}`)
    assert.equal(await js(`document.querySelector('.page-transition').dataset.pageDirection`), 'forward')
    await clickText('歌曲库')
    await until(`!!document.querySelector('.library-page')`, 'library navigation')
    assert.equal(await js(`document.querySelector('.page-transition').dataset.pageDirection`), 'backward')
    await js(`document.querySelector('.page-transition').getAnimations().forEach(a=>a.finish())`)
    assert.equal(await js(`getComputedStyle(document.querySelector('.page-transition')).transform`), 'none', 'finished page animation does not retain a transformed containing block')
    await window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [mode, expected] of [['system', 'off'], ['on', 'on'], ['off', 'off']]) {
      await js(`localStorage.setItem('uta-reading-preferences-v1', JSON.stringify({motion:${JSON.stringify(mode)}}))`)
      await window.loadURL(origin + '/')
      await until(`document.documentElement.dataset.motion === '${expected}'`, `${mode} motion preference`)
    }
    assert.ok(await js(`(${readSnapshot}).progress.corrections[${JSON.stringify(song.id + ':1:0')}] === 'ゆっくり'`), 'correction survives reload')

    // Import original lyrics and generated silent WAV, then exercise the
    // actual editing/practice UI rather than calling controller functions.
    await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('导入歌曲')).click()`)
    await until(`!!document.querySelector('.song-import-dialog')`, 'import dialog')
    await js(String.raw`(()=>{const input=document.querySelector('.song-import-dialog input[type=file]'),data=new DataTransfer();data.items.add(new File(['[ti:原创测试]\n[ar:UTA 测试]\n[00:00.10]春の風\n[00:00.60]ゆっくり歌う'], 'original.lrc'));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await until(`!!document.querySelector('.import-preview')`, 'LRC preview')
    await js(`(()=>{const bytes=new Uint8Array(88244),view=new DataView(bytes.buffer),text=(at,value)=>Array.from(value).forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));text(0,'RIFF');view.setUint32(4,88236,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,44100,true);view.setUint32(28,88200,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,88200,true);const data=new DataTransfer();data.items.add(new File([bytes],'silent.wav',{type:'audio/wav'}));const input=document.querySelectorAll('.song-import-dialog input[type=file]')[1];input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await clickText('使用默认封面')
    await clickText('保存并开始学习')
    await until(`document.querySelector('#song-title')?.textContent === '原创测试' && document.querySelectorAll('.lyric-row:first-child .lyric-token').length === 3`, 'import and local annotation')
    const importedId = await js(`document.querySelector('.lyric-row').id.replace('lyric-row-','').replace(/-0$/,'')`)
    await clickText('校对读音')
    await js(`document.querySelectorAll('.lyric-row:first-child .lyric-token')[2].click()`)
    await until(`!!document.querySelector('.reading-editor input')`, 'new word correction')
    await js(`{const input=document.querySelector('.reading-editor input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'かぜ');input.dispatchEvent(new Event('input',{bubbles:true}))}`)
    await clickText('保存修正')
    await clickText('结束校对')
    await js(`document.querySelector('.lyric-token').click()`)
    await clickText('选择整句调整分词')
    await js(String.raw`{const input=document.querySelector('[aria-label="分词边界编辑"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'春の\n風');input.dispatchEvent(new Event('input',{bubbles:true}))}`)
    await until(`document.querySelector('.segmentation-result strong')?.textContent === '春の'`, 'live dictionary reparse preview')
    await clickText('确认应用分词')
    await until(`document.querySelectorAll('.lyric-row:first-child .lyric-token').length === 2`, 'merged word boundaries')
    await until(`(${readSnapshot}).progress.corrections[${JSON.stringify(importedId + ':0:1')}] === 'かぜ'`, 'unchanged word keeps correction after index change')
    await screenshot('ui-lesson-check.png')
    await clickText('撤销上一次分词修改')
    await until(`document.querySelectorAll('.lyric-row:first-child .lyric-token').length === 3`, 'segmentation undo')
    await until(`(${readSnapshot}).progress.corrections[${JSON.stringify(importedId + ':0:2')}] === 'かぜ'`, 'undo restores correction mapping')
    await clickText('AI 语境讲解')
    for (let attempt=0; attempt<80 && !pendingExplanation; attempt++) await new Promise(resolve=>setTimeout(resolve,25))
    assert.ok(pendingExplanation, 'mock AI request started')
    await js(`document.querySelectorAll('.lyric-row')[1].querySelector('.lyric-token').click()`)
    pendingExplanation()
    await until(`(${readSnapshot}).aiUsage[${JSON.stringify(importedId)}]?.some(item=>item.action === 'selection-explanation')`, 'late request still records its actual cost')
    assert.ok(!await js(`document.body.textContent.includes('STALE_SHOULD_NOT_DISPLAY')`), 'late explanation cannot replace the newly selected word')
    await js(`document.querySelector('.lyrics-panel').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))`)
    await until(`!document.querySelector('.word-detail') && !document.querySelector('.lyric-row.active')`, 'blank click closes sidebar and clears selection')
    await js(`document.querySelector('.lyric-row').click()`)
    await window.webContents.executeJavaScript(`document.querySelector('.line-play').click()`, true)
    await until(`document.querySelector('audio').readyState >= 1`, 'generated WAV decodes')
    await until(`!document.querySelector('audio').paused`, 'line playback starts')
    await clickText('开始逐句练习')
    await clickText('揭晓读音与译文')
    await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('我会了 · 下一句')).click()`)
    await until(`(${readSnapshot}).progress.learnedBySong[${JSON.stringify(importedId)}]?.includes(0)`, 'practice mastery persistence')
    await clickText('揭晓读音与译文')
    await clickText('还要再练 · 加入复习')
    await clickText('复习')
    await until(`!!document.querySelector('.review-line-list')`, 'review after practice')
    await js(`Array.from(document.querySelectorAll('.review-line-list button')).find(b=>b.textContent.includes('原创测试')).click()`)
    await until(`document.querySelector('.guided-card h3')?.textContent === 'ゆっくり歌う'`, 'clicked review sentence starts the right session')
    await clickText('揭晓读音与译文')
    await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('我会了 · 下一句')).click()`)
    await until(`!(${readSnapshot}).progress.reviewItems.some(item=>item.songId === ${JSON.stringify(importedId)})`, 'mastered review sentence leaves queue')
    await clickText('歌曲库')
    await until(`!!document.querySelector('.library-page')`, 'library progress after review')
    await screenshot('ui-library-check.png')

    // Use the production repository with real Chromium IndexedDB. A clone
    // error after clear/put must abort both stores, leaving the old data intact.
    const rollback = await js(`(async()=>{const repo=await import('${origin}/test-modules/lib/applicationRepository.js');const before=await repo.loadApplicationData();let failed=false;try{await repo.restoreApplicationData([{...before.songs[0],id:'temporary'}, {id:'invalid',notCloneable:()=>{}}],before.learning)}catch{failed=true}const after=await repo.loadApplicationData();return {failed,ids:after.songs.map(s=>s.id),same:JSON.stringify(before.learning)===JSON.stringify(after.learning)}})()`)
    assert.ok(rollback.failed && rollback.same && rollback.ids.length === 2 && rollback.ids.includes('local-migration-test') && rollback.ids.includes(importedId), 'failed restore atomically preserves songs and learning')
    const futureVersion = await js(`(async()=>{const repo=await import('${origin}/test-modules/lib/applicationRepository.js'),before=await repo.loadApplicationData();const put=value=>new Promise((resolve,reject)=>{const r=indexedDB.open('uta-local-song-library',2);r.onsuccess=()=>{const db=r.result,tx=db.transaction('learning','readwrite');tx.objectStore('learning').put(value,'current');tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)}});await put({...before.learning,version:99});let blocked=false;try{await repo.saveApplicationLearning(before.learning)}catch{blocked=true}const version=(${readSnapshot}).version;await put(before.learning);return {blocked,version}})()`)
    assert.deepEqual(futureVersion, { blocked: true, version: 99 }, 'older code cannot overwrite a newer database snapshot')
    const deletion = await js(`(async()=>{const repo=await import('${origin}/test-modules/lib/applicationRepository.js');const before=await repo.loadApplicationData();before.learning.aiUsage['local-migration-test']=[{estimated_cost:1}];await repo.saveApplicationLearning(before.learning);await repo.deleteSongAndLearning('local-migration-test');await repo.saveApplicationLearning(before.learning);const after=await repo.loadApplicationData();return {songs:after.songs.length,usage:after.learning.aiUsage['local-migration-test']}})()`)
    assert.equal(deletion.songs, 1)
    assert.equal(deletion.usage, undefined, 'late saves cannot resurrect deleted song billing')
    const restoration = await js(`(async()=>{const repo=await import('${origin}/test-modules/lib/applicationRepository.js');const before=await repo.loadApplicationData();await repo.restoreApplicationData([{...${JSON.stringify(song)},id:'local-restored-test',isLocal:true,audioBlob:new Blob([new Uint8Array([4,5,6])]),createdAt:2,artworkUrl:'data:image/png;base64,'}],before.learning);await repo.saveApplicationLearning({...before.learning,progress:{...before.learning.progress,corrections:{}}});const after=await repo.loadApplicationData();return {id:after.songs[0].id,audio:Array.from(new Uint8Array(await after.songs[0].audioBlob.arrayBuffer())),reading:after.learning.progress.corrections[${JSON.stringify(song.id + ':1:0')}]}})()`)
    assert.deepEqual(restoration, { id: 'local-restored-test', audio: [4,5,6], reading: 'ゆっくり' }, 'restore commits audio and learning together and ignores old pending saves')
    await window.loadURL(origin + '/')
    await until(`!!document.querySelector('.library-song-card')`, 'restored library reload')
    await window.loadURL(origin + '/desktop-test')
    await until(`!!window.__finishModels && !!document.querySelector('.library-page')`, 'desktop background model refresh')
    await js(`document.querySelector('[aria-label="应用设置"]').click()`)
    await until(`!!document.querySelector('.settings-refresh-status')`, 'pending refresh shown')
    await clickText('阅读与动效')
    assert.equal(await js(`document.querySelector('.ai-settings-dialog').dataset.settingsTab`), 'appearance')
    await js(`document.querySelector('[aria-label="关闭设置"]').click()`)
    await until(`!document.querySelector('.ai-settings-dialog')`, 'settings closes while models are pending')
    await js(`window.__finishModels()`)
    await js(`document.querySelector('[aria-label="应用设置"]').click()`)
    await clickText('AI 与模型')
    await until(`!!Array.from(document.querySelectorAll('option')).find(option=>option.value==='unknown-model')`, 'background models applied after close')
    await js(`{const select=Array.from(document.querySelectorAll('select')).find(select=>select.value==='test-model');select.value='unknown-model';select.dispatchEvent(new Event('change',{bubbles:true}))}`)
    await clickText('保存 AI 设置')
    await until(`!!window.__lastSaved`, 'model settings saved')
    assert.equal(await js(`window.__lastSaved.input_price`), 0, 'unknown model does not inherit the previous model price')
    console.log('UI smoke passed: import/audio, corrections, merge/undo, practice/review, stale AI, horizontal motion, migration, atomic restore/rollback, deletion and background settings.')
    console.log(`Isolated test profile: ${profile}`)
  } finally {
    window.destroy()
    server.close()
  }
}
main().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })
