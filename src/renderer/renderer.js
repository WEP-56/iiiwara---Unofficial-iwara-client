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

window.addEventListener('error',(e)=>{try{console.error('window.error',e?.message||e,e?.filename||'',e?.lineno||0,e?.colno||0,e?.error||'')}catch{}})
window.addEventListener('unhandledrejection',(e)=>{try{console.error('unhandledrejection',e?.reason||e)}catch{}})

function ratingClass(r){if(r==='adult')return'r';if(r==='ecchi')return'e';return'g'}
function ratingLabel(r){if(r==='adult')return'18+';if(r==='ecchi')return'E';return'G'}
const PALETTES=[
  {key:'blue',label:'blue',ac:'#67b7ff',dim:'rgba(103,183,255,.11)',bd:'rgba(103,183,255,.26)',glow1:'rgba(103,183,255,.14)',glow2:'rgba(122,92,255,.10)'},
  {key:'purple',label:'purple',ac:'#b48cff',dim:'rgba(180,140,255,.12)',bd:'rgba(180,140,255,.28)',glow1:'rgba(180,140,255,.14)',glow2:'rgba(103,183,255,.08)'},
  {key:'green',label:'green',ac:'#38d399',dim:'rgba(56,211,153,.10)',bd:'rgba(56,211,153,.25)',glow1:'rgba(56,211,153,.12)',glow2:'rgba(56,211,153,.05)'},
  {key:'pink',label:'pink',ac:'#ff5ea8',dim:'rgba(255,94,168,.10)',bd:'rgba(255,94,168,.25)',glow1:'rgba(255,94,168,.12)',glow2:'rgba(122,92,255,.08)'}
]
function applyPalette(paletteKey){
  const p=PALETTES.find((x)=>x.key===paletteKey)||PALETTES[0]
  state.theme='dark'
  state.palette=p.key
  document.documentElement.setAttribute('data-theme','dark')
  const s=document.documentElement.style
  s.setProperty('--ac',p.ac)
  s.setProperty('--ac-dim',p.dim)
  s.setProperty('--ac-bd',p.bd)
  s.setProperty('--glow-1',p.glow1)
  s.setProperty('--glow-2',p.glow2)
  const btn=document.getElementById('themeBtn')
  if(btn){
    btn.textContent=p.label
    btn.title=`配色：${p.label}`
  }
  try{
    localStorage.setItem('palette',p.key)
    localStorage.setItem('theme','dark')
  }catch{}
}
function nextPaletteKey(cur){
  const idx=Math.max(0,PALETTES.findIndex((p)=>p.key===cur))
  return PALETTES[(idx+1)%PALETTES.length]?.key||PALETTES[0].key
}
function setStatus(msg,isError=false){const st=document.getElementById('stmsg');if(st)st.textContent=msg;const dot=document.getElementById('netDot');if(dot)dot.style.background=isError?'#f87171':'#4ade80'}
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
    bindUserLinks,
    bindCardEvents,
    setStatus,
    syncAuthState,
    renderPageInitial,
    meName,
    meUsername,
    meAvatarUrl,
    meAvatarLetter,
    mapLoginError
  }
}

