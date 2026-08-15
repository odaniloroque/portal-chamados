# Projetus Tech — Site institucional + Portal de Chamados

Documento de onboarding para o próximo desenvolvedor.

## 1. Visão geral

Aplicação web única que reúne:

1. **Site institucional** da Projetus Tech (`/`) — landing page com hero, serviços, sobre, valores, contato.
2. **Portal do cliente / Help Desk** (`/cliente`, `/portal`, `/admin`) — cadastro de clientes, contratos, chamados de manutenção, controle de horas, ativos de locação.
3. **Kanban de desenvolvimento** (`/dev`) — subchamados internos para acompanhar o desenvolvimento de um chamado (ver §5.1).
4. **API pública** para abertura de chamados via webhook (`/api/public/chamados`) documentada em `/api-docs`.
5. **Servidor MCP** (agent integrations) em `/mcp`.

Idioma da interface: **português (pt-BR)**. Fuso de referência: America/Sao_Paulo.

## 2. Stack

- **TanStack Start v1** (React 19 + Vite 8), roteamento por arquivos em `src/routes`.
- **TypeScript**, **Tailwind CSS v4** (config via `src/styles.css`, sem `tailwind.config.js`).
- **shadcn/ui** (Radix) em `src/components/ui`, ícones `lucide-react`.
- **TanStack Query** para dados no cliente; **react-hook-form + zod** para formulários.
- **recharts** para gráficos, **sonner** para toasts, **date-fns** para datas.
- **Supabase Cloud próprio** (projeto `piwywswwdqarzvzzmhzf`): Postgres + Auth + Storage. **A migração para fora do Lovable Cloud foi concluída em 15/08/2026** (schema, 5 usuários do Auth com UUIDs preservados, dados de 11 tabelas, bucket `ticket-attachments` com 20 arquivos, `integration_secrets`, job `pg_cron` e as 41 políticas de RLS). Como a plataforma injeta as variáveis `VITE_SUPABASE_*` do projeto antigo, **a conexão ativa está fixada em código** (ver §7.1) — não confie no `.env` nem nos arquivos gerados. A base antiga do Lovable Cloud segue intacta apenas como plano de retorno. A Fase 2 (self-host em `supabase.projetus.tech`) continua pausada por causa da porta não-padrão do túnel Cloudflare.
- **@dnd-kit/core** + **@dnd-kit/utilities** — drag-and-drop do kanban de desenvolvimento (`/dev`).
- E-mail transacional via gateway da Lovable (`connector-gateway.lovable.dev/resend`, usando `LOVABLE_API_KEY` + `RESEND_API_KEY`) — sem SDK de e-mail no `package.json`, é `fetch` puro. Erros client-side reportados para `window.__lovableEvents` (telemetria própria da Lovable, não é Sentry).
- Runtime de produção: **Cloudflare Workers (edge)** — sem Node nativo, sem `child_process`, sem `sharp`.

Comandos: `bun run dev`, `bun run build`, `bun run lint`. Dev server em `http://localhost:8080`.

## 3. Identidade visual

Paleta oficial (tokens semânticos em `src/styles.css`, nunca hardcodar cores em componentes):

- Azul institucional `#0B3C74`, ciano `#00C4F3`, cinza `#B7BBC2`, grafite `#2B2B2B`.
- Tipografia **Montserrat** (carregada por `<link>` no `src/routes/__root.tsx` — nunca `@import` remoto no CSS, quebra o build do Tailwind v4).
- Logo em `src/assets` com variantes WebP responsivas; favicon em `public/favicon.png`.

## 4. Estrutura de rotas

```
src/routes/
  index.tsx                       site institucional
  cliente.tsx                     login do portal
  api-docs.tsx                    documentação da API pública (Swagger-like)
  api/public/chamados.ts          webhook POST de abertura de chamado
  api/public/openapi.ts           spec OpenAPI
  mcp.ts, [.mcp]/*, [.well-known]/*   servidor MCP
  _authenticated/
    route.tsx                     guarda de sessão (redireciona p/ /cliente)
    portal.tsx                    portal do cliente/técnico (dashboard + lista)
    portal.chamado.$id.tsx        detalhe do chamado
    admin.tsx                     painel administrativo (abas: Chamados, Clientes*, Equipe*, Horas* — *admin-only)
    dev.tsx                       kanban de desenvolvimento (subchamados), guarda client-side admin/dev
```

