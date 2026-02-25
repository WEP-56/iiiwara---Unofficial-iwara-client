export async function renderAccountPage(ctx,{token}={}){
  const { state, ensureMeLoaded, setStatus }=ctx
  const content=document.getElementById('content')
  if(!content)return

  content.innerHTML=profilePageHtml(ctx)
  bindAccountEvents(ctx)

  if(state.auth.hasAccess){
    try{
      await ensureMeLoaded()
      await ensureProfileCountsLoaded(ctx,{token})
      if(token!==undefined&&token!==null&&token!==state.navToken)return
      content.innerHTML=profilePageHtml(ctx)
      bindAccountEvents(ctx)
      await renderProfilePane(ctx,{token})
    }catch(e){
      setStatus(String(e?.message||e),true)
    }
  }
}

function profilePaneHtml(ctx){
  const { state, escapeHtml }=ctx
  const tab=String(state.sub.profile||'订阅')
  const title=escapeHtml(tab)
  return `<div class="create-page" style="padding:18px 0"><div class="create-sub">${title}</div><div id="profilePaneBody" style="margin-top:10px"><div class="detail-loading">加载中…</div></div></div>`
}

function profilePageHtml(ctx){
  const { state, escapeHtml, escapeAttr, pageContainerHtml, meName, meUsername, meAvatarUrl, meAvatarLetter }=ctx
  if(state.auth.hasAccess){
    const name=escapeHtml(meName())
    const uname=escapeHtml(meUsername())
    const av=escapeHtml(meAvatarLetter())
    const url=escapeAttr(meAvatarUrl?meAvatarUrl():'')
    const avImg=url?`<img class="av-img" src="${url}" alt="" onerror="this.remove()">`:''
    const meta=uname?`已登录 · ${uname}`:'已登录'
    const t=(v)=>v===0?'0':(v===null||v===undefined?'—':String(v))
    const following=t(state.meCounts?.followingCount)
    const followers=t(state.meCounts?.followersCount)
    const notifications=t(state.meCounts?.notifications)
    return pageContainerHtml(`<div class="profile-header"><div class="profile-av">${avImg}${av}</div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${meta}</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">${following}</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">${followers}</div><div class="profile-stat-l">粉丝</div></div><div class="profile-stat"><div class="profile-stat-n">${notifications}</div><div class="profile-stat-l">通知</div></div></div></div><div id="profilePane">${profilePaneHtml(ctx)}</div><div class="create-page" style="padding:10px 0 22px"><button class="create-btn" id="profileLogoutBtn" style="background:rgba(255,255,255,.08);border:1px solid var(--b0);color:var(--t1)">退出登录</button></div>`)
  }
  return pageContainerHtml(`<div class="profile-header"><div class="profile-av">G</div><div class="profile-info"><div class="profile-name">Guest</div><div class="profile-meta">未登录</div></div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">订阅</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">粉丝</div></div><div class="profile-stat"><div class="profile-stat-n">—</div><div class="profile-stat-l">通知</div></div></div></div><div id="profilePane"><div class="create-page" style="padding:22px 0"><div class="create-sub">登录后查看个人内容</div><div class="search-box" style="margin-top:12px"><span class="sico">@</span><input id="loginEmail" placeholder="邮箱"></div><div class="search-box" style="margin-top:10px"><span class="sico">＊</span><input id="loginPassword" placeholder="密码" type="password"></div><div id="loginErr" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div><button class="create-btn" id="profileDoLoginBtn" style="margin-top:6px">登录</button></div></div>`)
}

async function ensureProfileCountsLoaded(ctx,{token}={}){
  const { state, endpoints, apiGet }=ctx
  if(!state.auth.hasAccess)return
  if(token!==undefined&&token!==null&&token!==state.navToken)return
  const meId=String(state.me?.id||'')
  if(!meId)return
  const set=(patch)=>{
    const cur=(state.meCounts&&typeof state.meCounts==='object')?state.meCounts:{}
    state.meCounts={...cur,...patch}
  }

  const readCount=(x)=>{
    if(x&&typeof x.count==='number')return x.count
    if(x&&x.data&&typeof x.data.count==='number')return x.data.count
    return null
  }
  try{
    const [followingRes,followersRes,countsRes]=await Promise.all([
      apiGet(endpoints.userFollowing(meId),{page:0,limit:1},{silent:true}),
      apiGet(endpoints.userFollowers(meId),{page:0,limit:1},{silent:true}),
      apiGet(endpoints.userCounts(),null,{silent:true})
    ])
    if(followingRes&&!followingRes.error)set({followingCount:readCount(followingRes)})
    if(followersRes&&!followersRes.error)set({followersCount:readCount(followersRes)})
    if(countsRes&&!countsRes.error){
      set({
        messages:typeof countsRes.messages==='number'?countsRes.messages:null,
        notifications:typeof countsRes.notifications==='number'?countsRes.notifications:null,
        friendRequests:typeof countsRes.friendRequests==='number'?countsRes.friendRequests:null
      })
    }
  }catch{}
}

