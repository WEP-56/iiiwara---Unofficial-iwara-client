import { state, TITLES, SUB } from './core/state.js'
import { ensureDetailOverlay, openDetailShell, closeDetail, setDetailTitle, setDetailBodyHtml, setDetailLeftHtml, setDetailRightHtml } from './core/detailOverlay.js'
import * as comments from './core/comments.js'
import * as imageViewer from './core/imageViewer.js'
import * as nav from './core/nav.js'
import * as renderers from './core/renderers.js'
import * as bindings from './core/bindings.js'
import { apiGet, apiPost, apiDelete } from './api/client.js'
import { endpoints } from './api/endpoints.js'
import { pickForumPosts, pickResults, pickThread, pickUser } from './api/adapters.js'
import { escapeAttr, escapeHtml } from './utils/escape.js'
import { formatDurationSeconds, formatNumber, pad2 } from './utils/format.js'
import { sha1Hex } from './utils/crypto.js'
const playIcon=`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`

function toggleWatchSidebar(btn){
  const right=document.querySelector('.watch-right')
  if(!right)return
  const isCollapsed=right.classList.toggle('collapsed')
  if(btn)btn.textContent=isCollapsed?'‹':'›'
}

window.addEventListener('error',(e)=>{try{console.error('window.error',e?.message||e,e?.filename||'',e?.lineno||0,e?.colno||0,e?.error||'')}catch{}})
window.addEventListener('unhandledrejection',(e)=>{try{console.error('unhandledrejection',e?.reason||e)}catch{}})

function ratingClass(r){if(r==='adult')return'r';if(r==='ecchi')return'e';return'g'}
function ratingLabel(r){if(r==='adult')return'18+';if(r==='ecchi')return'E';return'G'}
const PALETTES=[
  {
    key:'blue',
    label:'blue',
    ac:'#67b7ff',
    dim:'rgba(103,183,255,.11)',
    bd:'rgba(103,183,255,.26)',
    glow1:'rgba(103,183,255,.14)',
    glow2:'rgba(122,92,255,.10)',
    // 新增：背景色调
    bg1:'#0d1117',
    bg2:'#161b22',
    bg3:'#21262d',
    // 新增：边框/分割线
    b0:'rgba(103,183,255,.08)',
    b1:'rgba(103,183,255,.15)',
    // 新增：文字颜色
    t0:'#e6edf3',
    t1:'#8b949e',
    t2:'#6e7681',
    // 新增：渐变背景
    gradient:'linear-gradient(135deg, rgba(103,183,255,.05) 0%, rgba(122,92,255,.03) 100%)'
  },
  {
    key:'purple',
    label:'purple',
    ac:'#b48cff',
    dim:'rgba(180,140,255,.12)',
    bd:'rgba(180,140,255,.28)',
    glow1:'rgba(180,140,255,.14)',
    glow2:'rgba(103,183,255,.08)',
    bg1:'#0f0d14',
    bg2:'#18151f',
    bg3:'#231e2d',
    b0:'rgba(180,140,255,.08)',
    b1:'rgba(180,140,255,.15)',
    t0:'#e8e4f0',
    t1:'#9588a8',
    t2:'#6e6580',
    gradient:'linear-gradient(135deg, rgba(180,140,255,.05) 0%, rgba(103,183,255,.03) 100%)'
  },
  {
    key:'green',
    label:'green',
    ac:'#38d399',
    dim:'rgba(56,211,153,.10)',
    bd:'rgba(56,211,153,.25)',
    glow1:'rgba(56,211,153,.12)',
    glow2:'rgba(56,211,153,.05)',
    bg1:'#0a1210',
    bg2:'#111a17',
    bg3:'#192420',
    b0:'rgba(56,211,153,.08)',
    b1:'rgba(56,211,153,.15)',
    t0:'#e4f0ea',
    t1:'#88a898',
    t2:'#5a7a6a',
    gradient:'linear-gradient(135deg, rgba(56,211,153,.05) 0%, rgba(56,211,153,.02) 100%)'
  },
  {
    key:'pink',
    label:'pink',
    ac:'#ff5ea8',
    dim:'rgba(255,94,168,.10)',
    bd:'rgba(255,94,168,.25)',
    glow1:'rgba(255,94,168,.12)',
    glow2:'rgba(122,92,255,.08)',
    bg1:'#140d10',
    bg2:'#1e1318',
    bg3:'#2a1a22',
    b0:'rgba(255,94,168,.08)',
    b1:'rgba(255,94,168,.15)',
    t0:'#f0e4e8',
    t1:'#a88898',
    t2:'#7a5a6a',
    gradient:'linear-gradient(135deg, rgba(255,94,168,.05) 0%, rgba(122,92,255,.03) 100%)'
  }
]
function applyPalette(paletteKey){
  const p=PALETTES.find((x)=>x.key===paletteKey)||PALETTES[0]
  state.theme='dark'
  state.palette=p.key
  document.documentElement.setAttribute('data-theme','dark')
  const s=document.documentElement.style
  // 原有变量
  s.setProperty('--ac',p.ac)
  s.setProperty('--ac-dim',p.dim)
  s.setProperty('--ac-bd',p.bd)
  s.setProperty('--glow-1',p.glow1)
  s.setProperty('--glow-2',p.glow2)
  // 新增：背景色
  s.setProperty('--bg-1',p.bg1)
  s.setProperty('--bg-2',p.bg2)
  s.setProperty('--bg-3',p.bg3)
  // 新增：边框色
  s.setProperty('--b0',p.b0)
  s.setProperty('--b1',p.b1)
  // 新增：文字色
  s.setProperty('--t0',p.t0)
  s.setProperty('--t1',p.t1)
  s.setProperty('--t2',p.t2)
  // 新增：渐变
  s.setProperty('--gradient',p.gradient)
  
  const btn=document.getElementById('themeBtn')
  if(btn){
    btn.textContent=p.label
    btn.title=`配色：${p.label}`
  }
  saveSetting('palette',p.key)
}

function saveSetting(key,val){
  try{
    const settings=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
    settings[key]=val
    localStorage.setItem('iwara_settings',JSON.stringify(settings))
  }catch{}
}

const EXTERNAL_LINK_CONFIRM_KEY='iwara_skip_external_link_confirm'

function shouldSkipExternalLinkConfirm(){
  try{return localStorage.getItem(EXTERNAL_LINK_CONFIRM_KEY)==='1'}catch{return false}
}

function setSkipExternalLinkConfirm(skip){
  try{
    if(skip)localStorage.setItem(EXTERNAL_LINK_CONFIRM_KEY,'1')
    else localStorage.removeItem(EXTERNAL_LINK_CONFIRM_KEY)
  }catch{}
}

function askExternalLinkConfirm(url){
  return new Promise((resolve)=>{
    const old=document.getElementById('extLinkConfirm')
    if(old)old.remove()
    const host=document.createElement('div')
    host.id='extLinkConfirm'
    host.className='ext-confirm'
    host.innerHTML=`<div class="ext-confirm-card"><div class="ext-confirm-title">打开外部链接？</div><div class="ext-confirm-url">${escapeHtml(url)}</div><label class="ext-confirm-check"><input id="extConfirmSkip" type="checkbox">不再提醒</label><div class="ext-confirm-actions"><button class="upd-btn" id="extConfirmCancel">取消</button><button class="upd-btn pri" id="extConfirmOpen">打开</button></div></div>`
    const done=(ok)=>{
      const skip=host.querySelector('#extConfirmSkip')?.checked
      if(skip)setSkipExternalLinkConfirm(true)
      host.remove()
      resolve(ok)
    }
    host.addEventListener('click',(e)=>{if(e.target===host)done(false)})
    host.querySelector('#extConfirmCancel')?.addEventListener('click',()=>done(false))
    host.querySelector('#extConfirmOpen')?.addEventListener('click',()=>done(true))
    document.body.appendChild(host)
  })
}

