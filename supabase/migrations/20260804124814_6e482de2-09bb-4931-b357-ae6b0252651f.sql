CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq;

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_number bigint;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn FROM public.tickets
)
UPDATE public.tickets t SET ticket_number = o.rn FROM ordered o WHERE t.id = o.id AND t.ticket_number IS NULL;

SELECT setval('public.ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM public.tickets), 0) + 1, false);

ALTER TABLE public.tickets ALTER COLUMN ticket_number SET DEFAULT nextval('public.ticket_number_seq');
ALTER TABLE public.tickets ALTER COLUMN ticket_number SET NOT NULL;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
GRANT USAGE, SELECT ON SEQUENCE public.ticket_number_seq TO authenticated, service_role;