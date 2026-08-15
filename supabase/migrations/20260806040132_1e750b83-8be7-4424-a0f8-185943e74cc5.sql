REVOKE EXECUTE ON FUNCTION public.create_ticket_from_webhook(text, text, text, text, ticket_priority, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_close_resolved_tickets() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.auto_close_resolved_tickets() TO service_role;