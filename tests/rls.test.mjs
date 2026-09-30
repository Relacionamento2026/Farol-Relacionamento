import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('RLS e rollback em PostgreSQL local com identidades sintéticas',async t=>{
 const db=new PGlite();
 async function as(id,sql,params=[],role='authenticated'){
  await db.exec('BEGIN');
  try{await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role})]);await db.exec('SET LOCAL ROLE '+role);return await db.query(sql,params);}
  finally{await db.exec('ROLLBACK');}
 }
 try{
  await db.exec(fs.readFileSync('tests/fixtures/schema.sql','utf8'));
  for(const [n,role,active,evaluated] of [[1,'user','ativo',true],[2,'user','ativo',true],[3,'user','ativo',false],[4,'avaliador','ativo',false],[5,'admin','ativo',false],[6,'avaliador','inativo',false],[7,'coordenadora','ativo',false]]){
   await db.query('INSERT INTO profiles(id,nome,email,role,ativo,avaliado) VALUES($1,$2,$3,$4,$5,$6)',[uid(n),'Pessoa '+n,`p${n}@example.test`,role,active,evaluated]);
  }
  for(const n of [1,2,3])await db.query("INSERT INTO avaliacoes_mensais(colaborador_id,colaborador_nome,competencia,nota_monitoria,nota_cliente,nota_final,classificacao) VALUES($1,$2,'2026-09',4,4,4,'nao_elegivel')",[uid(n),'Pessoa '+n]);
  await t.test('fixture reproduz acesso anônimo pela RPC antes da correção',async()=>assert.equal((await as(null,'SELECT * FROM listar_colaboradores_avaliados()',[],'anon')).rows.length,2));
  const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_access_controls.sql'));
  await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
  await t.test('usuário lê só sua nota; cargo de coordenadora não lê terceiros',async()=>{
   const own=await as(uid(1),'SELECT colaborador_id FROM avaliacoes_mensais');assert.deepEqual(own.rows.map(x=>x.colaborador_id),[uid(1)]);
   assert.equal((await as(uid(7),'SELECT * FROM avaliacoes_mensais')).rows.length,0);
  });
  await t.test('monitor lê somente avaliados; ADM lê todas; inativo não lê',async()=>{
   assert.equal((await as(uid(4),'SELECT * FROM avaliacoes_mensais')).rows.length,2);
   assert.equal((await as(uid(5),'SELECT * FROM avaliacoes_mensais')).rows.length,3);
   assert.equal((await as(uid(6),'SELECT * FROM avaliacoes_mensais')).rows.length,0);
  });
  await t.test('RPC anônima negada; user sem listagem; monitor recebe seu grupo',async()=>{
   await assert.rejects(as(null,'SELECT * FROM listar_colaboradores_avaliados()',[],'anon'),e=>e.code==='42501');
   assert.equal((await as(uid(1),'SELECT * FROM listar_colaboradores_avaliados()')).rows.length,0);
   assert.equal((await as(uid(4),'SELECT * FROM listar_colaboradores_avaliados()')).rows.length,2);
  });
  await t.test('user não escreve nota; monitor escreve só no grupo; ADM escreve',async()=>{
   const sql="INSERT INTO avaliacoes_mensais(colaborador_id,colaborador_nome,competencia,nota_monitoria,nota_cliente,nota_final,classificacao) VALUES($1,'Pessoa','2026-10',4,4,4,'nao_elegivel') RETURNING id";
   await assert.rejects(as(uid(1),sql,[uid(1)]),e=>e.code==='42501');
   assert.equal((await as(uid(4),sql,[uid(1)])).rows.length,1);
   await assert.rejects(as(uid(4),sql,[uid(3)]),e=>e.code==='42501');
   await assert.rejects(as(uid(6),sql,[uid(1)]),e=>e.code==='42501');
   assert.equal((await as(uid(5),sql,[uid(3)])).rows.length,1);
  });
  await t.test('monitor não reatribui avaliação para fora do grupo',async()=>{
   await assert.rejects(as(uid(4),"UPDATE avaliacoes_mensais SET colaborador_id=$1 WHERE colaborador_id=$2",[uid(3),uid(1)]),e=>e.code==='42501');
   assert.equal((await as(uid(1),'UPDATE avaliacoes_mensais SET nota_monitoria=5 WHERE colaborador_id=$1 RETURNING id',[uid(2)])).rows.length,0);
  });
  await t.test('campos pessoais podem mudar; acesso e monitorado não',async()=>{
   assert.equal((await as(uid(1),"UPDATE profiles SET nome='Nome novo' WHERE id=auth.uid() RETURNING id")).rows.length,1);
   for(const expr of ["role='admin'","ativo='inativo'","avaliado=false","departamento='Outro'",`gestor_id='${uid(5)}'`])await assert.rejects(as(uid(1),`UPDATE profiles SET ${expr} WHERE id=auth.uid()`),e=>e.code==='42501');
  });
  await t.test('Storage permite avatar próprio e nega arquivo alheio/institucional',async()=>{
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('materiais',$1)",['avatars/'+uid(2)+'/avatar']);
   const sql="INSERT INTO storage.objects(bucket_id,name) VALUES('materiais',$1) RETURNING id";
   assert.equal((await as(uid(1),sql,['avatars/'+uid(1)+'/avatar'])).rows.length,1);
   await assert.rejects(as(uid(1),sql,['institucional/documento.pdf']),e=>e.code==='42501');
   assert.equal((await as(uid(1),'UPDATE storage.objects SET owner_id=$1 RETURNING id',[uid(1)])).rows.length,0);
   assert.equal((await as(uid(5),sql,['institucional/documento.pdf'])).rows.length,1);
  });
  await t.test('RPCs legadas mutantes não aceitam clientes anônimos ou comuns',async()=>{
   for(const role of ['anon','authenticated'])await assert.rejects(as(uid(1),'SELECT concluir_modulo($1,$2)',[uid(2),uid(1)],role),e=>e.code==='42501');
  });
  await t.test('rollback exige aceite explícito e restaura baseline local',async()=>{
   const rollback=fs.readFileSync('ops/rollback-access-controls.sql','utf8');
   await assert.rejects(db.exec(rollback));await db.exec('ROLLBACK');
   await db.exec("SET farol.allow_unsafe_rollback='reviewed'");await db.exec(rollback);
   assert.equal((await as(null,'SELECT * FROM listar_colaboradores_avaliados()',[],'anon')).rows.length,2);
  });
 }finally{await db.close();}
});
