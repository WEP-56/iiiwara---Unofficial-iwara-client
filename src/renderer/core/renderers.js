export function sectionHead(title,count,more){
  return `<div class="sh"><div class="sh-t">${title}</div>${count?`<div class="sh-c">${count}</div>`:''}${more?`<div class="sh-more" data-more="${more}">${more} ›</div>`:''}</div>`
}

export function pageContainerHtml(inner){
  return `<div class="page-container">${inner}</div>`
}

export function videoThumbnailUrl(ctx,v){
  if(!v)return''
  const embed=v.embedUrl||v.embed_url
  if(embed){
    try{
      const u=new URL(embed.startsWith('//')?`https:${embed}`:embed)
      if(u.host==='youtu.be'){
        const id=u.pathname.split('/').filter(Boolean).pop()
        if(id)return`https://i.iwara.tv/image/embed/thumbnail/youtube/${id}`
      }
      if(u.host==='www.youtube.com'){
        const id=u.searchParams.get('v')
        if(id)return`https://i.iwara.tv/image/embed/thumbnail/youtube/${id}`
      }
    }catch{}
  }
  const ctRaw=v.customThumbnail??v.custom_thumbnail
  const ctId=ctRaw?.id
  const ctName=ctRaw?.name
  if(ctId&&ctName)return`https://i.iwara.tv/image/thumbnail/${ctId}/${ctName}`
  const file=v.file
  const fileId=file?.id||file?.fileId||v.fileId
  const tn=v.thumbnail
  const idx=typeof tn==='number'?tn:0
  if(fileId)return`https://i.iwara.tv/image/thumbnail/${fileId}/thumbnail-${ctx.pad2(idx)}.jpg`
  return''
}

export function videoDurationSeconds(v){
  const d=v?.file?.duration
  return typeof d==='number'?d:Number(d||0)
}

export function videoTitle(v){
  return v?.title||v?.slug||'Untitled'
}

export function videoAuthor(v){
  return v?.user?.name||v?.user?.username||'Unknown'
}

export function userAvatarUrl(u){
  const av=u?.avatar
  const id=av?.id
  const name=av?.name
  if(!id||!name)return''
  const mime=String(av?.mime||'')
  const isAnimated=mime==='image/gif'||mime==='image/webp'||mime==='image/apng'
  const fileName=isAnimated?String(name||''):nameWithExt(name,'jpg')
  if(!fileName)return''
  const base=isAnimated?'original':'avatar'
  return `https://i.iwara.tv/image/${base}/${encodeURIComponent(String(id))}/${encodeURIComponent(fileName)}`
}

function nameWithExt(name,ext){
  const s=String(name||'')
  if(!s)return''
  if(s.includes('.'))return s.replace(/\.[^.]+$/,`.${ext}`)
  return`${s}.${ext}`
}

function nameVariants(name){
  const s=String(name||'')
  if(!s)return[]
  const out=[s]
  ;['jpg','jpeg','png','webp'].forEach((ext)=>{
    const v=nameWithExt(s,ext)
    if(v&&v!==s&&!out.includes(v))out.push(v)
  })
  return out
}

function iwaraThumbUrl(id,name){
  const i=String(id||'')
  const n=String(name||'')
  if(!i||!n)return''
  return`https://i.iwara.tv/image/thumbnail/${encodeURIComponent(i)}/${encodeURIComponent(n)}`
}

function iwaraLargeUrl(id,name){
  const i=String(id||'')
  const n=String(name||'')
  if(!i||!n)return''
  return`https://i.iwara.tv/image/large/${encodeURIComponent(i)}/${encodeURIComponent(n)}`
}

function iwaraOriginalUrl(id,name){
  const i=String(id||'')
  const n=String(name||'')
  if(!i||!n)return''
  return`https://i.iwara.tv/image/original/${encodeURIComponent(i)}/${encodeURIComponent(n)}`
}

export function imageThumbnailCandidates(img){
  const out=[]
  const tn=img?.thumbnail
  const id=tn?.id
  const name=tn?.name
  if(id&&name){
    nameVariants(name).forEach((n)=>{
      const u=iwaraThumbUrl(id,n)
      if(u&&!out.includes(u))out.push(u)
    })
  }
  const f=img?.files?.[0]
  if(f?.id&&f?.name){
    nameVariants(f.name).slice(0,5).forEach((n)=>{
      const u=iwaraThumbUrl(f.id,n)
      if(u&&!out.includes(u))out.push(u)
    })
    ;[f.name,nameWithExt(f.name,'jpg')].forEach((n)=>{
      const u1=iwaraLargeUrl(f.id,n)
      const u2=iwaraOriginalUrl(f.id,n)
      if(u1&&!out.includes(u1))out.push(u1)
      if(u2&&!out.includes(u2))out.push(u2)
    })
  }
  return out
}

