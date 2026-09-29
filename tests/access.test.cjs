const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const access=require('../assets/access-control.js');
function client(user,profile,error=null){return {auth:{getUser:async()=>({data:{user},error})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile})})})})};}
const profile={id:'u',nome:'Pessoa',role:'user',ativo:'ativo',avaliado:true};
test('getUser obrigatório: sem identidade ou perfil não existe acesso',async()=>{
 await assert.rejects(access.readIdentity(client(null,profile)));
 await assert.rejects(access.readIdentity(client({id:'u'},null)));
 await assert.rejects(access.readIdentity(client({id:'u'},{...profile,id:'outro'})));
 await assert.rejects(access.readIdentity(client({id:'u'},profile,new Error('expirada'))));
});
test('inativo bloqueado; cargos organizacionais não concedem privilégio',async()=>{
 await assert.rejects(access.readIdentity(client({id:'u'},{...profile,ativo:'inativo'})));
 for(const role of ['gerente','diretora','coordenadora','admin-juridico-credito'])assert.equal(access.roleFor({...profile,role}),'user');
 assert.equal(access.roleFor({...profile,role:'avaliador'}),'avaliador');
 assert.equal(access.roleFor({...profile,role:'admin'}),'admin');
});
test('usuário, monitor e ADM têm navegação compatível com a decisão',()=>{
 for(const role of ['user','avaliador','admin'])for(const page of ['dashboard','faq','trilha-onboarding','central-conhecimento'])assert.ok(access.canOpen(role,page));
 for(const page of ['admin-users','admin-materiais','gestor','executivo','avaliador-5e'])assert.equal(access.canOpen('user',page),false);
 assert.ok(access.canOpen('avaliador','avaliador-5e'));assert.equal(access.canOpen('avaliador','gestor'),false);
 assert.ok(access.canOpen('admin','avaliador-5e'));
});
test('HTML válido e autenticação sem fallback local; eventos sem logout reentrante',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 const auth=html.slice(html.indexOf('async function checkAuthState()'),html.indexOf('// ==================== UI HELPERS'));
 assert.ok(!auth.includes('localStorage'));assert.ok(auth.includes('FarolAccess.readIdentity'));
 assert.ok(!html.includes('Object.assign(SUPABASE_CONFIG'));
 assert.ok(!html.includes('if (currentUser) logout()'));
});
test('logout seguro com campos antigos ausentes e erro de signOut',async()=>{
 const html=fs.readFileSync('index.html','utf8');
 const src=html.slice(html.indexOf('let authEpoch ='),html.indexOf('// Validate URL-based access'));
 let calls=0;const messages=[];
 const ctx={supabaseClient:{removeAllChannels(){},auth:{signOut:async()=>{calls++;return {error:new Error('rede')}}}},currentUser:{},currentRole:'admin',userProgress:{},allUsers:[],gestorDados:[],searchMaterialsCache:[],realtimeChannel:null,
 window:{},localStorage:{removeItem(){}},CONFIG:{STORAGE_USER:'re_user'},document:{getElementById(){return null}},showNotification:(message,type)=>messages.push(type)};
 vm.createContext(ctx);vm.runInContext(src,ctx);await ctx.logout();
 assert.equal(ctx.currentUser,null);assert.equal(calls,1);assert.deepEqual(messages,['warning']);
});
test('resposta de login pendente não reabre a tela após logout',async()=>{
 const html=fs.readFileSync('index.html','utf8');
 const src=html.slice(html.indexOf('let authEpoch ='),html.indexOf('// Validate URL-based access'));
 const check=html.slice(html.indexOf('async function checkAuthState()'),html.indexOf('// ==================== UI HELPERS'));
 let finish;const pending=new Promise(r=>finish=r);let opens=0;
 const ctx={supabaseClient:{removeAllChannels(){}},currentUser:null,currentRole:null,userProgress:{},allUsers:[],gestorDados:[],searchMaterialsCache:[],realtimeChannel:null,window:{},localStorage:{removeItem(){}},CONFIG:{STORAGE_USER:'re_user'},document:{getElementById(){return null}},FarolAccess:{readIdentity:()=>pending},showApp(){opens++},hideLoginScreen(){},navigateTo(){},loadProgressFromSupabase(){}};
 vm.createContext(ctx);vm.runInContext(src+'\n'+check,ctx);const run=ctx.checkAuthState();ctx.clearAuthenticatedState();finish({...profile,role:'admin'});assert.equal(await run,false);assert.equal(opens,0);
});
test('troca de usuário aguarda signOut; login direto é bloqueado enquanto pendente',async()=>{
 const html=fs.readFileSync('index.html','utf8');
 const src=html.slice(html.indexOf('async function loginUser()'),html.indexOf('// Validate URL-based access'));
 let finish,signIns=0;const pending=new Promise(r=>finish=r);
 const fields=Object.fromEntries(['userEmailInput','userPasswordInput','btnLoginUser'].map(id=>[id,{disabled:false,value:'sintético'}]));
 const ctx={supabaseClient:{removeAllChannels(){},auth:{signOut:()=>pending,signInWithPassword(){signIns++;}}},currentUser:{},currentRole:'user',userProgress:{},allUsers:[],gestorDados:[],searchMaterialsCache:[],realtimeChannel:null,window:{},localStorage:{removeItem(){}},CONFIG:{STORAGE_USER:'re_user'},document:{getElementById:id=>fields[id]||null},showNotification(){}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const closing=ctx.logout();
 assert.ok(Object.values(fields).every(f=>f.disabled));
 await ctx.loginUser();assert.equal(signIns,0);
 finish({error:null});await closing;
 assert.ok(Object.values(fields).every(f=>!f.disabled));
});
