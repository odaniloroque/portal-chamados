import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { cn } from "@/lib/utils";
import { formatTicketNumber } from "@/lib/ticket-number";
import { getMySession } from "@/lib/session.functions";
import {
  listClients,
  createClient as createClientFn,
  updateClient,
  deleteClient,
  setClientPassword,
  setClientActive,
  listTechnicians,
  createTechnician,
  updateTechnician,
} from "@/lib/clients.functions";
import { listAllTickets } from "@/lib/tickets.functions";
import {
  TechnicianContractsDialog,
  TechnicianContractsSummary,
} from "@/components/technician-contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  LogOut,
  Loader2,
  Plus,
  Users,
  Ticket as TicketIcon,
  ShieldCheck,
  Trash2,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Wrench,
  KanbanSquare,
} from "lucide-react";
import { toast } from "sonner";
import { statusLabel, statusVariant } from "./portal";

const sessionQuery = queryOptions({ queryKey: ["session"], queryFn: () => getMySession() });
const clientsQuery = queryOptions({ queryKey: ["clients"], queryFn: () => listClients() });
const techniciansQuery = queryOptions({
  queryKey: ["technicians"],
  queryFn: () => listTechnicians(),
});
const allTicketsQuery = queryOptions({
  queryKey: ["all-tickets"],
  queryFn: () => listAllTickets(),
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — Projetus Tech" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session.isStaff) throw redirect({ to: "/portal" });
    await context.queryClient.ensureQueryData(allTicketsQuery);
    if (session.isAdmin) {
      await Promise.all([
        context.queryClient.ensureQueryData(clientsQuery),
        context.queryClient.ensureQueryData(techniciansQuery),
      ]);
    }
  },
  component: AdminPage,
});

import { PriorityBadge, priorityLabel } from "@/lib/priority-badge";
import { RelativeTime } from "@/lib/relative-time";
import { AdminHours } from "@/components/admin-hours";
import { ContractsDialog } from "@/components/client-contracts";
import { parseCurrency } from "@/lib/time-format";
import { Switch } from "@/components/ui/switch";
import {
  ClientGroupHeader,
  ContractGroupHeader,
  groupTicketsByClientAndContract,
  useCollapsedGroups,
} from "@/components/tickets-by-contract";



function AdminPage() {
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
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              {session.isAdmin ? (
                <>
                  <ShieldCheck className="h-3 w-3" /> Admin
                </>
              ) : (
                <>
                  <Wrench className="h-3 w-3" /> Técnico
                </>
              )}
            </Badge>
            {session.isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/portal">Portal Cliente</Link>
              </Button>
            )}
            {(session.isAdmin || session.isDev) && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dev">
                  <KanbanSquare className="mr-2 h-4 w-4" /> Desenvolvimento
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
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
          <AdminContent />
        </Suspense>
      </main>
    </div>
  );
}

