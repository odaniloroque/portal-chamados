import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/api-docs")({
  component: ApiDocsPage,
  head: () => ({
    meta: [
      { title: "API de Chamados | Projetus Tech" },
      {
        name: "description",
        content:
          "Documentação interativa da API de abertura automática de chamados da Projetus Tech.",
      },
      { property: "og:title", content: "API de Chamados | Projetus Tech" },
      {
        property: "og:description",
        content: "Referência interativa (OpenAPI) do webhook de chamados da Projetus Tech.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "stylesheet", href: "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" },
    ],
  }),
});

function ApiDocsPage() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const SwaggerUIBundle = (window as unknown as { SwaggerUIBundle?: any }).SwaggerUIBundle;
      if (!SwaggerUIBundle) return;
      SwaggerUIBundle({
        url: "/api/public/openapi",
        dom_id: "#swagger-ui",
        deepLinking: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        tryItOutEnabled: true,
        persistAuthorization: true,
      });
    };
    document.body.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:px-6">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            API de Chamados — Projetus Tech
          </h1>
          <p className="text-sm text-muted-foreground">
            Autentique com o cabeçalho <code className="font-mono">x-webhook-secret</code> em
            “Authorize” para testar as requisições direto por aqui.
          </p>
        </div>
      </header>
      <div id="swagger-ui" className="mx-auto max-w-6xl px-2 pb-16 sm:px-6" />
    </main>
  );
}
