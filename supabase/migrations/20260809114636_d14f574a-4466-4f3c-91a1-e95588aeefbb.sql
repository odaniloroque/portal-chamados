REVOKE ALL ON FUNCTION public.create_ticket_notification(public.tickets, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ticket_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ticket_status_changed() FROM PUBLIC, anon, authenticated;