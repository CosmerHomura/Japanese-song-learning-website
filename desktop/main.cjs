const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

app.setName('UTA')

const isDevelopment = process.argv.includes('--dev')
const backendPort = isDevelopment ? 8000 : 14731
const backendOrigin = `http://127.0.0.1:${backendPort}`
const desktopManagementToken = crypto.randomBytes(32).toString('hex')
const tomoshiReleasesUrl = 'https://github.com/tomoshi-app/tomoshi-dict-data/releases'
let backendProcess = null
let mainWindow = null

function backendCommand() {
  if (isDevelopment) {
    return {
      command: path.join(__dirname, '..', 'server', '.venv', 'Scripts', 'python.exe'),
      args: ['-m', 'uvicorn', 'app:app', '--app-dir', 'server', '--port', String(backendPort)],
      cwd: path.join(__dirname, '..'),
    }
  }

  return {
    command: path.join(process.resourcesPath, 'uta-backend', 'uta-backend.exe'),
    args: ['--host', '127.0.0.1', '--port', String(backendPort)],
    cwd: process.resourcesPath,
  }
}

function startBackend() {
  const launch = backendCommand()
  backendProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: {
      ...process.env,
      UTA_CONFIG_DIR: app.getPath('userData'),
      UTA_DATA_DIR: path.join(app.getPath('userData'), 'data'),
      UTA_DESKTOP_TOKEN: desktopManagementToken,
      ...(isDevelopment ? {} : { UTA_STATIC_DIR: path.join(process.resourcesPath, 'uta-backend', '_internal', 'dist') }),
    },
    stdio: isDevelopment ? 'inherit' : 'ignore',
    windowsHide: true,
  })
  backendProcess.once('error', (error) => {
    dialog.showErrorBox('UTA 启动失败', `本地学习服务无法启动：${error.message}`)
  })
}

async function waitForBackend(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendOrigin}/api/health`)
      const body = await response.json()
      if (response.ok && body.application === 'uta-japanese-song-learning') {
        const settingsResponse = await fetch(`${backendOrigin}/api/ai/settings`, {
          headers: { 'X-UTA-Desktop-Token': desktopManagementToken },
        })
        if (!settingsResponse.ok) throw new Error('本地服务端口已被旧版 UTA 占用。请退出旧版后重新启动。')
        return
      }
    } catch (error) {
      if (error.message.includes('本地服务端口已被旧版')) throw error
      // The bundled Python runtime can take a few seconds to initialize.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`本地学习服务未能在 ${Math.round(timeoutMs / 1000)} 秒内启动。`)
}

async function waitForVite(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:5173')
      if (response.ok) return
    } catch {
      // Vite is started by the parallel npm script.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Vite 开发服务器启动超时。')
}

async function createWindow() {
  await waitForBackend()
  if (isDevelopment) await waitForVite()

  mainWindow = new BrowserWindow({
    title: 'UTA · 新版验收 2026.09.27 · 分类设置与后台模型刷新',
    width: 1360,
    height: 900,
    icon: path.join(__dirname, 'assets', 'uta.ico'),
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#f5f2eb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = isDevelopment ? 'http://127.0.0.1:5173' : backendOrigin
    try {
      if (new URL(url).origin === allowedOrigin) return
    } catch {
      // Reject malformed navigation targets.
    }
    event.preventDefault()
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
  })

  await mainWindow.loadURL(isDevelopment ? 'http://127.0.0.1:5173' : backendOrigin, { extraHeaders: 'Cache-Control: no-cache\n' })
  mainWindow.setTitle('UTA · 新版验收 2026.09.27 · 分类设置与后台模型刷新')
  mainWindow.on('page-title-updated', (event) => event.preventDefault())
}

function preferencesPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json')
}

function readPreferences() {
  try {
    return JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'))
  } catch {
    return {}
  }
}

function writePreferences(preferences) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(preferencesPath(), `${JSON.stringify(preferences, null, 2)}\n`, 'utf8')
}

async function dictionaryRequest(endpoint, options = {}) {
  const response = await fetch(`${backendOrigin}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-UTA-Desktop-Token': desktopManagementToken,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || '词典操作失败。')
  return body
}

