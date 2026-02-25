export async function renderThreadPage(ctx){
  const content=document.getElementById('content')
  if(!content)return
  content.innerHTML=threadPageShellHtml()
  bindThreadPageEvents(ctx)
  await loadThreadView(ctx)
}

function threadPageShellHtml(){
  return `<div class="thread-page"><div class="thread-hero" id="threadHero"></div><div class="thread-floors" id="threadFloors"></div><div class="thread-footer" id="threadFooter"></div></div>`
}

function threadHeroHtml(ctx){
  const { state, escapeAttr, escapeHtml }=ctx
  const t=state.view.thread.data
  if(!t)return `<div class="thread-hero-inner"><div class="detail-loading">加载中…</div></div>`
  const title=escapeHtml(t?.title||'帖子')
  const authorName=t?.user?.name||t?.user?.username||''
  const authorId=escapeAttr(t?.user?.id||'')
  const updated=escapeHtml(String(t?.updatedAt||t?.updated_at||t?.createdAt||t?.created_at||'').slice(0,10))
  const userHtml=authorId?`<span class="ulink" data-user-id="${authorId}">${escapeHtml(authorName||'Unknown')}</span>`:escapeHtml(authorName||'Unknown')
  const meta=[userHtml,updated].filter(Boolean).join(' · ')
  const floors=Array.isArray(state.view.thread.posts)?state.view.thread.posts:[]
  const floorsLabel=floors.length?`${floors.length} 楼`:''
  const sub=[meta,floorsLabel].filter(Boolean).join(' · ')
  return `<div class="thread-hero-inner"><div class="thread-title">${title}</div>${sub?`<div class="thread-sub">${sub}</div>`:''}</div>`
}

