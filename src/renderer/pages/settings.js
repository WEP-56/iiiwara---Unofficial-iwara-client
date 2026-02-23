export async function renderSettingsPage(ctx){
  const { pageContainerHtml }=ctx
  const content=document.getElementById('content')
  if(!content)return
  const rows=[['无边框窗口','on'],['毛玻璃效果','on'],['始终置顶',''],['硬件加速解码','on'],['预加载缩略图','on'],['阻止追踪脚本','on'],['清除缓存','']]
  content.innerHTML=pageContainerHtml(`<div style="max-width:420px">${rows.map(([l,on])=>`<div class="fitem" style="margin-bottom:2px"><div class="fbody"><div class="ftitle">${l}</div></div><div class="toggle ${on}" data-setting="${l}"></div></div>`).join('')}<div style="margin-top:14px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--b0);border-radius:var(--r-sm);"><div style="font-size:11px;color:var(--t2);line-height:1.7">iwara 本地客户端<br>基于 Electron · 数据来源 iwara.tv</div></div></div>`)
}
