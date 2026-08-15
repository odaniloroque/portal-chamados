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

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
     OR NEW.custom_fields IS DISTINCT FROM OLD.custom_fields
     OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
     OR NEW.service_type IS DISTINCT FROM OLD.service_type
     OR NEW.asset_id IS DISTINCT FROM OLD.asset_id
     OR NEW.toner_color IS DISTINCT FROM OLD.toner_color
     OR NEW.toner_qty IS DISTINCT FROM OLD.toner_qty THEN
    RAISE EXCEPTION 'O cliente não pode alterar os dados do chamado';
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