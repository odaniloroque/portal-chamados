import { createFileRoute, Outlet, redirect, isRedirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/app-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/cliente" });
      return { user: data.user };
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/cliente" });
    }
  },
  component: () => <Outlet />,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Não foi possível carregar</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Ocorreu um erro. Faça login novamente."}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Tentar novamente
          </button>
          <Link to="/cliente" className="px-4 py-2 rounded-md border text-sm">
            Ir para login
          </Link>
        </div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <Link to="/portal" className="underline">Voltar ao portal</Link>
    </div>
  ),
});
