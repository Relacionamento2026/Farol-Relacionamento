import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const authSource=readFileSync('supabase/functions/pergunte-ao-farol/authorize.js','utf8');
const source=stripTypeScriptTypes(readFileSync('supabase/functions/pergunte-ao-farol/index.ts','utf8').replace(/^import .*;\n/,''));
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
function server(mode, provider){
 let handler; const calls=[];
 const ctx={Request,Response,AbortSignal,console:{log(){},error(){}},Deno:{env:{get:key=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'public-test-key',GEMINI_API_KEY:'test-only'})[key]},serve:fn=>handler=fn},fetch:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return response({id:'verified-id'},mode==='expired'?401:200);
  if(url.includes('/rest/v1/profiles'))return response(mode==='missing'?[]:[{id:'verified-id',ativo:mode==='inactive'?'inativo':'ativo'}]);
  if(provider)return provider(url,options);
  return response({candidates:[{content:{parts:[{text:'Resposta sintética'}]}}]});
 }};
 vm.runInNewContext(authSource.replace('export async','async')+'\n'+source,ctx);
 return {handler,calls};
}
test('Edge nega ausência de token, token expirado, inativo e perfil ausente antes de consumir IA',async()=>{
 for(const mode of ['none','expired','inactive','missing']){
  const s=server(mode);
  const req=new Request('https://example.test/function',{method:'POST',headers:mode==='none'?{}:{Authorization:'Bearer synthetic-token'},body:JSON.stringify({pergunta:'teste',base:''})});
  const result=await s.handler(req);
  assert.equal(result.status,['none','expired'].includes(mode)?401:403);
  assert.equal(s.calls.some(x=>x.url.includes('googleapis')),false);
 }
});
test('Edge preserva contrato para perfil ativo e consulta perfil com JWT do chamador',async()=>{
 const s=server('active');
 const result=await s.handler(new Request('https://example.test/function',{method:'POST',headers:{Authorization:'Bearer synthetic-token'},body:JSON.stringify({pergunta:'teste',base:''})}));
 assert.equal(result.status,200);assert.equal((await result.json()).resposta,'Resposta sintética');
 assert.equal(s.calls[1].options.headers.Authorization,'Bearer synthetic-token');
});
test('Edge aceita preflight sem chamar Auth ou IA',async()=>{
 const s=server('none');assert.equal((await s.handler(new Request('https://example.test/function',{method:'OPTIONS'}))).status,200);assert.equal(s.calls.length,0);
});

const question=()=>new Request('https://example.test/function',{method:'POST',headers:{Authorization:'Bearer synthetic-token'},body:JSON.stringify({pergunta:'teste',base:''})});
test('Edge limita a espera e responde a falha de rede sem travar',async()=>{
 const s=server('active',async(_,options)=>{assert.ok(options.signal instanceof AbortSignal);throw new DOMException('Timed out','TimeoutError');});
 const result=await s.handler(question());assert.equal(result.status,502);assert.equal((await result.json()).categoria,'rede');
});
test('Quota é temporária sem prometer duração diária ou notificação inexistente',async()=>{
 const s=server('active',async()=>response({error:'RESOURCE_EXHAUSTED'},429));
 const result=await s.handler(question());assert.equal(result.status,429);const data=await result.json();assert.equal(data.categoria,'quota');assert.doesNotMatch(data.error,/por hoje|avisada/);
});
test('Edge combina partes públicas e exclui raciocínio interno',async()=>{
 const s=server('active',async()=>response({candidates:[{content:{parts:[{text:'interno',thought:true},{text:'Resposta'},{text:'Fonte: FAQ'}]}}]}));
 const result=await s.handler(question());assert.equal((await result.json()).resposta,'Resposta\nFonte: FAQ');
});
