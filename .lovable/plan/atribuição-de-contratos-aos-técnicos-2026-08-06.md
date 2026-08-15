# Atribuição de contratos aos técnicos

Hoje qualquer técnico enxerga todos os chamados. A mudança cria um vínculo explícito
"técnico → contrato": o técnico Paulo, por exemplo, pode atender 1 contrato da PR Limpsik
e 2 contratos de outro cliente. Fora dos contratos atribuídos, ele não vê nada.

## Regras acordadas

- Atribuição é sempre por contrato específico (nunca "cliente inteiro"). Contratos novos
  precisam ser liberados manualmente.
- Técnico sem nenhuma atribuição não vê nenhum chamado.
- A restrição vale para tudo: lista de chamados, detalhe, respostas, mudança de status/
  prioridade, cronômetro e lançamento de horas.
- Admin continua com acesso total e é quem faz as atribuições.

## Como fica na tela

Na aba **Equipe** do painel Admin, cada técnico ganha um botão "Contratos atendidos".
Abre um painel listando os clientes com seus contratos ativos, com caixas de seleção:
marcar/desmarcar contrato a contrato, com busca por nome de cliente e um resumo
("3 contratos · 2 clientes") na linha do técnico.

No portal, o técnico passa a ver apenas os chamados dos contratos atribuídos; o
agrupamento por contrato já existente continua funcionando normalmente. Se ele não tiver
nada atribuído, aparece um estado vazio explicando que o administrador precisa liberar
os contratos.

## Detalhes técnicos

1. **Migração**: nova tabela `public.technician_contracts` (`technician_id`, `contract_id`,
   `created_at`, unique no par), com GRANTs (`authenticated`, `service_role`), RLS ativa:
   admin gerencia tudo; técnico lê apenas as próprias linhas.
2. **Função de apoio**: `public.can_access_contract(_user_id uuid, _contract_id uuid)`
   (security definer) → true para admin, true para técnico com vínculo, false caso contrário.
3. **RLS ajustada** nas policies de staff (que hoje usam `is_staff`) em `tickets`,
   `ticket_updates`, `ticket_attachments`, `time_entries` e `contracts`: admin mantém acesso
   total; técnico passa a depender de `can_access_contract` sobre o `contract_id` do chamado.
   Chamados sem contrato ficam visíveis somente para admin.
4. **Backend** (`src/lib/tickets.functions.ts`, `src/lib/time.functions.ts` e
   `src/lib/team.functions.ts`): novas server functions
   `listTechnicianContracts` / `setTechnicianContracts` (admin), e checagem explícita de
   permissão antes de responder chamado, alterar status/prioridade, iniciar cronômetro
   e lançar horas.
5. **Frontend**: novo componente `src/components/technician-contracts.tsx` (painel de
   seleção) integrado à `TeamTab` em `src/routes/_authenticated/admin.tsx`; estado vazio
   dedicado no portal quando o técnico não tem contratos.
