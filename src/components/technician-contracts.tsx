import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients } from "@/lib/clients.functions";
import { listContracts } from "@/lib/contracts.functions";
import {
  listTechnicianAssignments,
  setTechnicianContracts,
} from "@/lib/technician-contracts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Briefcase, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export function useTechnicianAssignments() {
  return useQuery({
    queryKey: ["technician-assignments"],
    queryFn: () => listTechnicianAssignments(),
  });
}

export function TechnicianContractsSummary({ technicianId }: { technicianId: string }) {
  const { data: assignments } = useTechnicianAssignments();
  const { data: contracts } = useQuery({
    queryKey: ["contracts", "all"],
    queryFn: () => listContracts({ data: {} }),
  });
  if (!assignments || !contracts) return null;

  const mine = assignments.filter((a: any) => a.technician_id === technicianId);
  if (mine.length === 0) {
    return (
      <Badge variant="outline" className="text-xs text-destructive">
        Sem contratos atribuídos
      </Badge>
    );
  }
  const ids = new Set(mine.map((a: any) => a.contract_id));
  const clients = new Set(
    (contracts as any[]).filter((c) => ids.has(c.id)).map((c) => c.client_id),
  );
  return (
    <Badge variant="outline" className="text-xs">
      {mine.length} contrato{mine.length > 1 ? "s" : ""} · {clients.size} cliente
      {clients.size > 1 ? "s" : ""}
    </Badge>
  );
}

export function TechnicianContractsDialog({ tech }: { tech: any }) {
  const qc = useQueryClient();
  const save = useServerFn(setTechnicianContracts);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients(),
    enabled: open,
  });
  const { data: contracts } = useQuery({
    queryKey: ["contracts", "all"],
    queryFn: () => listContracts({ data: {} }),
    enabled: open,
  });
  const { data: assignments } = useQuery({
    queryKey: ["technician-assignments"],
    queryFn: () => listTechnicianAssignments(),
    enabled: open,
  });

  const groups = useMemo(() => {
    if (!clients || !contracts) return [];
    const t = term.trim().toLowerCase();
    return (clients as any[])
      .map((c) => ({
        client: c,
        contracts: (contracts as any[]).filter((k) => k.client_id === c.id),
      }))
      .filter((g) => g.contracts.length > 0)
      .filter((g) => {
        if (!t) return true;
        const hay = `${g.client.full_name ?? ""} ${g.client.company_name ?? ""} ${g.contracts
          .map((k: any) => `${k.name} ${k.contract_number ?? ""}`)
          .join(" ")}`.toLowerCase();
        return hay.includes(t);
      });
  }, [clients, contracts, term]);

  function openDialog(next: boolean) {
    setOpen(next);
    if (next && assignments) {
      setSelected(
        new Set(
          (assignments as any[])
            .filter((a) => a.technician_id === tech.id)
            .map((a) => a.contract_id as string),
        ),
      );
    }
    if (!next) setTerm("");
  }

  // Sincroniza a seleção quando os dados chegam depois da abertura
  const loadedKey = assignments ? "loaded" : "loading";
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (open && loadedKey === "loaded" && syncedKey !== `${tech.id}-open`) {
    setSyncedKey(`${tech.id}-open`);
    setSelected(
      new Set(
        (assignments as any[])
          .filter((a) => a.technician_id === tech.id)
          .map((a) => a.contract_id as string),
      ),
    );
  }
  if (!open && syncedKey !== null) setSyncedKey(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleClient(ids: string[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: { technician_id: tech.id, contract_ids: [...selected] } });
      toast.success("Contratos do técnico atualizados");
      qc.invalidateQueries({ queryKey: ["technician-assignments"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Contratos atendidos">
          <Briefcase className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contratos atendidos — {tech.full_name}</DialogTitle>
          <DialogDescription>
            Selecione os contratos que este técnico pode atender. Sem nenhum contrato marcado, ele
            não visualiza chamados.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar cliente ou contrato"
            className="pl-9"
          />
        </div>

        <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
          {!clients || !contracts ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum contrato encontrado.
            </p>
          ) : (
            groups.map((g) => {
              const ids = g.contracts.map((k: any) => k.id);
              const allSelected = ids.every((id: string) => selected.has(id));
              return (
                <div key={g.client.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b pb-1">
                    <p className="text-sm font-medium">
                      {g.client.company_name || g.client.full_name}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => toggleClient(ids, allSelected)}
                    >
                      {allSelected ? "Desmarcar todos" : "Marcar todos"}
                    </Button>
                  </div>
                  {g.contracts.map((k: any) => (
                    <label
                      key={k.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selected.has(k.id)}
                        onCheckedChange={() => toggle(k.id)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        {k.name}
                        {!k.active && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Inativo
                          </Badge>
                        )}
                        {k.contract_number && (
                          <span className="block text-xs text-muted-foreground">
                            Nº {k.contract_number}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.size} contrato{selected.size === 1 ? "" : "s"} selecionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