async function openExternalLinkByUser(url){
  if(!url||!window.electronAPI?.openExternalUrl)return
  const shouldOpen=shouldSkipExternalLinkConfirm()?true:await askExternalLinkConfirm(url)
  if(!shouldOpen)return
  const r=await window.electronAPI.openExternalUrl(url)
  if(!r?.success){
    setStatus(r?.error||'无法打开链接',true)
  }
}

// 默认快捷键配置
const DEFAULT_SHORTCUTS={
  'playPause':'Space',
  'prevVideo':'ArrowLeft',
  'nextVideo':'ArrowRight',
  'volumeUp':'ArrowUp',
  'volumeDown':'ArrowDown',
  'mute':'KeyM',
  'fullscreen':'KeyF',
  'escape':'Escape',
  'search':'Ctrl+KeyK',
  'home':'Ctrl+KeyH',
  'history':'Ctrl+KeyY',
  'settings':'Ctrl+Comma',
  'back':'Alt+ArrowLeft',
  'forward':'Alt+ArrowRight'
}

function initGlobalShortcuts(){
  const saved=JSON.parse(localStorage.getItem('iwara_shortcuts')||'{}')
  const shortcuts={...DEFAULT_SHORTCUTS,...saved}

  document.addEventListener('keydown',(e)=>{
    // 忽略在输入框中的按键
    const tag=e.target.tagName.toLowerCase()
    if(['input','textarea','select'].includes(tag))return
    if(e.target.isContentEditable)return

    // 构建当前按键组合
    const parts=[]
    if(e.ctrlKey)parts.push('Ctrl')
    if(e.altKey)parts.push('Alt')
    if(e.shiftKey)parts.push('Shift')
    if(e.metaKey)parts.push('Meta')
    parts.push(e.code)
    const currentKey=parts.join('+')

    // 查找匹配的快捷键
    const action=Object.entries(shortcuts).find(([id,key])=>key===currentKey)?.[0]
    if(!action)return

    e.preventDefault()
    e.stopPropagation()

    // 执行对应操作
    executeShortcutAction(action)
  },true)
}

function executeShortcutAction(action){
  switch(action){
    case 'playPause':
      // 播放/暂停视频
      const video=document.querySelector('video')
      if(video){
        if(video.paused)video.play()
        else video.pause()
      }
      break
    case 'prevVideo':
    case 'nextVideo':
      // 上一个/下一个视频
      const navBtn=document.querySelector(action==='prevVideo'?'.video-nav-prev':'.video-nav-next')
      navBtn?.click()
      break
    case 'volumeUp':
    case 'volumeDown':
      // 音量调整
      const v=document.querySelector('video')
      if(v){
        const delta=action==='volumeUp'?0.1:-0.1
        v.volume=Math.max(0,Math.min(1,v.volume+delta))
      }
      break
    case 'mute':
      // 静音切换
      const vid=document.querySelector('video')
      if(vid)vid.muted=!vid.muted
      break
    case 'fullscreen':
      // 全屏切换
      const fsBtn=document.querySelector('.fullscreen-btn')
      fsBtn?.click()
      break
    case 'escape':
      // 退出/返回
      closeDetail()
      break
    case 'search':
      // 打开搜索
      const searchInput=document.getElementById('searchInput')
      searchInput?.focus()
      break
    case 'home':
      // 首页
      state.page='home'
      document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'))
      document.querySelector('.sb-item[data-page="home"]')?.classList.add('active')
      renderPageInitial()
      break
    case 'history':
      // 历史记录
      state.page='history'
      document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'))
      document.querySelector('.sb-item[data-page="history"]')?.classList.add('active')
      renderPageInitial()
      break
    case 'settings':
      // 设置
      state.page='settings'
      document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'))
      document.querySelector('.sb-item[data-page="settings"]')?.classList.add('active')
      renderPageInitial()
      break
    case 'back':
      // 后退
      window.history.back()
      break
    case 'forward':
      // 前进
      window.history.forward()
      break
  }
}

function loadSettings(){
  try{
    const settings=JSON.parse(localStorage.getItem('iwara_settings')||'{}')
    console.log('[Settings] Loaded settings:', Object.keys(settings))

    // 加载配色
    if(settings.palette==='custom'&&settings.paletteCustom){
      state.palette='custom'
      state.paletteCustom=settings.paletteCustom
      const hex=settings.paletteCustom
      const r=parseInt(hex.slice(1,3),16)
      const g=parseInt(hex.slice(3,5),16)
      const b=parseInt(hex.slice(5,7),16)
      const s=document.documentElement.style
      // 原有变量
      s.setProperty('--ac',hex)
      s.setProperty('--ac-dim',`rgba(${r},${g},${b},.11)`)
      s.setProperty('--ac-bd',`rgba(${r},${g},${b},.26)`)
      s.setProperty('--glow-1',`rgba(${r},${g},${b},.14)`)
      s.setProperty('--glow-2',`rgba(${r},${g},${b},.10)`)
      // 新增变量
      s.setProperty('--bg-1',`rgb(${Math.floor(r*0.05)},${Math.floor(g*0.05)},${Math.floor(b*0.08)})`)
      s.setProperty('--bg-2',`rgb(${Math.floor(r*0.08)},${Math.floor(g*0.08)},${Math.floor(b*0.12)})`)
      s.setProperty('--bg-3',`rgb(${Math.floor(r*0.12)},${Math.floor(g*0.12)},${Math.floor(b*0.18)})`)
      s.setProperty('--b0',`rgba(${r},${g},${b},.08)`)
      s.setProperty('--b1',`rgba(${r},${g},${b},.15)`)
      s.setProperty('--t0',`rgb(${Math.min(255,r+120)},${Math.min(255,g+120)},${Math.min(255,b+120)})`)
      s.setProperty('--t1',`rgb(${Math.floor(r*0.5)+70},${Math.floor(g*0.5)+70},${Math.floor(b*0.5)+70})`)
      s.setProperty('--t2',`rgb(${Math.floor(r*0.4)+50},${Math.floor(g*0.4)+50},${Math.floor(b*0.4)+50})`)
      s.setProperty('--gradient',`linear-gradient(135deg, rgba(${r},${g},${b},.05) 0%, rgba(${r},${g},${b},.02) 100%)`)
    }else if(settings.palette){
      applyPalette(settings.palette)
    }

    if(settings.sidebarCollapsed!==undefined)setSidebarCollapsed(!!settings.sidebarCollapsed)
    if(settings.immersive){
      const app=document.querySelector('.app')
      if(app)app.classList.add('immersive')
    }
    if(settings.rating)state.rating={...state.rating,...settings.rating}
    
    // 加载界面缩放
    if(settings.uiScale){
      const scale=parseFloat(settings.uiScale)/100
      window.electronAPI?.setZoomFactor?.(scale)
    }
    
    // 更多设置可以在此加载
  }catch{}
}

