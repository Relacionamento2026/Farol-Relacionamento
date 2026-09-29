# Verificação da interface em isolamento

Execute `node tests/browser/server.mjs` e abra `http://127.0.0.1:4173`.
O servidor serve o HTML atual, substitui o SDK Supabase por um mock local e
envia CSP com `connect-src 'none'`. Não há conexão com qualquer banco.
Não publique este servidor nem `mock.js`; o workflow Pages publica somente
`index.html` e `assets`. Para encerrar, use Ctrl+C.

Contas fictícias: `user@example.invalid`, `monitor@example.invalid`,
`admin@example.invalid`, `inactive@example.invalid`. Senha de simulação:
`simulated`. Nenhuma dessas credenciais é enviada a um serviço externo.

O mock devolve coleções vazias, substitui Chart.js e não implementa RLS.
Fontes externas e conteúdo remoto ficam bloqueados. Esta tela serve para
verificar login, estado e navegação; não representa uma nova proposta de layout
nem comprova segurança do banco ou integração com o SDK real.

## Roteiro

1. Sem login: conteúdo autenticado oculto.
2. Login como user: menu comum; página administrativa e monitoria bloqueadas.
3. Alterar `re_user` no localStorage para perfil admin e recarregar: não concede acesso.
4. Logout: login reaparece e conteúdo autenticado fica oculto.
5. Login como monitor: recursos comuns e painel de monitoria; administração bloqueada.
6. Login como admin: administração, recursos comuns e monitoria disponíveis.
7. Login como inactive: falha fechada.
8. No console, `__farolMock.expire()`: interface volta ao login.
9. Como admin, `__farolMock.changeRole('user')`: próximo evento de autenticação
   deve atualizar menus e fechar a página administrativa.

Registre erros de JavaScript e resultados. A restauração de sessão real e a
autorização de chamadas diretas precisam do ambiente Supabase descrito em
`docs/homologacao-acessos.md`.
