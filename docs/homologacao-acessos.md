# Homologação dos acessos — preparação

Status em 29/09/2026: PR #1 em rascunho, 22 testes locais aprovados e primeira
execução do GitHub Actions aprovada. Dez cenários de interface também passaram em Chromium 134 com SDK simulado, sem
erros de JavaScript: acesso anônimo, login comum, rota administrativa bloqueada,
localStorage adulterado, logout, monitor, ADM, mudança de perfil, expiração e
perfil inativo. Não houve conexão com Supabase. Isso não comprova autenticação
real, RLS, gráficos ou gravação de notas.

Nenhuma migration, alteração de cadastro
ou Edge Function deste pacote foi aplicada em produção. O banco TESTE é proibido.

## Ambiente sem custo adicional

Orçamento obrigatório: zero. Branch paga descartada. O workflow
`.github/workflows/homologacao.yml` usa executor padrão Linux do GitHub em
repositório público, sem cache nem upload de artefatos. Se o repositório se tornar
privado, o job não roda. Não usar executores maiores ou serviços pagos.

O job cria Supabase **local no executor descartável**, com PostgreSQL 17, Auth,
REST e Storage reais. Não faz login/link em projeto cloud, não recebe secrets de
produção e encerra os containers apagando somente os volumes de teste ao final.
São sete contas fictícias, incluindo dois monitores. O teste aceita apenas URLs
127.0.0.1 nas portas locais esperadas. Não consulta produção nem TESTE.

CLI fixada em 2.118.0 e pg em 8.23.0. Usa o fixture existente do aplicativo,
conservando schemas/funções Auth e Storage reais. Não é uma cópia completa do
banco corporativo. A configuração Auth de produção, Edge/Deno real, Realtime,
SDK no navegador e inventário integral de grants ainda necessitam validação.

Para reproduzir em máquina com runtime de containers compatível:

```sh
npm ci
node tests/integration/prepare.mjs
npx --no-install supabase start --workdir test-results/integration -x studio,imgproxy,logflare,vector,supavisor,edge-runtime,realtime,postgres-meta
node --test tests/integration/access.test.mjs
npx --no-install supabase stop --workdir test-results/integration --no-backup
```

O último comando apaga exclusivamente os dados fictícios dessa instância.
Não executar contra diretório vinculado. A instância deve estar vazia; reexecução
requer encerrá-la com `--no-backup` e iniciá-la novamente. O teste não apaga bancos
existentes para contornar essa verificação.

Referências: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
e [Supabase local development](https://supabase.com/docs/guides/local-development).

## Preparação

1. Confirmar ref do ambiente isolado e configurar um frontend de homologação
   para esse ref; nunca reutilizar a configuração de produção no teste.
2. Importar apenas o schema necessário, conferir policies, grants e funções.
3. Criar contas fictícias: ADM, dois monitores, dois monitorados, um colaborador
   fora do grupo e um inativo. Usar o fluxo Auth real, sem tokens administrativos
   no navegador. Credenciais ficam fora do repositório e dos relatórios.
4. Criar notas distintas para cada colaborador e arquivos sintéticos de avatar
   e material institucional. Registrar baseline e backup reversível do ambiente.
5. Aplicar a migration e a Edge no ambiente isolado. Não executar o SQL privado
   de cadastros reais nele; usar fixtures sintéticos equivalentes à regra.

## Matriz de aceite real — todos os itens pendentes

| Caso | Resultado obrigatório |
|---|---|
| Login válido, recarga e renovação | Identidade validada e acesso legítimo preservado |
| Ausência de sessão / token expirado | Dados negados; tela bloqueada sem reabrir com resposta atrasada |
| Colaborador lê própria nota | Somente notas da identidade autenticada |
| Colaborador consulta ID de outro via REST | Nenhum dado de terceiro, independentemente de filtros da UI |
| Colaborador tenta inserir, editar ou excluir notas | Operação negada e banco inalterado |
| Cada monitor lê/lança/edita no grupo | Operação permitida para destinatário ativo monitorado |
| Monitor consulta ou escreve fora do grupo | Operação negada e banco inalterado |
| Monitor troca destinatário para fora do grupo | UPDATE negado; registro original preservado |
| ADM administra registros | Leitura/escrita legítimas preservadas |
| Perfil comum tenta ação administrativa | Negada também na chamada direta |
| Alteração de localStorage/objeto JS | Pode afetar apresentação, nunca ampliar direitos no servidor |
| Alteração de role, ativo, avaliado, departamento ou e-mail próprios | Campos protegidos rejeitados pelo servidor |
| Inativação/rebaixamento durante sessão | Próxima operação respeita estado atual; avaliar atualização da UI |
| Logout e login de outra pessoa no mesmo navegador | Sem dados da pessoa anterior na interface |
| Storage: avatar próprio, avatar alheio e arquivo institucional | Próprio permitido; alheio/institucional restritos conforme regra |
| Edge: sem token, token inválido e perfil inativo | Rejeição antes de consumir IA |
| Edge: perfil ativo autorizado | Resposta normal sem expor detalhes sensíveis |
| RPCs legadas e listagem de monitorados | Chamadores indevidos bloqueados |
| Recursos comuns e treinamento | Funcionamento legítimo preservado |

Registrar resposta HTTP, quantidade de linhas e estado final no banco: sucesso
HTTP com zero linhas não comprova escrita. Incluir tentativa de DELETE e troca
de proprietário/destinatário. Nunca registrar JWT, senha ou dados reais.

## Rollback e condição de publicação

Ensaiar reversão no ambiente isolado usando `ops/rollback-access-controls.sql`
com o aceite explícito exigido pelo script. Comparar policies, grants, funções
e dados com o baseline. A reversão reabre falhas antigas e não é a primeira
opção para um problema somente visual.

Publicação depende da matriz aprovada e da revisão das lacunas registradas em
`docs/security-access.md`. O merge em main publica o frontend; servidor e dados
devem estar preparados antes. A desativação dos seis colaboradores, o bloqueio
no Auth e a mudança dos cadastros reais continuam pendentes. URLs de buckets
públicos continuam acessíveis e exigem uma correção específica.
