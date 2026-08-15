CREATE OR REPLACE FUNCTION public.validate_client_ticket_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id <> auth.uid() OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Acesso restrito';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'resolvido'::public.ticket_status AND NEW.status = 'fechado'::public.ticket_status)
    OR
    (OLD.status = 'aguardando_cliente'::public.ticket_status AND NEW.status = 'respondido_cliente'::public.ticket_status)
  ) THEN
    RAISE EXCEPTION 'Transição de status não permitida para o cliente';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_client_ticket_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_client_ticket_transition() FROM anon;
REVOKE ALL ON FUNCTION public.validate_client_ticket_transition() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.validate_client_ticket_transition() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_client_ticket_transition ON public.tickets;
CREATE TRIGGER trg_validate_client_ticket_transition
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.validate_client_ticket_transition();

CREATE POLICY "Clients update own permitted ticket status"
ON public.tickets
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.close_ticket_by_client(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status public.ticket_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT status
    INTO v_status
    FROM public.tickets
   WHERE id = p_ticket_id
     AND user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou acesso restrito';
  END IF;

  IF v_status <> 'resolvido'::public.ticket_status THEN
    RAISE EXCEPTION 'O chamado só pode ser fechado quando estiver Resolvido.';
  END IF;

  UPDATE public.tickets
     SET status = 'fechado'::public.ticket_status
   WHERE id = p_ticket_id
     AND user_id = v_user_id;

  INSERT INTO public.ticket_updates (
    ticket_id, author_id, message, status_from, status_to
  ) VALUES (
    p_ticket_id, v_user_id, 'Chamado fechado pelo cliente.',
    'resolvido'::public.ticket_status, 'fechado'::public.ticket_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_client_ticket_response(
  p_ticket_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status public.ticket_status;
  v_message text := btrim(coalesce(p_message, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF length(v_message) = 0 OR length(v_message) > 4000 THEN
    RAISE EXCEPTION 'Informe uma mensagem válida de até 4000 caracteres';
  END IF;

  SELECT status
    INTO v_status
    FROM public.tickets
   WHERE id = p_ticket_id
     AND user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou acesso restrito';
  END IF;

  IF v_status <> 'aguardando_cliente'::public.ticket_status THEN
    RAISE EXCEPTION 'O chamado não está aguardando resposta do cliente';
  END IF;

  INSERT INTO public.ticket_updates (ticket_id, author_id, message)
  VALUES (p_ticket_id, v_user_id, v_message);

  UPDATE public.tickets
     SET status = 'respondido_cliente'::public.ticket_status
   WHERE id = p_ticket_id
     AND user_id = v_user_id;

  INSERT INTO public.ticket_updates (
    ticket_id, author_id, message, status_from, status_to
  ) VALUES (
    p_ticket_id, v_user_id, NULL,
    'aguardando_cliente'::public.ticket_status,
    'respondido_cliente'::public.ticket_status
  );
END;
$$;