async function renderProfilePane(ctx,{token}={}){
  const { state, endpoints, apiGet, apiPost, pickResults, escapeHtml, escapeAttr, sectionHead, renderUserList, bindUserLinks, bindCardEvents }=ctx
  const host=document.getElementById('profilePaneBody')
  if(!host)return
  if(!state.auth.hasAccess)return
  if(token!==undefined&&token!==null&&token!==state.navToken)return

  const meId=String(state.me?.id||'')
  const tab=String(state.sub.profile||'订阅')
  if(!meId){
    host.innerHTML=`<div class="detail-loading">未登录</div>`
    return
  }

  const pickUserFromRow=(row)=>{
    if(!row)return null
    return row.user||row.profileUser||row.data?.user||row.data?.profileUser||row
  }
  const fmtTime=(t)=>{
    const s=String(t||'')
    return s?escapeHtml(s.replace('T',' ').slice(0,16)):''
  }

  try{
    host.innerHTML=`<div class="detail-loading">加载中…</div>`

    if(tab==='订阅'){
      const data=await apiGet(endpoints.userFollowing(meId),{page:0,limit:40})
      if(data?.error)throw new Error(data.message||'request failed')
      const rows=pickResults(data)
      const users=rows.map(pickUserFromRow).filter(Boolean)
      host.innerHTML=`${sectionHead('订阅',data?.count??users.length,'')}${users.length?renderUserList(users):`<div class="detail-loading">暂无订阅</div>`}`
      bindUserLinks(host)
      return
    }

    if(tab==='好友'){
      const data=await apiGet(endpoints.userFriends(meId),{page:0,limit:40})
      if(data?.error)throw new Error(data.message||'request failed')
      const rows=pickResults(data)
      const users=rows.map(pickUserFromRow).filter(Boolean)
      host.innerHTML=`${sectionHead('好友',data?.count??users.length,'')}${users.length?renderUserList(users):`<div class="detail-loading">暂无好友</div>`}`
      bindUserLinks(host)
      return
    }

    if(tab==='通知'){
      const data=await apiGet(endpoints.userNotifications(meId),{page:0,limit:30})
      if(data?.error)throw new Error(data.message||'request failed')
      const rows=pickResults(data)
      const items=rows.map((n)=>{
        const type=String(n?.type||'')
        const createdAt=n?.createdAt||n?.created_at||n?.updatedAt||n?.updated_at||''
        const read=!!(n?.read)
        const title=type||'notification'
        const subParts=[]
        if(n?.comment?.user?.id)subParts.push(`<span class="ulink" data-user-id="${escapeAttr(n.comment.user.id)}">${escapeHtml(n.comment.user.name||n.comment.user.username||'User')}</span>`)
        if(n?.video?.title)subParts.push(`${escapeHtml(n.video.title)}`)
        if(n?.image?.title)subParts.push(`${escapeHtml(n.image.title)}`)
        if(n?.thread?.title)subParts.push(`${escapeHtml(n.thread.title)}`)
        const sub=subParts.filter(Boolean).join(' · ')
        const time=fmtTime(createdAt)

        const baseCls=`fitem${read?'':' unread'}`
        if(n?.video?.id){
          return `<div class="${baseCls} vcard" data-video-id="${escapeAttr(n.video.id)}"><div class="fav">${read?'':'●'}</div><div class="fbody"><div class="ftitle">${escapeHtml(title)} <span style="opacity:.6;font-weight:500">${time}</span></div><div class="fsub">${sub||'—'}</div></div><div class="fright"></div></div>`
        }
        if(n?.image?.id){
          return `<div class="${baseCls} icard" data-image-id="${escapeAttr(n.image.id)}"><div class="fav">${read?'':'●'}</div><div class="fbody"><div class="ftitle">${escapeHtml(title)} <span style="opacity:.6;font-weight:500">${time}</span></div><div class="fsub">${sub||'—'}</div></div><div class="fright"></div></div>`
        }
        if(n?.profile?.id){
          return `<div class="${baseCls}" data-user-id="${escapeAttr(n.profile.id)}"><div class="fav">${read?'':'●'}</div><div class="fbody"><div class="ftitle">${escapeHtml(title)} <span style="opacity:.6;font-weight:500">${time}</span></div><div class="fsub">${sub||'—'}</div></div><div class="fright"></div></div>`
        }
        return `<div class="${baseCls}"><div class="fav">${read?'':'●'}</div><div class="fbody"><div class="ftitle">${escapeHtml(title)} <span style="opacity:.6;font-weight:500">${time}</span></div><div class="fsub">${sub||escapeHtml(JSON.stringify(n).slice(0,120))}</div></div><div class="fright"></div></div>`
      })
      host.innerHTML=`${sectionHead('通知',data?.count??rows.length,'')}${items.length?`<div class="flist">${items.join('')}</div>`:`<div class="detail-loading">暂无通知</div>`}`
      bindUserLinks(host)
      bindCardEvents(host)
      return
    }

    if(tab==='讯息'||tab==='会话'){
      const data=await apiGet(endpoints.userConversations(meId),{page:0,limit:20})
      if(data?.error)throw new Error(data.message||'request failed')
      const rows=pickResults(data)
      const convItemHtml=(c)=>{
        const id=escapeAttr(c?.id||'')
        const title=escapeHtml(String(c?.title||''))
        const unread=!!c?.unread
        const lastBody=escapeHtml(String(c?.lastMessage?.body||'').slice(0,80))
        const updated=fmtTime(c?.updatedAt||c?.updated_at||c?.createdAt||c?.created_at||'')
        const people=Array.isArray(c?.participants)?c.participants:[]
        const who=people.filter((u)=>String(u?.id||'')!==meId)
        const names=who.map((u)=>String(u?.name||u?.username||'')).filter(Boolean)
        const nameText=escapeHtml(names.join(', ')||'会话')
        const head=((names[0]||'会')[0]||'会').toUpperCase()
        return `<div class="fitem conv-item${unread?' unread':''}" data-conv-id="${id}"><div class="fav">${unread?'●':head}</div><div class="fbody"><div class="ftitle">${title||nameText} <span style="opacity:.6;font-weight:500">${updated}</span></div><div class="fsub">${lastBody||'—'}</div></div><div class="fright"></div></div>`
      }

      host.innerHTML=`${sectionHead('会话',data?.count??rows.length,'')}<div class="flist" id="convList">${rows.map(convItemHtml).join('')||''}</div><div id="convPanel" style="margin-top:12px"></div>`
      bindUserLinks(host)

      const list=document.getElementById('convList')
      const panel=document.getElementById('convPanel')
      if(list&&panel&&!list._convDelegated){
        list._convDelegated=true
        list.addEventListener('click',async(e)=>{
          const el=e.target?.closest?.('.conv-item')
          const convId=el?.getAttribute?.('data-conv-id')||''
          if(!convId)return
          await loadAndRenderConversation(ctx,panel,convId,{reset:true})
        })
      }
      if(panel&&!panel._convPanelDelegated){
        panel._convPanelDelegated=true
        panel.addEventListener('click',async(e)=>{
          const more=e.target?.closest?.('#convMoreBtn')
          if(more){
            const convId=panel.getAttribute('data-conv-id')||''
            if(convId)await loadAndRenderConversation(ctx,panel,convId,{reset:false})
            return
          }
          const send=e.target?.closest?.('#convSendBtn')
          if(send){
            const convId=panel.getAttribute('data-conv-id')||''
            const input=document.getElementById('convSendBody')
            const body=String(input?.value||'').trim()
            if(!convId||!body)return
            send.disabled=true
            try{
              const res=await apiPost(endpoints.conversationMessages(convId),{body})
              if(res?.error)throw new Error(res.message||'send failed')
              if(input)input.value=''
              await loadAndRenderConversation(ctx,panel,convId,{reset:true})
            }catch(err){
              panel.innerHTML=`<div class="detail-loading">${escapeHtml(String(err?.message||err))}</div>`
            }finally{
              send.disabled=false
            }
          }
        })
      }

      const firstConv=rows[0]?.id
      if(firstConv&&panel){
        await loadAndRenderConversation(ctx,panel,String(firstConv),{reset:true})
      }else if(panel){
        panel.innerHTML=`<div class="detail-loading">暂无会话</div>`
      }
      return
    }

    if(tab==='历史'){
      host.innerHTML=`${sectionHead('历史',0,'')}<div class="detail-loading">占位：后续接入本地历史记录</div>`
      return
    }

    host.innerHTML=`<div class="detail-loading">${escapeHtml(tab)}：暂未接入</div>`
  }catch(e){
    host.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}

async function loadAndRenderConversation(ctx,panel,convId,{reset}){
  const { endpoints, apiGet, escapeHtml, escapeAttr, bindUserLinks }=ctx
  panel.setAttribute('data-conv-id',String(convId||''))
  const beforeKey='data-before'
  const currentBefore=panel.getAttribute(beforeKey)||''
  const before=reset?new Date().toISOString():(currentBefore||new Date().toISOString())
  try{
    if(reset)panel.__msgs=[]
    panel.innerHTML=`<div class="detail-loading">加载讯息…</div>`
    const data=await apiGet(endpoints.conversationMessages(convId),{before,limit:50})
    if(data?.error)throw new Error(data.message||'request failed')
    const results=Array.isArray(data?.results)?data.results:[]
    const last=String(data?.last||'')
    if(last)panel.setAttribute(beforeKey,last)
    const merged=reset?results:[...results,...(panel.__msgs||[])]
    panel.__msgs=merged
    const msgs=panel.__msgs||[]
    const msgHtml=msgs.map((m)=>{
      const u=m?.user||null
      const uid=u?.id||''
      const name=escapeHtml(String(u?.name||u?.username||'User'))
      const time=escapeHtml(String(m?.createdAt||m?.created_at||'').replace('T',' ').slice(0,16))
      const body=escapeHtml(String(m?.body||''))
      const userLink=uid?`<span class="ulink" data-user-id="${escapeAttr(uid)}">${name}</span>`:name
      return `<div style="padding:10px 0;border-top:1px solid var(--b0)"><div style="font-size:12px;opacity:.8">${userLink} <span style="opacity:.7">${time}</span></div><div style="margin-top:6px;white-space:pre-wrap;line-height:1.45">${body||'—'}</div></div>`
    }).join('')
    const hasMore=msgs.length>0&&String(panel.getAttribute(beforeKey)||'')
    panel.innerHTML=`<div class="create-page" style="padding:0"><div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin:6px 0 10px"><div class="create-sub">讯息</div><button class="create-btn" id="convMoreBtn" style="padding:6px 10px;${hasMore?'':'opacity:.4;pointer-events:none'}">更早</button></div><div>${msgHtml||`<div class="detail-loading">暂无讯息</div>`}</div><div style="margin-top:12px;border-top:1px solid var(--b0);padding-top:12px"><div class="search-box"><span class="sico">✎</span><input id="convSendBody" placeholder="发送讯息…" /></div><button class="create-btn" id="convSendBtn" style="margin-top:10px">发送</button></div></div>`
    bindUserLinks(panel)
  }catch(e){
    panel.innerHTML=`<div class="detail-loading">${escapeHtml(String(e?.message||e))}</div>`
  }
}

function bindAccountEvents(ctx){
  const { state, setStatus, syncAuthState, renderPageInitial, mapLoginError }=ctx
  const loginBtn=document.getElementById('profileDoLoginBtn')
  const logoutBtn=document.getElementById('profileLogoutBtn')
  const emailEl=document.getElementById('loginEmail')
  const passEl=document.getElementById('loginPassword')
  const errEl=document.getElementById('loginErr')
  const setErr=(m)=>{if(errEl)errEl.textContent=m||''}

  if(loginBtn){
    loginBtn.addEventListener('click',async()=>{
      try{
        setErr('')
        const email=(emailEl?.value||'').trim()
        const password=(passEl?.value||'')
        if(!email||!password){
          setErr('请输入邮箱和密码')
          return
        }
        setStatus('login...',false)
        const result=await window.electronAPI.authLogin({email,password})
        if(result?.success&&result?.accessToken){
          window.electronAPI.setApiToken(result.accessToken)
          state.me=null
          await syncAuthState()
          setStatus('logged in',false)
          await renderPageInitial()
          return
        }
        const msg=mapLoginError?mapLoginError(result?.message||'登录失败'):(result?.message||'登录失败')
        setErr(msg)
        setStatus(msg||'login failed',true)
      }catch(e){
        setErr(String(e?.message||e))
        setStatus(String(e?.message||e),true)
      }
    })
  }
  if(passEl){
    passEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&loginBtn)loginBtn.click()})
  }
  if(logoutBtn){
    logoutBtn.addEventListener('click',async()=>{
      try{
        await window.electronAPI.authLogout()
        window.electronAPI.setApiToken(null)
        state.me=null
        await syncAuthState()
        setStatus('logged out',false)
        await renderPageInitial()
      }catch(e){
        setStatus(String(e?.message||e),true)
      }
    })
  }
}