`src/routeTree.gen.ts` é gerado — nunca editar.

## 5. Perfis de acesso

| Perfil | O que vê |
|---|---|
| `admin` | Tudo: clientes, técnicos, contratos, ativos, horas, valores, todos os chamados |
| `tecnico` | Apenas chamados dos **contratos atribuídos** a ele; opera cronômetro; não vê valores contratuais |
| `cliente` | Apenas os próprios chamados e contratos; nunca vê subchamados (`parent_ticket_id IS NULL` sempre) |
| `dev` | Acesso ao kanban de desenvolvimento (`/dev`): lê/atualiza chamados que são subchamados ou que têm subchamados. Conta como `is_staff` (junto com `admin`/`tecnico`) |

Papéis ficam **exclusivamente** na tabela `user_roles` (nunca em `profiles`), consultados pelas funções `has_role(uuid, app_role)` e `is_staff(uuid)` (SECURITY DEFINER). Atribuição técnico↔contrato em `technician_contracts`, validada por `can_access_contract(uuid, uuid)`.

## 6. Modelo de dados (Postgres, schema `public`)

- `profiles` — dados do cliente (empresa, CNPJ, contato, `custom_fields` jsonb, `active`).
- `contracts` — um cliente pode ter **vários contratos**. `billing_type`: `por_hora | fixo | por_servico | locacao_impressoras | locacao_servidores | locacao_rede`; campos de locação (`rental_mode`, `supply_billing`, `toner_price`, `page_price`, `monthly_page_quota`, `contract_value`).
- `contract_assets` — parque de equipamentos (impressora/servidor/rede/outro) por contrato.
- `technician_contracts` — atribuição de técnicos.
- `tickets` — `ticket_number` (sequence, exibido como `#0001`), `priority`, `status`, `contract_id`, `asset_id`, `toner_color/qty`, `custom_fields`. Também suporta **subchamados de desenvolvimento** (ver §5.1): `parent_ticket_id` (self-FK), `child_seq` (numeração automática por pai), `status_dev` (`backlog|em_desenvolvimento|aguardando_deploy|concluido`).
- `ticket_updates` — histórico de mensagens e transições de status (inclui eventos automáticos de criação/status de subchamado).
- `ticket_attachments` — metadados; arquivos no bucket privado `ticket-attachments`.
- `time_entries` — horas trabalhadas (`timer` ou `manual`), ligadas a cliente/contrato/chamado.
- `notifications` — notificações in-app (`user_id`, `ticket_id`, `type: abertura|fechamento|status_alterado`, `message`, `read`); RLS restrita ao próprio usuário. `profiles` tem `email_notifications` (default `true`) e `whatsapp_notifications` (default `false`, **ainda sem envio implementado**).
- `user_roles`, `integration_secrets` (segredo do webhook em `webhook_tickets`; segredo do envio de e-mail de notificação em `notify_email_secret`; `app_base_url` também fica aqui).

### 5.1 Subchamados de desenvolvimento

Um chamado pode ter **subchamados** (`parent_ticket_id`) usados só internamente pela equipe de dev para quebrar o trabalho de implementação de um chamado em etapas, exibidos com numeração `0010.1`, `0010.2` (`view public.tickets_display`, `format_display_number()`). Regras: um subchamado não pode ter filhos; cliente nunca vê subchamados (RLS filtra `parent_ticket_id IS NULL`); só `admin`/`dev` criam subchamados; quando todos os subchamados de um pai chegam a `concluido`, o chamado pai é automaticamente marcado `resolvido` (trigger). Gerenciados pelo kanban em `/dev` (`src/components/dev-kanban.tsx`, drag-and-drop com `@dnd-kit`) e por um card "subchamados" na tela de detalhe do chamado pai (`src/components/subticket-dialog.tsx`). Server functions em `src/lib/subtickets.functions.ts`.

### 5.2 Notificações

Toda criação de chamado e toda mudança de `status` disparam trigger no Postgres (`notify_ticket_created`, `notify_ticket_status_changed` → `create_ticket_notification()`, extensão `pg_net`) que grava uma linha em `notifications` e chama `POST /api/public/notificacoes/email` (`src/routes/api/public/notificacoes/email.ts`) para envio opcional de e-mail (Resend via gateway da Lovable). Subchamados não geram notificação. Sino de notificações (`src/components/notification-bell.tsx`, polling a cada 60s) fica no header do `/portal` — **não aparece em `/admin`**.

