import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Server } from "lucide-react";
import { toast } from "sonner";
import {
  listContractAssets,
  createContractAsset,
  updateContractAsset,
  deleteContractAsset,
} from "@/lib/contracts.functions";
import { ASSET_CATEGORY_LABELS, assetCategoryFor } from "@/lib/contract-labels";

export function ContractAssetsDialog({
  contract,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: {
  contract: any;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["contract-assets", contract.id],
    queryFn: () => listContractAssets({ data: { contractId: contract.id } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Server className="mr-2 h-4 w-4" /> Parque
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parque de equipamentos — {contract.name}</DialogTitle>
          <DialogDescription>
            Cadastre os equipamentos instalados neste contrato. O cliente escolhe um deles ao abrir
            o chamado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <AssetForm contract={contract} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum equipamento cadastrado neste contrato.
          </p>
        ) : (
          <div className="space-y-2">
            {assets.map((a: any) => (
              <AssetRow key={a.id} asset={a} contract={contract} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssetRow({ asset, contract }: { asset: any; contract: any }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteContractAsset);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Remover o equipamento "${asset.name}"?`)) return;
    setBusy(true);
    try {
      await del({ data: { id: asset.id } });
      qc.invalidateQueries({ queryKey: ["contract-assets"] });
      toast.success("Equipamento removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const details = [
    asset.serial && `Série ${asset.serial}`,
    asset.location,
    asset.hostname,
    asset.device_type,
    asset.counter !== null && asset.counter !== undefined && `Contador ${asset.counter}`,
    asset.specs,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {asset.name}
          <Badge variant="secondary" className="text-[10px]">
            {ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}
          </Badge>
          {!asset.active && (
            <Badge variant="outline" className="text-[10px]">
              Inativo
            </Badge>
          )}
        </p>
        {details && <p className="text-xs text-muted-foreground">{details}</p>}
      </div>
      <div className="flex items-center gap-2">
        <AssetForm contract={contract} asset={asset} />
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function AssetForm({ contract, asset }: { contract: any; asset?: any }) {
  const qc = useQueryClient();
  const create = useServerFn(createContractAsset);
  const update = useServerFn(updateContractAsset);
  const isEdit = !!asset;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const defaultCategory = assetCategoryFor(contract.billing_type) ?? "outro";
  const [form, setForm] = useState({
    category: asset?.category ?? defaultCategory,
    name: asset?.name ?? "",
    serial: asset?.serial ?? "",
    location: asset?.location ?? "",
    hostname: asset?.hostname ?? "",
    specs: asset?.specs ?? "",
    device_type: asset?.device_type ?? "",
    counter: asset?.counter !== null && asset?.counter !== undefined ? String(asset.counter) : "",
    notes: asset?.notes ?? "",
    active: asset?.active ?? true,
  });

  function set(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        contract_id: contract.id,
        category: form.category,
        name: form.name,
        serial: form.serial || null,
        location: form.location || null,
        hostname: form.hostname || null,
        specs: form.specs || null,
        device_type: form.device_type || null,
        counter: form.counter ? Number(form.counter) : null,
        notes: form.notes || null,
        active: form.active,
      };
      if (isEdit) {
        await update({ data: { id: asset.id, ...payload } });
        toast.success("Equipamento atualizado");
      } else {
        await create({ data: payload });
        toast.success("Equipamento cadastrado");
        setForm({ ...form, name: "", serial: "", hostname: "", counter: "", notes: "" });
      }
      qc.invalidateQueries({ queryKey: ["contract-assets"] });
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
            <Plus className="mr-2 h-4 w-4" /> Novo equipamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          <DialogDescription>Dados do ativo instalado no cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome / modelo *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="Ex.: HP LaserJet M428"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número de série</Label>
            <Input value={form.serial} onChange={(e) => set("serial", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Setor / local</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>

          {form.category === "impressora" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Contador atual</Label>
              <Input
                value={form.counter}
                onChange={(e) => set("counter", e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
              />
            </div>
          )}

          {(form.category === "servidor" || form.category === "rede") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Hostname / IP</Label>
              <Input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} />
            </div>
          )}

          {form.category === "servidor" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Especificação resumida</Label>
              <Input
                value={form.specs}
                onChange={(e) => set("specs", e.target.value)}
                placeholder="Ex.: Xeon 8 vCPU, 32GB RAM, 2TB"
              />
            </div>
          )}

          {form.category === "rede" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={form.device_type || "switch"}
                onValueChange={(v) => set("device_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="switch">Switch</SelectItem>
                  <SelectItem value="roteador">Roteador</SelectItem>
                  <SelectItem value="ap">Access Point</SelectItem>
                  <SelectItem value="firewall">Firewall</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Situação</Label>
            <Select
              value={form.active ? "sim" : "nao"}
              onValueChange={(v) => set("active", v === "sim")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Ativo</SelectItem>
                <SelectItem value="nao">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Resumo compacto do parque do contrato, com edição rápida. */
export function ContractAssetsSummary({ contract }: { contract: any }) {
  const [open, setOpen] = useState(false);
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["contract-assets", contract.id],
    queryFn: () => listContractAssets({ data: { contractId: contract.id } }),
  });

  const active = assets.filter((a: any) => a.active);
  const byCategory = active.reduce((acc: Record<string, number>, a: any) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});
  const inactive = assets.length - active.length;

  return (
    <div className="mt-2 rounded-md border border-dashed bg-muted/30 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Server className="h-3.5 w-3.5" /> Parque de equipamentos
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
          Gerenciar parque
        </Button>
      </div>

      {!isLoading && assets.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Nenhum equipamento cadastrado.{" "}
          <button type="button" className="underline" onClick={() => setOpen(true)}>
            Cadastrar agora
          </button>
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(byCategory).map(([cat, count]) => (
              <Badge key={cat} variant="secondary" className="text-[10px]">
                {ASSET_CATEGORY_LABELS[cat] ?? cat}: {count as number}
              </Badge>
            ))}
            {inactive > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {inactive} inativo{inactive > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <ul className="mt-2 space-y-1">
            {active.slice(0, 3).map((a: any) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span className="truncate">
                  <span className="text-foreground">{a.name}</span>
                  {a.serial ? ` · Série ${a.serial}` : ""}
                  {a.location ? ` · ${a.location}` : ""}
                  {a.hostname ? ` · ${a.hostname}` : ""}
                </span>
                <AssetForm contract={contract} asset={a} />
              </li>
            ))}
          </ul>

          {active.length > 3 && (
            <button
              type="button"
              className="mt-1 text-xs underline text-muted-foreground"
              onClick={() => setOpen(true)}
            >
              Ver todos os {active.length} equipamentos
            </button>
          )}
        </>
      )}

      <ContractAssetsDialog contract={contract} open={open} onOpenChange={setOpen} hideTrigger />
    </div>
  );
}
