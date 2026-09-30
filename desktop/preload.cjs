const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('utaDesktop', {
  dictionary: {
    status: () => ipcRenderer.invoke('uta:dictionary:status'),
    download: () => ipcRenderer.invoke('uta:dictionary:download'),
    chooseLocal: () => ipcRenderer.invoke('uta:dictionary:local'),
    cancel: () => ipcRenderer.invoke('uta:dictionary:cancel'),
    openReleases: () => ipcRenderer.invoke('uta:dictionary:releases'),
    onStatusChanged: (listener) => {
      const handler = (_event, status) => listener(status)
      ipcRenderer.on('dictionary-status-changed', handler)
      return () => ipcRenderer.removeListener('dictionary-status-changed', handler)
    },
  },
  ai: {
    settings: () => ipcRenderer.invoke('uta:ai:settings'),
    models: (settings) => ipcRenderer.invoke('uta:ai:models', settings),
    saveSettings: (settings) => ipcRenderer.invoke('uta:ai:save-settings', settings),
    request: (endpoint, payload) => ipcRenderer.invoke('uta:ai:request', endpoint, payload),
  },
  updates: {
    status: () => ipcRenderer.invoke('uta:update:status'),
    check: () => ipcRenderer.invoke('uta:update:check'),
    download: () => ipcRenderer.invoke('uta:update:download'),
    install: () => ipcRenderer.invoke('uta:update:install'),
    onStatusChanged: listener => {
      const handler = (_event, status) => listener(status)
      ipcRenderer.on('uta:update:status-changed', handler)
      return () => ipcRenderer.removeListener('uta:update:status-changed', handler)
    },
  },
})
