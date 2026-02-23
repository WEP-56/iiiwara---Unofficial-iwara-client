import { state } from './state.js'

export function ensureDetailOverlay(){
  let el=document.getElementById('detailOverlay')
  if(el)return el
  el=document.createElement('div')
  el.id='detailOverlay'
  el.className='detail-overlay'
  el.innerHTML=`<div class="detail-shell" role="dialog" aria-modal="true"><div class="detail-top"><div class="detail-title" id="detailTitle"></div><div class="detail-actions"><div class="detail-btn" id="detailCloseBtn">×</div></div></div><div class="detail-body" id="detailBody"><div class="detail-layout"><div class="detail-col detail-left" id="detailLeft"></div><div class="detail-col detail-center" id="detailCenter"></div><div class="detail-col detail-right" id="detailRight"></div></div></div></div>`
  el.addEventListener('click',(e)=>{if(e.target===el)closeDetail()})
  ;(document.querySelector('.main')||document.body).appendChild(el)
  const closeBtn=document.getElementById('detailCloseBtn')
  if(closeBtn)closeBtn.addEventListener('click',closeDetail)
  return el
}

export function openDetailShell(title){
  state.detail.open=true
  const el=ensureDetailOverlay()
  el.classList.add('open')
  const t=document.getElementById('detailTitle')
  if(t)t.textContent=title||''
  const left=document.getElementById('detailLeft')
  const center=document.getElementById('detailCenter')
  const right=document.getElementById('detailRight')
  if(left)left.innerHTML=''
  if(center)center.innerHTML=`<div class="detail-loading">加载中…</div>`
  if(right)right.innerHTML=''
}

export function closeDetail(){
  state.detail.open=false
  state.detail.type=''
  state.detail.id=''
  state.detail.catId=''
  state.detail.data=null
  state.detail.index=0
  state.detail.scale=1
  state.detail.tx=0
  state.detail.ty=0
  state.detail.comments={type:'',id:'',page:0,hasMore:true,loading:false,items:[]}
  state.detail.user={id:'',tab:'videos',videosPage:0,imagesPage:0,postsPage:0}
  const el=document.getElementById('detailOverlay')
  if(el)el.classList.remove('open')
  const left=document.getElementById('detailLeft')
  const center=document.getElementById('detailCenter')
  const right=document.getElementById('detailRight')
  if(left)left.innerHTML=''
  if(center)center.innerHTML=''
  if(right)right.innerHTML=''
}

export function setDetailTitle(title){
  const t=document.getElementById('detailTitle')
  if(t)t.textContent=title||''
}

export function setDetailBodyHtml(html){
  const center=document.getElementById('detailCenter')
  if(center)center.innerHTML=html||''
}

export function setDetailLeftHtml(html){
  const left=document.getElementById('detailLeft')
  if(left)left.innerHTML=html||''
}

export function setDetailRightHtml(html){
  const right=document.getElementById('detailRight')
  if(right)right.innerHTML=html||''
}
