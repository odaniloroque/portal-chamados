import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("Acesso restrito a administradores.");
}

const filterSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

/** Lista registros de horas. Admin vê tudo; cliente vê apenas os do próprio contrato. */
export const listTimeEntries = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("time_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (data.clientId) query = query.eq("client_id", data.clientId);
    if (data.contractId) query = query.eq("contract_id", data.contractId);
    if (data.userId) query = query.eq("user_id", data.userId);
    if (data.ticketId) query = query.eq("ticket_id", data.ticketId);
    if (data.from) query = query.gte("entry_date", data.from);
    if (data.to) query = query.lte("entry_date", data.to);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const entries = rows ?? [];

    // Enriquecimento: nomes de cliente, autor, contrato e número do chamado
    const clientIds = [...new Set(entries.map((e: any) => e.client_id))];
    const authorIds = [...new Set(entries.map((e: any) => e.user_id))];
    const ticketIds = [...new Set(entries.map((e: any) => e.ticket_id).filter(Boolean))];
    const contractIds = [...new Set(entries.map((e: any) => e.contract_id).filter(Boolean))];

    const profileIds = [...new Set([...clientIds, ...authorIds])];
    const [{ data: profiles }, { data: tickets }, { data: contracts }] = await Promise.all([
      profileIds.length
        ? supabase.from("profiles").select("id, full_name, company_name, contract_number, contract_value, custom_fields").in("id", profileIds)
        : Promise.resolve({ data: [] as any[] }),
      ticketIds.length
        ? supabase.from("tickets").select("id, ticket_number, title").in("id", ticketIds)
        : Promise.resolve({ data: [] as any[] }),
      contractIds.length
        ? supabase.from("contracts").select("id, name, contract_value, client_id").in("id", contractIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const tMap = new Map((tickets ?? []).map((t: any) => [t.id, t]));
    const cMap = new Map((contracts ?? []).map((c: any) => [c.id, c]));

    return entries.map((e: any) => ({
      ...e,
      client: pMap.get(e.client_id) ?? null,
      author: pMap.get(e.user_id) ?? null,
      ticket: e.ticket_id ? (tMap.get(e.ticket_id) ?? null) : null,
      contract: e.contract_id ? (cMap.get(e.contract_id) ?? null) : null,
    }));
  });

const createSchema = z.object({
  client_id: z.string().uuid(),
  contract_id: z.string().uuid().nullable().optional(),
  ticket_id: z.string().uuid().nullable().optional(),
  description: z.string().max(400).default(""),
  entry_date: z.string(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  duration_minutes: z.number().int().min(1).max(1440),
  source: z.enum(["timer", "manual"]).default("manual"),
});

export const createTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Admin lança horas livremente; técnico apenas via cronômetro.
    if (!(await isAdmin(context.supabase, context.userId))) {
      const { data: tecnico } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "tecnico",
      });
      if (!tecnico) throw new Error("Acesso restrito.");
      if (data.source !== "timer") {
        throw new Error("Técnicos só podem registrar horas pelo cronômetro.");
      }
    }

    // Contrato: usa o informado, senão herda do chamado, senão o único do cliente
    let contractId: string | null = data.contract_id ?? null;
    if (!contractId && data.ticket_id) {
      const { data: ticket } = await context.supabase
        .from("tickets")
        .select("contract_id")
        .eq("id", data.ticket_id)
        .maybeSingle();
      contractId = ticket?.contract_id ?? null;
    }
    if (!contractId) {
      const { data: contracts } = await context.supabase
        .from("contracts")
        .select("id")
        .eq("client_id", data.client_id)
        .eq("active", true);
      if ((contracts ?? []).length === 1) contractId = contracts![0].id;
    }

    const { data: row, error } = await context.supabase
      .from("time_entries")
      .insert({
        client_id: data.client_id,
        contract_id: contractId,
        ticket_id: data.ticket_id ?? null,
        user_id: context.userId,
        description: data.description ?? "",
        entry_date: data.entry_date,
        started_at: data.started_at ?? null,
        ended_at: data.ended_at ?? null,
        duration_minutes: data.duration_minutes,
        source: data.source,
        updated_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().max(400),
  entry_date: z.string(),
  duration_minutes: z.number().int().min(1).max(1440),
  contract_id: z.string().uuid().nullable().optional(),
});

export const updateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: any = {
      description: data.description,
      entry_date: data.entry_date,
      duration_minutes: data.duration_minutes,
      updated_by: context.userId,
    };
    if (data.contract_id !== undefined) patch.contract_id = data.contract_id;
    const { error } = await context.supabase
      .from("time_entries")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("time_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
