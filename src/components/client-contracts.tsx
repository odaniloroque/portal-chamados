import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listContracts,
  createContract,
  updateContract,
  setContractActive,
  deleteContract,
} from "@/lib/contracts.functions";
import { formatBRL, parseCurrency } from "@/lib/time-format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BILLING_TYPE_OPTIONS, billingLabel, isRental } from "@/lib/contract-labels";
import { ContractAssetsDialog, ContractAssetsSummary } from "@/components/contract-assets";

const SUPPLY_LABELS: Record<string, string> = {
  toner: "Por toner",
  pagina: "Por página / papel",
  incluso: "Incluso no contrato",
};



export function ContractsDialog({ client }: { client: any }) {
  const [open, setOpen] = useState(false);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", client.id],
    queryFn: () => listContracts({ data: { clientId: client.id } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" /> Contratos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contratos de {client.company_name || client.full_name}</DialogTitle>
          <DialogDescription>
            Cadastre um contrato para cada serviço (ex.: locação de impressoras, suporte de TI).
            Cada chamado e cada hora ficam vinculados a um contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <ContractForm clientId={client.id} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum contrato cadastrado para este cliente.
          </p>
        ) : (
          <div className="space-y-2">
            {contracts.map((c: any) => (
              <ContractRow key={c.id} contract={c} clientId={client.id} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContractRow({ contract, clientId }: { contract: any; clientId: string }) {
  const qc = useQueryClient();
  const toggle = useServerFn(setContractActive);
  const del = useServerFn(deleteContract);
  const [busy, setBusy] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["time-entries"] });
  }

  async function handleToggle() {
    setBusy(true);
    try {
      await toggle({ data: { id: contract.id, active: !contract.active } });
      refresh();
      toast.success(contract.active ? "Contrato inativado" : "Contrato reativado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o contrato "${contract.name}"? Chamados ficarão sem contrato.`)) return;
    setBusy(true);
    try {
      await del({ data: { id: contract.id } });
      refresh();
      toast.success("Contrato excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const labels = [
    contract.rental_mode && `Modalidade: ${contract.rental_mode}`,
    contract.supply_billing && `Insumo: ${SUPPLY_LABELS[contract.supply_billing] ?? contract.supply_billing}`,
    contract.toner_price !== null &&
      contract.toner_price !== undefined &&
      `Toner: ${formatBRL(Number(contract.toner_price))}`,
    contract.page_price !== null &&
      contract.page_price !== undefined &&
      `Página: ${formatBRL(Number(contract.page_price))}`,
    contract.monthly_page_quota && `Franquia: ${contract.monthly_page_quota} pág./mês`,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {contract.name}
            <Badge variant="secondary" className="text-[10px]">
              {billingLabel(contract.billing_type)}
            </Badge>
            {!contract.active && (
              <Badge variant="outline" className="text-[10px]">
                Inativo
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {contract.contract_number && `#${contract.contract_number} · `}
            {contract.contract_plan && `${contract.contract_plan} · `}
            {formatBRL(contract.contract_value === null ? null : Number(contract.contract_value))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRental(contract.billing_type) && <ContractAssetsDialog contract={contract} />}
          <ContractForm clientId={clientId} contract={contract} />

          <Button variant="outline" size="sm" onClick={handleToggle} disabled={busy}>
            {contract.active ? "Inativar" : "Ativar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <Badge key={l} variant="outline" className="text-[10px] font-normal">
              {l}
            </Badge>
          ))}
        </div>
      )}

      {isRental(contract.billing_type) && <ContractAssetsSummary contract={contract} />}
    </div>
  );
}


function ContractForm({ clientId, contract }: { clientId: string; contract?: any }) {
  const qc = useQueryClient();
  const create = useServerFn(createContract);
  const update = useServerFn(updateContract);
  const isEdit = !!contract;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const emptyForm = {
    name: "",
    contract_number: "",
    contract_plan: "",
    contract_value: "",
    contract_start: "",
    contract_end: "",
    billing_type: "por_hora",
    rental_mode: "",
    supply_billing: "",
    toner_price: "",
    page_price: "",
    monthly_page_quota: "",
  };
  const [form, setForm] = useState({
    ...emptyForm,
    name: contract?.name ?? "",
    contract_number: contract?.contract_number ?? "",
    contract_plan: contract?.contract_plan ?? "",
    contract_value:
      contract?.contract_value !== null && contract?.contract_value !== undefined
        ? String(contract.contract_value).replace(".", ",")
        : "",
    contract_start: contract?.contract_start ?? "",
    contract_end: contract?.contract_end ?? "",
    billing_type: contract?.billing_type ?? "por_hora",
    rental_mode: contract?.rental_mode ?? "",
    supply_billing: contract?.supply_billing ?? "",
    toner_price:
      contract?.toner_price !== null && contract?.toner_price !== undefined
        ? String(contract.toner_price).replace(".", ",")
        : "",
    page_price:
      contract?.page_price !== null && contract?.page_price !== undefined
        ? String(contract.page_price).replace(".", ",")
        : "",
    monthly_page_quota:
      contract?.monthly_page_quota !== null && contract?.monthly_page_quota !== undefined
        ? String(contract.monthly_page_quota)
        : "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const rental = isRental(form.billing_type);
  const printers = form.billing_type === "locacao_impressoras";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        contract_number: form.contract_number || null,
        contract_plan: form.contract_plan || null,
        contract_value: parseCurrency(form.contract_value),
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        active: contract?.active ?? true,
        billing_type: form.billing_type as any,
        rental_mode: rental ? form.rental_mode || null : null,
        supply_billing: printers ? form.supply_billing || null : null,
        toner_price: printers ? parseCurrency(form.toner_price) : null,
        page_price: printers ? parseCurrency(form.page_price) : null,
        monthly_page_quota:
          printers && form.monthly_page_quota ? Number(form.monthly_page_quota) : null,
      };
      if (isEdit) {
        await update({ data: { id: contract.id, ...payload } });
        toast.success("Contrato atualizado");
      } else {
        await create({ data: { client_id: clientId, ...payload } });
        toast.success("Contrato criado");
        setForm(emptyForm);
      }
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> Novo contrato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          <DialogDescription>
            Dê um nome que identifique o serviço contratado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Nome do contrato *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Locação de impressoras"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Tipo de cobrança *</Label>
            <Select value={form.billing_type} onValueChange={(v) => set("billing_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Número</Label>
            <Input
              value={form.contract_number}
              onChange={(e) => set("contract_number", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plano</Label>
            <Input
              value={form.contract_plan}
              onChange={(e) => set("contract_plan", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor do contrato (R$)</Label>
            <Input
              value={form.contract_value}
              onChange={(e) => set("contract_value", e.target.value)}
              placeholder="Ex.: 2.500,00"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Início</Label>
            <Input
              type="date"
              value={form.contract_start}
              onChange={(e) => set("contract_start", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim</Label>
            <Input
              type="date"
              value={form.contract_end}
              onChange={(e) => set("contract_end", e.target.value)}
            />
          </div>

          {rental && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Modalidade de locação</Label>
              <Input
                value={form.rental_mode}
                onChange={(e) => set("rental_mode", e.target.value)}
                placeholder="Ex.: franquia + excedente, comodato, locação mensal"
                maxLength={120}
              />
            </div>
          )}

          {printers && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Cobrança de insumo</Label>
                <Select
                  value={form.supply_billing || "toner"}
                  onValueChange={(v) => set("supply_billing", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toner">Por toner</SelectItem>
                    <SelectItem value="pagina">Por página / papel</SelectItem>
                    <SelectItem value="incluso">Incluso no contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor por toner (R$)</Label>
                <Input
                  value={form.toner_price}
                  onChange={(e) => set("toner_price", e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor por página (R$)</Label>
                <Input
                  value={form.page_price}
                  onChange={(e) => set("page_price", e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 0,0850"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Franquia mensal (páginas)</Label>
                <Input
                  value={form.monthly_page_quota}
                  onChange={(e) => set("monthly_page_quota", e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
