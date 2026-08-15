# Kanban de Desenvolvimento (Fase 5)

Interface para a equipe de desenvolvimento acompanhar os subchamados em um quadro de colunas, com arrastar e soltar. O backend já está pronto: numeração `0010.1`, registro automático no histórico e fechamento automático do chamado pai são feitos pelo banco — nada disso será recriado.

## O que será entregue

1. **Nova página "Desenvolvimento"** (`/dev`), acessível apenas para Admin e Desenvolvedor. Técnicos e clientes que tentarem abrir são redirecionados ao portal com aviso.
2. **Atalho de navegação** para o quadro, exibido só para esses dois perfis (no cabeçalho do portal e do painel admin).
3. **Quadro com 4 colunas**: Backlog, Em desenvolvimento, Aguardando deploy, Concluído. Cada coluna mostra a contagem de cartões.
4. **Cartões** com: número exibido (`0010.1`), título, selo de prioridade e link para o chamado pai (`0010`).
5. **Arrastar e soltar** entre colunas: o cartão muda de coluna imediatamente na tela e é salvo no banco em seguida; se der erro, volta para a posição anterior e mostra aviso. Confirmação e erros via notificação (sonner).
6. **Detalhe do subchamado**: ao clicar no cartão, abre um painel lateral/modal com descrição, prioridade, situação de desenvolvimento (também alterável por seletor, útil no celular) e o histórico completo de mensagens do subchamado.
7. **Botão "Novo subchamado"** na tela do chamado pai (visível para Admin/Dev), com formulário de título, descrição, prioridade e coluna inicial. Após criar, o subchamado aparece listado no chamado pai e no quadro.
8. **Reflexo do fechamento automático**: ao mover o último subchamado para Concluído, as consultas do chamado pai são atualizadas para exibir o novo status "Resolvido" registrado pelo banco.

## Detalhes técnicos

- Dependência nova: `@dnd-kit/core` (mais `@dnd-kit/utilities` para o transform do cartão arrastado). Sem alterações em `src/routeTree.gen.ts`.
- Rota `src/routes/_authenticated/dev.tsx` com `errorComponent`/`notFoundComponent`; a guarda de perfil usa `getMySession` (`isAdmin || isDev`) no componente, já que o gate autenticado é `ssr: false`.
- Dados via TanStack Query sobre as server functions existentes em `src/lib/subtickets.functions.ts` (`listSubtickets`, `updateSubticketStatus`, `createSubticket`). RLS já limita a visibilidade a admin/dev.
- Nova server function `getSubticket` (mesmo arquivo, padrão `requireAuth`) retornando o subchamado + `ticket_updates` ordenados, para o detalhe.
- Mutation de mudança de coluna com `onMutate` (atualização otimista no cache), `onError` (rollback) e `invalidateQueries` das chaves `["subtickets"]`, `["ticket", parentId]` e listas de chamados.
- Histórico em `ticket_updates` continua sendo gravado pelos gatilhos `trg_subticket_status_dev` e `trg_log_subticket_created` — o frontend não insere nada manualmente.
- Formulário de criação com `react-hook-form` + `zod`, reaproveitando `devStatusSchema` de `src/lib/subtickets-support.ts`.
- Componentes novos em `src/components/dev-kanban.tsx` e `src/components/subticket-dialog.tsx`; cores apenas por tokens do design system, sem valores fixos.
- No mobile (viewport estreito), as colunas rolam horizontalmente e o seletor de situação no detalhe substitui o arrastar.

## Fora de escopo

- Filtros avançados, relatórios ou ordenação dentro da coluna.
- Qualquer mudança em contratos, locação ou atribuição de técnicos.
