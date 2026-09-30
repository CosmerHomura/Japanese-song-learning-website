'use strict'

function errorMessage(error) {
  const message = error?.message || '检查更新失败。'
  return /ERR_UPDATER_NO_PUBLISHED_VERSIONS|Cannot find latest\.yml|404 Not Found/i.test(message)
    ? '目前没有可用的正式发布版本；请稍后重试或查看 GitHub 发布页。'
    : message
}

function createUpdateManager({ app, updater, notify, supported }) {
  let status = {
    phase: supported ? 'idle' : 'unsupported',
    currentVersion: app.getVersion(),
    availableVersion: '',
    progress: 0,
    message: supported ? '' : '请使用 Windows 桌面版检查应用更新。',
  }
  let checkPromise = null
  let downloadPromise = null

  function publish(change) {
    status = { ...status, ...change }
    notify({ ...status })
    return { ...status }
  }

  if (supported) {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.on('checking-for-update', () => publish({ phase: 'checking', message: '' }))
    updater.on('update-available', info => publish({ phase: 'available', availableVersion: info.version, progress: 0, message: '' }))
    updater.on('update-not-available', () => publish({ phase: 'current', availableVersion: '', progress: 0, message: '' }))
    updater.on('download-progress', progress => publish({ phase: 'downloading', progress: Math.max(0, Math.min(100, Math.round(progress.percent || 0))) }))
    updater.on('update-downloaded', info => publish({ phase: 'downloaded', availableVersion: info.version, progress: 100, message: '' }))
    updater.on('error', error => publish({ phase: 'error', message: errorMessage(error) }))
  }

  function getStatus() { return { ...status } }

  function check() {
    if (!supported || ['downloading', 'downloaded'].includes(status.phase)) return Promise.resolve(getStatus())
    if (checkPromise) return checkPromise
    publish({ phase: 'checking', message: '' })
    checkPromise = updater.checkForUpdates()
      .then(() => getStatus())
      .catch(error => publish({ phase: 'error', message: errorMessage(error) }))
      .finally(() => { checkPromise = null })
    return checkPromise
  }

  function download() {
    if (downloadPromise) return downloadPromise
    if (!supported || status.phase !== 'available') return Promise.reject(new Error('当前没有可下载的新版本。'))
    publish({ phase: 'downloading', progress: 0, message: '' })
    downloadPromise = updater.downloadUpdate()
      .then(() => status.phase === 'downloaded' ? getStatus() : publish({ phase: 'downloaded', progress: 100 }))
      .catch(error => publish({ phase: 'error', message: errorMessage(error) }))
      .finally(() => { downloadPromise = null })
    return downloadPromise
  }

  function install() {
    if (!supported || status.phase !== 'downloaded') throw new Error('请先下载新版本。')
    updater.quitAndInstall(false, true)
  }

  return { getStatus, check, download, install }
}

module.exports = { createUpdateManager }
