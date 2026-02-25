# 浏览历史系统设计文档

## 1. 概述

为 Iwara Electron Client 设计一个轻量、高效的浏览历史记录系统，记录用户浏览过的**视频、图片、帖子**三类内容。

## 2. 核心需求

### 2.1 功能需求
- 自动记录用户浏览的内容（**视频、图片、帖子**三类）
- **不包含用户主页浏览记录**（避免历史被用户页面占满）
- 支持历史记录查看、搜索、删除
- 支持按**类型分类**展示（视频 / 图片 / 帖子 / 全部）
- 支持按时间分组展示（今天、昨天、本周、更早）
- 支持清空全部历史或按类型清空
- 支持设置历史记录保留时长（7天/30天/90天/永久）
- 支持禁用历史记录功能

### 2.2 入口位置
- **主入口**：侧边栏「我的主页」→ 子标签「历史」
- 与「订阅」「好友」「通知」「会话」等标签同级

### 2.3 性能需求
- 历史记录数据存储在本地，不影响应用启动速度
- 支持大量历史记录（10000+ 条）的高效查询
- 去重机制：同一内容多次访问只保留最新记录

### 2.4 隐私需求
- 历史记录仅存储在本地
- 支持一键清空
- 支持隐私模式（临时禁用历史记录）

## 3. 数据结构设计

### 3.1 历史记录项结构

```javascript
{
  id: string,              // 唯一标识：`${type}_${contentId}`
  type: string,            // 类型：'video' | 'image' | 'thread' （三类，不含'user'）
  contentId: string,       // 内容 ID
  title: string,           // 标题
  thumbnail: string,       // 缩略图 URL
  author: string,          // 作者名称
  authorId: string,        // 作者 ID
  rating: string,          // 分级：'general' | 'ecchi' | 'adult'
  visitedAt: number,       // 访问时间戳（毫秒）
  visitCount: number,      // 访问次数
  // 类型专属字段
  duration: number,        // 视频时长（秒，仅 video 类型）
  imageCount: number       // 图片数量（仅 image 类型）
  replyCount: number       // 回复数量（仅 thread 类型）
}
```

**类型说明**：
| 类型 | 标识 | 专属字段 | 说明 |
|------|------|----------|------|
| 视频 | `video` | `duration` | 浏览过的视频 |
| 图片 | `image` | `imageCount` | 浏览过的图片集 |
| 帖子 | `thread` | `replyCount` | 浏览过的论坛帖子 |
```

### 3.2 存储方案

**方案选择：JSON 文件 + 内存索引**

- **文件路径**：`{userData}/history.json`
- **数据格式**：
  ```json
  {
    "version": 1,
    "items": [
      { "id": "video_abc123", "type": "video", ... },
      { "id": "image_def456", "type": "image", ... }
    ]
  }
  ```

**优点**：
- 简单易实现，无需额外依赖
- 易于备份和迁移
- 支持人工编辑和调试

**性能优化**：
- 启动时加载到内存，构建 Map 索引
- 写入采用防抖策略（5秒内的修改合并为一次写入）
- 定期清理过期记录（根据设置的保留时长）

## 4. API 设计

### 4.1 主进程 API（main.js）

```javascript
// 添加历史记录
ipcMain.handle('history-add', async (event, item) => {
  // 去重：如果已存在，更新 visitedAt 和 visitCount
  // 返回：{ success: true }
})

// 获取历史记录列表
ipcMain.handle('history-list', async (event, { type, limit, offset, search }) => {
  // type: 可选，过滤类型
  // limit: 每页数量
  // offset: 偏移量
  // search: 搜索关键词（标题、作者）
  // 返回：{ items: [...], total: number }
})

// 删除单条历史记录
ipcMain.handle('history-remove', async (event, id) => {
  // 返回：{ success: true }
})

// 清空历史记录
ipcMain.handle('history-clear', async (event, { type, beforeTimestamp }) => {
  // type: 可选，清空指定类型
  // beforeTimestamp: 可选，清空指定时间之前的记录
  // 返回：{ success: true, count: number }
})

// 获取历史统计
ipcMain.handle('history-stats', async () => {
  // 返回：{ total: number, byType: { video: 10, image: 5, ... } }
})
```

### 4.2 渲染进程 API（封装）

```javascript
// src/renderer/core/history.js
export async function addHistory(item) {
  return await window.electronAPI.historyAdd(item)
}

