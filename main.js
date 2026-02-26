const { app, BrowserWindow, ipcMain, session, net: electronNet, dialog } = require("electron");
let autoUpdater = null;
const path = require("path");
const fs = require("fs");
const net = require("net");
const { URL } = require("url");
const history = require("./src/main/history");

let mainWindow;
let iwaraSession;
let apiToken = null;
let globalProxy = null; // 全局代理地址
let webRequestHeadersInstalled = false;

const updateState = {
  supported: false,
  checking: false,
  available: false,
  downloaded: false,
  currentVersion: null,
  newVersion: null,
  progress: null,
  error: null,
};

const API_BASE_URL = "https://apiq.iwara.tv";
const IWARA_BASE_URL = "https://www.iwara.tv";
const IWARA_SITE_HOST = "www.iwara.tv";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.5.737";
let cfGatePromise = null;

function tokensFilePath() {
  return path.join(app.getPath("userData"), "tokens.json");
}

function credentialsFilePath() {
  return path.join(app.getPath("userData"), "credentials.json");
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function base64UrlToUtf8(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const json = safeJsonParse(base64UrlToUtf8(parts[1]));
  return json && typeof json === "object" ? json : null;
}

function tokenType(token) {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.type === "string" ? payload.type : null;
}

function tokenExpireAtMs(token) {
  const payload = decodeJwtPayload(token);
  const exp = payload && typeof payload.exp === "number" ? payload.exp : null;
  if (!exp) return null;
  return exp * 1000;
}

function isTokenExpired(token, thresholdSeconds = 0) {
  const expMs = tokenExpireAtMs(token);
  if (!expMs) return true;
  return Date.now() + thresholdSeconds * 1000 >= expMs;
}

const tokenState = {
  authToken: null,
  accessToken: null,
  refreshing: null,
  authExpireAtMs: null,
  accessExpireAtMs: null,
};

function loadTokensFromDisk() {
  try {
    const p = tokensFilePath();
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, "utf8");
    const data = safeJsonParse(raw);
    if (!data || typeof data !== "object") return;
    if (typeof data.authToken === "string") tokenState.authToken = data.authToken;
    if (typeof data.accessToken === "string") tokenState.accessToken = data.accessToken;
    tokenState.authExpireAtMs = tokenState.authToken ? tokenExpireAtMs(tokenState.authToken) : null;
    tokenState.accessExpireAtMs = tokenState.accessToken ? tokenExpireAtMs(tokenState.accessToken) : null;
    if (tokenState.accessToken && tokenType(tokenState.accessToken) !== "access_token") tokenState.accessToken = null;
    if (tokenState.authToken && tokenType(tokenState.authToken) !== "refresh_token") tokenState.authToken = null;
    // 同步 apiToken 变量
    apiToken = tokenState.accessToken || null;
    console.log("[Token] Loaded from disk, hasAccess:", !!tokenState.accessToken, "hasRefresh:", !!tokenState.authToken);
  } catch (e) {
    console.error("[Token] load failed:", e);
  }
}

function saveTokensToDisk() {
  try {
    const p = tokensFilePath();
    const payload = JSON.stringify(
      { authToken: tokenState.authToken, accessToken: tokenState.accessToken },
      null,
      2,
    );
    fs.writeFileSync(p, payload, "utf8");
    console.log("[Token] Saved to disk, hasAccess:", !!tokenState.accessToken, "hasRefresh:", !!tokenState.authToken, "path:", p);
  } catch (e) {
    console.error("[Token] save failed:", e);
  }
}

function setAuthToken(token) {
  tokenState.authToken = token || null;
  tokenState.authExpireAtMs = tokenState.authToken ? tokenExpireAtMs(tokenState.authToken) : null;
  saveTokensToDisk();
}

function setAccessToken(token) {
  const next = token || null;
  if (next && tokenType(next) !== "access_token") {
    console.warn("[Token] Ignored non-access token in setAccessToken");
    return false;
  }
  tokenState.accessToken = next;
  tokenState.accessExpireAtMs = tokenState.accessToken ? tokenExpireAtMs(tokenState.accessToken) : null;
  apiToken = tokenState.accessToken;
  saveTokensToDisk();
  return true;
}

