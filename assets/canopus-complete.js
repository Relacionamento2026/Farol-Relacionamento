/* Canopus workspace revision. Presentation only; existing actions and authorization stay authoritative. */
(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icon=n=>svgIcon('fa-'+n);
const el=(tag,cls,html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;};
const button=(text,action,cls='cu-link')=>{const b=el('button',cls);b.type='button';b.textContent=text;b.onclick=action;return b;};
const heading=(name,sub)=>el('div','cu-section-heading',`<h2>${name}</h2>${sub?`<p>${sub}</p>`:''}`);
const panel=(title)=>el('section','cu-panel',`<header><h2>${title}</h2></header>`);
const routeButton=(text,route,cls)=>button(text,()=>navigateTo(route),cls);
let generation=0, homeUser=null;
document.body.classList.add('canopus-complete');
// Compact navigation matches the approved reference. Identity remains available in the top bar.
const sidebar=$('#sidebar');
const logoutButton=sidebar.querySelector('[onclick="logout()"]');if(logoutButton) sidebar.querySelector('.sidebar-footer')?.append(logoutButton);
$$('.nav-item').forEach(n=>{const labels={'dashboard':'Início','respostas-faq':'Consultas e FAQ','cinco-estrelas':'Meus resultados','trilha-onboarding':'Onboarding'};if(labels[n.dataset.page]){const span=n.querySelector('span');if(span)span.textContent=labels[n.dataset.page];else [...n.childNodes].filter(x=>x.nodeType===3&&x.textContent.trim()).forEach(x=>x.textContent=' '+labels[n.dataset.page]);}});
// Reuse the real search input and results, including keyboard behavior.
const search=$('.canopus-search');search.classList.add('cu-global-search');search.querySelector('input').placeholder='Buscar na plataforma…';$('.top-bar').prepend(search);
$('#dashSugestoes').hidden=true;
const intro=$('#dashSaudacao').parentElement;intro.classList.add('cu-home-intro');intro.insertBefore(el('p','cu-home-subtitle','Conhecimento e ferramentas para o seu dia a dia.'),$('#dashData')); 
const quick=$('.canopus-quick');quick.querySelectorAll('button').forEach(b=>b.insertAdjacentHTML('beforeend','<span class="cu-arrow" aria-hidden="true">›</span>'));
const last=quick.lastElementChild;last.id='cu-results-shortcut';
$('#page-user-profile').append($('#secaoConquistas'));
const scoreHero=$('#page-cinco-estrelas').children[1];scoreHero.classList.add('cu-score-hero');
const homeGrid=el('div','cu-home-grid');quick.after(homeGrid);
const progress=panel('Meu progresso');progress.id='cu-progress';progress.querySelector('header').append(routeButton('Ver jornada →','trilha-onboarding'));homeGrid.append(progress);
const notices=panel('Mural de avisos');notices.id='cu-notices';const noticeBody=el('div','cu-notice-list');noticeBody.id='cu-notice-list';notices.append(noticeBody);homeGrid.append(notices);
const materials=panel('Materiais recentes');materials.classList.add('cu-home-materials');materials.querySelector('header').append(routeButton('Ver conteúdos →','central-conhecimento'));const materialBody=el('div','cu-material-list');materialBody.id='cu-material-list';materials.append(materialBody);homeGrid.append(materials);
const empty=(node,text)=>{node.replaceChildren(el('p','cu-empty',text));};
function progressView(){
 if(!currentUser)return;
 const knowledgeNav=$('#nav-central-conhecimento');knowledgeNav.classList.remove('hidden');knowledgeNav.style.display='flex';
 const ids=['mod-onboarding-1','mod-onboarding-2','mod-onboarding-3','mod-onboarding-4'];
 const completed=ids.filter(id=>userProgress[id]?.completed).length,pct=Math.round(completed/ids.length*100);
 progress.querySelector('.cu-progress-body')?.remove();
 progress.append(el('div','cu-progress-body',`<div class="cu-ring" style="--progress:${pct}%" role="img" aria-label="${pct}% dos módulos internos concluídos"><div><strong>${pct}%</strong><span>Concluído</span></div></div><div><p><strong>${completed} de ${ids.length}</strong> módulos internos concluídos</p><div class="cu-steps" aria-hidden="true">${ids.map((_,i)=>`<i class="${i<completed?'done':''}"></i>`).join('')}</div><small>O progresso dos cursos externos é acompanhado na UNIC.</small></div>`));
 const canResults=currentRole==='admin'||currentUser.avaliado;
 last.onclick=()=>navigateTo(canResults?'cinco-estrelas':'user-profile');
 last.querySelector('strong').textContent=canResults?'Meus resultados':'Meu perfil';last.querySelector('span:not(.cu-arrow)').textContent=canResults?'Consulte suas notas e sua evolução.':'Consulte seus dados e sua atividade.';
}
async function homeData(force=false){
 if(!currentUser)return;progressView();if(homeUser===currentUser.id&&!force)return;
 const user=currentUser.id,ticket=++generation;homeUser=user;
 empty(noticeBody,'Carregando avisos…');empty(materialBody,'Carregando materiais…');
 const valid=()=>ticket===generation&&currentUser?.id===user;
 const results=await Promise.allSettled([
  supabaseClient.from('avisos').select('id,texto,criado_em').eq('ativo',true).order('criado_em',{ascending:false}).limit(3),
  supabaseClient.from('materiais').select('id,nome,descricao,modulo,criado_em').order('criado_em',{ascending:false}).limit(3)
 ]);if(!valid())return;
 const nr=results[0].status==='fulfilled'?results[0].value:null;
 if(!nr||nr.error)empty(noticeBody,'Não foi possível carregar os avisos. Tente atualizar a página.');
 else if(!nr.data?.length)empty(noticeBody,'Nenhum aviso publicado no momento.');
 else{noticeBody.replaceChildren();nr.data.forEach(a=>{const row=el('article','cu-notice');const p=el('p','');p.textContent=a.texto;row.append(p);if(a.criado_em){const t=el('time','');t.textContent=new Date(a.criado_em).toLocaleDateString('pt-BR');row.append(t);}noticeBody.append(row);});}
 const mr=results[1].status==='fulfilled'?results[1].value:null;
 if(!mr||mr.error)empty(materialBody,'Não foi possível carregar os materiais. Tente atualizar a página.');
 else if(!mr.data?.length)empty(materialBody,'Os materiais cadastrados aparecerão aqui.');
 else{materialBody.replaceChildren();mr.data.forEach(m=>{const b=button('',()=>navigateTo(m.modulo&&m.modulo.startsWith('mod-')?m.modulo:'central-conhecimento'),'cu-material');b.innerHTML=icon('file-alt');const text=el('span','');const title=el('strong','');title.textContent=m.nome||'Material';const sub=el('small','');sub.textContent=m.descricao||'Consultar material';text.append(title,sub);b.append(text);materialBody.append(b);});}
}
// Page structures: retain form controls, IDs and event listeners, move actual nodes.
function splitPage(id){const page=$('#page-'+id);const cards=[...page.children].filter(n=>n.classList.contains('admin-panel'));if(cards.length<2)return;const grid=el('div','cu-editor-layout');page.append(grid);cards.forEach(n=>grid.append(n));}
['admin-materiais','admin-treinamentos-unic'].forEach(splitPage);
const users=$('#page-admin-users');const userPanels=[...users.children].filter(n=>n.classList.contains('admin-panel'));if(userPanels[1]){const details=el('details','cu-help-details','<summary>Ajuda com acesso e recuperação de senha</summary>');userPanels[1].before(details);details.append(userPanels[1]);}
const userFilter=el('div','cu-filterbar','<label>Buscar colaborador<input id="cu-user-search" type="search" placeholder="Nome ou e-mail"></label><label>Perfil<select id="cu-user-role"><option value="">Todos os perfis</option><option value="admin">Administrador</option><option value="avaliador">Monitor</option><option value="user">Colaborador</option></select></label>');userPanels[0]?.insertBefore(userFilter,userPanels[0].querySelector('table'));
function filterUsers(){const q=normalizeText($('#cu-user-search').value),role=$('#cu-user-role').value;$$('#usersTableBody tr').forEach(row=>{const roleText=normalizeText(row.cells[2]?.textContent||'');row.hidden=!normalizeText(row.textContent).includes(q)||(!!role&&!roleText.includes(role==='user'?'colaborador':role==='avaliador'?'avaliador':'admin')&&!roleText.includes(role));});}
$('#cu-user-search').oninput=filterUsers;$('#cu-user-role').onchange=filterUsers;
const admin=$('#page-admin-dashboard');const adminNav=el('nav','cu-admin-shortcuts');[['users','Usuários','admin-users'],['file-alt','Conteúdos','admin-content'],['folder-open','Materiais','admin-materiais'],['graduation-cap','Onboarding','admin-treinamentos-unic'],['chart-line','Gestão','gestor']].forEach(([ico,name,route])=>{const b=routeButton('',route,'cu-admin-shortcut');b.innerHTML=icon(ico)+`<strong>${name}</strong><span>Gerenciar →</span>`;adminNav.append(b);});admin.querySelector('.page-header').after(adminNav);
// Monitor form and calculated result, followed by a full-width history.
const avGrid=$('#av5-grid');avGrid.classList.add('cu-monitor-grid');const right=avGrid.children[1];if(right?.children[1]){const history=right.children[1];history.classList.add('cu-panel','cu-monitor-history');avGrid.after(history);}avGrid.children[0]?.classList.add('cu-monitor-form');
// Executive and management views share the same metric and chart hierarchy.
$('#page-executivo').firstElementChild.classList.add('page-header');
const management=$('#page-gestor');const filters=$('#g-filtro-mes')?.closest('.admin-panel');if(filters)management.querySelector('.page-header').after(filters);
const mural=$('#g-mural-wrap');if(mural)management.append(mural);
// Course page: airy journey cards and a compact university banner.
const onboarding=$('#page-trilha-onboarding');onboarding.querySelector('.page-header h1').textContent='Sua jornada de relacionamento';onboarding.querySelector('.page-header p:last-child').classList.add('cu-onboarding-explainer');
const banner=el('section','cu-unic-banner',`<div><span class="cu-eyebrow">UNIVERSIDADE CANOPUS</span><h2>Aprender faz parte da nossa jornada.</h2><p>Aprofunde seus conhecimentos nos treinamentos oficiais da UNIC.</p><a href="https://auth.mobiliza.com.br/?service=https://canopus.mobiliza.com.br/" target="_blank" rel="noopener noreferrer">Acessar UNIC ↗</a></div><div class="cu-brand-art" aria-hidden="true">${sidebar.querySelector('.sidebar-logo').innerHTML}</div>`);onboarding.append(banner);
// Module: reading surface plus action column (existing completion action is retained).
const module=$('#page-module-generic'),moduleGrid=el('div','cu-module-layout'),moduleMain=el('div','cu-module-main'),moduleSide=panel('Próximos passos');module.append(moduleGrid);moduleGrid.append(moduleMain,moduleSide);['.hero','#mod-slides-container','#mod-pdf-section'].forEach(s=>{const n=module.querySelector(s);if(n)moduleMain.append(n);});moduleSide.append(el('p','cu-muted','Consulte o conteúdo e os materiais deste módulo.'));moduleSide.append($('#mod-hero-btn'));moduleSide.append(routeButton('Voltar para a jornada','trilha-onboarding'));
// FAQ: dedicated categories column and readable accordion.
$('#page-respostas-faq h1').textContent='Consultas e FAQ';const faqContent=$('#rfaq-faq').parentElement;faqContent.classList.add('cu-faq-workspace');const cats=$('#faqCategoriaChips');cats.classList.add('cu-category-list');
// Knowledge search now filters the already authorized cards.
const ckInput=$('.ck-search-box input');ckInput.setAttribute('aria-label','Buscar na Central de Conhecimento');ckInput.oninput=()=>{$$('.ck-card').forEach(c=>c.hidden=!normalizeText(c.textContent).includes(normalizeText(ckInput.value)));};
// Transform property cards into a list/detail workspace, retaining original contact controls.
function propertyWorkspace(){
 const list=$('#adm-lista'),cards=[...list.querySelectorAll('.adm-card')];if(!cards.length)return;
 const workspace=el('div','cu-property-workspace'),nav=el('nav','cu-property-list'),detail=el('div','cu-property-detail');nav.setAttribute('aria-label','Selecionar empreendimento');workspace.append(nav,detail);list.replaceChildren(workspace);
 cards.forEach((c,i)=>{c.removeAttribute('onclick');c.removeAttribute('onkeydown');c.removeAttribute('role');c.removeAttribute('tabindex');c.classList.add('expanded');c.hidden=i!==0;detail.append(c);const title=c.getAttribute('aria-label')||'Empreendimento';const b=button('',()=>{cards.forEach(x=>x.hidden=x!==c);[...nav.children].forEach(x=>x.setAttribute('aria-current',String(x===b)));},'cu-property-option');b.innerHTML=icon('building');const text=el('span','');text.textContent=title;b.append(text);b.dataset.search=c.dataset.busca;b.dataset.card=c.id;b.setAttribute('aria-current',String(i===0));nav.append(b);
 const body=c.querySelector('.adm-card-body');if(body){body.style.display='block';body.style.maxHeight='none';}c.querySelectorAll('[id^="adm-body-"]').forEach(n=>{n.style.display='block';n.style.maxHeight='none';});});
 $('#admFiltro').oninput=e=>{const q=normalizeText(e.target.value);[...nav.children].forEach(b=>b.hidden=!b.dataset.search.includes(q));const first=[...nav.children].find(b=>!b.hidden);if(first)first.click();else cards.forEach(c=>c.hidden=true);};
}
const oldToggleProperty=toggleAdmCard;toggleAdmCard=function(id){const option=$$('.cu-property-option').find(b=>b.dataset.card==='admcard-'+id);if(option)option.click();else oldToggleProperty(id);};
const oldFilterProperties=filtrarAdministradoras;filtrarAdministradoras=function(term){if($('.cu-property-workspace')){$('#admFiltro').value=term;$('#admFiltro').dispatchEvent(new Event('input'));}else oldFilterProperties(term);};
const oldProperties=renderAdministradoras;renderAdministradoras=function(data){oldProperties(data);propertyWorkspace();};
// Table wrappers ensure small screens scroll only inside tables, not the whole page.
$$('.page-section table').forEach(t=>{if(!t.parentElement.classList.contains('cu-table-scroll')){const wrap=el('div','cu-table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Tabela com rolagem horizontal');t.before(wrap);wrap.append(t);}});
const oldUpdate=updateDashboard;updateDashboard=function(){oldUpdate();homeData();};
const oldNav=navigateTo;navigateTo=function(page){oldNav(page);if($('#page-dashboard').classList.contains('active'))homeData();if(page==='user-profile')$('#page-user-profile').classList.add('cu-profile-page');};
const oldClear=clearAuthenticatedState;clearAuthenticatedState=function(){generation++;homeUser=null;empty(noticeBody,'');empty(materialBody,'');progress.querySelector('.cu-progress-body')?.remove();oldClear();};
window.CanopusUI={refreshHome:()=>homeData(true)};
})();
