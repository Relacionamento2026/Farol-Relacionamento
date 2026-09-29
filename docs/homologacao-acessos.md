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

## Matriz de aceite e limites após teste local real

| Caso | Resultado no ambiente local real |
|---|---|
| Login válido e confirmação de identidade no Auth | Aprovado; senha incorreta rejeitada |
| Ausência de sessão e token inválido | Sem acesso às notas; expiração natural ainda pendente |
| Colaborador lê própria nota / consulta ID de terceiro | Aprovado; somente nota própria |
| Colaborador tenta inserir, editar ou excluir notas | Bloqueado; estado persistido conferido |
| Cada um dos dois monitores lê/lança no grupo | Aprovado |
| Monitor tenta inserir fora do grupo ou reatribuir destinatário | Bloqueado |
| Monitor edita nota autorizada | Aprovado; DELETE de monitor bloqueado |
| ADM lê todas as notas e exclui registro | Aprovado; demais módulos administrativos ainda pendentes |
| Alteração de role, ativo, avaliado, departamento ou e-mail próprios | Rejeitada pelo servidor |
| Rebaixamento/inativação com token já emitido | Próxima chamada respeita o perfil atual |
| Logout | Refresh token revogado; não implica invalidação imediata de todo access token |
| Avatar próprio / alheio / arquivo institucional | Próprio permitido; alheio e institucional negados ao comum; institucional permitido ao ADM |
| RPC de monitorados e RPC legada | Listagem respeita perfil; legado indisponível ao cliente comum |
| Rollback | Policies anteriores restauradas e notas preservadas |
| Manipulação do navegador / troca de perfil na UI | Dez cenários com mock aprovados anteriormente; SDK real na UI pendente |
| Edge | Handler com rede simulada aprovado; runtime Deno real pendente |
| Realtime, recursos comuns e treinamentos completos | Necessita validação |

Execução comprovada: [GitHub Actions 36629144752](https://github.com/Relacionamento2026/Farol-Relacionamento/actions/runs/36629144752),
commit `a2410ae9fc71bbec278f91103007375fb5854299`, em 29/09/2026.
Treze cenários aprovados; Node reporta 14 testes contando a suíte principal.
Nenhuma falha. O job confirmou encerramento e remoção dos volumes locais.
Os 22 testes anteriores também passaram no mesmo commit. Não somar simulações
a testes integrados como se todos comprovassem o mesmo nível de cobertura.

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
