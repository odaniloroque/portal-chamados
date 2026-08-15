CREATE OR REPLACE FUNCTION public.auto_client_response_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_status public.ticket_status;
  v_new public.ticket_status;
BEGIN
  IF NEW.author_id IS NULL OR NEW.status_to IS NOT NULL OR coalesce(btrim(NEW.message), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, status INTO v_owner, v_status
  FROM public.tickets WHERE id = NEW.ticket_id;

  IF v_owner IS DISTINCT FROM NEW.author_id THEN
    RETURN NEW;
  END IF;

  IF v_status = 'aguardando_cliente'::public.ticket_status THEN
    v_new := 'respondido_cliente'::public.ticket_status;
  ELSIF v_status = 'resolvido'::public.ticket_status THEN
    v_new := 'em_andamento'::public.ticket_status;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.tickets
     SET status = v_new
   WHERE id = NEW.ticket_id;

  INSERT INTO public.ticket_updates (ticket_id, author_id, message, status_from, status_to)
  VALUES (NEW.ticket_id, NEW.author_id,
          CASE WHEN v_new = 'em_andamento'::public.ticket_status
               THEN 'Chamado reaberto automaticamente após resposta do cliente.'
               ELSE NULL END,
          v_status, v_new);

  RETURN NEW;
END;
$function$;