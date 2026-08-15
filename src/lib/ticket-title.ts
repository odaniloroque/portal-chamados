/** Padroniza o título do chamado: espaços normalizados e primeira letra maiúscula. */
export function normalizeTicketTitle(title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) return clean;
  const isAllCaps = clean === clean.toUpperCase() && /[A-ZÀ-Ú]/.test(clean);
  const base = isAllCaps ? clean.toLowerCase() : clean;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