function settingsPageCtx(){
  return {
    pageContainerHtml
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
  return t?`<div class="detail-desc">${t.replace(/\\n/g,'<br>')}</div>`:''
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
  center.querySelectorAll('[data-utab]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const tab=el.getAttribute('data-utab')||'videos'
      state.detail.user.tab=tab
      center.querySelectorAll('[data-utab]').forEach(t=>t.classList.toggle('active',t===el))
      await loadUserTab()
    })
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
function renderFilterbar(chips,active){return `<div class="filterbar">${chips.map((c)=>`<div class="chip${c===active?' active':''}" data-chip="${c}">${c}</div>`).join('')}<div class="fb-sep"></div><div class="fb-sort" id="sortBtn">排序 ↕</div></div>`}
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
  return pageContainerHtml(`<div class="create-page" style="padding:18px 0"><div class="create-title">投稿</div><div class="create-sub" style="margin-top:6px">发布一条帖子到 iwara</div><div class="search-box" style="margin-top:12px"><span class="sico">T</span><input id="createPostTitle" placeholder="标题"></div><div class="search-box" style="margin-top:10px"><span class="sico">✎</span><textarea id="createPostBody" placeholder="内容" style="height:160px;resize:vertical"></textarea></div><div id="createPostErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="createPostBtn" style="margin-top:6px">发布投稿</button></div>`)
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
    const avImg=url?`<img class="av-img" src="${url}" alt="" onerror="this.remove()">`:''
    const meta=uname?`已登录 · ${uname}`:'已登录'
    return pageContainerHtml(`<div class="profile-header"><div class="profile-av">${avImg}${letter}</div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${meta}</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane">${renderProfilePane()}</div><div class="create-page" style="padding:10px 0 22px"><button class="create-btn" id="profileLogoutBtn" style="background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">退出登录</button></div>`)
  }
  return pageContainerHtml(`<div class="profile-header"><div class="profile-av">G</div><div class="profile-info"><div class="profile-name">Guest</div><div class="profile-meta">未登录</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">关注</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div></div></div><div id="profilePane"><div class="create-page" style="padding:22px 0"><div class="create-sub">登录后查看个人内容</div><div class="search-box" style="margin-top:12px"><span class="sico">@</span><input id="loginEmail" placeholder="邮箱"></div><div class="search-box" style="margin-top:10px"><span class="sico">＊</span><input id="loginPassword" placeholder="密码" type="password"></div><div id="loginErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="profileDoLoginBtn" style="margin-top:6px">登录</button></div></div>`)
}

function setLoading(on){state.loading=on;const host=document.getElementById('netHost');if(host)host.textContent='iwara.tv';setStatus(on?'loading...':'ready',false)}

function updateAccountUi(){const nameEl=document.querySelector('#accountBtn .sb-acc-name');const subEl=document.querySelector('#accountBtn .sb-acc-sub');const avEl=document.querySelector('#accountBtn .sb-av');if(nameEl)nameEl.textContent=state.auth.hasAccess?(state.me?.name||state.me?.username||'User'):'Guest';if(subEl)subEl.textContent=state.auth.hasAccess?(meUsername()?`已登录 · ${meUsername()}`:'已登录'):'点击登录';if(avEl){if(state.auth.hasAccess){const letter=meAvatarLetter();const url=meAvatarUrl();const img=url?`<img class="av-img" src="${escapeAttr(url)}" alt="" onerror="this.remove()">`:'';avEl.innerHTML=`${img}${escapeHtml(letter)}`}else{avEl.textContent='G'}}}

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
  const loginBtn=document.getElementById('createLoginBtn')
  if(loginBtn&&!loginBtn.__bound){
    loginBtn.__bound=true
    loginBtn.addEventListener('click',async()=>{await doLogin()})
  }
  const reloadBtn=document.getElementById('createMyPostsReload')
  if(reloadBtn&&!reloadBtn.__bound){
    reloadBtn.__bound=true
    reloadBtn.addEventListener('click',async()=>{await loadMyPostsList(token)})
  }
  const postBtn=document.getElementById('createPostBtn')
  if(postBtn&&!postBtn.__bound){
    postBtn.__bound=true
    postBtn.addEventListener('click',async()=>{
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
    })
  }
}

function bindCardEvents(root){
  return bindings.bindCardEvents({openVideoDetail,openImageDetail,openUserDetail},root)
}

async function loadMoreIfNeeded(){if(!state.hasMore)return;if(!['home','video','image','forum'].includes(state.page))return;const content=document.getElementById('content');if(!content)return;const nearBottom=content.scrollTop+content.clientHeight>=content.scrollHeight-300;if(!nearBottom)return;if(state.loading)return;state.paging[state.page]=(state.paging[state.page]||0)+1;await fetchAndRenderAppend(false,state.navToken)}

