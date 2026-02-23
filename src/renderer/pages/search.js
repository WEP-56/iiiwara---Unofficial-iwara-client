export async function renderSearchPage(ctx){
  const content=document.getElementById('content')
  if(!content)return
  content.innerHTML=searchPageHtml(ctx)
  bindSearchEvents(ctx)
}

function searchPageHtml(ctx){
  const { state, escapeAttr, pageContainerHtml }=ctx
  const tags=['MMD','3D CG','Genshin','Vocaloid','Original','Anime','Fantasy','Game']
  const types=[['videos','视频'],['images','图片'],['users','作者'],['forum_threads','论坛']]
  return pageContainerHtml(`<div class="search-page"><div class="search-title">搜索</div><div class="search-sub">支持视频 / 图片 / 作者 / 论坛</div><div class="filterbar" style="margin-top:12px">${types.map(([t,l])=>`<div class="chip${state.search.type===t?' active':''}" data-stype="${t}">${l}</div>`).join('')}<div class="fb-sep"></div></div><div class="search-box" style="margin-top:12px"><span class="sico">◌</span><input id="searchInput" placeholder="输入关键词…" value="${escapeAttr(state.search.q||'')}"></div><div class="tag-cloud">${tags.map(t=>`<div class="tag" data-tag="${t}">${t}</div>`).join('')}</div><div id="searchResults" style="margin-top:14px"></div></div>`)
}

function bindSearchEvents(ctx){
  const { state }=ctx
  const input=document.getElementById('searchInput')
  const content=document.getElementById('content')
  const resultsHost=document.getElementById('searchResults')
  if(!content||!resultsHost)return
  if(input&&!input.__bound){
    input.__bound=true
    input.addEventListener('keydown',(e)=>{
      if(e.key==='Enter')runSearch(ctx,input.value)
    })
  }
  content.querySelectorAll('.chip[data-stype]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',async()=>{
      const t=el.getAttribute('data-stype')
      if(!t)return
      state.search.type=t
      content.querySelectorAll('.chip[data-stype]').forEach(c=>c.classList.toggle('active',c===el))
      if(state.search.q)await runSearch(ctx,state.search.q)
    })
  })
  content.querySelectorAll('.tag[data-tag]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',()=>{
      const t=el.getAttribute('data-tag')||''
      if(input)input.value=t
      runSearch(ctx,t)
    })
  })
}

async function runSearch(ctx,q){
  const { state, apiGet, endpoints, pickResults, setLoading, setStatus, sectionHead, getRatingQuery, renderVideosGrid, renderImagesMasonry, renderUserList, renderForumList, bindCardEvents, bindForumEvents, bindUserLinks }=ctx
  const resultsHost=document.getElementById('searchResults')
  const content=document.getElementById('content')
  if(!resultsHost||!content)return
  const keyword=String(q||'').trim()
  state.search.q=keyword
  if(!keyword){
    resultsHost.innerHTML=''
    return
  }
  const renderByType=(type,items)=>{
    if(type==='videos')return renderVideosGrid(items)
    if(type==='images')return renderImagesMasonry(items)
    if(type==='users')return renderUserList(items)
    if(type==='forum_threads')return renderForumList(items)
    return''
  }
  setLoading(true)
  try{
    const type=state.search.type||'videos'
    const rating=getRatingQuery()
    const query={query:keyword,limit:32,page:0,type}
    if((type==='videos'||type==='images')&&rating)query.rating=rating
    const data=await apiGet(endpoints.search(),query,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const items=pickResults(data)
    resultsHost.innerHTML=`${sectionHead('搜索结果',items.length?String(items.length):'','')}${items.length?renderByType(type,items):`<div class="create-page" style="padding:18px 0"><div class="create-icon" style="font-size:24px">○</div><div class="create-sub">暂无结果</div></div>`}`
    bindCardEvents()
    bindForumEvents()
    bindUserLinks(content)
  }catch(e){
    resultsHost.innerHTML=''
    setStatus(String(e?.message||e),true)
  }finally{
    setLoading(false)
  }
}
