export async function renderSettingsPage(ctx){
  const { pageContainerHtml, escapeHtml }=ctx
  const content=document.getElementById('content')
  if(!content)return

  // 从 localStorage 加载真实设置
  let saved={}
  try{ saved=JSON.parse(localStorage.getItem('iwara_settings')||'{}') }catch{}

  const rows=[
    {id:'borderless',label:'无边框窗口',on:!!saved.borderless},
    {id:'blur',label:'毛玻璃效果',on:saved.blur!==false}, // 默认为 true
    {id:'topmost',label:'始终置顶',on:!!saved.topmost},
    {id:'hwaccel',label:'硬件加速解码',on:saved.hwaccel!==false},
    {id:'preload',label:'预加载缩略图',on:saved.preload!==false},
    {id:'antiTrack',label:'阻止追踪脚本',on:saved.antiTrack!==false},
    {id:'muteStart',label:'默认静音启动',on:!!saved.muteStart}
  ]

  const rowsHtml=rows.map(r=>`
    <div class="fitem" style="margin-bottom:2px">
      <div class="fbody">
        <div class="ftitle">${escapeHtml(r.label)}</div>
      </div>
      <div class="toggle ${r.on?'on':''}" data-setting-id="${r.id}"></div>
    </div>
  `).join('')

  const paletteHtml=ctx.PALETTES.map(p=>`
    <div class="palette-item ${ctx.state.palette===p.key?'active':''}" data-palette="${p.key}" style="background:${p.ac}" title="${p.label}"></div>
  `).join('')

  content.innerHTML=pageContainerHtml(`
    <div style="max-width:480px">
      <div class="sh"><div class="sh-t">外观设置</div></div>
      <div class="fitem" style="margin-bottom:12px">
        <div class="fbody"><div class="ftitle">配色方案</div><div class="fsub">选择应用的主题色</div></div>
        <div class="palette-list">${paletteHtml}<div class="palette-item custom" id="customColorBtn" title="自定义颜色">＋</div></div>
      </div>
      <div class="flist">${rowsHtml}</div>
      
      <div style="margin-top:20px">
        <div class="sh"><div class="sh-t">快捷键</div></div>
        <div class="fitem">
          <div class="fbody"><div class="ftitle">键盘快捷键自定义</div><div class="fsub">设置播放控制、页面导航等快捷键</div></div>
          <div class="fright">配置 ›</div>
        </div>
      </div>

      <div style="margin-top:20px">
        <div class="sh"><div class="sh-t">网络与调试</div></div>
        <div class="fitem" id="proxyTestBtn">
          <div class="fbody"><div class="ftitle">代理连通性测试</div><div class="fsub">测试与 iwara.tv 的连接速度</div></div>
          <div class="fright">开始 ›</div>
        </div>
      </div>

      <div style="margin-top:20px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--b0);border-radius:var(--r-sm);">
        <div style="font-size:11px;color:var(--t2);line-height:1.7">iwara 本地客户端<br>基于 Electron · 数据来源 iwara.tv</div>
      </div>
    </div>
  `)

  bindSettingsEvents(ctx)
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
  const { openDetailShell, setDetailTitle, setDetailBodyHtml, closeDetail } = navCtx // 需要从外部获取或通过 ctx 传递
  // 暂时先用最简单的方式：修改 ctx 传递 nav 核心
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
      
      // 构造一个临时的 palette 对象并应用
      const customP={
        key:'custom',
        label:'custom',
        ac:hex,
        dim:hex+'1c', 
        bd:hex+'42',  
        glow1:hex+'24',
        glow2:hex+'1a'
      }
      const s=document.documentElement.style
      s.setProperty('--ac',customP.ac)
      s.setProperty('--ac-dim',customP.dim)
      s.setProperty('--ac-bd',customP.bd)
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
        if(id==='topmost'){
          window.electronAPI?.setAlwaysOnTop?.(isOn)
        }
      }catch{}
    })
  })

  // 配色切换
  content.querySelectorAll('.palette-item[data-palette]').forEach(el=>{
    el.addEventListener('click',()=>{
      const key=el.getAttribute('data-palette')
      applyPalette(key)
      renderSettingsPage(ctx) // 刷新 UI 显示 active 状态
    })
  })

  // 自定义配色按钮
  document.getElementById('customColorBtn')?.addEventListener('click',()=>openCustomColorPicker(ctx))

  // 代理测试逻辑 (占位)
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

