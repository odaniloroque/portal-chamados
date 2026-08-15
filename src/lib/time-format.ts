const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata um número em Reais. */
export function formatBRL(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return BRL.format(value);
}

/** Converte texto no formato pt-BR ("2.500,00") em número. Retorna null quando vazio/inválido. */
export function parseCurrency(input: string): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatMinutes(total: number) {

  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function todayISO() {
  const now = new Date();
  const tz = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

/** Lê "horas contratadas" dos campos dinâmicos do contrato, se existir. */
export function contractedHours(customFields: unknown): number | null {
  if (!Array.isArray(customFields)) return null;
  for (const f of customFields as any[]) {
    const label = String(f?.label ?? "").toLowerCase();
    if (label.includes("hora")) {
      const n = parseFloat(String(f?.value ?? "").replace(",", "."));
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}
