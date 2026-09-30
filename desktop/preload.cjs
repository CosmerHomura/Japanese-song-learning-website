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
  },
})
