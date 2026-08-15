# Migração do banco: sair do Lovable Cloud

Objetivo: manter o app hospedado na Lovable, mas assumir um Supabase próprio — com acesso completo ao painel, à `service_role key` e ao banco.

## Por que mudou de rota (atualizado em 2026-08-12)

O plano original mirava direto o self-hosted em `https://supabase.projetus.tech`. Motivo da pausa: essa instância está atrás de um túnel Cloudflare sem a porta padrão exposta, o que complica a conexão direta do Postgres e, principalmente, as chamadas HTTP que saem de dentro do banco (`pg_net`, usado pelo gatilho de notificação por e-mail) — sem contar backup, TLS, sizing e as extensões (`pg_cron`, `pg_net`) que precisam ser configuradas manualmente num ambiente self-hosted.

Nova estratégia em duas fases:

- **Fase 1 (agora):** migrar para um projeto no **Supabase Cloud, plano Free**, como ponte. Resolve o acesso à `service_role key` para rodar as operações administrativas localmente (hoje bloqueadas — ver incidente "Missing Supabase environment variable(s)"), sem herdar nenhum dos problemas de infraestrutura do self-hosted: `pg_cron` e `pg_net` já vêm habilitados, TLS e portas padrão corretas, painel completo.
- **Fase 2 (futuro, quando o túnel/porta estiver resolvido e houver mais confiança na auto-hospedagem):** migrar do Supabase Cloud para `supabase.projetus.tech`. Nesse ponto a migração é Supabase → Supabase (mesma estrutura de auth/storage/extensões), bem mais simples que Lovable Cloud → self-hosted direto.

## Limites do plano Free do Supabase Cloud (conferir antes de decidir ficar nele)

Confirmado na página oficial de preços (supabase.com/pricing) em 2026-08:

- Banco: 500 MB (CPU compartilhada, 500 MB RAM). **Conferir o tamanho atual do banco em Lovable Cloud → Advanced settings antes de migrar** — se estiver perto do limite, o Free já nasce apertado.
- Storage: 1 GB, upload máximo de 50 MB por arquivo (os anexos de chamado precisam caber nisso).
- Egress: 5 GB/mês + 5 GB cached egress.
- 50.000 usuários ativos mensais, requisições de API ilimitadas.
- **Sem backup automático, sem point-in-time recovery.** Enquanto estiver no Free, fazer `pg_dump` manual com alguma periodicidade — não existe rede de segurança da plataforma.
- **Pausa automática após 1 semana sem nenhuma requisição de API.** Os dados não se perdem, mas o app para de responder até alguém reativar manualmente no painel. Para um help desk com clientes reais, isso é um risco real em semana de baixo movimento (feriados, por exemplo).
- Limite de 2 projetos ativos por organização — não é problema para este caso (1 projeto).
- **Sem domínio customizado no Free** (é add-on pago só a partir do Pro, $10/mês/projeto). Ou seja: por enquanto a URL do Supabase será a padrão `<ref>.supabase.co`, não `supabase.projetus.tech` — o que é o esperado nesta fase.
- Retenção de log: 1 dia. Suporte: só comunidade.

**Não é um trial com prazo — dá para ficar no Free indefinidamente**, contanto que os limites acima sejam suficientes. Gatilhos para migrar para o Pro ($25/mês): banco chegando perto de 500 MB, precisar de backup automático de verdade, ou a pausa por inatividade virar um problema real (clientes tentando abrir chamado e o app estar pausado).

## O que precisa ser levado (igual independente da fase)

1. Estrutura do banco: 11 tabelas (perfis, contratos, ativos, chamados, atualizações, anexos, horas, notificações, papéis, técnicos-contratos, segredos de integração), tipos personalizados (`app_role` com `admin/tecnico/cliente/dev`, `ticket_status`, `status_dev` etc.), funções (incluindo `create_ticket_notification`, `auto_client_response_status`, `create_ticket_from_webhook`, `auto_close_resolved_tickets`), gatilhos, e todas as regras de acesso (RLS) e permissões.
2. Dados: todo o conteúdo atual das tabelas, preservando os IDs.
3. Usuários e senhas: exportação da base de autenticação (`auth.users`, e `auth.identities` se houver login Google em uso). Os IDs dos usuários precisam ser preservados, senão todos os chamados/perfis "perdem o dono". **Todo usuário será deslogado no corte** — sessões/refresh tokens não migram; isso é esperado, não é falha.
4. Arquivos: o bucket privado `ticket-attachments` (anexos dos chamados) precisa ser recriado, com as mesmas políticas, e os arquivos copiados.
5. Rotinas automáticas:
   - fechamento automático de chamados resolvidos após 24h (`pg_cron`, de hora em hora);
   - reabertura automática ao responder um chamado `resolvido` (`auto_client_response_status`);
   - envio de e-mail de notificação via `pg_net`/`http_post` para `<app_base_url>/api/public/notificacoes/email`;
   - a tabela `integration_secrets` (segredo do webhook `webhook_tickets`, `app_base_url`, `notify_email_secret`) precisa ser repopulada.
6. Sequência de numeração dos chamados (`ticket_number`) — precisa continuar do último número usado.

## Mudanças no app

