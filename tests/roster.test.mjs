import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import roster from '../ops/prepare-roster.cjs';
const rows=Array.from({length:19},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,email:`p${i+1}@example.test`,role:i===18?'admin':'user',ativo:'ativo',avaliado:false}));
const decision={monitored:rows.slice(0,10).map(x=>x.email),monitors:rows.slice(10,12).map(x=>x.email),departed:rows.slice(12,18).map(x=>x.email)};
test('gerador rejeita qualquer outro projeto e seleção inconsistente',()=>{
 assert.throws(()=>roster.prepare('unrelated-project',rows,decision));
 assert.throws(()=>roster.prepare(roster.PROJECT,rows,{...decision,monitors:[]}));
 assert.throws(()=>roster.prepare(roster.PROJECT,rows,{...decision,departed:[...decision.departed.slice(0,5),decision.monitored[0]]}));
});
test('seleção aplica 10 monitorados/2 monitores/6 inativos e rollback restaura perfis sem apagar notas',async()=>{
 const db=new PGlite();
 try{
  await db.exec(fs.readFileSync('tests/fixtures/schema.sql','utf8'));
  for(const r of rows) await db.query('INSERT INTO profiles(id,email,role,ativo,avaliado) VALUES($1,$2,$3,$4,$5)',[r.id,r.email,r.role,r.ativo,r.avaliado]);
  const sql=roster.prepare(roster.PROJECT,rows,decision);
  await db.exec(sql.apply);
  const counts=(await db.query("SELECT count(*) FILTER(WHERE avaliado) AS monitored,count(*) FILTER(WHERE role='avaliador') AS monitors,count(*) FILTER(WHERE ativo='inativo') AS departed FROM profiles")).rows[0];
  assert.deepEqual(Object.values(counts),[10,2,6]);
  await db.exec(sql.rollback);
  assert.deepEqual((await db.query('SELECT id,email,role,ativo,avaliado FROM profiles ORDER BY id')).rows,rows);
  await db.exec("UPDATE profiles SET role='gestor' WHERE email='p1@example.test'");
  await assert.rejects(db.exec(sql.apply),/Snapshot divergente/);await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT count(*) AS n FROM profiles WHERE ativo='inativo'")).rows[0].n,0);
 }finally{await db.close();}
});
