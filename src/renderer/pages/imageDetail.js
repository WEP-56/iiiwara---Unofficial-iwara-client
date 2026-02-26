import { linkifyText } from '../utils/linkify.js'

export async function renderImageDetailPage(ctx){
  const content=document.getElementById('content')
  if(!content)return
  content.innerHTML=imageDetailPageShellHtml(ctx)
  bindImageDetailPageEvents(ctx)
  await loadImageDetailView(ctx)
}

function renderImageViewerShell(){
  return `<div class="watch-img-wrap"><div class="watch-img-stage" id="watchImgStage"><img id="watchImg" class="watch-img" alt=""></div><div class="watch-img-nav"><div class="watch-img-btn" id="watchImgPrevBtn">‹</div><div class="watch-img-btn" id="watchImgNextBtn">›</div></div></div>`
}

function updateWatchImageTransform(ctx){
  const img=document.getElementById('watchImg')
  if(!img)return
  const s=ctx.state.view.image
  img.style.transform=`translate(${s.tx}px,${s.ty}px) scale(${s.scale})`
}

function resetWatchImageTransform(ctx){
  const s=ctx.state.view.image
  s.scale=1
  s.tx=0
  s.ty=0
  updateWatchImageTransform(ctx)
}

function setWatchImageIndex(ctx,idx){
  const { state, fileLargeUrl, fileOriginalUrl }=ctx
  const files=Array.isArray(state.view.data?.files)?state.view.data.files:[]
  const total=files.length
  if(!total)return
  const s=state.view.image
  s.index=((idx%total)+total)%total
  const file=files[s.index]
  const url=fileLargeUrl(file)||fileOriginalUrl(file)
  const img=document.getElementById('watchImg')
  if(img)img.src=url||''
  resetWatchImageTransform(ctx)
  const next=files[(s.index+1)%total]
  const prev=files[(s.index-1+total)%total]
  ;[next,prev].forEach((f)=>{const u=fileLargeUrl(f)||fileOriginalUrl(f);if(u){const im=new Image();im.src=u}})
}

function imageDetailPageShellHtml(ctx){
  const { state }=ctx
  const active=state.view.tab||'detail'
  const collapsed=!!state.view.sideCollapsed
  const tog=collapsed?'‹':'›'
  return `<div class="watch-page image"><div class="watch-layout"><div class="watch-left" id="watchLeft"></div><div class="watch-right${collapsed?' collapsed':''}"><div class="watch-tabs"><div class="watch-tab${active==='detail'?' active':''}" data-wtab="detail">详情</div><div class="watch-tab${active==='comments'?' active':''}" data-wtab="comments">评论</div><div class="watch-side-toggle" id="sideToggleBtn" title="隐藏/展开">${tog}</div></div><div class="watch-panel" id="watchPanel"></div></div></div></div>`
}

function imageDetailPanelHtml(ctx){
  const { state, escapeHtml, escapeAttr, formatNumber, imageTitle }=ctx
  const data=state.view.data
  if(!data)return `<div class="detail-loading">加载中…</div>`
  const img=data
  const title=escapeHtml(imageTitle(img))
  const files=Array.isArray(img?.files)?img.files:[]
  const authorName=escapeHtml(img?.user?.name||img?.user?.username||'')
  const authorId=escapeAttr(img?.user?.id||'')
  const created=escapeHtml(String(img?.createdAt||img?.created_at||'').slice(0,10))
  const liked=!!img?.liked
  const following=!!img?.user?.following
  const stats=`${liked?'♥':'♡'} ${formatNumber(img?.numLikes||img?.num_likes||0)} · 💬 ${formatNumber(img?.numComments||img?.num_comments||0)} · ${formatNumber(files.length)}p`
  const bodyText=linkifyText(img?.body||img?.description||'',{escapeHtml,escapeAttr})
  const likeTitle=liked?'取消点赞':'点赞'
  const followTitle=following?'取消订阅':'订阅'
  const actions=`<div class="detail-actions">${authorId?`<div class="detail-btn" id="watchFollowBtn" title="${escapeAttr(followTitle)}">${following?'✓':'+'}</div>`:''}<div class="detail-btn" id="watchLikeBtn" title="${escapeAttr(likeTitle)}">${liked?'♥':'♡'}</div></div>`
  return `<div class="detail-meta"><div class="detail-sub">${authorId?`<span class="ulink" data-user-id="${authorId}">${authorName||'Unknown'}</span>`:escapeHtml(authorName||'Unknown')}${created?` · ${created}`:''}</div><div class="detail-sub" style="margin-top:4px;display:flex;align-items:center;gap:10px"><div style="flex:1">${escapeHtml(stats)}</div>${actions}</div></div><div class="vtitle" style="margin:0 0 8px 0">${title}</div>${bodyText?`<div class="detail-desc">${bodyText}</div>`:''}`
}

