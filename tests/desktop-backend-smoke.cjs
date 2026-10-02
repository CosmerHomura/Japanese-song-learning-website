// Run after desktop:make. Only isolated temporary configuration and local HTTP.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')

async function main() {
  const root = path.resolve(__dirname, '..')
  const executable = path.join(root, 'out/win-unpacked/resources/uta-backend/uta-backend.exe')
  assert.ok(fs.existsSync(executable), 'Build the complete desktop package first')
  const profile = fs.mkdtempSync(path.join(root, 'out/backend-smoke-'))
  const socket = net.createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const token = crypto.randomBytes(24).toString('hex')
  const child = spawn(executable, ['--port', String(port)], {
    cwd: root, windowsHide: true,
    env: { ...process.env, UTA_CONFIG_DIR: profile, UTA_DATA_DIR: profile, UTA_DESKTOP_TOKEN: token },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', bytes => { log += bytes })
  child.stderr.on('data', bytes => { log += bytes })
  child.on('error', error => { log += error.message })
  const base = `http://127.0.0.1:${port}`
  async function post(endpoint, body) {
    const response = await fetch(base + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  try {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Frozen backend exited: ${log}`)
      try {
        const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })
        const health = await response.json()
        ready = response.ok && health.status === 'ok'
      } catch { /* Wait for this isolated process, not an existing app. */ }
      if (ready) break
      await delay(200)
    }
    assert.ok(ready, `Backend failed to start: ${log}`)
    const html = await (await fetch(base + '/')).text()
    const script = html.match(/src="([^\"]+\.js)"/)[1]
    const bundled = Buffer.from(await (await fetch(base + script)).arrayBuffer())
    assert.deepEqual(bundled, fs.readFileSync(path.join(root, 'dist', script.replace(/^\//, ''))), 'Embedded UI must match this build')
    const annotations = await post('/api/annotate/batch', { lines: [{ id: 0, text: '四月の風' }] })
    assert.equal(annotations[0].tokens.map(item => item.surface).join(''), '四月の風')
    const segments = await post('/api/annotate/segments', { text: '春の風', line_text: '春の風', segments: ['春の', '風'] })
    assert.deepEqual(segments.tokens.map(item => item.surface), ['春の', '風'])
    const meanings = await post('/api/annotate/meanings', { lines: [{ id: 0, text: '春の風', tokens: segments.tokens }] })
    assert.equal(meanings[0].tokens.map(item => item.surface).join(''), '春の風')
    const unauthorized = await fetch(base + '/api/ai/settings')
    assert.equal(unauthorized.status, 403, 'Management routes require the desktop session token')
    const descriptor = fs.readFileSync(path.join(root, 'out/latest.yml'), 'utf8')
    const version = require('../package.json').version
    const installer = fs.readFileSync(path.join(root, `out/UTA-Setup-${version}.exe`))
    const hash = crypto.createHash('sha512').update(installer).digest('base64')
    assert.ok(descriptor.includes(hash), 'Updater descriptor must match this installer')
    console.log(`Packaged backend passed: frozen services, annotation/segmentation, authorization, current UI and installer SHA512 (v${version}).`)
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve))
      child.kill()
      await stopped
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