function toggleRating(){const p=document.getElementById('ratPanel');if(!p)return;const isOpen=p.classList.toggle('open');if(!isOpen)return}
function closeRating(){const p=document.getElementById('ratPanel');if(p)p.classList.remove('open')}
function toggleSidebar(){state.sidebarCollapsed=!state.sidebarCollapsed;const sb=document.getElementById('sb');if(sb)sb.classList.toggle('collapsed',state.sidebarCollapsed);const tog=document.getElementById('sbTog');if(tog)tog.textContent=state.sidebarCollapsed?'›':'‹'}

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
  if(cur)cur.textContent=st?.currentVersion||'—'
  if(nv)nv.textContent=st?.newVersion||'—'
  if(msg){
    if(st?.checking)msg.textContent='正在检查更新…'
    else if(st?.error)msg.textContent=String(st.error)
    else if(st?.downloaded)msg.textContent='更新已下载，可重启安装'
    else if(st?.available){
      const p=st?.progress
      if(p&&typeof p.percent==='number'){
        const pct=`${Math.round(p.percent*10)/10}%`
        const extra=p.total?`（${fmtBytes(p.transferred)}/${fmtBytes(p.total)}）`:''
        msg.textContent=`正在下载… ${pct}${extra}`
      }else msg.textContent='发现新版本，正在下载…'
    }else msg.textContent=st?.supported===false?'仅打包版本支持自动更新':'已是最新版本'
  }
  if(installBtn)installBtn.disabled=!(st&&st.downloaded)
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
  const back=document.getElementById('forumBackBtn')
  if(back&&!back.__bound){
    back.__bound=true
    back.addEventListener('click',async()=>{
      state.forum.view='cats'
      state.forum.categoryId=''
      state.forum.categoryLabel=''
      await reloadPage()
    })
  }
  content.querySelectorAll('.fitem[data-fcat-id]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const id=el.getAttribute('data-fcat-id')||''
      const label=el.getAttribute('data-fcat-label')||''
      if(!id)return
      state.forum.view='threads'
      state.forum.categoryId=id
      state.forum.categoryLabel=label
      state.paging.forum=0
      state.hasMore=true
      await reloadPage()
    })
  })
  content.querySelectorAll('.fitem[data-thread-id]').forEach((el)=>{
    if(el.__boundThread)return
    el.__boundThread=true
    el.addEventListener('click',()=>{
      const tid=el.getAttribute('data-thread-id')||''
      const cid=el.getAttribute('data-thread-cat-id')||state.forum.categoryId||''
      if(cid&&tid)openForumThreadDetail(cid,tid)
    })
  })
}

async function syncAuthState(){
  try{
    const st=await window.electronAPI.authStatus()
    state.auth.hasAccess=!!st?.hasAccess
    state.auth.hasRefresh=!!st?.hasRefresh
    state.auth.isRefreshing=!!st?.isRefreshing
    if(!state.auth.hasAccess){
      state.me=null
      state.meCounts=null
    }
    updateAccountUi()
  }catch{}
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
    content.innerHTML=''
    try{
      const mod=await import('./pages/videoDetail.js')
      await mod.renderVideoDetailPage(watchPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  if(state.page==='imageDetail'){
    content.innerHTML=''
    try{
      const mod=await import('./pages/imageDetail.js')
      await mod.renderImageDetailPage(watchPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  if(state.page==='watch'){
    content.innerHTML=''
    try{
      const mod=await import('./pages/watch.js')
      await mod.renderWatchPage(watchPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  if(state.page==='thread'){
    content.innerHTML=''
    try{
      const mod=await import('./pages/thread.js')
      await mod.renderThreadPage(threadPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  if(state.page==='user'){
    content.innerHTML=''
    try{
      const mod=await import('./pages/user.js')
      await mod.renderUserPage(userPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
    return
  }
  if(state.page==='search'){
    try{
      const mod=await import('./pages/search.js')
      await mod.renderSearchPage(searchPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
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
  if(state.page==='settings'){
    try{
      const mod=await import('./pages/settings.js')
      await mod.renderSettingsPage(settingsPageCtx())
    }catch(e){
      const msg=String(e?.message||e)
      setStatus(msg,true)
      content.innerHTML=pageContainerHtml(`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">×</div><div class="create-sub">${escapeHtml(msg)}</div></div>`)
    }
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
    app.classList.toggle('immersive')
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

  await syncAuthState()

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
      await reloadPage()
    })
  })

  const content=document.getElementById('content')
  if(content)content.addEventListener('scroll',loadMoreIfNeeded,{passive:true})

  await renderPageInitial()
})
