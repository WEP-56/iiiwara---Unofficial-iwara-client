import { state } from './state.js'

export function renderImageViewerShell(){
  return `<div class="detail-image-wrap"><div class="detail-image-stage" id="imgStage"><img id="detailImg" class="detail-img" alt=""></div><div class="detail-img-nav"><div class="detail-btn2" id="imgPrevBtn">‹</div><div class="detail-btn2" id="imgNextBtn">›</div></div></div><div class="detail-bar"><div class="detail-sub" id="imgIndexLbl"></div><div style="flex:1"></div><a class="detail-link" id="imgOpenLink" href="#" target="_blank" rel="noreferrer">打开原图</a></div>`
}

export function updateImageTransform(){
  const img=document.getElementById('detailImg')
  if(!img)return
  img.style.transform=`translate(${state.detail.tx}px,${state.detail.ty}px) scale(${state.detail.scale})`
}

export function resetImageTransform(){
  state.detail.scale=1
  state.detail.tx=0
  state.detail.ty=0
  updateImageTransform()
}

export function setImageIndex(ctx,idx){
  const files=state.detail.data?.files||[]
  const total=files.length
  if(!total)return
  state.detail.index=((idx%total)+total)%total
  const file=files[state.detail.index]
  const url=ctx.fileLargeUrl(file)||ctx.fileOriginalUrl(file)
  const original=ctx.fileOriginalUrl(file)||url
  const img=document.getElementById('detailImg')
  if(img)img.src=url
  const lbl=document.getElementById('imgIndexLbl')
  if(lbl)lbl.textContent=`${state.detail.index+1} / ${total}`
  const open=document.getElementById('imgOpenLink')
  if(open)open.href=original||'#'
  resetImageTransform()
  const next=files[(state.detail.index+1)%total]
  const prev=files[(state.detail.index-1+total)%total]
  ;[next,prev].forEach((f)=>{const u=ctx.fileLargeUrl(f)||ctx.fileOriginalUrl(f);if(u){const im=new Image();im.src=u}})
}
