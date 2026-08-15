CREATE TABLE IF NOT EXISTS public.integration_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_secrets FROM anon, authenticated;
GRANT ALL ON public.integration_secrets TO service_role;

INSERT INTO public.integration_secrets (name, value)
VALUES ('webhook_tickets', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_ticket_from_webhook(
  p_secret text,
  p_email text,
  p_title text,
  p_description text,
  p_priority ticket_priority DEFAULT 'media'::ticket_priority,
  p_custom_fields jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stored text;
  v_user uuid;
  v_id uuid;
  v_number bigint;
BEGIN
  SELECT value INTO v_stored FROM public.integration_secrets WHERE name = 'webhook_tickets';
  IF v_stored IS NULL OR p_secret IS NULL OR p_secret <> v_stored THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(p_email) AND active = true LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) < 3 OR p_description IS NULL OR length(btrim(p_description)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  INSERT INTO public.tickets (user_id, title, description, priority, custom_fields)
  VALUES (v_user, btrim(p_title), btrim(p_description), p_priority, coalesce(p_custom_fields, '[]'::jsonb))
  RETURNING id, ticket_number INTO v_id, v_number;

  INSERT INTO public.ticket_updates (ticket_id, author_id, message, status_to)
  VALUES (v_id, NULL, 'Chamado aberto automaticamente via integração (webhook).', 'aberto'::ticket_status);

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'ticket_number', v_number);
END;
$$;

REVOKE ALL ON FUNCTION public.create_ticket_from_webhook(text, text, text, text, ticket_priority, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_ticket_from_webhook(text, text, text, text, ticket_priority, jsonb) TO anon, authenticated, service_role;