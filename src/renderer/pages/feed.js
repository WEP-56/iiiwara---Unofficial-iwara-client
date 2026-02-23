export async function renderFeedAppend(ctx,{reset,token}){
  const { state, escapeHtml, pageContainerHtml, renderVideosGrid, renderImagesMasonry, bindCardEvents, videoCardHtml, imageCardHtml }=ctx
  const content=document.getElementById('content')
  if(!content)return
  if(state.page==='home'||state.page==='video'){
    const kind=state.page
    const {results,hasMore,emptyHint}=await loadVideosPage(ctx,kind)
    if(token!==undefined&&token!==null&&token!==state.navToken)return
    state.hasMore=hasMore
    if(reset){
      content.innerHTML=pageContainerHtml(`${results.length?renderVideosGrid(results):`<div class="create-page" style="padding:30px 0"><div class="create-icon" style="font-size:28px">○</div><div class="create-sub">${escapeHtml(emptyHint||'暂无内容')}</div></div>`}`)
    }else{
      const grid=content.querySelector('.vgrid')
      if(grid)grid.insertAdjacentHTML('beforeend',results.map(videoCardHtml).join(''))
      else if(results.length)content.insertAdjacentHTML('beforeend',renderVideosGrid(results))
    }
    bindCardEvents()
    return
  }
  if(state.page==='image'){
    const {results,hasMore}=await loadImagesPage(ctx)
    if(token!==undefined&&token!==null&&token!==state.navToken)return
    state.hasMore=hasMore
    if(reset){
      content.innerHTML=pageContainerHtml(`${renderImagesMasonry(results)}`)
    }else{
      const masonry=content.querySelector('.imasonry')
      if(masonry)masonry.insertAdjacentHTML('beforeend',results.map(imageCardHtml).join(''))
      else content.insertAdjacentHTML('beforeend',renderImagesMasonry(results))
    }
    bindCardEvents()
  }
}

function pageSortFor(chip){if(chip==='最新')return'date';if(chip==='热门')return'popularity';if(chip==='趋势')return'trending';return'trending'}

async function resolveTagIdsByName(ctx,name){
  const { state, apiGet, endpoints, pickResults }=ctx
  const key=String(name||'').trim().toLowerCase()
  if(!key)return[]
  if(state.tagCache[key])return state.tagCache[key]
  try{
    const data=await apiGet(endpoints.tags(),{filter:name,page:0,limit:10},{skipAuthWait:true})
    const results=pickResults(data)
    const ids=results.map(t=>t?.id).filter(Boolean)
    state.tagCache[key]=ids
    return ids
  }catch{
    state.tagCache[key]=[]
    return[]
  }
}

async function loadVideosPage(ctx,kind){
  const { state, getRatingQuery, apiGet, endpoints, pickResults }=ctx
  const chip=state.chip[kind]||(kind==='home'?'推荐':'热门')
  const rating=getRatingQuery()
  const page=state.paging[kind]||0
  const query={page,limit:32}
  if(kind==='home'){
    const sort=pageSortFor(chip)
    query.sort=sort
    if(chip==='关注动态'){
      if(!state.auth.hasAccess)return{results:[],hasMore:false,emptyHint:'登录后可查看关注动态'}
      query.subscribed='true'
    }
    if(rating)query.rating=rating
    const data=await apiGet(endpoints.videos(),query,{skipAuthWait:true})
    if(data?.error)throw new Error(data.message||'request failed')
    const results=pickResults(data)
    return{results,hasMore:results.length>0,emptyHint:results.length>0?null:'暂无内容'}
  }
  const sort=pageSortFor(chip==='全部'?'热门':chip)
  query.sort=sort
  if(rating)query.rating=rating
  if(!['热门','最新','趋势','全部'].includes(chip)){
    const ids=await resolveTagIdsByName(ctx,chip)
    if(ids.length)query.tags=ids.join(',')
  }
  const data=await apiGet(endpoints.videos(),query,{skipAuthWait:true})
  if(data?.error)throw new Error(data.message||'request failed')
  const results=pickResults(data)
  return{results,hasMore:results.length>0,emptyHint:results.length>0?null:'暂无内容'}
}

async function loadImagesPage(ctx){
  const { state, getRatingQuery, apiGet, endpoints, pickResults }=ctx
  const chip=state.chip.image||'全部'
  const rating=getRatingQuery()
  const page=state.paging.image||0
  const query={page,limit:32,sort:'trending'}
  if(chip==='全部'){}
  if(rating)query.rating=rating
  const data=await apiGet(endpoints.images(),query,{skipAuthWait:true})
  if(data?.error)throw new Error(data.message||'request failed')
  const results=pickResults(data)
  return{results,hasMore:results.length>0}
}
