# Perfil Técnico no atendimento

## O que muda

Três perfis passam a existir:

- **Admin** — tudo como hoje: abas administrativas (clientes, horas, equipe), cadastro, senhas, dados de contrato.
- **Técnico** — vê todos os chamados, responde, muda status e usa o cronômetro do chamado. Não lança horas manualmente, não vê as abas administrativas nem o card com dados de contrato/empresa do cliente.
- **Cliente** — exatamente como está hoje.

## Cadastro da equipe

Nova aba **Equipe** no painel Admin (visível só para admin):

- Lista de técnicos com nome, e-mail e situação.
- Botão "Novo técnico": nome, e-mail e senha inicial.
- Ações por linha: alterar senha, ativar/inativar, remover perfil técnico.

## Experiência do técnico

- Ao entrar, cai numa lista com **todos os chamados** (mesma tela do admin de chamados, sem as abas de clientes/horas/equipe).
- No chamado: responde, altera status, reabre, anexa arquivos e usa o cronômetro. O lançamento manual de horas fica só com o admin.
- Card "Dados do cliente" (contrato, empresa, telefone, vigência) permanece exclusivo do admin.

## Detalhes técnicos

- Banco: adicionar valor `tecnico` ao enum `app_role`. Políticas RLS de `tickets`, `ticket_updates`, `ticket_attachments` e `time_entries` passam a aceitar `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'tecnico')` onde hoje só há admin. `profiles`: técnico ganha leitura apenas dos campos necessários para atender (nome/e-mail do solicitante) — as políticas de contrato seguem restritas ao admin.
- `src/lib/session.functions.ts`: expor `isTecnico` e um `isStaff = isAdmin || isTecnico`.
- `src/lib/tickets.functions.ts` (`listAllTickets`): trocar a checagem de admin por checagem de staff. `src/lib/time-entries.functions.ts`: liberar para técnico apenas o registro vindo do cronômetro (`source = 'timer'`); criação manual, edição e exclusão seguem restritas a admin.
- `src/lib/clients.functions.ts`: continua restrito a admin; novas funções `listTechnicians`, `createTechnician`, `setTechnicianActive`, `setTechnicianPassword` (todas com verificação de admin no servidor).
- `src/routes/_authenticated/admin.tsx`: liberar acesso para staff; renderizar as abas Clientes/Horas/Equipe apenas quando `isAdmin`. Nova aba Equipe.
- `src/routes/_authenticated/portal.chamado.$id.tsx`: trocar `session.isAdmin` por `isStaff` nas ações (responder, status, timer) e manter `isAdmin` no card de dados do cliente e no link de voltar.
- `src/routes/_authenticated/portal.tsx`: redirecionar staff para `/admin`.
- Sem mudanças nas regras do cliente.
