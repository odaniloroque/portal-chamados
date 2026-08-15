import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  email: z.string().email(),
  title: z.string().min(3).max(150),
  description: z.string().min(5).max(4000),
  priority: z.enum(["baixa", "media", "alta", "critica"]).optional().default("media"),
  custom_fields: z
    .array(z.object({ label: z.string().max(80), value: z.string().max(500) }))
    .max(20)
    .optional()
    .default([]),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret, authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/public/chamados")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const headerSecret =
          request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        if (!headerSecret) {
          return json({ ok: false, error: "unauthorized" }, 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return json(
            { ok: false, error: "invalid_payload", details: parsed.error.flatten() },
            400,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");

        const { data, error } = await supabaseAdmin.rpc("create_ticket_from_webhook", {
          p_secret: headerSecret,
          p_email: parsed.data.email,
          p_title: parsed.data.title,
          p_description: parsed.data.description,
          p_priority: parsed.data.priority,
          p_custom_fields: parsed.data.custom_fields as unknown as never,
        });

        if (error) {
          console.error("[webhook/chamados]", error.message);
          return json({ ok: false, error: "internal_error" }, 500);
        }

        const result = data as unknown as {
          ok: boolean;
          error?: string;
          id?: string;
          ticket_number?: number;
        };

        if (!result?.ok) {
          const status =
            result?.error === "unauthorized"
              ? 401
              : result?.error === "client_not_found"
                ? 404
                : 400;
          return json({ ok: false, error: result?.error ?? "invalid_payload" }, status);
        }

        return json({
          ok: true,
          id: result.id,
          ticket_number: result.ticket_number,
        });
      },
    },
  },
});
