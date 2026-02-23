export async function apiRequest({ endpoint, method = 'GET', query, body, headers, skipAuthWait, silent }){
  const res=await window.electronAPI.apiRequest({ endpoint, method, query, body, headers, skipAuthWait })
  if(res?.error && !silent){
    try{console.error('[api.error]',method,endpoint,res?.status||'',res?.message||'')}catch{}
  }
  return res
}

export async function apiGet(endpoint, query, opts){
  return await apiRequest({ endpoint, method: 'GET', query, ...(opts||{}) })
}

export async function apiPost(endpoint, body, query, opts){
  return await apiRequest({ endpoint, method: 'POST', query, body, ...(opts||{}) })
}

export async function apiDelete(endpoint, query, opts){
  return await apiRequest({ endpoint, method: 'DELETE', query, ...(opts||{}) })
}
