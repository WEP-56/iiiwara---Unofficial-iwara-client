export async function renderVideoDetailPage(ctx){
  const content=document.getElementById('content')
  if(!content)return
  content.innerHTML=videoDetailPageShellHtml(ctx)
  bindVideoDetailPageEvents(ctx)
  await loadVideoDetailView(ctx)
}

function videoDetailPageShellHtml(ctx){
  const { state }=ctx
  const active=state.view.tab||'detail'
  const collapsed=!!state.view.sideCollapsed
  const tog=collapsed?'‹':'›'
  return `<div class="watch-page video"><div class="watch-layout"><div class="watch-left" id="watchLeft"></div><div class="watch-right${collapsed?' collapsed':''}"><div class="watch-tabs"><div class="watch-tab${active==='detail'?' active':''}" data-wtab="detail">详情</div><div class="watch-tab${active==='comments'?' active':''}" data-wtab="comments">评论</div><div class="watch-side-toggle" id="sideToggleBtn" title="隐藏/展开">${tog}</div></div><div class="watch-panel" id="watchPanel"></div></div></div></div>`
}

function videoDetailPanelHtml(ctx){
  const { state, escapeHtml, escapeAttr, formatNumber, videoTitle, videoAuthor, sourceQualityNum, normalizeUrl, sourcePlayUrl }=ctx
  const data=state.view.data
  if(!data)return `<div class="detail-loading">加载中…</div>`
  const v=data
  const title=escapeHtml(videoTitle(v))
  const authorName=escapeHtml(videoAuthor(v))
  const authorId=escapeAttr(v?.user?.id||'')
  const created=escapeHtml(String(v?.createdAt||v?.created_at||'').slice(0,10))
  const liked=!!v?.liked
  const following=!!v?.user?.following
  const stats=`${liked?'♥':'♡'} ${formatNumber(v?.numLikes||v?.num_likes||0)} · ▶ ${formatNumber(v?.numViews||v?.num_views||0)} · 💬 ${formatNumber(v?.numComments||v?.num_comments||0)}`
  const bodyText=escapeHtml(v?.body||'')
  const sources=Array.isArray(state.view.sources)?state.view.sources:[]
  const cur=escapeAttr(String(state.view.sourceUrl||''))
  const selectHtml=sources.length?`<div class="detail-bar"><select class="detail-select" id="watchVideoQuality">${sources.map((s)=>{const q=sourceQualityNum(s);const label=q?`${q}p`:'源';const url=escapeAttr(normalizeUrl(sourcePlayUrl(s)));return`<option value="${url}"${url===cur?' selected':''}>${escapeHtml(label)}</option>`}).join('')}</select>${cur?`<a class="detail-link" href="${cur}" target="_blank" rel="noreferrer">打开链接</a>`:''}</div>`:''
  const likeTitle=liked?'取消点赞':'点赞'
  const followTitle=following?'取消订阅':'订阅'
  const actions=`<div class="detail-actions">${authorId?`<div class="detail-btn" id="watchFollowBtn" title="${escapeAttr(followTitle)}">${following?'✓':'+'}</div>`:''}<div class="detail-btn" id="watchLikeBtn" title="${escapeAttr(likeTitle)}">${liked?'♥':'♡'}</div></div>`
  return `<div class="detail-meta"><div class="detail-sub">${authorId?`<span class="ulink" data-user-id="${authorId}">${authorName}</span>`:authorName}${created?` · ${created}`:''}</div><div class="detail-sub" style="margin-top:4px;display:flex;align-items:center;gap:10px"><div style="flex:1">${escapeHtml(stats)}</div>${actions}</div></div><div class="vtitle" style="margin:0 0 8px 0">${title}</div>${bodyText?`<div class="detail-desc">${bodyText.replace(/\\n/g,'<br>')}</div>`:''}${selectHtml}`
}

