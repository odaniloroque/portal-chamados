CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  contract_number text,
  contract_plan text,
  contract_value numeric(12,2),
  contract_start date,
  contract_end date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_client ON public.contracts(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own contracts" ON public.contracts
  FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "Staff read all contracts" ON public.contracts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: um contrato por perfil que já tenha dados contratuais
INSERT INTO public.contracts (client_id, name, contract_number, contract_plan, contract_value, contract_start, contract_end)
SELECT p.id,
       COALESCE(NULLIF(btrim(p.contract_plan), ''), NULLIF(btrim(p.contract_number), ''), 'Contrato principal'),
       p.contract_number, p.contract_plan, p.contract_value, p.contract_start, p.contract_end
FROM public.profiles p
WHERE COALESCE(NULLIF(btrim(p.contract_number), ''), NULLIF(btrim(p.contract_plan), '')) IS NOT NULL
   OR p.contract_value IS NOT NULL
   OR p.contract_start IS NOT NULL
   OR p.contract_end IS NOT NULL;

ALTER TABLE public.tickets ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.time_entries ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX idx_tickets_contract ON public.tickets(contract_id);
CREATE INDEX idx_time_entries_contract ON public.time_entries(contract_id);

-- Backfill de chamados/horas quando o cliente tem exatamente um contrato
WITH single AS (
  SELECT client_id, (array_agg(id ORDER BY created_at))[1] AS contract_id
  FROM public.contracts GROUP BY client_id HAVING count(*) = 1
)
UPDATE public.tickets t SET contract_id = s.contract_id
FROM single s WHERE t.user_id = s.client_id AND t.contract_id IS NULL;

WITH single AS (
  SELECT client_id, (array_agg(id ORDER BY created_at))[1] AS contract_id
  FROM public.contracts GROUP BY client_id HAVING count(*) = 1
)
UPDATE public.time_entries te SET contract_id = s.contract_id
FROM single s WHERE te.client_id = s.client_id AND te.contract_id IS NULL;