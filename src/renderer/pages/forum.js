import { openDetailShell, setDetailBodyHtml, setDetailTitle, closeDetail } from '../core/detailOverlay.js'

export async function renderForumAppend(ctx,{reset,token}){
  const { state, escapeHtml, pageContainerHtml, sectionHead, forumGroupLabel, renderForumCategories, renderForumList, forumItemHtml, bindForumEvents }=ctx
  const content=document.getElementById('content')
  if(!content)return
  const r=await loadForumPage(ctx)
  if(token!==undefined&&token!==null&&token!==state.navToken)return
  state.hasMore=r.hasMore
  if(r.mode==='cats'){
    const head=sectionHead(`${forumGroupLabel(state.forum.group)}分类`,'','')
    const cats=r.results||[]
    content.innerHTML=pageContainerHtml(`${head}${renderForumCategories(cats)}${forumComposeEntryHtml(ctx)}`)
    bindForumEvents()
    bindForumComposeEntryEvents(ctx,cats)
    return
  }
  const head=`<div class="sh"><div class="sh-t">${escapeHtml(state.forum.categoryLabel||'论坛')}</div><div class="sh-m" id="forumBackBtn">返回分类 ›</div></div>`
  const results=r.results||[]
  if(reset){
    content.innerHTML=pageContainerHtml(`${head}${renderForumList(results)}`)
  }else{
    const list=content.querySelector('.flist')
    if(list)list.insertAdjacentHTML('beforeend',results.map(forumItemHtml).join(''))
    else content.insertAdjacentHTML('beforeend',renderForumList(results))
  }
  bindForumEvents()
}

function forumComposeEntryHtml(){
  return `<div class="forum-compose-entry"><button class="fab-plus" id="forumNewThreadBtn" title="发帖">＋</button></div>`
}

function forumComposerHtml(ctx,cats){
  const { state, escapeHtml, escapeAttr, forumLeafLabel }=ctx
  const picked=String(state.forum.composeCategoryId||'')
  const ids=new Set((Array.isArray(cats)?cats:[]).map((c)=>String(c?.id||'')))
  const fallback=(Array.isArray(cats)&&cats[0]?String(cats[0]?.id||''):'')
  const selected=(picked&&ids.has(picked))?picked:fallback
  if(selected)state.forum.composeCategoryId=selected

  const opts=(Array.isArray(cats)?cats:[]).map((c)=>{
    const id=String(c?.id||'')
    const label=String(forumLeafLabel?forumLeafLabel(id):id)
    return `<option value="${escapeAttr(id)}"${id===selected?' selected':''}>${escapeHtml(label||id)}</option>`
  }).join('')
  const canSend=!!state.auth.hasAccess
  return `<div class="create-page" style="padding:18px 0"><div class="create-title">发布帖子</div><div class="create-sub" style="margin-top:6px">选择分类后发布到论坛</div><div style="margin-top:12px"><select class="detail-select" id="forumPostCategory" style="width:100%;height:36px">${opts}</select></div><div class="search-box" style="margin-top:10px"><span class="sico">T</span><input id="forumPostTitle" placeholder="标题"${canSend?'':' disabled'}></div><div class="search-box" style="margin-top:10px"><span class="sico">✎</span><textarea id="forumPostBody" placeholder="${canSend?'内容':'登录后可发帖'}" style="height:180px;resize:vertical"${canSend?'':' disabled'}></textarea></div><div id="forumPostErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><div style="display:flex;gap:10px"><button class="create-btn" id="forumPostCancelBtn" style="flex:1;background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">取消</button><button class="create-btn" id="forumPostSendBtn" style="flex:1"${canSend?'':' disabled'}>发布</button></div></div>`
}

function bindForumComposeEntryEvents(ctx,cats){
  const { state, doLogin }=ctx
  const btn=document.getElementById('forumNewThreadBtn')
  if(btn&&!btn.__bound){
    btn.__bound=true
    btn.addEventListener('click',async()=>{
      if(!state.auth.hasAccess){
        await doLogin()
        return
      }
      openDetailShell('发帖')
      setDetailTitle('论坛发帖')
      setDetailBodyHtml(forumComposerHtml(ctx,cats))
      bindForumComposerEvents(ctx,cats)
    })
  }
}

function bindForumComposerEvents(ctx,cats){
  const { state, endpoints, apiPost, setStatus, openForumThreadDetail }=ctx
  const errEl=document.getElementById('forumPostErr')
  const catEl=document.getElementById('forumPostCategory')
  const titleEl=document.getElementById('forumPostTitle')
  const bodyEl=document.getElementById('forumPostBody')
  const cancel=document.getElementById('forumPostCancelBtn')
  const send=document.getElementById('forumPostSendBtn')
  const setErr=(m)=>{if(errEl)errEl.textContent=m||''}

  if(catEl&&!catEl.__bound){
    catEl.__bound=true
    catEl.addEventListener('change',()=>{
      state.forum.composeCategoryId=String(catEl.value||'')
    })
  }
  if(cancel&&!cancel.__bound){
    cancel.__bound=true
    cancel.addEventListener('click',()=>closeDetail())
  }
  if(send&&!send.__bound){
    send.__bound=true
    send.addEventListener('click',async()=>{
      setErr('')
      if(!state.auth.hasAccess){
        setErr('请先登录')
        return
      }
      const catId=String(catEl?.value||state.forum.composeCategoryId||'').trim()
      const title=String(titleEl?.value||'').trim()
      const body=String(bodyEl?.value||'').trim()
      if(!catId){
        setErr('请选择分类')
        return
      }
      if(!title||!body){
        setErr('请填写标题和内容')
        return
      }
      try{
        send.disabled=true
        const data=await apiPost(endpoints.forumCategoryThreads(catId),{title,body},null,{skipAuthWait:true})
        if(data?.error)throw new Error(data.message||'request failed')
        const threadId=String(data?.id||data?._id||data?.threadId||data?.thread_id||'')
        setStatus('已发布',false)
        closeDetail()
        if(threadId){
          openForumThreadDetail(catId,threadId)
        }else{
          await loadForumCategories(ctx).catch(()=>{})
        }
      }catch(e){
        setErr(String(e?.message||e))
      }finally{
        send.disabled=false
      }
    })
  }
}

async function loadForumCategories(ctx){
  const { state, apiGet, endpoints }=ctx
  if(Array.isArray(state.forum.cats))return state.forum.cats
  const data=await apiGet(endpoints.forumRoot(),null,{skipAuthWait:true})
  if(data?.error)throw new Error(data.message||'request failed')
  state.forum.cats=Array.isArray(data)?data:[]
  return state.forum.cats
}

async function loadForumPage(ctx){
  const { state, apiGet, endpoints, pickResults }=ctx
  if(state.forum.view==='cats'){
    const cats=await loadForumCategories(ctx)
    const group=state.forum.group||'global'
    const results=cats.filter(c=>String(c?.group||'')===group)
    return{mode:'cats',results,hasMore:false}
  }
  const page=state.paging.forum||0
  const query={page,limit:30}
  const cid=String(state.forum.categoryId||'')
  const endpoint=cid?endpoints.forumCategoryThreads(cid):endpoints.forumThreadsList()
  const data=await apiGet(endpoint,query,{skipAuthWait:true})
  if(data?.error)throw new Error(data.message||'request failed')
  const results=Array.isArray(data?.threads)?data.threads:pickResults(data)
  return{mode:'threads',results,hasMore:Array.isArray(results)&&results.length>0}
}
