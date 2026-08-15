import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowRight, ArrowUp, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const priorityIcon: Record<string, LucideIcon> = {
  baixa: ArrowDown,
  media: ArrowRight,
  alta: ArrowUp,
  critica: AlertTriangle,
};

/** Prioridade usa outline + ícone; status permanece preenchido (sólido). */
const priorityOutline: Record<string, string> = {
  baixa: "border-slate-300 text-slate-600",
  media: "border-blue-300 text-blue-700",
  alta: "border-amber-400 text-amber-700",
  critica: "border-red-400 text-red-700",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const Icon = priorityIcon[priority] ?? ArrowRight;
  return (
    <Badge
      variant="outline"
      className={`gap-1 border bg-transparent font-medium ${priorityOutline[priority] ?? ""}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {priorityLabel[priority] ?? priority}
    </Badge>
  );
}
