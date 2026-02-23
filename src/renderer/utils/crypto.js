export function bytesToHex(bytes){
  return Array.from(bytes).map((b)=>b.toString(16).padStart(2,'0')).join('')
}

export async function sha1Hex(s){
  const data=new TextEncoder().encode(String(s||''))
  const hash=await crypto.subtle.digest('SHA-1',data)
  return bytesToHex(new Uint8Array(hash))
}

