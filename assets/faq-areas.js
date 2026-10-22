/* FAQ: one database record per response, grouped variants and area filters. */
(() => {
'use strict';
const AREAS=['Repasse','Assistência Técnica (ASTEC)','Relacionamento (RCC)'];
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let rows=[],area='Todas',topic='Todos os assuntos',generation=0;
function groupTitle(r){
 for(const prefix of ['Cessão de direitos','Distrato','Entrega de chaves','IPTU e condomínio']){
  if(r.pergunta.startsWith(prefix+' · '))return prefix;
 }
 return r.pergunta;
}
function subject(r){
 const s=norm(r.pergunta);
 if(/iptu|condominio/.test(s))return 'IPTU e condomínio';
 if(/cessao|distrato/.test(s))return 'Contratos';
 if(/vistoria|garantia|ordem de servico/.test(s))return 'Vistorias e assistência';
 if(/chaves|entrega do apartamento/.test(s))return 'Entrega de chaves';
 if(/financiamento|seguro|laudemio|habite-se|assessoria/.test(s))return 'Financiamento';
 if(/pagamento|boleto|cobranca|financeir|quitacao|correcao/.test(s))return 'Financeiro';
 return 'Atendimento';
}
function matches(r){
 const q=norm($('faqFiltro')?.value).trim();
 return (area==='Todas'||r.categoria===area)&&(topic==='Todos os assuntos'||subject(r)===topic)&&q.split(/\s+/).every(w=>norm(r.pergunta+' '+r.resposta+' '+r.categoria).includes(w));
}
function chips(){
 const box=$('faqCategoriaChips');if(!box)return;
 box.replaceChildren();box.style.display='flex';box.setAttribute('aria-label','Filtrar FAQ por área');
 const extras=[...new Set(rows.map(r=>r.categoria||'Geral'))].filter(a=>!AREAS.includes(a));
 for(const a of ['Todas',...AREAS,...extras]){
  const count=rows.filter(r=>a==='Todas'||(r.categoria||'Geral')===a).length;
  const b=make('button','faq-chip'+(a===area?' active':''));b.type='button';b.setAttribute('aria-pressed',String(a===area));
  b.append(make('span','',a),make('span','faq-count',String(count)));
  b.onclick=()=>{area=a;topic='Todos os assuntos';window._faqCategoriaAtiva=a==='Todas'?'__todos__':a;chips();topics();render();};box.append(b);
 }
}
function topics(){
 let box=$('faqAssuntos');if(!box){box=make('div','faq-topics');box.id='faqAssuntos';$('faqCategoriaChips').after(box);}
 box.replaceChildren();box.setAttribute('aria-label','Filtrar FAQ por assunto');
 const available=[...new Set(rows.filter(r=>area==='Todas'||r.categoria===area).map(subject))].sort();
 for(const t of ['Todos os assuntos',...available]){const b=make('button','faq-topic'+(topic===t?' active':''),t);b.type='button';b.setAttribute('aria-pressed',String(topic===t));b.onclick=()=>{topic=t;topics();render();};box.append(b);}
}
async function copy(text,b){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
  else{const ta=make('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(!ok)throw Error('copy');}
  b.textContent='Copiado!';setTimeout(()=>b.textContent='Copiar resposta',1800);
 }catch{showNotification('Não foi possível copiar. Selecione o texto da resposta para copiar.','error');}
}
function card(title,variants,visible){
 const item=make('details','faq-item faq-area-card');item.dataset.categoria=variants[0].categoria;
 const summary=make('summary','faq-area-question');
 const label=make('div','faq-area-title');label.append(make('span','faq-area-badge',variants[0].categoria),make('h3','',title));
 if(variants.length>1)label.append(make('small','',variants.length+' modelos por situação'));
 summary.append(label,make('span','faq-chevron','⌄'));item.append(summary);
 const body=make('div','faq-area-answer');let selected=visible[0]||variants[0];let select;
 if(variants.length>1){const field=make('label','faq-variant-label','Selecione a situação');select=make('select','faq-variant');select.setAttribute('aria-label','Situação para '+title);for(const r of variants){const o=make('option','',r.pergunta.slice(title.length+3));o.value=String(r.id);select.append(o);}select.value=String(selected.id);field.append(select);body.append(field);}
 const hint=make('p','faq-personalize');const answer=make('div','faq-response');const footer=make('div','faq-area-footer');const date=make('small');const btn=make('button','faq-copy','Copiar resposta');btn.type='button';btn.onclick=()=>copy(selected.resposta||'',btn);footer.append(date,btn);body.append(hint,answer,footer);item.append(body);
 function update(){answer.textContent=selected.resposta||'';hint.textContent='Preencha os dados do cliente e da unidade antes de enviar.';hint.hidden=!/\[[^\]]+\]|x{3,}|xx\/xx|xxh/i.test(selected.resposta||'');const d=new Date(selected.atualizado_em||selected.criado_em);date.textContent=Number.isNaN(d.getTime())?'':'Atualizada em '+d.toLocaleDateString('pt-BR');}
 if(select)select.onchange=()=>{selected=variants.find(r=>String(r.id)===select.value);update();};update();
 item.addEventListener('toggle',()=>{if(item.open)$('rfaq-faq-container').querySelectorAll('details[open]').forEach(d=>{if(d!==item)d.open=false;});});return item;
}
function render(){
 const container=$('rfaq-faq-container');if(!container)return;container.replaceChildren();container.style.display='block';container.classList.remove('hidden');
 const groups=new Map();for(const r of rows){const key=r.categoria+'|'+groupTitle(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const visible=rows.filter(matches);const count=make('p','faq-result-count',visible.length+' '+(visible.length===1?'modelo encontrado':'modelos encontrados')+(area==='Todas'?'':' · '+area));count.setAttribute('role','status');container.append(count);
 if(!visible.length){const empty=make('div','faq-no-results');empty.append(make('h3','','Nenhuma resposta encontrada'),make('p','','Tente outra palavra ou limpe os filtros.'));const clear=make('button','faq-copy','Limpar filtros');clear.type='button';clear.onclick=()=>{area='Todas';topic='Todos os assuntos';$('faqFiltro').value='';chips();topics();render();};empty.append(clear);container.append(empty);return;}
 const list=make('div','faq-area-list');for(const variants of groups.values()){const shown=variants.filter(matches);if(shown.length)list.append(card(groupTitle(variants[0]),variants,shown));}container.append(list);
}
window.filtrarFaq=()=>render();
window.filtrarFaqCategoria=cat=>{area=cat==='__todos__'?'Todas':cat;topic='Todos os assuntos';chips();topics();render();};
window.loadFaqForUser=async function(){
 const epoch=++generation,owner=currentUser?.id||currentUser?.email;
 const loading=$('rfaq-faq-loading'),empty=$('rfaq-faq-empty'),container=$('rfaq-faq-container');if(!container)return;
 loading.style.display='block';loading.classList.remove('hidden');empty.style.display='none';container.replaceChildren();container.style.display='none';rows=[];window._faqCache=[];
 $('faqCategoriaChips').style.display='none';$('faqAssuntos')?.replaceChildren();
 try{
  if(!supabaseClient)initSupabase();if(!supabaseClient)throw Error('connection');
  const result=await supabaseClient.from('faq').select('*').order('pergunta',{ascending:true});if(result.error)throw result.error;
  if(epoch!==generation||!currentUser||(currentUser.id||currentUser.email)!==owner)return;
  rows=result.data||[];window._faqCache=rows;chips();topics();render();
 }catch(e){if(epoch!==generation)return;container.style.display='block';const msg=make('div','faq-no-results');msg.append(make('p','','Não foi possível carregar as respostas. Tente novamente.'));const retry=make('button','faq-copy','Tentar novamente');retry.type='button';retry.onclick=()=>loadFaqForUser();msg.append(retry);container.replaceChildren(msg);}
 finally{if(epoch===generation)loading.style.display='none';}
};
const clear=window.clearAuthenticatedState;window.clearAuthenticatedState=function(){generation++;rows=[];area='Todas';topic='Todos os assuntos';$('rfaq-faq-container')?.replaceChildren();$('faqCategoriaChips')?.replaceChildren();$('faqAssuntos')?.replaceChildren();if($('faqFiltro'))$('faqFiltro').value='';return clear.apply(this,arguments);};
// New entries use the same three areas as the consultation page.
const field=$('faqCategoria');if(field){const select=make('select');select.id=field.id;select.className=field.className;select.required=true;for(const a of AREAS){const o=make('option','',a);o.value=a;select.append(o);}select.value='Relacionamento (RCC)';field.replaceWith(select);const label=document.querySelector('label[for=faqCategoria]');if(label)label.textContent='Área responsável';}
const reset=window.resetFaqForm;window.resetFaqForm=function(){reset();$('faqCategoria').value='Relacionamento (RCC)';};
const add=window.addFaqItem;window.addFaqItem=async function(){if(!AREAS.includes($('faqCategoria').value)){showNotification('Selecione a área responsável.','error');return;}return add();};
const title=document.querySelector('#page-respostas-faq h1');if(title)title.textContent='Respostas para cada atendimento';
const subtitle=document.querySelector('#page-respostas-faq .page-header p');if(subtitle)subtitle.textContent='Encontre o modelo certo, personalize e copie.';
if($('faqFiltro'))$('faqFiltro').placeholder='Buscar por assunto ou palavra-chave';
})();
