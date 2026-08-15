import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";
import { normalizeTicketTitle } from "@/lib/ticket-title";
import { devStatusSchema } from "@/lib/subtickets-support";

/** Lista subchamados de desenvolvimento (visível apenas para admin e dev via RLS). */
export const listSubtickets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ parent_ticket_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("tickets_display")
      .select("*")
      .not("parent_ticket_id", "is", null)
      .order("created_at", { ascending: true });
    if (data.parent_ticket_id) query = query.eq("parent_ticket_id", data.parent_ticket_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Cria um subchamado de desenvolvimento a partir de um chamado pai. */
export const createSubticket = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        parent_ticket_id: z.string().uuid(),
        title: z.string().min(3).max(150),
        description: z.string().min(5).max(4000),
        priority: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
        status_dev: devStatusSchema.default("backlog"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: parent, error: pErr } = await context.supabase
      .from("tickets")
      .select("id, parent_ticket_id")
      .eq("id", data.parent_ticket_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!parent) throw new Error("Chamado pai não encontrado");
    if (parent.parent_ticket_id) throw new Error("Não é possível criar subchamado de subchamado");

    const { data: row, error } = await context.supabase
      .from("tickets")
      .insert({
        user_id: context.userId,
        parent_ticket_id: data.parent_ticket_id,
        title: normalizeTicketTitle(data.title),
        description: data.description,
        priority: data.priority,
        status_dev: data.status_dev,
      })
      .select("id, ticket_number, child_seq")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Atualiza a situação de desenvolvimento de um subchamado. */
export const updateSubticketStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status_dev: devStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tickets")
      .update({ status_dev: data.status_dev })
      .eq("id", data.id)
      .not("parent_ticket_id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Detalhe de um subchamado + histórico (admin/dev via RLS). */
export const getSubticket = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("tickets_display")
      .select("*")
      .eq("id", data.id)
      .not("parent_ticket_id", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Subchamado não encontrado");

    const { data: updates } = await context.supabase
      .from("ticket_updates")
      .select("*")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });

    const authorIds = Array.from(
      new Set((updates ?? []).map((u: any) => u.author_id).filter(Boolean)),
    );
    const names: Record<string, string> = {};
    if (authorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profs ?? []) names[p.id] = p.full_name;
    }

    return {
      ticket,
      updates: (updates ?? []).map((u: any) => ({
        ...u,
        author_name: u.author_id ? (names[u.author_id] ?? "Equipe") : "Sistema",
      })),
    };
  });
