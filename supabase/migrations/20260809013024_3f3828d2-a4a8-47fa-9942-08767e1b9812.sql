CREATE OR REPLACE FUNCTION public.ticket_has_subtickets(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tickets c WHERE c.parent_ticket_id = _ticket_id);
$$;

DROP POLICY IF EXISTS "Dev read dev tickets" ON public.tickets;

CREATE POLICY "Dev read dev tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'dev'::app_role)
  AND (parent_ticket_id IS NOT NULL OR public.ticket_has_subtickets(id))
);