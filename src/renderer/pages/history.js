// 历史记录页面
import { getHistory, removeHistory, clearHistory, formatRelativeTime, groupByTime } from '../core/history.js';

const PAGE_SIZE = 24;

export async function renderHistoryPage(ctx, host) {
  const { state, escapeHtml, escapeAttr, openVideoDetail, openImageDetail } = ctx;
  
  if (!host) return;
  
  // 初始化状态
  state.historyFilter = state.historyFilter || 'all';
  state.historySearch = state.historySearch || '';
  state.historyOffset = 0;
  state.historyItems = [];
  state.historyHasMore = true;
  state.historyLoading = false;
  
  host.innerHTML = historyPageHtml(ctx);
  bindHistoryEvents(ctx, host);
  await loadHistoryData(ctx, host);
}

function historyPageHtml(ctx) {
  const { state, escapeHtml } = ctx;
  const filter = state.historyFilter || 'all';
  const search = escapeHtml(state.historySearch || '');
  
  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'video', label: '视频' },
    { key: 'image', label: '图片' },
    { key: 'thread', label: '帖子' }
  ];
  
  const tabHtml = tabs.map(tab => {
    const active = filter === tab.key ? ' active' : '';
    return `<button class="history-tab${active}" data-filter="${tab.key}">${tab.label}</button>`;
  }).join('');
  
  return `
    <div class="history-page">
      <div class="history-header">
        <div class="history-search">
          <span class="sico">🔍</span>
          <input type="text" id="historySearchInput" placeholder="搜索标题或作者…" value="${search}">
        </div>
        <div class="history-actions">
          <button class="history-clear-btn" id="historyClearBtn">清空</button>
        </div>
      </div>
      <div class="history-tabs">
        ${tabHtml}
      </div>
      <div class="history-content" id="historyContent">
        <div class="detail-loading">加载中…</div>
      </div>
      <div class="history-loadmore" id="historyLoadMore" style="display:none">
        <button class="history-loadmore-btn">加载更多</button>
      </div>
    </div>
  `;
}

