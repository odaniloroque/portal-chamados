# Correção definitiva dos erros de ambiente no portal

## Problema confirmado
O backend está saudável e as credenciais gerenciadas estão vinculadas. Porém, ações comuns do cliente — fechar um chamado e alterar automaticamente o status após responder — carregam o cliente administrativo, que exige uma credencial privilegiada do runtime. Isso cria uma dependência desnecessária e explica por que a mesma mensagem aparece em diferentes pontos quando essa credencial não está disponível naquela execução.

## Implementação
1. Criar operações transacionais no banco para:
   - fechar somente um chamado `Resolvido` pertencente ao cliente autenticado;
   - registrar o fechamento no histórico na mesma transação;
   - ao cliente responder um chamado `Aguardando cliente`, alterar para `Respondido pelo cliente` e registrar a transição.
2. Aplicar validação de identidade, propriedade e status dentro dessas operações, sem aceitar um usuário informado pelo navegador.
3. Atualizar as funções de chamados para usar a conexão autenticada já existente, eliminando o acesso administrativo dos fluxos normais do portal.
4. Auditar os demais usos do cliente administrativo e mantê-lo apenas onde é realmente necessário, como criação, senha, ativação e exclusão de contas pelo administrador.
5. Remover o bootstrap administrativo antigo, que já não possui interface e mantém outra dependência privilegiada pública sem necessidade.
6. Validar os cenários principais: cliente fecha chamado resolvido, tentativa em status inválido é bloqueada, resposta atualiza o status, histórico é criado e ações administrativas continuam funcionando.

## Resultado esperado
- Fechar ou responder chamados não dependerá mais da credencial administrativa.
- Atualização de status e histórico será atômica, evitando registros pela metade.
- Falhas de configuração privilegiada ficarão isoladas às funções administrativas que realmente precisam dela.

## Detalhes técnicos
- Migração com funções `SECURITY DEFINER`, `search_path` fixo, verificação por `auth.uid()` e permissão de execução somente para usuários autenticados.
- `src/lib/tickets.functions.ts` chamará essas funções por `context.supabase.rpc(...)`.
- `src/lib/session.functions.ts` deixará de exportar a rotina antiga de primeira instalação.
- Nenhuma credencial será enviada ao navegador nem gravada no código.