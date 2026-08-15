import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { ArrowLeft, Loader2, KanbanSquare } from "lucide-react";

import { getMySession } from "@/lib/session.functions";
import { DevKanban } from "@/components/dev-kanban";
import { Button } from "@/components/ui/button";

const sessionQuery = queryOptions({ queryKey: ["session"], queryFn: () => getMySession() });

export const Route = createFileRoute("/_authenticated/dev")({
  head: () => ({
    meta: [
      { title: "Kanban de Desenvolvimento — Projetus Tech" },
      {
        name: "description",
        content: "Quadro de subchamados de desenvolvimento da Projetus Tech.",
      },
    ],
  }),
  component: DevPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center text-sm">Página não encontrada.</div>,
});

function DevPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/portal" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao portal
          </Link>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <KanbanSquare className="h-4 w-4" /> Desenvolvimento
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          }
        >
          <DevGuard />
        </Suspense>
      </main>
    </div>
  );
}

function DevGuard() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const navigate = useNavigate();
  const allowed = session.isAdmin || session.isDev;

  useEffect(() => {
    if (!allowed) navigate({ to: "/portal", replace: true });
  }, [allowed, navigate]);

  if (!allowed) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Acesso restrito a administradores e desenvolvedores.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/portal">Ir para o portal</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Kanban de Desenvolvimento</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os subchamados entre as colunas para atualizar a situação.
        </p>
      </div>
      <DevKanban />
    </>
  );
}