function renderImageDetailMedia(ctx){
  const { state }=ctx
  const left=document.getElementById('watchLeft')
  if(!left)return
  const data=state.view.data
  if(!data){
    left.innerHTML=`<div class="watch-player"><div class="detail-loading">加载中…</div></div>`
    return
  }
  left.innerHTML=renderImageViewerShell()
  const prevBtn=document.getElementById('watchImgPrevBtn')
  const nextBtn=document.getElementById('watchImgNextBtn')
  if(prevBtn)prevBtn.addEventListener('click',()=>setWatchImageIndex(ctx,state.view.image.index-1))
  if(nextBtn)nextBtn.addEventListener('click',()=>setWatchImageIndex(ctx,state.view.image.index+1))
  const stage=document.getElementById('watchImgStage')
  if(stage){
    let dragging=false
    let sx=0,sy=0,stx=0,sty=0
    stage.addEventListener('pointerdown',(e)=>{
      if(state.view.image.scale<=1)return
      dragging=true
      stage.setPointerCapture(e.pointerId)
      sx=e.clientX
      sy=e.clientY
      stx=state.view.image.tx
      sty=state.view.image.ty
    })
    stage.addEventListener('pointermove',(e)=>{
      if(!dragging)return
      state.view.image.tx=stx+(e.clientX-sx)
      state.view.image.ty=sty+(e.clientY-sy)
      updateWatchImageTransform(ctx)
    })
    stage.addEventListener('pointerup',()=>{dragging=false})
    stage.addEventListener('pointercancel',()=>{dragging=false})
    stage.addEventListener('wheel',(e)=>{
      if(state.page!=='imageDetail')return
      e.preventDefault()
      const delta=-e.deltaY
      const next=state.view.image.scale*(delta>0?1.08:0.92)
      state.view.image.scale=Math.min(6,Math.max(1,next))
      updateWatchImageTransform(ctx)
    },{passive:false})
    stage.addEventListener('dblclick',()=>{
      state.view.image.scale=state.view.image.scale>1?1:2
      state.view.image.tx=0
      state.view.image.ty=0
      updateWatchImageTransform(ctx)
    })
  }
  setWatchImageIndex(ctx,0)
}

function renderImageDetailPanel(ctx){
  const { state, viewCommentsPanelHtml, bindViewCommentsPanelEvents, bindUserLinks }=ctx
  const panel=document.getElementById('watchPanel')
  if(!panel)return
  if(state.view.tab==='comments'){
    const st=state.view.comments
    panel.innerHTML=viewCommentsPanelHtml(st,'发表评论','watch')
    bindViewCommentsPanelEvents(st,'watch',()=>renderImageDetailPanel(ctx))
    bindUserLinks(panel)
    return
  }
  panel.innerHTML=imageDetailPanelHtml(ctx)
  if(!panel._imagePanelDelegated){
    panel._imagePanelDelegated=true
    panel.addEventListener('click',(e)=>{
      const likeBtn=e.target?.closest?.('#watchLikeBtn')
      if(likeBtn){
        e.stopPropagation()
        toggleImageLike(ctx)
        return
      }
      const followBtn=e.target?.closest?.('#watchFollowBtn')
      if(followBtn){
        e.stopPropagation()
        toggleImageFollow(ctx)
      }
    })
  }
  bindUserLinks(panel)
}

