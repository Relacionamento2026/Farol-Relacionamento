# Farol V46 — pacote incremental de controle de acesso

Status: preparado para revisão, **não aplicado em produção**. Referência de código: `27a9114dcdaf996976467f0c513085bb58f33296`, Edge `pergunte-ao-farol` v11. Metadados de banco inspecionados em 29/09/2026. Somente projeto **FAROL RELACIONAMENTO**, ref `pvorwgrpkcofoukbqtyg`. O projeto TESTE não deve ser consultado, vinculado, utilizado para homologação ou alterado.

## Decisão de acesso

| Perfil efetivo | Recursos comuns | Próprias notas | Notas do grupo monitorado | Administração |
|---|---|---|---|---|
| Colaborador ativo | Sim | Leitura | Não | Não |
| Monitor ativo | Sim | Leitura | Leitura, inclusão e edição | Não |
| ADM ativo | Sim | Sim | Todas as operações | Sim |
| Perfil inativo/pendente, ausente ou sem identidade válida | Não | Não | Não | Não |

Cargos organizacionais não concedem privilégios. `profiles.role` identifica ADM (`admin`) e monitor (`avaliador`); demais valores são tratados como colaborador, sem apagar o cargo histórico. A lista privada aprovada tem dez monitorados, dois monitores e seis desligamentos. As duas contas monitoras compartilham o mesmo grupo. A marcação existente `profiles.avaliado` delimita esse grupo e passa a ser protegida no servidor. Tabelas `equipes` e `equipe_membros` estão vazias: não foi inventado um vínculo de equipe. Uma futura divisão em grupos separados **necessita validação** e nova regra.

## Fluxo proposto

Login Supabase → `getUser()` validado pelo Auth → leitura do próprio `profiles` sob RLS → verificação de `ativo` → normalização de perfil → interface. Cada chamada ao banco continua sujeita a RLS, independentemente do objeto JavaScript, menu ou armazenamento do navegador. A Edge Function valida o JWT no Auth e consulta o perfil com o token do chamador antes de consumir IA.

`localStorage` do SDK continua armazenando a sessão conforme configuração atual; não foi convertido em cookies. `re_user` deixa de ser fonte de autenticação/autorização; a leitura de configuração Supabase sobrescrita pelo navegador é removida. Preferências e caches legados continuam existindo. XSS ainda poderia acessar o token do SDK: auditoria de renderização/CSP **necessita validação**. Esconder menus serve apenas à apresentação.

## Achados e correções desta entrega

| Prioridade / classificação | Evidência atual | Correção preparada | Verificação |
|---|---|---|---|
| P0 / ATUAL → CORREÇÃO | Policies permissivas permitem leitura ampla de avaliações por cargos e avaliador | Substituição das policies de notas, checando autor e destinatário no banco | SELECT/INSERT/UPDATE direto sob identidades sintéticas |
| P0 / ATUAL → CORREÇÃO | Login aceita fallback local; perfil inativo não bloqueia todas as rotas | Identidade confirmada no Auth, perfil obrigatório e regra restritiva de ativo nas 24 tabelas públicas | Falha fechada; inativo sem acesso |
| P1 / ATUAL → CORREÇÃO | Campos `avaliado`, departamento e e-mail não cobertos pelo trigger anterior | Extensão do trigger de proteção do perfil | Autoescalada e mudança de escopo rejeitadas |
| P1 / ATUAL → CORREÇÃO | RPC de colaboradores expõe lista sem controle do chamador | RPC invoker, acesso anônimo revogado, somente monitor/ADM recebe grupo | Anônimo negado, colaborador recebe zero |
| P1 / ATUAL → CORREÇÃO | RPCs legadas SECURITY DEFINER aceitam IDs arbitrários e não possuem chamadores no HTML analisado | Revogação de execução para clientes; implementação preservada | Chamada direta negada; dependências externas necessitam validação |
| P1 / ATUAL → CORREÇÃO | Policies de Storage permitem upload/atualização ampla | Escrita institucional por ADM; avatar no caminho exato do próprio usuário | Upload institucional/alheio negado |
| P1 / ATUAL → CORREÇÃO | Edge v11 não verifica perfil ativo no handler | JWT validado e perfil consultado com RLS antes da IA; detalhes técnicos não devolvidos ao cliente | Handler completo com rede simulada |
| P2 / ATUAL → CORREÇÃO | Logout usa campos ausentes e listener pode reinvocar saída; login pendente pode reabrir tela | Limpeza tolerante a DOM ausente, controle de concorrência e listener sem chamada reentrante | Logout com erro e login pendente |
| P2 / NOVO | Publicação não aguardava o workflow de sintaxe | Testes no próprio job de publicação; artefato limitado ao site | Revisão do YAML; primeira execução GitHub aprovada |

