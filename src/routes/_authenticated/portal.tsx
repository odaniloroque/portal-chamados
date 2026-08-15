import { createFileRoute, Link, useNavigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { cn } from "@/lib/utils";
import { formatTicketNumber } from "@/lib/ticket-number";
import { RelativeTime } from "@/lib/relative-time";
import { PriorityBadge } from "@/lib/priority-badge";
import { TicketDashboard, TicketMiniStats } from "@/components/ticket-dashboard";
import { NotificationBell } from "@/components/notification-bell";


import { getMySession } from "@/lib/session.functions";
import { listMyTickets, createTicket } from "@/lib/tickets.functions";
import { listMyContracts, listContractAssets } from "@/lib/contracts.functions";
import {
  isRental,
  serviceTypeOptions,
  SERVICE_TYPE_LABELS,
  TONER_COLORS,
} from "@/lib/contract-labels";

import {
  ClientGroupHeader,
  ContractGroupHeader,
  groupTicketsByClientAndContract,
  useCollapsedGroups,
} from "@/components/tickets-by-contract";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  Plus,
  Loader2,
  Ticket as TicketIcon,
  ShieldCheck,
  ArrowLeft,
  Building2,
  FileText,
  Trash2,
  Search,
  KeyRound,
  ChevronDown,
  KanbanSquare,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { changeMyPassword } from "@/lib/account.functions";

const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getMySession(),
});
const myTicketsQuery = queryOptions({
  queryKey: ["my-tickets"],
  queryFn: () => listMyTickets(),
});

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Portal do cliente — Projetus Tech" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(sessionQuery),
      context.queryClient.ensureQueryData(myTicketsQuery),
    ]);
  },
  component: PortalLayout,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Não foi possível carregar o portal</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Erro ao carregar seus dados."}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Tentar novamente
          </button>
          <Link to="/cliente" className="px-4 py-2 rounded-md border text-sm">
            Sair
          </Link>
        </div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <Link to="/portal" className="underline">Voltar ao portal</Link>
    </div>
  ),
});

const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};
const priorityVariant: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-amber-100 text-amber-800",
  critica: "bg-red-100 text-red-700",
};
export const statusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  respondido_cliente: "Respondido pelo cliente",
  em_desenvolvimento: "Em desenvolvimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
export const statusVariant: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-700",
  em_andamento: "bg-amber-100 text-amber-800",
  aguardando_cliente: "bg-purple-100 text-purple-700",
  respondido_cliente: "bg-cyan-100 text-cyan-700",
  em_desenvolvimento: "bg-orange-100 text-orange-700",
  resolvido: "bg-green-100 text-green-700",
  fechado: "bg-slate-200 text-slate-700",
};


function PortalLayout() {
  const navigate = useNavigate();
  const { data: session } = useSuspenseQuery(sessionQuery);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/cliente" });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Site Projetus
          </Link>
          <div className="flex items-center gap-2">
            {session.isStaff && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4" />{" "}
                  {session.isAdmin ? "Painel Admin" : "Painel de Atendimento"}
                </Link>
              </Button>
            )}
            {(session.isAdmin || session.isDev) && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dev">
                  <KanbanSquare className="mr-2 h-4 w-4" /> Desenvolvimento
                </Link>
              </Button>
            )}
            <NotificationBell emailEnabled={session.profile?.email_notifications ?? true} />
            <ProfileMenu
              name={session.profile?.full_name ?? null}
              email={session.profile?.email ?? null}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          }
        >
          <PortalContent />
        </Suspense>
        <Outlet />
      </main>
    </div>
  );
}