function clearTokens() {
  tokenState.authToken = null;
  tokenState.accessToken = null;
  tokenState.authExpireAtMs = null;
  tokenState.accessExpireAtMs = null;
  tokenState.refreshing = null;
  apiToken = null;
  saveTokensToDisk();
}

// 简单的加密/解密函数（使用 XOR 加密，防止明文存储）
function encrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

function decrypt(encrypted, key) {
  const text = Buffer.from(encrypted, 'base64').toString();
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function saveCredentials(email, password) {
  try {
    const p = credentialsFilePath();
    const key = 'iwara-electron-client'; // 固定密钥
    const payload = JSON.stringify({
      email: email,
      password: encrypt(password, key),
      savedAt: Date.now()
    }, null, 2);
    fs.writeFileSync(p, payload, "utf8");
    console.log("[Credentials] Saved for email:", email);
    return { success: true };
  } catch (e) {
    console.error("[Credentials] save failed:", e);
    return { success: false, error: String(e) };
  }
}

function loadCredentials() {
  try {
    const p = credentialsFilePath();
    if (!fs.existsSync(p)) return null;

    const raw = fs.readFileSync(p, "utf8");
    const data = safeJsonParse(raw);

    if (!data || !data.email || !data.password) {
      return null;
    }

    const key = 'iwara-electron-client';
    const decryptedPassword = decrypt(data.password, key);

    console.log("[Credentials] Loaded for email:", data.email);
    return { email: data.email, password: decryptedPassword };
  } catch (e) {
    console.error("[Credentials] load failed:", e);
    return null;
  }
}

function clearCredentials() {
  try {
    const p = credentialsFilePath();
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("[Credentials] Cleared");
    }
  } catch (e) {
    console.error("[Credentials] clear failed:", e);
  }
}

// 简单的端口检测函数
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(200);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

// 自动检测代理
async function detectProxy() {
  // 1. 检查环境变量
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    globalProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    console.log(`[Proxy] Detected from env: ${globalProxy}`);
    return globalProxy;
  }

  // 2. 检查常见端口
  const oldProxy = globalProxy;
  if (await checkPort(7890)) {
    globalProxy = 'http://127.0.0.1:7890'; // Clash
  } else if (await checkPort(10809)) {
    globalProxy = 'http://127.0.0.1:10809'; // v2rayN
  } else {
    globalProxy = null;
  }

  // 如果代理发生变化，更新 session
  if (globalProxy !== oldProxy) {
    if (iwaraSession) {
      iwaraSession.setProxy(globalProxy ? { proxyRules: globalProxy } : { mode: 'direct' });
      console.log(`[Proxy] Session proxy updated to: ${globalProxy || 'direct'}`);
    }
  }

  if (globalProxy) {
    console.log(`[Proxy] Auto-detected local proxy: ${globalProxy}`);
  } else {
    console.log(`[Proxy] No proxy detected. Connection might fail in restricted regions.`);
  }
  return globalProxy;
}

function requestJson({ url, method = "GET", headers = {}, body, useAuth = true, skipAuthWait = false }) {
  return new Promise((resolve) => {
    let request;
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    request = electronNet.request({
      method,
      url,
      session: iwaraSession,
      useSessionCookies: true,
    });
    timer = setTimeout(() => {
      try { request.abort(); } catch {}
      finish({ status: 0, json: null, text: "timeout" });
    }, 20000);

    const mergedHeaders = {
      Accept: "application/json, text/plain, */*",
      "x-site": IWARA_SITE_HOST,
      Origin: IWARA_BASE_URL,
      Referer: `${IWARA_BASE_URL}/`,
      "User-Agent": USER_AGENT,
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...headers,
    };

    // 只有当有 body 时才添加 Content-Type
    if (body !== undefined && body !== null) {
      mergedHeaders["Content-Type"] = "application/json";
    }

    if (useAuth && tokenState.accessToken) {
      mergedHeaders.Authorization = `Bearer ${tokenState.accessToken}`;
    }

    Object.entries(mergedHeaders).forEach(([k, v]) => {
      if (v !== undefined && v !== null) request.setHeader(k, String(v));
    });

    let data = "";
    request.on("response", (response) => {
      const responseHeaders = response.headers || {};
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => {
        const json = safeJsonParse(data);
        finish({ status: response.statusCode || 0, json, text: data, headers: responseHeaders });
      });
      response.on("error", (err) => {
        finish({ status: response.statusCode || 0, json: null, text: String(err && err.message ? err.message : err), headers: responseHeaders });
      });
    });
    request.on("error", (err) => {
      finish({ status: 0, json: null, text: String(err && err.message ? err.message : err), headers: {} });
    });
    if (body !== undefined && body !== null) request.write(typeof body === "string" ? body : JSON.stringify(body));
    request.end();
  });
}

