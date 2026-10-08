const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parse,createResolver} = require('../assets/private-storage.js');
const url='https://pvorwgrpkcofoukbqtyg.supabase.co/storage/v1/object/public/materiais/a%20b.pdf';
test('private storage only resolves authorized project and buckets',()=>{
 assert.deepEqual(parse(url),{bucket:'materiais',path:'a b.pdf'});
 assert.equal(parse(url.replace('pvorwgrpkcofoukbqtyg','other')),null);
 assert.equal(parse(url.replace('materiais','unknown')),null);
});
test('authenticated download rejects denied access without public fallback',async()=>{
 const r=createResolver(()=>({storage:{from:()=>({download:async()=>({error:new Error('denied')})})}}));
 await assert.rejects(r.resolve(url));
});
test('logout cancels pending download and revokes existing blob',async()=>{
 let finish; const revoked=[];let count=0;
 const r=createResolver(()=>({storage:{from:()=>({download:()=>new Promise(resolve=>finish=resolve)})}}),{createObjectURL:()=>{count++;return 'blob:private'},revokeObjectURL:v=>revoked.push(v)});
 const pending=r.resolve(url);r.clear();finish({data:new Blob(['private'])});await assert.rejects(pending);assert.equal(count,0);
 const next=r.resolve(url);finish({data:new Blob(['private'])});assert.equal(await next,'blob:private');r.clear();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(revoked,['blob:private']);
});
