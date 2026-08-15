import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Download, Trash2, Pencil, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  listTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from "@/lib/time-entries.functions";
import { formatMinutes, todayISO, contractedHours, formatBRL } from "@/lib/time-format";
import { formatTicketNumber } from "@/lib/ticket-number";
import { listContracts } from "@/lib/contracts.functions";
import { billingLabel } from "@/lib/contract-labels";


const ALL = "__all__";

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function AdminHours({ clients, tickets }: { clients: any[]; tickets: any[] }) {
  const [clientId, setClientId] = useState<string>(ALL);
  const [contractId, setContractId] = useState<string>(ALL);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayISO());

  const filters = {
    clientId: clientId === ALL ? null : clientId,
    contractId: contractId === ALL ? null : contractId,
    from: from || null,
    to: to || null,
  };

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time-entries", filters],
    queryFn: () => listTimeEntries({ data: filters }),
  });

  const { data: allContracts = [] } = useQuery({
    queryKey: ["contracts", clientId],
    queryFn: () => listContracts({ data: { clientId: clientId === ALL ? null : clientId } }),
  });

  const totalMinutes = useMemo(
    () => entries.reduce((sum: number, e: any) => sum + e.duration_minutes, 0),
    [entries],
  );

  const selectedClient = clients.find((c) => c.id === clientId);
  const contracted = selectedClient ? contractedHours(selectedClient.custom_fields) : null;
  const over = contracted !== null && totalMinutes / 60 > contracted;

  // Resumo por contrato: total de horas no período e valor por hora
  const byContract = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        client: string;
        minutes: number;
        value: number | null;
        billingType: string;
      }
    >();
    for (const e of entries as any[]) {
      const key = e.contract_id ?? `sem-contrato:${e.client_id}`;
      const current = map.get(key);
      if (current) {
        current.minutes += e.duration_minutes;
        continue;
      }
      const fallback = clients.find((c) => c.id === e.client_id);
      const profile = e.client ?? fallback;
      const clientName = profile?.company_name || profile?.full_name || "Sem nome";
      const contract =
        e.contract ?? allContracts.find((c: any) => c.id === e.contract_id) ?? null;
      const rawValue = contract ? contract.contract_value : null;
      map.set(key, {
        name: contract?.name ?? "Sem contrato",
        client: clientName,
        minutes: e.duration_minutes,
        value: rawValue === null || rawValue === undefined ? null : Number(rawValue),
        billingType: contract?.billing_type ?? "por_hora",
      });
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        hours: r.minutes / 60,
        perHour:
          r.billingType === "por_hora" && r.value !== null && r.minutes > 0
            ? r.value / (r.minutes / 60)
            : null,
      }))
      .sort((a, b) => b.minutes - a.minutes);

  }, [entries, clients, allContracts]);

  function exportCsv() {
    const rows = [
      ["Data", "Cliente", "Contrato", "Chamado", "Registrado por", "Duração (min)", "Origem", "Descrição"],
      ...entries.map((e: any) => [
        e.entry_date,
        e.client?.company_name || e.client?.full_name || "",
        e.contract?.name ?? "Sem contrato",
        e.ticket ? formatTicketNumber(e.ticket.ticket_number) : "",
        e.author?.full_name ?? "",
        String(e.duration_minutes),
        e.source === "timer" ? "Cronômetro" : "Manual",
        (e.description ?? "").replace(/"/g, '""'),
      ]),
      [],
      ["Resumo por contrato", "Cliente", "Total de horas", "Valor do contrato", "Valor por hora"],
      ...byContract.map((r) => [
        r.name,
        r.client,
        r.hours.toFixed(2).replace(".", ","),
        r.value !== null ? r.value.toFixed(2).replace(".", ",") : "",
        r.perHour !== null ? r.perHour.toFixed(2).replace(".", ",") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `horas-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setContractId(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contrato</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os contratos</SelectItem>
                {allContracts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <EntryDialog clients={clients} tickets={tickets} />
            <Button variant="outline" onClick={exportCsv} disabled={entries.length === 0}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Total no período: {formatMinutes(totalMinutes)}
            {contracted !== null && (
              <Badge variant={over ? "destructive" : "outline"}>
                {(totalMinutes / 60).toFixed(1)}h de {contracted}h contratadas
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum registro de horas no período selecionado.
            </p>
          ) : (
            entries.map((e: any) => (
              <EntryRow key={e.id} entry={e} clients={clients} tickets={tickets} />
            ))
          )}
        </CardContent>
      </Card>

      {byContract.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custo por hora no período (por contrato)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Contrato</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 text-right font-medium">Total de horas</th>
                  <th className="py-2 pr-3 text-right font-medium">Valor do contrato</th>
                  <th className="py-2 text-right font-medium">Valor por hora</th>
                </tr>
              </thead>
              <tbody>
                {byContract.map((r) => (
                  <tr key={`${r.client}-${r.name}`} className="border-b last:border-0">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.client}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatMinutes(r.minutes)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatBRL(r.value)}</td>
                    <td className="py-2 text-right font-mono">
                      {r.perHour !== null ? (
                        r.minutes < 60 ? (
                          <span className="text-muted-foreground" title="Menos de 1 hora lançada no período — valor não representativo">
                            {formatBRL(r.perHour)} *
                          </span>
                        ) : (
                          formatBRL(r.perHour)
                        )
                      ) : r.billingType !== "por_hora" ? (
                        <span className="text-xs text-muted-foreground">
                          {billingLabel(r.billingType)}
                        </span>
                      ) : (
                        "—"
                      )}

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pt-3 text-xs text-muted-foreground">
              Valor por hora = valor do contrato dividido pelas horas lançadas no período filtrado.
              {byContract.some((r) => r.minutes < 60) && (
                <>
                  {" "}
                  <span className="font-medium">
                    * Contratos com menos de 1 hora lançada no período geram um valor por hora
                    distorcido — lance as horas reais para o cálculo ficar correto.
                  </span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>

  );
}

function EntryRow({ entry, clients, tickets }: { entry: any; clients: any[]; tickets: any[] }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteTimeEntry);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Excluir este registro de horas?")) return;
    setDeleting(true);
    try {
      await del({ data: { id: entry.id } });
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Registro excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {entry.description || "Sem descrição"}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(entry.entry_date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
          {entry.client?.company_name || entry.client?.full_name || "—"}
          {` · ${entry.contract?.name ?? "Sem contrato"}`}
          {entry.ticket && ` · ${formatTicketNumber(entry.ticket.ticket_number)}`}
          {entry.author?.full_name && ` · ${entry.author.full_name}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{entry.source === "timer" ? "Cronômetro" : "Manual"}</Badge>
        <span className="font-mono text-sm">{formatMinutes(entry.duration_minutes)}</span>
        <EntryDialog clients={clients} tickets={tickets} entry={entry} />
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function EntryDialog({
  clients,
  tickets,
  entry,
}: {
  clients: any[];
  tickets: any[];
  entry?: any;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTimeEntry);
  const update = useServerFn(updateTimeEntry);
  const isEdit = !!entry;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(entry?.client_id ?? "");
  const [ticketId, setTicketId] = useState(entry?.ticket_id ?? ALL);
  const [entryContractId, setEntryContractId] = useState(entry?.contract_id ?? ALL);
  const [date, setDate] = useState(entry?.entry_date ?? todayISO());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState(entry ? String(entry.duration_minutes) : "");
  const [description, setDescription] = useState(entry?.description ?? "");

  const clientTickets = tickets.filter((t) => t.user_id === clientId);

  const { data: dialogContracts = [] } = useQuery({
    queryKey: ["contracts", clientId],
    queryFn: () => listContracts({ data: { clientId } }),
    enabled: open && !!clientId,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let minutes = Number(duration);
    if (!minutes && start && end) minutes = minutesBetween(start, end);
    if (!minutes || minutes <= 0) {
      toast.error("Informe a duração ou um intervalo de horário válido");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await update({
          data: {
            id: entry.id,
            description,
            entry_date: date,
            duration_minutes: minutes,
            contract_id: entryContractId === ALL ? null : entryContractId,
          },
        });
        toast.success("Registro atualizado");
      } else {
        if (!clientId) {
          toast.error("Selecione o cliente");
          setLoading(false);
          return;
        }
        await create({
          data: {
            client_id: clientId,
            contract_id: entryContractId === ALL ? null : entryContractId,
            ticket_id: ticketId === ALL ? null : ticketId,
            description,
            entry_date: date,
            started_at: start ? new Date(`${date}T${start}`).toISOString() : null,
            ended_at: end ? new Date(`${date}T${end}`).toISOString() : null,
            duration_minutes: minutes,
            source: "manual",
          },
        });
        toast.success("Horas lançadas");
      }
      qc.invalidateQueries({ queryKey: ["time-entries"] });
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
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Lançar horas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar registro" : "Lançar horas manualmente"}</DialogTitle>
          <DialogDescription>
            Informe a duração diretamente ou o intervalo de início e fim.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <Select
                  value={clientId}
                  onValueChange={(v) => {
                    setClientId(v);
                    setTicketId(ALL);
                    setEntryContractId(ALL);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chamado (opcional)</Label>
                <Select value={ticketId} onValueChange={setTicketId} disabled={!clientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Nenhum</SelectItem>
                    {clientTickets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {formatTicketNumber(t.ticket_number)} — {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Contrato</Label>
            <Select
              value={entryContractId}
              onValueChange={setEntryContractId}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Sem contrato</SelectItem>
                {dialogContracts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.active ? "" : " (inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duração (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex.: 90"
            />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              rows={2}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Lançar horas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
