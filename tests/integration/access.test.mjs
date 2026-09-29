import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {verifyBrowser} from './browser.mjs';

// Only locally generated credentials; never accepts environment-provided remote URLs.
const dir='test-results/integration';
assert.match(readFileSync(`${dir}/supabase/config.toml`,'utf8'),/^project_id = "farol-ci-isolated"$/m);
const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','--workdir',dir,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
for(const key of ['API_URL','DB_URL']) {
  const url=new URL(status[key]);
  assert.equal(url.hostname,'127.0.0.1','Only loopback endpoints are allowed');
  assert.equal(url.port,key==='API_URL'?'54321':'54322');
}
assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY,'Local keys required');
const db=new pg.Client({connectionString:status.DB_URL});
async function request(path,token,method='GET',body,raw=false){
  const headers={apikey:status.ANON_KEY,Authorization:`Bearer ${token || status.ANON_KEY}`};
  if(body!==undefined) headers['Content-Type']=raw?'text/plain':'application/json';
  if(path.startsWith('/rest/'))headers.Prefer='return=representation';
  const response=await fetch(status.API_URL+path,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
  const text=await response.text();
  let data;try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data};
}
function ok(r){assert.ok(r.status>=200&&r.status<300,`Expected success, got ${r.status} (${r.data?.code || r.data?.error || ''})`);return r.data;}
function denied(r){assert.ok([400,401,403,404].includes(r.status),`Expected denial, got ${r.status}`);}
const notes='/rest/v1/avaliacoes_mensais';
const makeNote=(id,month='2026-10')=>({colaborador_id:id,colaborador_nome:'Sintético',competencia:month,nota_monitoria:4,nota_cliente:4,nota_final:4,classificacao:'nao_elegivel'});
test('Supabase local real: Auth, REST, RLS, Storage e rollback',async t=>{
 await db.connect();
 try{
  assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),17);
  assert.equal((await db.query("SELECT to_regclass('public.profiles') AS t")).rows[0].t,null,'Requires an empty disposable instance');
  // Reuse observed app fixture, retaining real Supabase auth functions and storage schema.
  let fixture=readFileSync('tests/fixtures/schema.sql','utf8')
   .replace(/^CREATE ROLE .*$/m,'')
   .replace('CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA farol_private;','CREATE SCHEMA farol_private;')
   .replace(/^CREATE FUNCTION auth\.(uid|role)\(\).*$/gm,'')
   .replace(/^CREATE TABLE storage\.objects.*$/m,'');
  assert.ok(!fixture.includes('CREATE FUNCTION auth.')&&!fixture.includes('CREATE TABLE storage.objects'));
  await db.query(fixture);
  const policies=async()=>(await db.query("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname")).rows;
  const baseline=await policies();
  const filename=readdirSync('supabase/migrations').find(n=>n.endsWith('_access_controls.sql'));
  await db.query(readFileSync('supabase/migrations/'+filename,'utf8'));
  const accounts={};
  for(const [name,role,active,evaluated] of [['own','user','ativo',true],['other','user','ativo',true],['outside','user','ativo',false],['monitor','avaliador','ativo',false],['monitor2','avaliador','ativo',false],['admin','admin','ativo',false],['inactive','user','inativo',true]]){
   const password=randomBytes(24).toString('hex');
   const email=`${name}@example.test`;
   const created=ok(await request('/auth/v1/admin/users',status.SERVICE_ROLE_KEY,'POST',{email,password,email_confirm:true}));
   const id=created.id || created.user?.id;assert.ok(id);
   await db.query('INSERT INTO profiles(id,nome,email,role,ativo,avaliado) VALUES($1,$2,$3,$4,$5,$6)',[id,'Sintético',email,role,active,evaluated]);
   const session=ok(await request('/auth/v1/token?grant_type=password',null,'POST',{email,password}));
   assert.ok(session.access_token);accounts[name]={id,token:session.access_token,refresh:session.refresh_token,password};
  }
  for(const name of ['own','other','outside']){const note=makeNote(accounts[name].id,'2026-09');await db.query('INSERT INTO avaliacoes_mensais(colaborador_id,colaborador_nome,competencia,nota_monitoria,nota_cliente,nota_final,classificacao) VALUES($1,$2,$3,4,4,4,$4)',[note.colaborador_id,note.colaborador_nome,note.competencia,note.classificacao]);}
  await db.query("NOTIFY pgrst, 'reload schema'");
  let ready=false;
  for(let n=0;n<30;n++){const r=await request(notes+'?select=id',accounts.admin.token);if(r.status===200){ready=true;break;}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'PostgREST schema reload');
  await t.test('login válido e identidade confirmada pelo Auth',async()=>{
   assert.equal(ok(await request('/auth/v1/user',accounts.own.token)).id,accounts.own.id);
   denied(await request('/auth/v1/token?grant_type=password',null,'POST',{email:'own@example.test',password:'wrong'}));
  });
  await t.test('sem sessão e token inválido não recebem notas',async()=>{
   const anon=await request(notes);if(anon.status===200)assert.deepEqual(anon.data,[]);else denied(anon);
   denied(await request(notes,'invalid-token'));
  });
  await t.test('colaborador lê só própria nota; ID de terceiro não contorna RLS',async()=>{
   assert.deepEqual(ok(await request(notes,accounts.own.token)).map(x=>x.colaborador_id),[accounts.own.id]);
   assert.deepEqual(ok(await request(notes+'?colaborador_id=eq.'+accounts.other.id,accounts.own.token)),[]);
  });
  await t.test('ambos monitores leem somente grupo; ADM lê todos; inativo nenhum',async()=>{
   for(const who of ['monitor','monitor2'])assert.equal(ok(await request(notes,accounts[who].token)).length,2);
   assert.equal(ok(await request(notes,accounts.admin.token)).length,3);
   assert.deepEqual(ok(await request(notes,accounts.inactive.token)),[]);
  });
  await t.test('INSERT permitido aos dois monitores no grupo; fora do grupo negado',async()=>{
   for(const [who,month] of [['monitor','2026-10'],['monitor2','2026-11']])assert.equal(ok(await request(notes,accounts[who].token,'POST',makeNote(accounts.own.id,month))).length,1);
   denied(await request(notes,accounts.monitor.token,'POST',makeNote(accounts.outside.id)));
   denied(await request(notes,accounts.own.token,'POST',makeNote(accounts.own.id,'2026-12')));
   assert.equal((await db.query("SELECT count(*)::int n FROM avaliacoes_mensais WHERE competencia='2026-12'")).rows[0].n,0);
  });
  await t.test('UPDATE monitor autorizado; reatribuição e escrita alheia bloqueadas',async()=>{
   const url=notes+'?colaborador_id=eq.'+accounts.own.id+'&competencia=eq.2026-10';
   assert.equal(ok(await request(url,accounts.monitor.token,'PATCH',{observacao:'Revisão sintética'})).length,1);
   denied(await request(url,accounts.monitor.token,'PATCH',{colaborador_id:accounts.outside.id}));
   assert.deepEqual(ok(await request(url,accounts.other.token,'PATCH',{nota_monitoria:5})),[]);
   assert.equal((await db.query("SELECT nota_monitoria::text n FROM avaliacoes_mensais WHERE colaborador_id=$1 AND competencia='2026-10'",[accounts.own.id])).rows[0].n,'4.00');
  });
  await t.test('DELETE comum/monitor não remove; ADM pode remover',async()=>{
   const url=notes+'?competencia=eq.2026-11';
   for(const who of ['own','monitor'])assert.deepEqual(ok(await request(url,accounts[who].token,'DELETE')),[]);
   assert.equal(ok(await request(url,accounts.admin.token,'DELETE')).length,1);
  });
  await t.test('campos de autorização não podem ser alterados pelo usuário',async()=>{
   for(const change of [{role:'admin'},{avaliado:false},{ativo:'inativo'},{departamento:'Outro'},{email:'changed@example.test'}]){
    const r=await request('/rest/v1/profiles?id=eq.'+accounts.own.id,accounts.own.token,'PATCH',change);denied(r);assert.equal(r.data.code,'42501');
   }
  });
  await t.test('RPC direta respeita perfil e bloqueia legado privilegiado',async()=>{
   denied(await request('/rest/v1/rpc/listar_colaboradores_avaliados',null,'POST',{}));
   assert.deepEqual(ok(await request('/rest/v1/rpc/listar_colaboradores_avaliados',accounts.own.token,'POST',{})),[]);
   assert.equal(ok(await request('/rest/v1/rpc/listar_colaboradores_avaliados',accounts.monitor.token,'POST',{})).length,2);
   denied(await request('/rest/v1/rpc/concluir_modulo',accounts.own.token,'POST',{p_colaborador_id:accounts.other.id,p_modulo_id:accounts.own.id}));
  });
  await t.test('rebaixamento e inativação aplicam-se mesmo com token já emitido',async()=>{
   await db.query("UPDATE profiles SET role='user' WHERE id=$1",[accounts.monitor2.id]);
   assert.deepEqual(ok(await request(notes,accounts.monitor2.token)),[]);
   await db.query("UPDATE profiles SET ativo='inativo' WHERE id=$1",[accounts.own.id]);
   assert.deepEqual(ok(await request(notes,accounts.own.token)),[]);
   await db.query("UPDATE profiles SET ativo='ativo' WHERE id=$1",[accounts.own.id]);
  });
  await t.test('Storage real: avatar próprio permitido; alheio e institucional negados',async()=>{
   ok(await request('/storage/v1/bucket',status.SERVICE_ROLE_KEY,'POST',{id:'materiais',name:'materiais',public:true}));
   ok(await request('/storage/v1/object/materiais/avatars/'+accounts.own.id+'/avatar',accounts.own.token,'POST','synthetic',true));
   for(const path of ['avatars/'+accounts.other.id+'/avatar','institucional/test.txt']){
    const r=await request('/storage/v1/object/materiais/'+path,accounts.own.token,'POST','synthetic',true);denied(r);assert.match(JSON.stringify(r.data),/row.level security/i);
   }
   ok(await request('/storage/v1/object/materiais/institucional/test.txt',accounts.admin.token,'POST','synthetic',true));
  });
  await t.test('logout revoga refresh; acesso JWT existente tem semântica distinta',async()=>{
   ok(await request('/auth/v1/logout',accounts.other.token,'POST'));
   denied(await request('/auth/v1/token?grant_type=refresh_token',null,'POST',{refresh_token:accounts.other.refresh}));
  });
  await verifyBrowser(t,status,accounts,db);
  const edge='/functions/v1/farol-validation';
  // Browser logout revokes sessions, so acquire fresh local sessions for this phase.
  for(const who of ['own','inactive']){
   const session=ok(await request('/auth/v1/token?grant_type=password',null,'POST',{email:who+'@example.test',password:accounts[who].password}));
   accounts[who].token=session.access_token;
  }
  let edgeReady=false;
  for(let n=0;n<90;n++){
   try{const r=await request(edge,accounts.own.token,'POST',{pergunta:'ready',base:''});if(r.status===200){edgeReady=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,1000));
  }
  assert.ok(edgeReady,'Local Edge Runtime must start and execute actual handler');
  async function edgeCall(token,body,method='POST'){
   const headers={apikey:status.ANON_KEY,'Content-Type':'application/json'};
   if(token)headers.Authorization='Bearer '+token;
   const r=await fetch(status.API_URL+edge,{method,headers,body:method==='OPTIONS'?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
   const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
   return {status:r.status,data,calls:r.headers.get('x-test-model-calls')};
  }
  await t.test('Edge Runtime real: gateway rejeita ausência de token e token inválido',async()=>{
   for(const token of [null,'invalid'])assert.equal((await edgeCall(token,{pergunta:'teste'})).status,401);
  });
  await t.test('Edge Runtime real: inativo bloqueado antes de chamar provedor',async()=>{
   const r=await edgeCall(accounts.inactive.token,{pergunta:'teste'});assert.equal(r.status,403);assert.equal(r.calls,'0');
  });
  await t.test('Edge Runtime real: ativo recebe resposta e CORS funciona',async()=>{
   const r=await edgeCall(accounts.own.token,{pergunta:'teste',base:''});assert.equal(r.status,200);assert.equal(r.calls,'1');assert.equal(r.data.resposta,'Resposta sintética do provedor isolado');
   assert.equal((await edgeCall(null,null,'OPTIONS')).status,200);
  });
  await t.test('Edge Runtime real: entrada vazia e quota tratadas sem expor detalhe',async()=>{
   const invalid=await edgeCall(accounts.own.token,{pergunta:''});assert.equal(invalid.status,400);assert.equal(invalid.calls,'0');
   const quota=await edgeCall(accounts.own.token,{pergunta:'simulate-quota'});assert.equal(quota.status,429);assert.equal(quota.data.categoria,'quota');assert.ok(!JSON.stringify(quota.data).includes('private-provider-detail'));
  });
  await t.test('rollback restaura policies anteriores e preserva notas',async()=>{
   const before=(await db.query('SELECT count(*)::int n FROM avaliacoes_mensais')).rows[0].n;
   await db.query("SET farol.allow_unsafe_rollback='reviewed'");
   await db.query(readFileSync('ops/rollback-access-controls.sql','utf8'));
   assert.deepEqual(await policies(),baseline);
   assert.equal((await db.query('SELECT count(*)::int n FROM avaliacoes_mensais')).rows[0].n,before);
  });
 }finally{await db.end();}
});
