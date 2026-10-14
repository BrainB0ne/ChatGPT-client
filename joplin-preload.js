const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('joplinSettings', {
  get: () => ipcRenderer.invoke('joplin-settings-get'),
  notebooks: config => ipcRenderer.invoke('joplin-settings-notebooks', config),
  save: config => ipcRenderer.invoke('joplin-settings-save', config)
});
