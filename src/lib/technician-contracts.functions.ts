import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

/** Todas as atribuições técnico → contrato (admin). */
export const listTechnicianAssignments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("technician_contracts")
      .select("technician_id, contract_id");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Contratos atribuídos ao técnico logado. */
export const listMyAssignedContracts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("technician_contracts")
      .select("contract_id")
      .eq("technician_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.contract_id as string);
  });

/** Define (substitui) a lista de contratos que um técnico pode atender. */
export const setTechnicianContracts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        technician_id: z.string().uuid(),
        contract_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: existing, error: exErr } = await context.supabase
      .from("technician_contracts")
      .select("contract_id")
      .eq("technician_id", data.technician_id);
    if (exErr) throw new Error(exErr.message);

    const current = new Set((existing ?? []).map((r: any) => r.contract_id as string));
    const next = new Set(data.contract_ids);

    const toRemove = [...current].filter((id) => !next.has(id));
    const toAdd = [...next].filter((id) => !current.has(id));

    if (toRemove.length) {
      const { error } = await context.supabase
        .from("technician_contracts")
        .delete()
        .eq("technician_id", data.technician_id)
        .in("contract_id", toRemove);
      if (error) throw new Error(error.message);
    }
    if (toAdd.length) {
      const { error } = await context.supabase.from("technician_contracts").insert(
        toAdd.map((contract_id) => ({
          technician_id: data.technician_id,
          contract_id,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true, total: next.size };
  });
