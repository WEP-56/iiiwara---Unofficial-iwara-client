const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  controlWindow: action => ipcRenderer.send("window-control", action),
  
  // 窗口设置
  setAlwaysOnTop: isOn => ipcRenderer.send("set-always-on-top", isOn),
  setHardwareAcceleration: isOn => ipcRenderer.send("set-hardware-acceleration", isOn),
  setAutoStart: isOn => ipcRenderer.invoke("set-auto-start", isOn),
  
  // 界面缩放
  setZoomFactor: factor => {
    try { webFrame.setZoomFactor(factor); } catch {}
  },
  
  // 应用设置
  clearCache: async () => ipcRenderer.invoke("clear-cache"),
  selectDownloadPath: async () => ipcRenderer.invoke("select-download-path"),
  
  // 发送 Token 到主进程
  setApiToken: token => ipcRenderer.send("set-api-token", token),
  
  // 发送 API 请求
  apiRequest: async (params) => {
    return await ipcRenderer.invoke("api-request", params);
  },

  authLogin: async ({ email, password }) => {
    return await ipcRenderer.invoke("auth-login", { email, password });
  },

  authLogout: async () => {
    return await ipcRenderer.invoke("auth-logout");
  },

  authStatus: async () => {
    return await ipcRenderer.invoke("auth-status");
  },

  authGetSavedCredentials: async () => {
    return await ipcRenderer.invoke("auth-get-saved-credentials");
  },

  authAutoLogin: async () => {
    return await ipcRenderer.invoke("auth-auto-login");
  },

  getAppVersion: async () => {
    return await ipcRenderer.invoke("app-version");
  },

  updateCheck: async () => {
    return await ipcRenderer.invoke("update-check");
  },

  updateGetState: async () => {
    return await ipcRenderer.invoke("update-get-state");
  },

  updateInstall: async () => {
    return await ipcRenderer.invoke("update-install");
  },

  onUpdateState: (cb) => {
    const handler = (_evt, payload) => {
      try { cb(payload); } catch {}
    };
    ipcRenderer.on("update-state", handler);
    return () => ipcRenderer.removeListener("update-state", handler);
  },

  // 历史记录 API
  historyAdd: async (item) => {
    return await ipcRenderer.invoke("history-add", item);
  },

  historyList: async (params) => {
    return await ipcRenderer.invoke("history-list", params);
  },

  historyRemove: async (id) => {
    return await ipcRenderer.invoke("history-remove", id);
  },

  historyClear: async (params) => {
    return await ipcRenderer.invoke("history-clear", params);
  },

  historyStats: async () => {
    return await ipcRenderer.invoke("history-stats");
  },
});