## Arquivos e rollback

| Componente | Alteração | Reversão |
|---|---|---|
| `index.html`, `assets/access-control.js` | Autenticação e apresentação das permissões; mantém HTML/CSS existentes | Reverter commit e publicar o artefato anterior, sem relaxar RLS por padrão |
| `supabase/migrations/20260929194018_access_controls.sql` | Policies, funções e trigger usando schema observado | `ops/rollback-access-controls.sql`; restaura configuração anterior inspecionada |
| `supabase/functions/pergunte-ao-farol/` | Guarda de acesso à IA | Código anterior em `ops/edge-v11/index.ts`; republicar mantendo `verify_jwt=true` |
| `ops/prepare-roster.cjs` | Gera aplicação e reversão da lista privada, sem conexão remota | `rollback-roster.sql` gerado com snapshot anterior |
| `.github/workflows/` | Testes antes da publicação e seleção de arquivos | Reverter o commit correspondente |

**A reversão de RLS/Edge restaura vulnerabilidades conhecidas.** Preferir corrigir pontualmente ou interromper temporariamente a funcionalidade afetada. O SQL de reversão exige `SET farol.allow_unsafe_rollback='reviewed'`. Não reativar desligados automaticamente em um rollback técnico. Revogações no Auth exigem plano independente; não são desfeitas pelo SQL de perfis.

## Implantação controlada

1. Confirmar no painel o nome e ref autorizados. Não executar `db push` contra projeto vinculado desconhecido. Não há deploy Supabase automático neste repositório.
2. Capturar novamente schema/policies/grants/triggers e comparar com a referência; interromper se houver divergências. O snapshot de reversão acompanha apenas os objetos alterados, não substitui backup completo.
3. Validar com usuários sintéticos em ambiente isolado autorizado, **sem usar TESTE**. Auth/Storage/REST e RLS foram verificados com Supabase local real/PostgreSQL 17 em executor descartável: 13 cenários aprovados (14 testes contando a suíte). Detalhes em `docs/homologacao-acessos.md`. Configuração corporativa, Realtime, SDK real no navegador e Edge/Deno continuam **necessitando validação**.
4. Executar `npm ci --ignore-scripts && npm test` em Node 24. Revisar/aprovar alterações de menus com os responsáveis.
5. Obter snapshot privado de `SELECT id,email,role,ativo,avaliado FROM public.profiles ORDER BY id`. Guardar em `private-operations/snapshot.json`; decisões em `private-operations/decision.json` com chaves `monitored`, `monitors`, `departed` contendo e-mails. Nunca commitar estes arquivos: repositório é público.
6. Gerar o par de SQL privado: `node ops/prepare-roster.cjs pvorwgrpkcofoukbqtyg private-operations/snapshot.json private-operations/decision.json private-operations/prepared`. O gerador rejeita outro projeto, quantidades diferentes de 10/2/6, reativação implícita, ausência de ADM e cadastros ausentes. Os SQL gerados travam `profiles` e comparam o estado antes de mudar; divergência cancela tudo. O gerador não conecta ao banco. O executor deve confirmar a conexão correta: o SQL sozinho não identifica um projeto Supabase.
7. Em janela controlada, aplicar migration RLS e os dados privados; manter o site indisponível até completar ambas. Registrar versões aplicadas e verificações. Implantar a Edge com `verify_jwt=true`, depois publicar frontend. Merge em main publica Pages; não fazer merge antes da preparação do servidor.
8. Desativar os seis perfis sem deletar histórico. Complementar com bloqueio de novas sessões/refresh no Supabase Auth usando operação administrativa autorizada. **Necessita validação**: ferramenta administrativa e configuração Auth para ban/revogação não estão incluídas nesta entrega; inativação de perfil não equivale a revogação do JWT.
9. Verificar com contas representativas e chamadas REST diretas: própria nota, notas de outro colaborador, monitor fora do grupo, usuário comum em administração, token expirado, alteração de perfil com sessão ativa, alteração de `localStorage`, INSERT/UPDATE/DELETE e avatar alheio. Registrar somente resultados, sem tokens ou senhas.
10. Observar erros e leituras/escritas legítimas. Se a falha for de UI, reverter UI mantendo as proteções. Se houver necessidade de reversão de banco, revisar as vulnerabilidades reabertas antes da execução.

