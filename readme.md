# Iwara Electron Client

Iwara 的非官方桌面客户端（Electron）。以更清晰明了的方式展示 Iwara 平台的大部分内容。

## 功能

- 视频与图片浏览
- 搜索
- 论坛浏览与帖子详情
- 用户主页
- 评论查看与发布
- 登录态与 token 管理
- 自动代理探测

## 快速开始

环境要求：

- Node.js（建议 18+）
- Windows

安装依赖：

```bash
npm install
```

启动：

```bash
npm run start
```

## 项目结构

```
.
├─ main.js                 # Electron 主进程：窗口、网络、认证
├─ preload.js              # 安全桥：window.electronAPI（ipcRenderer）
└─ src/renderer             # 渲染进程：页面与 UI
   ├─ index.html
   ├─ renderer.js          # 入口与路由调度（动态 import pages）
   ├─ api/                 # endpoints + client + adapters
   ├─ core/                # 公共模块（state/nav/renderers/bindings/comments/...）
   ├─ pages/               # 各页面模块
   └─ utils/               # 通用工具
```

## 页面概览

- 列表：Home / Video / Image / Forum
- 搜索：Search
- 个人：Profile / Settings
- 详情：Video Detail / Image Detail / Thread / User

## 网络与登录

- 代理：支持读取 `HTTPS_PROXY/HTTP_PROXY`，也会尝试探测本地常见端口（如 7890、10809）。
- Token：写入 Electron `userData` 目录下的 `tokens.json`。

## 开发说明

- Electron 入口文件在 `main.js`，渲染进程入口在 `src/renderer/renderer.js`。
- 页面放在 `src/renderer/pages/`，公共能力放在 `src/renderer/core/`。

## 免责声明

本项目为非官方客户端，仅用于学习与本地化体验。请遵守目标站点的使用条款与当地法律法规。