export function imageThumbnailUrl(img){
  return imageThumbnailCandidates(img)[0]||''
}

export function imageTitle(img){
  return img?.title||img?.slug||'Untitled'
}

export function imageCount(img){
  return img?.numImages||img?.num_images||0
}

export function videoCardHtml(ctx,v){
  const thumb=videoThumbnailUrl(ctx,v)
  const bg=thumb?`background-image:url('${thumb.replace(/'/g,"%27")}')`:''
  const r=ctx.ratingClass(v.rating)
  const rl=ctx.ratingLabel(v.rating)
  const dur=ctx.formatDurationSeconds(videoDurationSeconds(v))
  const title=ctx.escapeHtml(videoTitle(v))
  const author=ctx.escapeHtml(videoAuthor(v))
  const authorAvatar=userAvatarUrl(v?.user||null)
  const uid=ctx.escapeAttr(v?.user?.id||'')
  const authorHtml=uid?`<span class="ulink" data-user-id="${uid}">${author}</span>`:author
  const likes=ctx.formatNumber(v.numLikes||v.num_likes)
  const id=ctx.escapeAttr(v.id||'')
  const av=author[0]?author[0].toUpperCase():'?'
  const avImg=authorAvatar?`<img class="av-img" src="${ctx.escapeAttr(authorAvatar)}" alt="">`:''
  return `<div class="vcard" data-video-id="${id}"><div class="vthumb"><div class="vthumb-bg" style="${bg}"></div>${ctx.playIcon}<span class="vdur">${dur}</span><span class="vrat ${r}">${rl}</span></div><div class="vbody"><div class="vtitle">${title}</div><div class="vmeta"><div class="vauthor"><div class="vav">${avImg}${av}</div>${authorHtml}</div><div class="vlikes">♡ ${likes}</div></div></div></div>`
}

export function renderVideosGrid(ctx,videos){
  return `<div class="vgrid">${videos.map((v)=>videoCardHtml(ctx,v)).join('')}</div>`
}

export function imageCardHtml(ctx,img){
  const cands=imageThumbnailCandidates(img)
  const thumb=cands[0]||''
  const fb=ctx.escapeAttr(cands.slice(1).join('|'))
  const title=ctx.escapeHtml(imageTitle(img))
  const cnt=imageCount(img)
  const uid=ctx.escapeAttr(img?.user?.id||'')
  const author=ctx.escapeHtml(img?.user?.name||img?.user?.username||'')
  const authorHtml=author?(uid?`<span class="ulink" data-user-id="${uid}">${author}</span>`:author):''
  const id=ctx.escapeAttr(img.id||'')
  const ph=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#1f2937"/><path d="M70 140l50-55 40 45 30-35 60 70H70z" fill="#334155"/><circle cx="115" cy="70" r="14" fill="#334155"/><text x="160" y="182" text-anchor="middle" font-family="Arial" font-size="12" fill="#94a3b8">thumbnail not available</text></svg>`)}`
  const imgHtml=`<img src="${ctx.escapeAttr(thumb||ph)}" alt="" data-ph="${ctx.escapeAttr(ph)}"${fb?` data-fbs="${fb}"`:''}>`
  return `<div class="icard" data-image-id="${id}"><div class="ithumb">${imgHtml}</div><div class="ifoot"><div class="ititle">${title}${authorHtml?` · ${authorHtml}`:''}</div><div class="icount">${cnt}p</div></div></div>`
}

export function renderImagesMasonry(ctx,images){
  return `<div class="imasonry">${images.map((img)=>imageCardHtml(ctx,img)).join('')}</div>`
}

export function forumLeafLabel(id){
  const k=String(id||'').replace(/-/g,'_')
  const m={announcements:'公告',feedback:'反馈',support:'求助',general:'综合',guides:'指南',questions:'提问',requests:'求资源',sharing:'分享',general_zh:'综合',questions_zh:'提问',requests_zh:'求资源',support_zh:'求助',general_ja:'综合',questions_ja:'提问',requests_ja:'求资源',support_ja:'求助',korean:'韩文',other:'其它'}
  return m[k]||String(id||'')
}

