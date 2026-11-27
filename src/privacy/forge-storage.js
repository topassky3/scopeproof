// Read-only inventory across both authoritative and historical copies.
// No tenant ID comes from a UI payload: Forge scopes storage to installation.
export function createPrivacyInventoryAdapter({kvs, WhereConditions}) {
  return {
    async listPage(source,cursor) {
      let query;
      if (source==='ces') query=kvs.entity('scopeproof-review').query().index('by-key').where(WhereConditions.beginsWith('review:'));
      else if (source==='legacy') query=kvs.query().where('key',WhereConditions.beginsWith('review:'));
      else throw Error('PRIVACY_INVALID_SOURCE');
      query=query.limit(100);
      if (cursor) query=query.cursor(cursor);
      const result=await query.getMany();
      if (!Array.isArray(result?.results)) throw Error('PRIVACY_INVALID_PAGE');
      return {keys:result.results.map(row=>row?.key),nextCursor:result.nextCursor};
    },
    async read(source,key) {
      if (source==='ces') {
        const record=await kvs.entity('scopeproof-review').get(key);
        if (record==null) return null;
        if (record.revision!==String(record.review?.revision) || record.projectId!==String(record.review?.projectId) ||
            record.issueKey!==record.review?.issueKey || typeof record.token!=='string'||!record.token) throw Error('PRIVACY_INVALID_WRAPPER');
        return record;
      }
      if (source==='legacy') {
        const review=await kvs.get(key);
        return review==null?null:{review};
      }
      throw Error('PRIVACY_INVALID_SOURCE');
    }
  };
}
