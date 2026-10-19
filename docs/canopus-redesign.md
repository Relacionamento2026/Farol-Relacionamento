# Identidade Canopus e Pergunte ao Farol lateral

Implementação da opção azul-petróleo aprovada em 19/10/2026: navegação escura,
conteúdo claro, símbolo Canopus existente no projeto e assistente lateral.

O tema é compartilhado pelos módulos existentes. Os formulários, os dados,
as rotas e as permissões não são substituídos pelos exemplos dos mockups.
A tela inicial mantém as notas e conquistas reais e o acesso à UNIC. Não exibe
percentuais fictícios, materiais inventados ou um mural novo sem fonte de dados.

A conversa abre em qualquer página, recolhe, expande e mantém até 12 turnos
em memória. As três últimas trocas contextualizam a próxima pergunta no contrato
existente da Edge Function. Nova conversa e saída da conta limpam o histórico;
respostas pendentes da sessão anterior são descartadas. Nenhuma nova permissão,
tabela, recurso pago ou mudança de configuração Supabase é necessária.

A renderização usa o formatador escapado existente. Referências retornadas pela
IA são apresentadas no texto, sem fabricar cartões de fontes. Se o serviço falhar,
a interface oferece resultados da busca interna e nova tentativa. O feedback e
o registro das consultas usam as funções e políticas já existentes.

Verificação: `npm test`; `node tests/browser/redesign.mjs` com Chromium instalado;
homologação Auth/RLS/Storage existente em serviços locais descartáveis no CI.
Capturas do navegador são anexadas ao workflow Verificar interface Canopus.
Rollback: reverter este commit. Não há migração de banco a desfazer.
