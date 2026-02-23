export function pickResults(data){
  if(!data)return[]
  const r=data?.results||data?.data?.results||data?.data||[]
  return Array.isArray(r)?r:[]
}

export function pickUser(data){
  if(!data)return null
  return data?.user||data?.profileUser||data?.data?.user||data?.data?.profileUser||data?.me||data
}

export function pickThread(data){
  if(!data)return null
  return data?.thread||data?.data?.thread||data
}

export function pickForumPosts(data){
  if(!data)return[]
  const posts=data?.posts||data?.results||data?.data?.posts||data?.data?.results||[]
  return Array.isArray(posts)?posts:[]
}

