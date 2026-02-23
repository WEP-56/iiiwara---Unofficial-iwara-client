export function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

export function escapeAttr(s){
  return escapeHtml(s)
}

