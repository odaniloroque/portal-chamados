import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Projetus Tech — API de Chamados",
    version: "1.0.0",
    description:
      "API pública para automação de abertura de chamados no portal do cliente da Projetus Tech. Autenticação por segredo compartilhado no cabeçalho `x-webhook-secret`.",
  },
  servers: [{ url: "/", description: "Servidor atual" }],
  tags: [{ name: "Chamados", description: "Abertura automatizada de chamados" }],
  components: {
    securitySchemes: {
      webhookSecret: {
        type: "apiKey",
        in: "header",
        name: "x-webhook-secret",
        description: "Segredo de integração fornecido pela Projetus Tech.",
      },
    },
    schemas: {
      NovoChamado: {
        type: "object",
        required: ["email", "title", "description"],
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "E-mail do cliente cadastrado e ativo no portal.",
            example: "cliente@empresa.com.br",
          },
          title: {
            type: "string",
            minLength: 3,
            maxLength: 150,
            example: "Impressora do setor financeiro sem rede",
          },
          description: {
            type: "string",
            minLength: 5,
            maxLength: 4000,
            example: "A impressora parou de responder após a queda de energia.",
          },
          priority: {
            type: "string",
            enum: ["baixa", "media", "alta", "critica"],
            default: "media",
          },
          custom_fields: {
            type: "array",
            maxItems: 20,
            description: "Campos adicionais exibidos no chamado.",
            items: {
              type: "object",
              required: ["label", "value"],
              properties: {
                label: { type: "string", maxLength: 80, example: "Setor" },
                value: { type: "string", maxLength: 500, example: "Financeiro" },
              },
            },
          },
        },
      },
      ChamadoCriado: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          id: { type: "string", format: "uuid" },
          ticket_number: { type: "integer", example: 42 },
        },
      },
      Erro: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          error: {
            type: "string",
            enum: [
              "unauthorized",
              "invalid_json",
              "invalid_payload",
              "client_not_found",
              "internal_error",
            ],
          },
          details: { type: "object", nullable: true },
        },
      },
    },
  },
  paths: {
    "/api/public/chamados": {
      post: {
        tags: ["Chamados"],
        summary: "Criar chamado",
        description:
          "Cria um chamado vinculado ao cliente identificado pelo e-mail informado. O cliente precisa existir e estar ativo.",
        security: [{ webhookSecret: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NovoChamado" } },
          },
        },
        responses: {
          "200": {
            description: "Chamado criado",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ChamadoCriado" } },
            },
          },
          "400": {
            description: "Payload inválido",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Erro" } } },
          },
          "401": {
            description: "Segredo ausente ou inválido",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Erro" } } },
          },
          "404": {
            description: "Cliente não encontrado ou inativo",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Erro" } } },
          },
          "500": {
            description: "Erro interno",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Erro" } } },
          },
        },
      },
    },
  },
};

export const Route = createFileRoute("/api/public/openapi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () =>
        new Response(JSON.stringify(spec), {
          headers: { "content-type": "application/json", ...cors },
        }),
    },
  },
});