function AdminContent() {
  const { data: session } = useSuspenseQuery(sessionQuery);
  const isAdmin = session.isAdmin;
  const { data: tickets } = useSuspenseQuery(allTicketsQuery);

  const openTickets = tickets.filter((t: any) =>
    ["aberto", "em_andamento", "aguardando_cliente", "respondido_cliente", "em_desenvolvimento"].includes(t.status),
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isAdmin ? "Painel Administrativo" : "Painel de Atendimento"}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Gerencie clientes, contratos e chamados."
            : "Acompanhe e atenda os chamados dos clientes."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && <AdminClientStats />}
        <StatCard label="Chamados abertos" value={openTickets} icon={<TicketIcon className="h-5 w-5" />} />
        <StatCard label="Total de chamados" value={tickets.length} icon={<TicketIcon className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Chamados</TabsTrigger>
          {isAdmin && <TabsTrigger value="clients">Clientes</TabsTrigger>}
          {isAdmin && <TabsTrigger value="team">Equipe</TabsTrigger>}
          {isAdmin && <TabsTrigger value="hours">Horas</TabsTrigger>}
        </TabsList>
        {isAdmin && (
          <TabsContent value="hours" className="mt-4">
            <AdminHoursTab tickets={tickets} />
          </TabsContent>
        )}
        <TabsContent value="tickets" className="mt-4 space-y-3">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {isAdmin
                  ? "Nenhum chamado registrado."
                  : "Nenhum chamado disponível. Peça ao administrador para liberar os contratos que você atende."}
              </CardContent>
            </Card>
          ) : (
            <AdminTicketsList tickets={tickets as any[]} />
          )}

        </TabsContent>

        {isAdmin && (
          <TabsContent value="clients" className="mt-4 space-y-3">
            <ClientsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="team" className="mt-4 space-y-3">
            <TeamTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AdminTicketsList({ tickets }: { tickets: any[] }) {
  const [groupByContract, setGroupByContract] = useState(true);
  const { isCollapsed, toggle } = useCollapsedGroups();
  const clientGroups = groupTicketsByClientAndContract(tickets);
  const hasMultipleClients = clientGroups.length > 1;
  const hasMultipleContracts =
    hasMultipleClients || clientGroups.some((c) => c.contracts.length > 1);

  const renderCard = (t: any) => (
    <Link key={t.id} to="/portal/chamado/$id" params={{ id: t.id }} className="block">
      <Card className="transition hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">
              <span className="mr-2 font-mono text-xs text-primary">
                {formatTicketNumber(t.ticket_number)}
              </span>
              {t.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.profiles?.full_name}
              {t.profiles?.company_name && ` · ${t.profiles.company_name}`} ·{" "}
              <RelativeTime value={t.created_at} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={t.priority} />
            <Badge className={statusVariant[t.status]}>{statusLabel[t.status]}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-3">
      {hasMultipleContracts && (
        <div className="flex items-center gap-2">
          <Switch
            id="admin-group-contract"
            checked={groupByContract}
            onCheckedChange={setGroupByContract}
          />
          <Label htmlFor="admin-group-contract" className="cursor-pointer text-sm">
            Agrupar por cliente e contrato
          </Label>
        </div>
      )}
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
        : tickets.map((t: any) => renderCard(t))}
    </div>
  );
}


function AdminClientStats() {
  const { data: clients } = useSuspenseQuery(clientsQuery);
  return (
    <>
      <StatCard label="Clientes" value={clients.length} icon={<Users className="h-5 w-5" />} />
      <StatCard
        label="Clientes ativos"
        value={clients.filter((c: any) => c.active).length}
        icon={<ShieldCheck className="h-5 w-5" />}
      />
    </>
  );
}

function AdminHoursTab({ tickets }: { tickets: any[] }) {
  const { data: clients } = useSuspenseQuery(clientsQuery);
  return <AdminHours clients={clients} tickets={tickets} />;
}

function ClientsTab() {
  const { data: clients } = useSuspenseQuery(clientsQuery);
  return (
    <>
      <div className="flex justify-end">
        <ClientDialog />
      </div>
      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado.
          </CardContent>
        </Card>
      ) : (
        clients.map((c: any) => <ClientRow key={c.id} client={c} />)
      )}
    </>
  );
}

function TeamTab() {
  const { data: technicians } = useSuspenseQuery(techniciansQuery);
  return (
    <>
      <div className="flex justify-end">
        <TechnicianDialog />
      </div>
      {technicians.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum membro da equipe cadastrado. Cadastre técnicos de atendimento ou
            desenvolvedores.
          </CardContent>
        </Card>
      ) : (
        technicians.map((t: any) => <TechnicianRow key={t.id} tech={t} />)
      )}
    </>
  );
}

const staffRoleLabels: Record<string, string> = { tecnico: "Técnico", dev: "Desenvolvedor" };