**Status do chamado** (`ticket_status`): `aberto → em_andamento → aguardando_cliente → respondido_cliente → em_desenvolvimento → resolvido → fechado`.

### Regras de negócio no banco

- `validate_client_ticket_transition` (trigger) — cliente só pode `resolvido→fechado`, `resolvido→em_andamento` (reabertura, ver abaixo) e `aguardando_cliente→respondido_cliente`; não pode alterar nenhum outro campo, incluindo `service_type`, `asset_id` e dados de toner.
- `auto_client_response_status()` — quando o cliente comenta em um chamado `resolvido`, reabre automaticamente para `em_andamento` e registra a mensagem "Chamado reaberto automaticamente após resposta do cliente." em `ticket_updates`.
- `close_ticket_by_client(p_ticket_id)` e `add_client_ticket_response(p_ticket_id, p_message)` — operações transacionais que também gravam o histórico.
- `auto_close_resolved_tickets()` — fecha chamados `resolvido` após 24h (agendada via `pg_cron`).
- `create_ticket_from_webhook(...)` — usada pelo endpoint público.

**Toda tabela nova em `public` exige, na mesma migração:** `CREATE TABLE` → `GRANT` (authenticated / service_role / anon quando aplicável) → `ENABLE ROW LEVEL SECURITY` → policies.

## 7. Camada de servidor

Lógica interna usa `createServerFn` do `@tanstack/react-start`, em arquivos `src/lib/*.functions.ts`:

- `session.functions.ts` — `getMySession` (perfil + papéis).
- `tickets.functions.ts` — listar, criar, detalhar, responder, prioridade, contrato, anexos, fechar pelo cliente.
- `clients.functions.ts` — CRUD de clientes e técnicos, senha e ativação/inativação (admin).
- `contracts.functions.ts` — contratos e ativos; exporta `BILLING_TYPES` e `ASSET_CATEGORIES`.
- `technician-contracts.functions.ts` — atribuições.
- `time-entries.functions.ts` — cronômetro e lançamentos manuais.
- `account.functions.ts` — troca da própria senha.
- `subtickets.functions.ts` — `listSubtickets`, `createSubticket`, `updateSubticketStatus`, `getSubticket` (kanban de dev, ver §5.1).
- `notifications.functions.ts` — `listMyNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `updateMyNotificationPrefs` (ver §5.2).

Middleware de autenticação: `src/lib/require-auth.ts` valida o Bearer token e injeta `{ supabase, userId, claims, accessToken, backendUrl, publishableKey }` no contexto — **RLS aplica-se como o usuário**. O token é anexado no cliente por `functionMiddleware` em `src/start.ts`.

### 7.1 Conexão com o banco (pós-migração) — leia antes de tudo

A conexão ativa **não** vem do `.env` nem dos arquivos gerados pelo Lovable Cloud. Use sempre estes módulos:

- `src/integrations/supabase/app-client.ts` — cliente do navegador/SSR, com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` fixos do projeto próprio (`piwywswwdqarzvzzmhzf`).
- `src/integrations/supabase/admin.server.ts` — cliente de serviço, lê `NEW_SUPABASE_URL` / `NEW_SUPABASE_SERVICE_ROLE_KEY` (com fallback para as variáveis padrão).
- `src/integrations/supabase/app-auth-attacher.ts` — `functionMiddleware` que anexa o token do projeto ativo; registrado em `src/start.ts`.
- `src/lib/require-auth.ts` — valida o token contra a URL do projeto ativo (o novo projeto assina JWT com **ES256**; apontar para a URL errada resulta em "Sessão inválida").

**Nunca importe** `@/integrations/supabase/client`, `client.server`, `auth-attacher` ou `auth-middleware` — apontam para o projeto antigo. Os únicos artefatos gerados ainda em uso são `src/integrations/supabase/types.ts` (tipos do schema) e o `Database` derivado dele.

### Regra crítica (já causou incidente)

Nunca use o cliente administrativo (service role, `@/integrations/supabase/admin.server`) em fluxos comuns do cliente — no runtime errado ele lança *"Missing Supabase environment variable(s)"*. Ele é permitido **apenas** em operações administrativas (criar conta, trocar senha de terceiro, ativar/inativar, excluir), sempre importado **dentro** do handler e após verificar o papel do chamador.

