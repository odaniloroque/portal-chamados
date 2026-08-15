CREATE OR REPLACE FUNCTION public.auto_client_response_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_status public.ticket_status;
BEGIN
  IF NEW.author_id IS NULL OR NEW.status_to IS NOT NULL OR coalesce(btrim(NEW.message), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, status INTO v_owner, v_status
  FROM public.tickets WHERE id = NEW.ticket_id;

  IF v_owner IS DISTINCT FROM NEW.author_id THEN
    RETURN NEW;
  END IF;

  IF v_status <> 'aguardando_cliente'::public.ticket_status THEN
    RETURN NEW;
  END IF;

  UPDATE public.tickets
     SET status = 'respondido_cliente'::public.ticket_status
   WHERE id = NEW.ticket_id;

  INSERT INTO public.ticket_updates (ticket_id, author_id, message, status_from, status_to)
  VALUES (NEW.ticket_id, NEW.author_id, NULL,
          'aguardando_cliente'::public.ticket_status,
          'respondido_cliente'::public.ticket_status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_client_response_status ON public.ticket_updates;
CREATE TRIGGER trg_auto_client_response_status
AFTER INSERT ON public.ticket_updates
FOR EACH ROW EXECUTE FUNCTION public.auto_client_response_status();