function TechnicianDialog({ tech }: { tech?: any }) {
  const qc = useQueryClient();
  const create = useServerFn(createTechnician);
  const update = useServerFn(updateTechnician);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      if (tech) {
        await update({
          data: {
            id: tech.id,
            full_name: String(fd.get("full_name") ?? ""),
            phone: String(fd.get("phone") ?? "") || null,
            role: (String(fd.get("role") ?? "tecnico") as "tecnico" | "dev") ?? "tecnico",
          },
        });
        toast.success("Membro da equipe atualizado");
      } else {
        await create({
          data: {
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
            full_name: String(fd.get("full_name") ?? ""),
            phone: String(fd.get("phone") ?? "") || null,
            role: (String(fd.get("role") ?? "tecnico") as "tecnico" | "dev") ?? "tecnico",
          },
        });
        toast.success("Membro da equipe cadastrado");
      }
      qc.invalidateQueries({ queryKey: ["technicians"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {tech ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> Novo membro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tech ? "Editar membro da equipe" : "Cadastrar membro da equipe"}</DialogTitle>
          <DialogDescription>
            Técnicos atendem os chamados dos contratos atribuídos. Desenvolvedores atuam apenas nos
            subchamados de desenvolvimento. Nenhum dos dois acessa dados de contrato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" name="full_name" defaultValue={tech?.full_name ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Perfil de acesso</Label>
            <select
              id="role"
              name="role"
              defaultValue={tech?.role ?? "tecnico"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="tecnico">Técnico</option>
              <option value="dev">Desenvolvedor</option>
            </select>
          </div>
          {!tech && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha inicial</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" defaultValue={tech?.phone ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TechnicianRow({ tech }: { tech: any }) {
  const qc = useQueryClient();
  const toggleActive = useServerFn(setClientActive);
  const setPassword = useServerFn(setClientPassword);
  const del = useServerFn(deleteClient);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["technicians"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">
            {tech.full_name}{" "}
            <Badge variant="secondary" className="ml-1 text-xs">
              {staffRoleLabels[tech.role] ?? "Técnico"}
            </Badge>
            {!tech.active && (
              <Badge variant="outline" className="ml-1 text-xs">
                Inativo
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {tech.email}
            {tech.phone && ` · ${tech.phone}`}
          </p>
          {tech.role !== "dev" && (
            <div className="mt-1">
              <TechnicianContractsSummary technicianId={tech.id} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {tech.role !== "dev" && <TechnicianContractsDialog tech={tech} />}
          <TechnicianDialog tech={tech} />

          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              const pwd = prompt("Nova senha (mínimo 8 caracteres):");
              if (!pwd) return;
              run(() => setPassword({ data: { id: tech.id, password: pwd } }), "Senha atualizada");
            }}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => toggleActive({ data: { id: tech.id, active: !tech.active } }),
                tech.active ? "Técnico inativado" : "Técnico reativado",
              )
            }
          >
            {tech.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Excluir técnico "${tech.full_name}"?`)) return;
              run(() => del({ data: { id: tech.id } }), "Técnico excluído");
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-6">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function ClientRow({ client }: { client: any }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteClient);
  const toggleActive = useServerFn(setClientActive);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleDelete() {
    if (!confirm(`Excluir cliente "${client.full_name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await del({ data: { id: client.id } });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive() {
    const next = !client.active;
    if (
      !confirm(
        next
          ? `Reativar o acesso de "${client.full_name}"?`
          : `Inativar "${client.full_name}"? O cliente não conseguirá mais acessar o portal.`,
      )
    )
      return;
    setToggling(true);
    try {
      await toggleActive({ data: { id: client.id, active: next } });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(next ? "Cliente reativado" : "Cliente inativado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">
            {client.full_name}{" "}
            {!client.active && (
              <Badge variant="outline" className="ml-1 text-xs">
                Inativo
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {client.email}
            {client.company_name && ` · ${client.company_name}`}
            {client.contract_number && ` · Contrato #${client.contract_number}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PasswordDialog client={client} />
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={toggling}>
            {toggling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : client.active ? (
              <UserX className="mr-2 h-4 w-4" />
            ) : (
              <UserCheck className="mr-2 h-4 w-4" />
            )}
            {client.active ? "Inativar" : "Ativar"}
          </Button>
          <ContractsDialog client={client} />
          <ClientDialog client={client} />

          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordDialog({ client }: { client: any }) {
  const setPassword = useServerFn(setClientPassword);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwd, setPwd] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await setPassword({ data: { id: client.id, password: pwd } });
      setPwd("");
      setOpen(false);
      toast.success("Senha alterada. Informe a nova senha ao cliente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="mr-2 h-4 w-4" /> Senha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para {client.full_name}. Lembre-se de comunicá-la ao cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nova senha (mín. 8)</Label>
            <Input
              type="text"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientDialog({ client }: { client?: any }) {
  const qc = useQueryClient();
  const create = useServerFn(createClientFn);
  const update = useServerFn(updateClient);
  const isEdit = !!client;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: client?.email ?? "",
    password: "",
    full_name: client?.full_name ?? "",
    phone: client?.phone ?? "",
    company_name: client?.company_name ?? "",
    cnpj: client?.cnpj ?? "",
    address: client?.address ?? "",
    contract_number: client?.contract_number ?? "",
    contract_plan: client?.contract_plan ?? "",
    contract_start: client?.contract_start ?? "",
    contract_end: client?.contract_end ?? "",
    contract_value:
      client?.contract_value !== null && client?.contract_value !== undefined
        ? String(client.contract_value).replace(".", ",")
        : "",
    email_notifications: client?.email_notifications ?? true,
    whatsapp_notifications: client?.whatsapp_notifications ?? false,
    active: client?.active ?? true,
  });

  const [fields, setFields] = useState<{ label: string; value: string }[]>(
    Array.isArray(client?.custom_fields) ? client.custom_fields : [],
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const cleanFields = () =>
    fields.filter((f) => f.label.trim() !== "").map((f) => ({ label: f.label.trim(), value: f.value.trim() }));


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await update({
          data: {
            id: client.id,
            full_name: form.full_name,
            phone: form.phone || null,
            company_name: form.company_name || null,
            cnpj: form.cnpj || null,
            address: form.address || null,
            contract_number: form.contract_number || null,
            contract_plan: form.contract_plan || null,
            contract_start: form.contract_start || null,
            contract_end: form.contract_end || null,
            contract_value: parseCurrency(form.contract_value),
            custom_fields: cleanFields(),
            email_notifications: form.email_notifications,
            whatsapp_notifications: form.whatsapp_notifications,
            active: form.active,
          },
        });

        toast.success("Cliente atualizado");
      } else {
        await create({
          data: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || null,
            company_name: form.company_name || null,
            cnpj: form.cnpj || null,
            address: form.address || null,
            contract_number: form.contract_number || null,
            contract_plan: form.contract_plan || null,
            contract_start: form.contract_start || null,
            contract_end: form.contract_end || null,
            contract_value: parseCurrency(form.contract_value),
            custom_fields: cleanFields(),
            email_notifications: form.email_notifications,
            whatsapp_notifications: form.whatsapp_notifications,
          },
        });
        toast.success("Cliente cadastrado. Envie a senha ao cliente.");
      }
      qc.invalidateQueries({ queryKey: ["clients"] });
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
            <Plus className="mr-2 h-4 w-4" /> Novo cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do cliente."
              : "Preencha os dados. Uma conta será criada e o cliente poderá acessar com o e-mail e senha definidos."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {!isEdit && (
            <>
              <Field label="E-mail" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </Field>
              <Field label="Senha (mín. 8)" required>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  minLength={8}
                  required
                />
              </Field>
            </>
          )}
          <Field label="Nome completo" required>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Telefone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Razão social / Empresa">
            <Input
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              maxLength={150}
            />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} maxLength={20} />
          </Field>
          <Field label="Endereço" className="md:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              maxLength={300}
            />
          </Field>
          <Field label="Nº do contrato">
            <Input
              value={form.contract_number}
              onChange={(e) => set("contract_number", e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Plano">
            <Input
              value={form.contract_plan}
              onChange={(e) => set("contract_plan", e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="Valor do contrato (R$)">
            <Input
              inputMode="decimal"
              placeholder="Ex.: 2.500,00"
              value={form.contract_value}
              onChange={(e) => set("contract_value", e.target.value)}
            />
          </Field>

          <Field label="Início do contrato">
            <Input
              type="date"
              value={form.contract_start}
              onChange={(e) => set("contract_start", e.target.value)}
            />
          </Field>
          <Field label="Vencimento">
            <Input
              type="date"
              value={form.contract_end}
              onChange={(e) => set("contract_end", e.target.value)}
            />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Informações adicionais do contrato (ex.: Horas contratadas/mês)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFields((f) => [...f, { label: "", value: "" }])}
                disabled={fields.length >= 30}
              >
                <Plus className="mr-1 h-3 w-3" /> Campo
              </Button>
            </div>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Rótulo"
                  value={f.label}
                  maxLength={60}
                  onChange={(e) =>
                    setFields((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <Input
                  placeholder="Valor"
                  value={f.value}
                  maxLength={200}
                  onChange={(e) =>
                    setFields((arr) => arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFields((arr) => arr.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
            <Label className="text-xs">Notificações do cliente</Label>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">Notificações por email</span>
              <Switch
                checked={form.email_notifications}
                onCheckedChange={(v) => set("email_notifications", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 opacity-60">
              <span className="text-sm">
                Notificações por WhatsApp{" "}
                <span className="text-xs text-muted-foreground">(em desenvolvimento)</span>
              </span>
              <Switch checked={form.whatsapp_notifications} disabled />
            </div>
          </div>
          {isEdit && (
            <Field label="Status" className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                Cliente ativo
              </label>
            </Field>
          )}
          <DialogFooter className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
