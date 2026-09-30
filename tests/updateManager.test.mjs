import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createUpdateManager } = require('../desktop/updateManager.cjs')

test('checks a release, downloads only on request, then installs only after download', async () => {
  const updater = new EventEmitter()
  let checks = 0
  let downloads = 0
  let installs = 0
  updater.checkForUpdates = async () => {
    checks += 1
    updater.emit('update-available', { version: '0.2.0' })
  }
  updater.downloadUpdate = async () => {
    downloads += 1
    updater.emit('download-progress', { percent: 54.8 })
    updater.emit('update-downloaded', { version: '0.2.0' })
  }
  updater.quitAndInstall = (silent, runAfter) => {
    assert.equal(silent, false)
    assert.equal(runAfter, true)
    installs += 1
  }
  const events = []
  const manager = createUpdateManager({ app: { getVersion: () => '0.1.1' }, updater, notify: status => events.push(status), supported: true })
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)
  assert.throws(() => manager.install(), /先下载/)
  await manager.check()
  assert.equal(manager.getStatus().phase, 'available')
  assert.equal(manager.getStatus().availableVersion, '0.2.0')
  assert.equal(downloads, 0)
  await manager.download()
  assert.equal(manager.getStatus().phase, 'downloaded')
  assert.equal(manager.getStatus().progress, 100)
  manager.install()
  assert.equal(installs, 1)
  assert.equal(checks, 1)
  assert.equal(downloads, 1)
  assert.ok(events.some(status => status.phase === 'downloading' && status.progress === 55))
})

test('check errors are visible and development mode never contacts GitHub', async () => {
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => { throw new Error('网络不可用') }
  const manager = createUpdateManager({ app: { getVersion: () => '0.1.1' }, updater, notify: () => {}, supported: true })
  await manager.check()
  assert.equal(manager.getStatus().phase, 'error')
  assert.match(manager.getStatus().message, /网络不可用/)

  updater.checkForUpdates = async () => { throw new Error('404 Not Found') }
  await manager.check()
  assert.match(manager.getStatus().message, /没有可用的正式发布版本/)

  const unsupported = createUpdateManager({ app: { getVersion: () => '0.1.1' }, updater, notify: () => {}, supported: false })
  assert.equal((await unsupported.check()).phase, 'unsupported')
  await assert.rejects(unsupported.download(), /没有可下载/)
})
