# Conferência pré-implantação — 30/09/2026

Projeto autorizado: FAROL RELACIONAMENTO (`pvorwgrpkcofoukbqtyg`). TESTE não foi utilizado.

## Verificações realizadas
- Cadastro público fechado confirmado em /auth/v1/settings: disable_signup=true; login por e-mail habilitado.
- 52 policies de public/storage coincidem integralmente com a auditoria.
- Definições das 16 funções public/farol_private coincidem com a referência.
- ACLs das 14 funções públicas coincidem. A referência não continha ACLs das duas funções privadas; snapshot atual capturado, sem alegar comparação histórica dessas ACLs.
- Quatro gatilhos de tabelas públicas coincidem com a referência.
- 24 tabelas públicas continuam com RLS habilitada.
- 38 perfis sem mudanças nos campos id/email/role/ativo/avaliado em relação ao snapshot privado. Não confundir quantidade de profiles com contas Auth.
- Scripts privados regenerados para 10 monitorados, dois monitores e seis inativações, com trava e validação de divergência antes de escrever.
- 23 testes locais passaram novamente.
- PR continua em rascunho; nenhuma migration, inativação ou Edge deste pacote foi aplicada.

## Próxima operação em produção
1. Revalidar colunas/grants e código atual da Edge, além de confirmar que o head do PR não mudou.
2. Em janela de implantação aprovada, aplicar regras e seleção privada de perfis de forma coordenada; preservar notas e históricos.
3. Implantar a Edge com validação de JWT/perfil ativo e publicar o frontend somente após conferir o servidor.
4. Conferir acesso próprio, monitor e ADM; interromper publicação se a validação falhar.
5. Registrar implantação e observar regressões.

O merge em main publica o frontend. Não executar merge isolado antes da preparação do servidor.
Mudanças podem interromper brevemente o acesso durante a coordenação dos componentes.

## Reversão e limites
Scripts de reversão existentes; snapshot privado atualizado fora do repositório público.
Reverter a UI não exige reabrir RLS. Reversão de regras antigas reabre falhas e requer revisão específica.
Não reativar desligados automaticamente durante rollback técnico.

Inativar profiles protege as operações cobertas pelas regras; não equivale a banir contas ou revogar sessões no Auth. Bloqueio administrativo de Auth continua pendente de capacidade validada. Arquivos de buckets públicos continuam acessíveis por URL; regressão integral dos módulos secundários e Realtime permanecem fora da cobertura concluída.
