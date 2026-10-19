import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['tests/browser/server.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;const shots=[];
try{
 await mkdir('test-results/design',{recursive:true});browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:4173');
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;}'});
 const shot=async(name)=>{await page.screenshot({path:`test-results/design/${name}.png`,fullPage:true,animations:'disabled'});shots.push(name);};
 await shot('01-login');
 await page.evaluate(()=>{Object.assign(__farolMock.tables,{
  faq:[{id:'f1',pergunta:'Onde consultar os procedimentos de atendimento?',resposta:'Consulte os conteúdos disponíveis na Central de Conhecimento.',categoria:'Atendimento',criado_em:'2026-10-01'},{id:'f2',pergunta:'Como localizar os contatos de uma administradora?',resposta:'Abra Empreendimentos e selecione a ficha desejada.',categoria:'Condomínio',criado_em:'2026-10-02'},{id:'f3',pergunta:'Onde estão os treinamentos da área?',resposta:'Acesse Onboarding para consultar os links da Universidade Canopus.',categoria:'Treinamento',criado_em:'2026-10-03'}],
  administradoras:[{id:'a1',empreendimento:'Empreendimento de demonstração A',administradora:'Administradora de demonstração',telefone:'(11) 0000-0000',email:'exemplo@example.invalid',sindico_nome:'Contato demonstrativo'},{id:'a2',empreendimento:'Empreendimento de demonstração B',administradora:'Outra administradora',email:'contato@example.invalid'}],
  avisos:[{id:'v1',texto:'Exemplo de aviso: novos materiais disponíveis na plataforma.',criado_em:'2026-10-19'},{id:'v2',texto:'Exemplo de aviso: consulte a jornada de onboarding.',criado_em:'2026-10-18'}],
  materiais:[{id:'m1',nome:'Guia de atendimento · exemplo',descricao:'Material demonstrativo',modulo:'mod-onboarding-1',criado_em:'2026-10-19',url:'',tipo:'pdf'},{id:'m2',nome:'Procedimentos · exemplo',descricao:'Material demonstrativo',modulo:'mod-onboarding-1',criado_em:'2026-10-18',url:'',tipo:'pdf'},{id:'m3',nome:'Apresentação · exemplo',descricao:'Material demonstrativo',modulo:'mod-onboarding-1',criado_em:'2026-10-17',url:'',tipo:'pdf'}],
  central_conhecimento:[{id:'c1',titulo:'Procedimentos de atendimento',descricao_resumida:'Exemplo de conteúdo para revisão visual.',area:'Relacionamento',ativo:true},{id:'c2',titulo:'Documentos e orientações',descricao_resumida:'Exemplo de guia cadastrado na plataforma.',area:'Relacionamento',ativo:true}],
  avaliacoes_mensais:[{competencia:'2026-09',nota_monitoria:4.6,nota_cliente:4.8,nota_final:4.68},{competencia:'2026-08',nota_monitoria:4.5,nota_cliente:4.7,nota_final:4.58}]
 });});
 const login=async role=>{await page.locator('#userEmailInput').fill(role+'@example.invalid');await page.locator('#userPasswordInput').fill('simulated');await page.locator('#btnLoginUser').click();await page.waitForFunction(()=>currentUser&&document.getElementById('loginScreen').classList.contains('hidden'));};
 const navigate=async route=>{await page.evaluate(r=>navigateTo(r),route);await page.waitForTimeout(650);assert.equal(await page.locator('#page-'+(route.startsWith('mod-')?'module-generic':route)).evaluate(n=>n.classList.contains('active')),true,route);};
 const noOverflow=async route=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+route);};
 await login('user');await page.waitForTimeout(650);await page.evaluate(()=>CanopusUI.refreshHome());await shot('02-inicio');
 await page.locator('#farolChatLaunch').click();await shot('03-conversa-lateral');await page.evaluate(()=>FarolChat.close());
 const routes=[['respostas-faq','04-consultas-faq'],['administradoras','05-empreendimentos'],['trilha-onboarding','06-onboarding'],['central-conhecimento','07-central-conhecimento'],['cinco-estrelas','08-meus-resultados'],['user-profile','09-meu-perfil'],['mod-onboarding-1','10-modulo']];
 for(const [route,name] of routes){await navigate(route);await noOverflow(route);await shot(name);}
 await navigate('administradoras');assert.equal(await page.locator('.cu-property-option').count(),2);await page.locator('.cu-property-option').nth(1).click();assert.equal(await page.locator('.adm-card:visible').count(),1);await page.locator('#admFiltro').fill('demonstração A');assert.equal(await page.locator('.cu-property-option:visible').count(),1);
 await navigate('respostas-faq');await page.locator('#faqFiltro').fill('treinamentos');assert.equal(await page.locator('.faq-item:visible').count(),1);
 await page.evaluate(()=>logout());await login('monitor');await navigate('avaliador-5e');await shot('11-monitoria');
 await page.evaluate(()=>logout());await login('admin');
 const adminRoutes=[['admin-dashboard','12-administracao'],['admin-users','13-usuarios'],['admin-content','14-configuracoes-faq'],['admin-materiais','16-materiais'],['admin-treinamentos-unic','17-gerenciar-onboarding'],['gestor','18-gestao'],['executivo','19-executivo']];
 for(const [route,name] of adminRoutes){await navigate(route);await noOverflow(route);await shot(name);if(route==='admin-content'){await page.evaluate(()=>switchCmTab('adm'));await shot('15-configuracoes-empreendimentos');}}
 await page.setViewportSize({width:390,height:844});
 for(const [route,name] of [...routes,...adminRoutes,['dashboard','02-inicio'],['avaliador-5e','11-monitoria']]){await navigate(route);await noOverflow('mobile '+route);await shot('mobile-'+name);}
 await page.evaluate(()=>logout());await page.waitForTimeout(100);assert.doesNotMatch(await page.locator('#cu-notice-list').innerText(),/Exemplo/);
 assert.deepEqual(errors,[]);await writeFile('test-results/design/screens.json',JSON.stringify(shots,null,2));console.log('PASS: complete route inventory, populated and empty UI, property selection, FAQ search, desktop/mobile overflow, session cleanup; '+shots.length+' captures.');
}finally{await browser?.close();server.kill();}
