CREATE TYPE public.contract_billing_type AS ENUM ('por_hora','fixo','por_servico','locacao_impressoras','locacao_servidores','locacao_rede');

ALTER TABLE public.contracts
  ADD COLUMN billing_type public.contract_billing_type NOT NULL DEFAULT 'por_hora',
  ADD COLUMN rental_mode text,
  ADD COLUMN supply_billing text,
  ADD COLUMN toner_price numeric(12,2),
  ADD COLUMN page_price numeric(12,4),
  ADD COLUMN monthly_page_quota integer;

CREATE TABLE public.contract_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'outro' CHECK (category IN ('impressora','servidor','rede','outro')),
  name text NOT NULL,
  serial text,
  location text,
  hostname text,
  specs text,
  device_type text,
  counter integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_assets_contract ON public.contract_assets(contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_assets TO authenticated;
GRANT ALL ON public.contract_assets TO service_role;

ALTER TABLE public.contract_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract assets" ON public.contract_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Clients read own contract assets" ON public.contract_assets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_assets.contract_id AND c.client_id = auth.uid()));

CREATE POLICY "Staff read permitted contract assets" ON public.contract_assets
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.can_access_contract(auth.uid(), contract_id));

CREATE TRIGGER trg_contract_assets_updated BEFORE UPDATE ON public.contract_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tickets
  ADD COLUMN service_type text CHECK (service_type IN ('corretiva','preventiva','toner','mudanca')),
  ADD COLUMN asset_id uuid REFERENCES public.contract_assets(id) ON DELETE SET NULL,
  ADD COLUMN toner_color text CHECK (toner_color IN ('preto','ciano','magenta','amarelo')),
  ADD COLUMN toner_qty integer;