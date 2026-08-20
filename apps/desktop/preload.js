'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dobbyLocal', {
  connect: (payload) => ipcRenderer.invoke('dobby-local-connect', payload),
  status: () => ipcRenderer.invoke('dobby-local-status'),
  stop: () => ipcRenderer.invoke('dobby-local-stop'),
  openWorkspace: (projectId) => ipcRenderer.invoke('dobby-local-open-workspace', projectId),
});
