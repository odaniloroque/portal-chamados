# Agrupamento de chamados por contrato

## Objetivo
Ver os chamados organizados por contrato, tanto na lista do portal do cliente quanto na lista do painel admin.

## Como vai funcionar
- Os chamados passam a ser exibidos em **seções recolhíveis**, uma por contrato.
- Cada cabeçalho mostra o nome do contrato (com número, quando houver) e a quantidade de chamados da seção.
- Chamados sem contrato ficam em uma seção final "Sem contrato".
- Todas as seções vêm **abertas por padrão**; clicar no cabeçalho recolhe/expande.
- Um botão/interruptor "Agrupar por contrato" fica **ligado por padrão**, permitindo voltar à lista simples.
- No painel admin, o agrupamento respeita o filtro de cliente: as seções mostram "Cliente — Contrato" para diferenciar contratos de clientes distintos.
- Filtros, busca e o toggle de chamados fechados continuam funcionando: o agrupamento é aplicado depois da filtragem, e seções vazias não aparecem.
- No mobile os cards seguem o mesmo agrupamento, com cabeçalhos compactos.

## Detalhes técnicos
- Novo componente `src/components/tickets-by-contract.tsx`: recebe a lista já filtrada e a renderização de cada item, agrupa por `ticket.contract_id` e monta as seções com `Collapsible` (shadcn) + contagem.
- `src/routes/_authenticated/portal.tsx`: estado `groupByContract` (padrão `true`) ao lado de `showClosed`; `filteredTickets` passa pelo agrupador tanto na tabela desktop quanto nos cards mobile.
- `src/routes/_authenticated/admin.tsx`: mesmo tratamento na lista de chamados (`tickets.map`), usando `contract` + `profiles.full_name` já retornados por `listAllTickets`.
- Sem mudanças de banco nem de server functions — `contract` já vem anexado aos chamados.
