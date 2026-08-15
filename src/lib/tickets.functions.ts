import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";
import { normalizeTicketTitle } from "@/lib/ticket-title";
import {
  attachContracts,
  attachProfiles,
  isAdminUser,
  isStaffUser,
  ticketPriorityLabels,
  ticketPrioritySchema,
  ticketStatusSchema,
} from "@/lib/tickets-function-support";

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // Staff (admin/técnico) enxergam no portal os chamados permitidos pela RLS
    // (técnico: apenas contratos atribuídos). Clientes veem apenas os seus.
    const staff = await isStaffUser(context.supabase, context.userId);
    let query = context.supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!staff) query = query.eq("user_id", context.userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (staff) return attachProfiles(context.supabase, rows, false);
    return attachContracts(context.supabase, rows);
  });

export const listAllTickets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [staff, admin] = await Promise.all([
      isStaffUser(context.supabase, context.userId),
      isAdminUser(context.supabase, context.userId),
    ]);
    if (!staff) throw new Error("Acesso restrito");
    const { data, error } = await context.supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return attachProfiles(context.supabase, data ?? [], admin);
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: ticketRaw, error } = await context.supabase
      .from("tickets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticketRaw) throw new Error("Chamado não encontrado");
    const viewerIsAdmin = await isAdminUser(context.supabase, context.userId);
    const [withProfile] = await attachProfiles(context.supabase, [ticketRaw], viewerIsAdmin);
    const ticket = withProfile;

    const [{ data: updates, error: uErr }, { data: attachments }] = await Promise.all([
      context.supabase
        .from("ticket_updates")
        .select("*")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    if (uErr) throw new Error(uErr.message);


    // Sign attachment URLs (private bucket)
    const signed = await Promise.all(
      (attachments ?? []).map(async (a: any) => {
        const { data: s } = await context.supabase.storage
          .from("ticket-attachments")
          .createSignedUrl(a.storage_path, 60 * 60);
        return { ...a, url: s?.signedUrl ?? null };
      }),
    );

    // Fetch author names for updates
    const authorIds = Array.from(
      new Set((updates ?? []).map((u: any) => u.author_id).filter(Boolean)),
    );
    const authorMap: Record<string, { full_name: string; is_admin: boolean }> = {};
    if (authorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      const { data: adminRows } = await context.supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "tecnico"])
        .in("user_id", authorIds);
      const adminIds = new Set((adminRows ?? []).map((r: any) => r.user_id));
      for (const p of profs ?? []) {
        authorMap[p.id] = { full_name: p.full_name, is_admin: adminIds.has(p.id) };
      }
    }

    let asset = null;
    if (ticket.asset_id) {
      const { data: a } = await context.supabase
        .from("contract_assets")
        .select("id, name, category, serial, location, hostname, device_type")
        .eq("id", ticket.asset_id)
        .maybeSingle();
      asset = a ?? null;
    }

    return {
      ticket: { ...ticket, asset },

      updates: (updates ?? []).map((u: any) => ({
        ...u,
        author_name: u.author_id
          ? (authorMap[u.author_id]?.full_name ?? "Suporte")
          : "Sistema",
        author_is_admin: u.author_id ? (authorMap[u.author_id]?.is_admin ?? false) : true,
      })),
      attachments: signed,
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(3).max(150),
        description: z.string().min(5).max(4000),
        priority: ticketPrioritySchema,
        contract_id: z.string().uuid().nullable().optional(),
        service_type: z.enum(["corretiva", "preventiva", "toner", "mudanca"]).nullable().optional(),
        asset_id: z.string().uuid().nullable().optional(),
        toner_color: z.enum(["preto", "ciano", "magenta", "amarelo"]).nullable().optional(),
        toner_qty: z.number().int().min(1).max(99).nullable().optional(),

        custom_fields: z
          .array(
            z.object({
              label: z.string().trim().min(1, "Informe o rótulo").max(120),
              value: z.string().trim().min(1, "Informe o valor").max(500),
            }),
          )
          .max(30)
          .optional()
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Contratos ativos do próprio usuário: valida vínculo ou preenche o único disponível
    const { data: myContracts } = await context.supabase
      .from("contracts")
      .select("id, billing_type")
      .eq("client_id", context.userId)
      .eq("active", true);
    const available = (myContracts ?? []).map((c: any) => c.id);
    let contractId: string | null = data.contract_id ?? null;
    if (contractId && !available.includes(contractId)) {
      throw new Error("Contrato inválido para este cliente.");
    }
    if (!contractId && available.length === 1) contractId = available[0];
    if (!contractId && available.length > 1) {
      throw new Error("Selecione o contrato do chamado.");
    }

    const billingType =
      (myContracts ?? []).find((c: any) => c.id === contractId)?.billing_type ?? null;
    const rental = ["locacao_impressoras", "locacao_servidores", "locacao_rede"].includes(
      billingType ?? "",
    );

    let serviceType = rental ? (data.service_type ?? null) : null;
    let assetId = rental ? (data.asset_id ?? null) : null;
    let tonerColor = rental && serviceType === "toner" ? (data.toner_color ?? null) : null;
    let tonerQty = rental && serviceType === "toner" ? (data.toner_qty ?? null) : null;

    if (rental) {
      if (!serviceType) throw new Error("Selecione o tipo de solicitação.");
      if (!assetId) throw new Error("Selecione o equipamento do parque.");
      const { data: asset } = await context.supabase
        .from("contract_assets")
        .select("id")
        .eq("id", assetId)
        .eq("contract_id", contractId as string)
        .maybeSingle();
      if (!asset) throw new Error("Equipamento inválido para este contrato.");
      if (serviceType === "toner") {
        if (!tonerColor) throw new Error("Selecione a cor do toner.");
        if (!tonerQty || tonerQty < 1) tonerQty = 1;
      }
    }

    const { data: row, error } = await context.supabase
      .from("tickets")
      .insert({
        user_id: context.userId,
        title: normalizeTicketTitle(data.title),
        description: data.description,
        priority: data.priority,
        contract_id: contractId,
        custom_fields: data.custom_fields ?? [],
        service_type: serviceType,
        asset_id: assetId,
        toner_color: tonerColor,
        toner_qty: tonerQty,
      })

      .select("id, ticket_number")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, ticket_number: row.ticket_number };
  });

