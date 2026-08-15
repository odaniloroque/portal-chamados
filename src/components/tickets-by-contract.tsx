import { useState } from "react";
import { Building2, ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type TicketGroup = {
  key: string;
  label: string;
  items: any[];
};

export type ClientGroup = TicketGroup & {
  contracts: TicketGroup[];
};

/** Agrupa chamados por contrato, mantendo "Sem contrato" no final. */
export function groupTicketsByContract(tickets: any[], withClient = false): TicketGroup[] {
  const groups = new Map<string, TicketGroup>();
  for (const t of tickets) {
    const key = t.contract_id ?? "__none__";
    if (!groups.has(key)) {
      let label = "Sem contrato";
      if (t.contract) {
        label = t.contract.name;
        if (t.contract.contract_number) label += ` · #${t.contract.contract_number}`;
      }
      if (withClient) {
        const client = t.profiles?.company_name || t.profiles?.full_name;
        if (client) label = `${client} — ${label}`;
      }
      groups.set(key, { key, label, items: [] });
    }
    groups.get(key)!.items.push(t);
  }
  const list = Array.from(groups.values());
  list.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, "pt-BR");
  });
  return list;
}

/** Agrupa chamados por cliente e, dentro de cada cliente, por contrato (Cliente → Contrato → Chamados). */
export function groupTicketsByClientAndContract(tickets: any[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const t of tickets) {
    const key = t.user_id ?? t.profiles?.id ?? "__none__";
    if (!groups.has(key)) {
      const label = t.profiles?.company_name || t.profiles?.full_name || "Sem cliente";
      groups.set(key, { key, label, items: [], contracts: [] });
    }
    groups.get(key)!.items.push(t);
  }
  const list = Array.from(groups.values());
  list.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, "pt-BR");
  });
  for (const client of list) {
    client.contracts = groupTicketsByContract(client.items, false).map((g) => ({
      ...g,
      key: `${client.key}::${g.key}`,
    }));
  }
  return list;
}

/** Controle de seções recolhidas (todas abertas por padrão). */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return {
    isCollapsed: (key: string) => !!collapsed[key],
    toggle: (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] })),
  };
}

export function ContractGroupHeader({
  label,
  count,
  collapsed,
  onToggle,
  className,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted",
        className,
      )}
    >
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          collapsed && "-rotate-90",
        )}
      />
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

export function ClientGroupHeader({
  label,
  count,
  collapsed,
  onToggle,
  className,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/15",
        className,
      )}
    >
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 transition-transform",
          collapsed && "-rotate-90",
        )}
      />
      <Building2 className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
