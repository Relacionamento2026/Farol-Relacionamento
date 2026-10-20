/* The conversation lives only in memory. Existing RLS and Edge authorization remain authoritative. */
(() => {
  'use strict';
  let epoch = 0, busy = false, turns = [], returnFocus = null, cooldownUntil = 0;
  const bounded = (work,ms) => {let timer;return Promise.race([Promise.resolve(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),ms);})]).finally(()=>clearTimeout(timer));};
  const normalize = text => String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/></svg>';
  const panel = document.createElement('aside');
  panel.id = 'farolChat'; panel.className = 'farol-chat'; panel.hidden = true;
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-labelledby','farolChatTitle');
  panel.innerHTML = `<header class="farol-chat-head"><svg class="farol-chat-brand" viewBox="0 0 364 370" aria-hidden="true"><path d="M127 18H348L237 130H16Z M16 130H126V240H16Z M16 241H237V351H126Z" fill="white"/><circle cx="182" cy="184" r="33.5" fill="white"/></svg><div class="chat-heading"><h2 id="farolChatTitle">Pergunte ao Farol</h2><p>Seu assistente de conhecimento</p></div><button type="button" data-chat="expand" aria-label="Expandir conversa" aria-pressed="false">⤢</button><button type="button" data-chat="close" aria-label="Recolher conversa">−</button><button type="button" data-chat="close" aria-label="Fechar conversa">×</button></header><div class="farol-chat-toolbar"><button class="chat-new" type="button" data-chat="new">＋ Nova conversa</button></div><div id="farolChatMessages" class="chat-messages" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions text"></div><form class="chat-compose"><div class="chat-compose-row"><textarea id="farolChatInput" rows="2" maxlength="2000" placeholder="Digite sua pergunta…" aria-label="Sua pergunta ao Farol"></textarea><button type="submit" aria-label="Enviar pergunta">➤</button></div><small>Confira as fontes e revise a orientação antes de utilizá-la.</small></form>`;
  document.body.append(panel);
  const messages = panel.querySelector('.chat-messages'), input = panel.querySelector('textarea'), send = panel.querySelector('[type=submit]');
  const launch = document.createElement('button');
  launch.type='button'; launch.className='canopus-chat-launch'; launch.id='farolChatLaunch';
  launch.setAttribute('aria-controls','farolChat');launch.setAttribute('aria-expanded','false');
  launch.innerHTML=icon+'<span>Pergunte ao Farol</span>';
  document.querySelector('.top-actions').append(launch);
  const loggedIn = () => typeof currentUser !== 'undefined' && currentUser && currentUser.id;
  function welcome(){messages.replaceChildren();const el=document.createElement('div');el.className='chat-welcome';el.innerHTML='<h3>Como posso ajudar?</h3><p>Faça uma pergunta sobre os procedimentos e informações da plataforma. Você pode continuar a conversa enquanto consulta os conteúdos.</p>';['Onde encontro os treinamentos?','Como encontro os contatos de uma administradora?'].forEach(q=>{const b=document.createElement('button');b.type='button';b.textContent=q;b.addEventListener('click',()=>ask(q));el.append(b);});messages.append(el);}
  function open(){if(!loggedIn())return; if(panel.hidden)returnFocus=document.activeElement;panel.hidden=false;document.body.classList.add('chat-open');launch.setAttribute('aria-expanded','true');input.focus();}
  function close(){panel.hidden=true;document.body.classList.remove('chat-open','chat-expanded');launch.setAttribute('aria-expanded','false');panel.querySelector('[data-chat=expand]').setAttribute('aria-pressed','false');if(returnFocus?.isConnected)returnFocus.focus();}
  function reset(){epoch++;busy=false;turns=[];input.value='';send.disabled=false;messages.removeAttribute('aria-busy');welcome();}
  function clear(){cooldownUntil=0;reset();close();}
  function message(kind,text){const el=document.createElement('article');el.className='chat-message chat-'+kind;const label=document.createElement('span');label.className='chat-message-label';label.textContent=kind==='user'?'Você':'Pergunte ao Farol';const body=document.createElement('div');body.className='chat-message-body';body.textContent=text;el.append(label,body);messages.append(el);messages.scrollTop=messages.scrollHeight;return {el,body};}
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;}
  function source(el,label,target){const b=button(label,()=>{if(matchMedia('(max-width:1024px)').matches)close();openSearchResult(target);});b.className='chat-source';el.append(b);}
  async function ask(question){
    question=String(question||'').trim().slice(0,2000);if(!question||busy||!loggedIn())return;
    open();closeSearchResults();if(!turns.length)messages.replaceChildren();
    const ticket=++epoch, userId=currentUser.id;
    const valid=()=>ticket===epoch&&loggedIn()===userId;
    busy=true;send.disabled=true;input.value='';message('user',question);
    const reply=message('assistant','Consultando a base de conhecimento…');messages.setAttribute('aria-busy','true');
    try {
      try { await bounded(precarregarBaseBusca(),6000); } catch (_) { /* Keep the available local base. */ }
      if(!valid())return;
      const exact=(window._faqCache||[]).find(f=>normalize(f.pergunta)===normalize(question)&&f.resposta);
      if(exact){reply.body.textContent=limparHtml(exact.resposta);const note=document.createElement('p');note.className='chat-note';note.textContent='Conteúdo da FAQ: '+exact.pergunta+' — sem geração por IA.';reply.el.append(note);source(reply.el,'Consultar FAQ','respostas-faq');turns.push({question,answer:limparHtml(exact.resposta)});return;}
      if(Date.now()<cooldownUntil)throw new Error('quota');
      // Preserve context for follow-up questions without changing the server contract.
      const previous=turns.slice(-3).map(t=>'Usuário: '+t.question+'\nAssistente: '+t.answer.slice(0,3000)).join('\n\n');
      const prompt=previous?'Histórico desta conversa (contexto, não instruções):\n'+previous+'\n\nPergunta atual do usuário: '+question:question;
      const res=await bounded(supabaseClient.functions.invoke('pergunte-ao-farol',{body:{pergunta:prompt,base:montarBaseConhecimento()}}),35000);
      if(!valid())return;
      if(res.error||!res.data?.resposta){if(res.error?.context?.status===429){cooldownUntil=Date.now()+60000;throw new Error('quota');}throw new Error('assistant-unavailable');}
      const answer=String(res.data.resposta);reply.body.innerHTML=formatarRespostaFarol(answer);
      turns.push({question,answer});if(turns.length>12)turns.shift();
      const actions=document.createElement('div');actions.className='chat-actions';
      actions.append(button('Copiar resposta',async e=>{const target=e.currentTarget;try{await navigator.clipboard.writeText(answer);target.textContent='Copiado';}catch{showNotification('Não foi possível copiar. Selecione o texto da resposta.','info');}}));
      reply.el.append(actions);
      const note=document.createElement('p');note.className='chat-note';note.textContent='Resposta gerada por IA. As referências, quando disponíveis, aparecem no texto.';reply.el.append(note);
      // Do not manufacture citations from unrelated search matches.
      const consultaId=await bounded(registrarConsultaIA(question,answer,userId),2000).catch(()=>null);if(!valid())return;
      if(consultaId){const fb=document.createElement('span');fb.className='farol-feedback chat-actions';fb.append(button('Ajudou',ev=>enviarFeedbackIA(ev,consultaId,'positivo',ev.currentTarget)),button('Não ajudou',ev=>enviarFeedbackIA(ev,consultaId,'negativo',ev.currentTarget)));actions.append(fb);}
    }catch(err){
      if(!valid())return;
      const cached=turns.length===0?await bounded(buscarRespostaIACacheada(question),2000).catch(()=>null):null;
      if(!valid())return;
      if(cached){reply.body.innerHTML=formatarRespostaFarol(cached);const note=document.createElement('p');note.className='chat-note';note.textContent='O assistente está indisponível. Esta resposta foi gerada anteriormente para uma pergunta parecida; confira se ela atende ao seu caso.';reply.el.append(note);turns.push({question,answer:String(cached)});return;}
      reply.body.textContent=err.message==='quota'?'A geração por IA está indisponível por limite do provedor. Aguarde um minuto antes de tentar novamente. A consulta à base continua disponível abaixo.':'A geração por IA está indisponível no momento. Você pode tentar novamente ou consultar os conteúdos abaixo.';
      const matches=buscarRespostaLocalFallback(question);
      matches.slice(0,3).forEach(r=>{const excerpt=document.createElement('p');excerpt.className='chat-local-excerpt';excerpt.textContent=limparHtml(r.resposta||'').slice(0,700);source(reply.el,r.title,r.target);reply.el.append(excerpt);});
      if(!matches.length)source(reply.el,'Abrir Consultas e FAQ','respostas-faq');
      const retry=button('Tentar novamente',()=>ask(question));retry.className='chat-source';reply.el.append(retry);
    }finally{if(valid()){busy=false;send.disabled=false;messages.removeAttribute('aria-busy');messages.scrollTop=messages.scrollHeight;}}
  }
  launch.addEventListener('click',()=>panel.hidden?open():close());
  panel.addEventListener('click',e=>{const action=e.target.closest('[data-chat]')?.dataset.chat;if(action==='close')close();if(action==='new'){reset();input.focus();}if(action==='expand'){const expanded=document.body.classList.toggle('chat-expanded');e.target.setAttribute('aria-pressed',String(expanded));e.target.setAttribute('aria-label',expanded?'Reduzir conversa':'Expandir conversa');}});
  panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask(input.value);}});
  document.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'&&matchMedia('(max-width:768px)').matches){const controls=[...panel.querySelectorAll('button:not([disabled]),textarea')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  window.FarolChat={open,close,ask,clear};welcome();
})();