function isCloudflareChallenge(res) {
  if (!res) return false;
  const headers = res.headers || {};
  const cfMitigated = headers["cf-mitigated"] || headers["CF-Mitigated"];
  const cfMitigatedValue = Array.isArray(cfMitigated) ? cfMitigated[0] : cfMitigated;
  if (String(cfMitigatedValue || "").toLowerCase() === "challenge") return true;
  const text = String(res.text || "");
  const lower = text.toLowerCase();
  if (text.includes("cf-mitigated")) return true;
  if (lower.includes("<title>just a moment")) return true;
  if (lower.includes("cf_chl_") || lower.includes("cloudflare challenge")) return true;
  return false;
}

async function ensureCloudflareGate() {
  if (cfGatePromise) return cfGatePromise;
  cfGatePromise = (async () => {
    const win = new BrowserWindow({
      width: 980,
      height: 720,
      parent: mainWindow || undefined,
      modal: !!mainWindow,
      show: true,
      webPreferences: {
        partition: "persist:iwara",
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    try {
      win.setMenuBarVisibility(false);
    } catch {}
    try {
      win.webContents.setUserAgent(USER_AGENT);
    } catch {}
    try {
      win.loadURL(IWARA_BASE_URL);
    } catch {}

    const hasCfCookie = async () => {
      try {
        const byUrl = async (u) => {
          try {
            const cookies = await iwaraSession.cookies.get({ url: u });
            return Array.isArray(cookies) ? cookies : [];
          } catch {
            return [];
          }
        };
        const cookies = [
          ...(await byUrl(IWARA_BASE_URL)),
          ...(await byUrl(API_BASE_URL)),
        ];
        const names = cookies.map((c) => String(c && c.name ? c.name : ""));
        return names.includes("cf_clearance") || names.includes("__cf_bm");
      } catch {
        return false;
      }
    };

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (win.isDestroyed()) break;
      if (await hasCfCookie()) break;
      try {
        if (Date.now() + 60_000 > deadline) {
          const u = win.webContents.getURL() || "";
          if (!u.includes("apiq.iwara.tv")) win.loadURL(API_BASE_URL);
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      if (!win.isDestroyed()) win.close();
    } catch {}
  })()
    .catch(() => {})
    .finally(() => {
      cfGatePromise = null;
    });
  return cfGatePromise;
}

async function refreshAccessToken() {
  if (tokenState.refreshing) return tokenState.refreshing;
  if (!tokenState.authToken) {
    return { success: false, isAuthError: true, errorMessage: "No refresh token" };
  }
  if (isTokenExpired(tokenState.authToken)) {
    return { success: false, isAuthError: true, errorMessage: "Refresh token expired" };
  }

  tokenState.refreshing = (async () => {
    try {
      const url = new URL("/user/token", API_BASE_URL).toString();
      const res = await requestJson({
        url,
        method: "POST",
        headers: { Authorization: `Bearer ${tokenState.authToken}` },
        useAuth: false,
      });
      if (res.status === 200 && res.json && typeof res.json.accessToken === "string") {
        const newAccessToken = res.json.accessToken;
        if (tokenType(newAccessToken) === "access_token" && !isTokenExpired(newAccessToken, 5 * 60)) {
          setAccessToken(newAccessToken);
          return { success: true, accessToken: newAccessToken };
        }
        return { success: false, isAuthError: true, errorMessage: "Invalid access token" };
      }
      if (res.status === 401) return { success: false, isAuthError: true, errorMessage: "Refresh token invalid (401)" };
      return { success: false, isAuthError: false, errorMessage: `Refresh failed (${res.status})` };
    } catch (e) {
      return { success: false, isAuthError: false, errorMessage: String(e && e.message ? e.message : e) };
    } finally {
      tokenState.refreshing = null;
    }
  })();

  return tokenState.refreshing;
}

async function apiRequest({ endpoint, method = "GET", body, query, headers, skipAuthWait = false }) {
  const url = new URL(endpoint, API_BASE_URL);
  if (query && typeof query === "object") {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  if (!skipAuthWait && tokenState.authToken && tokenState.refreshing) {
    const result = await tokenState.refreshing;
    if (!result.success && result.isAuthError) {
      clearTokens();
      return { error: true, status: 401, message: "Auth expired" };
    }
  }

  let res = await requestJson({ url: url.toString(), method, body, headers, useAuth: true });
  if (res.status === 403 && isCloudflareChallenge(res)) {
    await ensureCloudflareGate();
    res = await requestJson({ url: url.toString(), method, body, headers, useAuth: true });
  }
  if (res.status === 401 && endpoint !== "/user/token" && tokenState.authToken && !isTokenExpired(tokenState.authToken)) {
    const r = await refreshAccessToken();
    if (r.success) {
      const retry = await requestJson({ url: url.toString(), method, body, headers, useAuth: true });
      if (retry.status >= 200 && retry.status < 300) return retry.json ?? {};
      return { error: true, status: retry.status, message: retry.text };
    }
    if (r.isAuthError) clearTokens();
    return { error: true, status: 401, message: r.errorMessage || "Unauthorized" };
  }
  if (res.status >= 200 && res.status < 300) return res.json ?? {};
  const msg = res && res.json && typeof res.json.message === "string" ? res.json.message : null;
  return { error: true, status: res.status, message: msg || res.text };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    transparent: false,
    backgroundColor: "#0d0f14",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:iwara",
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "renderer", "index.html"));
  try { mainWindow.webContents.setUserAgent(USER_AGENT); } catch {}

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    const lvl = typeof level === "number" ? level : 0;
    const src = sourceId ? String(sourceId) : "";
    const ln = typeof line === "number" ? line : 0;
    const tag = lvl === 2 ? "WARN" : lvl >= 3 ? "ERROR" : "LOG";
    console.log(`[renderer:${tag}] ${message}${src ? ` (${src}:${ln})` : ""}`);
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.log("[renderer] render-process-gone", details);
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.log("[renderer] unresponsive");
  });

  mainWindow.webContents.on("responsive", () => {
    console.log("[renderer] responsive");
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.log("[renderer] did-fail-load", { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  // 开发模式下不自动打开 DevTools
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function initAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    console.log("[update] electron-updater not available", e && e.message ? e.message : e);
    return;
  }

  updateState.supported = true;
  updateState.currentVersion = app.getVersion();
  updateState.error = null;
  updateState.checking = false;
  updateState.available = false;
  updateState.downloaded = false;
  updateState.newVersion = null;
  updateState.progress = null;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    const msg = err && err.message ? err.message : String(err);
    updateState.error = msg;
    updateState.checking = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-state", { ...updateState });
    }
    console.log("[update] error", msg);
  });

  autoUpdater.on("update-available", () => {
    updateState.available = true;
    updateState.checking = false;
    updateState.error = null;
    try {
      const info = autoUpdater.updateInfo;
      updateState.newVersion = info && info.version ? String(info.version) : updateState.newVersion;
    } catch {}
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-state", { ...updateState });
    }
    console.log("[update] update available");
  });

  autoUpdater.on("update-not-available", () => {
    updateState.available = false;
    updateState.downloaded = false;
    updateState.checking = false;
    updateState.error = null;
    updateState.newVersion = null;
    updateState.progress = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-state", { ...updateState });
    }
    console.log("[update] update not available");
  });

  autoUpdater.on("checking-for-update", () => {
    updateState.checking = true;
    updateState.error = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-state", { ...updateState });
    }
    console.log("[update] checking");
  });

  autoUpdater.on("download-progress", (p) => {
    try {
      updateState.progress = {
        percent: p && typeof p.percent === "number" ? p.percent : null,
        transferred: p && typeof p.transferred === "number" ? p.transferred : null,
        total: p && typeof p.total === "number" ? p.total : null,
        bytesPerSecond: p && typeof p.bytesPerSecond === "number" ? p.bytesPerSecond : null,
      };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-state", { ...updateState });
      }
      console.log("[update] download", {
        percent: p && typeof p.percent === "number" ? Math.round(p.percent * 10) / 10 : undefined,
        transferred: p && p.transferred,
        total: p && p.total,
      });
    } catch {}
  });

  autoUpdater.on("update-downloaded", async () => {
    updateState.downloaded = true;
    updateState.checking = false;
    updateState.error = null;
    try {
      const info = autoUpdater.updateInfo;
      updateState.newVersion = info && info.version ? String(info.version) : updateState.newVersion;
    } catch {}
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-state", { ...updateState });
    }
    console.log("[update] downloaded");
  });

  try {
    autoUpdater.checkForUpdates().catch(() => {});
  } catch {}
}

