import { state, TITLES } from './state.js'

function cloneState(x){
  try{
    if(typeof globalThis.structuredClone==='function')return globalThis.structuredClone(x)
  }catch{}
  try{
    return JSON.parse(JSON.stringify(x))
  }catch{
    return x
  }
}

export function setTopTitles(title){
  const t=String(title||'')
  const p=document.getElementById('ptitle')
  const s=document.getElementById('stlbl')
  if(p)p.textContent=t
  if(s)s.textContent=t
}

export function setPageTitle(title){
  state.pageTitle=String(title||'')
  setTopTitles(state.pageTitle||TITLES[state.page]||state.page)
}

export function setSidebarActive(page){
  document.querySelectorAll('.sb-item').forEach((i)=>i.classList.remove('active'))
  const el=document.querySelector(`.sb-item[data-page="${CSS.escape(String(page||''))}"]`)
  if(el)el.classList.add('active')
}

export function updateTopBackUi(){
  const back=document.getElementById('topBackBtn')
  if(!back)return
  back.classList.toggle('hidden',state.navStack.length===0)
}

export function pushNav(){
  const content=document.getElementById('content')
  const snap={page:state.page,pageTitle:state.pageTitle,chip:{...state.chip},sub:{...state.sub},search:{...state.search},forum:{...state.forum},view:cloneState(state.view),scrollTop:content?content.scrollTop:0}
  state.navStack.push(snap)
}

export async function goBack(ctx){
  const prev=state.navStack.pop()
  if(!prev)return
  state.page=prev.page
  state.pageTitle=prev.pageTitle||''
  state.chip=prev.chip||state.chip
  state.sub=prev.sub||state.sub
  state.search=prev.search||state.search
  state.forum=prev.forum||state.forum
  if(prev.view)state.view=prev.view
  if(['home','video','image','forum','search','create','profile','settings'].includes(state.page))setSidebarActive(state.page)
  await ctx.renderPageInitial()
  const content=document.getElementById('content')
  if(content)content.scrollTop=Number(prev.scrollTop||0)
}
