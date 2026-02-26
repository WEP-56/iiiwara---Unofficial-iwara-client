iwara 客户端液态玻璃主题实现文档
基于 koirodev/liquid-web · 针对项目实际代码定制
一、完整文件变动清单
main.js                                   ← 修改 createWindow()
src/renderer/index.html                   ← 新增 #app-bg、引入两个新文件
src/renderer/lib/liquid-core.min.js       ← 新建目录，存放 liquid-web 单文件
src/renderer/styles-glass.css             ← 新建，glass 主题专用样式
src/renderer/lib/glass-manager.js         ← 新建，liquid-web 封装 + 主题管理
src/renderer/renderer.js                  ← 新增 applyGlassTheme()、loadSettings 接入
src/renderer/pages/settings.js           ← 外观设置区块新增4个控件 + bindSettingsEvents 追加
二、Step 1 — 准备库文件
bash
# 在项目根目录执行
mkdir -p src/renderer/lib
# 下载 liquid-web 单文件构建版到项目本地
# 地址：https://cdn.jsdelivr.net/npm/liquid-web/liquid-core.min.js
# 保存到：src/renderer/lib/liquid-core.min.js
必须本地存放：项目 CSP 头为 script-src 'self' 'unsafe-inline'，CDN 地址会被拦截。

三、Step 2 — 修改 main.js（开启 Mica）
找到第 498 行的 function createWindow()，修改 BrowserWindow 配置：

js
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    transparent: true,               // ← false → true
    // backgroundColor: "#0d0f14",  // ← 删除此行（transparent:true 时不可设不透明背景色）
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
  // ← 新增：Win11 Mica 降级处理（在 loadFile 之前）
  try {
    mainWindow.setBackgroundMaterial('mica');
  } catch {
    try { mainWindow.setBackgroundMaterial('acrylic'); } catch {}
  }
  // 以下原有代码不变 ↓
  mainWindow.loadFile(path.join(__dirname, "src", "renderer", "index.html"));
  // ...
}
Win10 说明：transparent: true 在 Win10 下窗口变全透明，Layer 2（磨砂背景层）会填补，视觉正常。glass 主题关闭时 #app-bg 隐藏，body 背景色由 CSS 恢复为深色，不受影响。

四、Step 3 — 修改 src/renderer/index.html
html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src * data: blob:; media-src *; connect-src *;">
  <title>iwara</title>
  <link rel="stylesheet" href="styles.css">
  <!-- ① 新增：glass 主题样式（不影响默认主题） -->
  <link rel="stylesheet" href="styles-glass.css">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&family=Saira+Semi+Condensed:wght@500;600;700&display=swap" rel="stylesheet">
  <!-- ② 新增：liquid-web 库（本地，满足 CSP 'self'） -->
  <script src="./lib/liquid-core.min.js"></script>
</head>
<body>
  <!-- ③ 新增：Layer 2 磨砂背景层，置于 .app 之前，默认隐藏 -->
  <div id="app-bg" aria-hidden="true"></div>
  <div class="app">
    <div class="titlebar">
      <!-- 原有内容不变 -->
      <div class="traf"> ... </div>
      <div class="tb-mid">iwara</div>
      <div class="tb-right">
        <div class="tb-pill" id="themeBtn">blue</div>
        <div class="tb-pill" id="updateBtn">更新</div>
      </div>
    </div>
    <!-- body / sidebar / main / statusbar 原有结构全部不变 -->
    ...
  </div>
  <!-- 原有弹窗面板，不改动 HTML，CSS 层统一处理 -->
  <div class="rat-panel" id="ratPanel"> ... </div>
  <div class="upd-panel" id="updPanel"> ... </div>
  <script type="module" src="renderer.js"></script>
  <!-- ④ 新增：glass 管理器（在 renderer.js 之后） -->
  <script src="./lib/glass-manager.js"></script>
</body>
</html>
五、Step 4 — 新建 src/renderer/styles-glass.css
css
/* =================================================================
   styles-glass.css — 液态玻璃主题
   所有规则严格限定在 body[data-glass="on"] 作用域内，
   不影响默认主题，可随时通过移除 data-glass 属性完整回退。
   ================================================================= */