// 初始化 Iwara 会话
function initIwaraSession() {
  iwaraSession = session.fromPartition('persist:iwara');

  if (globalProxy) {
    iwaraSession.setProxy({ proxyRules: globalProxy });
    console.log("Session proxy set to:", globalProxy);
  }

  iwaraSession.setUserAgent(USER_AGENT);

  if (!webRequestHeadersInstalled) {
    webRequestHeadersInstalled = true;
    iwaraSession.webRequest.onBeforeSendHeaders((details, callback) => {
      try {
        const u = new URL(details.url);
        const host = (u.hostname || "").toLowerCase();
        const isIwara =
          host === "www.iwara.tv" ||
          host === "i.iwara.tv" ||
          host === "apiq.iwara.tv" ||
          host.endsWith(".iwara.tv");
        if (!isIwara) {
          return callback({ requestHeaders: details.requestHeaders });
        }
        const headers = { ...(details.requestHeaders || {}) };
        const ref = String(headers.Referer || headers.referer || "");
        if (!ref || ref.startsWith("file:")) {
          headers.Referer = `${IWARA_BASE_URL}/`;
        }
        const origin = String(headers.Origin || headers.origin || "");
        if (!origin || origin.startsWith("file:")) {
          headers.Origin = IWARA_BASE_URL;
        }
        headers["User-Agent"] = USER_AGENT;
        headers["x-site"] = IWARA_SITE_HOST;
        if (!headers["Accept-Language"] && !headers["accept-language"]) {
          headers["Accept-Language"] = "zh-CN,zh;q=0.9,en;q=0.8";
        }
        callback({ requestHeaders: headers });
      } catch {
        callback({ requestHeaders: details.requestHeaders });
      }
    });
  }
}

