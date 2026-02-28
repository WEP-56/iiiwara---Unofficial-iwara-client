const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const HISTORY_VERSION = 1;
const WRITE_DEBOUNCE_MS = 2000;
const MAX_ITEMS = 5000;
const RETENTION_DAYS = 180;

let historyData = null;
let historyMap = new Map();
let writeTimer = null;
let isDirty = false;
let didInitialCleanup = false;

function getHistoryFilePath() {
  return path.join(app.getPath('userData'), 'data', 'history.json');
}

function ensureDataDir() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('[History] Creating data directory:', dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function loadHistory() {
  if (historyData) return historyData;

  try {
    ensureDataDir();
    const filePath = getHistoryFilePath();
    if (!fs.existsSync(filePath)) {
      console.log('[History] No history file found, creating new');
      historyData = { version: HISTORY_VERSION, items: [] };
      return historyData;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = safeJsonParse(raw);

    if (!data || !Array.isArray(data.items)) {
      console.log('[History] Invalid history data, creating new');
      historyData = { version: HISTORY_VERSION, items: [] };
      return historyData;
    }

    historyData = {
      version: data.version || HISTORY_VERSION,
      items: data.items.filter(item => item && item.id && item.type && item.contentId)
    };

    // Build index
    historyMap.clear();
    for (const item of historyData.items) {
      historyMap.set(item.id, item);
    }

    console.log(`[History] Loaded ${historyData.items.length} items from:`, filePath);
    if (!didInitialCleanup) {
      didInitialCleanup = true;
      try {
        cleanupOldHistory(RETENTION_DAYS);
      } catch {}
      try {
        enforceLimit();
      } catch {}
    }
    return historyData;
  } catch (e) {
    console.error('[History] Load failed:', e);
    historyData = { version: HISTORY_VERSION, items: [] };
    return historyData;
  }
}

function enforceLimit() {
  const data = loadHistory();
  if (!Array.isArray(data.items)) return;
  if (data.items.length <= MAX_ITEMS) return;
  const items = data.items.slice();
  items.sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0));
  data.items = items.slice(0, MAX_ITEMS);
  historyMap.clear();
  for (const item of data.items) {
    historyMap.set(item.id, item);
  }
  scheduleSave();
}

function saveHistoryImmediate() {
  if (!isDirty || !historyData) return;

  try {
    ensureDataDir();
    const filePath = getHistoryFilePath();
    const payload = JSON.stringify(historyData, null, 2);
    fs.writeFileSync(filePath, payload, 'utf8');
    isDirty = false;
    console.log(`[History] Saved ${historyData.items.length} items to:`, filePath);
  } catch (e) {
    console.error('[History] Save failed:', e);
  }
}

function scheduleSave() {
  isDirty = true;
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    saveHistoryImmediate();
    writeTimer = null;
  }, WRITE_DEBOUNCE_MS);
}

function addHistoryItem(item) {
  const data = loadHistory();
  const id = `${item.type}_${item.contentId}`;
  
  const existing = historyMap.get(id);
  const now = Date.now();
  
  if (existing) {
    // Update existing
    existing.visitedAt = now;
    existing.visitCount = (existing.visitCount || 1) + 1;
    existing.title = item.title || existing.title;
    existing.thumbnail = item.thumbnail || existing.thumbnail;
    existing.author = item.author || existing.author;
    existing.authorId = item.authorId || existing.authorId;
    existing.rating = item.rating || existing.rating;
    if (item.duration) existing.duration = item.duration;
    if (item.imageCount) existing.imageCount = item.imageCount;
    if (item.replyCount) existing.replyCount = item.replyCount;
  } else {
    // Add new
    const newItem = {
      id,
      type: item.type,
      contentId: item.contentId,
      title: item.title || '',
      thumbnail: item.thumbnail || '',
      author: item.author || '',
      authorId: item.authorId || '',
      rating: item.rating || 'general',
      visitedAt: now,
      visitCount: 1,
      ...(item.duration && { duration: item.duration }),
      ...(item.imageCount && { imageCount: item.imageCount }),
      ...(item.replyCount && { replyCount: item.replyCount })
    };
    data.items.push(newItem);
    historyMap.set(id, newItem);
  }
  
  scheduleSave();
  enforceLimit();
  return { success: true };
}

function listHistory({ type, limit = 50, offset = 0, search = '' }) {
  const data = loadHistory();
  let items = data.items;
  
  // Filter by type
  if (type && ['video', 'image', 'thread'].includes(type)) {
    items = items.filter(item => item.type === type);
  }
  
  // Filter by search
  if (search && search.trim()) {
    const keyword = search.trim().toLowerCase();
    items = items.filter(item => 
      (item.title && item.title.toLowerCase().includes(keyword)) ||
      (item.author && item.author.toLowerCase().includes(keyword))
    );
  }
  
  // Sort by visitedAt desc
  items.sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0));
  
  const total = items.length;
  const paginated = items.slice(offset, offset + limit);
  
  return { items: paginated, total };
}

function removeHistory(id) {
  const data = loadHistory();
  const index = data.items.findIndex(item => item.id === id);
  
  if (index === -1) {
    return { success: false, message: 'Not found' };
  }
  
  const item = data.items[index];
  data.items.splice(index, 1);
  historyMap.delete(id);
  
  scheduleSave();
  return { success: true };
}

function clearHistory({ type, beforeTimestamp } = {}) {
  const data = loadHistory();
  let removedCount = 0;
  
  if (type && ['video', 'image', 'thread'].includes(type)) {
    // Clear by type
    const toRemove = data.items.filter(item => item.type === type);
    removedCount = toRemove.length;
    data.items = data.items.filter(item => item.type !== type);
  } else if (beforeTimestamp && beforeTimestamp > 0) {
    // Clear before timestamp
    const toRemove = data.items.filter(item => (item.visitedAt || 0) < beforeTimestamp);
    removedCount = toRemove.length;
    data.items = data.items.filter(item => (item.visitedAt || 0) >= beforeTimestamp);
  } else {
    // Clear all
    removedCount = data.items.length;
    data.items = [];
  }
  
  // Rebuild index
  historyMap.clear();
  for (const item of data.items) {
    historyMap.set(item.id, item);
  }
  
  scheduleSave();
  return { success: true, count: removedCount };
}

function getHistoryStats() {
  const data = loadHistory();
  const stats = {
    total: data.items.length,
    byType: { video: 0, image: 0, thread: 0 }
  };
  
  for (const item of data.items) {
    if (stats.byType[item.type] !== undefined) {
      stats.byType[item.type]++;
    }
  }
  
  return stats;
}

function cleanupOldHistory(retentionDays) {
  if (retentionDays <= 0) return { success: true, count: 0 };
  
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return clearHistory({ beforeTimestamp: cutoff });
}

// Ensure save on app quit
app.on('before-quit', () => {
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  saveHistoryImmediate();
});

module.exports = {
  addHistoryItem,
  listHistory,
  removeHistory,
  clearHistory,
  getHistoryStats,
  cleanupOldHistory
};
