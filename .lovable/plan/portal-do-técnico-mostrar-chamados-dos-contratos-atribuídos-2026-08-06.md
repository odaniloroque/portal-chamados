# Portal do técnico: mostrar chamados dos contratos atribuídos

## Situação atual (verificada)

No arquivo que carrega os chamados do portal (`listMyTickets`), há uma regra explícita: quando o usuário tem o perfil **técnico**, a consulta é filtrada por `user_id = usuário logado`. Ou seja, o técnico só vê no portal os chamados que ele mesmo abriu — nunca os chamados dos clientes.

As regras de segurança do banco já limitam corretamente o técnico aos contratos atribuídos a ele (função `can_access_contract` + política "Staff read permitted tickets"). O bloqueio está apenas nessa filtragem extra da aplicação.

## O que será feito

1. Remover a filtragem por autor quando o usuário for técnico, deixando o banco decidir o que ele pode ver — resultado: o técnico passa a ver, no portal, todos os chamados dos contratos atribuídos a ele.
2. Manter o comportamento atual para clientes (veem apenas os próprios chamados) e para admin (vê tudo).
3. Ajustar a listagem do portal para técnicos exibir também o nome do cliente/empresa do chamado (hoje o portal assume que todo chamado é do próprio usuário), usando apenas os dados básicos do perfil — sem expor valores de contrato.
4. Manter o agrupamento por contrato e o toggle de chamados fechados já existentes, que passam a agrupar os contratos atribuídos.
5. Estado vazio específico: se o técnico não tiver nenhum contrato atribuído, exibir aviso orientando procurar o administrador.

## Detalhes técnicos

- `src/lib/tickets.functions.ts`: em `listMyTickets`, trocar a condição `if (tecnico) query.eq("user_id", ...)` por: aplica `eq("user_id", ...)` somente quando o usuário **não** for staff (`is_staff`). Para staff, a RLS já restringe ao escopo permitido.
- Anexar perfis básicos (`id, full_name, company_name`) aos chamados quando o solicitante for staff, reutilizando o helper `attachProfiles(..., full = false)`.
- `src/routes/_authenticated/portal.tsx`: exibir o nome do cliente no card/linha do chamado quando presente; nenhuma mudança nas permissões de escrita.
- Nenhuma migração de banco é necessária.
