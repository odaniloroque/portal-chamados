CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','tecnico'));
$$;

-- tickets
CREATE POLICY "Staff read all tickets" ON public.tickets
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update any ticket" ON public.tickets
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ticket_updates
CREATE POLICY "Staff read all ticket updates" ON public.ticket_updates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert ticket updates" ON public.ticket_updates
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.is_staff(auth.uid()));

-- ticket_attachments
CREATE POLICY "Staff read all attachments" ON public.ticket_attachments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert attachments" ON public.ticket_attachments
  FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid() AND public.is_staff(auth.uid()));

-- profiles (row read; sensitive contract columns are hidden in the app layer)
CREATE POLICY "Staff read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- time_entries: technicians may read and insert timer entries only
CREATE POLICY "Staff read time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Technicians insert timer entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND source = 'timer'::time_entry_source
    AND has_role(auth.uid(), 'tecnico'::app_role)
  );