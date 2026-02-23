export function bindUserLinks(ctx,root){
  const host=root||document
  host.querySelectorAll('[data-user-id]').forEach((el)=>{
    if(el.__userBound)return
    el.__userBound=true
    el.addEventListener('click',(e)=>{
      e.stopPropagation()
      const id=el.getAttribute('data-user-id')||''
      if(id)ctx.openUserDetail(id)
    })
  })
}

export function bindCardEvents(ctx,root){
  const host=root||document.getElementById('content')
  if(!host)return
  host.querySelectorAll('.vcard[data-video-id]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',()=>{
      const id=el.getAttribute('data-video-id')
      if(id)ctx.openVideoDetail(id)
    })
  })
  host.querySelectorAll('.icard[data-image-id]').forEach((el)=>{
    if(el.__bound)return
    el.__bound=true
    el.addEventListener('click',()=>{
      const id=el.getAttribute('data-image-id')
      if(id)ctx.openImageDetail(id)
    })
  })
  bindUserLinks(ctx,host)
}
