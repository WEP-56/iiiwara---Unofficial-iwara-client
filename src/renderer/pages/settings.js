export async function renderSettingsPage(ctx){
  const { pageContainerHtml, escapeHtml }=ctx
  const content=document.getElementById('content')
  if(!content)return

  // 从 localStorage 加载真实设置
  let saved={}
  try{ saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}') }catch{}

  // ==================== 1. 外观设置 ====================
  const paletteHtml=ctx.PALETTES.map(p=>`
    <div class="palette-item ${ctx.state.palette===p.key?'active':''}" data-palette="${p.key}" style="background:${p.ac}" title="${p.label}"></div>
  `).join('')

  const appearanceHtml=`
    <div class="sh"><div class="sh-t">外观设置</div></div>
    <div class="fitem" style="margin-bottom:12px">
      <div class="fbody"><div class="ftitle">配色方案</div><div class="fsub">选择应用的主题色</div></div>
      <div class="palette-list">${paletteHtml}<div class="palette-item custom" id="customColorBtn" title="自定义颜色">＋</div></div>
    </div>
    ${createSelectItem('uiScale','界面缩放比例',['100%','125%','150%'],saved.uiScale||'100%')}
    ${createSelectItem('sidebarDefault','侧边栏默认状态',['展开','收起'],saved.sidebarDefault||'展开')}
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b0)">
      <div class="sh" style="margin-bottom:8px">
        <div class="sh-t" style="font-size:12px">液态玻璃主题</div>
      </div>
      ${createToggleItem('liquidGlass','启用液态玻璃主题',!!saved.liquidGlass)}
      <div id="glassOptions" style="margin-top:4px;${!saved.liquidGlass?'opacity:0.4;pointer-events:none' : ''}">
        ${createSelectItem('glassMode','折射模式',
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

  // ==================== 2. 内容过滤 ====================
  const contentFilterHtml=`
    <div class="sh"><div class="sh-t">内容过滤</div></div>
    ${createSelectItem('defaultGrade','默认分级过滤',['General','Ecchi','Adult'],saved.defaultGrade||'Adult')}
    ${createSelectItem('defaultSort','默认排序方式',['热门','最新','趋势'],saved.defaultSort||'热门')}
    ${createSelectItem('perPageCount','每页加载数量',['16','32','48'],saved.perPageCount||'32')}
  `

  // ==================== 3. 播放与浏览 ====================
  const playbackHtml=`
    <div class="sh"><div class="sh-t">播放与浏览</div></div>
    ${createSelectItem('videoQuality','视频默认画质',['Source','1080p','720p','480p'],saved.videoQuality||'Source')}
    ${createToggleItem('autoPlayNext','自动播放下一个',saved.autoPlayNext!==false)}
    ${createToggleItem('preload','预加载缩略图',saved.preload!==false)}
    ${createSelectItem('imageViewerZoom','图片查看器默认缩放模式',['适应窗口','原始大小'],saved.imageViewerZoom||'适应窗口')}
  `

  // ==================== 4. 网络设置 ====================
  const networkHtml=`
    <div class="sh"><div class="sh-t">网络设置</div></div>
    ${createSelectItem('proxyMode','代理设置',['自动检测','手动配置','禁用'],saved.proxyMode||'自动检测')}
    <div class="fitem proxy-config" style="margin-bottom:2px;${saved.proxyMode!=='手动配置'?'display:none':''}">
      <div class="fbody">
        <div class="ftitle">代理地址</div>
        <div class="fsub">格式: host:port</div>
      </div>
      <input type="text" id="proxyAddress" value="${saved.proxyAddress||''}" style="background:var(--bg-2);border:1px solid var(--b0);border-radius:4px;padding:4px 8px;font-size:12px;color:var(--t0);width:140px;text-align:right">
    </div>
    ${createSelectItem('requestTimeout','请求超时时间',['10秒','20秒','30秒','60秒'],saved.requestTimeout||'30秒')}
    ${createSelectItem('concurrentLimit','并发请求数限制',['3','5','10','20'],saved.concurrentLimit||'5')}
  `

  // ==================== 5. 隐私与安全 ====================
  const privacyHtml=`
    <div class="sh"><div class="sh-t">隐私与安全</div></div>
    ${createToggleItem('clearHistoryOnExit','退出时清除浏览历史',!!saved.clearHistoryOnExit)}
    ${createToggleItem('rememberLogin','记住登录状态',saved.rememberLogin!==false)}
    ${createToggleItem('antiTrack','阻止追踪脚本',saved.antiTrack!==false)}
    <div class="fitem" id="clearCacheBtn">
      <div class="fbody"><div class="ftitle">清除缓存/Cookie</div><div class="fsub">清除应用缓存和 Cookie 数据</div></div>
      <div class="fright">清除 ›</div>
    </div>
  `

  // ==================== 6. 应用设置 ====================
  const appSettingsHtml=`
    <div class="sh"><div class="sh-t">应用设置</div></div>
    ${createToggleItem('startMinimized','启动时最小化到托盘',!!saved.startMinimized)}
    ${createToggleItem('hwaccel','硬件加速',saved.hwaccel!==false)}
    ${createToggleItem('autoStart','开机自启动',!!saved.autoStart)}
    <div class="fitem" id="downloadPathBtn">
      <div class="fbody"><div class="ftitle">下载保存路径</div><div class="fsub">${saved.downloadPath||'点击选择路径'}</div></div>
      <div class="fright">选择 ›</div>
    </div>
    ${createToggleItem('muteStart','默认静音启动',!!saved.muteStart)}
  `

  // ==================== 7. 实验性功能 ====================
  const experimentalHtml=`
    <div class="sh"><div class="sh-t">实验性功能</div></div>
    <div class="fitem" style="margin-bottom:2px">
      <div class="fbody"><div class="ftitle">启用开发者工具快捷键</div><div class="fsub">Ctrl+Shift+I 打开开发者工具</div></div>
      <div class="toggle ${saved.devToolsShortcut?'on':''}" data-setting-id="devToolsShortcut"></div>
    </div>
  `

  // ==================== 快捷键配置 ====================
  const shortcutHtml=`
    <div class="sh"><div class="sh-t">快捷键</div></div>
    <div class="fitem" id="shortcutConfigBtn">
      <div class="fbody"><div class="ftitle">键盘快捷键自定义</div><div class="fsub">设置播放控制、页面导航等快捷键</div></div>
      <div class="fright">配置 ›</div>
    </div>
  `

  // ==================== 网络测试 ====================
  const networkTestHtml=`
    <div class="sh"><div class="sh-t">网络与调试</div></div>
    <div class="fitem" id="proxyTestBtn">
      <div class="fbody"><div class="ftitle">代理连通性测试</div><div class="fsub">测试与 iwara.tv 的连接速度</div></div>
      <div class="fright">开始 ›</div>
    </div>
  `

  content.innerHTML=pageContainerHtml(`
    <div style="max-width:480px">
      ${appearanceHtml}
      <div style="margin-top:20px">${contentFilterHtml}</div>
      <div style="margin-top:20px">${playbackHtml}</div>
      <div style="margin-top:20px">${networkHtml}</div>
      <div style="margin-top:20px">${privacyHtml}</div>
      <div style="margin-top:20px">${appSettingsHtml}</div>
      <div style="margin-top:20px">${experimentalHtml}</div>
      <div style="margin-top:20px">${shortcutHtml}</div>
      <div style="margin-top:20px">${networkTestHtml}</div>

      <div style="margin-top:20px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--b0);border-radius:var(--r-sm);">
        <div style="font-size:11px;color:var(--t2);line-height:1.7">iwara 本地客户端<br>基于 Electron · 数据来源 iwara.tv</div>
      </div>
    </div>
  `)

  bindSettingsEvents(ctx)
}

// 辅助函数：创建选择型设置项
function createSelectItem(id,label,options,defaultValue){
  const optionsHtml=options.map(opt=>`<option value="${opt}" ${opt===defaultValue?'selected':''}>${opt}</option>`).join('')
  return`
    <div class="fitem" style="margin-bottom:2px">
      <div class="fbody"><div class="ftitle">${label}</div></div>
      <select id="${id}" style="background:var(--bg-2);border:1px solid var(--b0);border-radius:4px;padding:4px 8px;font-size:12px;color:var(--t0);cursor:pointer">${optionsHtml}</select>
    </div>
  `
}

// 辅助函数：创建开关型设置项
function createToggleItem(id,label,isOn){
  return`
    <div class="fitem" style="margin-bottom:2px">
      <div class="fbody"><div class="ftitle">${label}</div></div>
      <div class="toggle ${isOn?'on':''}" data-setting-id="${id}"></div>
    </div>
  `
}

// 默认快捷键配置
const DEFAULT_SHORTCUTS={
  'playPause':'Space',
  'prevVideo':'ArrowLeft',
  'nextVideo':'ArrowRight',
  'volumeUp':'ArrowUp',
  'volumeDown':'ArrowDown',
  'mute':'M',
  'fullscreen':'F',
  'escape':'Escape',
  'search':'Ctrl+KeyK',
  'home':'Ctrl+KeyH',
  'history':'Ctrl+KeyY',
  'settings':'Ctrl+Comma',
  'back':'Alt+ArrowLeft',
  'forward':'Alt+ArrowRight'
}

const SHORTCUT_LABELS={
  'playPause':'播放/暂停',
  'prevVideo':'上一个视频',
  'nextVideo':'下一个视频',
  'volumeUp':'音量增加',
  'volumeDown':'音量减少',
  'mute':'静音切换',
  'fullscreen':'全屏切换',
  'escape':'退出/返回',
  'search':'搜索',
  'home':'首页',
  'history':'历史记录',
  'settings':'设置',
  'back':'后退',
  'forward':'前进'
}

function openShortcutConfig(ctx){
  const saved=JSON.parse(localStorage.getItem('iwara_shortcuts')||'{}')
  const shortcuts={...DEFAULT_SHORTCUTS,...saved}
  
  const itemsHtml=Object.entries(shortcuts).map(([id,key])=>{
    const label=SHORTCUT_LABELS[id]||id
    return`
      <div class="shortcut-item" data-id="${id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-2);border-radius:6px;margin-bottom:6px;cursor:pointer">
        <span style="font-size:13px;color:var(--t0)">${label}</span>
        <span class="shortcut-key" style="font-size:12px;color:var(--t2);background:var(--bg-3);padding:4px 10px;border-radius:4px;font-family:monospace">${formatKeyDisplay(key)}</span>
      </div>
    `
  }).join('')

  const html=`
    <div class="create-page" style="padding:10px 0">
      <div class="create-sub">快捷键配置</div>
      <div style="margin-top:12px;font-size:11px;color:var(--t2);padding:0 4px 8px">点击快捷键项后按下新的组合键进行修改</div>
      <div style="max-height:400px;overflow-y:auto">${itemsHtml}</div>
      <div style="margin-top:15px;display:flex;gap:10px">
        <button class="create-btn" id="resetShortcuts" style="flex:1;background:var(--bg-3)">恢复默认</button>
        <button class="create-btn" id="closeShortcutConfig" style="flex:1">关闭</button>
      </div>
    </div>
  `

  if(ctx.openDetailShell){
    ctx.openDetailShell('快捷键')
    ctx.setDetailTitle('快捷键配置')
    ctx.setDetailBodyHtml(html)
    
    let activeItem=null
    
    // 点击快捷键项进行修改
    document.querySelectorAll('.shortcut-item').forEach(el=>{
      el.addEventListener('click',()=>{
        if(activeItem)activeItem.style.outline=''
        activeItem=el
        el.style.outline='2px solid var(--ac)'
        const keyEl=el.querySelector('.shortcut-key')
        if(keyEl)keyEl.textContent='按下新快捷键...'
        
        const handler=(e)=>{
          e.preventDefault()
          e.stopPropagation()
          
          const parts=[]
          if(e.ctrlKey)parts.push('Ctrl')
          if(e.altKey)parts.push('Alt')
          if(e.shiftKey)parts.push('Shift')
          if(e.metaKey)parts.push('Meta')
          
          // 忽略单独的修饰键
          if(['Control','Alt','Shift','Meta'].includes(e.code))return
          
          parts.push(e.code)
          const newKey=parts.join('+')
          
          const id=el.getAttribute('data-id')
          shortcuts[id]=newKey
          
          if(keyEl)keyEl.textContent=formatKeyDisplay(newKey)
          el.style.outline=''
          activeItem=null
          
          document.removeEventListener('keydown',handler,true)
        }
        
        document.addEventListener('keydown',handler,true)
      })
    })
    
    // 恢复默认
    document.getElementById('resetShortcuts')?.addEventListener('click',()=>{
      localStorage.removeItem('iwara_shortcuts')
      ctx.closeDetail()
      openShortcutConfig(ctx)
    })
    
    // 关闭
    document.getElementById('closeShortcutConfig')?.addEventListener('click',()=>{
      // 保存配置
      const toSave={}
      Object.entries(shortcuts).forEach(([id,key])=>{
        if(key!==DEFAULT_SHORTCUTS[id])toSave[id]=key
      })
      if(Object.keys(toSave).length>0){
        localStorage.setItem('iwara_shortcuts',JSON.stringify(toSave))
      }else{
        localStorage.removeItem('iwara_shortcuts')
      }
      ctx.closeDetail()
    })
  }
}

function formatKeyDisplay(key){
  return key
    .replace('Key','')
    .replace('Arrow','')
    .replace('Digit','')
    .replace('Numpad','Num ')
    .replace('Space','空格')
    .replace('Escape','Esc')
    .replace('Comma',',')
    .replace('Period','.')
    .replace('Slash','/')
    .replace('Backslash','\\')
    .replace('BracketLeft','[')
    .replace('BracketRight',']')
    .replace('Minus','-')
    .replace('Equal','=')
}

function openCustomColorPicker(ctx){
  const { state, applyPalette }=ctx
  const current=state.paletteCustom||'#67b7ff'
  const html=`
    <div class="create-page" style="padding:10px 0">
      <div class="create-sub">自定义主题色</div>
      <div style="margin-top:15px;display:flex;flex-direction:column;gap:15px">
        <div style="display:flex;align-items:center;gap:12px">
          <input type="color" id="customColorInput" value="${current}" style="width:50px;height:50px;border:0;background:transparent;cursor:pointer">
          <div style="flex:1">
            <div style="font-size:13px;color:var(--t0)">选择颜色</div>
            <div style="font-size:11px;color:var(--t2);margin-top:2px">点击左侧色块调整 Hex 颜色</div>
          </div>
        </div>
        <div id="customColorPreview" style="height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.2)">预览预览效果</div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="create-btn" id="customColorCancel" style="flex:1;background:var(--bg-3)">取消</button>
          <button class="create-btn" id="customColorSave" style="flex:1">保存并应用</button>
        </div>
      </div>
    </div>
  `
  if(ctx.openDetailShell){
    ctx.openDetailShell('配色')
    ctx.setDetailTitle('自定义配色')
    ctx.setDetailBodyHtml(html)
    
    const input=document.getElementById('customColorInput')
    const preview=document.getElementById('customColorPreview')
    const updatePreview=(hex)=>{
      if(preview){
        preview.style.background=hex
        preview.textContent=hex.toUpperCase()
      }
    }
    updatePreview(current)
    input?.addEventListener('input',(e)=>updatePreview(e.target.value))
    
    document.getElementById('customColorCancel')?.addEventListener('click',()=>ctx.closeDetail())
    document.getElementById('customColorSave')?.addEventListener('click',()=>{
      const hex=input.value
      // 保存自定义颜色逻辑
      const saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
      saved.paletteCustom=hex
      saved.palette='custom'
      localStorage.setItem('iwara_settings',JSON.stringify(saved))
      state.paletteCustom=hex
      state.palette='custom'
      
      // 将 hex 转换为 RGB
      const r=parseInt(hex.slice(1,3),16)
      const g=parseInt(hex.slice(3,5),16)
      const b=parseInt(hex.slice(5,7),16)
      
      // 构造一个完整的 palette 对象并应用
      const customP={
        key:'custom',
        label:'custom',
        ac:hex,
        dim:`rgba(${r},${g},${b},.11)`,
        bd:`rgba(${r},${g},${b},.26)`,
        glow1:`rgba(${r},${g},${b},.14)`,
        glow2:`rgba(${r},${g},${b},.10)`,
        // 背景色：基于主色调的深色版本
        bg1:`rgb(${Math.floor(r*0.05)},${Math.floor(g*0.05)},${Math.floor(b*0.08)})`,
        bg2:`rgb(${Math.floor(r*0.08)},${Math.floor(g*0.08)},${Math.floor(b*0.12)})`,
        bg3:`rgb(${Math.floor(r*0.12)},${Math.floor(g*0.12)},${Math.floor(b*0.18)})`,
        // 边框色
        b0:`rgba(${r},${g},${b},.08)`,
        b1:`rgba(${r},${g},${b},.15)`,
        // 文字色
        t0:`rgb(${Math.min(255,r+120)},${Math.min(255,g+120)},${Math.min(255,b+120)})`,
        t1:`rgb(${Math.floor(r*0.5)+70},${Math.floor(g*0.5)+70},${Math.floor(b*0.5)+70})`,
        t2:`rgb(${Math.floor(r*0.4)+50},${Math.floor(g*0.4)+50},${Math.floor(b*0.4)+50})`,
        // 渐变
        gradient:`linear-gradient(135deg, rgba(${r},${g},${b},.05) 0%, rgba(${r},${g},${b},.02) 100%)`
      }
      
      const s=document.documentElement.style
      // 原有变量
      s.setProperty('--ac',customP.ac)
      s.setProperty('--ac-dim',customP.dim)
      s.setProperty('--ac-bd',customP.bd)
      s.setProperty('--glow-1',customP.glow1)
      s.setProperty('--glow-2',customP.glow2)
      // 新增变量
      s.setProperty('--bg-1',customP.bg1)
      s.setProperty('--bg-2',customP.bg2)
      s.setProperty('--bg-3',customP.bg3)
      s.setProperty('--b0',customP.b0)
      s.setProperty('--b1',customP.b1)
      s.setProperty('--t0',customP.t0)
      s.setProperty('--t1',customP.t1)
      s.setProperty('--t2',customP.t2)
      s.setProperty('--gradient',customP.gradient)
      const themeBtn=document.getElementById('themeBtn')
      if(themeBtn)themeBtn.textContent='custom'
      ctx.setStatus('配色已更新',false)
      ctx.closeDetail()
      renderSettingsPage(ctx)
    })
  }
}

function bindSettingsEvents(ctx){
  const { setStatus, applyPalette }=ctx
  const content=document.getElementById('content')
  if(!content)return
  
  // 切换开关逻辑
  content.querySelectorAll('.toggle[data-setting-id]').forEach(el=>{
    el.addEventListener('click',()=>{
      const id=el.getAttribute('data-setting-id')
      const isOn=el.classList.toggle('on')
      
      try{
        const saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
        saved[id]=isOn
        localStorage.setItem('iwara_settings',JSON.stringify(saved))
        
        // 某些设置需要立即生效
        if(id==='hwaccel'){
          window.electronAPI?.setHardwareAcceleration?.(isOn)
        }else if(id==='autoStart'){
          window.electronAPI?.setAutoStart?.(isOn)
        }else if(id==='liquidGlass'){
          const glassOptions=document.getElementById('glassOptions')
          if(glassOptions){
            glassOptions.style.opacity=isOn?'1':'0.4'
            glassOptions.style.pointerEvents=isOn?'':'none'
          }
          if(window.applyGlassTheme)window.applyGlassTheme(isOn)
        }else if(id==='devToolsShortcut'){
          window.electronAPI?.setDevToolsShortcut?.(isOn)
        }
      }catch{}
    })
  })

  // glass 折射模式
  document.getElementById('glassMode')?.addEventListener('change', (e) => {
    _saveAndUpdateGlass('glassMode', e.target.value, { mode: e.target.value })
  })

  // glass 滑块：统一处理
  const sliderDefs = [
    { id: 'glassScale',      valId: 'glassScaleVal',      cfg: 'scale',      fmt: v => v },
    { id: 'glassBlur',       valId: 'glassBlurVal',        cfg: 'blur',       fmt: v => v + 'px' },
    { id: 'glassSaturation', valId: 'glassSaturationVal',  cfg: 'saturation', fmt: v => v },
    { id: 'glassAberration', valId: 'glassAberrationVal', cfg: 'aberration', fmt: v => v },
    { id: 'glassBgOpacity',  valId: 'glassBgOpacityVal',  cfg: 'bgOpacity',  fmt: v => Math.round(v * 100) + '%' },
  ]
  sliderDefs.forEach(({ id, valId, cfg, fmt }) => {
    const slider = document.getElementById(id)
    const valEl  = document.getElementById(valId)
    if (!slider) return
    slider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value)
      if (valEl) valEl.textContent = fmt(v)
      if (window.GlassManagerUpdateConfig) {
        window.GlassManagerUpdateConfig({ [cfg]: v })
      }
    })
    slider.addEventListener('change', (e) => {
      const v = parseFloat(e.target.value)
      _saveAndUpdateGlass(id, v, { [cfg]: v })
    })
  })

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

  // 选择型设置项逻辑
  const selectIds=['uiScale','sidebarDefault','defaultGrade','defaultSort','perPageCount','videoQuality','imageViewerZoom','proxyMode','requestTimeout','concurrentLimit']
  selectIds.forEach(id=>{
    const el=document.getElementById(id)
    if(el){
      el.addEventListener('change',(e)=>{
        try{
          const saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
          saved[id]=e.target.value
          localStorage.setItem('iwara_settings',JSON.stringify(saved))
          
          // 某些设置需要立即生效
          if(id==='uiScale'){
            const scale=parseFloat(e.target.value)/100
            window.electronAPI?.setZoomFactor?.(scale)
          }else if(id==='proxyMode'){
            const proxyConfig=document.querySelector('.proxy-config')
            if(proxyConfig)proxyConfig.style.display=e.target.value==='手动配置'?'':'none'
          }
        }catch{}
      })
    }
  })

  // 代理地址输入
  const proxyAddressEl=document.getElementById('proxyAddress')
  if(proxyAddressEl){
    proxyAddressEl.addEventListener('change',(e)=>{
      try{
        const saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
        saved.proxyAddress=e.target.value
        localStorage.setItem('iwara_settings',JSON.stringify(saved))
      }catch{}
    })
  }

  // 配色切换
  content.querySelectorAll('.palette-item[data-palette]').forEach(el=>{
    el.addEventListener('click',()=>{
      const key=el.getAttribute('data-palette')
      applyPalette(key)
      renderSettingsPage(ctx)
    })
  })

  // 自定义配色按钮
  document.getElementById('customColorBtn')?.addEventListener('click',()=>openCustomColorPicker(ctx))

  // 清除缓存按钮
  document.getElementById('clearCacheBtn')?.addEventListener('click',async()=>{
    try{
      await window.electronAPI?.clearCache?.()
      setStatus('缓存已清除',false)
    }catch(e){
      setStatus('清除缓存失败',false)
    }
  })

  // 下载路径选择
  document.getElementById('downloadPathBtn')?.addEventListener('click',async()=>{
    try{
      const path=await window.electronAPI?.selectDownloadPath?.()
      if(path){
        const saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
        saved.downloadPath=path
        localStorage.setItem('iwara_settings',JSON.stringify(saved))
        renderSettingsPage(ctx)
      }
    }catch{}
  })

  // 快捷键配置
  document.getElementById('shortcutConfigBtn')?.addEventListener('click',()=>openShortcutConfig(ctx))

  // 代理测试逻辑
  const testBtn=document.getElementById('proxyTestBtn')
  if(testBtn){
    testBtn.addEventListener('click',async()=>{
      const sub=testBtn.querySelector('.fsub')
      const right=testBtn.querySelector('.fright')
      if(sub)sub.textContent='正在测试连接...'
      if(right)right.textContent='测试中'
      
      const start=Date.now()
      try{
        const res=await fetch('https://www.iwara.tv/api/auth/me',{method:'HEAD',cache:'no-cache'})
        const ms=Date.now()-start
        if(sub)sub.textContent=`连接成功！延迟: ${ms}ms`
        if(right)right.textContent='成功'
      }catch(e){
        if(sub)sub.textContent='连接失败，请检查代理设置'
        if(right)right.textContent='失败'
      }
    })
  }
}