function historyCardHtml(item, ctx) {
  const { escapeHtml, escapeAttr } = ctx;
  const { id, type, contentId, title, thumbnail, author, authorId, rating, visitedAt, visitCount } = item;
  
  const timeText = formatRelativeTime(visitedAt);
  const typeIcon = type === 'video' ? '▶' : type === 'image' ? '📷' : '💬';
  const typeLabel = type === 'video' ? '视频' : type === 'image' ? '图片' : '帖子';
  
  let metaText = '';
  if (type === 'video' && item.duration) {
    metaText = formatDuration(item.duration);
  } else if (type === 'image' && item.imageCount) {
    metaText = `${item.imageCount} 张`;
  } else if (type === 'thread' && item.replyCount) {
    metaText = `${item.replyCount} 回复`;
  }
  
  const ratingClass = rating === 'adult' ? ' adult' : rating === 'ecchi' ? ' ecchi' : '';
  const thumbHtml = thumbnail 
    ? `<img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="history-thumb-placeholder">${typeIcon}</div>`;
  
  const dataAttr = type === 'video' ? 'data-video-id' : type === 'image' ? 'data-image-id' : 'data-thread-id';
  
  return `
    <div class="history-card${ratingClass}" ${dataAttr}="${escapeAttr(contentId)}" data-history-id="${escapeAttr(id)}">
      <div class="history-card-thumb">
        ${thumbHtml}
        <div class="history-card-type">${typeIcon}</div>
        ${metaText ? `<div class="history-card-meta">${metaText}</div>` : ''}
        <button class="history-card-delete" data-delete-id="${escapeAttr(id)}" title="删除">×</button>
      </div>
      <div class="history-card-info">
        <div class="history-card-title">${escapeHtml(title || '无标题')}</div>
        <div class="history-card-sub">
          <span class="history-card-author" data-user-id="${escapeAttr(authorId || '')}">${escapeHtml(author || '未知作者')}</span>
          <span class="history-card-time">${timeText}</span>
        </div>
      </div>
    </div>
  `;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function loadHistoryData(ctx, host, append = false) {
  const { state, setStatus } = ctx;
  const content = host.querySelector('#historyContent');
  const loadMore = host.querySelector('#historyLoadMore');
  
  if (state.historyLoading) return;
  state.historyLoading = true;
  
  if (!append) {
    content.innerHTML = '<div class="detail-loading">加载中…</div>';
  }
  
  try {
    const type = state.historyFilter === 'all' ? null : state.historyFilter;
    const result = await getHistory({
      type,
      limit: PAGE_SIZE,
      offset: state.historyOffset,
      search: state.historySearch
    });
    
    const items = result.items || [];
    state.historyHasMore = items.length === PAGE_SIZE;
    
    if (append) {
      state.historyItems.push(...items);
    } else {
      state.historyItems = items;
    }
    
    if (state.historyItems.length === 0) {
      content.innerHTML = '<div class="detail-loading">暂无历史记录</div>';
    } else {
      const cardsHtml = state.historyItems.map(item => historyCardHtml(item, ctx)).join('');
      content.innerHTML = `<div class="history-grid">${cardsHtml}</div>`;
    }
    
    if (loadMore) {
      loadMore.style.display = state.historyHasMore ? 'block' : 'none';
    }
    
    bindCardEvents(ctx, host);
  } catch (e) {
    console.error('[History] Load failed:', e);
    if (!append) {
      content.innerHTML = `<div class="detail-loading">加载失败: ${e.message || '未知错误'}</div>`;
    }
    setStatus('历史记录加载失败', true);
  } finally {
    state.historyLoading = false;
  }
}

function bindHistoryEvents(ctx, host) {
  const { state } = ctx;
  
  // Tab switching
  const tabs = host.querySelectorAll('.history-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const filter = tab.dataset.filter;
      if (filter === state.historyFilter) return;
      
      state.historyFilter = filter;
      state.historyOffset = 0;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      await loadHistoryData(ctx, host);
    });
  });
  
  // Search
  const searchInput = host.querySelector('#historySearchInput');
  if (searchInput) {
    let searchTimer = null;
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        state.historySearch = value;
        state.historyOffset = 0;
        await loadHistoryData(ctx, host);
      }, 300);
    });
  }
  
  // Clear button
  const clearBtn = host.querySelector('#historyClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const filter = state.historyFilter;
      const typeMap = { video: '视频', image: '图片', thread: '帖子' };
      const typeText = filter === 'all' ? '全部' : typeMap[filter] || '';
      
      if (!confirm(`确定要清空${typeText}历史记录吗？此操作不可恢复。`)) {
        return;
      }
      
      try {
        const result = await clearHistory({ type: filter === 'all' ? null : filter });
        if (result.success) {
          state.historyOffset = 0;
          await loadHistoryData(ctx, host);
        }
      } catch (e) {
        console.error('[History] Clear failed:', e);
      }
    });
  }
  
  // Load more
  const loadMoreBtn = host.querySelector('.history-loadmore-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      if (state.historyLoading || !state.historyHasMore) return;
      state.historyOffset += PAGE_SIZE;
      await loadHistoryData(ctx, host, true);
    });
  }
}

function bindCardEvents(ctx, host) {
  const { openVideoDetail, openImageDetail, openUserDetail } = ctx;
  
  // Card click - open detail
  host.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking delete button
      if (e.target.closest('.history-card-delete')) return;
      
      const videoId = card.dataset.videoId;
      const imageId = card.dataset.imageId;
      const threadId = card.dataset.threadId;
      
      if (videoId && openVideoDetail) openVideoDetail(videoId);
      else if (imageId && openImageDetail) openImageDetail(imageId);
      else if (threadId) {
        // Thread detail not implemented yet, show alert
        console.log('[History] Thread detail not implemented:', threadId);
      }
    });
  });
  
  // Delete button
  host.querySelectorAll('.history-card-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      if (!id) return;
      
      if (!confirm('确定要删除这条历史记录吗？')) return;
      
      try {
        const result = await removeHistory(id);
        if (result.success) {
          const card = btn.closest('.history-card');
          if (card) {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 200);
          }
        }
      } catch (e) {
        console.error('[History] Delete failed:', e);
      }
    });
  });
  
  // Author click
  host.querySelectorAll('.history-card-author[data-user-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const userId = el.dataset.userId;
      if (userId && ctx.openUserDetail) {
        ctx.openUserDetail(userId);
      }
    });
  });
}
