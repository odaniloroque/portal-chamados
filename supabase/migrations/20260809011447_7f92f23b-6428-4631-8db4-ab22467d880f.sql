-- 1) dev é staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','tecnico','dev'));
$$;

-- 2) colunas de sub-tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id uuid NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS child_seq integer NULL,
  ADD COLUMN IF NOT EXISTS status_dev text NULL;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_dev_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_dev_check CHECK (
    status_dev IS NULL OR status_dev IN ('backlog','em_desenvolvimento','aguardando_deploy','concluido')
  );

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_child_fields_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_child_fields_check CHECK (
    (parent_ticket_id IS NOT NULL) OR (child_seq IS NULL AND status_dev IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS tickets_parent_child_seq_uidx
  ON public.tickets(parent_ticket_id, child_seq) WHERE parent_ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tickets_parent_idx ON public.tickets(parent_ticket_id);

-- 3) BEFORE INSERT: sequência do filho
CREATE OR REPLACE FUNCTION public.set_ticket_child_seq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.parent_ticket_id IS NULL THEN
    NEW.child_seq := NULL;
    NEW.status_dev := NULL;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tickets p WHERE p.id = NEW.parent_ticket_id AND p.parent_ticket_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Não é permitido criar subchamado de um subchamado';
  END IF;

  SELECT coalesce(max(child_seq), 0) + 1 INTO NEW.child_seq
  FROM public.tickets WHERE parent_ticket_id = NEW.parent_ticket_id;

  IF NEW.status_dev IS NULL THEN NEW.status_dev := 'backlog'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_child_seq ON public.tickets;
CREATE TRIGGER trg_tickets_child_seq BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_child_seq();

-- 4) numeração formatada
CREATE OR REPLACE FUNCTION public.format_display_number(_parent_number bigint, _ticket_number bigint, _child_seq integer)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _parent_number IS NOT NULL AND _child_seq IS NOT NULL
      THEN lpad(_parent_number::text, 4, '0') || '.' || _child_seq::text
    ELSE lpad(_ticket_number::text, 4, '0')
  END;
$$;

DROP VIEW IF EXISTS public.tickets_display;
CREATE VIEW public.tickets_display WITH (security_invoker = true) AS
  SELECT t.*, public.format_display_number(p.ticket_number, t.ticket_number, t.child_seq) AS display_number
  FROM public.tickets t
  LEFT JOIN public.tickets p ON p.id = t.parent_ticket_id;

GRANT SELECT ON public.tickets_display TO authenticated;
GRANT ALL ON public.tickets_display TO service_role;

