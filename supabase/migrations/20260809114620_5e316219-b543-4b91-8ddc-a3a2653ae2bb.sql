CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications boolean NOT NULL DEFAULT false;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('abertura','fechamento','status_alterado')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.integration_secrets (name, value)
VALUES ('notify_email_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.integration_secrets (name, value)
VALUES ('app_base_url', 'https://project--e1ae6a11-03dc-4d94-a070-934decb9444e.lovable.app')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ticket_status_label(_status public.ticket_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _status
    WHEN 'aberto' THEN 'Aberto'
    WHEN 'em_andamento' THEN 'Em andamento'
    WHEN 'aguardando_cliente' THEN 'Aguardando cliente'
    WHEN 'respondido_cliente' THEN 'Respondido pelo cliente'
    WHEN 'em_desenvolvimento' THEN 'Em desenvolvimento'
    WHEN 'resolvido' THEN 'Resolvido'
    WHEN 'fechado' THEN 'Fechado'
    ELSE _status::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.create_ticket_notification(
  _ticket public.tickets,
  _type text,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email_enabled boolean;
  v_base text;
  v_secret text;
BEGIN
  INSERT INTO public.notifications (user_id, ticket_id, type, message)
  VALUES (_ticket.user_id, _ticket.id, _type, _message)
  RETURNING id INTO v_id;

  SELECT email_notifications INTO v_email_enabled FROM public.profiles WHERE id = _ticket.user_id;
  IF coalesce(v_email_enabled, false) = false THEN
    RETURN;
  END IF;

  SELECT value INTO v_base FROM public.integration_secrets WHERE name = 'app_base_url';
  SELECT value INTO v_secret FROM public.integration_secrets WHERE name = 'notify_email_secret';
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM extensions.http_post(
    url := v_base || '/api/public/notificacoes/email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('secret', v_secret, 'notification_id', v_id)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_ticket_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.create_ticket_notification(
    NEW,
    'abertura',
    'Seu chamado #' || lpad(NEW.ticket_number::text, 4, '0') || ' foi aberto.'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text;
BEGIN
  IF NEW.parent_ticket_id IS NOT NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  v_num := '#' || lpad(NEW.ticket_number::text, 4, '0');

  IF NEW.status = 'fechado'::public.ticket_status THEN
    PERFORM public.create_ticket_notification(NEW, 'fechamento',
      'Seu chamado ' || v_num || ' foi fechado.');
  ELSE
    PERFORM public.create_ticket_notification(NEW, 'status_alterado',
      'Seu chamado ' || v_num || ' mudou para "' || public.ticket_status_label(NEW.status) || '".');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_created();

CREATE TRIGGER trg_notify_ticket_status
AFTER UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_changed();