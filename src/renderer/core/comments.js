import { state } from './state.js'
import { setDetailRightHtml } from './detailOverlay.js'

function commentLikeUser(u){
  const name=u?.name||u?.username||'User'
  const id=u?.id||''
  const av=(name&&name[0]?String(name[0]).toUpperCase():'U')
  const avatar=u?.avatar
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
  return {id,name,av,avatarUrl}
}

function commentLikeTime(x){
  return String(x?.createdAt||x?.created_at||x?.updatedAt||x?.updated_at||'').slice(0,10)
}

function commentLikeBody(x){
  return String(x?.body||x?.content||'')
}

export function commentItemHtml(ctx,x){
  const { escapeHtml, escapeAttr }=ctx
  const u=commentLikeUser(x?.user)
  const time=escapeHtml(commentLikeTime(x))
  const body=escapeHtml(commentLikeBody(x))
  const userHtml=u.id?`<span class="ulink" data-user-id="${escapeAttr(u.id)}">${escapeHtml(u.name)}</span>`:escapeHtml(u.name)
  const avImg=u.avatarUrl?`<img class="av-img" src="${escapeAttr(u.avatarUrl)}" alt="" onerror="this.remove()">`:''
  return `<div class="cmt-item"><div class="cmt-av">${avImg}${escapeHtml(u.av)}</div><div class="cmt-main"><div class="cmt-head"><div class="cmt-user">${userHtml}</div>${time?`<div class="cmt-time">${time}</div>`:''}</div><div class="cmt-body">${body?body.replace(/\\n/g,'<br>'):'—'}</div></div></div>`
}

function detailCommentsPanelHtml(ctx,title){
  const st=state.detail.comments
  const items=Array.isArray(st.items)?st.items:[]
  const listHtml=items.length?`<div class="cmt-list">${items.map((x)=>commentItemHtml(ctx,x)).join('')}</div>`:`<div class="detail-loading">暂无评论</div>`
  const moreHtml=st.hasMore?`<button class="cmt-more" id="detailCmtMoreBtn">加载更多</button>`:''
  const canSend=!!state.auth.hasAccess
  const compose=`<div class="cmt-compose"><div class="detail-section-title">${ctx.escapeHtml(title||'评论')}</div><textarea class="cmt-text" id="detailCmtText" placeholder="${canSend?'写点什么…':'登录后可发表评论'}"${canSend?'':' disabled'}></textarea><div class="cmt-actions"><label class="cmt-check"><input type="checkbox" id="detailCmtAgree" checked${canSend?'':' disabled'}>同意规则</label><button class="cmt-btn primary" id="detailCmtSendBtn">${canSend?'发送':'登录'}</button></div></div>`
  return `${listHtml}${moreHtml}${compose}`
}

