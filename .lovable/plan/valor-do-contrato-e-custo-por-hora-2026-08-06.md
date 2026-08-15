# Valor do contrato e custo por hora

## Objetivo
Registrar o valor pago por cada contrato no cadastro do cliente e, na aba **Horas** do painel admin, mostrar uma tabela com total de horas por cliente e o valor por hora resultante.

## O que muda

### 1. Cadastro do cliente
- Novo campo **Valor do contrato (R$)** no formulário de cliente (admin), ao lado de Plano/Contrato.
- Aceita valores decimais (ex.: 2.500,00) e pode ficar vazio.
- Exibido também nos detalhes do cliente para o admin.

### 2. Aba Horas — nova tabela "Custo por hora"
Abaixo do total do período, uma tabela com uma linha por cliente que tenha horas lançadas no período filtrado:

| Cliente / Contrato | Total de horas | Valor do contrato | Valor por hora |
|---|---|---|---|

- Total de horas: soma dos lançamentos dentro do intervalo De/Até selecionado.
- Valor por hora = valor do contrato ÷ total de horas do período.
- Sem valor de contrato cadastrado: mostra "—" na coluna de valor por hora.
- Respeita o filtro de cliente (quando um cliente específico é escolhido, a tabela mostra só ele).
- A exportação CSV da aba ganha essas colunas em um resumo ao final.

## Detalhes técnicos
- Migração: adicionar coluna `contract_value numeric(12,2)` em `public.profiles` (nulo permitido).
- `src/lib/clients.functions.ts`: incluir `contract_value` no create/update e no retorno da listagem.
- `src/lib/time-entries.functions.ts`: incluir `contract_value` na projeção de `profiles` do enriquecimento de `listTimeEntries`.
- `src/routes/_authenticated/admin.tsx`: campo no formulário do cliente (parse pt-BR para número).
- `src/components/admin-hours.tsx`: agregação por `client_id` com `useMemo` e nova `Card` com a tabela; formatação em BRL via `Intl.NumberFormat`.
- Sem mudança de permissões: a aba Horas já é restrita ao admin.
