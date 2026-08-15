# Credenciais do Supabase Cloud novo (Fase 1 da migração) — RASCUNHO

**Não é a conexão ativa do app.** O `.env` do repositório continua apontando para o Lovable Cloud (`ecujuzhlxjzzbctfwzra`) até a migração pela Lovable terminar e ser confirmada (ver Etapa 7 do plano em `.lovable/plan/migração-do-banco-para-o-supabase-próprio-supabase-projetus-2026-08-11.md`).

Este arquivo é só um lugar durável para guardar as credenciais do projeto novo enquanto a migração roda, já que a pasta de trabalho temporária da IA some entre sessões.

- Project URL: `https://piwywswwdqarzvzzmhzf.supabase.co`
- Publishable key: `sb_publishable_Q1A9Z-hEkyQxoZryPjGxXQ_eQTzR65q`
- Service role key: `sb_secret_P_BEoGL-9v2ayD0fVc9TyQ_JWRLC7E3`

## Quando usar

Na Etapa 7 (corte de produção), depois de confirmar os 5 pontos do briefing (contagem de linhas, senhas, bucket `ticket-attachments`, `pg_cron`/`pg_net`, próximo `ticket_number`), essas credenciais substituem as atuais no `.env`:

```
SUPABASE_URL=https://piwywswwdqarzvzzmhzf.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_Q1A9Z-hEkyQxoZryPjGxXQ_eQTzR65q
SUPABASE_SERVICE_ROLE_KEY=sb_secret_P_BEoGL-9v2ayD0fVc9TyQ_JWRLC7E3
VITE_SUPABASE_URL=https://piwywswwdqarzvzzmhzf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Q1A9Z-hEkyQxoZryPjGxXQ_eQTzR65q
```

(`SUPABASE_PROJECT_ID`/`VITE_SUPABASE_PROJECT_ID` também precisam trocar para `piwywswwdqarzvzzmhzf`.)

## Atenção

Este arquivo **não está no `.gitignore`** (a mesma situação do `.env`, mantida como está a seu pedido). Ele fica na pasta `.lovable/plan/`, que já é versionada. Enquanto ele existir com essas chaves preenchidas, evite `git add`/commit desse arquivo — apague-o ou limpe os valores depois que a migração for concluída e o `.env` real for atualizado.
