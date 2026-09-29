// Test-only instrumentation. Never deploy this file or the generated local function.
const nativeFetch=globalThis.fetch;
const nativeServe=Deno.serve;
const origin=new URL(Deno.env.get('SUPABASE_URL')!);
if (!['kong','127.0.0.1','localhost'].includes(origin.hostname) && !origin.hostname.startsWith('supabase_kong_')) throw new Error('Only local Supabase allowed');
let modelCalls=0;
Deno.env.set('GEMINI_API_KEY','synthetic-not-a-real-key');
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname==='generativelanguage.googleapis.com'){
  modelCalls++;
  if(String(init?.body).includes('simulate-quota'))return new Response(JSON.stringify({error:{message:'private-provider-detail'}}),{status:429});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Resposta sintética do provedor isolado'}]}}]}),{headers:{'Content-Type':'application/json'}});
 }
 if(url.origin!==origin.origin)throw new Error('External network forbidden');
 return nativeFetch(input,init);
};
// Instrument the real handler without changing its source or Auth/REST calls.
// @ts-ignore local wrapper supports the handler-only overload used by this function
Deno.serve=(handler)=>nativeServe(async(req)=>{
 const before=modelCalls;
 const res=await handler(req);
 const headers=new Headers(res.headers);headers.set('x-test-model-calls',String(modelCalls-before));
 return new Response(res.body,{status:res.status,headers});
});
await import('./real.ts');