export function forumLeafDesc(id){
  const k=String(id||'').replace(/-/g,'_')
  const m={announcements:'官方公告与置顶信息',feedback:'站点反馈与建议',support:'使用问题与求助',general:'综合讨论',guides:'教程与指南',questions:'问题求助',requests:'资源请求',sharing:'作品分享',general_zh:'中文区综合讨论',questions_zh:'中文区问题求助',requests_zh:'中文区资源请求',support_zh:'中文区求助',general_ja:'日文区综合讨论',questions_ja:'日文区问题求助',requests_ja:'日文区资源请求',support_ja:'日文区求助',korean:'韩文区讨论',other:'其它语言与杂项'}
  return m[k]||''
}

export function forumItemHtml(ctx,f){
  const title=ctx.escapeHtml(f.title||'Untitled')
  const userName=ctx.escapeHtml(f.user?.name||f.user?.username||'')
  const userId=ctx.escapeAttr(f.user?.id||'')
  const userHtml=userName?(userId?`<span class="ulink" data-user-id="${userId}">${userName}</span>`:userName):''
  const rawSection=f?.section
  const sectionTitle=ctx.escapeHtml(rawSection?.title||rawSection?.name||'')
  const replies=f.numReplies||f.num_replies||0
  const time=ctx.escapeHtml((f.updatedAt||f.updated_at||'').toString().slice(0,10))
  const av=userName[0]?userName[0].toUpperCase():'?'
  const tid=ctx.escapeAttr(f.id||'')
  let catId=''
  if(typeof rawSection==='string'){
    catId=rawSection
  }else if(rawSection&&typeof rawSection==='object'){
    catId=String(rawSection.id||rawSection._id||rawSection.sectionId||rawSection.section_id||'')
  }
  if(!catId)catId=String(f.sectionId||f.section_id||f.forumSectionId||f.forum_section_id||'')
  if(!catId)catId=String(ctx.state?.forum?.categoryId||'')
  const cid=ctx.escapeAttr(catId)
  const avatar=userAvatarUrl(f?.user||null)
  const avImg=avatar?`<img class="av-img" src="${ctx.escapeAttr(avatar)}" alt="">`:''
  return `<div class="fitem" data-thread-id="${tid}" data-thread-cat-id="${cid}"><div class="fav">${avImg}${av}</div><div class="fbody"><div class="ftitle">${title}</div><div class="fsub">${sectionTitle}${sectionTitle&&userHtml?' · ':''}${userHtml}</div></div><div class="fright"><div class="frep">${ctx.formatNumber(replies)}</div><div class="ftime">${time}</div></div></div>`
}

export function renderForumList(ctx,items){
  return `<div class="flist">${items.map((f)=>forumItemHtml(ctx,f)).join('')}</div>`
}

export function forumCategoryItemHtml(ctx,c){
  const id=ctx.escapeAttr(c?.id||'')
  const rawId=String(c?.id||'')
  const title=ctx.escapeHtml(forumLeafLabel(rawId))
  const desc=ctx.escapeHtml(forumLeafDesc(rawId))
  const threads=ctx.formatNumber(c?.numThreads||c?.num_threads||0)
  return `<div class="fitem" data-fcat-id="${id}" data-fcat-label="${ctx.escapeAttr(forumLeafLabel(rawId))}"><div class="fav">#</div><div class="fbody"><div class="ftitle">${title}</div><div class="fsub">${desc}</div></div><div class="fright"><div class="frep">${threads}</div><div class="ftime"></div></div></div>`
}

export function renderForumCategories(ctx,items){
  return `<div class="flist">${items.map((c)=>forumCategoryItemHtml(ctx,c)).join('')}</div>`
}

export function userItemHtml(ctx,u){
  const name=ctx.escapeHtml(u?.name||u?.username||'User')
  const uname=ctx.escapeHtml(u?.username?`@${u.username}`:'')
  const about=ctx.escapeHtml((u?.about||u?.description||'').toString().slice(0,80))
  const id=ctx.escapeAttr(u?.id||'')
  const av=(name||'?')[0].toUpperCase()
  const avatar=userAvatarUrl(u)
  const avImg=avatar?`<img class="av-img" src="${ctx.escapeAttr(avatar)}" alt="">`:''
  return `<div class="fitem"${id?` data-user-id="${id}"`:''}><div class="fav">${avImg}${av}</div><div class="fbody"><div class="ftitle">${name} <span style="opacity:.6;font-weight:500">${uname}</span></div><div class="fsub">${about}</div></div><div class="fright"></div></div>`
}

export function renderUserList(ctx,items){
  return `<div class="flist">${items.map((u)=>userItemHtml(ctx,u)).join('')}</div>`
}