- Apontar as chaves de conexão (URL do projeto, chave pública, chave de serviço) para o novo projeto. O código já aceita tanto o formato antigo (JWT) quanto o novo (`sb_publishable_`/`sb_secret_`), então não há mudança de código aqui.
- Atualizar a URL base usada nos e-mails e no webhook público de abertura de chamados (`integration_secrets.app_base_url`).
- Reapontar o e-mail (Resend, via gateway da Lovable) para continuar disparando a partir do novo banco.
- Login com Google (se estiver em uso) precisa ser reconfigurado no Auth do novo projeto (client ID/secret e URLs de redirecionamento).

## Cuidado com o `.env`

O `.env` deste repositório está versionado no git (decisão consciente do time, mantida como está). A `SUPABASE_SERVICE_ROLE_KEY` do novo projeto bypassa toda a RLS — ao adicioná-la ao `.env` e commitar, ela entra no histórico do repositório. Tratar como segredo sensível mesmo assim.

## Execução etapa por etapa (com confirmação a cada passo)

Uma etapa de cada vez. Ao final de cada uma: o que foi feito, o que foi verificado, e pergunto se posso seguir. Nada avança sem "pode continuar".

- **Etapa 0 — Criar/escolher o projeto Supabase Cloud.** Criar o projeto (plano Free) direto pelo fluxo da própria Lovable: **More → Cloud → "Already have a Supabase project? Connect it here"** (ou criar um novo projeto no botão "Create Project" do próprio fluxo, se ainda não existir um). Depois de conectado, `URL`, `chave pública` e `chave de serviço` ficam acessíveis via Supabase dashboard → Project Settings → API. Reporto: conexão OK e versão do Postgres.
- **Etapa 1 — Diagnóstico:** conferir tamanho atual do banco em Lovable Cloud (perto do limite de 500 MB?), tamanho dos anexos no bucket (perto de 1 GB?), extensões disponíveis (`pg_cron`, `pg_net` — já vêm habilitadas por padrão no Cloud). Reporto o que existe e qualquer risco de estourar limite do Free.
- **Etapa 2 — Estrutura:** criar tipos, tabelas, permissões, RLS, funções e gatilhos no projeto novo. Reporto a contagem criada.
- **Etapa 3 — Usuários:** migrar a base de autenticação preservando os IDs. Reporto quantos usuários e papéis foram para lá.
- **Etapa 4 — Dados:** copiar o conteúdo das tabelas na ordem correta de dependências. Reporto a contagem por tabela, comparando com a origem.
- **Etapa 5 — Anexos:** criar o bucket `ticket-attachments` com as políticas e copiar os arquivos. Reporto quantidade e tamanho.
- **Etapa 6 — Rotinas:** recriar o agendamento de fechamento automático, popular `integration_secrets`, ajustar a numeração dos chamados. Reporto o próximo número da sequência.
- **Etapa 6.5 — Sincronização final:** antes de trocar a conexão do app, reconferir se algum dado novo entrou na base antiga desde a Etapa 4 (chamados abertos durante a janela de migração) e replicar. Evita perder chamados abertos durante a janela.
- **Etapa 7 — Troca de conexão no app:** apontar as variáveis para o projeto novo. Reporto e peço para validar o preview.
- **Etapa 8 — Testes guiados:** login, abrir chamado, responder, anexar, cronômetro, notificação, webhook — **e também as fronteiras de RLS** (cliente só vê os próprios chamados; técnico só contratos atribuídos; subchamados nunca aparecem para cliente). Reporto o resultado de cada teste.
- **Etapa 9 — Publicação e monitoramento**, com a base antiga (Lovable Cloud) preservada como plano de retorno por alguns dias.

Recomendação: se possível, ensaiar as Etapas 2–4 primeiro contra um projeto Supabase de teste (não o que vai virar produção), para pegar erro de schema/RLS antes de mexer nos dados reais.

## Fase 2 — self-host em `supabase.projetus.tech` (futuro)

Quando a questão do túnel/porta estiver resolvida e houver mais confiança na auto-hospedagem, repetir essencialmente as mesmas etapas, mas partindo do Supabase Cloud (Fase 1) em vez do Lovable Cloud — migração Supabase → Supabase, sem o problema de reconciliar formatos diferentes de auth/storage. Nessa fase, revisitar: extensões `pg_cron`/`pg_net` habilitadas manualmente, saída de rede liberada até o domínio do app, TLS válido, backup próprio, sizing de recursos.

## Detalhes técnicos

- Export: `pg_dump` do schema `public` (com `--no-owner`) + dump da tabela de autenticação; a exportação de dados da Lovable Cloud está em Cloud → Advanced settings → Export data.
- Storage: bucket privado `ticket-attachments`, com políticas de leitura/gravação por dono e equipe.
- Agendamento: recriar o job `pg_cron` que chama `public.auto_close_resolved_tickets()` de hora em hora.
- Notificações: `public.create_ticket_notification` usa `extensions.http_post` para `<app_base_url>/api/public/notificacoes/email`; a URL fica em `integration_secrets.app_base_url` e o segredo em `notify_email_secret`.
- Webhook: `public.create_ticket_from_webhook` valida `integration_secrets.webhook_tickets`.
- Variáveis de ambiente a atualizar: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Nenhuma alteração estrutural de código é esperada em `src/` além da configuração de conexão.