Arquivos gerados que **não** devem ser editados: `src/integrations/supabase/{client.ts,client.server.ts,types.ts,auth-middleware.ts,auth-attacher.ts}`, `.env`, `supabase/config.toml`.

## 8. Integrações externas

- **Webhook de chamados** — `POST /api/public/chamados` com header `x-webhook-secret` (ou `Authorization: Bearer <segredo>`), validado contra `integration_secrets.name = 'webhook_tickets'`. Payload: `email`, `title`, `description`, `priority?`, `custom_fields?`. Spec em `/api/public/openapi` e UI em `/api-docs`. Rotas sob `/api/public/*` ignoram a autenticação do site — a verificação deve estar no handler.
- **MCP (`@lovable.dev/mcp-js`)** — ferramentas em `src/lib/mcp/tools` (`get-company-info`, `list-services`).
- **E-mail de notificação** — `POST /api/public/notificacoes/email` (`src/routes/api/public/notificacoes/email.ts`), autenticado por `secret` contra `integration_secrets.notify_email_secret`; envia via Resend usando o gateway da Lovable (`https://connector-gateway.lovable.dev/resend`), exige `LOVABLE_API_KEY` + `RESEND_API_KEY` (503 se faltar algum). Disparado pelos triggers de `notifications` (ver §5.2), nunca chamado diretamente pelo frontend.
- **Lovable AI Gateway** disponível via `LOVABLE_API_KEY` — hoje usado pelo envio de e-mail de notificação acima.

## 9. Convenções ao continuar o desenvolvimento

1. Textos de interface em pt-BR; datas e moeda em formato brasileiro.
2. Cores/sombras sempre por tokens do design system.
3. Mudanças de schema sempre por migração versionada + regeneração dos tipos.
4. Toda leitura sensível protegida por RLS; não confiar em filtro apenas no frontend.
5. Chamados sempre vinculados a um contrato; a tela de abertura muda conforme `billing_type` (locação de impressoras pede ativo e cor de toner, por exemplo).
6. Listas de chamados são agrupadas por **cliente → contrato** (`src/components/tickets-by-contract.tsx`, `groupTicketsByClientAndContract`), com toggle e seções recolhíveis; o nível de cliente só aparece quando há mais de um cliente na lista (ex.: admin, técnico com vários contratos) — cliente comum sempre vê só o próprio, então o nível fica oculto.
7. Ao adicionar um status/prioridade, atualizar: enum no banco, `src/lib/tickets-function-support.ts`, `src/components/ticket-dashboard.tsx`, `portal.tsx`, `admin.tsx` e o seletor em `portal.chamado.$id.tsx`.
8. Cada rota de conteúdo precisa do seu próprio `head()` com título/descrição únicos.
9. Subchamados (`parent_ticket_id`) são só para uso interno de dev — nunca expor a clientes; qualquer query de chamados voltada ao cliente deve filtrar `parent_ticket_id IS NULL` (RLS já faz isso, mas checar em queries administrativas/relatórios novos).

## 10. Pontos de atenção conhecidos

- Custo por hora fica distorcido em contratos com menos de 1h lançada — há aviso visual em `admin-hours.tsx`.
- Bucket `ticket-attachments` é privado: acesso sempre por URL assinada.
- Bibliotecas Node-only não funcionam no runtime de produção (Workers); prefira APIs Web/fetch.
- `profiles.whatsapp_notifications` existe no banco mas **não tem envio implementado** — é só um campo de preferência, sem efeito ainda.
- `src/lib/error-page.ts` (`renderErrorPage`) está em inglês; se for revisado, ajustar para pt-BR conforme convenção do §9.
- A migração para o Supabase próprio está **concluída** (ver §2 e §7.1). Migrações de schema agora devem ser aplicadas no projeto `piwywswwdqarzvzzmhzf`; aplicar apenas no Lovable Cloud não tem efeito no app.
- Plano Free do Supabase Cloud pausa o projeto após 1 semana sem requisição de API e não tem backup automático — rodar `pg_dump` manual com frequência até migrar para o Pro.
- Após a validação funcional (Etapa 8) os dados de teste foram removidos: a base voltou a **45 chamados** e a sequência ficou em 50 — o próximo chamado real será **#0051**.
- O app ainda **não foi publicado** depois do corte. Até publicar, os triggers de notificação por e-mail e o `pg_cron` continuam apontando para a URL antiga/preview — publicar e conferir `integration_secrets.app_base_url`.