function setSidebarCollapsed(collapsed){
  state.sidebarCollapsed=collapsed
  const sb=document.getElementById('sb')
  if(sb)sb.classList.toggle('collapsed',collapsed)
  const tog=document.getElementById('sbTog')
  if(tog)tog.textContent=collapsed?'›':'‹'
  saveSetting('sidebarCollapsed',collapsed)
}

function toggleSidebar(){
  setSidebarCollapsed(!state.sidebarCollapsed)
}
function nextPaletteKey(cur){
  const idx=Math.max(0,PALETTES.findIndex((p)=>p.key===cur))
  return PALETTES[(idx+1)%PALETTES.length]?.key||PALETTES[0].key
}
function setStatus(msg,isError=false){
  const st=document.getElementById('stmsg')
  if(st){
    st.textContent=msg
    if(isError)st.setAttribute('aria-live','assertive')
    else st.setAttribute('aria-live','polite')
  }
  const dot=document.getElementById('netDot')
  if(dot)dot.style.background=isError?'#f87171':'#4ade80'
  const bar=document.querySelector('.statusbar')
  if(bar)bar.classList.toggle('error',!!isError)
}
function getRatingQuery(){if(state.rating.adult)return'adult';if(state.rating.general&&!state.rating.ecchi)return'general';if(state.rating.ecchi&&!state.rating.general)return'ecchi';return null}

function setTopTitles(title){return nav.setTopTitles(title)}
function setPageTitle(title){return nav.setPageTitle(title)}
function setSidebarActive(page){return nav.setSidebarActive(page)}
function updateTopBackUi(){return nav.updateTopBackUi()}
function pushNav(){return nav.pushNav()}
async function goBack(){return nav.goBack({renderPageInitial})}

const X_VERSION_SALT='mSvL05GfEmeEmsEYfGCnVpEjYgTJraJN'

async function calculateXVersion(url){
  try{
    const u=new URL(url)
    const expires=u.searchParams.get('expires')
    if(!expires)return null
    const uuid=u.pathname.split('/').filter(Boolean).pop()
    if(!uuid)return null
    return await sha1Hex(`${uuid}_${expires}_${X_VERSION_SALT}`)
  }catch{
    return null
  }
}

function sourceQualityNum(s){
  const n=String(s?.name||'').trim()
  const v=parseInt(n,10)
  return Number.isFinite(v)?v:0
}

function sourcePlayUrl(s){
  return s?.src?.view||s?.view||s?.src?.download||s?.download||null
}

function normalizeUrl(u){
  if(!u)return''
  const s=String(u)
  if(s.startsWith('//'))return`https:${s}`
  return s
}

function pickBestSource(sources){
  const list=(Array.isArray(sources)?sources:[]).slice().filter((s)=>!!sourcePlayUrl(s))
  list.sort((a,b)=>sourceQualityNum(b)-sourceQualityNum(a))
  return list[0]||null
}

function fileLargeUrl(f){
  const id=f?.id
  const name=f?.name
  if(!id||!name)return''
  const mime=String(f?.mime||'')
  if(mime==='image/gif')return`https://i.iwara.tv/image/original/${encodeURIComponent(id)}/${encodeURIComponent(name)}`
  return`https://i.iwara.tv/image/large/${encodeURIComponent(id)}/${encodeURIComponent(name)}`
}

function fileOriginalUrl(f){
  const id=f?.id
  const name=f?.name
  if(!id||!name)return''
  return`https://i.iwara.tv/image/original/${encodeURIComponent(id)}/${encodeURIComponent(name)}`
}

function bindUserLinks(root){
  return bindings.bindUserLinks({openUserDetail},root)
}

function commentsCtx(){
  return { apiGet, apiPost, endpoints, pickResults, pickForumPosts, escapeHtml, escapeAttr, setStatus, doLogin, bindUserLinks }
}

function commentItemHtml(x){return comments.commentItemHtml({escapeHtml,escapeAttr},x)}
function forumPostToCommentLike(p){return comments.forumPostToCommentLike(p)}
async function openDetailComments(type,id){return comments.openDetailComments(commentsCtx(),type,id)}
async function openDetailForumPosts(catId,threadId,initialPosts){return comments.openDetailForumPosts(commentsCtx(),catId,threadId,initialPosts)}
function viewCommentsPanelHtml(st,title,prefix){return comments.viewCommentsPanelHtml({escapeHtml,escapeAttr},st,title,prefix)}
async function loadViewComments(st,reset){return comments.loadViewComments({apiGet,endpoints,pickResults},st,reset)}
function bindViewCommentsPanelEvents(st,prefix,onRender){return comments.bindViewCommentsPanelEvents(commentsCtx(),st,prefix,onRender)}

function watchPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    apiPost,
    apiDelete,
    escapeHtml,
    escapeAttr,
    formatNumber,
    normalizeUrl,
    videoTitle,
    videoAuthor,
    imageTitle,
    fileLargeUrl,
    fileOriginalUrl,
    sourceQualityNum,
    sourcePlayUrl,
    pickBestSource,
    calculateXVersion,
    setStatus,
    doLogin,
    setPageTitle,
    bindUserLinks,
    viewCommentsPanelHtml,
    bindViewCommentsPanelEvents,
    loadViewComments
  }
}

function threadPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    apiPost,
    escapeHtml,
    escapeAttr,
    setStatus,
    setPageTitle,
    bindUserLinks,
    forumBodyHtml,
    doLogin,
    pickThread,
    pickForumPosts,
    forumPostToCommentLike,
    commentItemHtml
  }
}

function userPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    apiPost,
    apiDelete,
    escapeHtml,
    renderImagesMasonry,
    renderVideosGrid,
    bindCardEvents,
    bindUserLinks,
    getRatingQuery,
    pickResults,
    viewCommentsPanelHtml,
    bindViewCommentsPanelEvents,
    loadViewComments,
    setStatus,
    doLogin,
    pickUser,
    setPageTitle,
    userTitleText,
    userUsernameText,
    userAboutText
  }
}

function forumPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    apiPost,
    escapeHtml,
    escapeAttr,
    pageContainerHtml,
    sectionHead,
    forumGroupLabel,
    forumLeafLabel,
    renderForumCategories,
    renderForumList,
    forumItemHtml,
    bindForumEvents,
    pickResults,
    setStatus,
    doLogin,
    openForumThreadDetail
  }
}

function feedPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    escapeHtml,
    pageContainerHtml,
    sectionHead,
    renderVideosGrid,
    renderImagesMasonry,
    bindCardEvents,
    getRatingQuery,
    pickResults,
    videoCardHtml,
    imageCardHtml
  }
}

function searchPageCtx(){
  return {
    state,
    endpoints,
    apiGet,
    pickResults,
    setLoading,
    setStatus,
    pageContainerHtml,
    sectionHead,
    escapeAttr,
    getRatingQuery,
    renderVideosGrid,
    renderImagesMasonry,
    renderUserList,
    renderForumList,
    bindCardEvents,
    bindForumEvents,
    bindUserLinks
  }
}

