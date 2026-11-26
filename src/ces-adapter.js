// Forge CES adapter; dependencies supplied by the resolver.
export const ENTITY='scopeproof-review';
export const INDEX='by-project-issue';
export function createCesAdapter({kvs,Filter,FilterConditions}, equalityMethod = 'equalTo'){
 if(!['equalTo','equalsTo'].includes(equalityMethod)||typeof FilterConditions?.[equalityMethod]!=='function') throw Error('SDK_EQUALITY_METHOD_UNVERIFIED');
 const eq=v=>FilterConditions[equalityMethod](v);
 const entity=()=>kvs.entity(ENTITY);
 return {
  get:key=>entity().get(key),
  legacyGet:key=>kvs.get(key),
  legacyIndex:projectId=>kvs.get(`project:${projectId}:issues`),
  createIfAbsent:(key,value)=>entity().set(key,value,{keyPolicy:'FAIL_IF_EXISTS'}),
  replaceIfRevision:(key,revision,value)=>kvs.transact().set(key,value,{entityName:ENTITY,conditions:new Filter().and('revision',eq(revision))}).execute(),
  async listPage(projectId,cursor){
   let q=entity().query().index(INDEX,{partition:[String(projectId)]}).limit(40);
   if(cursor)q=q.cursor(cursor);
   const page=await q.getMany();
   if(!Array.isArray(page?.results)||(page.nextCursor!==undefined&&typeof page.nextCursor!=='string'))throw Error('INVALID_CES_QUERY_RESPONSE');
   // Only candidate keys; authorization and authoritative direct read are later resolver responsibilities.
   const keys=page.results.filter(r=>r?.value?.projectId===String(projectId)&&typeof r.value.issueKey==='string'&&/^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(r.value.issueKey)).map(r=>r.value.issueKey);
   return {keys:[...new Set(keys)],nextCursor:page.nextCursor};
  }
 };
}
