import { z } from "zod";

export const ticketPrioritySchema = z.enum(["baixa", "media", "alta", "critica"]);

export const ticketStatusSchema = z.enum([
  "aberto",
  "em_andamento",
  "aguardando_cliente",
  "respondido_cliente",
  "em_desenvolvimento",
  "resolvido",
  "fechado",
]);

export const fullProfileColumns =
  "id, full_name, company_name, email, phone, cnpj, address, contract_number, contract_plan, contract_start, contract_end";

export const basicProfileColumns = "id, full_name, company_name";

export const ticketPriorityLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export async function isAdminUser(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

export async function isStaffUser(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  return Boolean(data);
}

export async function attachContracts(supabase: any, tickets: any[]) {
  const ids = Array.from(new Set(tickets.map((ticket) => ticket.contract_id).filter(Boolean)));
  if (ids.length === 0) return tickets.map((ticket) => ({ ...ticket, contract: null }));

  const { data: rows } = await supabase
    .from("contracts")
    .select("id, name, contract_number, contract_plan, billing_type")
    .in("id", ids);
  const contracts = new Map((rows ?? []).map((contract: any) => [contract.id, contract]));

  return tickets.map((ticket) => ({
    ...ticket,
    contract: ticket.contract_id ? (contracts.get(ticket.contract_id) ?? null) : null,
  }));
}

export async function attachProfiles(supabase: any, tickets: any[], full = true) {
  if (tickets.length === 0) return tickets;

  const ids = Array.from(new Set(tickets.map((ticket) => ticket.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select(full ? fullProfileColumns : basicProfileColumns)
    .in("id", ids);
  const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

  return attachContracts(
    supabase,
    tickets.map((ticket) => ({
      ...ticket,
      profiles: profileMap.get(ticket.user_id) ?? null,
    })),
  );
}