function renderVideoDetailMedia(ctx){
  const { state, escapeAttr, normalizeUrl }=ctx
  const left=document.getElementById('watchLeft')
  if(!left)return
  const data=state.view.data
  if(!data){
    left.innerHTML=`<div class="watch-player"><div class="detail-loading">加载中…</div></div>`
    return
  }
  const embed=data?.embedUrl||data?.embed_url
  if(embed){
    const src=escapeAttr(normalizeUrl(embed))
    left.innerHTML=`<div class="watch-player"><iframe src="${src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
    return
  }
  const src=escapeAttr(String(state.view.sourceUrl||''))
  left.innerHTML=`<div class="watch-player"><video id="watchVideoEl" ${src?`src="${src}"`:''} controls autoplay playsinline></video></div>`
}

function renderVideoDetailPanel(ctx){
  const { state, viewCommentsPanelHtml, bindViewCommentsPanelEvents, bindUserLinks }=ctx
  const panel=document.getElementById('watchPanel')
  if(!panel)return
  if(state.view.tab==='comments'){
    const st=state.view.comments
    panel.innerHTML=viewCommentsPanelHtml(st,'发表评论','watch')
    bindViewCommentsPanelEvents(st,'watch',()=>renderVideoDetailPanel(ctx))
    bindUserLinks(panel)
    return
  }
  panel.innerHTML=videoDetailPanelHtml(ctx)
  const sel=document.getElementById('watchVideoQuality')
  const vid=document.getElementById('watchVideoEl')
  if(sel&&vid&&!sel.__bound){
    sel.__bound=true
    sel.addEventListener('change',()=>{
      try{
        const t=vid.currentTime||0
        const paused=vid.paused
        const next=sel.value
        if(next){
          state.view.sourceUrl=next
          vid.src=next
          vid.currentTime=t
          if(!paused)vid.play().catch(()=>{})
        }
      }catch{}
    })
  }
  const likeBtn=document.getElementById('watchLikeBtn')
  if(likeBtn&&!likeBtn.__bound){
    likeBtn.__bound=true
    likeBtn.addEventListener('click',(e)=>{
      e.stopPropagation()
      toggleVideoLike(ctx)
    })
  }
  const followBtn=document.getElementById('watchFollowBtn')
  if(followBtn&&!followBtn.__bound){
    followBtn.__bound=true
    followBtn.addEventListener('click',(e)=>{
      e.stopPropagation()
      toggleVideoFollow(ctx)
    })
  }
  bindUserLinks(panel)
}

async function toggleVideoLike(ctx){
  const { state, apiPost, apiDelete, endpoints, setStatus, doLogin }=ctx
  const v=state.view.data
  if(!v)return
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const wasLiked=!!v.liked
  const oldLikes=Number(v?.numLikes??v?.num_likes??0)||0
  const nextLiked=!wasLiked
  const nextLikes=Math.max(0,oldLikes+(nextLiked?1:-1))
  v.liked=nextLiked
  v.numLikes=nextLikes
  v.num_likes=nextLikes
  renderVideoDetailPanel(ctx)
  try{
    const ep=endpoints.likeVideo(state.view.id)
    const res=nextLiked?await apiPost(ep,null,null,{skipAuthWait:true,silent:true}):await apiDelete(ep,null,{skipAuthWait:true,silent:true})
    if(res?.error)throw new Error(res.message||'request failed')
    setStatus(nextLiked?'liked':'unliked',false)
  }catch(e){
    v.liked=wasLiked
    v.numLikes=oldLikes
    v.num_likes=oldLikes
    renderVideoDetailPanel(ctx)
    setStatus(String(e?.message||e),true)
  }
}

async function toggleVideoFollow(ctx){
  const { state, apiPost, apiDelete, endpoints, setStatus, doLogin }=ctx
  const v=state.view.data
  const u=v?.user
  const userId=String(u?.id||'')
  if(!u||!userId)return
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const wasFollowing=!!u.following
  const nextFollowing=!wasFollowing
  u.following=nextFollowing
  renderVideoDetailPanel(ctx)
  try{
    const ep=endpoints.userFollowOrUnfollow(userId)
    const res=nextFollowing?await apiPost(ep,null,null,{skipAuthWait:true,silent:true}):await apiDelete(ep,null,{skipAuthWait:true,silent:true})
    if(res?.error)throw new Error(res.message||'request failed')
    setStatus(nextFollowing?'followed':'unfollowed',false)
  }catch(e){
    u.following=wasFollowing
    renderVideoDetailPanel(ctx)
    setStatus(String(e?.message||e),true)
  }
}

function bindVideoDetailPageEvents(ctx){
  const { state, loadViewComments }=ctx
  const side=document.getElementById('sideToggleBtn')
  if(side&&!side.__bound){
    side.__bound=true
    side.addEventListener('click',()=>{
      state.view.sideCollapsed=!state.view.sideCollapsed
      const right=document.querySelector('.watch-right')
      if(right)right.classList.toggle('collapsed',!!state.view.sideCollapsed)
      side.textContent=state.view.sideCollapsed?'‹':'›'
    })
  }
  document.querySelectorAll('[data-wtab]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const tab=el.getAttribute('data-wtab')||'detail'
      state.view.tab=tab
      document.querySelectorAll('[data-wtab]').forEach((x)=>x.classList.toggle('active',x===el))
      if(tab==='comments'){
        const st=state.view.comments
        if(st.type&&st.id&&st.items.length===0)await loadViewComments(st,true)
      }
      renderVideoDetailPanel(ctx)
    })
  })
}

async function loadVideoDetailView(ctx){
  const { state, endpoints, apiGet, setPageTitle, videoTitle, calculateXVersion, pickBestSource, normalizeUrl, sourcePlayUrl, sourceQualityNum, loadViewComments, escapeHtml }=ctx
  const key=`video:${state.view.id}`
  if(state.view.dataKey===key&&state.view.data){
    renderVideoDetailMedia(ctx)
    renderVideoDetailPanel(ctx)
    return
  }
  state.view.kind='video'
  state.view.dataKey=key
  state.view.data=null
  state.view.sources=null
  state.view.sourceUrl=''
  state.view.comments={type:'',id:'',page:0,hasMore:true,loading:false,items:[]}
  renderVideoDetailMedia(ctx)
  renderVideoDetailPanel(ctx)
  try{
    const data=await apiGet(endpoints.videoById(state.view.id),null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const v=(data?.video&&data.video.id)?data.video:data
    state.view.data=v
    setPageTitle(videoTitle(v))
    const embed=v?.embedUrl||v?.embed_url
    if(!embed){
      let sources=v?.videoSources||v?.video_sources||null
      if(!Array.isArray(sources)||sources.length===0){
        const fileUrl=v?.fileUrl||v?.file_url
        if(fileUrl){
          const x=await calculateXVersion(fileUrl)
          const headers=x?{'X-Version':x}:{}
          const srcData=await apiGet(fileUrl,null,{skipAuthWait:true,headers})
          if(Array.isArray(srcData))sources=srcData
        }
      }
      const best=pickBestSource(sources)
      state.view.sourceUrl=normalizeUrl(sourcePlayUrl(best))
      state.view.sources=(Array.isArray(sources)?sources:[]).slice().sort((a,b)=>sourceQualityNum(b)-sourceQualityNum(a))
    }
    state.view.comments={type:'video',id:state.view.id,page:0,hasMore:true,loading:false,items:[]}
    await loadViewComments(state.view.comments,true)
    renderVideoDetailMedia(ctx)
    renderVideoDetailPanel(ctx)
  }catch(e){
    const panel=document.getElementById('watchPanel')
    if(panel)panel.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}