async function monitorDictionaryInstall() {
  while (true) {
    const status = await dictionaryRequest('/api/dictionary/status')
    if (status.phase === 'ready') {
      mainWindow?.setProgressBar(-1)
      mainWindow?.setTitle('UTA｜用日语歌学会日语')
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Tomoshi 词典已安装',
        message: '本地日中词典安装完成',
        detail: '之后的查词会优先使用本机数据库，不会把查词内容发送到词典服务。',
      })
      return true
    }
    if (status.phase === 'error') {
      mainWindow?.setProgressBar(-1)
      mainWindow?.setTitle('UTA｜用日语歌学会日语')
      await showDictionaryFailure(status.error)
      return false
    }
    const fraction = status.total_bytes
      ? Math.max(0, Math.min(status.downloaded_bytes / status.total_bytes, 1))
      : 2
    mainWindow?.setProgressBar(fraction)
    if (status.phase === 'installing') {
      mainWindow?.setTitle('UTA — 正在安装本地词典…')
    } else if (status.total_bytes) {
      mainWindow?.setTitle(`UTA — 正在下载本地词典 ${Math.round(fraction * 100)}%`)
    } else {
      mainWindow?.setTitle('UTA — 正在下载本地词典…')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

async function downloadDictionary() {
  const status = await dictionaryRequest('/api/dictionary/install-download', { method: 'POST' })
  mainWindow?.webContents.send('dictionary-status-changed', status)
  return status
}

async function chooseLocalDictionary() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: '选择兼容的本地词典',
    properties: ['openFile'],
    filters: [{ name: 'Tomoshi Dictionary', extensions: ['zst', 'db', 'sqlite', 'sqlite3'] }],
  })
  if (selection.canceled || !selection.filePaths[0]) return false
  const status = await dictionaryRequest('/api/dictionary/install-local', {
    method: 'POST',
    body: JSON.stringify({ path: selection.filePaths[0] }),
  })
  mainWindow?.webContents.send('dictionary-status-changed', status)
  return status
}

async function showDictionaryFailure(errorMessage) {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Tomoshi 词典下载失败',
    message: '自动下载没有完成',
    detail: `${errorMessage || '请检查网络连接。'}\n\n已下载的部分会保留，点击重试可继续下载。也可以在浏览器中下载 tomoshi-dict-open.db.zst，再回到“词典”菜单选择本地文件安装。`,
    buttons: ['重试下载', '打开发布页', '选择本地文件', '稍后处理'],
    defaultId: 0,
    cancelId: 3,
  })
  if (result.response === 0) await downloadDictionary()
  if (result.response === 1) await shell.openExternal(tomoshiReleasesUrl)
  if (result.response === 2) await chooseLocalDictionary()
}

async function maybePromptForDictionary() {
  const status = await dictionaryRequest('/api/dictionary/status')
  const preferences = readPreferences()
  if (status.installed || preferences.dictionaryPrompted) return

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: '安装可选的本地日中词典',
    message: '是否下载并安装 Tomoshi Dictionary Open Data Layer？',
    detail: '它能显著补充中文释义。当前发布包约 86 MB，解压后约 650 MB；数据保存在你的 UTA 用户目录，不会上传。数据包含 CC BY-SA 4.0/3.0 等表级许可，来源与声明见项目 THIRD_PARTY_DATA_NOTICES.md。',
    buttons: ['下载并安装', '选择已下载文件', '暂不安装'],
    defaultId: 0,
    cancelId: 2,
  })
  writePreferences({ ...preferences, dictionaryPrompted: true })
  if (result.response === 0) await downloadDictionary()
  if (result.response === 1) await chooseLocalDictionary()
}

function installApplicationMenu() {
  const template = [
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '词典',
      submenu: [
        { label: '下载并安装最新版', click: () => downloadDictionary().catch((error) => showDictionaryFailure(error.message)) },
        { label: '选择本地 .zst 文件安装', click: () => chooseLocalDictionary().catch((error) => showDictionaryFailure(error.message)) },
        { type: 'separator' },
        { label: '打开 Tomoshi 发布页', click: () => shell.openExternal(tomoshiReleasesUrl) },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'togglefullscreen', label: '切换全屏' },
        ...(isDevelopment ? [{ role: 'toggleDevTools', label: '开发者工具' }] : []),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function installDesktopIpc() {
  ipcMain.handle('uta:dictionary:status', () => dictionaryRequest('/api/dictionary/status'))
  ipcMain.handle('uta:dictionary:download', () => downloadDictionary())
  ipcMain.handle('uta:dictionary:local', () => chooseLocalDictionary())
  ipcMain.handle('uta:dictionary:cancel', async () => {
    const status = await dictionaryRequest('/api/dictionary/cancel', { method: 'POST' })
    mainWindow?.webContents.send('dictionary-status-changed', status)
    return status
  })
  ipcMain.handle('uta:dictionary:releases', () => shell.openExternal(tomoshiReleasesUrl))
  ipcMain.handle('uta:ai:settings', () => dictionaryRequest('/api/ai/settings'))
  ipcMain.handle('uta:ai:models', (_event, settings) => dictionaryRequest('/api/ai/models', {
    method: 'POST',
    body: JSON.stringify(settings),
  }))
  ipcMain.handle('uta:ai:save-settings', (_event, settings) => dictionaryRequest('/api/ai/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }))
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) backendProcess.kill()
  backendProcess = null
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    try {
      startBackend()
      installDesktopIpc()
      await createWindow()
      installApplicationMenu()
      void maybePromptForDictionary().catch((error) => showDictionaryFailure(error.message))
    } catch (error) {
      stopBackend()
      dialog.showErrorBox('UTA 启动失败', error.message)
      app.quit()
    }
  })

  app.on('before-quit', stopBackend)
  app.on('window-all-closed', () => app.quit())
}
