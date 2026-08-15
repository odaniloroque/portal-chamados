# Novo status: Em desenvolvimento

## Objetivo
Permitir que técnicos e administradores encaminhem um chamado para a equipe de desenvolvimento, com um status próprio visível em todo o sistema.

## O que muda

1. **Novo status "Em desenvolvimento"**
   - Adicionado à lista oficial de status dos chamados, entre "Respondido pelo cliente" e "Resolvido".
   - Cor própria (âmbar/laranja) nos selos e gráficos, para diferenciar dos demais.

2. **Quem pode usar**
   - Técnico e administrador podem selecionar o novo status na tela do chamado, como já fazem com os outros.
   - O cliente não pode definir esse status; ele apenas visualiza o chamado como "Em desenvolvimento" e continua podendo responder normalmente (o chamado não fica bloqueado).

3. **Onde aparece**
   - Tela de detalhe do chamado (seletor de status e histórico da mudança).
   - Lista de chamados do portal e do painel admin: selo colorido e filtro por status.
   - Painel de indicadores: card de contagem, gráfico por status e contagem de chamados em aberto passa a incluir "Em desenvolvimento".

## Detalhes técnicos
- Migração: `ALTER TYPE public.ticket_status ADD VALUE 'em_desenvolvimento'` posicionado após `respondido_cliente`.
- A regra de transição do cliente (`validate_client_ticket_transition`) permanece inalterada, o que já impede o cliente de aplicar o novo status; a RLS de staff já cobre técnico e admin.
- Atualizar `ticketStatusSchema` em `src/lib/tickets-function-support.ts`.
- Atualizar rótulos/cores em `src/routes/_authenticated/portal.tsx`, `src/components/ticket-dashboard.tsx` (ordem, labels, cores, regra `finished`) e o `Select` em `src/routes/_authenticated/portal.chamado.$id.tsx`.
- Incluir `em_desenvolvimento` na lista de status "em aberto" usada em `src/routes/_authenticated/admin.tsx`.
- Tipos gerados do banco são regerados após a migração.
