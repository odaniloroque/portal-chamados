CREATE TABLE public.technician_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technician_id, contract_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_contracts TO authenticated;
GRANT ALL ON public.technician_contracts TO service_role;

ALTER TABLE public.technician_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage technician contracts" ON public.technician_contracts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Technicians read own assignments" ON public.technician_contracts
  FOR SELECT TO authenticated
  USING (technician_id = auth.uid());

CREATE INDEX idx_technician_contracts_tech ON public.technician_contracts(technician_id);
CREATE INDEX idx_technician_contracts_contract ON public.technician_contracts(contract_id);

CREATE OR REPLACE FUNCTION public.can_access_contract(_user_id uuid, _contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR (
        _contract_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.technician_contracts tc
          WHERE tc.technician_id = _user_id AND tc.contract_id = _contract_id
        )
      );
$$;

-- tickets
DROP POLICY IF EXISTS "Staff read all tickets" ON public.tickets;
CREATE POLICY "Staff read permitted tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), contract_id));

DROP POLICY IF EXISTS "Staff update any ticket" ON public.tickets;
CREATE POLICY "Staff update permitted tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), contract_id))
  WITH CHECK (is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), contract_id));

-- ticket_updates
DROP POLICY IF EXISTS "Staff read all ticket updates" ON public.ticket_updates;
CREATE POLICY "Staff read permitted ticket updates" ON public.ticket_updates
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_updates.ticket_id
        AND public.can_access_contract(auth.uid(), t.contract_id)
    )
  );

DROP POLICY IF EXISTS "Staff insert ticket updates" ON public.ticket_updates;
CREATE POLICY "Staff insert permitted ticket updates" ON public.ticket_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_updates.ticket_id
        AND public.can_access_contract(auth.uid(), t.contract_id)
    )
  );

-- ticket_attachments
DROP POLICY IF EXISTS "Staff read all attachments" ON public.ticket_attachments;
CREATE POLICY "Staff read permitted attachments" ON public.ticket_attachments
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
        AND public.can_access_contract(auth.uid(), t.contract_id)
    )
  );

DROP POLICY IF EXISTS "Staff insert attachments" ON public.ticket_attachments;
CREATE POLICY "Staff insert permitted attachments" ON public.ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
        AND public.can_access_contract(auth.uid(), t.contract_id)
    )
  );

-- contracts
DROP POLICY IF EXISTS "Staff read all contracts" ON public.contracts;
CREATE POLICY "Staff read permitted contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), id));

-- time_entries
DROP POLICY IF EXISTS "Staff read time entries" ON public.time_entries;
CREATE POLICY "Staff read permitted time entries" ON public.time_entries
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), contract_id));

DROP POLICY IF EXISTS "Technicians insert timer entries" ON public.time_entries;
CREATE POLICY "Technicians insert permitted timer entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND source = 'timer'::time_entry_source
    AND has_role(auth.uid(), 'tecnico'::app_role)
    AND public.can_access_contract(auth.uid(), contract_id)
  );