function PortalContent() {
  const navigate = useNavigate();
  const { data: session } = useSuspenseQuery(sessionQuery);

  const { data: tickets } = useSuspenseQuery(myTicketsQuery);
  const profile = session.profile;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [sortDesc, setSortDesc] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [groupByContract, setGroupByContract] = useState(true);
  const { isCollapsed, toggle } = useCollapsedGroups();



  const term = search.trim().toLowerCase();
  const closedCount = (tickets as any[]).filter((t) => t.status === "fechado").length;
  const filteredTickets = (tickets as any[]).filter((t) => {
    if (!showClosed && statusFilter !== "fechado" && t.status === "fechado") return false;
    if (statusFilter !== "todos" && t.status !== statusFilter) return false;
    if (priorityFilter !== "todas" && t.priority !== priorityFilter) return false;
    if (!term) return true;
    return (
      String(t.title ?? "").toLowerCase().includes(term) ||
      String(t.description ?? "").toLowerCase().includes(term) ||
      formatTicketNumber(t.ticket_number).toLowerCase().includes(term)
    );
  }).sort((a, b) =>
    sortDesc
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const hasFilters = term !== "" || statusFilter !== "todos" || priorityFilter !== "todas";


  // Etapa 10: sinaliza chamados semelhantes do mesmo usuário em até 24h
  const duplicateIds = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  (tickets as any[]).forEach((a) => {
    (tickets as any[]).forEach((b) => {
      if (a.id === b.id) return;
      if (norm(String(a.title ?? "")) !== norm(String(b.title ?? ""))) return;
      const diff = Math.abs(
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      if (diff <= 24 * 60 * 60 * 1000) duplicateIds.add(a.id);
    });
  });

  const clientGroups = groupTicketsByClientAndContract(filteredTickets);
  const hasMultipleClients = clientGroups.length > 1;
  const hasMultipleContracts =
    hasMultipleClients || clientGroups.some((c) => c.contracts.length > 1);

  const renderRow = (t: any) => (
    <tr
      key={t.id}
      onClick={() => navigate({ to: "/portal/chamado/$id", params: { id: t.id } })}
      className="cursor-pointer border-b last:border-0 transition-colors duration-[250ms] hover:bg-muted/50"
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-primary">
        {formatTicketNumber(t.ticket_number)}
      </td>
      <td className="max-w-[380px] px-4 py-3">
        <span className="block truncate font-medium">{t.title}</span>
        {session.isStaff && t.profiles && (
          <span className="block truncate text-xs text-muted-foreground">
            {t.profiles.company_name || t.profiles.full_name}
          </span>
        )}
        {duplicateIds.has(t.id) && (
          <Badge
            variant="outline"
            className="mt-1 border-dashed border-amber-400 bg-transparent text-[10px] font-normal text-amber-700"
          >
            Possível duplicado
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge className={statusVariant[t.status]}>{statusLabel[t.status]}</Badge>
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={t.priority} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
        <RelativeTime value={t.updated_at ?? t.created_at} />
      </td>
    </tr>
  );

  const renderCard = (t: any) => (
    <Link key={t.id} to="/portal/chamado/$id" params={{ id: t.id }} className="block">
      <Card className="rounded-2xl transition-all duration-[250ms] hover:border-primary/50 hover:shadow-md">
        <CardContent className="space-y-2 py-4">
          <p className="font-medium">
            <span className="mr-2 font-mono text-xs text-primary">
              {formatTicketNumber(t.ticket_number)}
            </span>
            {t.title}
          </p>
          {session.isStaff && t.profiles && (
            <p className="truncate text-xs text-muted-foreground">
              {t.profiles.company_name || t.profiles.full_name}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusVariant[t.status]}>{statusLabel[t.status]}</Badge>
            <PriorityBadge priority={t.priority} />
          </div>
          <p className="text-xs text-muted-foreground">
            <RelativeTime value={t.updated_at ?? t.created_at} />
          </p>
        </CardContent>
      </Card>
    </Link>
  );


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá, {profile?.full_name?.split(" ")[0] ?? "cliente"}
        </h1>
        <p className="text-muted-foreground">Gerencie seus chamados e visualize seu contrato.</p>
      </div>

      {profile && (() => {
        const hasCompany = Boolean(
          profile.company_name || profile.cnpj || profile.address || profile.phone,
        );
        const hasContract = Boolean(
          profile.contract_plan ||
            profile.contract_number ||
            profile.contract_start ||
            profile.contract_end,
        );
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" /> Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {hasCompany ? (
                  <>
                    {profile.company_name && <p className="font-medium">{profile.company_name}</p>}
                    {profile.cnpj && <p className="text-muted-foreground">CNPJ: {profile.cnpj}</p>}
                    {profile.address && <p className="text-muted-foreground">{profile.address}</p>}
                    {profile.phone && <p className="text-muted-foreground">{profile.phone}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Dados da empresa ainda não cadastrados. Solicite a atualização à equipe Projetus.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" /> Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {hasContract ? (
                  <>
                    <p className="font-medium">
                      {profile.contract_plan ?? "Plano não definido"}
                      {profile.contract_number && (
                        <span className="ml-2 text-muted-foreground">
                          #{profile.contract_number}
                        </span>
                      )}
                    </p>
                    {(profile.contract_start || profile.contract_end) && (
                      <p className="text-muted-foreground">
                        Início: {profile.contract_start ?? "—"} · Vencimento:{" "}
                        {profile.contract_end ?? "—"}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhum contrato vinculado a esta conta. Fale com a equipe Projetus.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <TicketDashboard
        tickets={tickets as any[]}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
      />



      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Meus chamados</h2>
        <NewTicketDialog />
      </div>

      {tickets.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, título ou descrição"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(statusLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas prioridades</SelectItem>
              {Object.entries(priorityLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSortDesc((v) => !v)}
            title="Inverter ordenação"
          >
            {sortDesc ? "Mais recentes" : "Mais antigos"}
          </Button>
          {closedCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                id="show-closed"
                checked={showClosed}
                onCheckedChange={setShowClosed}
              />
              <Label htmlFor="show-closed" className="cursor-pointer text-sm whitespace-nowrap">
                Mostrar fechados ({closedCount})
              </Label>
            </div>
          )}
          {hasMultipleContracts && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                id="group-contract"
                checked={groupByContract}
                onCheckedChange={setGroupByContract}
              />
              <Label htmlFor="group-contract" className="cursor-pointer text-sm whitespace-nowrap">
                Agrupar por cliente e contrato
              </Label>
            </div>
          )}




          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
                setPriorityFilter("todas");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      )}

      {tickets.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted">
              <TicketIcon className="h-6 w-6" />
            </span>
            {session.isTecnico && !session.isAdmin ? (
              <>
                <p className="font-medium text-foreground">
                  Nenhum chamado nos seus contratos.
                </p>
                <p className="text-sm">
                  Se você deveria ver chamados aqui, peça ao administrador para atribuir os
                  contratos ao seu usuário.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  Você ainda não abriu nenhum chamado.
                </p>
                <p className="text-sm">Clique em “Novo chamado” para solicitar atendimento.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Search className="h-8 w-8" />
            <p>Nenhum chamado encontrado com os filtros aplicados.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabela (desktop / notebook) */}
          <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nº</th>
                    <th className="px-4 py-3 font-medium">Título</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Prioridade</th>
                    <th className="px-4 py-3 font-medium">Última atualização</th>
                  </tr>
                </thead>
                {groupByContract && hasMultipleContracts ? (
                  clientGroups.map((cg) => (
                    <tbody key={cg.key}>
                      {hasMultipleClients && (
                        <tr className="border-b bg-primary/5">
                          <td colSpan={5} className="px-2 py-2">
                            <ClientGroupHeader
                              label={cg.label}
                              count={cg.items.length}
                              collapsed={isCollapsed(cg.key)}
                              onToggle={() => toggle(cg.key)}
                            />
                          </td>
                        </tr>
                      )}
                      {(!hasMultipleClients || !isCollapsed(cg.key)) &&
                        cg.contracts.map((g) => (
                          <Fragment key={g.key}>
                            <tr className="border-b bg-muted/20">
                              <td colSpan={5} className={cn("px-2 py-2", hasMultipleClients && "pl-6")}>
                                <ContractGroupHeader
                                  label={g.label}
                                  count={g.items.length}
                                  collapsed={isCollapsed(g.key)}
                                  onToggle={() => toggle(g.key)}
                                />
                              </td>
                            </tr>
                            {!isCollapsed(g.key) && g.items.map((t: any) => renderRow(t))}
                          </Fragment>
                        ))}
                    </tbody>
                  ))
                ) : (
                  <tbody>{filteredTickets.map((t: any) => renderRow(t))}</tbody>
                )}
              </table>
            </div>
          </Card>

          {/* Cards (mobile) */}
          <div className="grid gap-3 md:hidden">
            {groupByContract && hasMultipleContracts
              ? clientGroups.map((cg) => (
                  <div key={cg.key} className="space-y-3">
                    {hasMultipleClients && (
                      <ClientGroupHeader
                        label={cg.label}
                        count={cg.items.length}
                        collapsed={isCollapsed(cg.key)}
                        onToggle={() => toggle(cg.key)}
                      />
                    )}
                    {(!hasMultipleClients || !isCollapsed(cg.key)) && (
                      <div
                        className={cn(
                          "space-y-3",
                          hasMultipleClients && "ml-2 border-l-2 border-muted pl-4",
                        )}
                      >
                        {cg.contracts.map((g) => (
                          <div key={g.key} className="space-y-3">
                            <ContractGroupHeader
                              label={g.label}
                              count={g.items.length}
                              collapsed={isCollapsed(g.key)}
                              onToggle={() => toggle(g.key)}
                            />
                            {!isCollapsed(g.key) && g.items.map((t: any) => renderCard(t))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              : filteredTickets.map((t: any) => renderCard(t))}
          </div>


          <TicketMiniStats tickets={tickets as any[]} />
        </>
      )}


    </div>
  );
}

type CustomField = { label: string; value: string };

function NewTicketDialog() {
  const qc = useQueryClient();
  const create = useServerFn(createTicket);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [contractId, setContractId] = useState("");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [assetId, setAssetId] = useState("");
  const [tonerColor, setTonerColor] = useState("preto");
  const [tonerQty, setTonerQty] = useState("1");

  const { data: contracts = [] } = useQuery({
    queryKey: ["my-contracts"],
    queryFn: () => listMyContracts(),
    enabled: open,
  });

  const effectiveContractId =
    contractId || (contracts.length === 1 ? (contracts[0] as any).id : "");
  const selectedContract = contracts.find((c: any) => c.id === effectiveContractId) as any;
  const rental = isRental(selectedContract?.billing_type);
  const svcOptions = serviceTypeOptions(selectedContract?.billing_type);

  const { data: assets = [] } = useQuery({
    queryKey: ["contract-assets", effectiveContractId],
    queryFn: () => listContractAssets({ data: { contractId: effectiveContractId, onlyActive: true } }),
    enabled: open && rental && !!effectiveContractId,
  });

  function updateField(index: number, patch: Partial<CustomField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const filled = fields.filter((f) => f.label.trim() !== "" || f.value.trim() !== "");
    const incomplete = filled.some((f) => f.label.trim() === "" || f.value.trim() === "");
    if (incomplete) {
      toast.error("Preencha o rótulo e o valor de todas as informações adicionais.");
      return;
    }

    if (contracts.length > 1 && !contractId) {
      toast.error("Selecione o contrato deste chamado.");
      return;
    }

    if (rental) {
      if (!serviceType) {
        toast.error("Selecione o tipo de solicitação.");
        return;
      }
      if (!assetId) {
        toast.error("Selecione o equipamento.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await create({
        data: {
          title,
          description,
          priority: priority as any,
          contract_id: contractId || null,
          custom_fields: filled.map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
          service_type: rental ? (serviceType as any) : null,
          asset_id: rental ? assetId : null,
          toner_color: rental && serviceType === "toner" ? (tonerColor as any) : null,
          toner_qty:
            rental && serviceType === "toner" ? Math.max(1, Number(tonerQty) || 1) : null,
        },
      });
      toast.success(`Chamado ${formatTicketNumber(res?.ticket_number)} aberto!`);
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("media");
      setContractId("");
      setServiceType("");
      setAssetId("");
      setTonerColor("preto");
      setTonerQty("1");
      setFields([]);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }



  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo chamado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir novo chamado</DialogTitle>
          <DialogDescription>
            Descreva o problema. Nossa equipe será notificada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {contracts.length > 1 && (
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.contract_number ? ` · #${c.contract_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {rental && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-2">
                <Label>Tipo de solicitação</Label>
                <Select
                  value={serviceType}
                  onValueChange={(v) => {
                    setServiceType(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {svcOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SERVICE_TYPE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Equipamento</Label>
                {assets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum equipamento cadastrado neste contrato. Fale com o suporte para
                    cadastrar o parque.
                  </p>
                ) : (
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o equipamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.location ? ` · ${a.location}` : ""}
                          {a.serial ? ` · SN ${a.serial}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {serviceType === "toner" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cor do toner</Label>
                    <Select value={tonerColor} onValueChange={setTonerColor}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONER_COLORS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      value={tonerQty}
                      inputMode="numeric"
                      onChange={(e) => setTonerQty(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={150}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={5}
              maxLength={4000}
              rows={5}
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label className="text-sm">Informações adicionais</Label>
                <p className="text-xs text-muted-foreground">
                  Opcional. Crie seus próprios campos, ex.: “Nº da OS”, “Placa”, “Setor”.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFields((prev) => [...prev, { label: "", value: "" }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar campo
              </Button>
            </div>

            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      placeholder="Rótulo"
                      value={f.label}
                      maxLength={120}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      className="sm:w-2/5"
                    />
                    <Input
                      placeholder="Valor"
                      value={f.value}
                      maxLength={500}
                      onChange={(e) => updateField(i, { value: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover campo"
                      onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir chamado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string | null, email: string | null) {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function ProfileMenu({
  name,
  email,
  onLogout,
}: {
  name: string | null;
  email: string | null;
  onLogout: () => void;
}) {
  const [pwdOpen, setPwdOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Menu do perfil"
            className="flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 transition hover:bg-slate-50"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(name, email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[10rem] truncate text-sm sm:inline">
              {name ?? email}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{name ?? "Minha conta"}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPwdOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" /> Alterar senha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const change = useServerFn(changeMyPassword);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (pwd !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await change({ data: { password: pwd } });
      setPwd("");
      setConfirm("");
      onOpenChange(false);
      toast.success("Senha alterada com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Alterar senha
          </DialogTitle>
          <DialogDescription>Defina uma nova senha de acesso ao portal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nova senha</Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
