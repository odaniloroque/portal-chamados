import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

/** Colunas seguras para qualquer usuário autenticado (sem dados financeiros). */
const CONTRACT_BASE_COLUMNS =
  "id, client_id, name, contract_number, contract_plan, contract_start, contract_end, active, created_at, billing_type";

/** Colunas completas — somente admin. */
const CONTRACT_COLUMNS =
  CONTRACT_BASE_COLUMNS +
  ", contract_value, rental_mode, supply_billing, toner_price, page_price, monthly_page_quota";


/** Lista contratos. Admin/técnico veem todos (ou de um cliente); cliente vê apenas os seus (via RLS). */
export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().uuid().nullable().optional(),
        onlyActive: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    let query = context.supabase
      .from("contracts")
      .select(isAdmin ? CONTRACT_COLUMNS : CONTRACT_BASE_COLUMNS)
      .order("name", { ascending: true });
    if (data.clientId) query = query.eq("client_id", data.clientId);
    if (data.onlyActive) query = query.eq("active", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Contratos ativos do próprio usuário logado (usado na abertura de chamado). */
export const listMyContracts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contracts")
      .select(CONTRACT_BASE_COLUMNS)
      .eq("client_id", context.userId)
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const BILLING_TYPES = [
  "por_hora",
  "fixo",
  "por_servico",
  "locacao_impressoras",
  "locacao_servidores",
  "locacao_rede",
] as const;

const contractSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome do contrato").max(120),
  contract_number: z.string().max(60).optional().nullable(),
  contract_plan: z.string().max(100).optional().nullable(),
  contract_value: z.number().nonnegative().max(99999999).optional().nullable(),
  contract_start: z.string().optional().nullable(),
  contract_end: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  billing_type: z.enum(BILLING_TYPES).optional().default("por_hora"),
  rental_mode: z.string().max(120).optional().nullable(),
  supply_billing: z.string().max(40).optional().nullable(),
  toner_price: z.number().nonnegative().max(99999999).optional().nullable(),
  page_price: z.number().nonnegative().max(99999).optional().nullable(),
  monthly_page_quota: z.number().int().nonnegative().max(99999999).optional().nullable(),
});


export const createContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => contractSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("contracts")
      .insert({
        client_id: data.client_id,
        name: data.name,
        contract_number: data.contract_number || null,
        contract_plan: data.contract_plan || null,
        contract_value: data.contract_value ?? null,
        contract_start: data.contract_start || null,
        contract_end: data.contract_end || null,
        active: data.active ?? true,
        billing_type: data.billing_type ?? "por_hora",
        rental_mode: data.rental_mode || null,
        supply_billing: data.supply_billing || null,
        toner_price: data.toner_price ?? null,
        page_price: data.page_price ?? null,
        monthly_page_quota: data.monthly_page_quota ?? null,

      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    contractSchema.omit({ client_id: true }).extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("contracts")
      .update({
        name: rest.name,
        contract_number: rest.contract_number || null,
        contract_plan: rest.contract_plan || null,
        contract_value: rest.contract_value ?? null,
        contract_start: rest.contract_start || null,
        contract_end: rest.contract_end || null,
        active: rest.active ?? true,
        billing_type: rest.billing_type ?? "por_hora",
        rental_mode: rest.rental_mode || null,
        supply_billing: rest.supply_billing || null,
        toner_price: rest.toner_price ?? null,
        page_price: rest.page_price ?? null,
        monthly_page_quota: rest.monthly_page_quota ?? null,

      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setContractActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("contracts")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== Parque de equipamentos ===================== */

const ASSET_COLUMNS =
  "id, contract_id, category, name, serial, location, hostname, specs, device_type, counter, notes, active, created_at";

export const ASSET_CATEGORIES = ["impressora", "servidor", "rede", "outro"] as const;

export const listContractAssets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contractId: z.string().uuid(),
        onlyActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("contract_assets")
      .select(ASSET_COLUMNS)
      .eq("contract_id", data.contractId)
      .order("name", { ascending: true });
    if (data.onlyActive) query = query.eq("active", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const assetSchema = z.object({
  contract_id: z.string().uuid(),
  category: z.enum(ASSET_CATEGORIES).default("outro"),
  name: z.string().trim().min(2, "Informe o nome/modelo").max(120),
  serial: z.string().max(80).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  hostname: z.string().max(120).optional().nullable(),
  specs: z.string().max(400).optional().nullable(),
  device_type: z.string().max(40).optional().nullable(),
  counter: z.number().int().nonnegative().max(999999999).optional().nullable(),
  notes: z.string().max(600).optional().nullable(),
  active: z.boolean().optional().default(true),
});

function assetPayload(d: z.infer<typeof assetSchema>) {
  return {
    category: d.category,
    name: d.name,
    serial: d.serial || null,
    location: d.location || null,
    hostname: d.hostname || null,
    specs: d.specs || null,
    device_type: d.device_type || null,
    counter: d.counter ?? null,
    notes: d.notes || null,
    active: d.active ?? true,
  };
}

export const createContractAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => assetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("contract_assets")
      .insert({ contract_id: data.contract_id, ...assetPayload(data) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateContractAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    assetSchema.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("contract_assets")
      .update(assetPayload(data))
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContractAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("contract_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
