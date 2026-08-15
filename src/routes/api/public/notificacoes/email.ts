import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  buildNotificationEmail,
  TICKET_STATUS_LABELS,
  type NotificationType,
} from "@/lib/notification-email";

const payloadSchema = z.object({
  secret: z.string().min(10).max(200),
  notification_id: z.string().uuid(),
});

const FROM = "Projetus Tech <naoresponda@send.projetus.tech>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/notificacoes/email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return json({ ok: false, error: "invalid_payload" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");

        const { data: secretRow } = await supabaseAdmin
          .from("integration_secrets")
          .select("value")
          .eq("name", "notify_email_secret")
          .maybeSingle();
        if (!secretRow?.value || secretRow.value !== parsed.data.secret) {
          return json({ ok: false, error: "unauthorized" }, 401);
        }

        const { data: notification } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, ticket_id, type")
          .eq("id", parsed.data.notification_id)
          .maybeSingle();
        if (!notification) return json({ ok: false, error: "not_found" }, 404);

        const [{ data: profile }, { data: ticket }, { data: baseRow }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("full_name, email, email_notifications")
            .eq("id", notification.user_id)
            .maybeSingle(),
          supabaseAdmin
            .from("tickets")
            .select("id, title, status, ticket_number")
            .eq("id", notification.ticket_id)
            .maybeSingle(),
          supabaseAdmin
            .from("integration_secrets")
            .select("value")
            .eq("name", "app_base_url")
            .maybeSingle(),
        ]);

        if (!profile?.email || profile.email_notifications === false || !ticket) {
          return json({ ok: true, skipped: true });
        }

        const displayNumber = `#${String(ticket.ticket_number).padStart(4, "0")}`;
        const baseUrl = baseRow?.value ?? "";
        const { subject, html } = buildNotificationEmail({
          type: notification.type as NotificationType,
          displayNumber,
          title: ticket.title,
          statusLabel: TICKET_STATUS_LABELS[ticket.status] ?? ticket.status,
          clientName: profile.full_name ?? "cliente",
          ticketUrl: `${baseUrl}/portal/chamado/${ticket.id}`,
        });

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const resendKey = process.env["RESEND_API_KEY"];
        if (!lovableKey || !resendKey) {
          return json({ ok: false, error: "email_not_configured" }, 503);
        }

        const response = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({ from: FROM, to: [profile.email], subject, html }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Resend request failed [${response.status}]: ${errorBody}`);
          return json({ ok: false, error: "provider_error", status: response.status }, 502);
        }

        return json({ ok: true });
      },
    },
  },
});
