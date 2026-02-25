export function bindUserLinks(ctx,root){
  const host=root||document
  if(!host)return
  if(host._userLinksDelegated)return
  host._userLinksDelegated=true
  host.addEventListener('click',(e)=>{
    const el=e.target?.closest?.('[data-user-id]')
    if(!el)return
    e.stopPropagation()
    const id=el.getAttribute('data-user-id')||''
    if(id)ctx.openUserDetail(id)
  })
}

export function bindCardEvents(ctx,root){
  const host=root||document.getElementById('content')
  if(!host)return
  if(!host._cardEventsDelegated){
    host._cardEventsDelegated=true
    host.addEventListener('click',(e)=>{
      const vcard=e.target?.closest?.('.vcard[data-video-id]')
      if(vcard){
        const id=vcard.getAttribute('data-video-id')
        if(id)ctx.openVideoDetail(id)
        return
      }
      const icard=e.target?.closest?.('.icard[data-image-id]')
      if(icard){
        const id=icard.getAttribute('data-image-id')
        if(id)ctx.openImageDetail(id)
      }
    })
  }
  bindUserLinks(ctx,host)
}
