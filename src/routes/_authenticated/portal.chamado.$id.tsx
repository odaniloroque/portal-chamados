import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, Suspense } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { formatTicketNumber } from "@/lib/ticket-number";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SERVICE_TYPE_LABELS, TONER_COLOR_LABELS } from "@/lib/contract-labels";


import {
  getTicket,
  addTicketUpdate,
  registerAttachment,
  updateTicketPriority,
  updateTicketContract,
  closeTicketByClient,
} from "@/lib/tickets.functions";
import { listContracts } from "@/lib/contracts.functions";
import { getMySession } from "@/lib/session.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Send, Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { statusLabel, statusVariant } from "./portal";
import { RelativeTime } from "@/lib/relative-time";
import { PriorityBadge, priorityLabel } from "@/lib/priority-badge";
import { TicketTimer } from "@/components/ticket-timer";
import { ParentSubticketsCard } from "@/components/subticket-dialog";


function isImage(a: { mime_type?: string | null; file_name?: string | null; url?: string | null }) {
  if (!a.url) return false;
  if (a.mime_type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(a.file_name ?? "");
}


const ticketQuery = (id: string) =>
  queryOptions({ queryKey: ["ticket", id], queryFn: () => getTicket({ data: { id } }) });
const sessionQuery = queryOptions({ queryKey: ["session"], queryFn: () => getMySession() });

export const Route = createFileRoute("/_authenticated/portal/chamado/$id")({
  head: () => ({ meta: [{ title: "Chamado — Projetus Tech" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ticketQuery(params.id)),
      context.queryClient.ensureQueryData(sessionQuery),
    ]);
  },
  component: TicketDetailPage,
});

function TicketDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <TicketDetail />
    </Suspense>
  );
}

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(ticketQuery(id));
  const { data: session } = useSuspenseQuery(sessionQuery);
  const addUpdate = useServerFn(addTicketUpdate);
  const regAttach = useServerFn(registerAttachment);
  const setPriority = useServerFn(updateTicketPriority);
  const closeByClient = useServerFn(closeTicketByClient);
  const { ticket, updates, attachments } = data;

  const [message, setMessage] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);

  async function changePriority(value: string) {
    if (value === ticket.priority) return;
    setSavingPriority(true);
    try {
      await setPriority({ data: { ticket_id: id, priority: value as any } });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
      toast.success("Prioridade atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar prioridade");
    } finally {
      setSavingPriority(false);
    }
  }

  const setContract = useServerFn(updateTicketContract);
  const [savingContract, setSavingContract] = useState(false);
  const { data: clientContracts = [] } = useQuery({
    queryKey: ["contracts", ticket.user_id],
    queryFn: () => listContracts({ data: { clientId: ticket.user_id } }),
    enabled: !!session.isAdmin,
  });

  async function changeContract(value: string) {
    const next = value === "none" ? null : value;
    if (next === (ticket.contract_id ?? null)) return;
    setSavingContract(true);
    try {
      await setContract({ data: { ticket_id: id, contract_id: next } });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Contrato atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar contrato");
    } finally {
      setSavingContract(false);
    }
  }

  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  async function uploadFile(file: File) {
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("ticket-attachments")
      .upload(path, file, { contentType: file.type });
    if (upErr) throw upErr;
    await regAttach({
      data: {
        ticket_id: id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      },
    });
  }

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" é maior que 20 MB`);
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !newStatus && pendingFiles.length === 0) {
      toast.error("Escreva uma mensagem, anexe um arquivo ou mude o status");
      return;
    }
    setPosting(true);
    try {
      if (message.trim() || newStatus) {
        await addUpdate({
          data: {
            ticket_id: id,
            message: message.trim() || null,
            new_status: (newStatus || null) as any,
          },
        });
      }
      for (const f of pendingFiles) await uploadFile(f);
      setMessage("");
      setNewStatus("");
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
      toast.success("Atualização registrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPosting(false);
    }
  }

  async function reopenTicket() {
    setPosting(true);
    try {
      await addUpdate({
        data: { ticket_id: id, message: "Chamado reaberto.", new_status: "aberto" as any },
      });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
      toast.success("Chamado reaberto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPosting(false);
    }
  }

  const canClientClose =
    !session.isStaff && ticket.user_id === session.userId && ticket.status === "resolvido";

  async function closeTicket() {
    setPosting(true);
    try {
      await closeByClient({ data: { ticket_id: id } });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
      toast.success("Chamado fechado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fechar chamado");
    } finally {
      setPosting(false);
    }
  }


  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo maior que 20 MB");
      return;
    }
    setUploading(true);
    try {
      await uploadFile(file);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      toast.success("Anexo enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }


  const backTo = session.isStaff ? "/admin" : "/portal";

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate({ to: backTo })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-xl">
              <span className="mr-2 font-mono text-sm text-primary">
                {formatTicketNumber(ticket.ticket_number)}
              </span>
              {ticket.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              <RelativeTime value={ticket.created_at} prefix="Aberto" />
              {ticket.profiles && ` · ${ticket.profiles.full_name} (${ticket.profiles.company_name ?? ticket.profiles.email})`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status do chamado
            </span>
            <Badge className={statusVariant[ticket.status]}>{statusLabel[ticket.status]}</Badge>
            {session.isStaff ? (
              <div className="mt-1 flex items-center gap-2">
                <PriorityBadge priority={ticket.priority} />
                <Select
                  value={ticket.priority}
                  onValueChange={changePriority}
                  disabled={savingPriority}
                >
                  <SelectTrigger className="h-8 w-36" aria-label="Alterar prioridade">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <PriorityBadge priority={ticket.priority} />
            )}
          </div>

        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contrato
            </span>
            {session.isAdmin ? (
              <Select
                value={ticket.contract_id ?? "none"}
                onValueChange={changeContract}
                disabled={savingContract}
              >
                <SelectTrigger className="h-8 w-full sm:w-72" aria-label="Alterar contrato">
                  <SelectValue placeholder="Sem contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem contrato</SelectItem>
                  {clientContracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.contract_number ? ` · #${c.contract_number}` : ""}
                      {c.active ? "" : " (inativo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm">
                {ticket.contract?.name ?? "Sem contrato"}
                {ticket.contract?.contract_number ? ` · #${ticket.contract.contract_number}` : ""}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
          {(ticket.service_type || ticket.asset) && (
            <div className="rounded-lg border bg-muted/30">
              <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados do contrato de locação
              </p>
              <dl className="divide-y">
                {ticket.service_type && (
                  <div className="flex gap-3 px-3 py-2 text-sm">
                    <dt className="w-40 shrink-0 text-muted-foreground">Solicitação</dt>
                    <dd>{SERVICE_TYPE_LABELS[ticket.service_type] ?? ticket.service_type}</dd>
                  </div>
                )}
                {ticket.asset && (
                  <div className="flex gap-3 px-3 py-2 text-sm">
                    <dt className="w-40 shrink-0 text-muted-foreground">Equipamento</dt>
                    <dd>
                      {ticket.asset.name}
                      {ticket.asset.location ? ` · ${ticket.asset.location}` : ""}
                      {ticket.asset.serial ? ` · SN ${ticket.asset.serial}` : ""}
                    </dd>
                  </div>
                )}
                {ticket.toner_color && (
                  <div className="flex gap-3 px-3 py-2 text-sm">
                    <dt className="w-40 shrink-0 text-muted-foreground">Toner</dt>
                    <dd>
                      {TONER_COLOR_LABELS[ticket.toner_color] ?? ticket.toner_color}
                      {ticket.toner_qty ? ` · ${ticket.toner_qty} un.` : ""}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {Array.isArray(ticket.custom_fields) && ticket.custom_fields.length > 0 && (
            <div className="rounded-lg border bg-muted/30">
              <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informações adicionais
              </p>
              <dl className="divide-y">
                {ticket.custom_fields.map((f: any, i: number) => {
                  const isInternalStatus = /status|situa[cç][aã]o/i.test(String(f.label ?? ""));
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4"
                    >
                      <dt className="text-xs font-medium text-muted-foreground sm:w-2/5 sm:shrink-0">
                        {f.label}
                      </dt>
                      <dd className="break-words text-sm">
                        {isInternalStatus ? (
                          <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {f.value}
                          </span>
                        ) : (
                          f.value
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {ticket.custom_fields.some((f: any) =>
                /status|situa[cç][aã]o/i.test(String(f?.label ?? "")),
              ) && (
                <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                  Campos informados pelo cliente. Não alteram o status do chamado.
                </p>
              )}
            </div>
          )}

        </CardContent>

      </Card>

      {session.isAdmin && ticket.profiles && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <InfoRow label="Responsável" value={ticket.profiles.full_name} />
            <InfoRow label="E-mail" value={ticket.profiles.email} />
            <InfoRow label="Empresa" value={ticket.profiles.company_name} />
            <InfoRow label="CNPJ" value={ticket.profiles.cnpj} />
            <InfoRow label="Telefone" value={ticket.profiles.phone} />
            <InfoRow label="Endereço" value={ticket.profiles.address} />
            <InfoRow label="Nº do contrato" value={ticket.profiles.contract_number} />
            <InfoRow label="Plano" value={ticket.profiles.contract_plan} />
            <InfoRow
              label="Vigência"
              value={
                ticket.profiles.contract_start || ticket.profiles.contract_end
                  ? `${ticket.profiles.contract_start ?? "—"} até ${ticket.profiles.contract_end ?? "—"}`
                  : null
              }
            />
          </CardContent>
        </Card>
      )}

      {session.isStaff && <TicketTimer ticketId={ticket.id} clientId={ticket.user_id} />}

      {(session.isAdmin || session.isDev) &&
        !ticket.parent_ticket_id &&
        ticket.status === "em_desenvolvimento" && (
          <ParentSubticketsCard parentTicketId={ticket.id} />
        )}


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anexos ({attachments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attachments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
          )}
          {attachments.filter((a: any) => isImage(a)).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {attachments
                .filter((a: any) => isImage(a))
                .map((a: any) => (
                  <a
                    key={a.id}
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-md border"
                    title={a.file_name}
                  >
                    <img
                      src={a.url ?? ""}
                      alt={a.file_name}
                      loading="lazy"
                      className="h-32 w-full bg-muted object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="block truncate border-t px-2 py-1 text-xs text-muted-foreground">
                      {a.file_name}
                    </span>
                  </a>
                ))}
            </div>
          )}
          {attachments
            .filter((a: any) => !isImage(a))
            .map((a: any) => (
              <a
                key={a.id}
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" /> {a.file_name}
                </span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
              <Paperclip className="h-4 w-4" />
              {uploading ? "Enviando..." : "Adicionar anexo"}
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {updates.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma atualização ainda.</p>
          )}
          {updates.map((u: any) => (
            <div key={u.id} className="border-l-2 border-primary/30 pl-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{u.author_name}</span>
                {u.author_is_admin && (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    Suporte
                  </Badge>
                )}{" "}
                · <RelativeTime value={u.created_at} />
              </p>
              {u.status_to && (
                <div className="mt-1 text-xs">
                  Status alterado:{" "}
                  <Badge className={statusVariant[u.status_from]}>{statusLabel[u.status_from]}</Badge>{" "}
                  → <Badge className={statusVariant[u.status_to]}>{statusLabel[u.status_to]}</Badge>
                </div>

              )}
              {u.message && <p className="mt-1 whitespace-pre-wrap text-sm">{u.message}</p>}
            </div>
          ))}

          {ticket.status === "fechado" ? (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Este chamado está <strong>fechado</strong>. Não é possível enviar novas mensagens ou
                anexos.
              </p>
              {session.isStaff ? (
                <Button type="button" variant="outline" onClick={reopenTicket} disabled={posting}>
                  {posting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Reabrir chamado
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Precisa de mais ajuda? Abra um novo chamado no portal.
                </p>
              )}
            </div>
          ) : (
          <>
          {canClientClose && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm">
                Este chamado foi marcado como <strong>Resolvido</strong>. Se não houver mais nada a
                fazer, você pode encerrá-lo.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" disabled={posting}>
                    {posting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Fechar chamado
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fechar este chamado?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O chamado será encerrado e não poderá mais receber novas mensagens. Só a
                      equipe de suporte poderá reabri-lo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={closeTicket}>Fechar chamado</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </div>
          )}
          <form onSubmit={postUpdate} className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Nova mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Adicione informações, dúvidas ou uma resposta..."
              />
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
                <Paperclip className="h-4 w-4" /> Anexar arquivo
                <input type="file" multiple className="hidden" onChange={pickFiles} />
              </label>
              {pendingFiles.length > 0 && (
                <ul className="space-y-1">
                  {pendingFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {session.isStaff && (
              <div className="space-y-2">
                <Label>Alterar status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="(não alterar)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
                    <SelectItem value="respondido_cliente">Respondido pelo cliente</SelectItem>
                    <SelectItem value="em_desenvolvimento">Em desenvolvimento</SelectItem>

                    <SelectItem value="resolvido">Resolvido</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={posting}>
              {posting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar atualização
            </Button>
          </form>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words">{value || "—"}</span>
    </div>
  );
}