function accountPageCtx(){
  const mapLoginError=(m)=>{
    const s=String(m||'')
    if(!s)return'登录失败'
    if(s.includes('errors.invalidLogin'))return'邮箱或密码错误'
    if(s.includes('errors.forbidden'))return'被 Cloudflare 拦截：请在弹窗完成验证后重试'
    if(s.includes('errors.tooManyRequests'))return'请求过于频繁，请稍后再试'
    return s
  }
  return {
    state,
    endpoints,
    apiGet,
    apiPost,
    pickUser,
    pickResults,
    updateAccountUi,
    ensureMeLoaded,
    escapeHtml,
    escapeAttr,
    pageContainerHtml,
    sectionHead,
    renderUserList,
    renderVideosGrid,
    renderImagesMasonry,
    bindUserLinks,
    bindCardEvents,
    setStatus,
    syncAuthState,
    renderPageInitial,
    meName,
    meUsername,
    meAvatarUrl,
    meAvatarLetter,
    mapLoginError,
    openVideoDetail,
    openImageDetail,
    openUserDetail,
    openForumThreadDetail
  }
}

function settingsPageCtx(){
  return {
    pageContainerHtml,
    escapeHtml,
    setStatus,
    applyPalette,
    PALETTES,
    state,
    openDetailShell,
    setDetailTitle,
    setDetailBodyHtml,
    closeDetail
  }
}

async function openVideoDetail(videoId){
  pushNav()
  state.page='videoDetail'
  state.pageTitle=''
  state.view.kind='video'
  state.view.id=String(videoId||'')
  state.view.catId=''
  state.view.tab='detail'
  await renderPageInitial()
}

function renderImageViewerShell(){return imageViewer.renderImageViewerShell()}
function updateImageTransform(){return imageViewer.updateImageTransform()}
function resetImageTransform(){return imageViewer.resetImageTransform()}
function setImageIndex(idx){return imageViewer.setImageIndex({fileLargeUrl,fileOriginalUrl},idx)}

async function openImageDetail(imageId){
  pushNav()
  state.page='imageDetail'
  state.pageTitle=''
  state.view.kind='image'
  state.view.id=String(imageId||'')
  state.view.catId=''
  state.view.tab='detail'
  await renderPageInitial()
}

function forumBodyHtml(s){
  const t=escapeHtml(String(s||''))
  return t?`<div class="detail-desc">${t.replace(/\n/g,'<br>')}</div>`:''
}

async function openForumThreadDetail(categoryId,threadId){
  pushNav()
  state.page='thread'
  state.pageTitle=''
  state.view.kind='thread'
  state.view.id=String(threadId||'')
  state.view.catId=String(categoryId||'')
  state.view.tab='detail'
  await renderPageInitial()
}

function userAboutText(u){
  return String(u?.about||u?.description||u?.bio||'')
}

function userTitleText(u){
  return String(u?.name||u?.username||'用户')
}

function userUsernameText(u){
  const un=String(u?.username||'')
  return un?`@${un}`:''
}

function renderUserTabs(active){
  const tabs=[['videos','视频'],['images','图片']]
  return `<div class="detail-tabs">${tabs.map(([k,l])=>`<div class="detail-tab${k===active?' active':''}" data-utab="${k}">${l}</div>`).join('')}</div><div id="userTabBody"></div>`
}

