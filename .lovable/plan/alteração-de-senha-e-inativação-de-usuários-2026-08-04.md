# Alteração de senha e inativação de usuários

## 1. Usuário logado altera a própria senha
- No portal do cliente, novo card "Segurança" com formulário: nova senha + confirmar senha (mín. 8 caracteres, validação de coincidência).
- A troca usa a autenticação do próprio usuário (sessão atual), sem passar pelo admin.
- Feedback com toast de sucesso/erro.

## 2. Admin altera a senha de um cliente
- No painel Admin, na linha de cada cliente, novo botão "Senha" que abre um diálogo para definir uma nova senha manualmente.
- Somente administradores podem executar; a ação é validada no servidor.
- Mensagem lembrando o admin de comunicar a nova senha ao cliente.

## 3. Admin inativa/reativa um cliente
- Botão de alternância "Ativar/Inativar" direto na linha do cliente (hoje isso só existe escondido dentro do modal de edição).
- Ao inativar: o acesso do cliente é bloqueado — ele não consegue mais entrar no sistema; se estiver logado, é desconectado na próxima verificação.
- Ao reativar: acesso liberado novamente.
- Selo visual "Inativo" já existente permanece.

## Detalhes técnicos
- `src/lib/clients.functions.ts`: novas server functions `setClientPassword` e `setClientActive` (ambas com verificação de admin via `has_role`, usando o cliente admin do backend para tocar em Auth). `setClientActive` atualiza `profiles.active` e aplica/remove o banimento na conta de autenticação (`ban_duration`) para efetivar o bloqueio de login.
- `src/lib/account.functions.ts` (novo): `changeMyPassword` — server function autenticada que valida a senha (zod, mín. 8) e atualiza a senha do próprio usuário.
- `src/routes/_authenticated/portal.tsx`: card "Segurança" com o formulário de senha.
- `src/routes/_authenticated/admin.tsx`: botões/diálogos de senha e ativar/inativar em `ClientRow`, com invalidação da query `clients`.
- Sem alterações de banco de dados (a coluna `active` já existe).
