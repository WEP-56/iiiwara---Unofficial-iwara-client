export async function renderUserPage(ctx){
  const content=document.getElementById('content')
  if(!content)return
  content.innerHTML=userPageShellHtml(ctx)
  bindUserPageEvents(ctx)
  await loadUserView(ctx)
}

function userPageShellHtml(ctx){
  const { state }=ctx
  const active=state.view.tab||'detail'
  const collapsed=!!state.view.sideCollapsed
  const tog=collapsed?'‹':'›'
  return `<div class="watch-page user"><div class="watch-layout"><div class="watch-left" id="userLeft"></div><div class="watch-right${collapsed?' collapsed':''}"><div class="watch-tabs"><div class="watch-tab${active==='detail'?' active':''}" data-utab="detail">详情</div><div class="watch-tab${active==='comments'?' active':''}" data-utab="comments">评论</div><div class="watch-side-toggle" id="sideToggleBtn" title="隐藏/展开">${tog}</div></div><div class="watch-panel" id="userPanel"></div></div></div></div>`
}

function userDetailPanelHtml(ctx){
  const { state, escapeHtml, userTitleText, userUsernameText, userAboutText }=ctx
  const u=state.view.user.data
  if(!u)return `<div class="detail-loading">加载中…</div>`
  const name=escapeHtml(userTitleText(u))
  const uname=escapeHtml(userUsernameText(u))
  const about=escapeHtml(userAboutText(u))
  const created=escapeHtml(String(u?.createdAt||u?.created_at||'').slice(0,10))
  const meta=[name,uname,created].filter(Boolean).join(' · ')
  return `${meta?`<div class="detail-meta"><div class="detail-sub">${meta}</div></div>`:''}${about?`<div class="detail-desc">${about.replace(/\\n/g,'<br>')}</div>`:''}`
}

function renderUserLeft(ctx){
  const { state, escapeHtml, userTitleText, bindUserLinks }=ctx
  const host=document.getElementById('userLeft')
  if(!host)return
  const u=state.view.user.data
  const tab=state.view.user.tab||'videos'
  const title=u?escapeHtml(userTitleText(u)):'用户'
  const following=!!u?.following
  const followHtml=(u?.id?`<div class="detail-actions" style="margin-left:auto"><div class="detail-btn" id="userFollowBtn" title="${following?'取消订阅':'订阅'}">${following?'✓':'+'}</div></div>`:'')
  const tabs=[['videos','视频'],['images','图片']]
  host.innerHTML=`<div class="pg" style="padding:16px"><div class="sh"><div class="sh-t">${title}</div>${followHtml}</div><div class="detail-tabs" id="userMediaTabs">${tabs.map(([k,l])=>`<div class="detail-tab${k===tab?' active':''}" data-umtab="${k}">${l}</div>`).join('')}</div><div id="userMediaBody"></div></div>`
  renderUserMedia(ctx)
  bindUserMediaEvents(ctx)
  bindUserLinks(host)
}

function renderUserMedia(ctx){
  const { state, renderImagesMasonry, renderVideosGrid, bindCardEvents }=ctx
  const body=document.getElementById('userMediaBody')
  if(!body)return
  const tab=state.view.user.tab||'videos'
  const items=tab==='images'?state.view.user.images:state.view.user.videos
  const hasMore=tab==='images'?state.view.user.imagesHasMore:state.view.user.videosHasMore
  const listHtml=tab==='images'?(items.length?renderImagesMasonry(items):`<div class="detail-loading">暂无图片</div>`):(items.length?renderVideosGrid(items):`<div class="detail-loading">暂无视频</div>`)
  const moreHtml=hasMore?`<button class="cmt-more" id="userMediaMoreBtn">加载更多</button>`:''
  body.innerHTML=`${listHtml}${moreHtml}`
  bindCardEvents(document.getElementById('userLeft'))
}

