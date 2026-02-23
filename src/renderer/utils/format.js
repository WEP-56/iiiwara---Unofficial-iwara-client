export function pad2(n){return String(n??0).padStart(2,'0')}

export function formatDurationSeconds(s){
  if(!s||Number.isNaN(Number(s)))return'00:00'
  const total=Math.max(0,Math.floor(Number(s)))
  const h=Math.floor(total/3600)
  const m=Math.floor((total%3600)/60)
  const sec=total%60
  return h>0?`${pad2(h)}:${pad2(m)}:${pad2(sec)}`:`${pad2(m)}:${pad2(sec)}`
}

export function formatNumber(n){
  const v=Number(n||0)
  if(v>=1000000)return`${(v/1000000).toFixed(1)}M`
  if(v>=1000)return`${(v/1000).toFixed(1)}k`
  return String(Math.floor(v))
}

