import { z } from "zod";

export const devStatusSchema = z.enum([
  "backlog",
  "em_desenvolvimento",
  "aguardando_deploy",
  "concluido",
]);

export type DevStatus = z.infer<typeof devStatusSchema>;

export const devStatusLabels: Record<DevStatus, string> = {
  backlog: "Backlog",
  em_desenvolvimento: "Em desenvolvimento",
  aguardando_deploy: "Aguardando deploy",
  concluido: "Concluído",
};

/** Formata o número exibido: 0010 (pai) ou 0010.1 (subchamado). */
export function formatDisplayNumber(
  ticketNumber: number | null | undefined,
  parentNumber?: number | null,
  childSeq?: number | null,
) {
  if (parentNumber && childSeq) return `${String(parentNumber).padStart(4, "0")}.${childSeq}`;
  if (ticketNumber === null || ticketNumber === undefined) return "—";
  return String(ticketNumber).padStart(4, "0");
}