async function loadUserMedia(ctx,reset){
  const { state, getRatingQuery, apiGet, endpoints, pickResults }=ctx
  const st=state.view.user
  if(st.loading)return
  st.loading=true
  try{
    const rating=getRatingQuery()
    const primaryUserKey=String(st.id||state.view.id||'')
    const usernameKey=String(st.username||'')
    if(st.tab==='videos'){
      const page=reset?0:(st.videosPage+1)
      const query={user:primaryUserKey,page,limit:32,sort:'date'}
      if(rating)query.rating=rating
      let data=await apiGet(endpoints.videos(),query,{skipAuthWait:true})
      if(data?.error){
        const msg=String(data?.message||'')
        if(usernameKey&&usernameKey!==primaryUserKey&&(data?.status===404||msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound'))){
          const retry=await apiGet(endpoints.videos(),{...query,user:usernameKey},{skipAuthWait:true})
          if(retry?.error)throw new Error(retry.message||data.message||'request failed')
          data=retry
        }else{
          throw new Error(data.message||'request failed')
        }
      }
      const results=pickResults(data)
      st.videosPage=page
      st.videosHasMore=results.length>0
      st.videos=reset?results:st.videos.concat(results)
      return
    }
    if(st.tab==='images'){
      const page=reset?0:(st.imagesPage+1)
      const query={user:primaryUserKey,page,limit:32,sort:'date'}
      if(rating)query.rating=rating
      let data=await apiGet(endpoints.images(),query,{skipAuthWait:true})
      if(data?.error){
        const msg=String(data?.message||'')
        if(usernameKey&&usernameKey!==primaryUserKey&&(data?.status===404||msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound'))){
          const retry=await apiGet(endpoints.images(),{...query,user:usernameKey},{skipAuthWait:true})
          if(retry?.error)throw new Error(retry.message||data.message||'request failed')
          data=retry
        }else{
          throw new Error(data.message||'request failed')
        }
      }
      const results=pickResults(data)
      st.imagesPage=page
      st.imagesHasMore=results.length>0
      st.images=reset?results:st.images.concat(results)
      return
    }
  }finally{
    st.loading=false
  }
}

function bindUserMediaEvents(ctx){
  const { state }=ctx
  const host=document.getElementById('userLeft')
  if(!host)return
  host.querySelectorAll('[data-umtab]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const tab=el.getAttribute('data-umtab')||'videos'
      if(tab===state.view.user.tab)return
      state.view.user.tab=tab
      host.querySelectorAll('[data-umtab]').forEach((x)=>x.classList.toggle('active',x===el))
      await loadUserMedia(ctx,true)
      renderUserMedia(ctx)
    })
  })
  const more=document.getElementById('userMediaMoreBtn')
  if(more&&!more.__bound){
    more.__bound=true
    more.addEventListener('click',async()=>{
      await loadUserMedia(ctx,false)
      renderUserMedia(ctx)
    })
  }
  const follow=document.getElementById('userFollowBtn')
  if(follow&&!follow.__bound){
    follow.__bound=true
    follow.addEventListener('click',(e)=>{
      e.stopPropagation()
      toggleUserFollow(ctx)
    })
  }
}

async function toggleUserFollow(ctx){
  const { state, apiPost, apiDelete, endpoints, setStatus, doLogin }=ctx
  const u=state.view.user.data
  const userId=String(u?.id||state.view.user.id||'')
  if(!u||!userId)return
  if(!state.auth.hasAccess){
    await doLogin()
    return
  }
  const wasFollowing=!!u.following
  const nextFollowing=!wasFollowing
  u.following=nextFollowing
  const btn=document.getElementById('userFollowBtn')
  if(btn){
    btn.textContent=nextFollowing?'✓':'+'
    btn.title=nextFollowing?'取消订阅':'订阅'
  }
  try{
    const ep=endpoints.userFollowOrUnfollow(userId)
    const res=nextFollowing?await apiPost(ep,null,null,{skipAuthWait:true,silent:true}):await apiDelete(ep,null,{skipAuthWait:true,silent:true})
    if(res?.error)throw new Error(res.message||'request failed')
    setStatus(nextFollowing?'followed':'unfollowed',false)
  }catch(e){
    u.following=wasFollowing
    if(btn){
      btn.textContent=wasFollowing?'✓':'+'
      btn.title=wasFollowing?'取消订阅':'订阅'
    }
    setStatus(String(e?.message||e),true)
  }
}

function renderUserPanel(ctx){
  const { state, viewCommentsPanelHtml, bindViewCommentsPanelEvents, loadViewComments, bindUserLinks }=ctx
  const panel=document.getElementById('userPanel')
  if(!panel)return
  if(state.view.tab==='comments'){
    const st=state.view.comments
    panel.innerHTML=viewCommentsPanelHtml(st,'发表评论','user')
    bindViewCommentsPanelEvents(st,'user',()=>renderUserPanel(ctx))
    bindUserLinks(panel)
    return
  }
  panel.innerHTML=userDetailPanelHtml(ctx)
  bindUserLinks(panel)
}