/* ── CSS 变量：glass 主题专属 ── */
body[data-glass="on"] {
  /* 背景磨砂层参数（由 applyGlassTheme 写入 inline style） */
  --glass-bg-opacity: 0.30;
  --glass-bg-blur: 28px;
  /* 各组件透明度 */
  --glass-surface-opacity: 0.08;
  --glass-border-opacity: 0.18;
  /* 高光边框 */
  --glass-highlight: hsla(0, 0%, 100%, 0.12);
  --glass-shadow: 0 8px 32px hsla(0, 0%, 0%, 0.28), 0 1px 0 var(--glass-highlight) inset;
}
/* ── 窗口根节点透明（仅 glass 主题激活时）── */
body[data-glass="on"],
body[data-glass="on"] html {
  background: transparent !important;
}
/* ── Layer 2：磨砂背景覆盖层 ── */
#app-bg {
  display: none;          /* 默认隐藏 */
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* 颜色由 applyGlassTheme() 通过 inline style 写入，跟随 palette */
  backdrop-filter: blur(var(--glass-bg-blur, 28px)) saturate(1.45);
  -webkit-backdrop-filter: blur(var(--glass-bg-blur, 28px)) saturate(1.45);
  transition: background 0.4s ease, opacity 0.4s ease;
}
body[data-glass="on"] #app-bg {
  display: block;
}
/* ── .app 层叠 ── */
body[data-glass="on"] .app {
  position: relative;
  z-index: 1;
  background: transparent !important;
}
/* ── 非 glass 模式时恢复背景色 ── */
body:not([data-glass="on"]) {
  background: var(--bg-1, #0d1117);
}
/* ── 标题栏 & 顶栏 ── */
body[data-glass="on"] .titlebar,
body[data-glass="on"] .topbar {
  background: hsla(0, 0%, 100%, 0.04) !important;
  border-bottom-color: hsla(0, 0%, 100%, 0.07) !important;
}
/* ── 侧边栏 ── */
body[data-glass="on"] .sidebar {
  /* 背景比主区域稍深，由 CSS 变量控制 */
  background: hsla(0, 0%, 0%, 0.18) !important;
  border-right-color: hsla(0, 0%, 100%, 0.06) !important;
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
}
/* ── 卡片（.card / .vcard / .icard）── */
body[data-glass="on"] .card,
body[data-glass="on"] .vcard,
body[data-glass="on"] .icard {
  background: hsla(0, 0%, 100%, var(--glass-surface-opacity, 0.08)) !important;
  border-color: hsla(0, 0%, 100%, var(--glass-border-opacity, 0.18)) !important;
  box-shadow: var(--glass-shadow) !important;
  /* liquid-web 会在此元素上注入 SVG filter，backdrop-filter 配合生效 */
  backdrop-filter: blur(10px) saturate(1.25);
  -webkit-backdrop-filter: blur(10px) saturate(1.25);
}
body[data-glass="on"] .card:hover,
body[data-glass="on"] .vcard:hover,
body[data-glass="on"] .icard:hover {
  background: hsla(0, 0%, 100%, 0.13) !important;
  border-color: hsla(0, 0%, 100%, 0.26) !important;
}
/* ── 顶部搜索框 ── */
body[data-glass="on"] .search-box {
  background: hsla(0, 0%, 100%, 0.06) !important;
  border-color: hsla(0, 0%, 100%, 0.14) !important;
}
body[data-glass="on"] .search-box:focus-within {
  background: hsla(0, 0%, 100%, 0.10) !important;
  border-color: var(--ac-bd) !important;
}
/* ── 图标按钮 .ico-btn ── */
body[data-glass="on"] .ico-btn {
  background: hsla(0, 0%, 100%, 0.05) !important;
  border-color: hsla(0, 0%, 100%, 0.14) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
body[data-glass="on"] .ico-btn:hover {
  background: hsla(0, 0%, 100%, 0.12) !important;
  border-color: hsla(0, 0%, 100%, 0.24) !important;
}
/* ── 弹窗面板（评级、更新、外链确认）── */
body[data-glass="on"] .rat-panel,
body[data-glass="on"] .upd-panel,
body[data-glass="on"] .ext-confirm-card {
  background: hsla(0, 0%, 6%, 0.78) !important;
  border: 1px solid hsla(0, 0%, 100%, 0.13) !important;
  backdrop-filter: blur(32px) saturate(1.5);
  -webkit-backdrop-filter: blur(32px) saturate(1.5);
  box-shadow: 0 24px 80px hsla(0, 0%, 0%, 0.45) !important;
}
/* ── 状态栏 ── */
body[data-glass="on"] .statusbar {
  background: hsla(0, 0%, 0%, 0.20) !important;
  border-top-color: hsla(0, 0%, 100%, 0.05) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
/* ── watch-right 侧面板 ── */
body[data-glass="on"] .watch-right {
  background: hsla(0, 0%, 4%, 0.60) !important;
  backdrop-filter: blur(24px) saturate(1.35);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
}
/* ── 返回顶部按钮 ── */
body[data-glass="on"] .back-to-top,
body[data-glass="on"] .sb-tog {
  background: hsla(0, 0%, 100%, 0.07) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
/* ── 论坛楼层卡片 ── */
body[data-glass="on"] .floor-card {
  background: hsla(0, 0%, 100%, 0.04) !important;
  border-color: hsla(0, 0%, 100%, 0.09) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
body[data-glass="on"] .floor:hover .floor-card {
  background: hsla(0, 0%, 100%, 0.08) !important;
  border-color: hsla(0, 0%, 100%, 0.15) !important;
}
/* ── 文字可读性保障 ── */
body[data-glass="on"] .card-title,
body[data-glass="on"] .vtitle,
body[data-glass="on"] .ititle,
body[data-glass="on"] .sh-t {
  text-shadow: 0 1px 6px hsla(0, 0%, 0%, 0.55);
}
/* ── liquid-web 注入的 SVG 容器不干扰布局 ── */
body[data-glass="on"] [data-liquid-svg] {
  position: absolute !important;
  pointer-events: none !important;
  overflow: visible !important;
}
六、Step 5 — 新建 src/renderer/lib/glass-manager.js
这是核心文件，封装 liquid-web 的初始化、更新、销毁，以及 glass 主题的整体开关逻辑。

liquid-web 完整 API 参考
构造函数：new LiquidWeb(selector, options)
  selector  — CSS 选择器字符串 或 HTMLElement
options：
  el          (string|HTMLElement)  目标元素（构造时传 selector 可省略）
  init        (boolean, 默认 true)  是否立即初始化
  scale       (number,  默认 22)    折射位移强度，越大扭曲越明显（建议 10~40）
  blur        (number,  默认 2)     backdrop 模糊半径，单位 px（建议 1~6）
  saturation  (number,  默认 170)   色彩饱和度百分比（建议 130~200）
  aberration  (number,  默认 50)    色差强度（建议 0~100，0 为关闭）
  mode        ('standard'|'polar'|'prominent'|'shader', 默认 'standard')
              四种效果模式：
              · standard  — 标准均匀折射
              · polar     — 极坐标折射，中心向外扩散
              · prominent — 更强边缘高光，视觉层次感强
              · shader    — 最接近苹果原生，效果最强但计算稍多
  on / events (object)  生命周期事件监听器对象（见下方事件表）
  onAny       (function) 任意事件统一回调
实例方法：
  instance.init()              手动初始化（init:false 时使用）
  instance.update(options)     热更新参数，无需重建（实时生效）
  instance.destroy()           销毁效果，清理 SVG/DOM
静态方法：
  LiquidWeb.__instances__              获取所有活跃实例数组
  LiquidWeb.init(element)              对指定元素初始化
  LiquidWeb.getInstance(selector)      获取已有实例
事件列表（on: {} 内使用）：
  beforeInit / init / afterInit
  beforeDestroy / destroy / afterDestroy
  beforeUpdate / update / afterUpdate
  beforeUpdateAll / updateAll / afterUpdateAll
  mouseEnter / mouseLeave / mouseMove
  mouseDown / mouseUp / click
glass-manager.js 完整代码
js
/**
 * glass-manager.js
 * liquid-web 封装 + iwara 客户端 glass 主题管理
 *
 * 依赖：
 *   - liquid-core.min.js（须先于此文件加载）
 *   - styles-glass.css（已在 index.html 引入）
 *
 * 暴露全局：
 *   window.GlassManager  — 主题管理器单例
 */
;(function () {
  'use strict'
  // ── 各组件预设参数（对应项目实际元素）──────────────────────────
  const PRESETS = {
    // 视频/图片卡片：轻度折射，突出缩略图
    card: {
      scale: 14,
      blur: 2,
      saturation: 155,
      aberration: 20,
      mode: 'standard',
    },
    // 侧边栏：大面积，折射要克制
    sidebar: {
      scale: 8,
      blur: 1.5,
      saturation: 140,
      aberration: 10,
      mode: 'standard',
    },
    // 图标按钮 / tb-pill：小元素，折射明显一些
    button: {
      scale: 22,
      blur: 2.5,
      saturation: 165,
      aberration: 35,
      mode: 'prominent',
    },
    // 弹窗面板：居中大块，用 polar 模式视觉更有深度
    modal: {
      scale: 18,
      blur: 3,
      saturation: 160,
      aberration: 25,
      mode: 'polar',
    },
    // 胶囊标签（.watch-tab / .subnav-item）
    pill: {
      scale: 20,
      blur: 2,
      saturation: 160,
      aberration: 30,
      mode: 'prominent',
    },
    // 标题栏整体：几乎不折射，只要磨砂感
    titlebar: {
      scale: 6,
      blur: 1,
      saturation: 130,
      aberration: 0,
      mode: 'standard',
    },
  }
  // ── 各 palette 对应的磁砂背景颜色 ───────────────────────────────
  const PALETTE_BG = {
    blue:   'hsla(220, 22%, 6%, ',
    purple: 'hsla(265, 22%, 6%, ',
    green:  'hsla(158, 22%, 5%, ',
    pink:   'hsla(335, 22%, 6%, ',
    custom: 'hsla(220, 12%, 6%, ',   // 自定义色，用中性色调
  }
  // ── GlassManager ────────────────────────────────────────────────
  const GlassManager = {
    /** 是否已激活 */
    active: false,
    /** 所有已挂载的 LiquidWeb 实例，key = 元素 ID 或索引 */
    _instances: new Map(),
    /** 当前配置（从 localStorage 读取或用户修改） */
    _config: {
      scale:      14,    // 全局折射强度（覆盖各预设的 scale）
      blur:       2,     // 全局模糊半径
      saturation: 155,   // 全局饱和度
      aberration: 25,    // 全局色差
      bgOpacity:  0.30,  // 磁砂背景层透明度
      mode:       'standard',
    },
    // ── 激活 glass 主题 ──────────────────────────────────────────
    enable(palette, config) {
      this.active = true
      // 合并用户配置
      if (config) Object.assign(this._config, config)
      // 1. 给 body 加标记，触发 CSS 切换
      document.body.dataset.glass = 'on'
      // 2. 设置磁砂背景层颜色
      this._updateBgLayer(palette || 'blue')
      // 3. 标记常驻 DOM 元素
      this._markStaticElements()
      // 4. 初始化已在 DOM 中的元素
      requestAnimationFrame(() => {
        this._mountAll()
      })
    },
    // ── 关闭 glass 主题 ──────────────────────────────────────────
    disable() {
      this.active = false
      document.body.dataset.glass = 'off'
      // 销毁所有实例
      this._destroyAll()
      // 清除 liquid-web 可能残留的 inline style
      document.querySelectorAll('[data-liquid-mounted]').forEach(el => {
        el.removeAttribute('data-liquid-mounted')
        el.style.removeProperty('backdrop-filter')
        el.style.removeProperty('-webkit-backdrop-filter')
        el.style.removeProperty('filter')
      })
    },
    // ── palette 变更时同步更新背景层颜色 ────────────────────────
    onPaletteChange(newPalette) {
      if (!this.active) return
      this._updateBgLayer(newPalette)
    },
    // ── 动态卡片渲染完成后调用（分页加载时）────────────────────
    mountNewCards(container) {
      if (!this.active) return
      const cards = (container || document).querySelectorAll(
        '.card:not([data-liquid-mounted]), .vcard:not([data-liquid-mounted]), .icard:not([data-liquid-mounted])'
      )
      cards.forEach(el => this._mountElement(el, 'card'))
    },
    // ── 热更新全局参数（设置页滑块实时预览）────────────────────
    updateConfig(partialConfig) {
      Object.assign(this._config, partialConfig)
      if (!this.active) return
      // 更新磁砂背景层透明度
      if (partialConfig.bgOpacity !== undefined) {
        const bg = document.getElementById('app-bg')
        if (bg) {
          const palette = document.body.dataset.glasspalette || 'blue'
          bg.style.background = (PALETTE_BG[palette] || PALETTE_BG.blue) + partialConfig.bgOpacity + ')'
        }
      }
      // 热更新所有 liquid-web 实例
      this._instances.forEach(instance => {
        try {
          instance.update({
            scale:      this._config.scale,
            blur:       this._config.blur,
            saturation: this._config.saturation,
            aberration: this._config.aberration,
            mode:       this._config.mode,
          })
        } catch (e) {}
      })
    },
    // ── 内部：更新 #app-bg 颜色 ─────────────────────────────────
    _updateBgLayer(palette) {
      const bg = document.getElementById('app-bg')
      if (!bg) return
      const base = PALETTE_BG[palette] || PALETTE_BG.blue
      bg.style.background = base + this._config.bgOpacity + ')'
      // 记录当前 palette 供后续使用
      document.body.dataset.glasspalette = palette
    },
    // ── 内部：给常驻 DOM 元素打标记 ─────────────────────────────
    // （动态卡片在 mountNewCards 里处理，这里只处理页面固定结构）
    _markStaticElements() {
      const marks = [
        { sel: '.titlebar',   preset: 'titlebar' },
        { sel: '.sidebar',    preset: 'sidebar'  },
        { sel: '.topbar',     preset: 'titlebar' },
        { sel: '.statusbar',  preset: 'titlebar' },
        { sel: '.rat-panel',  preset: 'modal'    },
        { sel: '.upd-panel',  preset: 'modal'    },
        { sel: '.back-to-top',preset: 'button'   },
        { sel: '.sb-tog',     preset: 'button'   },
      ]
      marks.forEach(({ sel, preset }) => {
        const el = document.querySelector(sel)
        if (el && !el.dataset.glassPreset) {
          el.dataset.glassPreset = preset
        }
      })
    },
    // ── 内部：挂载所有已标记元素 ────────────────────────────────
    _mountAll() {
      // 1. 常驻结构元素
      document.querySelectorAll('[data-glass-preset]:not([data-liquid-mounted])').forEach(el => {
        const preset = el.dataset.glassPreset
        this._mountElement(el, preset)
      })
      // 2. 已在 DOM 中的卡片
      this.mountNewCards(document)
    },
    // ── 内部：挂载单个元素 ──────────────────────────────────────
    _mountElement(el, preset) {
      if (!window.LiquidWeb) return
      if (el.dataset.liquidMounted) return
      const presetOpts = PRESETS[preset] || PRESETS.card
      // 用全局 config 覆盖 scale/blur/saturation/aberration/mode
      const opts = {
        ...presetOpts,
        scale:      this._config.scale      !== 14  ? this._config.scale      : presetOpts.scale,
        blur:       this._config.blur       !== 2   ? this._config.blur       : presetOpts.blur,
        saturation: this._config.saturation !== 155 ? this._config.saturation : presetOpts.saturation,
        aberration: this._config.aberration !== 25  ? this._config.aberration : presetOpts.aberration,
        mode:       this._config.mode       !== 'standard' ? this._config.mode : presetOpts.mode,
      }
      try {
        const instance = new LiquidWeb(el, { ...opts, init: true })
        el.dataset.liquidMounted = '1'
        // 用 UUID 或 DOM 位置做 key
        const key = el.id || (el.className + '_' + this._instances.size)
        this._instances.set(key, instance)
      } catch (e) {
        console.warn('[GlassManager] LiquidWeb mount failed on', el, e)
      }
    },
    // ── 内部：销毁所有实例 ──────────────────────────────────────
    _destroyAll() {
      this._instances.forEach(instance => {
        try { instance.destroy() } catch (e) {}
      })
      this._instances.clear()
    },
  }
  // 暴露全局
  window.GlassManager = GlassManager
})()
七、Step 6 — 修改 src/renderer/renderer.js
6a：在 applyPalette() 之后追加 applyGlassTheme()
js
// ── 液态玻璃主题 ───────────────────────────────────────────────────
/**
 * 激活或关闭 glass 主题
 * @param {boolean} on
 * @param {object}  config  可选，覆盖默认参数
 */
function applyGlassTheme(on, config) {
  if (!window.GlassManager) return
  if (on) {
    // 读取用户保存的配置，合并后传入
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem('iwara_settings') || '{}') } catch {}
    const glassConfig = {
      scale:      Number(saved.glassScale)      || 14,
      blur:       Number(saved.glassBlur)       || 2,
      saturation: Number(saved.glassSaturation) || 155,
      aberration: Number(saved.glassAberration) || 25,
      bgOpacity:  Number(saved.glassBgOpacity)  || 0.30,
      mode:       saved.glassMode               || 'standard',
      ...(config || {}),
    }
    GlassManager.enable(state.palette, glassConfig)
    saveSetting('liquidGlass', true)
  } else {
    GlassManager.disable()
    saveSetting('liquidGlass', false)
  }
}
// 暴露到 window，供 settings.js（非 module）调用
window.applyGlassTheme = applyGlassTheme
window.GlassManagerUpdateConfig = (cfg) => window.GlassManager?.updateConfig(cfg)
6b：在 applyPalette() 内末尾追加一行
js
function applyPalette(paletteKey) {
  // ... 原有代码不变 ...
  saveSetting('palette', p.key)
  // ← 新增：glass 主题激活时同步更新背景层颜色
  if (window.GlassManager?.active) {
    window.GlassManager.onPaletteChange(p.key)
  }
}
6c：在 loadSettings() 末尾追加
js
function loadSettings() {
  // ... 原有加载逻辑不变 ...
  // ← 新增：加载 glass 主题开关
  if (settings.liquidGlass) {
    // 等 DOM 和 GlassManager 都就绪后再激活
    requestAnimationFrame(() => {
      setTimeout(() => applyGlassTheme(true), 100)
    })
  }
}
6d：在每次内容渲染完成后追加卡片挂载
找到 renderPageInitial() 或内容更新后的位置（在内容写入 #content 之后），追加：

js
// 每次页面内容更新后，挂载新渲染的卡片
requestAnimationFrame(() => {
  if (window.GlassManager?.active) {
    window.GlassManager.mountNewCards(document.getElementById('content'))
  }
})
八、Step 7 — 修改 src/renderer/pages/settings.js
7a：在 appearanceHtml 中追加 glass 设置区块
在 const appearanceHtml = \`` 字符串里，紧接 ${createSelectItem(...uiScale...)}` 之后插入：

js
const glassOn = !!saved.liquidGlass
const glassHtml = `
  <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b0)">
    <div class="sh" style="margin-bottom:8px">
      <div class="sh-t" style="font-size:12px">液态玻璃主题</div>
    </div>
    ${createToggleItem('liquidGlass', '启用液态玻璃主题', glassOn)}
    <div id="glassOptions" style="margin-top:4px;${!glassOn ? 'opacity:0.4;pointer-events:none' : ''}">
      ${createSelectItem('glassMode', '折射模式',
        ['standard', 'polar', 'prominent', 'shader'],
        saved.glassMode || 'standard')}
      <div class="fitem" style="margin-bottom:2px">
        <div class="fbody">
          <div class="ftitle">折射强度</div>
          <div class="fsub">位移幅度（10~40，默认 14）</div>
        </div>
        <input type="range" id="glassScale"
          min="4" max="40" step="1"
          value="${saved.glassScale || 14}"
          style="width:100px;accent-color:var(--ac)">
        <span id="glassScaleVal" style="font-size:11px;color:var(--t2);margin-left:6px;min-width:22px;text-align:right">
          ${saved.glassScale || 14}
        </span>
      </div>
      <div class="fitem" style="margin-bottom:2px">
        <div class="fbody">
          <div class="ftitle">模糊半径</div>
          <div class="fsub">背景模糊（1~6px，默认 2）</div>
        </div>
        <input type="range" id="glassBlur"
          min="0.5" max="6" step="0.5"
          value="${saved.glassBlur || 2}"
          style="width:100px;accent-color:var(--ac)">
        <span id="glassBlurVal" style="font-size:11px;color:var(--t2);margin-left:6px;min-width:28px;text-align:right">
          ${saved.glassBlur || 2}px
        </span>
      </div>
      <div class="fitem" style="margin-bottom:2px">
        <div class="fbody">
          <div class="ftitle">饱和度</div>
          <div class="fsub">色彩鲜艳程度（130~200，默认 155）</div>
        </div>
        <input type="range" id="glassSaturation"
          min="100" max="220" step="5"
          value="${saved.glassSaturation || 155}"
          style="width:100px;accent-color:var(--ac)">
        <span id="glassSaturationVal" style="font-size:11px;color:var(--t2);margin-left:6px;min-width:28px;text-align:right">
          ${saved.glassSaturation || 155}
        </span>
      </div>
      <div class="fitem" style="margin-bottom:2px">
        <div class="fbody">
          <div class="ftitle">色差</div>
          <div class="fsub">边缘色彩分离（0~80，0 为关闭）</div>
        </div>
        <input type="range" id="glassAberration"
          min="0" max="80" step="5"
          value="${saved.glassAberration || 25}"
          style="width:100px;accent-color:var(--ac)">
        <span id="glassAberrationVal" style="font-size:11px;color:var(--t2);margin-left:6px;min-width:22px;text-align:right">
          ${saved.glassAberration || 25}
        </span>
      </div>
      <div class="fitem" style="margin-bottom:2px">
        <div class="fbody">
          <div class="ftitle">背景透明度</div>
          <div class="fsub">磨砂层深浅（0.15~0.55，默认 0.30）</div>
        </div>
        <input type="range" id="glassBgOpacity"
          min="0.10" max="0.55" step="0.05"
          value="${saved.glassBgOpacity || 0.30}"
          style="width:100px;accent-color:var(--ac)">
        <span id="glassBgOpacityVal" style="font-size:11px;color:var(--t2);margin-left:6px;min-width:28px;text-align:right">
          ${Math.round((saved.glassBgOpacity || 0.30) * 100)}%
        </span>
      </div>
    </div>
  </div>
`
const appearanceHtml = `
  <div class="sh"><div class="sh-t">外观设置</div></div>
  <div class="fitem" style="margin-bottom:12px">
    <div class="fbody"><div class="ftitle">配色方案</div><div class="fsub">选择应用的主题色</div></div>
    <div class="palette-list">${paletteHtml}<div class="palette-item custom" id="customColorBtn" title="自定义颜色">＋</div></div>
  </div>
  ${createSelectItem('uiScale','界面缩放比例',['100%','125%','150%'],saved.uiScale||'100%')}
  ${createSelectItem('sidebarDefault','侧边栏默认状态',['展开','收起'],saved.sidebarDefault||'展开')}
  ${glassHtml}
`
7b：在 bindSettingsEvents() 末尾追加 glass 控件绑定
js
// ── glass 主题开关 ────────────────────────────────────────────────
const glassToggle = content.querySelector('[data-setting-id="liquidGlass"]')
const glassOptions = content.getElementById?.('glassOptions') || document.getElementById('glassOptions')
if (glassToggle) {
  glassToggle.addEventListener('click', () => {
    const isOn = glassToggle.classList.contains('on')
    // 控制选项区域的可交互性
    if (glassOptions) {
      glassOptions.style.opacity = isOn ? '1' : '0.4'
      glassOptions.style.pointerEvents = isOn ? '' : 'none'
    }
    // 调用主进程的 applyGlassTheme（renderer.js 已挂到 window）
    if (window.applyGlassTheme) window.applyGlassTheme(isOn)
  })
}
// ── glass 折射模式 ────────────────────────────────────────────────
document.getElementById('glassMode')?.addEventListener('change', (e) => {
  _saveAndUpdateGlass('glassMode', e.target.value, { mode: e.target.value })
})
// ── glass 滑块：统一处理 ─────────────────────────────────────────
const sliderDefs = [
  { id: 'glassScale',      valId: 'glassScaleVal',      cfg: 'scale',      fmt: v => v },
  { id: 'glassBlur',       valId: 'glassBlurVal',        cfg: 'blur',       fmt: v => v + 'px' },
  { id: 'glassSaturation', valId: 'glassSaturationVal',  cfg: 'saturation', fmt: v => v },
  { id: 'glassAberration', valId: 'glassAberrationVal',  cfg: 'aberration', fmt: v => v },
  { id: 'glassBgOpacity',  valId: 'glassBgOpacityVal',   cfg: 'bgOpacity',  fmt: v => Math.round(v * 100) + '%' },
]
sliderDefs.forEach(({ id, valId, cfg, fmt }) => {
  const slider = document.getElementById(id)
  const valEl  = document.getElementById(valId)
  if (!slider) return
  slider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value)
    if (valEl) valEl.textContent = fmt(v)
    // 实时预览（热更新，无需重建实例）
    if (window.GlassManagerUpdateConfig) {
      window.GlassManagerUpdateConfig({ [cfg]: v })
    }
  })
  slider.addEventListener('change', (e) => {
    const v = parseFloat(e.target.value)
    _saveAndUpdateGlass(id, v, { [cfg]: v })
  })
})
// ── 辅助函数：保存设置并热更新 ───────────────────────────────────
function _saveAndUpdateGlass(key, value, configPatch) {
  try {
    const saved = JSON.parse(localStorage.getItem('iwara_settings') || '{}')
    saved[key] = value
    localStorage.setItem('iwara_settings', JSON.stringify(saved))
  } catch {}
  if (window.GlassManagerUpdateConfig && configPatch) {
    window.GlassManagerUpdateConfig(configPatch)
  }
}
九、设置项说明表
设置项	localStorage key	类型	默认值	说明
启用液态玻璃	liquidGlass	boolean	false	主开关，控制整个 glass 主题
折射模式	glassMode	string	'standard'	standard=均匀折射 / polar=极坐标扩散 / prominent=强边缘高光 / shader=最接近苹果原生
折射强度	glassScale	number	14	控制位移幅度，值越大扭曲越明显，建议 10~25
模糊半径	glassBlur	number	2	背景模糊 px，越大越雾，建议 1~4
饱和度	glassSaturation	number	155	色彩鲜艳程度，130~180 范围内观感最自然
色差	glassAberration	number	25	边缘 RGB 分离强度，0 完全关闭，高值仅适合大卡片
背景透明度	glassBgOpacity	number	0.30	Layer 2 磁砂层深浅，越低越通透，Win10 建议 0.45+
十、兼容性与降级
系统	Layer 1 Mica	Layer 2 磨砂CSS	Layer 3 liquid-web	整体观感
Win11 22H2+	✅ 系统级模糊透过桌面	✅	✅	最佳
Win11 21H2	✅ Acrylic	✅	✅	次之
Win10	❌ 透明背景	✅	✅	Layer2/3 正常，建议提高 bgOpacity 到 0.45
glass 关闭	—	❌	❌	完全回退到原有深色主题，零残留
liquid-web 基于 SVG feDisplacementMap + backdrop-filter: url(#...)，Electron 30 内置 Chromium 128+ 对此完整支持，无兼容性问题。`