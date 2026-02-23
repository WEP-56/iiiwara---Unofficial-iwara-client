export async function renderWatchPage(ctx){
  if(ctx?.state?.view?.kind==='image'){
    const mod=await import('./imageDetail.js')
    return mod.renderImageDetailPage(ctx)
  }
  const mod=await import('./videoDetail.js')
  return mod.renderVideoDetailPage(ctx)
}