async function toggleImageLike(ctx){
  const { state, apiPost, apiDelete, endpoints, setStatus, doLogin }=ctx
  const img=state.view.data
  if(!img)return
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const wasLiked=!!img.liked
  const oldLikes=Number(img?.numLikes??img?.num_likes??0)||0
  const nextLiked=!wasLiked
  const nextLikes=Math.max(0,oldLikes+(nextLiked?1:-1))
  img.liked=nextLiked
  img.numLikes=nextLikes
  img.num_likes=nextLikes
  renderImageDetailPanel(ctx)
  try{
    const ep=endpoints.likeImage(state.view.id)
    const res=nextLiked?await apiPost(ep,undefined,undefined,{skipAuthWait:true,silent:true}):await apiDelete(ep,undefined,{skipAuthWait:true,silent:true})
    if(res?.error)throw new Error(res.message||'request failed')
    setStatus(nextLiked?'liked':'unliked',false)
  }catch(e){
    img.liked=wasLiked
    img.numLikes=oldLikes
    img.num_likes=oldLikes
    renderImageDetailPanel(ctx)
    setStatus(String(e?.message||e),true)
  }
}

async function toggleImageFollow(ctx){
  const { state, apiPost, apiDelete, endpoints, setStatus, doLogin }=ctx
  const img=state.view.data
  const u=img?.user
  const userId=String(u?.id||'')
  if(!u||!userId)return
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const wasFollowing=!!u.following
  const nextFollowing=!wasFollowing
  u.following=nextFollowing
  renderImageDetailPanel(ctx)
  try{
    const ep=endpoints.userFollowOrUnfollow(userId)
    const res=nextFollowing?await apiPost(ep,null,null,{skipAuthWait:true,silent:true}):await apiDelete(ep,null,{skipAuthWait:true,silent:true})
    if(res?.error)throw new Error(res.message||'request failed')
    setStatus(nextFollowing?'followed':'unfollowed',false)
  }catch(e){
    u.following=wasFollowing
    renderImageDetailPanel(ctx)
    setStatus(String(e?.message||e),true)
  }
}

function bindImageDetailPageEvents(ctx){
  const { state, loadViewComments }=ctx
  const content=document.getElementById('content')
  if(!content)return
  if(content._imageDetailPageEventsDelegated)return
  content._imageDetailPageEventsDelegated=true
  content.addEventListener('click',async(e)=>{
    const side=e.target?.closest?.('#sideToggleBtn')
    if(side){
      toggleWatchSidebar(side)
      return
    }
    const tabEl=e.target?.closest?.('[data-wtab]')
    if(tabEl){
      const tab=tabEl.getAttribute('data-wtab')||'detail'
      state.view.tab=tab
      document.querySelectorAll('[data-wtab]').forEach((x)=>x.classList.toggle('active',x===tabEl))
      if(tab==='comments'){
        const st=state.view.comments
        if(st.type&&st.id&&st.items.length===0)await loadViewComments(st,true)
      }
      renderImageDetailPanel(ctx)
    }
  })
}

async function loadImageDetailView(ctx){
  const { state, endpoints, apiGet, setPageTitle, imageTitle, loadViewComments, escapeHtml }=ctx
  const key=`image:${state.view.id}`
  if(state.view.dataKey===key&&state.view.data){
    renderImageDetailMedia(ctx)
    renderImageDetailPanel(ctx)
    return
  }
  state.view.kind='image'
  state.view.dataKey=key
  state.view.data=null
  state.view.image={index:0,scale:1,tx:0,ty:0,urls:[]}
  state.view.comments={type:'',id:'',page:0,hasMore:true,loading:false,items:[]}
  renderImageDetailMedia(ctx)
  renderImageDetailPanel(ctx)
  try{
    const data=await apiGet(endpoints.imageById(state.view.id),null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const img=(data?.image&&data.image.id)?data.image:data
    state.view.data=img
    setPageTitle(imageTitle(img))
    // 添加到历史记录
    try{
      const { addImageHistory }=await import('../core/history.js')
      await addImageHistory(img)
    }catch(e){/* ignore history errors */}
    state.view.comments={type:'image',id:state.view.id,page:0,hasMore:true,loading:false,items:[]}
    await loadViewComments(state.view.comments,true)
    renderImageDetailMedia(ctx)
    renderImageDetailPanel(ctx)
  }catch(e){
    const panel=document.getElementById('watchPanel')
    if(panel)panel.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}
