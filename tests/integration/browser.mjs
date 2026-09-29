import http from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

export async function verifyBrowser(t,status,accounts,db){
 assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:54321');
 // Serve the actual application and the SAME SDK version as its CDN dependency.
 // Only config/dependency URLs change in memory; production index.html is untouched.
 let html=readFileSync('index.html','utf8')
  .replace(/const SUPABASE_CONFIG = \{[\s\S]*?\n\};/,`const SUPABASE_CONFIG = ${JSON.stringify({URL:status.API_URL,ANON_KEY:status.ANON_KEY,BUCKET_NAME:'materiais'})};`)
  .replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js','/sdk.js')
  .replace('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js','/chart.js')
  .replace(/<link[^>]+href="https:[^>]+>/g,'');
 assert.ok(html.includes('URL":"http://127.0.0.1:54321"'));
 assert.ok(!html.includes(status.SERVICE_ROLE_KEY),'No administrative key in page');
 const routes={
  '/':['text/html',html],
  '/sdk.js':['text/javascript',readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js')],
  '/chart.js':['text/javascript',readFileSync('node_modules/chart.js/dist/chart.umd.js')],
  '/assets/access-control.js':['text/javascript',readFileSync('assets/access-control.js')]
 };
 const server=http.createServer((req,res)=>{
  const route=routes[new URL(req.url,'http://localhost').pathname];
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http://127.0.0.1:54321; connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321; font-src 'self'; frame-src 'none'; form-action 'none'");
  res.writeHead(route?200:404,{'Content-Type':route?.[0]||'text/plain'});res.end(route?.[1]||'Not found');
 });
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Real evaluation acknowledgement is modal; dismiss via its actual UI button.
  await page.addLocatorHandler(page.locator('#comemoracao5E'),async()=>{
   await page.locator('#comemoracao5E button').click();
  });
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   return url.hostname==='127.0.0.1'&&['4173','54321'].includes(url.port)?route.continue():route.abort();
  });
  const login=async name=>{
   await page.locator('#userEmailInput').fill(name+'@example.test');
   await page.locator('#userPasswordInput').fill(accounts[name].password);
   await page.locator('#btnLoginUser').click();
  };
  const logout=async()=>{await page.locator('.logout-btn').click();await page.waitForFunction(()=>currentUser===null && !logoutInFlight);};
  const identity=()=>page.evaluate(()=>({id:currentUser?.id,role:currentRole,login:!document.getElementById('loginScreen').classList.contains('hidden'),admin:getComputedStyle(document.getElementById('adminMenuSection')).display,monitor:getComputedStyle(document.getElementById('avaliadorMenuSection')).display,page:document.querySelector('.page-section.active')?.id}));
  await page.goto('http://127.0.0.1:4173');
  await t.test('navegador: login pela tela e restauração após recarga com SDK real',async()=>{
   assert.equal((await identity()).login,true);
   await login('own');await page.waitForFunction(()=>currentRole==='user');
   assert.equal((await identity()).id,accounts.own.id);
   await page.reload();await page.waitForFunction(()=>currentRole==='user');
   assert.equal((await identity()).id,accounts.own.id);
  });
  await t.test('navegador: própria nota; localStorage/objeto alterados não ampliam RLS',async()=>{
   await page.locator('#nav-cinco-estrelas').click();
   await page.waitForFunction(()=>document.querySelector('#page-cinco-estrelas.active'));
   const ids=await page.evaluate(async()=>{const r=await supabaseClient.from('avaliacoes_mensais').select('colaborador_id');if(r.error)throw new Error(r.error.code);return r.data.map(x=>x.colaborador_id);});
   assert.ok(ids.length>0&&ids.every(x=>x===accounts.own.id));
   const result=await page.evaluate(async()=>{
    localStorage.setItem('re_user',JSON.stringify({role:'admin'}));currentRole='admin';currentUser.role='admin';
    const r=await supabaseClient.from('profiles').update({role:'admin'}).eq('id',currentUser.id);
    return r.error?.code;
   });assert.equal(result,'42501');
   await page.reload();await page.waitForFunction(()=>currentRole==='user');
   assert.equal((await identity()).admin,'none');
  });
  await t.test('navegador: logout e login do monitor sem privilégios administrativos',async()=>{
   await logout();assert.equal((await identity()).login,true);
   await login('monitor');await page.waitForFunction(()=>currentRole==='avaliador');
   const s=await identity();assert.equal(s.admin,'none');assert.equal(s.monitor,'block');
   await page.waitForFunction(()=>document.querySelectorAll('.av5-colab-item').length===2);
   const emails=await page.locator('.av5-colab-item').evaluateAll(es=>es.map(e=>e.dataset.email).sort());
   assert.deepEqual(emails,['other@example.test','own@example.test']);
  });
  await t.test('navegador: monitor lança nota pelo formulário e dado persiste',async()=>{
   await page.locator('#av5-colab-display').click();
   await page.locator('.av5-colab-item[data-email="own@example.test"]').click();
   await page.locator('#av5-mon').fill('4.25');
   await page.locator('#av5-cli').fill('4.50');
   await page.locator('#av5-obs').fill('Lançamento navegador sintético');
   page.once('dialog',d=>d.accept());
   const response=page.waitForResponse(r=>r.url().includes('/rest/v1/avaliacoes_mensais')&&r.request().method()==='POST');
   await page.locator('#av5-btn-lancar').click();
   assert.ok((await response).ok(),'Server must confirm write');
   const row=(await db.query("SELECT nota_monitoria::text n FROM avaliacoes_mensais WHERE colaborador_id=$1 AND observacao='Lançamento navegador sintético'",[accounts.own.id])).rows;
   assert.equal(row.length,1);assert.equal(row[0].n,'4.25');
  });
  await t.test('navegador: ADM entra e rebaixamento fecha administração após recarga',async()=>{
   await logout();await login('admin');await page.waitForFunction(()=>currentRole==='admin');
   assert.equal((await identity()).admin,'block');assert.equal((await identity()).monitor,'block');
   await db.query("UPDATE profiles SET role='user' WHERE id=$1",[accounts.admin.id]);
   await page.reload();await page.waitForFunction(()=>currentRole==='user');
   assert.equal((await identity()).admin,'none');
   await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[accounts.admin.id]);
  });
  await t.test('navegador: perfil inativo permanece bloqueado após autenticar',async()=>{
   await logout();await login('inactive');
   await page.waitForFunction(()=>!document.getElementById('btnLoginUser').disabled);
   assert.equal((await identity()).login,true);assert.equal((await identity()).id,undefined);
  });
  await t.test('navegador: sem exceções JavaScript não tratadas nos fluxos',()=>assert.deepEqual(errors,[]));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
