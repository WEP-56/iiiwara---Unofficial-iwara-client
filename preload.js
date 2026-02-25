const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  controlWindow: action => ipcRenderer.send("window-control", action),
  
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
