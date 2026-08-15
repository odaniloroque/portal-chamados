import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const response = await fetch(`${context.backendUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        apikey: context.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: data.password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error_description?: string }
        | null;
      throw new Error(
        payload?.message ?? payload?.error_description ?? "Não foi possível alterar a senha",
      );
    }
    return { ok: true };
  });
