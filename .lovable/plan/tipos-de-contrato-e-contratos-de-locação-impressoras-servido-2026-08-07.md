# Tipos de contrato e contratos de locação (impressoras, servidores e rede)

## Objetivo
Diferenciar os contratos por modalidade de cobrança (por hora, fixo, por serviço) e criar um comportamento especial para contratos de **locação de equipamentos**, com parque de ativos cadastrado e uma tela de abertura de chamado personalizada. Já contempla locação de impressoras (outsourcing), de servidores e de equipamentos de rede.

## 1. Tipo de contrato (aba Contratos do cliente)
No cadastro do contrato passa a existir o campo **Tipo de cobrança**:
- **Por hora** — horas trabalhadas geram o valor/hora.
- **Fixo (mensalidade)** — valor mensal fechado.
- **Por serviço executado** — cobrado por atendimento/OS.
- **Locação de impressoras (outsourcing)** — parque de impressoras + insumos.
- **Locação de servidores** — parque de servidores.
- **Locação de equipamentos de rede** — parque de switches, roteadores, APs, firewalls.

O tipo aparece como etiqueta na lista de contratos, no chamado e nos filtros.

## 2. Campos extras dos contratos de locação
Visíveis **somente para o admin** (cliente e técnico não veem valores):
- Modalidade de contrato (ex.: franquia + excedente, custo por página, comodato, locação mensal).
- Apenas em impressoras: cobrança de insumo (por toner ou por página/papel), valor por toner, valor por página, franquia mensal de páginas.

### Parque de equipamentos
Lista única de ativos do contrato, com **categoria** (impressora, servidor, equipamento de rede, outro) e os campos: nome/modelo, número de série, setor/local, situação (ativo/inativo) e observações. Campos específicos por categoria:
- Impressora: contador atual.
- Servidor: hostname/IP, especificação resumida.
- Rede: hostname/IP, tipo (switch, roteador, AP, firewall).

Admin inclui, edita e remove equipamentos. Cliente e técnico apenas selecionam ao abrir/atender o chamado.

## 3. Abertura de chamado personalizada
Ao escolher o contrato, o formulário se adapta:

- **Locação de impressoras** → tipo de solicitação:
  - Manutenção corretiva → impressora do parque + descrição do defeito.
  - Manutenção preventiva → impressora do parque + observações.
  - Solicitação de toner → impressora, **cor** (preto, ciano, magenta, amarelo) e **quantidade**.
- **Locação de servidores / rede** → tipo de solicitação (corretiva, preventiva, mudança/configuração) + seleção do equipamento do parque + descrição.
- **Demais contratos** → exatamente a tela que já existe hoje (título, descrição, prioridade, campos adicionais).

Os dados escolhidos ficam registrados no chamado e aparecem no detalhe, para cliente, técnico e admin.

## 4. Aba Horas — metas e custo por hora
- A tabela "Custo por hora no período" passa a calcular valor/hora **apenas para contratos do tipo Por hora**.
- Contratos fixos, por serviço e de locação aparecem com o total de horas e a etiqueta do tipo, sem valor/hora (evita os valores distorcidos como o de R$ 122.900,40 da locação).
- Novo filtro por tipo de contrato e coluna "Tipo" também no CSV.

## Detalhes técnicos
- Migração: enum `contract_billing_type` (`por_hora`, `fixo`, `por_servico`, `locacao_impressoras`, `locacao_servidores`, `locacao_rede`); colunas em `public.contracts`: `billing_type` (default `por_hora`), `rental_mode text`, `supply_billing text`, `toner_price numeric(12,2)`, `page_price numeric(12,4)`, `monthly_page_quota int`.
- Nova tabela `public.contract_assets` (`contract_id` → `contracts.id` on delete cascade, `category text` em `impressora|servidor|rede|outro`, `name`, `serial`, `location`, `hostname`, `specs`, `counter int`, `active bool`, timestamps + trigger `set_updated_at`), com GRANTs para `authenticated`/`service_role` e RLS: admin gerencia; cliente lê os do próprio contrato; staff lê via `can_access_contract`.
- Campos financeiros do contrato ficam fora dos SELECTs usados por cliente/técnico; leitura completa só em funções que validam admin.
- Tickets: colunas `service_type text` (`corretiva`|`preventiva`|`toner`|`mudanca`), `asset_id uuid` → `contract_assets`, `toner_color text`, `toner_qty int`; validação no `createTicket` (obrigatórios apenas em contratos de locação; o ativo precisa pertencer ao contrato).
- `src/lib/contracts.functions.ts`: novos campos nos schemas + CRUD `listContractAssets`/`createContractAsset`/`updateContractAsset`/`deleteContractAsset`; `listMyContracts` retorna `billing_type` para a UI decidir o formulário.
- UI: campos e sub-lista de ativos em `src/components/client-contracts.tsx`; formulário condicional em `NewTicketDialog` (`src/routes/_authenticated/portal.tsx`); bloco de resumo do pedido em `portal.chamado.$id.tsx`; ajuste do cálculo e do filtro em `src/components/admin-hours.tsx`.
