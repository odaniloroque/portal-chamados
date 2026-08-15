# Painel de indicadores no Portal do Cliente

Adicionar, no topo do Portal do Cliente (`/portal`), um resumo visual com a quantidade de chamados por status e por prioridade.

## O que o cliente verá

1. **Cards de status** (5 cards): Aberto, Em andamento, Aguardando cliente, Resolvido, Fechado — cada um com a quantidade e a cor já usada nos badges de status.
2. **Cards de prioridade** (4 cards): Baixa, Média, Alta, Crítica — com quantidade e as cores dos badges de prioridade atuais.
3. **Card de total**: total de chamados e quantos estão "em aberto" (não resolvidos/fechados).
4. **Clique filtra a lista**: clicar em um card aplica o filtro correspondente na lista de chamados abaixo; clicar de novo remove o filtro.
5. **Estado vazio**: se o cliente não tem chamados, os cards não aparecem (mantém a mensagem de boas-vindas atual).

## Layout

- Mobile: 2 colunas; tablet: 3; desktop: 5 (status) e 4 (prioridade).
- Números grandes, rótulo pequeno, borda/realce na cor do status ou prioridade.
- Compatível com o tema atual (claro/escuro), sem cores fixas fora do design system.

## Detalhes técnicos

- Nenhuma mudança no banco de dados e nenhuma nova chamada ao servidor: os totais são calculados no cliente a partir da lista de chamados já carregada (`listMyTickets`), com `useMemo`.
- Novo componente `src/components/ticket-stats.tsx` (cards + contagens, reutilizável).
- Ajuste em `src/routes/_authenticated/portal.tsx` para renderizar o componente e conectar o clique aos filtros de status/prioridade existentes.
- Reuso dos helpers atuais de badge (`src/lib/priority-badge.tsx`) para manter consistência visual.

## Estimativa de consumo

Trabalho pequeno e localizado: leitura de 2 arquivos, criação de 1 componente e edição de 1 rota.

- Estimativa: ~25 a 40 mil tokens no total (entrada + saída), equivalente a cerca de 1 a 2 créditos de mensagem.
- Sem migrações, sem novas dependências.