async function loadThreadPosts(ctx,reset){
  const { state, apiGet, endpoints, pickForumPosts, forumPostToCommentLike }=ctx
  const st=state.view.thread
  if(st.loading)return
  st.loading=true
  try{
    const page=reset?0:(st.postsPage+1)
    const data=await apiGet(endpoints.forumThread(state.view.catId,state.view.id),{page,limit:30},{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const posts=pickForumPosts(data)
    const results=posts.map(forumPostToCommentLike)
    st.postsPage=page
    st.hasMore=results.length>0
    st.posts=reset?results:st.posts.concat(results)
  }finally{
    st.loading=false
  }
}

async function sendThreadReply(ctx){
  const { state, doLogin, setStatus, apiPost, endpoints }=ctx
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const input=document.getElementById('threadReplyText')
  const agree=document.getElementById('threadReplyAgree')
  const text=String(input?.value||'').trim()
  if(!agree?.checked){
    setStatus('请先勾选同意规则',true)
    return
  }
  if(!text){
    setStatus('回复不能为空',true)
    return
  }
  try{
    setStatus('sending...',false)
    const data=await apiPost(endpoints.forumThreadReply(state.view.id),{body:text,rulesAgreement:true},null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    if(input)input.value=''
    await loadThreadPosts(ctx,true)
    renderThread(ctx)
    setStatus('sent',false)
  }catch(e){
    setStatus(String(e?.message||e),true)
  }
}

function floorBodyHtml(ctx,s){
  const { escapeHtml }=ctx
  const t=escapeHtml(String(s||''))
  return `<div class="floor-body">${t?t.replace(/\\n/g,'<br>'):'—'}</div>`
}

function floorItemHtml(ctx,x,n){
  const { escapeHtml, escapeAttr }=ctx
  const name=x?.user?.name||x?.user?.username||'User'
  const id=x?.user?.id||''
  const time=escapeHtml(String(x?.createdAt||x?.created_at||x?.updatedAt||x?.updated_at||'').slice(0,10))
  const av=(name&&name[0]?String(name[0]).toUpperCase():'U')
  const avatar=x?.user?.avatar
  const avatarUrl=(() => {
    const aid=avatar?.id
    const aname=avatar?.name
    if(!aid||!aname)return''
    const mime=String(avatar?.mime||'')
    const isAnimated=mime==='image/gif'||mime==='image/webp'||mime==='image/apng'
    const n=String(aname||'')
    const fileName=isAnimated?n:(n.includes('.')?n.replace(/\.[^.]+$/,'.jpg'):`${n}.jpg`)
    if(!fileName)return''
    const base=isAnimated?'original':'avatar'
    return `https://i.iwara.tv/image/${base}/${encodeURIComponent(String(aid))}/${encodeURIComponent(fileName)}`
  })()
  const userHtml=id?`<span class="ulink" data-user-id="${escapeAttr(id)}">${escapeHtml(name)}</span>`:escapeHtml(name)
  const avImg=avatarUrl?`<img class="av-img" src="${escapeAttr(avatarUrl)}" alt="" onerror="this.remove()">`:''
  return `<article class="floor" id="f${n}" data-floor="${n}"><div class="floor-rail"><a class="floor-no" href="#f${n}" title="#${n}">${n}F</a><div class="floor-av">${avImg}${escapeHtml(av)}</div></div><div class="floor-card"><div class="floor-head"><div class="floor-user">${userHtml}</div>${time?`<div class="floor-time">${time}</div>`:''}<a class="floor-tag" href="#f${n}">#${n}</a></div>${floorBodyHtml(ctx,x?.body||x?.content||'')}</div></article>`
}

function threadFloorsHtml(ctx){
  const { state, forumPostToCommentLike }=ctx
  const t=state.view.thread.data
  const items=Array.isArray(state.view.thread.posts)?state.view.thread.posts:[]
  if(items.length){
    return items.map((x,i)=>floorItemHtml(ctx,x,i+1)).join('')
  }
  const body=t?.body||t?.content||''
  if(body){
    return floorItemHtml(ctx,forumPostToCommentLike({user:t?.user||null,body,createdAt:t?.createdAt||t?.created_at||t?.updatedAt||t?.updated_at||''}),1)
  }
  return `<div class="detail-loading">暂无内容</div>`
}

function threadFooterHtml(ctx){
  const { state }=ctx
  const st=state.view.thread
  const canSend=!!state.auth.hasAccess
  const moreHtml=st.hasMore?`<button class="thread-more" id="threadReplyMoreBtn">加载更多楼层</button>`:''
  const compose=`<div class="thread-compose" id="threadCompose"><div class="thread-compose-title">回复</div><textarea class="thread-text" id="threadReplyText" placeholder="${canSend?'写点什么…':'登录后可回复'}"${canSend?'':' disabled'}></textarea><div class="thread-actions"><label class="thread-check"><input type="checkbox" id="threadReplyAgree" checked${canSend?'':' disabled'}>同意规则</label><button class="thread-send" id="threadReplySendBtn">${canSend?'发送':'登录'}</button></div></div>`
  return `${moreHtml}${compose}`
}

function renderThread(ctx){
  const { bindUserLinks }=ctx
  const hero=document.getElementById('threadHero')
  const floors=document.getElementById('threadFloors')
  const footer=document.getElementById('threadFooter')
  if(hero)hero.innerHTML=threadHeroHtml(ctx)
  if(floors)floors.innerHTML=threadFloorsHtml(ctx)
  if(footer)footer.innerHTML=threadFooterHtml(ctx)
  if(hero)bindUserLinks(hero)
  if(floors)bindUserLinks(floors)
  if(footer)bindUserLinks(footer)
}

function bindThreadPageEvents(ctx){
  const content=document.getElementById('content')
  if(!content)return
  if(content._threadEventsDelegated)return
  content._threadEventsDelegated=true
  content.addEventListener('click',async(e)=>{
    const more=e.target?.closest?.('#threadReplyMoreBtn')
    if(more){
      await loadThreadPosts(ctx,false)
      renderThread(ctx)
      return
    }
    const send=e.target?.closest?.('#threadReplySendBtn')
    if(send){
      sendThreadReply(ctx)
    }
  })
}

async function loadThreadView(ctx){
  const { state, apiGet, endpoints, pickThread, pickForumPosts, forumPostToCommentLike, setPageTitle, escapeHtml }=ctx
  state.view.thread={postsPage:0,hasMore:true,loading:false,posts:[],data:null}
  renderThread(ctx)
  try{
    const data=await apiGet(endpoints.forumThread(state.view.catId,state.view.id),{page:0,limit:30},{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const thread=pickThread(data)
    const posts=pickForumPosts(data)
    state.view.thread.data=thread
    setPageTitle(thread?.title||'帖子')
    const mapped=posts.map(forumPostToCommentLike)
    state.view.thread.posts=mapped
    state.view.thread.postsPage=0
    state.view.thread.hasMore=mapped.length>=30
    renderThread(ctx)
    bindThreadPageEvents(ctx)
  }catch(e){
    const hero=document.getElementById('threadHero')
    if(hero)hero.innerHTML=`<div class="thread-hero-inner"><div class="detail-loading">${escapeHtml(String(e?.message||e))}</div></div>`
    const floors=document.getElementById('threadFloors')
    if(floors)floors.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}
