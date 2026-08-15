# Notificações do Cliente (in-app + email)

Notificações exclusivas para o cliente. Admin, técnico e subchamados de desenvolvimento ficam fora desta etapa.

## 1. Preferências no cadastro do cliente

- Novos campos no perfil: notificações por email (ligado por padrão) e notificações por WhatsApp (desligado).
- No formulário de cliente (Admin → Clientes), dois toggles:
  - "Notificações por email" — funcional.
  - "Notificações por WhatsApp" — desabilitado, com selo "Em desenvolvimento".
- O cliente também poderá ligar/desligar o próprio email de notificação na área de conta do portal.

## 2. Notificações in-app

Nova tabela `notifications` (dono, chamado, tipo, mensagem, lida, data) com regra de acesso: cada cliente só enxerga e marca como lidas as próprias notificações.

Tipos: `abertura`, `fechamento`, `status_alterado`.

## 3. Quando são geradas

Gatilhos no banco (mesmo padrão já usado no projeto para histórico e fechamento em cascata):

- Chamado criado → `abertura` ("Seu chamado #0010 foi aberto.").
- Status alterado → `status_alterado` com o novo status por extenso.
- Status alterado para "Fechado" → apenas `fechamento` (sem a de status alterado, evitando duplicidade).
- Chamados com chamado-pai (subchamados de desenvolvimento) não geram nada.

O destinatário é sempre o cliente dono do chamado.

## 4. Email via Resend

- Conectar o Resend pelo conector oficial do Lovable (o cartão de conexão aparece no chat) e usar o domínio `send.projetus.tech`; o remetente será algo como `naoresponda@send.projetus.tech`, com verificação de DNS feita no painel do Resend.
- O envio é feito por uma rota de servidor pública protegida por segredo, chamada pelo banco quando uma notificação é criada — assim o email acompanha exatamente os mesmos eventos da notificação in-app.
- Três templates em português com a identidade Projetus (azul `#0B3C74` e ciano `#00C4F3`), assunto e corpo próprios para abertura, fechamento e mudança de status, com link para o chamado.
- Se o cliente estiver com email desligado, a notificação in-app continua sendo criada e nenhum email é enviado.

## 5. Sino no portal

- Ícone de sino no header do `/portal` com contador de não lidas.
- Painel com as notificações recentes: mensagem, tipo, tempo relativo e link para o chamado.
- Clicar em uma notificação marca como lida e abre o chamado.
- Botão "Marcar todas como lidas" zera o contador.
- Atualização periódica leve (revalidação a cada ~60s e ao focar a aba).

## Detalhes técnicos

- Migração: colunas `email_notifications`/`whatsapp_notifications` em `profiles`; tabela `notifications` com GRANTs (`authenticated`, `service_role`) + RLS `user_id = auth.uid()` para leitura e update.
- Gatilhos `AFTER INSERT` e `AFTER UPDATE OF status` em `tickets`, ignorando `parent_ticket_id is not null`; a mensagem usa `format_display_number`.
- Envio de email: gatilho chama `pg_net` para `POST /api/public/notificacoes/email` (rota TanStack em `src/routes/api/public/`), validada por segredo compartilhado; a rota lê o perfil, decide se envia e chama o Resend via gateway de conectores.
- Frontend: `src/lib/notifications.functions.ts` (`listMyNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `updateMyNotificationPrefs`), componente `src/components/notification-bell.tsx` no header de `src/routes/_authenticated/portal.tsx`, toggles em `src/routes/_authenticated/admin.tsx` (formulário de cliente) e em `src/lib/clients.functions.ts`.
- Sem cores hardcoded nos componentes (tokens de `src/styles.css`); `src/routeTree.gen.ts` não é editado manualmente.