## Testes incluídos e limites

A suíte usa Node 24, PGlite 0.5.8/PostgreSQL 18.3 e registros sintéticos. O projeto de referência usa PostgreSQL 17.6; este teste não comprova equivalência de runtime Supabase. O fixture reproduz tipos de perfis/notas, policies e funções inspecionados; tabelas não relacionadas têm estrutura reduzida. Sem chamadas de modelo ou gravações remotas.

Cobertura: identidade ausente/expirada, perfil inválido/inativo, acesso comum e de monitor/ADM, navegação administrativa, logout, login concorrente; SQL direto com `SET LOCAL ROLE` e identidade JWT simulada; leitura própria, escrita permitida, acesso cruzado negado, alteração de campos de autorização, proteção de avatar; Edge sem sessão e com conta inativa; geração da lista e reversão transacional. O teste de script valida sintaxe JavaScript, **não** renderização integral do HTML. Dez cenários de navegação/estado passaram em Chromium com SDK simulado, conforme `docs/homologacao-acessos.md`. Login por senha e revogação de refresh foram verificados no Auth local real; o teste adicional cobriu REST, Storage e rollback. Integração no navegador com SDK real, configuração Auth corporativa e entrega de eventos ainda **necessitam validação**.

## Riscos residuais e próximas etapas

- P1: buckets de materiais continuam públicos. URL pública não é protegida pela RLS de listagem. Migrar para buckets privados e URLs assinadas exige inventário de arquivos/links; **necessita validação**. Não prometer bloqueio total de ex-colaboradores enquanto URLs públicas existirem.
- P1: Edge ainda recebe `base` do cliente e trata o texto como oficial. Este patch protege acesso, não implementa RAG/governança. Mover recuperação de fontes autorizadas para o servidor é próxima entrega.
- P1: `Arquivos` ainda possui policy legada de INSERT para autenticados; certificados/progresso têm escrita própria e monitor pode ler certificados via policy legada. Revisar esses módulos antes de afirmar que todas as ações administrativas estão protegidas.
- P2: autoria textual `lancado_por` e cálculos de nota são enviados pelo cliente; proteção da auditoria e validação de valores no servidor precisam de uma entrega específica.
- P2: feedback em `consultas_realizadas` tem lacunas de SELECT/UPDATE próprio; não alterado aqui. Central de Conhecimento não tem policy de leitura comum na referência; funcionalidade depende de decisão/validação adicional.
- P2: Realtime sem tabelas na publicação inspecionada. Mudanças de perfil são impostas pelo banco na próxima operação; atualização imediata da UI não foi comprovada.
- P2: alteração de ativo/perfil durante sessão não apaga dados já entregues ao navegador. Rotinas assíncronas legadas fora do login ainda precisam de auditoria de cache/concorrência.
- P3: CSP, dependências CDN, força de senha/recuperação e proteção contra XSS **necessitam validação**. O pacote não reescreve a V46 nem muda seu layout visual.

Referências: Supabase Auth `getUser`, `onAuthStateChange`, `signOut`, RLS e segurança de Edge Functions; PostgreSQL CREATE POLICY. `USING` também vale como `WITH CHECK` quando este é omitido em UPDATE/ALL: ausência isolada de `WITH CHECK` não foi tratada como vulnerabilidade sem analisar a expressão.