async function loadUserTab(){
  if(!state.detail.open||state.detail.type!=='user')return
  const host=document.getElementById('userTabBody')
  if(!host)return
  host.innerHTML=`<div class="detail-loading">加载中…</div>`
  const userId=state.detail.user.id
  const tab=state.detail.user.tab
  try{
    const rating=getRatingQuery()
    if(tab==='videos'){
      const query={user:userId,page:0,limit:32,sort:'date'}
      if(rating)query.rating=rating
      const data=await apiGet(endpoints.videos(),query,{skipAuthWait:true})
      if(data?.error)throw new Error(data.message||'request failed')
      const results=pickResults(data)
      host.innerHTML=results.length?renderVideosGrid(results):`<div class="detail-loading">暂无视频</div>`
      bindCardEvents(document.getElementById('detailCenter'))
      return
    }
    if(tab==='images'){
      const query={user:userId,page:0,limit:32,sort:'date'}
      if(rating)query.rating=rating
      const data=await apiGet(endpoints.images(),query,{skipAuthWait:true})
      if(data?.error)throw new Error(data.message||'request failed')
      const results=pickResults(data)
      host.innerHTML=results.length?renderImagesMasonry(results):`<div class="detail-loading">暂无图片</div>`
      bindCardEvents(document.getElementById('detailCenter'))
      return
    }
  }catch(e){
    host.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}

function bindUserTabs(){
  const center=document.getElementById('detailCenter')
  if(!center)return
  if(center._userTabsDelegated)return
  center._userTabsDelegated=true
  center.addEventListener('click',async(e)=>{
    const el=e.target?.closest?.('[data-utab]')
    if(!el)return
    const tab=el.getAttribute('data-utab')||'videos'
    state.detail.user.tab=tab
    center.querySelectorAll('[data-utab]').forEach(t=>t.classList.toggle('active',t===el))
    await loadUserTab()
  })
}

async function openUserDetail(userId){
  pushNav()
  state.page='user'
  state.pageTitle=''
  state.view.kind='user'
  state.view.id=String(userId||'')
  state.view.catId=''
  state.view.tab='detail'
  await renderPageInitial()
}

function forumGroupFromChip(chip){if(chip==='管理')return'administration';if(chip==='中文')return'chinese';if(chip==='日文')return'japanese';return'global'}
function forumGroupLabel(group){if(group==='administration')return'管理';if(group==='chinese')return'中文';if(group==='japanese')return'日文';return'全站'}
function forumLeafLabel(id){return renderers.forumLeafLabel(id)}
function forumLeafDesc(id){return renderers.forumLeafDesc(id)}

function videoThumbnailUrl(v){return renderers.videoThumbnailUrl({pad2},v)}
function videoDurationSeconds(v){return renderers.videoDurationSeconds(v)}
function videoTitle(v){return renderers.videoTitle(v)}
function videoAuthor(v){return renderers.videoAuthor(v)}
function imageThumbnailCandidates(img){return renderers.imageThumbnailCandidates(img)}
function imageThumbnailUrl(img){return renderers.imageThumbnailUrl(img)}
function imageTitle(img){return renderers.imageTitle(img)}
function imageCount(img){return renderers.imageCount(img)}

function sectionHead(title,count,more){return renderers.sectionHead(title,count,more)}
function renderFilterbar(chips,active){return `<div class="filterbar">${chips.map((c)=>`<div class="chip${c===active?' active':''}" data-chip="${c}">${c}</div>`).join('')}</div>`}
function renderSubnav(items,active){return `<div class="subnav">${items.map((it)=>`<div class="subnav-item${it===active?' active':''}" data-sub="${it}">${it}</div>`).join('')}</div>`}

function bindSubareaEvents(){const subarea=document.getElementById('subarea');if(!subarea)return;subarea.querySelectorAll('.chip[data-chip]').forEach((el)=>{el.addEventListener('click',async()=>{const chip=el.getAttribute('data-chip');if(!chip)return;state.chip[state.page]=chip;if(state.page==='forum'){state.forum.group=forumGroupFromChip(chip);state.forum.view='cats';state.forum.categoryId='';state.forum.categoryLabel=''}subarea.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');await reloadPage()})});subarea.querySelectorAll('.subnav-item[data-sub]').forEach((el)=>{el.addEventListener('click',async()=>{const tab=el.getAttribute('data-sub');if(!tab)return;state.sub[state.page]=tab;subarea.querySelectorAll('.subnav-item').forEach(c=>c.classList.remove('active'));el.classList.add('active');await reloadPage()})})}

function mountSubarea(){const subarea=document.getElementById('subarea');if(!subarea)return;const cfg=SUB[state.page];if(!cfg){subarea.innerHTML='';return}if(cfg.type==='filter'){const active=state.chip[state.page]||cfg.chips[0];subarea.innerHTML=renderFilterbar(cfg.chips,active)}else{const active=state.sub[state.page]||cfg.items[0];subarea.innerHTML=renderSubnav(cfg.items,active)}bindSubareaEvents()}

function pageContainerHtml(inner){return renderers.pageContainerHtml(inner)}
function videoCardHtml(v){return renderers.videoCardHtml({escapeHtml,escapeAttr,formatDurationSeconds,formatNumber,pad2,playIcon,ratingClass,ratingLabel},v)}
function renderVideosGrid(videos){return renderers.renderVideosGrid({escapeHtml,escapeAttr,formatDurationSeconds,formatNumber,pad2,playIcon,ratingClass,ratingLabel},videos)}

function imageCardHtml(img){return renderers.imageCardHtml({escapeHtml,escapeAttr},img)}
function renderImagesMasonry(images){return renderers.renderImagesMasonry({escapeHtml,escapeAttr},images)}

function forumItemHtml(f){return renderers.forumItemHtml({escapeHtml,escapeAttr,formatNumber,state},f)}
function renderForumList(items){return renderers.renderForumList({escapeHtml,escapeAttr,formatNumber,state},items)}
function forumCategoryItemHtml(c){return renderers.forumCategoryItemHtml({escapeHtml,escapeAttr,formatNumber},c)}
function renderForumCategories(items){return renderers.renderForumCategories({escapeHtml,escapeAttr,formatNumber},items)}

function userItemHtml(u){return renderers.userItemHtml({escapeHtml,escapeAttr},u)}
function renderUserList(items){return renderers.renderUserList({escapeHtml,escapeAttr},items)}

function renderCreatePage(){
  const tab=String(state.sub.create||'投稿')
  if(!state.auth.hasAccess){
    return pageContainerHtml(`<div class="create-page"><div class="create-icon">↑</div><div class="create-title">投稿</div><div class="create-sub">登录后可发布投稿</div><button class="create-btn" id="createLoginBtn">立即登录</button></div>`)
  }
  if(tab==='我的投稿'){
    return pageContainerHtml(`<div class="create-page" style="padding:18px 0"><div class="create-title">我的投稿</div><div class="create-sub" style="margin-top:6px">仅显示最新 20 条</div><button class="create-btn" id="createMyPostsReload" style="margin-top:10px;background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">刷新</button><div id="myPostsList" style="margin-top:12px"><div class="detail-loading">加载中…</div></div></div>`)
  }
  return pageContainerHtml(`<div class="create-page" style="padding:18px 0"><div class="create-title">投稿</div><div class="create-sub" style="margin-top:6px">发布一条帖子到 iwara</div><div class="search-box" style="margin-top:12px"><span class="sico">T</span><input id="createPostTitle" placeholder="标题"></div><div class="create-textarea-box" style="margin-top:10px"><textarea id="createPostBody" placeholder="内容" style="width:100%;min-height:160px;padding:12px;background:var(--bg-2);border:1px solid var(--b1);border-radius:var(--r-sm);color:var(--t0);font-size:13px;line-height:1.6;resize:vertical;outline:none"></textarea></div><div id="createPostErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="createPostBtn" style="margin-top:6px">发布投稿</button></div>`)
}
async function ensureMeLoaded(){if(!state.auth.hasAccess)return null;if(state.me)return state.me;const data=await apiGet(endpoints.me(),null,{skipAuthWait:true});if(data?.error)throw new Error(data.message||'request failed');const u=pickUser(data);state.me=u;updateAccountUi();return state.me}
function meName(){return state.me?.name||state.me?.username||'User'}
function meUsername(){const u=String(state.me?.username||'');return u?`@${u}`:''}
function meAvatarUrl(){
  const av=state.me?.avatar
  const id=av?.id
  const name=av?.name
  if(!id||!name)return''
  const mime=String(av?.mime||'')
  const isAnimated=mime==='image/gif'||mime==='image/webp'||mime==='image/apng'
  const n=String(name||'')
  const fileName=isAnimated?n:(n.includes('.')?n.replace(/\.[^.]+$/,'.jpg'):`${n}.jpg`)
  if(!fileName)return''
  const base=isAnimated?'original':'avatar'
  return `https://i.iwara.tv/image/${base}/${encodeURIComponent(String(id))}/${encodeURIComponent(fileName)}`
}
function meAvatarLetter(){const s=meName();return s&&s[0]?String(s[0]).toUpperCase():'U'}
function renderProfilePane(){const tab=state.sub.profile||'订阅';const map={订阅:'订阅列表入口待接入',关注:'关注列表入口待接入',收藏:'收藏列表入口待接入',点赞:'点赞列表入口待接入',作品:'作品列表入口待接入'};return `<div class="create-page" style="padding:18px 0"><div class="create-sub">${escapeHtml(map[tab]||'')}</div></div>`}
function renderProfilePage(){if(state.auth.hasAccess){const name=escapeHtml(meName());const uname=escapeHtml(meUsername());const av=escapeHtml(meAvatarLetter());const meta=uname?`已登录 · ${uname}`:'已登录';return pageContainerHtml(`<div class="profile-header"><div class="profile-av">${av}</div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${meta}</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane">${renderProfilePane()}</div><div class="create-page" style="padding:10px 0 22px"><button class="create-btn" id="profileLogoutBtn" style="background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">退出登录</button></div>`)}return pageContainerHtml(`<div class="profile-header"><div class="profile-av">G</div><div class="profile-info"><div class="profile-name">Guest</div><div class="profile-meta">未登录</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane"><div class="create-page" style="padding:22px 0"><div class="create-sub">登录后查看个人内容</div><div class="search-box" style="margin-top:12px"><span class="sico">@</span><input id="loginEmail" placeholder="邮箱"></div><div class="search-box" style="margin-top:10px"><span class="sico">＊</span><input id="loginPassword" placeholder="密码" type="password"></div><div id="loginErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="profileDoLoginBtn">立即登录</button></div></div>`)}
function renderSettingsPage(){const rows=[['无边框窗口','on'],['毛玻璃效果','on'],['始终置顶',''],['硬件加速解码','on'],['预加载缩略图','on'],['阻止追踪脚本','on'],['清除缓存','']];return pageContainerHtml(`<div style="max-width:420px">${rows.map(([l,on])=>`<div class="fitem" style="margin-bottom:2px"><div class="fbody"><div class="ftitle">${l}</div></div><div class="toggle ${on}" data-setting="${l}"></div></div>`).join('')}<div style="margin-top:14px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--b0);border-radius:var(--r-sm);"><div style="font-size:11px;color:var(--t2);line-height:1.7">iwara 本地客户端<br>基于 Electron · 数据来源 iwara.tv</div></div></div>`)}
function renderProfilePage2(){
  if(state.auth.hasAccess){
    const name=escapeHtml(meName())
    const uname=escapeHtml(meUsername())
    const letter=escapeHtml(meAvatarLetter())
    const url=escapeAttr(meAvatarUrl())
    const avImg=url?`<img class="av-img" src="${url}" alt="">`:''
    const meta=uname?`已登录 · ${uname}`:'已登录'
    return pageContainerHtml(`<div class="profile-header"><div class="profile-av">${avImg}${letter}</div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${meta}</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane">${renderProfilePane()}</div><div class="create-page" style="padding:10px 0 22px"><button class="create-btn" id="profileLogoutBtn" style="background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">退出登录</button></div>`)
  }
  return pageContainerHtml(`<div class="profile-header"><div class="profile-av">G</div><div class="profile-info"><div class="profile-name">Guest</div><div class="profile-meta">未登录</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane"><div class="create-page" style="padding:22px 0"><div class="create-sub">登录后查看个人内容</div><div class="search-box" style="margin-top:12px"><span class="sico">@</span><input id="loginEmail" placeholder="邮箱"></div><div class="search-box" style="margin-top:10px"><span class="sico">＊</span><input id="loginPassword" placeholder="密码" type="password"></div><div id="loginErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="profileDoLoginBtn" style="margin-top:6px">登录</button></div></div>`)
}

function setLoading(on){state.loading=on;const host=document.getElementById('netHost');if(host)host.textContent='iwara.tv';setStatus(on?'loading...':'ready',false)}

function updateAccountUi(){const nameEl=document.querySelector('#accountBtn .sb-acc-name');const subEl=document.querySelector('#accountBtn .sb-acc-sub');const avEl=document.querySelector('#accountBtn .sb-av');if(nameEl)nameEl.textContent=state.auth.hasAccess?(state.me?.name||state.me?.username||'User'):'Guest';if(subEl)subEl.textContent=state.auth.hasAccess?(meUsername()?`已登录 · ${meUsername()}`:'已登录'):'点击登录';if(avEl){if(state.auth.hasAccess){const letter=meAvatarLetter();const url=meAvatarUrl();const img=url?`<img class="av-img" src="${escapeAttr(url)}" alt="">`:'';avEl.innerHTML=`${img}${escapeHtml(letter)}`}else{avEl.textContent='G'}}}

async function loadMyPostsList(token=state.navToken){
  const host=document.getElementById('myPostsList')
  if(!host)return
  if(token!==state.navToken)return
  if(!state.auth.hasAccess)return
  try{
    host.innerHTML=`<div class="detail-loading">加载中…</div>`
    await ensureMeLoaded()
    if(token!==state.navToken)return
    const meId=String(state.me?.id||'')
    if(!meId){
      host.innerHTML=`<div class="detail-loading">未登录</div>`
      return
    }
    const data=await apiGet(endpoints.posts(),{user:meId,page:0,limit:20},{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const items=pickResults(data)
    const html=(Array.isArray(items)?items:[]).map((p)=>{
      const title=escapeHtml(String(p?.title||''))
      const created=escapeHtml(String(p?.createdAt||p?.created_at||'').replace('T',' ').slice(0,16))
      const body=escapeHtml(String(p?.body||''))
      const snippet=body.length>220?`${body.slice(0,220)}…`:body
      return `<div class="fitem" style="cursor:default"><div class="fbody"><div class="ftitle">${title||'（无标题）'}</div><div class="fdesc" style="margin-top:4px;white-space:pre-wrap">${snippet}</div></div><div class="fmeta">${created||''}</div></div>`
    }).join('')
    host.innerHTML=html||`<div class="detail-loading">暂无投稿</div>`
  }catch(e){
    host.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}

function bindCreateEvents(token=state.navToken){
  const content=document.getElementById('content')
  if(!content)return
  if(content._createEventsDelegated)return
  content._createEventsDelegated=true
  content.addEventListener('click',async(e)=>{
    const loginBtn=e.target?.closest?.('#createLoginBtn')
    if(loginBtn){
      await doLogin()
      return
    }
    const reloadBtn=e.target?.closest?.('#createMyPostsReload')
    if(reloadBtn){
      await loadMyPostsList(token)
      return
    }
    const postBtn=e.target?.closest?.('#createPostBtn')
    if(postBtn){
      const errEl=document.getElementById('createPostErr')
      const titleEl=document.getElementById('createPostTitle')
      const bodyEl=document.getElementById('createPostBody')
      const title=String(titleEl?.value||'').trim()
      const body=String(bodyEl?.value||'').trim()
      if(errEl)errEl.textContent=''
      if(!title||!body){
        if(errEl)errEl.textContent='请填写标题和内容'
        return
      }
      try{
        setLoading(true)
        await ensureMeLoaded()
        const data=await apiPost(endpoints.posts(),{title,body,rulesAgreement:true},null,{skipAuthWait:true})
        if(data?.error)throw new Error(data.message||'request failed')
        if(titleEl)titleEl.value=''
        if(bodyEl)bodyEl.value=''
        setStatus('投稿已发布',false)
        state.sub.create='我的投稿'
        await reloadPage()
      }catch(e){
        if(errEl)errEl.textContent=String(e?.message||e)
      }finally{
        setLoading(false)
      }
    }
  })
}

function bindCardEvents(root){
  return bindings.bindCardEvents({openVideoDetail,openImageDetail,openUserDetail},root)
}

let loadMoreRafId=null
function loadMoreIfNeeded(){if(loadMoreRafId)return;loadMoreRafId=requestAnimationFrame(async()=>{loadMoreRafId=null;if(!state.hasMore)return;if(!['home','video','image','forum'].includes(state.page))return;const content=document.getElementById('content');if(!content)return;const nearBottom=content.scrollTop+content.clientHeight>=content.scrollHeight-300;if(!nearBottom)return;if(state.loading)return;state.paging[state.page]=(state.paging[state.page]||0)+1;await fetchAndRenderAppend(false,state.navToken)})}

function toggleRating(){const p=document.getElementById('ratPanel');if(!p)return;const isOpen=p.classList.toggle('open');if(!isOpen)return}
function closeRating(){const p=document.getElementById('ratPanel');if(p)p.classList.remove('open')}

function toggleUpdatePanel(){
  const p=document.getElementById('updPanel')
  if(!p)return
  const isOpen=p.classList.toggle('open')
  if(!isOpen)return
  syncUpdateUi().catch(()=>{})
}
function closeUpdatePanel(){const p=document.getElementById('updPanel');if(p)p.classList.remove('open')}

function fmtBytes(n){
  const v=typeof n==='number'&&Number.isFinite(n)?n:0
  if(v<=0)return'0B'
  const units=['B','KB','MB','GB']
  let u=0
  let x=v
  while(x>=1024&&u<units.length-1){x/=1024;u++}
  return`${Math.round(x*10)/10}${units[u]}`
}

function applyUpdateStateToUi(st){
  const cur=document.getElementById('updCurVer')
  const nv=document.getElementById('updNewVer')
  const msg=document.getElementById('updMsg')
  const installBtn=document.getElementById('updInstallBtn')
  const manual=!!(st?.manualDownloadUrl||st?.manualReleaseUrl)
  if(cur)cur.textContent=st?.currentVersion||'—'
  if(nv)nv.textContent=st?.newVersion||'—'
  if(msg){
    if(st?.checking)msg.textContent='正在检查更新…'
    else if(st?.error)msg.textContent=String(st.error)
    else if(st?.downloaded)msg.textContent='更新已下载，可重启安装'
    else if(st?.available){
      if(manual){
        msg.textContent='发现新版本，点击“前往下载”在浏览器下载安装'
      }else{
      const p=st?.progress
      if(p&&typeof p.percent==='number'){
        const pct=`${Math.round(p.percent*10)/10}%`
        const extra=p.total?`（${fmtBytes(p.transferred)}/${fmtBytes(p.total)}）`:''
        msg.textContent=`正在下载… ${pct}${extra}`
      }else msg.textContent='发现新版本，正在下载…'
      }
    }else msg.textContent=st?.supported===false?'仅打包版本支持自动更新':'已是最新版本'
  }
  if(installBtn){
    installBtn.textContent=manual?'前往下载':'重启安装'
    installBtn.disabled=!(st&&(st.downloaded||manual))
  }
}

async function syncUpdateUi(){
  const upd=window.electronAPI
  if(!upd||!upd.getAppVersion||!upd.updateGetState)return
  try{
    const st=await upd.updateGetState()
    applyUpdateStateToUi(st)
  }catch(e){
    applyUpdateStateToUi({supported:false,checking:false,available:false,downloaded:false,currentVersion:'—',newVersion:'—',error:String(e?.message||e)})
  }
}

async function doLogin(){try{state.page='profile';document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));await renderPageInitial();const em=document.getElementById('loginEmail');if(em&&!state.auth.hasAccess)em.focus();return{success:true}}catch(e){setStatus(String(e.message||e),true);return{success:false}}}

function bindForumEvents(){
  const content=document.getElementById('content')
  if(!content)return
  if(content._forumEventsDelegated)return
  content._forumEventsDelegated=true
  content.addEventListener('click',async(e)=>{
    const back=e.target?.closest?.('#forumBackBtn')
    if(back){
      state.forum.view='cats'
      state.forum.categoryId=''
      state.forum.categoryLabel=''
      await reloadPage()
      return
    }
    const fcat=e.target?.closest?.('.fitem[data-fcat-id]')
    if(fcat){
      const id=fcat.getAttribute('data-fcat-id')||''
      const label=fcat.getAttribute('data-fcat-label')||''
      if(!id)return
      state.forum.view='threads'
      state.forum.categoryId=id
      state.forum.categoryLabel=label
      state.paging.forum=0
      state.hasMore=true
      await reloadPage()
      return
    }
    const thread=e.target?.closest?.('.fitem[data-thread-id]')
    if(thread){
      const tid=thread.getAttribute('data-thread-id')||''
      const cid=thread.getAttribute('data-thread-cat-id')||state.forum.categoryId||''
      if(cid&&tid)openForumThreadDetail(cid,tid)
    }
  })
}

let authRetryCount = 0;

async function syncAuthState(){
  try{
    const st=await window.electronAPI.authStatus()
    state.auth.hasAccess=!!st?.hasAccess
    state.auth.hasRefresh=!!st?.hasRefresh
    state.auth.isRefreshing=!!st?.isRefreshing
    if(!state.auth.hasAccess){
      state.me=null
      state.meCounts=null
      // 如果有 refresh token 但没有 access token，并且重试次数少于 3 次，延迟重试
      if(state.auth.hasRefresh && authRetryCount < 3){
        authRetryCount++
        console.log(`[Auth] Retry syncAuthState (${authRetryCount}/3) after 3s...`)
        setTimeout(syncAuthState, 3000)
        return
      }
    } else {
      // 成功获取到 access token，重置重试计数
      authRetryCount = 0
    }
    updateAccountUi()
  }catch{}
}

function errorPageHtml(msg){
  return pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
}

async function loadPage(content,fn,{clear=true}={}){
  if(clear)content.innerHTML=''
  try{
    await fn()
  }catch(e){
    const msg=String(e?.message||e)
    setStatus(msg,true)
    content.innerHTML=errorPageHtml(msg)
  }
}

async function renderPageInitial(){
  const content=document.getElementById('content')
  if(!content)return
  const token=++state.navToken
  setTopTitles(state.pageTitle||TITLES[state.page]||state.page)
  updateTopBackUi()
  mountSubarea()
  state.paging[state.page]=0
  state.hasMore=!['watch','videoDetail','imageDetail','thread','user'].includes(state.page)
  state.loading=false
  setLoading(false)
  content.scrollTop=0
  content.classList.toggle('bleed',['watch','videoDetail','imageDetail','thread','user'].includes(state.page))
  if(state.page==='videoDetail'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/videoDetail.js')
      await mod.renderVideoDetailPage(watchPageCtx())
    })
    return
  }
  if(state.page==='imageDetail'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/imageDetail.js')
      await mod.renderImageDetailPage(watchPageCtx())
    })
    return
  }
  if(state.page==='watch'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/watch.js')
      await mod.renderWatchPage(watchPageCtx())
    })
    return
  }
  if(state.page==='thread'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/thread.js')
      await mod.renderThreadPage(threadPageCtx())
    })
    return
  }
  if(state.page==='user'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/user.js')
      await mod.renderUserPage(userPageCtx())
    })
    return
  }
  if(state.page==='search'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/search.js')
      await mod.renderSearchPage(searchPageCtx())
    },{clear:false})
    return
  }
  if(state.page==='create'){
    content.innerHTML=renderCreatePage()
    const tab=String(state.sub.create||'投稿')
    const curToken=state.navToken
    bindCreateEvents(curToken)
    if(state.auth.hasAccess&&tab==='我的投稿'){
      await loadMyPostsList(curToken)
    }
    return
  }
  if(state.page==='profile'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/account.js')
      await mod.renderAccountPage(accountPageCtx(),{token})
    },{clear:false})
    return
  }
  if(state.page==='settings'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/settings.js')
      await mod.renderSettingsPage(settingsPageCtx())
    },{clear:false})
    return
  }
  if(state.page==='history'){
    await loadPage(content,async()=>{
      const mod=await import('./pages/history.js')
      await mod.renderHistoryPage(accountPageCtx(),content)
    },{clear:false})
    return
  }
  content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">○</div><div class="create-sub">加载中…</div></div>`)
  await fetchAndRenderAppend(true,token)
}