app.whenReady().then(async () => {
  console.log('[App] userData path:', app.getPath('userData'));

  // 延迟检测代理，给代理软件启动时间
  setTimeout(() => detectProxy().catch(() => {}), 2000);

  initIwaraSession();
  loadTokensFromDisk();
  if (tokenState.accessToken && isTokenExpired(tokenState.accessToken, 5 * 60) && tokenState.authToken && !isTokenExpired(tokenState.authToken)) {
    refreshAccessToken().catch(() => {});
  }
  createWindow();
  initAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 窗口控制
ipcMain.on("window-control", (event, action) => {
  if (!mainWindow) return;
  if (action === "minimize") {
    mainWindow.minimize();
  } else if (action === "maximize") {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  } else if (action === "close") {
    mainWindow.close();
  }
});

ipcMain.handle("app-version", async () => {
  try {
    return { version: app.getVersion(), packaged: app.isPackaged };
  } catch {
    return { version: "0.0.0", packaged: false };
  }
});

ipcMain.handle("update-get-state", async () => {
  try {
    if (!updateState.currentVersion) updateState.currentVersion = app.getVersion();
  } catch {}
  return { ...updateState };
});

ipcMain.handle("update-check", async () => {
  if (!app.isPackaged || !autoUpdater) {
    updateState.supported = false;
    updateState.checking = false;
    updateState.error = "仅打包版本支持自动更新";
    try {
      updateState.currentVersion = app.getVersion();
    } catch {}
    return { ...updateState };
  }
  updateState.supported = true;
  updateState.error = null;
  try {
    updateState.currentVersion = app.getVersion();
  } catch {}
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    updateState.checking = false;
    updateState.error = e && e.message ? e.message : String(e);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-state", { ...updateState });
  }
  return { ...updateState };
});

ipcMain.handle("update-install", async () => {
  if (!app.isPackaged || !autoUpdater) {
    return { ok: false, message: "仅打包版本支持自动更新" };
  }
  if (!updateState.downloaded) {
    return { ok: false, message: "更新尚未下载完成" };
  }
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
});

// 接收前端传来的 Token (从 Webview 中提取)
ipcMain.on("set-api-token", (event, token) => {
  console.log("Token received via IPC:", token ? token.substring(0, 20) + "..." : "null");
  if (!token) {
    setAccessToken(null);
    return;
  }
  if (!setAccessToken(token)) {
    console.warn("[Token] set-api-token rejected invalid token type");
  }
});

// 代理 API 请求 (绕过 CORS 和 Cloudflare)
ipcMain.handle("api-request", async (event, { endpoint, method = 'GET', body, query, headers, skipAuthWait = false }) => {
  return await apiRequest({ endpoint, method, body, query, headers, skipAuthWait });
});

ipcMain.handle("auth-login", async (event, { email, password }) => {
  try {
    const looksForbidden = (x) => {
      const m = String(x && x.message ? x.message : "");
      const t = String(x && x.text ? x.text : "");
      return m.includes("errors.forbidden") || t.includes("errors.forbidden");
    };

    const loginUrl = new URL("/user/login", API_BASE_URL).toString();
    const doLogin = async () => {
      const raw = await requestJson({
        url: loginUrl,
        method: "POST",
        body: { email, password },
        headers: {},
        useAuth: false,
      });
      if (raw.status === 403 && isCloudflareChallenge(raw)) {
        await ensureCloudflareGate();
        const retry = await requestJson({
          url: loginUrl,
          method: "POST",
          body: { email, password },
          headers: {},
          useAuth: false,
        });
        return retry;
      }
      return raw;
    };

    const raw = await doLogin();
    const json = raw && raw.json && typeof raw.json === "object" ? raw.json : null;

    if (raw.status >= 200 && raw.status < 300 && json) {
      const loginToken =
        typeof json.authToken === "string"
          ? json.authToken
          : typeof json.refreshToken === "string"
            ? json.refreshToken
            : typeof json.refresh_token === "string"
              ? json.refresh_token
              : typeof json.token === "string"
                ? json.token
                : null;

      if (loginToken) {
        const t = tokenType(loginToken);
        if (t === "refresh_token") setAuthToken(loginToken);
        if (t === "access_token") setAccessToken(loginToken);
      }

      if (!tokenState.accessToken && tokenState.authToken && !isTokenExpired(tokenState.authToken)) {
        const refreshed = await refreshAccessToken();
        if (!refreshed.success) {
          return { error: true, message: refreshed.errorMessage || "Failed to get access token" };
        }
      }

      if (tokenState.accessToken) {
        // 保存账号密码用于自动登录
        saveCredentials(email, password);
        return { success: true, accessToken: tokenState.accessToken };
      }
    }

    if (raw.status === 403 && looksForbidden(raw)) return { error: true, message: "errors.forbidden" };

    const msg =
      (json && typeof json.message === "string" ? json.message : null) ||
      String(raw && raw.text ? raw.text : "") ||
      `Login failed (${raw && raw.status ? raw.status : 0})`;
    return { error: true, message: msg };
  } catch (e) {
    return { error: true, message: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("auth-logout", async () => {
  clearTokens();
  clearCredentials();
  return { success: true };
});

ipcMain.handle("auth-status", async () => {
  const hasRefresh = !!tokenState.authToken && !isTokenExpired(tokenState.authToken);
  const hasAccess = !!tokenState.accessToken && !isTokenExpired(tokenState.accessToken, 5 * 60);
  return { hasRefresh, hasAccess, isRefreshing: !!tokenState.refreshing };
});

ipcMain.handle("auth-get-saved-credentials", async () => {
  const creds = loadCredentials();
  return creds ? { success: true, email: creds.email } : { success: false };
});

ipcMain.handle("auth-auto-login", async () => {
  const creds = loadCredentials();
  if (!creds) {
    return { success: false, message: "No saved credentials" };
  }

  console.log("[Auth] Auto-login with:", creds.email);

  const loginUrl = new URL("/user/login", API_BASE_URL).toString();
  const doLogin = async () => {
    const raw = await requestJson({
      url: loginUrl,
      method: "POST",
      body: { email: creds.email, password: creds.password },
      headers: {},
      useAuth: false,
    });
    if (raw.status === 403 && isCloudflareChallenge(raw)) {
      await ensureCloudflareGate();
      const retry = await requestJson({
        url: loginUrl,
        method: "POST",
        body: { email: creds.email, password: creds.password },
        headers: {},
        useAuth: false,
      });
      return retry;
    }
    return raw;
  };

  const raw = await doLogin();
  const json = raw && raw.json && typeof raw.json === "object" ? raw.json : null;

  if (raw.status >= 200 && raw.status < 300 && json) {
    const loginToken =
      typeof json.authToken === "string"
        ? json.authToken
        : typeof json.refreshToken === "string"
          ? json.refreshToken
          : typeof json.refresh_token === "string"
            ? json.refresh_token
            : typeof json.token === "string"
              ? json.token
              : null;

    if (loginToken) {
      const t = tokenType(loginToken);
      if (t === "refresh_token") setAuthToken(loginToken);
      if (t === "access_token") setAccessToken(loginToken);
    }

    if (!tokenState.accessToken && tokenState.authToken && !isTokenExpired(tokenState.authToken)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed.success) {
        const msg = refreshed.errorMessage || "Failed to get access token";
        console.error("[Auth] Auto-login refresh failed:", msg);
        return { error: true, message: msg };
      }
    }

    if (tokenState.accessToken) {
      console.log("[Auth] Auto-login success");
      return { success: true, accessToken: tokenState.accessToken };
    }
  }

  const msg =
    (json && typeof json.message === "string" ? json.message : null) ||
    String(raw && raw.text ? raw.text : "") ||
    `Auto-login failed (${raw && raw.status ? raw.status : 0})`;
  console.error("[Auth] Auto-login failed:", msg);
  return { error: true, message: msg };
});

// 历史记录 IPC 处理
ipcMain.handle("history-add", async (event, item) => {
  return history.addHistoryItem(item);
});

ipcMain.handle("history-list", async (event, params) => {
  return history.listHistory(params || {});
});

ipcMain.handle("history-remove", async (event, id) => {
  return history.removeHistory(id);
});

ipcMain.handle("history-clear", async (event, params) => {
  return history.clearHistory(params || {});
});

ipcMain.handle("history-stats", async () => {
  return history.getHistoryStats();
});

// 窗口设置
ipcMain.on("set-always-on-top", (event, isOn) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!isOn);
  }
});

ipcMain.on("set-hardware-acceleration", (event, isOn) => {
  // 硬件加速需要在应用启动前设置，这里只保存配置
  try {
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    const data = { hwaccel: !!isOn };
    fs.writeFileSync(settingsPath, JSON.stringify(data), "utf8");
  } catch {}
});

ipcMain.handle("set-auto-start", async (event, isOn) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!isOn });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e && e.message ? e.message : e) };
  }
});

// 清除缓存
ipcMain.handle("clear-cache", async () => {
  try {
    if (iwaraSession) {
      await iwaraSession.clearCache();
      await iwaraSession.clearStorageData({ storages: ["cookies", "localstorage", "indexdb"] });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e && e.message ? e.message : e) };
  }
});

// 选择下载路径
ipcMain.handle("select-download-path", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择下载保存路径",
      properties: ["openDirectory", "createDirectory"],
    });
    if (!result.canceled && result.filePaths && result.filePaths[0]) {
      return result.filePaths[0];
    }
    return null;
  } catch (e) {
    console.error("[select-download-path]", e);
    return null;
  }
});
