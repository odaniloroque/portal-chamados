import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  SUPABASE_PUBLISHABLE_KEY as ACTIVE_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL as ACTIVE_SUPABASE_URL,
} from "@/integrations/supabase/app-client";

function createBackendFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      (apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${apiKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const backendUrl = ACTIVE_SUPABASE_URL;
  const publishableKey = ACTIVE_SUPABASE_PUBLISHABLE_KEY;

  if (!backendUrl || !publishableKey) {
    throw new Error("A conexão com o backend não está disponível no momento.");
  }

  const authorization = getRequest().headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Não autorizado", { status: 401 });
  }

  const token = authorization.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) {
    throw new Response("Sessão inválida", { status: 401 });
  }

  const backend = createClient<Database>(backendUrl, publishableKey, {
    global: {
      fetch: createBackendFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await backend.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    throw new Response("Sessão inválida", { status: 401 });
  }

  return next({
    context: {
      supabase: backend,
      userId,
      claims: data.claims,
      accessToken: token,
      backendUrl,
      publishableKey,
    },
  });
});