export const updateTicketContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ticket_id: z.string().uuid(), contract_id: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context.supabase, context.userId))) {
      throw new Error("Acesso restrito a administradores.");
    }
    const { data: ticket, error: tErr } = await context.supabase
      .from("tickets")
      .select("user_id, contract_id")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) throw new Error("Chamado não encontrado");
    if (ticket.contract_id === data.contract_id) return { ok: true };

    let label = "Sem contrato";
    if (data.contract_id) {
      const { data: contract } = await context.supabase
        .from("contracts")
        .select("id, name, client_id")
        .eq("id", data.contract_id)
        .maybeSingle();
      if (!contract || contract.client_id !== ticket.user_id) {
        throw new Error("Contrato inválido para este cliente.");
      }
      label = contract.name;
    }

    const { error } = await context.supabase
      .from("tickets")
      .update({ contract_id: data.contract_id })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("ticket_updates").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      message: `Chamado vinculado ao contrato: ${label}.`,
    });
    return { ok: true };
  });

export const addTicketUpdate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        message: z.string().max(4000).optional().nullable(),
        new_status: ticketStatusSchema.optional().nullable(),
      })
      .refine((v) => v.message || v.new_status, "Informe uma mensagem ou mude o status")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ticket, error: tErr } = await context.supabase
      .from("tickets")
      .select("status, user_id")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) throw new Error("Chamado não encontrado");

    const status_from = ticket.status;
    const status_to = data.new_status ?? null;

    // Quando o cliente dono responde um chamado "Aguardando cliente", o gatilho
    // trg_auto_client_response_status muda o status e registra a transição.


    const { error: upErr } = await context.supabase.from("ticket_updates").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      message: data.message ?? null,
      status_from: status_to ? status_from : null,
      status_to,
    });
    if (upErr) throw new Error(upErr.message);

    if (status_to) {
      const { error: sErr } = await context.supabase
        .from("tickets")
        .update({ status: status_to })
        .eq("id", data.ticket_id);
      if (sErr) throw new Error(sErr.message);
    }
    return { ok: true };
  });

export const updateTicketPriority = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticket_id: z.string().uuid(), priority: ticketPrioritySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const staff = await isStaffUser(context.supabase, context.userId);
    if (!staff) throw new Error("Acesso restrito");

    const { data: ticket, error: tErr } = await context.supabase
      .from("tickets")
      .select("priority")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) throw new Error("Chamado não encontrado");
    if (ticket.priority === data.priority) return { ok: true };

    const { error } = await context.supabase
      .from("tickets")
      .update({ priority: data.priority })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("ticket_updates").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      message: `Prioridade alterada de ${ticketPriorityLabels[ticket.priority] ?? ticket.priority} para ${ticketPriorityLabels[data.priority]}.`,
    });
    return { ok: true };
  });


export const registerAttachment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        storage_path: z.string().min(1),
        file_name: z.string().max(255),
        mime_type: z.string().max(120).optional().nullable(),
        size_bytes: z.number().int().nonnegative().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ticket_attachments").insert({
      ticket_id: data.ticket_id,
      uploader_id: context.userId,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cliente encerra o próprio chamado quando ele está Resolvido
export const closeTicketByClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ ticket_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("tickets")
      .select("user_id, status")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (error || !ticket) throw new Error("Chamado não encontrado");
    if (ticket.user_id !== context.userId) throw new Error("Acesso restrito");
    if (ticket.status !== "resolvido") {
      throw new Error("O chamado só pode ser fechado quando estiver Resolvido.");
    }

    const { error: closeError } = await context.supabase.rpc("close_ticket_by_client", {
      p_ticket_id: data.ticket_id,
    });
    if (closeError) throw new Error(closeError.message);
    return { ok: true };
  });
