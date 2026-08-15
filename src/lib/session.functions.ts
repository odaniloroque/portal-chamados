import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";

export const getMySession = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r) => r.role);
    const isAdmin = roleList.includes("admin");
    const isTecnico = roleList.includes("tecnico");
    const isDev = roleList.includes("dev");
    return {
      userId,
      profile,
      roles: roleList,
      isAdmin,
      isTecnico,
      isDev,
      isStaff: isAdmin || isTecnico || isDev,
      isCliente: roleList.includes("cliente"),
    };
  });
