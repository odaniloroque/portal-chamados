# Migração do banco: Lovable Cloud → Supabase.com

O app continua hospedado na Lovable. Só o backend (banco, autenticação, arquivos) passa para o projeto já criado no Supabase.com (`piwywswwdqarzvzzmhzf.supabase.co`), onde você tem painel completo e acesso à chave de serviço.

## O que já está confirmado

- Projeto novo no Supabase.com já existe; URL, chave pública e chave de serviço já estão anotadas.
- Base atual é pequena: **12 MB** de banco e **1,8 MB** de anexos (19 arquivos) — folgado dentro do plano Free.
- Conteúdo a levar: 4 perfis, 4 papéis, 5 contratos, 1 ativo, 1 atribuição de técnico, 42 chamados, 167 atualizações, 19 anexos, 29 lançamentos de horas, 3 segredos de integração.
- As credenciais `NEW_SUPABASE_*` guardadas hoje **apontam para o servidor antigo self-hosted** (`supabase.projetus.tech`), não para o projeto do Supabase.com. Serão substituídas na Etapa 0.

## Decisões tomadas

- **Acesso SQL:** você fornece a connection string do banco novo (Project Settings → Database → Connection string, modo pooler) e eu automatizo tudo.
- **Senhas:** os 4 usuários são recriados no projeto novo com os **mesmos IDs e e-mails** e senhas provisórias que você repassa. Todo mundo será deslogado no corte.
- **Janela de corte:** haverá uma janela curta com o portal congelado (sem abrir chamados) para copiar o delta com segurança.

## Etapas (uma por vez, com confirmação antes de seguir)

Cada etapa cabe num dia de créditos. Ao final de cada uma eu reporto o que fiz, o que verifiquei, e pergunto se posso continuar.

- **Etapa 0 — Credenciais e conexão.** Você me passa a connection string do banco novo; eu regravo os segredos (`NEW_SUPABASE_URL`, `NEW_SUPABASE_DB_URL`, chaves) para o projeto do Supabase.com. Reporto: conexão OK, versão do Postgres, extensões disponíveis (`pg_cron`, `pg_net`).
- **Etapa 1 — Estrutura.** Crio no projeto novo os tipos personalizados, as 11 tabelas, a view de exibição, permissões (GRANT), RLS com todas as políticas, funções e gatilhos. Reporto a contagem de cada objeto criado, comparando com a origem.
- **Etapa 2 — Usuários.** Crio os 4 usuários no Auth do projeto novo preservando os IDs e e-mails, com senhas provisórias, e recrio os papéis em `user_roles`. Reporto a lista de usuários/papéis e as senhas para você repassar.
- **Etapa 3 — Dados.** Copio o conteúdo das tabelas na ordem de dependências, preservando IDs e datas. Reporto a contagem linha a linha comparando origem × destino.
- **Etapa 4 — Anexos.** Crio o bucket privado `ticket-attachments` com as mesmas políticas e copio os 19 arquivos. Reporto quantidade, tamanho e um teste de download autenticado.
- **Etapa 5 — Rotinas e integrações.** Ajusto a sequência de `ticket_number` para continuar do último número, repopulo `integration_secrets` (`webhook_tickets`, `notify_email_secret`, `app_base_url`), recrio o agendamento `pg_cron` de fechamento automático e valido o disparo `pg_net` das notificações por e-mail.
- **Etapa 6 — Ensaio de leitura.** Antes de trocar a conexão, rodo consultas de verificação no projeto novo simulando cada perfil (cliente, técnico, dev, admin) para confirmar que as fronteiras de RLS estão iguais às de hoje.
- **Etapa 7 — Corte.** Com o portal congelado: replico o delta (o que entrou desde a Etapa 3), troco as variáveis de conexão do app para o projeto novo e libero o acesso. Peço sua validação no preview.
- **Etapa 8 — Testes guiados.** Login, abrir chamado, responder, anexar, cronômetro, notificação por e-mail, webhook público, kanban de dev — e as regras automáticas (reabertura por resposta do cliente, fechamento automático em 24h).
- **Etapa 9 — Publicação e monitoramento.** Publico e acompanho por alguns dias, mantendo a base do Lovable Cloud intacta como plano de retorno.

## Pontos de atenção

- **Plano Free do Supabase.com:** sem backup automático e com pausa após 1 semana sem requisições. Recomendo `pg_dump` manual periódico enquanto estiver no Free; se a pausa virar problema, o Pro ($25/mês) resolve.
- **`.env` versionado:** a chave de serviço do projeto novo é sensível e entra no histórico do repositório ao ser commitada. Mantido como está a seu pedido, mas fica o registro.
- **Login com Google:** se estiver em uso, precisa ser reconfigurado no Auth do projeto novo (client ID/secret e URLs de redirecionamento).
- **URL base das notificações:** `integration_secrets.app_base_url` precisa apontar para a URL publicada, senão o e-mail de notificação não sai.

## Detalhes técnicos

- Transferência via `psql`/`pg_dump` do schema `public` (`--no-owner`) sobre a connection string do pooler; dados com `COPY` preservando IDs.
- Usuários criados pela Admin API do Auth com `id` explícito, `email_confirm: true` e senha provisória.
- Arquivos copiados pela Storage API (download autenticado na origem, upload com service role no destino), preservando o `storage_path` referenciado em `ticket_attachments`.
- Nenhuma alteração estrutural em `src/` é esperada: apenas `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` e os equivalentes `VITE_*`. O código já aceita chaves no formato novo (`sb_publishable_`/`sb_secret_`).
