/*
 * Extended ChatGPT Desktop Client Wrapper (ChatGPT-EX)
 * Developer: BrainByteZ
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatgptDesktop', {
  getExportPreferences: () => ipcRenderer.invoke('get-export-preferences'),
  getWindowTitle: () => ipcRenderer.invoke('get-window-title'),
  saveMarkdown: markdown => ipcRenderer.invoke('save-markdown-export', markdown),
  saveHtml: conversation => ipcRenderer.invoke('save-html-export', conversation),
  savePdf: conversation => ipcRenderer.invoke('save-pdf-export', conversation),
  printConversation: conversation => ipcRenderer.invoke('print-conversation', conversation)
});