-- 5) histórico + conclusão automática do pai
CREATE OR REPLACE FUNCTION public.log_subticket_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_parent_number bigint;
BEGIN
  IF NEW.parent_ticket_id IS NULL THEN RETURN NEW; END IF;
  SELECT ticket_number INTO v_parent_number FROM public.tickets WHERE id = NEW.parent_ticket_id;

  INSERT INTO public.ticket_updates (ticket_id, author_id, message)
  VALUES (NEW.id, auth.uid(), 'Subchamado de desenvolvimento criado (' ||
    public.format_display_number(v_parent_number, NEW.ticket_number, NEW.child_seq) || ').');

  INSERT INTO public.ticket_updates (ticket_id, author_id, message)
  VALUES (NEW.parent_ticket_id, auth.uid(), 'Subchamado de desenvolvimento ' ||
    public.format_display_number(v_parent_number, NEW.ticket_number, NEW.child_seq) ||
    ' criado: ' || NEW.title || '.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_subticket_created ON public.tickets;
CREATE TRIGGER trg_log_subticket_created AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_subticket_created();

CREATE OR REPLACE FUNCTION public.handle_subticket_status_dev()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_parent_number bigint;
  v_display text;
  v_pending integer;
  v_parent_status public.ticket_status;
BEGIN
  IF NEW.parent_ticket_id IS NULL OR NEW.status_dev IS NOT DISTINCT FROM OLD.status_dev THEN
    RETURN NEW;
  END IF;

  SELECT ticket_number, status INTO v_parent_number, v_parent_status
  FROM public.tickets WHERE id = NEW.parent_ticket_id;
  v_display := public.format_display_number(v_parent_number, NEW.ticket_number, NEW.child_seq);

  INSERT INTO public.ticket_updates (ticket_id, author_id, message)
  VALUES (NEW.id, auth.uid(), 'Situação de desenvolvimento alterada de ' ||
    coalesce(OLD.status_dev, '—') || ' para ' || NEW.status_dev || '.');

  INSERT INTO public.ticket_updates (ticket_id, author_id, message)
  VALUES (NEW.parent_ticket_id, auth.uid(), 'Subchamado ' || v_display ||
    ': situação de desenvolvimento alterada para ' || NEW.status_dev || '.');

  IF NEW.status_dev = 'concluido' THEN
    SELECT count(*) INTO v_pending FROM public.tickets
    WHERE parent_ticket_id = NEW.parent_ticket_id AND coalesce(status_dev, '') <> 'concluido';

    IF v_pending = 0 AND v_parent_status <> 'resolvido'::public.ticket_status
       AND v_parent_status <> 'fechado'::public.ticket_status THEN
      UPDATE public.tickets SET status = 'resolvido'::public.ticket_status
      WHERE id = NEW.parent_ticket_id;

      INSERT INTO public.ticket_updates (ticket_id, author_id, message, status_from, status_to)
      VALUES (NEW.parent_ticket_id, NULL,
        'Todos os subchamados de desenvolvimento foram concluídos. Chamado marcado como Resolvido automaticamente.',
        v_parent_status, 'resolvido'::public.ticket_status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subticket_status_dev ON public.tickets;
CREATE TRIGGER trg_subticket_status_dev AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.handle_subticket_status_dev();

-- 6) RLS: subchamados só para admin e dev
DROP POLICY IF EXISTS "Clients read own tickets" ON public.tickets;
CREATE POLICY "Clients read own tickets" ON public.tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id AND parent_ticket_id IS NULL);

DROP POLICY IF EXISTS "Staff read permitted tickets" ON public.tickets;
CREATE POLICY "Staff read permitted tickets" ON public.tickets FOR SELECT TO authenticated
USING (
  parent_ticket_id IS NULL
  AND (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
  AND public.can_access_contract(auth.uid(), contract_id)
);

DROP POLICY IF EXISTS "Staff update permitted tickets" ON public.tickets;
CREATE POLICY "Staff update permitted tickets" ON public.tickets FOR UPDATE TO authenticated
USING (
  parent_ticket_id IS NULL
  AND (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
  AND public.can_access_contract(auth.uid(), contract_id)
)
WITH CHECK (
  parent_ticket_id IS NULL
  AND (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
  AND public.can_access_contract(auth.uid(), contract_id)
);

CREATE POLICY "Dev read dev tickets" ON public.tickets FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'dev')
  AND (
    parent_ticket_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.tickets c WHERE c.parent_ticket_id = tickets.id)
  )
);

CREATE POLICY "Dev and admins create subtickets" ON public.tickets FOR INSERT TO authenticated
WITH CHECK (
  parent_ticket_id IS NOT NULL
  AND user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Dev updates subtickets" ON public.tickets FOR UPDATE TO authenticated
USING (parent_ticket_id IS NOT NULL AND public.has_role(auth.uid(), 'dev'))
WITH CHECK (parent_ticket_id IS NOT NULL AND public.has_role(auth.uid(), 'dev'));

-- histórico dos subchamados para dev
CREATE POLICY "Dev read dev ticket updates" ON public.ticket_updates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'dev')
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_updates.ticket_id
      AND (t.parent_ticket_id IS NOT NULL
           OR EXISTS (SELECT 1 FROM public.tickets c WHERE c.parent_ticket_id = t.id))
  )
);

CREATE POLICY "Dev insert dev ticket updates" ON public.ticket_updates FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.has_role(auth.uid(), 'dev')
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_updates.ticket_id
      AND (t.parent_ticket_id IS NOT NULL
           OR EXISTS (SELECT 1 FROM public.tickets c WHERE c.parent_ticket_id = t.id))
  )
);