async function loadDetailComments(ctx,reset){
  if(!state.detail.open)return
  const st=state.detail.comments
  if(st.loading)return
  st.loading=true
  try{
    const page=reset?0:(st.page+1)
    const data=await ctx.apiGet(ctx.endpoints.comments(st.type,st.id),{page,limit:20},{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const results=ctx.pickResults(data)
    st.page=page
    st.hasMore=results.length>0
    st.items=reset?results:st.items.concat(results)
  }finally{
    st.loading=false
  }
}

async function sendDetailComment(ctx){
  const st=state.detail.comments
  if(!state.auth.hasAccess){
    await ctx.doLogin()
    return
  }
  const input=document.getElementById('detailCmtText')
  const agree=document.getElementById('detailCmtAgree')
  const text=String(input?.value||'').trim()
  if(!agree?.checked){
    ctx.setStatus('请先勾选同意规则',true)
    return
  }
  if(!text){
    ctx.setStatus('评论不能为空',true)
    return
  }
  try{
    ctx.setStatus('sending...',false)
    const data=await ctx.apiPost(ctx.endpoints.comments(st.type,st.id),{body:text,rulesAgreement:true},null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    if(input)input.value=''
    await loadDetailComments(ctx,true)
    renderDetailCommentsPanel(ctx)
    ctx.setStatus('sent',false)
  }catch(e){
    ctx.setStatus(String(e?.message||e),true)
  }
}

function bindDetailCommentsPanelEvents(ctx){
  const panel=document.getElementById('detailRight')
  if(!panel)return
  if(panel._detailCommentsDelegated)return
  panel._detailCommentsDelegated=true
  panel.addEventListener('click',async(e)=>{
    const more=e.target?.closest?.('#detailCmtMoreBtn')
    if(more){
      await loadDetailComments(ctx,false)
      renderDetailCommentsPanel(ctx)
      return
    }
    const send=e.target?.closest?.('#detailCmtSendBtn')
    if(send){
      sendDetailComment(ctx)
    }
  })
}

function renderDetailCommentsPanel(ctx){
  setDetailRightHtml(detailCommentsPanelHtml(ctx,'发表评论'))
  bindDetailCommentsPanelEvents(ctx)
  ctx.bindUserLinks(document.getElementById('detailRight'))
}

export async function openDetailComments(ctx,type,id){
  state.detail.comments={type:String(type||''),id:String(id||''),page:0,hasMore:true,loading:false,items:[]}
  setDetailRightHtml(`<div class="detail-loading">加载评论…</div>`)
  try{
    await loadDetailComments(ctx,true)
    renderDetailCommentsPanel(ctx)
  }catch(e){
    setDetailRightHtml(`<div class="detail-loading">${ctx.escapeHtml(String(e?.message||e))}</div>`)
  }
  ctx.bindUserLinks(document.getElementById('detailOverlay'))
}

export function forumPostToCommentLike(p){
  return {user:p?.user||null,body:p?.body||p?.content||'',createdAt:p?.createdAt||p?.created_at||p?.updatedAt||p?.updated_at||''}
}

function detailForumPanelHtml(ctx){
  const st=state.detail.comments
  const items=Array.isArray(st.items)?st.items:[]
  const listHtml=items.length?`<div class="cmt-list">${items.map((x)=>commentItemHtml(ctx,x)).join('')}</div>`:`<div class="detail-loading">暂无回复</div>`
  const moreHtml=st.hasMore?`<button class="cmt-more" id="detailForumMoreBtn">加载更多</button>`:''
  const canSend=!!state.auth.hasAccess
  const compose=`<div class="cmt-compose"><div class="detail-section-title">回复帖子</div><textarea class="cmt-text" id="detailForumText" placeholder="${canSend?'写点什么…':'登录后可回复'}"${canSend?'':' disabled'}></textarea><div class="cmt-actions"><label class="cmt-check"><input type="checkbox" id="detailForumAgree" checked${canSend?'':' disabled'}>同意规则</label><button class="cmt-btn primary" id="detailForumSendBtn">${canSend?'发送':'登录'}</button></div></div>`
  return `${listHtml}${moreHtml}${compose}`
}

async function loadForumPosts(ctx,reset){
  if(!state.detail.open)return
  const st=state.detail.comments
  if(st.loading)return
  st.loading=true
  try{
    const page=reset?0:(st.page+1)
    const data=await ctx.apiGet(ctx.endpoints.forumThread(state.detail.catId,state.detail.id),{page,limit:30},{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const posts=ctx.pickForumPosts(data)
    const results=posts.map(forumPostToCommentLike)
    st.page=page
    st.hasMore=results.length>0
    st.items=reset?results:st.items.concat(results)
  }finally{
    st.loading=false
  }
}

async function sendForumReply(ctx){
  if(!state.auth.hasAccess){
    await ctx.doLogin()
    return
  }
  const input=document.getElementById('detailForumText')
  const agree=document.getElementById('detailForumAgree')
  const text=String(input?.value||'').trim()
  if(!agree?.checked){
    ctx.setStatus('请先勾选同意规则',true)
    return
  }
  if(!text){
    ctx.setStatus('回复不能为空',true)
    return
  }
  try{
    ctx.setStatus('sending...',false)
    const data=await ctx.apiPost(ctx.endpoints.forumThreadReply(state.detail.id),{body:text,rulesAgreement:true},null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    if(input)input.value=''
    await loadForumPosts(ctx,true)
    renderDetailForumPanel(ctx)
    ctx.setStatus('sent',false)
  }catch(e){
    ctx.setStatus(String(e?.message||e),true)
  }
}

function bindDetailForumPanelEvents(ctx){
  const panel=document.getElementById('detailRight')
  if(!panel)return
  if(panel._detailForumDelegated)return
  panel._detailForumDelegated=true
  panel.addEventListener('click',async(e)=>{
    const more=e.target?.closest?.('#detailForumMoreBtn')
    if(more){
      await loadForumPosts(ctx,false)
      renderDetailForumPanel(ctx)
      return
    }
    const send=e.target?.closest?.('#detailForumSendBtn')
    if(send){
      sendForumReply(ctx)
    }
  })
}

function renderDetailForumPanel(ctx){
  setDetailRightHtml(detailForumPanelHtml(ctx))
  bindDetailForumPanelEvents(ctx)
  ctx.bindUserLinks(document.getElementById('detailRight'))
}

export async function openDetailForumPosts(ctx,catId,threadId,initialPosts){
  state.detail.catId=String(catId||'')
  state.detail.id=String(threadId||'')
  const mapped=(Array.isArray(initialPosts)?initialPosts:[]).map(forumPostToCommentLike)
  state.detail.comments={type:'forum',id:state.detail.id,page:0,hasMore:mapped.length>=30,loading:false,items:mapped}
  renderDetailForumPanel(ctx)
  ctx.bindUserLinks(document.getElementById('detailOverlay'))
}

export function viewCommentsPanelHtml(ctx,st,title,prefix){
  const items=Array.isArray(st.items)?st.items:[]
  const listHtml=items.length?`<div class="cmt-list">${items.map((x)=>commentItemHtml(ctx,x)).join('')}</div>`:`<div class="detail-loading">暂无评论</div>`
  const moreHtml=st.hasMore?`<button class="cmt-more" id="${ctx.escapeAttr(prefix)}CmtMoreBtn">加载更多</button>`:''
  const canSend=!!state.auth.hasAccess
  const compose=`<div class="cmt-compose"><div class="detail-section-title">${ctx.escapeHtml(title||'评论')}</div><textarea class="cmt-text" id="${ctx.escapeAttr(prefix)}CmtText" placeholder="${canSend?'写点什么…':'登录后可发表评论'}"${canSend?'':' disabled'}></textarea><div class="cmt-actions"><label class="cmt-check"><input type="checkbox" id="${ctx.escapeAttr(prefix)}CmtAgree" checked${canSend?'':' disabled'}>同意规则</label><button class="cmt-btn primary" id="${ctx.escapeAttr(prefix)}CmtSendBtn">${canSend?'发送':'登录'}</button></div></div>`
  return `${listHtml}${moreHtml}${compose}`
}

export async function loadViewComments(ctx,st,reset){
  if(st.loading)return
  st.loading=true
  try{
    const page=reset?0:(st.page+1)
    let data=await ctx.apiGet(ctx.endpoints.comments(st.type,st.id),{page,limit:20},{skipAuthWait:true})
    if(data?.error){
      const msg=String(data?.message||'')
      const isNotFound=data?.status===404||msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound')
      if(isNotFound&&st?.altType&&st?.altId&&!st._altTried){
        st._altTried=true
        st.type=String(st.altType||st.type||'')
        st.id=String(st.altId||st.id||'')
        data=await ctx.apiGet(ctx.endpoints.comments(st.type,st.id),{page,limit:20},{skipAuthWait:true})
      }
    }
    if(data?.error){
      const msg=String(data?.message||'')
      const isNotFound=data?.status===404||msg.includes('errors.notFound')||msg.toLowerCase().includes('notfound')
      if(isNotFound){
        st.page=page
        st.hasMore=false
        if(reset)st.items=[]
        return
      }
      throw new Error(data.message||'request failed')
    }
    const results=ctx.pickResults(data)
    st.page=page
    st.hasMore=results.length>0
    st.items=reset?results:st.items.concat(results)
  }finally{
    st.loading=false
  }
}

async function sendViewComment(ctx,st,prefix,onAfter){
  if(!state.auth.hasAccess){
    await ctx.doLogin()
    return
  }
  const input=document.getElementById(`${prefix}CmtText`)
  const agree=document.getElementById(`${prefix}CmtAgree`)
  const text=String(input?.value||'').trim()
  if(!agree?.checked){
    ctx.setStatus('请先勾选同意规则',true)
    return
  }
  if(!text){
    ctx.setStatus('评论不能为空',true)
    return
  }
  try{
    ctx.setStatus('sending...',false)
    const data=await ctx.apiPost(ctx.endpoints.comments(st.type,st.id),{body:text,rulesAgreement:true},null,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    if(input)input.value=''
    await loadViewComments(ctx,st,true)
    if(typeof onAfter==='function')onAfter()
    ctx.setStatus('sent',false)
  }catch(e){
    ctx.setStatus(String(e?.message||e),true)
  }
}

export function bindViewCommentsPanelEvents(ctx,st,prefix,onRender){
  const panel=document.getElementById('content')
  if(!panel)return
  const key=`_viewComments_${prefix}_delegated`
  if(panel[key])return
  panel[key]=true
  panel.addEventListener('click',async(e)=>{
    const more=e.target?.closest?.(`#${prefix}CmtMoreBtn`)
    if(more){
      await loadViewComments(ctx,st,false)
      if(typeof onRender==='function')onRender()
      return
    }
    const send=e.target?.closest?.(`#${prefix}CmtSendBtn`)
    if(send){
      sendViewComment(ctx,st,prefix,onRender)
    }
  })
}
