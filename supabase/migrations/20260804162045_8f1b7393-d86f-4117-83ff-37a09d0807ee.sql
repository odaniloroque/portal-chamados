ALTER TABLE public.ticket_updates ALTER COLUMN author_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  WITH due AS (
    SELECT id FROM public.tickets
    WHERE status = 'resolvido'::ticket_status
      AND updated_at < now() - interval '24 hours'
    FOR UPDATE SKIP LOCKED
  ), ins AS (
    INSERT INTO public.ticket_updates (ticket_id, author_id, message, status_from, status_to)
    SELECT id, NULL, 'Fechamento automático realizado pelo sistema após 24 horas em Resolvido.',
           'resolvido'::ticket_status, 'fechado'::ticket_status
    FROM due
    RETURNING ticket_id
  ), upd AS (
    UPDATE public.tickets t
    SET status = 'fechado'::ticket_status
    FROM due d WHERE t.id = d.id
    RETURNING t.id
  )
  SELECT count(*) INTO affected FROM upd;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_close_resolved_tickets() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-close-resolved-tickets',
  '0 * * * *',
  $$SELECT public.auto_close_resolved_tickets();$$
);