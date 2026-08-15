export const BILLING_TYPE_LABELS: Record<string, string> = {
  por_hora: "Por hora",
  fixo: "Fixo (mensalidade)",
  por_servico: "Por serviço executado",
  locacao_impressoras: "Locação de impressoras",
  locacao_servidores: "Locação de servidores",
  locacao_rede: "Locação de rede",
};

export const BILLING_TYPE_OPTIONS = Object.entries(BILLING_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const RENTAL_BILLING_TYPES = [
  "locacao_impressoras",
  "locacao_servidores",
  "locacao_rede",
] as const;

export function isRental(billingType?: string | null) {
  return !!billingType && (RENTAL_BILLING_TYPES as readonly string[]).includes(billingType);
}

export function billingLabel(billingType?: string | null) {
  return (billingType && BILLING_TYPE_LABELS[billingType]) || "Por hora";
}

/** Categoria de ativo esperada por tipo de contrato de locação. */
export function assetCategoryFor(billingType?: string | null) {
  if (billingType === "locacao_impressoras") return "impressora";
  if (billingType === "locacao_servidores") return "servidor";
  if (billingType === "locacao_rede") return "rede";
  return null;
}

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  impressora: "Impressora",
  servidor: "Servidor",
  rede: "Equipamento de rede",
  outro: "Outro",
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  corretiva: "Manutenção corretiva",
  preventiva: "Manutenção preventiva",
  toner: "Solicitação de toner",
  mudanca: "Mudança / configuração",
};

export function serviceTypeOptions(billingType?: string | null) {
  if (billingType === "locacao_impressoras") return ["corretiva", "preventiva", "toner"];
  if (billingType === "locacao_servidores" || billingType === "locacao_rede")
    return ["corretiva", "preventiva", "mudanca"];
  return [];
}

export const TONER_COLORS = [
  { value: "preto", label: "Preto" },
  { value: "ciano", label: "Ciano" },
  { value: "magenta", label: "Magenta" },
  { value: "amarelo", label: "Amarelo" },
];

export const TONER_COLOR_LABELS: Record<string, string> = Object.fromEntries(
  TONER_COLORS.map((c) => [c.value, c.label]),
);