async function fetchAndRenderAppend(reset,token=state.navToken){
  const content=document.getElementById('content')
  if(!content)return
  if(token!==state.navToken)return
  if(state.loading)return
  setLoading(true)
  try{
    if(state.page==='home'||state.page==='video'){
      const mod=await import('./pages/feed.js')
      await mod.renderFeedAppend(feedPageCtx(),{reset,token})
      return
    }
    if(state.page==='image'){
      const mod=await import('./pages/feed.js')
      await mod.renderFeedAppend(feedPageCtx(),{reset,token})
      return
    }
    if(state.page==='forum'){
      const mod=await import('./pages/forum.js')
      await mod.renderForumAppend(forumPageCtx(),{reset,token})
      return
    }
  }catch(e){
    if(token===state.navToken){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      const hint=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
      if(reset)content.innerHTML=hint
      else content.insertAdjacentHTML('beforeend',hint)
    }
  }finally{
    setLoading(false)
  }
}

async function reloadPage(){
  const token=++state.navToken
  state.paging[state.page]=0
  state.hasMore=true
  if(state.page==='profile'){
    const content=document.getElementById('content')
    if(!content)return
    try{
      const mod=await import('./pages/account.js')
      await mod.renderAccountPage(accountPageCtx(),{token})
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  await fetchAndRenderAppend(true,token)
}

document.addEventListener('DOMContentLoaded',async()=>{
  const savedPalette=(()=>{try{return localStorage.getItem('palette')}catch{return null}})()
  applyPalette(savedPalette||state.palette||'blue')

  document.addEventListener('error',(e)=>{
    const t=e?.target
    if(!t||t.tagName!=='IMG')return
    const ds=t.dataset||{}
    if(ds.fbs!==undefined){
      const arr=String(ds.fbs||'').split('|').filter(Boolean)
      const next=arr.shift()
      ds.fbs=arr.join('|')
      if(next){
        try{t.src=next}catch{}
        return
      }
      const ph=ds.ph
      if(ph){
        delete ds.fbs
        delete ds.ph
        try{t.src=ph}catch{}
        return
      }
    }
    if(t.classList&&t.classList.contains('hist-thumb')){
      try{t.style.display='none'}catch{}
      return
    }
    if(t.classList&&t.classList.contains('av-img')){
      try{t.remove()}catch{}
    }
  },true)

  document.addEventListener('keydown',(e)=>{
    const isEnter=e.key==='Enter'
    const isSpace=e.key===' '||e.code==='Space'
    if(!isEnter&&!isSpace)return
    const t=e.target
    if(!t||!t.getAttribute)return
    const tag=String(t.tagName||'').toLowerCase()
    if(['input','textarea','select','button'].includes(tag))return
    if(t.isContentEditable)return
    if(t.getAttribute('role')==='button'){
      e.preventDefault()
      try{t.click()}catch{}
    }
  },true)

  document.querySelectorAll('.traf-dot[data-action]').forEach((el)=>{
    el.addEventListener('click',()=>{
      const a=el.getAttribute('data-action')
      if(a)window.electronAPI.controlWindow(a)
    })
  })

  const themeBtn=document.getElementById('themeBtn')
  if(themeBtn)themeBtn.addEventListener('click',()=>applyPalette(nextPaletteKey(state.palette)))

  const updateBtn=document.getElementById('updateBtn')
  if(updateBtn)updateBtn.addEventListener('click',toggleUpdatePanel)

  const updCheckBtn=document.getElementById('updCheckBtn')
  if(updCheckBtn)updCheckBtn.addEventListener('click',async()=>{
    try{
      const st=await window.electronAPI.updateCheck()
      applyUpdateStateToUi(st)
    }catch(e){
      applyUpdateStateToUi({supported:false,checking:false,available:false,downloaded:false,currentVersion:'—',newVersion:'—',error:String(e?.message||e)})
    }
  })

  const updInstallBtn=document.getElementById('updInstallBtn')
  if(updInstallBtn)updInstallBtn.addEventListener('click',async()=>{
    try{
      const r=await window.electronAPI.updateInstall()
      if(!r?.ok)applyUpdateStateToUi({supported:true,checking:false,available:true,downloaded:true,currentVersion:document.getElementById('updCurVer')?.textContent||'—',newVersion:document.getElementById('updNewVer')?.textContent||'—',error:r?.message||'安装失败'})
    }catch(e){
      applyUpdateStateToUi({supported:true,checking:false,available:true,downloaded:true,currentVersion:document.getElementById('updCurVer')?.textContent||'—',newVersion:document.getElementById('updNewVer')?.textContent||'—',error:String(e?.message||e)})
    }
  })

  if(window.electronAPI.onUpdateState){
    window.electronAPI.onUpdateState((st)=>{
      applyUpdateStateToUi(st)
    })
  }

  const sbTog=document.getElementById('sbTog')
  if(sbTog)sbTog.addEventListener('click',toggleSidebar)

  const ratingToggle=document.getElementById('ratingToggle')
  if(ratingToggle)ratingToggle.addEventListener('click',toggleRating)

  const topRefreshBtn=document.getElementById('topRefreshBtn')
  if(topRefreshBtn)topRefreshBtn.addEventListener('click',reloadPage)
  const topBackBtn=document.getElementById('topBackBtn')
  if(topBackBtn)topBackBtn.addEventListener('click',goBack)
  const topImm=document.getElementById('topImmersiveBtn')
  if(topImm)topImm.addEventListener('click',()=>{
    const app=document.querySelector('.app')
    if(!app)return
    const isImm=app.classList.toggle('immersive')
    saveSetting('immersive',isImm)
  })

  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){
      if(state.detail.open)closeDetail()
      else if(['watch','videoDetail','imageDetail','thread','user'].includes(state.page))goBack()
      else{closeRating();closeUpdatePanel()}
    }
    if(!state.detail.open)return
    if(state.detail.type==='image'){
      if(e.key==='ArrowLeft')setImageIndex(state.detail.index-1)
      if(e.key==='ArrowRight')setImageIndex(state.detail.index+1)
      if(e.key==='0')resetImageTransform()
    }
  })

  document.addEventListener('click',(e)=>{
    const p=document.getElementById('updPanel')
    if(!p||!p.classList.contains('open'))return
    const t=e.target
    const btn=document.getElementById('updateBtn')
    if(p.contains(t))return
    if(btn&&btn.contains(t))return
    closeUpdatePanel()
  },true)

  document.addEventListener('click',async(e)=>{
    const link=e.target?.closest?.('a[data-external-url]')
    if(!link)return
    const url=link.getAttribute('data-external-url')||link.getAttribute('href')||''
    if(!url)return
    e.preventDefault()
    e.stopPropagation()
    await openExternalLinkByUser(url)
  },true)

  await syncAuthState()

  // 如果没有有效的 access token，尝试自动登录
  if(!state.auth.hasAccess){
    const savedCreds=await window.electronAPI?.authGetSavedCredentials?.()
    if(savedCreds?.success&&savedCreds?.email){
      console.log('[Auth] Found saved credentials, attempting auto-login...')
      const autoLoginResult=await window.electronAPI?.authAutoLogin?.()
      if(autoLoginResult?.success){
        await syncAuthState()
      }else{
        console.log('[Auth] Auto-login failed:',autoLoginResult?.message)
      }
    }
  }

  loadSettings()

  // 初始化全局快捷键监听
  initGlobalShortcuts()

  const acc=document.getElementById('accountBtn')
  if(acc){
    acc.addEventListener('click',async()=>{
      state.page='profile'
      document.querySelectorAll('.sb-item').forEach((i)=>i.classList.remove('active'))
      await renderPageInitial()
      const em=document.getElementById('loginEmail')
      if(em&&!state.auth.hasAccess)em.focus()
    })
  }

  document.querySelectorAll('.sb-item[data-page]').forEach((el)=>{
    el.addEventListener('click',async()=>{
      const p=el.getAttribute('data-page')
      if(!p)return
      state.page=p
      document.querySelectorAll('.sb-item').forEach((i)=>i.classList.remove('active'))
      el.classList.add('active')
      await renderPageInitial()
    })
  })

  document.querySelectorAll('.toggle[data-rating]').forEach((el)=>{
    el.addEventListener('click',async()=>{
      const k=el.getAttribute('data-rating')
      if(!k)return
      state.rating[k]=!state.rating[k]
      el.classList.toggle('on',state.rating[k])
      saveSetting('rating',state.rating)
      await reloadPage()
    })
  })

  const content=document.getElementById('content')
  if(content)content.addEventListener('scroll',loadMoreIfNeeded,{passive:true})

  await renderPageInitial()
})
