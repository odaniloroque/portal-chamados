import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Filter out staff (admins and technicians) from the client list
    const { data: staffRoles } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "tecnico", "dev"]);
    const staffIds = new Set((staffRoles ?? []).map((r: any) => r.user_id));
    return (data ?? []).filter((p: any) => !staffIds.has(p.id));
  });

const clientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  full_name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  company_name: z.string().max(150).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  contract_number: z.string().max(60).optional().nullable(),
  contract_plan: z.string().max(100).optional().nullable(),
  contract_start: z.string().optional().nullable(),
  contract_end: z.string().optional().nullable(),
  contract_value: z.number().nonnegative().max(99999999).optional().nullable(),
  email_notifications: z.boolean().optional(),
  whatsapp_notifications: z.boolean().optional(),
  custom_fields: z
    .array(z.object({ label: z.string().max(60), value: z.string().max(200) }))
    .max(30)
    .optional(),
});


export const createClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => clientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Falha ao criar usuário");
    const userId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      company_name: data.company_name ?? null,
      cnpj: data.cnpj ?? null,
      address: data.address ?? null,
      contract_number: data.contract_number ?? null,
      contract_plan: data.contract_plan ?? null,
      contract_start: data.contract_start || null,
      contract_end: data.contract_end || null,
      contract_value: data.contract_value ?? null,
      email_notifications: data.email_notifications ?? true,
      whatsapp_notifications: data.whatsapp_notifications ?? false,
      custom_fields: data.custom_fields ?? [],
    });

    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "cliente" });
    return { ok: true, userId };
  });

const updateSchema = clientSchema.omit({ password: true, email: true }).extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
});

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    const patch = {
      ...rest,
      contract_start: rest.contract_start || null,
      contract_end: rest.contract_end || null,
      contract_value: rest.contract_value ?? null,
    };
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
    } as never);
    if (authErr) throw new Error(authErr.message);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/* ---------------------------------------------------------------- Equipe */

const staffRoleSchema = z.enum(["tecnico", "dev"]);

const technicianSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  full_name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  role: staffRoleSchema.optional().default("tecnico"),
});

export const listTechnicians = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["tecnico", "dev"]);
    if (rErr) throw new Error(rErr.message);
    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) roleMap.set((r as any).user_id, (r as any).role);
    const ids = Array.from(roleMap.keys());
    if (ids.length === 0) return [];
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, phone, active, created_at")
      .in("id", ids)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? "tecnico" }));
  });

export const createTechnician = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => technicianSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Falha ao criar usuário");
    const userId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    return { ok: true, userId };
  });

export const updateTechnician = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(2).max(120),
        phone: z.string().max(30).optional().nullable(),
        role: staffRoleSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.role) {
      const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.id)
        .in("role", ["tecnico", "dev"]);
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.id, role: data.role });
      if (rErr) throw new Error(rErr.message);
    }
    return { ok: true };
  });
