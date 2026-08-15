export function formatTicketNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `#${String(n).padStart(4, "0")}`;
}
