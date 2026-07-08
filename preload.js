/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatgptDesktop', {
  saveMarkdown: markdown => ipcRenderer.invoke('save-markdown-export', markdown)
});
