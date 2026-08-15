# Múltiplos contratos por cliente

## Objetivo
Permitir que um mesmo cliente tenha vários contratos (ex.: "Locação de impressoras" e "Manutenção e suporte de TI"), com chamados e horas separados por contrato — mantendo um único login para o cliente.

## Como vai funcionar

### 1. Cadastro de contratos (admin)
- Nova área **Contratos** dentro do cadastro do cliente, no painel admin.
- Cada contrato tem: nome/descrição, número, plano, valor, início, fim e situação (ativo/inativo).
- Um cliente pode ter quantos contratos quiser. Os dados de contrato que hoje ficam no cadastro do cliente viram o primeiro contrato dele automaticamente (nada se perde).

### 2. Abertura de chamado
- Se o cliente tem mais de um contrato ativo, o formulário mostra um campo **Contrato** obrigatório.
- Se tem apenas um, o contrato é preenchido automaticamente e o campo não aparece.
- Somente o admin pode trocar o contrato de um chamado na tela de detalhe (registrado no histórico).

### 3. Portal do cliente e painel admin
- O contrato aparece como etiqueta na lista e no detalhe do chamado.
- Novo filtro "Contrato" na lista de chamados (portal e admin), visível quando há mais de um.
- Cronômetro e lançamentos de horas herdam o contrato do chamado; no lançamento manual o admin escolhe cliente + contrato.

### 4. Aba Horas — custo por hora por contrato
- A tabela de custo por hora passa a ter uma linha por **contrato** (com o nome do cliente ao lado).
- Valor por hora = valor daquele contrato ÷ horas lançadas naquele contrato no período.
- Horas antigas sem contrato aparecem agrupadas como "Sem contrato" para você reclassificar.
- Filtro de contrato na aba Horas e nas colunas do CSV.

## Detalhes técnicos
- Migração: nova tabela `public.contracts` (`client_id` → `profiles.id`, `name`, `contract_number`, `contract_plan`, `contract_value numeric(12,2)`, `contract_start`, `contract_end`, `active`, timestamps + trigger `set_updated_at`), GRANTs para `authenticated`/`service_role`, RLS: cliente lê os próprios, staff lê todos, admin gerencia.
- Backfill na mesma migração: cria um contrato por perfil que já tenha algum dado contratual preenchido; colunas atuais em `profiles` permanecem (somente leitura/legado) para não quebrar telas existentes.
- `tickets.contract_id uuid null` e `time_entries.contract_id uuid null` (FK para `contracts`), com backfill para o contrato único quando existir.
- Novo `src/lib/contracts.functions.ts` (list/create/update/deactivate, admin-only para escrita) e inclusão de `contract` no enriquecimento de `listMyTickets`/`listAllTickets`/`getTicket`/`listTimeEntries`.
- `createTicket` passa a validar `contract_id` pertencente ao usuário; nova `updateTicketContract` restrita a admin, com registro em `ticket_updates`.
- UI: aba/gestor de contratos em `src/routes/_authenticated/admin.tsx`, seletor no formulário de chamado e no detalhe (`portal.chamado.$id.tsx`), filtro em `portal.tsx`, agregação por contrato em `src/components/admin-hours.tsx`.
