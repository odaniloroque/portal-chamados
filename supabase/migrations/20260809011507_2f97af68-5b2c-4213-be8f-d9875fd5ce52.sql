CREATE OR REPLACE FUNCTION public.format_display_number(_parent_number bigint, _ticket_number bigint, _child_seq integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _parent_number IS NOT NULL AND _child_seq IS NOT NULL
      THEN lpad(_parent_number::text, 4, '0') || '.' || _child_seq::text
    ELSE lpad(_ticket_number::text, 4, '0')
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_ticket_child_seq() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_subticket_created() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_subticket_status_dev() FROM anon, authenticated;