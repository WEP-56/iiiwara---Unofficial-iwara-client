// 浏览历史 API 封装
// 对应主进程: src/main/history.js

/**
 * 添加历史记录
 * @param {Object} item - 历史记录项
 * @param {string} item.type - 类型: 'video' | 'image' | 'thread'
 * @param {string} item.contentId - 内容 ID
 * @param {string} item.title - 标题
 * @param {string} item.thumbnail - 缩略图 URL
 * @param {string} item.author - 作者名称
 * @param {string} item.authorId - 作者 ID
 * @param {string} item.rating - 分级: 'general' | 'ecchi' | 'adult'
 * @param {number} [item.duration] - 视频时长(秒,仅video)
 * @param {number} [item.imageCount] - 图片数量(仅image)
 * @param {number} [item.replyCount] - 回复数量(仅thread)
 * @returns {Promise<{success: boolean}>}
 */
export async function addHistory(item) {
  if (!window.electronAPI?.historyAdd) {
    console.warn('[History] API not available');
    return { success: false };
  }
  return await window.electronAPI.historyAdd(item);
}

/**
 * 获取历史记录列表
 * @param {Object} params - 查询参数
 * @param {string} [params.type] - 类型过滤: 'video' | 'image' | 'thread'
 * @param {number} [params.limit=50] - 每页数量
 * @param {number} [params.offset=0] - 偏移量
 * @param {string} [params.search] - 搜索关键词(标题、作者)
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getHistory({ type, limit = 50, offset = 0, search = '' } = {}) {
  if (!window.electronAPI?.historyList) {
    return { items: [], total: 0 };
  }
  return await window.electronAPI.historyList({ type, limit, offset, search });
}

/**
 * 删除单条历史记录
 * @param {string} id - 记录 ID (格式: ${type}_${contentId})
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function removeHistory(id) {
  if (!window.electronAPI?.historyRemove) {
    return { success: false, message: 'API not available' };
  }
  return await window.electronAPI.historyRemove(id);
}

/**
 * 清空历史记录
 * @param {Object} params - 清空参数
 * @param {string} [params.type] - 清空指定类型: 'video' | 'image' | 'thread'
 * @param {number} [params.beforeTimestamp] - 清空指定时间之前的记录
 * @returns {Promise<{success: boolean, count: number}>}
 */
export async function clearHistory({ type, beforeTimestamp } = {}) {
  if (!window.electronAPI?.historyClear) {
    return { success: false, count: 0 };
  }
  return await window.electronAPI.historyClear({ type, beforeTimestamp });
}

/**
 * 获取历史记录统计
 * @returns {Promise<{total: number, byType: {video: number, image: number, thread: number}}>}
 */
export async function getHistoryStats() {
  if (!window.electronAPI?.historyStats) {
    return { total: 0, byType: { video: 0, image: 0, thread: 0 } };
  }
  return await window.electronAPI.historyStats();
}

/**
 * 便捷函数: 添加视频浏览记录
 */
export async function addVideoHistory(video) {
  if (!video?.id) return { success: false };
  return addHistory({
    type: 'video',
    contentId: video.id,
    title: video.title || '',
    thumbnail: video.thumbnail || video.file?.url || '',
    author: video.user?.name || '',
    authorId: video.user?.id || '',
    rating: video.rating || 'general',
    duration: video.file?.duration || 0
  });
}

/**
 * 便捷函数: 添加图片浏览记录
 */
export async function addImageHistory(image) {
  if (!image?.id) return { success: false };
  return addHistory({
    type: 'image',
    contentId: image.id,
    title: image.title || '',
    thumbnail: image.thumbnail || image.files?.[0]?.url || '',
    author: image.user?.name || '',
    authorId: image.user?.id || '',
    rating: image.rating || 'general',
    imageCount: image.numFiles || image.files?.length || 0
  });
}

/**
 * 便捷函数: 添加帖子浏览记录
 */
export async function addThreadHistory(thread) {
  if (!thread?.id) return { success: false };
  return addHistory({
    type: 'thread',
    contentId: thread.id,
    title: thread.title || '',
    thumbnail: thread.thumbnail || '',
    author: thread.user?.name || '',
    authorId: thread.user?.id || '',
    rating: 'general',
    replyCount: thread.numReplies || thread.replies?.length || 0
  });
}

/**
 * 格式化相对时间
 * @param {number} timestamp - 时间戳(毫秒)
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < week) return `${Math.floor(diff / day)}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

/**
 * 按时间分组历史记录
 * @param {Array} items - 历史记录列表
 * @returns {Object} - { today: [], yesterday: [], thisWeek: [], earlier: [] }
 */
export function groupByTime(items) {
  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: []
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - (now.getDay() || 7) * 24 * 60 * 60 * 1000;

  for (const item of items) {
    const ts = item.visitedAt || 0;
    if (ts >= today) {
      groups.today.push(item);
    } else if (ts >= yesterday) {
      groups.yesterday.push(item);
    } else if (ts >= weekStart) {
      groups.thisWeek.push(item);
    } else {
      groups.earlier.push(item);
    }
  }

  return groups;
}