export async function getHistory({ type, limit = 50, offset = 0, search = '' }) {
  return await window.electronAPI.historyList({ type, limit, offset, search })
nexport async function removeHistory(id) {
  return await window.electronAPI.historyRemove(id)
}

export async function clearHistory({ type, beforeTimestamp }) {
  return await window.electronAPI.historyClear({ type, beforeTimestamp })
}

export async function getHistoryStats() {
  return await window.electronAPI.historyStats()
}
```

## 5. UI 设计

### 5.1 历史记录页面

**入口位置**：
- **导航路径**：侧边栏「我的主页」→ 子标签「历史」
- **标签顺序**：订阅 | 好友 | 通知 | 会话 | **历史**

**页面布局**：
```
┌─────────────────────────────────────────────┐
│  历史记录                           [搜索框] │
├─────────────────────────────────────────────┤
│  [ 全部 ] [ 视频 ] [ 图片 ] [ 帖子 ]  [清空] │
├─────────────────────────────────────────────┤
│  📅 今天                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ [视频缩略图] │ │ [图片缩略图] │ │ [帖子预览] │       │
│  │ ▶ 12:34    │ │ 📷 24张    │ │ 💬 128回复 │       │
│  ├─────────┤ ├─────────┤ ├─────────┤       │
│  │ 视频标题   │ │ 图片标题   │ │ 帖子标题   │       │
│  │ 作者 · 2小时前│ │ 作者 · 3小时前│ │ 作者 · 5小时前│       │
│  └─────────┘ └─────────┘ └─────────┘       │
│                                              │
│  📅 昨天                                      │
│  ┌─────────┐ ┌─────────┐                   │
│  │ ...     │ │ ...     │                   │
│  └─────────┘ └─────────┘                   │
│                                              │
│  📅 本周                                      │
│  ...                                         │
└─────────────────────────────────────────────┘
```

**类型标签说明**：
| 标签 | 显示内容 | 标识 |
|------|----------|------|
| 全部 | 视频 + 图片 + 帖子，按时间混合排序 | - |
| 视频 | 仅视频类型，显示时长 | ▶ |
| 图片 | 仅图片类型，显示图片数量 | 📷 |
| 帖子 | 仅帖子类型，显示回复数 | 💬 |

**功能按钮**：
- **搜索框**：实时搜索标题和作者
- **类型标签**：点击切换显示的类型（全部/视频/图片/帖子）
- **清空按钮**：
  - 点击显示下拉菜单：「清空全部」/「清空视频」/「清空图片」/「清空帖子」
  - 需二次确认
- **单项删除**：每个卡片右上角显示删除按钮（悬停显示）

### 5.2 历史记录卡片

三类卡片采用统一布局，仅在元数据标识上有区别：

**视频卡片**（类型标识：▶）：
```
┌─────────────────┐
│   [缩略图]   [×]│  ← 右上角删除按钮（悬停显示）
│   ▶ 12:34       │  ← 时长标识
├─────────────────┤
│ 视频标题         │
│ 作者名 · 2小时前 │  ← 作者 + 相对时间
└─────────────────┘
```

**图片卡片**（类型标识：📷）：
```
┌─────────────────┐
│   [缩略图]   [×]│
│   📷 12 张      │  ← 图片数量标识
├─────────────────┤
│ 图片标题         │
│ 作者名 · 昨天    │
└─────────────────┘
```

**帖子卡片**（类型标识：💬）：
```
┌─────────────────┐
│   [预览]     [×]│  ← 帖子预览或默认图标
│   💬 128 回复   │  ← 回复数量标识
├─────────────────┤
│ 帖子标题         │
│ 作者名 · 3天前   │
└─────────────────┘
```

**卡片交互**：
- 点击卡片：打开对应内容详情页
- 悬停显示：右上角删除按钮
- 分级标识：卡片边框或角标显示分级（General/Ecchi/Adult）

## 6. 集成点

### 6.1 自动记录触发点

**记录范围**：仅记录 **视频、图片、帖子** 三类内容，**不记录用户主页浏览**。

在以下页面/操作中自动添加历史记录：

1. **视频详情页**（`videoDetail.js`）
   - 时机：视频数据加载完成后
   - 位置：`renderVideoDetailPage()` 函数中
   - 记录类型：`type: 'video'`

2. **图片详情页**（`imageDetail.js`）
   - 时机：图片数据加载完成后
   - 位置：`renderImageDetailPage()` 函数中
   - 记录类型：`type: 'image'`

3. **帖子详情页**（`thread.js`）
   - 时机：帖子数据加载完成后
   - 位置：`renderThreadPage()` 函数中
   - 记录类型：`type: 'thread'`

**不记录的场景**：
- ❌ 用户主页浏览（避免历史被用户页面占满）
- ❌ 搜索结果页
- ❌ 列表页快速预览（仅记录进入详情页的内容）

### 6.2 设置项集成

在设置页面（`settings.js`）添加历史记录相关设置：

```javascript
{
  section: '隐私与历史',
  items: [
    { type: 'toggle', key: 'history.enabled', label: '启用浏览历史', default: true },
    { type: 'select', key: 'history.retention', label: '历史保留时长', 
      options: [
        { value: 7, label: '7 天' },
        { value: 30, label: '30 天' },
        { vae: 90, label: '90 天' },
        { value: -1, label: '永久保留' }
      ],
      default: 30
    },
    { type: 'button', key: 'history.clear', label: '清空浏览历史', 
      action: 'clearHistory', confirm: true }
  ]
}
```

## 7. 实现优先级

### Phase 1：核心功能（MVP）
- [ ] 主进程历史记录管理模块
- [ ] 渲染进程 API 封装
- [ ] 自动记录集成（视频、图片）
- [ ] 基础历史记录页面（列表展示）

### Phase 2：增强功能
- [ ] 搜索功能
- [ ] 类型筛选
- [ ] 时间分组展示
- [ ] 单项删除

### Phase 3：高级功能
- [ ] 设置项集成
- [ ] 历史保留时长
- [ ] 统计信息
- [ ] 性能优化（大数据量）

## 8. 注意事项

### 8.1 隐私保护
- 历史记录文件应设置为用户私有权限
- 不记录敏感信息（如搜索关键词中的敏感词）
- 提供明显的清空入口

### 8.2 性能考虑
- 避免频繁写入磁
- 内存索引使用 Map 而非数组查找
- 定期清理过期记录，避免文件过大

### 8.3 兼容性
- 考虑未来数据结构升级（version 字段）
- 处理损坏的历史文件（降级为空历史）

## 9. 测试要点

- [ ] 添加历史记录去重逻辑
- [ ] 大量历史记录（10000+）的性能测试
- [ ] 历史文件损坏的容错处理
- [ ] 跨会话数据持久化
- [ ] 清空操作的原子性