function bindUserPageEvents(ctx){
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
  document.querySelectorAll('[data-utab]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const tab=el.getAttribute('data-utab')||'detail'
      state.view.tab=tab
      document.querySelectorAll('[data-utab]').forEach((x)=>x.classList.toggle('active',x===el))
      if(tab==='comments'){
        const st=state.view.comments
        const items=Array.isArray(st?.items)?st.items:[]
        if(st?.type&&st?.id&&items.length===0)await loadViewComments(st,true)
      }
      renderUserPanel(ctx)
    })
  })
}

async function loadUserView(ctx){
  const { state, apiGet, endpoints, pickUser, escapeHtml, setPageTitle, userTitleText }=ctx
  const raw=String(state.view.id||'')
  state.view.user={id:'',username:'',tab:'videos',videosPage:0,imagesPage:0,videosHasMore:true,imagesHasMore:true,loading:false,videos:[],images:[],data:null}
  state.view.comments={type:'profile',id:raw,page:0,hasMore:true,loading:false,items:[]}
  renderUserLeft(ctx)
  renderUserPanel(ctx)
  try{
    let data=await apiGet(endpoints.userById(raw),null,{skipAuthWait:true,silent:true})
    let u=null
    let username=''
    if(data?.error){
      const msg=String(data?.message||'')
      if(data?.status===404||msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound')){
        const profileDirect=await apiGet(endpoints.profileByName(raw),null,{skipAuthWait:true,silent:true})
        if(!profileDirect?.error){
          u=pickUser(profileDirect)
          username=raw
        }else{
          const light=await apiGet(endpoints.lightProfileById(raw),null,{skipAuthWait:true,silent:true})
          if(!light?.error){
            username=String(light?.username||light?.user?.username||light?.data?.username||'').trim()
          }
          if(!username){
            const auto=await apiGet(endpoints.autocompleteUsers(),{id:raw},{skipAuthWait:true,silent:true})
            const items=auto?.results||auto?.data?.results||auto?.data||auto
            const first=Array.isArray(items)&&items.length?items[0]:null
            const autoUser=first?.user||first
            const autoId=String(autoUser?.id||'').trim()
            const autoUsername=String(autoUser?.username||'').trim()
            if(autoId&&autoId!==raw){
              const byId=await apiGet(endpoints.userById(autoId),null,{skipAuthWait:true,silent:true})
              if(!byId?.error){
                u=pickUser(byId)
                username=String(u?.username||'').trim()||autoUsername
              }
            }
            if(!u&&autoUsername){
              const byName=await apiGet(endpoints.profileByName(autoUsername),null,{skipAuthWait:true,silent:true})
              if(!byName?.error){
                u=pickUser(byName)
                username=autoUsername
              }
            }
          }
          if(!u&&username){
            const profile=await apiGet(endpoints.profileByName(username),null,{skipAuthWait:true,silent:true})
            if(profile?.error)throw new Error(profile.message||light?.message||data.message||'request failed')
            u=pickUser(profile)
          }
          if(!u)throw new Error(light?.message||data.message||'errors.notFound')
        }
      }else{
        throw new Error(data.message||'request failed')
      }
    }else{
      u=pickUser(data)
      username=String(u?.username||'').trim()
    }
    const resolvedId=String(u?.id||'').trim()
    if(resolvedId)state.view.user.id=resolvedId
    if(username){
      state.view.user.username=username
    }
    if(resolvedId){
      const cst=state.view.comments
      cst.type='profile'
      cst.id=resolvedId
      cst.page=0
      cst.hasMore=true
      cst.items=[]
      cst._altTried=false
      if(state.view.tab==='comments')await ctx.loadViewComments(cst,true)
    }
    state.view.user.data=u
    setPageTitle(userTitleText(u))
    await loadUserMedia(ctx,true)
    renderUserLeft(ctx)
    renderUserPanel(ctx)
  }catch(e){
    let msg=String(e?.message||e)
    if(msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound'))msg='用户不存在或已删除'
    const host=document.getElementById('userLeft')
    if(host)host.innerHTML=`<div class="pg" style="padding:16px"><div class="detail-loading">${escapeHtml(msg)}</div></div>`
    const panel=document.getElementById('userPanel')
    if(panel)panel.innerHTML=`<div class="detail-loading">${escapeHtml(msg)}</div>`
  }
}
