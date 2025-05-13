const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),
  setupManager:  () =>  ipcRenderer.invoke('setupManager'),
  runSteam: () => ipcRenderer.invoke('runSteam'),
  closeSteam: () => ipcRenderer.invoke('closeSteam')  
});
